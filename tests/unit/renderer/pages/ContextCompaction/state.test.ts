import { describe, expect, it } from 'vitest';
import type { TokenUsageData } from '@/common/config/storage';
import {
  hasNewCompaction,
  isAwaitingCompactedUsage,
  mergeCompactionReading,
} from '@/renderer/pages/conversation/platforms/acp/ContextCompaction/state';

const previous: TokenUsageData = {
  total_tokens: 800_000,
  freshness: { status: 'current', turn_id: 'old', updated_at: 100, status_changed_at: 100 },
  compaction: { count: 2, last_compacted_at: 80, updated_at: 90, history_complete: true },
};

describe('native compaction evidence', () => {
  it('does not count an ordinary finish, a replay or history restoration as a new compaction', () => {
    expect(hasNewCompaction(previous, previous.compaction)).toBe(false);
    expect(
      hasNewCompaction({ ...previous, compaction: { ...previous.compaction!, count: 3 } }, previous.compaction)
    ).toBe(false);
    expect(hasNewCompaction(null, previous.compaction)).toBe(false);
  });

  it('requires a newly recorded completion, independently of the old usage figure', () => {
    expect(
      hasNewCompaction(
        { ...previous, compaction: { ...previous.compaction!, count: 3, last_compacted_at: 200 } },
        previous.compaction
      )
    ).toBe(true);
  });

  it('keeps usage pending until a server reading at or after the compaction exists', () => {
    const compacted = { ...previous, compaction: { ...previous.compaction!, last_compacted_at: 200 } };
    expect(isAwaitingCompactedUsage(compacted)).toBe(true);
    expect(isAwaitingCompactedUsage({ ...compacted, freshness: { ...previous.freshness!, updated_at: 201 } })).toBe(
      false
    );
    expect(isAwaitingCompactedUsage({ total_tokens: 10 })).toBe(false);
  });

  it('preserves a newer usage measurement and compaction count over delayed snapshots', () => {
    const current: TokenUsageData = {
      total_tokens: 20_000,
      freshness: { status: 'current', turn_id: 'new', updated_at: 300, status_changed_at: 300 },
      compaction: { count: 3, last_compacted_at: 200, updated_at: 200, history_complete: true },
    };
    expect(mergeCompactionReading(current, previous)).toEqual(current);
    expect(mergeCompactionReading(current, { total_tokens: 0, compaction: current.compaction })).toEqual(current);
  });
});
