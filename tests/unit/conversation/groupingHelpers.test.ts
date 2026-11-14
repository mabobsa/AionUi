/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import { groupBookmarkedConversations } from '@/renderer/pages/conversation/GroupedHistory/utils/bookmarkHelpers';
import { buildGroupedHistory } from '@/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers';

const t = (key: string): string => key;

const conversation = (id: string, extra: TChatConversation['extra'], modified_at: number): TChatConversation =>
  ({
    id,
    name: id,
    type: 'acp',
    created_at: modified_at,
    modified_at,
    extra,
  }) as TChatConversation;

describe('buildGroupedHistory', () => {
  it('groups canonical bookmarks by project while keeping them in the regular timeline', () => {
    const bookmarked = {
      ...conversation(
        'canonical-bookmark',
        {
          backend: 'aioncore',
          workspace: '/repo/aionui',
          custom_workspace: true,
        },
        100
      ),
      pinned: true,
      pinned_at: 200,
    } as TChatConversation;

    const result = buildGroupedHistory([bookmarked], t);
    const bookmarkGroups = groupBookmarkedConversations(result.pinnedConversations, t);

    expect(result.pinnedConversations).toEqual([bookmarked]);
    expect(bookmarkGroups).toEqual([
      expect.objectContaining({
        workspace: '/repo/aionui',
        conversations: [bookmarked],
      }),
    ]);
    expect(result.timelineSections[0]?.items).toEqual([
      expect.objectContaining({
        type: 'workspace',
        workspaceGroup: expect.objectContaining({ conversations: [bookmarked] }),
      }),
    ]);
  });

  it('recognizes legacy extra bookmarks and places conversations without projects in a separate group', () => {
    const legacyBookmark = conversation('legacy-bookmark', { backend: 'aioncore', pinned: true, pinned_at: 100 }, 100);

    const result = buildGroupedHistory([legacyBookmark], t);
    const bookmarkGroups = groupBookmarkedConversations(result.pinnedConversations, t);

    expect(result.pinnedConversations).toEqual([legacyBookmark]);
    expect(bookmarkGroups).toEqual([
      {
        key: 'without-project',
        label: 'conversation.history.bookmarksWithoutProject',
        conversations: [legacyBookmark],
      },
    ]);
    expect(result.timelineSections[0]?.items[0]).toEqual(expect.objectContaining({ conversation: legacyBookmark }));
  });

  it('excludes archived and team-owned conversations from bookmarks', () => {
    const result = buildGroupedHistory(
      [
        conversation('archived-bookmark', { backend: 'aioncore', archived: true, pinned: true }, 100),
        conversation('team-bookmark', { backend: 'aioncore', team_id: 'team-1', pinned: true }, 100),
      ],
      t
    );

    expect(result.pinnedConversations).toEqual([]);
    expect(groupBookmarkedConversations(result.pinnedConversations, t)).toEqual([]);
  });

  it('keeps scheduled-task conversations in the regular conversation timeline', () => {
    const result = buildGroupedHistory(
      [conversation('cron-conversation', { backend: 'aioncore', cron_job_id: 'job-1' }, 100)],
      t
    );

    expect(result.timelineSections[0]?.items).toEqual([
      expect.objectContaining({
        type: 'conversation',
        conversation: expect.objectContaining({ id: 'cron-conversation' }),
      }),
    ]);
  });

  it('keeps scheduled-task conversations with workspaces in the project section', () => {
    const result = buildGroupedHistory(
      [
        conversation(
          'cron-project-conversation',
          {
            backend: 'aioncore',
            cron_job_id: 'job-1',
            workspace: '/repo/aionui',
            custom_workspace: true,
          },
          100
        ),
      ],
      t
    );

    expect(result.timelineSections[0]?.items).toEqual([
      expect.objectContaining({
        type: 'workspace',
        workspaceGroup: expect.objectContaining({
          workspace: '/repo/aionui',
          conversations: [expect.objectContaining({ id: 'cron-project-conversation' })],
        }),
      }),
    ]);
  });

  it('keeps one Windows folder in one project group regardless of separators, case and trailing separators', () => {
    const windowsProject = (id: string, workspace: string, modified_at: number) =>
      conversation(id, { backend: 'aioncore', workspace, custom_workspace: true }, modified_at);
    const result = buildGroupedHistory(
      [
        windowsProject('backslash-1', 'C:\\Git\\Holdem\\hdtf-client', 100),
        windowsProject('backslash-2', 'C:\\Git\\Holdem\\hdtf-client', 110),
        // An external launcher passed the same folder with forward slashes.
        windowsProject('forward-slash', 'C:/Git/Holdem/hdtf-client', 300),
        windowsProject('lower-trailing', 'c:\\git\\holdem\\hdtf-client\\', 120),
        windowsProject('other-folder', 'C:\\Git\\Holdem_Fork1\\hdtf-client', 90),
      ],
      t
    );

    const groups = result.timelineSections[0]?.items.filter((item) => item.type === 'workspace') ?? [];
    expect(groups).toHaveLength(2);
    expect(groups[0]?.workspaceGroup).toEqual(
      expect.objectContaining({
        workspace: 'C:\\Git\\Holdem\\hdtf-client',
        conversations: ['forward-slash', 'lower-trailing', 'backslash-2', 'backslash-1'].map((id) =>
          expect.objectContaining({ id })
        ),
      })
    );
    expect(groups[1]?.workspaceGroup?.workspace).toBe('C:\\Git\\Holdem_Fork1\\hdtf-client');

    const bookmarkGroups = groupBookmarkedConversations(
      [
        windowsProject('bookmark-backslash', 'C:\\Git\\Holdem\\hdtf-client', 100),
        windowsProject('bookmark-forward', 'C:/Git/Holdem/hdtf-client', 200),
      ],
      t
    );
    expect(bookmarkGroups).toHaveLength(1);
    expect(bookmarkGroups[0]?.conversations.map((item) => item.id)).toEqual(['bookmark-backslash', 'bookmark-forward']);
  });

  it('keeps POSIX project paths case-sensitive', () => {
    const result = buildGroupedHistory(
      [
        conversation('posix-a', { backend: 'aioncore', workspace: '/Users/dev/Project', custom_workspace: true }, 100),
        conversation('posix-b', { backend: 'aioncore', workspace: '/Users/dev/project/', custom_workspace: true }, 90),
        conversation('posix-c', { backend: 'aioncore', workspace: '/Users/dev/Project/', custom_workspace: true }, 80),
      ],
      t
    );
    const groups = result.timelineSections[0]?.items.filter((item) => item.type === 'workspace') ?? [];
    expect(groups.map((item) => item.workspaceGroup?.conversations.map((entry) => entry.id))).toEqual([
      ['posix-a', 'posix-c'],
      ['posix-b'],
    ]);
  });

  it('continues to hide team-owned conversations from the regular history', () => {
    const result = buildGroupedHistory(
      [conversation('team-conversation', { backend: 'aioncore', team_id: 'team-1' }, 100)],
      t
    );

    expect(result.timelineSections).toEqual([]);
  });
});
