/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { useCallback, useMemo, useState } from 'react';
import {
  filterConversationsByActivityPeriod,
  isConversationActivityPeriod,
  type ConversationActivityPeriod,
} from '../utils/activityPeriod';

const ACTIVITY_PERIOD_STORAGE_KEY = 'conversation-activity-period';
const ACTIVITY_FILTER_ENABLED_STORAGE_KEY = 'conversation-activity-filter-enabled';
const DEFAULT_ACTIVITY_PERIOD: ConversationActivityPeriod = 'today';

const readStoredEnabled = (): boolean => {
  try {
    return localStorage.getItem(ACTIVITY_FILTER_ENABLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const readStoredPeriod = (): ConversationActivityPeriod => {
  try {
    const stored = localStorage.getItem(ACTIVITY_PERIOD_STORAGE_KEY);
    return isConversationActivityPeriod(stored) ? stored : DEFAULT_ACTIVITY_PERIOD;
  } catch {
    return DEFAULT_ACTIVITY_PERIOD;
  }
};

export const useConversationActivityFilter = (conversations: TChatConversation[]) => {
  const [enabled, setEnabledState] = useState(readStoredEnabled);
  const [period, setPeriodState] = useState<ConversationActivityPeriod>(readStoredPeriod);
  const [referenceTime, setReferenceTime] = useState(Date.now);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    if (nextEnabled) setReferenceTime(Date.now());
    try {
      localStorage.setItem(ACTIVITY_FILTER_ENABLED_STORAGE_KEY, String(nextEnabled));
    } catch {
      // Ignore storage failures; the current selection still remains active.
    }
  }, []);

  const setPeriod = useCallback((nextPeriod: ConversationActivityPeriod) => {
    setPeriodState(nextPeriod);
    setReferenceTime(Date.now());
    try {
      localStorage.setItem(ACTIVITY_PERIOD_STORAGE_KEY, nextPeriod);
    } catch {
      // Ignore storage failures; the current selection still remains active.
    }
  }, []);

  const refresh = useCallback(() => setReferenceTime(Date.now()), []);

  const filteredConversations = useMemo(
    () => (enabled ? filterConversationsByActivityPeriod(conversations, period, referenceTime) : conversations),
    [conversations, enabled, period, referenceTime]
  );

  return {
    enabled,
    setEnabled,
    period,
    setPeriod,
    refresh,
    filteredConversations,
  };
};
