/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Popover } from '@arco-design/web-react';
import { Dashboard } from '@icon-park/react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ipcBridge } from '@/common';
import { subscriptionUsageBridge } from '@/common/platform/subscriptionUsageBridge';
import type { ClaudeRateLimitInfo, ClaudeUtilizationUnit } from '@/common/types/platform/claudeUsage';
import {
  pushClaudeRateLimitFromUsageSnapshot,
  pushClaudeUsageSnapshot,
  useClaudeRateLimit,
} from '@/renderer/hooks/useClaudeRateLimit';
import { isElectronDesktop } from '@/renderer/utils/platform';
import styles from './SubscriptionUsageIndicator.module.css';
import { getSubscriptionUsageTone, type SubscriptionUsageTone } from './subscriptionUsageTone';

/**
 * Titlebar widget mirroring Claude Code's `/usage`: shows the current session
 * (5-hour) and weekly (7-day) subscription limit state with reset times. Fed by
 * {@link useClaudeRateLimit}; renders nothing until a rate-limit update arrives.
 *
 * Note: the Claude Agent SDK omits the numeric `utilization` from headless/ACP
 * rate-limit events during normal operation (status "allowed"), only populating
 * it near a warning threshold — see anthropics/claude-code#50518. The desktop
 * client supplements those sparse events with a cached, background `/usage`
 * probe launched from the current Claude conversation workspace.
 */

// Utilization may arrive as a 0–1 fraction or an already-scaled 0–100 percentage.
const toPercent = (
  utilization: number | undefined,
  unit: ClaudeUtilizationUnit | 'auto' = 'auto'
): number | undefined => {
  if (typeof utilization !== 'number' || Number.isNaN(utilization)) return undefined;
  const pct =
    unit === 'ratio'
      ? utilization * 100
      : unit === 'percent'
        ? utilization
        : utilization <= 1
          ? utilization * 100
          : utilization;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

export const formatClaudeUsagePillPercentages = (
  sessionUtilization: number | undefined,
  weeklyUtilization: number | undefined,
  sessionUnit: ClaudeUtilizationUnit | 'auto' = 'auto',
  weeklyUnit: ClaudeUtilizationUnit | 'auto' = 'auto'
): string | undefined => {
  const sessionPercent = toPercent(sessionUtilization, sessionUnit);
  const weeklyPercent = toPercent(weeklyUtilization, weeklyUnit);
  const parts = [
    sessionPercent === undefined ? undefined : `${sessionPercent}%`,
    weeklyPercent === undefined ? undefined : `${weeklyPercent}%`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : undefined;
};

// resetsAt is an epoch value in seconds or milliseconds; normalize to ms.
const formatReset = (resetsAt: number | undefined, includeDate: boolean): string | undefined => {
  if (typeof resetsAt !== 'number' || resetsAt <= 0) return undefined;
  const ms = resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(undefined, {
    ...(includeDate ? { month: 'short', day: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  });
};

const statusUsageFloor = (status: ClaudeRateLimitInfo['status'] | undefined): number =>
  status === 'rejected' ? 100 : status === 'allowed_warning' ? 80 : 0;

const toneClass = (tone: SubscriptionUsageTone, kind: 'text' | 'bg'): string =>
  tone === 'limit'
    ? `${kind}-danger-6`
    : tone === 'warning'
      ? `${kind}-warning-6`
      : kind === 'text'
        ? 'text-t-secondary'
        : 'bg-primary-6';

const usageTone = (info: ClaudeRateLimitInfo | undefined): SubscriptionUsageTone =>
  getSubscriptionUsageTone(
    toPercent(info?.utilization, info?.utilizationUnit ?? 'auto'),
    statusUsageFloor(info?.status)
  );

const ClaudeUsagePill: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { session, weekly } = useClaudeRateLimit();

  useEffect(() => {
    if (!isElectronDesktop()) return;

    const conversationId = location.pathname.match(/^\/conversation\/([^/]+)/)?.[1];
    if (!conversationId) return;

    let requestInFlight = false;

    const refresh = (): void => {
      if (requestInFlight || document.visibilityState === 'hidden') return;
      requestInFlight = true;
      void subscriptionUsageBridge.getClaude
        .invoke({ conversationId })
        .then(pushClaudeUsageSnapshot)
        .catch((): void => {})
        .finally(() => {
          requestInFlight = false;
        });
    };

    const refreshWhenVisible = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };

    const stopUsageUpdates = subscriptionUsageBridge.claudeChanged.on(pushClaudeUsageSnapshot);

    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      stopUsageUpdates();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [location.pathname]);

  useEffect(() => {
    const conversationId = location.pathname.match(/^\/conversation\/([^/]+)/)?.[1];
    if (!conversationId) return;

    let requestInFlight = false;
    const refresh = (): void => {
      if (requestInFlight) return;
      requestInFlight = true;
      void ipcBridge.conversation.getUsage
        .invoke({ conversation_id: conversationId })
        .then(pushClaudeRateLimitFromUsageSnapshot)
        .catch((): void => {})
        .finally(() => {
          requestInFlight = false;
        });
    };

    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  if (!session && !weekly) return null;

  const statusText = (status: ClaudeRateLimitInfo['status']): string =>
    status === 'rejected'
      ? t('common.claudeUsage.reached', { defaultValue: 'Usage limit reached' })
      : status === 'allowed_warning'
        ? t('common.claudeUsage.approaching', { defaultValue: 'Approaching limit' })
        : t('common.claudeUsage.ok', { defaultValue: 'Within limit' });

  const renderRow = (label: string, info: ClaudeRateLimitInfo, includeDate: boolean) => {
    const pct = toPercent(info.utilization, info.utilizationUnit ?? 'auto');
    const tone = usageTone(info);
    const reset = formatReset(info.resetsAt, includeDate);
    return (
      <div className='flex flex-col gap-4px'>
        <div className='flex items-center justify-between gap-12px'>
          <span className='text-12px font-500 text-t-primary'>{label}</span>
          <span className={`text-12px font-600 ${toneClass(tone, 'text')}`}>
            {pct === undefined ? statusText(info.status) : `${pct}%`}
          </span>
        </div>
        {pct === undefined ? null : (
          <div className='h-6px w-full overflow-hidden rounded-999px bg-fill-2'>
            <div
              className={`h-full rounded-999px ${toneClass(tone, 'bg')}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        )}
        {reset ? (
          <span className='text-11px text-t-tertiary'>
            {t('common.claudeUsage.resets', { time: reset, defaultValue: 'Resets {{time}}' })}
          </span>
        ) : null}
      </div>
    );
  };

  const sessionPercent = toPercent(session?.utilization, session?.utilizationUnit ?? 'auto');
  const weeklyPercent = toPercent(weekly?.utilization, weekly?.utilizationUnit ?? 'auto');
  const pillTone = getSubscriptionUsageTone(
    sessionPercent,
    weeklyPercent,
    statusUsageFloor(session?.status),
    statusUsageFloor(weekly?.status)
  );

  // Keep both quota windows visible in the titlebar. If neither window includes
  // a percentage, fall back to reset/status data so probe failures remain useful.
  const percentagePillText = formatClaudeUsagePillPercentages(
    session?.utilization,
    weekly?.utilization,
    session?.utilizationUnit,
    weekly?.utilizationUnit
  );
  const pillText =
    percentagePillText ??
    formatReset(session?.resetsAt, false) ??
    formatReset(weekly?.resetsAt, true) ??
    statusText(session?.status ?? weekly?.status);

  const content = (
    <div className='flex w-200px flex-col gap-12px p-4px'>
      <span className='text-12px font-600 text-t-primary'>
        {t('common.claudeUsage.title', { defaultValue: 'Claude Usage' })}
      </span>
      {session ? renderRow(t('common.claudeUsage.session', { defaultValue: '5-hour limit' }), session, false) : null}
      {weekly ? renderRow(t('common.claudeUsage.weekly', { defaultValue: 'Weekly (all models)' }), weekly, true) : null}
    </div>
  );

  return (
    <Popover trigger='hover' position='br' content={content}>
      <div
        className={`${styles.usage} ${styles[pillTone]} ${toneClass(pillTone, 'text')}`}
        aria-label={t('common.claudeUsage.title', { defaultValue: 'Claude Usage' })}
      >
        <Dashboard theme='outline' size={14} fill='currentColor' />
        <span className='text-12px font-600 leading-none'>{pillText}</span>
      </div>
    </Popover>
  );
};

export default ClaudeUsagePill;
