/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type SubscriptionUsageTone = 'normal' | 'warning' | 'limit';

/** Classifies subscription usage using the highest available percentage. */
export const getSubscriptionUsageTone = (...values: Array<number | null | undefined>): SubscriptionUsageTone => {
  const highest = values.reduce(
    (current, value) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(current, value) : current),
    0
  );

  if (highest >= 100) return 'limit';
  if (highest >= 80) return 'warning';
  return 'normal';
};
