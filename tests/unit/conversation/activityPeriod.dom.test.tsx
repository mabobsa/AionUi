/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import ConversationActivityFilter from '@/renderer/pages/conversation/GroupedHistory/components/ConversationActivityFilter';
import { useConversationActivityFilter } from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationActivityFilter';
import {
  filterConversationsByActivityPeriod,
  getActivityPeriodStart,
} from '@/renderer/pages/conversation/GroupedHistory/utils/activityPeriod';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'conversation.history.updatedFilter': 'Update filter',
        'conversation.history.updatedPeriod': 'Update period',
        'conversation.history.today': 'Today',
        'conversation.history.last1Day': 'Last 1 day',
        'conversation.history.last2Days': 'Last 2 days',
        'conversation.history.last3Days': 'Last 3 days',
        'conversation.history.last7Days': 'Last 7 days',
        'conversation.history.last30Days': 'Last 30 days',
        'common.refresh': 'Refresh',
      })[key] ?? key,
  }),
}));

const atLocalTime = (day: number, hour = 12): number => new Date(2026, 8, day, hour, 0, 0, 0).getTime();

const conversation = (id: string, modifiedAt: number, createdAt = modifiedAt): TChatConversation =>
  ({
    id,
    name: id,
    type: 'acp',
    created_at: createdAt,
    modified_at: modifiedAt,
    extra: { backend: 'aioncore' },
  }) as TChatConversation;

beforeEach(() => {
  localStorage.clear();
});

describe('conversation activity periods', () => {
  it('uses local midnight for today and rolling hours for the remaining periods', () => {
    const now = atLocalTime(9, 1);

    expect(getActivityPeriodStart('today', now)).toBe(new Date(2026, 8, 9, 0, 0, 0, 0).getTime());
    expect(getActivityPeriodStart('last1Day', now)).toBe(now - 24 * 60 * 60 * 1000);
    expect(getActivityPeriodStart('last2Days', now)).toBe(now - 48 * 60 * 60 * 1000);
    expect(getActivityPeriodStart('last3Days', now)).toBe(now - 72 * 60 * 60 * 1000);
  });

  it('keeps conversations inside the selected rolling period boundary', () => {
    const now = atLocalTime(9);
    const result = filterConversationsByActivityPeriod(
      [
        conversation('today', atLocalTime(9, 8)),
        conversation('three-day-edge', atLocalTime(6, 12)),
        conversation('old', atLocalTime(6, 11)),
      ],
      'last3Days',
      now
    );

    expect(result.map(({ id }) => id)).toEqual(['today', 'three-day-edge']);
  });

  it('falls back to creation time and keeps updates after the fixed reference time', () => {
    const now = atLocalTime(9);
    const result = filterConversationsByActivityPeriod(
      [
        conversation('created-today', 0, atLocalTime(9, 8)),
        conversation('missing-time', 0, 0),
        conversation('future', atLocalTime(10)),
      ],
      'today',
      now
    );

    expect(result.map(({ id }) => id)).toEqual(['created-today', 'future']);
  });
});

describe('ConversationActivityFilter', () => {
  it('keeps the period menu disabled until its checkbox is selected', () => {
    const onEnabledChange = vi.fn();
    render(
      <ConversationActivityFilter
        enabled={false}
        period='today'
        onEnabledChange={onEnabledChange}
        onPeriodChange={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Update period' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Update filter' }));
    expect(onEnabledChange.mock.calls[0]?.[0]).toBe(true);
  });

  it('calls the manual refresh action when filtering is enabled', () => {
    const onRefresh = vi.fn();
    render(
      <ConversationActivityFilter
        enabled
        period='last1Day'
        onEnabledChange={vi.fn()}
        onPeriodChange={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('restores both the enabled state and selected period', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(atLocalTime(9));
      localStorage.setItem('conversation-activity-period', 'last7Days');
      localStorage.setItem('conversation-activity-filter-enabled', 'true');
      const conversations = [conversation('today', atLocalTime(9)), conversation('old', atLocalTime(1))];
      const { result } = renderHook(() => useConversationActivityFilter(conversations));

      expect(result.current.period).toBe('last7Days');
      expect(result.current.enabled).toBe(true);
      expect(result.current.filteredConversations.map(({ id }) => id)).toEqual(['today']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists checkbox and period selections', () => {
    const { result } = renderHook(() => useConversationActivityFilter([]));

    act(() => {
      result.current.setEnabled(true);
      result.current.setPeriod('last2Days');
    });

    expect(localStorage.getItem('conversation-activity-filter-enabled')).toBe('true');
    expect(localStorage.getItem('conversation-activity-period')).toBe('last2Days');
  });

  it('keeps the cutoff fixed until the user refreshes it', () => {
    vi.useFakeTimers();
    try {
      const initialTime = atLocalTime(9);
      vi.setSystemTime(initialTime);
      localStorage.setItem('conversation-activity-period', 'last1Day');
      localStorage.setItem('conversation-activity-filter-enabled', 'true');
      const conversations = [conversation('near-edge', initialTime - 23 * 60 * 60 * 1000)];
      const { result } = renderHook(() => useConversationActivityFilter(conversations));

      vi.setSystemTime(initialTime + 2 * 60 * 60 * 1000);
      expect(result.current.filteredConversations.map(({ id }) => id)).toEqual(['near-edge']);

      act(() => result.current.refresh());
      expect(result.current.filteredConversations).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
