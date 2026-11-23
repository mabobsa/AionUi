import type { ContextCompaction, TokenUsageData } from '@/common/config/storage';

export type CompactionPhase = 'idle' | 'running' | 'complete' | 'unconfirmed' | 'failed';

/** Keep late hydration or metadata-only frames from restoring an older reading. */
export const mergeCompactionReading = (previous: TokenUsageData | null, next: TokenUsageData): TokenUsageData => {
  if (!previous) return next;
  const olderReading = Boolean(
    previous.freshness && (!next.freshness || next.freshness.status_changed_at < previous.freshness.status_changed_at)
  );
  const compaction =
    next.compaction && next.compaction.updated_at >= (previous.compaction?.updated_at ?? 0)
      ? next.compaction
      : previous.compaction;
  return {
    ...(olderReading || next.total_tokens <= 0 ? previous : next),
    freshness: olderReading ? previous.freshness : (next.freshness ?? previous.freshness),
    compaction,
  };
};

/** Completion is evidence from the durable ledger, never an ordinary turn finish. */
export const hasNewCompaction = (usage: TokenUsageData | null, baseline?: ContextCompaction): boolean => {
  const next = usage?.compaction;
  return Boolean(
    next &&
    next.count > (baseline?.count ?? 0) &&
    next.last_compacted_at != null &&
    (baseline?.last_compacted_at == null || next.last_compacted_at > baseline.last_compacted_at)
  );
};

/** Compare server timestamps only; mobile clients may have a different clock. */
export const isAwaitingCompactedUsage = (usage: TokenUsageData | null): boolean => {
  const compactedAt = usage?.compaction?.last_compacted_at;
  if (compactedAt == null) return false;
  return usage?.freshness?.updated_at == null || usage.freshness.updated_at < compactedAt;
};
