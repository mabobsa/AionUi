import type { TChatConversation } from '@/common/config/storage';
import {
  countVisibleCompletionUnread,
  isConversationWindowFocused,
} from '@/renderer/pages/conversation/GroupedHistory/utils/completionUnread';
import ProjectGroupHeader from '@/renderer/pages/conversation/GroupedHistory/components/ProjectGroupHeader';
import WorkspaceCollapse from '@/renderer/pages/conversation/components/WorkspaceCollapse';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const conversation = (id: string): TChatConversation => ({ id }) as TChatConversation;

describe('completion unread taskbar state', () => {
  it('counts only unread ids present in the visible conversation list', () => {
    expect(
      countVisibleCompletionUnread(
        [conversation('visible-1'), conversation('visible-2')],
        new Set(['visible-1', 'team-hidden'])
      )
    ).toBe(1);
  });

  it('uses document focus to decide whether the active conversation is visible to the user', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    expect(isConversationWindowFocused()).toBe(false);

    vi.mocked(document.hasFocus).mockReturnValue(true);
    expect(isConversationWindowFocused()).toBe(true);
  });
});

describe('project completion unread state', () => {
  it('shows an unread marker on a collapsed project with unread completions', () => {
    render(
      React.createElement(WorkspaceCollapse, {
        expanded: false,
        onToggle: vi.fn(),
        header: React.createElement(ProjectGroupHeader, {
          workspace: 'C:\\Git\\AionUi\\AionUi',
          displayName: 'AionUi',
          showCompletionUnread: true,
        }),
        children: null,
      })
    );

    const marker = screen.getByTestId('project-completion-unread');
    expect(marker).toHaveClass('bg-[var(--conversation-completion-unread)]');
    expect(marker).toHaveClass('absolute', 'right-8px', 'group-hover:hidden');
    expect(marker.closest('.workspace-collapse')?.querySelector('.group')).toHaveClass('relative');
  });

  it('does not show a project marker when its conversations are visible', () => {
    render(
      React.createElement(ProjectGroupHeader, {
        workspace: 'C:\\Git\\AionUi\\AionUi',
        displayName: 'AionUi',
      })
    );

    expect(screen.queryByTestId('project-completion-unread')).not.toBeInTheDocument();
  });
});
