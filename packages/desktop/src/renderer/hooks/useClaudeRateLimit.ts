/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from 'react';
import type {
  ClaudeRateLimitInfo,
  ClaudeRateLimitType,
  ClaudeUsageSnapshot,
} from '@/common/types/platform/claudeUsage';

/**
 * Claude subscription rate-limit info, forwarded from the Claude Agent SDK
 * (`rate_limit_event`) by the claude-agent-acp adapter (>= 0.55.0) inside the
 * ACP `usage_update._meta["_claude/rateLimit"]`, then relayed verbatim through
 * AionCore's `acp_context_usage` stream event. Keys stay in the SDK's original
 * camelCase (the stream path is not snake_case-normalized).
 *
 * Only subscription (claude.ai Pro/Max) auth on the `claude` ACP backend emits
 * this; API-key paths never produce it.
 */
export type { ClaudeRateLimitInfo, ClaudeRateLimitType, ClaudeUsageSnapshot };

export type ClaudeRateLimitState = {
  /** 5-hour rolling window — matches `/usage`'s "Current session". */
  session?: ClaudeRateLimitInfo;
  /** 7-day window (all models) — matches `/usage`'s "Current week". */
  weekly?: ClaudeRateLimitInfo;
  /** Timestamp of the last update, or 0 if nothing received yet. */
  updatedAt: number;
};

// Module-level store keyed by rateLimitType so the latest value for each window
// survives component remounts (the titlebar widget can unmount/remount freely).
const store = new Map<ClaudeRateLimitType, ClaudeRateLimitInfo>();
const listeners = new Set<() => void>();
let updatedAt = 0;

const WEEKLY_PRIORITY: ClaudeRateLimitType[] = [
  'seven_day',
  'seven_day_overage_included',
  'seven_day_opus',
  'seven_day_sonnet',
  'overage',
];

const derive = (): ClaudeRateLimitState => ({
  session: store.get('five_hour'),
  weekly: WEEKLY_PRIORITY.map((key) => store.get(key)).find(Boolean),
  updatedAt,
});

// Cached snapshot kept referentially stable between updates so useSyncExternalStore
// does not loop (getSnapshot must return the same reference when nothing changed).
let snapshot: ClaudeRateLimitState = derive();

const mergeRateLimit = (info: ClaudeRateLimitInfo | undefined): boolean => {
  if (!info?.rateLimitType) return false;
  store.set(info.rateLimitType, { ...store.get(info.rateLimitType), ...info });
  return true;
};

const publishSnapshot = (nextUpdatedAt: number): void => {
  updatedAt = nextUpdatedAt;
  snapshot = derive();
  for (const listener of listeners) listener();
};

/**
 * Feed a rate-limit info object into the global store. Called from the ACP
 * message stream handler when `_meta["_claude/rateLimit"]` is present.
 */
export const pushClaudeRateLimit = (info: ClaudeRateLimitInfo | undefined | null): void => {
  if (!mergeRateLimit(info ?? undefined)) return;
  publishSnapshot(Date.now());
};

/** Merge the account-wide snapshot returned by the desktop Claude usage probe. */
export const pushClaudeUsageSnapshot = (usage: ClaudeUsageSnapshot | undefined | null): void => {
  if (!usage) return;
  const sessionChanged = mergeRateLimit(usage.session);
  const weeklyChanged = mergeRateLimit(usage.weekly);
  if (!sessionChanged && !weeklyChanged) return;
  publishSnapshot(usage.updatedAt);
};

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = (): ClaudeRateLimitState => snapshot;

/** Non-reactive read of the current state, for tests and non-React consumers. */
export const getClaudeRateLimitSnapshot = (): ClaudeRateLimitState => snapshot;

/** Subscribe to the latest Claude subscription usage/limit state. */
export const useClaudeRateLimit = (): ClaudeRateLimitState => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
