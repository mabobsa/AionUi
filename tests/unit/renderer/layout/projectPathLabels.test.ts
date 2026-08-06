import { parseGitHead } from '@/renderer/pages/conversation/GroupedHistory/hooks/useProjectGitBranches';
import { getParentAndCurrentDir } from '@/renderer/utils/workspace/projectPathLabel';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/common', () => ({
  ipcBridge: { fs: { readFile: { invoke: vi.fn() } } },
}));

describe('project path labels', () => {
  it.each([
    ['D:\\Git\\AionUi', 'Git/AionUi'],
    ['/work/projects/AionUi/', 'projects/AionUi'],
    ['AionUi', 'AionUi'],
  ])('shows the parent and current directory for %s', (path, expected) => {
    expect(getParentAndCurrentDir(path)).toBe(expected);
  });

  it('parses branch names and detached commit hashes from Git HEAD', () => {
    expect(parseGitHead('ref: refs/heads/feature/sidebar\n')).toBe('feature/sidebar');
    expect(parseGitHead('839450f4d4a323374cada9f1e7efebedb66a6f58')).toBe('839450f');
    expect(parseGitHead('not a git head')).toBeNull();
  });
});
