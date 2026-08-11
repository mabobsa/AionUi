/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaudeUsageSnapshot } from '@/common/types/platform/claudeUsage';
import type { CodexUsageSnapshot } from '@/common/types/platform/codexUsage';
import styles from '@/renderer/components/layout/Titlebar/SubscriptionUsageIndicator.module.css';

const fixtures = vi.hoisted(() => ({
  claudeInvoke: vi.fn(),
  claudeListener: undefined as ((usage: ClaudeUsageSnapshot) => void) | undefined,
  codexInvoke: vi.fn(),
  codexListener: undefined as ((usage: CodexUsageSnapshot) => void) | undefined,
  conversationUsageInvoke: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/conversation/first' }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      getUsage: { invoke: fixtures.conversationUsageInvoke },
    },
  },
}));

vi.mock('@/common/platform/subscriptionUsageBridge', () => ({
  subscriptionUsageBridge: {
    getClaude: { invoke: fixtures.claudeInvoke },
    getCodex: { invoke: fixtures.codexInvoke },
    claudeChanged: {
      on: (listener: (usage: ClaudeUsageSnapshot) => void) => {
        fixtures.claudeListener = listener;
        return vi.fn();
      },
    },
    codexChanged: {
      on: (listener: (usage: CodexUsageSnapshot) => void) => {
        fixtures.codexListener = listener;
        return vi.fn();
      },
    },
  },
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@icon-park/react', () => ({
  Dashboard: () => <span />,
}));

import ConversationUsageIndicator from '@/renderer/components/layout/Titlebar/ConversationUsageIndicator';

describe('ConversationUsageIndicator', () => {
  beforeEach(() => {
    fixtures.claudeInvoke.mockReset().mockResolvedValue(null);
    fixtures.codexInvoke.mockReset().mockResolvedValue(null);
    fixtures.conversationUsageInvoke.mockReset().mockResolvedValue(null);
    fixtures.claudeListener = undefined;
    fixtures.codexListener = undefined;
  });

  it('renders Claude and Codex publisher updates immediately with exact percentages', async () => {
    render(<ConversationUsageIndicator />);

    await act(async () => {
      fixtures.claudeListener?.({
        session: { rateLimitType: 'five_hour', utilization: 1, utilizationUnit: 'percent' },
        weekly: { rateLimitType: 'seven_day', utilization: 30, utilizationUnit: 'percent' },
        updatedAt: Date.now(),
      });
      fixtures.codexListener?.({
        weekly: { usedPercent: 1 },
        limitReached: false,
        updatedAt: Date.now(),
      });
    });

    expect(screen.getByLabelText('Claude Usage')).toHaveTextContent('1% · 30%');
    expect(screen.getByLabelText('Codex Usage')).toHaveTextContent('1%');
  });

  it('colors Claude by its higher quota while keeping low Codex usage normal', async () => {
    render(<ConversationUsageIndicator />);

    await act(async () => {
      fixtures.claudeListener?.({
        session: { rateLimitType: 'five_hour', utilization: 97, utilizationUnit: 'percent' },
        weekly: { rateLimitType: 'seven_day', utilization: 39, utilizationUnit: 'percent' },
        updatedAt: Date.now(),
      });
      fixtures.codexListener?.({
        weekly: { usedPercent: 15 },
        limitReached: false,
        updatedAt: Date.now(),
      });
    });

    expect(screen.getByLabelText('Claude Usage')).toHaveClass(styles.warning);
    expect(screen.getByLabelText('Codex Usage')).not.toHaveClass(styles.warning, styles.limit);
  });

  it('shows the limit tone when Codex reports the limit reached flag', async () => {
    render(<ConversationUsageIndicator />);

    await act(async () => {
      fixtures.codexListener?.({
        weekly: { usedPercent: 15 },
        limitReached: true,
        updatedAt: Date.now(),
      });
    });

    expect(screen.getByLabelText('Codex Usage')).toHaveClass(styles.limit);
  });

  it('hides Claude and Codex usage when their snapshots become five minutes old', async () => {
    vi.useFakeTimers();
    try {
      const updatedAt = Date.now();
      render(<ConversationUsageIndicator />);

      await act(async () => {
        fixtures.claudeListener?.({
          session: { rateLimitType: 'five_hour', utilization: 31, utilizationUnit: 'percent' },
          updatedAt,
        });
        fixtures.codexListener?.({
          weekly: { usedPercent: 29 },
          limitReached: false,
          updatedAt,
        });
      });
      expect(screen.getByLabelText('Claude Usage')).toBeInTheDocument();
      expect(screen.getByLabelText('Codex Usage')).toBeInTheDocument();

      await act(async () => vi.advanceTimersByTimeAsync(5 * 60_000));

      expect(screen.queryByLabelText('Claude Usage')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Codex Usage')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
