import { useProjectGitBranches } from '@/renderer/pages/conversation/GroupedHistory/hooks/useProjectGitBranches';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGitBranches: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      getGitBranches: { invoke: mocks.getGitBranches },
    },
  },
}));

describe('useProjectGitBranches', () => {
  beforeEach(() => {
    mocks.getGitBranches.mockReset();
  });

  it('deduplicates workspaces and resolves all branches with one request', async () => {
    mocks.getGitBranches.mockResolvedValue([
      { workspace: 'C:\\Git\\Alpha', branch: 'main' },
      { workspace: 'C:\\Git\\Plain', branch: null },
    ]);

    const { result } = renderHook(() => useProjectGitBranches(['C:\\Git\\Plain', 'C:\\Git\\Alpha', 'C:\\Git\\Alpha']));

    await waitFor(() => expect(result.current['C:\\Git\\Alpha']).toBe('main'));
    expect(mocks.getGitBranches).toHaveBeenCalledOnce();
    expect(mocks.getGitBranches).toHaveBeenCalledWith({
      workspaces: ['C:\\Git\\Alpha', 'C:\\Git\\Plain'],
    });
  });

  it('keeps each requested workspace unknown when the batch request fails', async () => {
    mocks.getGitBranches.mockRejectedValue(new Error('backend unavailable'));

    const { result } = renderHook(() => useProjectGitBranches(['C:\\Git\\Alpha']));

    await waitFor(() => expect(result.current).toEqual({ 'C:\\Git\\Alpha': null }));
  });

  it('refreshes all workspaces together when the window regains focus', async () => {
    mocks.getGitBranches
      .mockResolvedValueOnce([{ workspace: 'C:\\Git\\Alpha', branch: 'main' }])
      .mockResolvedValueOnce([{ workspace: 'C:\\Git\\Alpha', branch: 'feature/focus' }]);
    const { result } = renderHook(() => useProjectGitBranches(['C:\\Git\\Alpha']));
    await waitFor(() => expect(result.current['C:\\Git\\Alpha']).toBe('main'));

    act(() => window.dispatchEvent(new Event('focus')));

    await waitFor(() => expect(result.current['C:\\Git\\Alpha']).toBe('feature/focus'));
    expect(mocks.getGitBranches).toHaveBeenCalledTimes(2);
  });
});
