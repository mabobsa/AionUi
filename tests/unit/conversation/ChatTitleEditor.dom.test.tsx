/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import type { ConversationArchiveState } from '@/common/types/sidebar';
import { emitter } from '@/renderer/utils/emitter';

const { getArchiveState, conversationListeners } = vi.hoisted(() => ({
  getArchiveState: vi.fn<(params: { conversation_id: string }) => Promise<ConversationArchiveState>>(),
  conversationListeners: new Set<(event: { conversation_id: string }) => void>(),
}));

vi.mock('@/common', async () => {
  const actual = await vi.importActual<typeof import('@/common')>('@/common');
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      sidebar: {
        ...actual.ipcBridge.sidebar,
        getConversationArchiveState: { invoke: getArchiveState },
      },
      conversation: {
        ...actual.ipcBridge.conversation,
        listChanged: {
          on: (listener: (event: { conversation_id: string }) => void) => {
            conversationListeners.add(listener);
            return () => conversationListeners.delete(listener);
          },
        },
      },
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// The minimap pulls conversation messages over the IPC bridge; the title editor
// behaviour under test does not depend on it.
vi.mock('@/renderer/pages/conversation/components/ConversationTitleMinimap', () => ({
  default: () => null,
}));

import ChatTitleEditor from '@/renderer/pages/conversation/components/ChatTitleEditor';

beforeEach(() => {
  getArchiveState.mockReset().mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: null });
  conversationListeners.clear();
});

const renderEditor = (overrides: Partial<React.ComponentProps<typeof ChatTitleEditor>> = {}) => {
  const setEditingTitle = vi.fn();
  const props: React.ComponentProps<typeof ChatTitleEditor> = {
    editingTitle: false,
    titleDraft: '',
    setTitleDraft: vi.fn(),
    setEditingTitle,
    renameLoading: false,
    canRenameTitle: true,
    submitTitleRename: vi.fn().mockResolvedValue(undefined),
    titleAreaMaxWidth: 400,
    title: '',
    conversation_id: 'conv-1',
    ...overrides,
  };
  const cache = new Map();
  const view = render(<ChatTitleEditor {...props} />, {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>,
  });
  return { ...view, props, setEditingTitle };
};

describe('ChatTitleEditor with an empty conversation title', () => {
  it('shows the untitled placeholder so the header is not blank', () => {
    renderEditor();
    expect(screen.getByText('conversation.historySearch.untitled')).toBeInTheDocument();
  });

  it('enters edit mode when the title region is clicked', () => {
    const { setEditingTitle } = renderEditor();
    fireEvent.click(screen.getByTestId('chat-title-editor-trigger'));
    expect(setEditingTitle).toHaveBeenCalledWith(true);
  });

  it('stays read-only when rename is unavailable', () => {
    const { setEditingTitle } = renderEditor({ canRenameTitle: false });
    fireEvent.click(screen.getByTestId('chat-title-editor-trigger'));
    expect(setEditingTitle).not.toHaveBeenCalled();
  });
});

describe('ChatTitleEditor with a named conversation', () => {
  it('renders the real title instead of the untitled placeholder', () => {
    renderEditor({ title: '每日 AI 论文简报' });
    expect(screen.getByText('每日 AI 论文简报')).toBeInTheDocument();
    expect(screen.queryByText('conversation.historySearch.untitled')).not.toBeInTheDocument();
  });

  it('enters edit mode when the title region is clicked', () => {
    const { setEditingTitle } = renderEditor({ title: '每日 AI 论文简报' });
    fireEvent.click(screen.getByTestId('chat-title-editor-trigger'));
    expect(setEditingTitle).toHaveBeenCalledWith(true);
  });

  it('renders a title action without entering edit mode when the action is clicked', () => {
    const { setEditingTitle } = renderEditor({
      title: 'Document: Card',
      leadingAction: <button data-testid='title-action'>sync</button>,
    });

    fireEvent.click(screen.getByTestId('title-action'));
    expect(setEditingTitle).not.toHaveBeenCalled();
    expect(screen.getByTestId('title-action').nextElementSibling).toBe(screen.getByTestId('chat-title-editor-trigger'));
  });

  it('highlights a title that differs from its linked source', () => {
    renderEditor({ title: 'Old title', titleClassName: '!text-warning-6' });

    // The live MnP role label is nested inside the title's inherited warning color.
    expect(screen.getByText('Old title').closest('.text-16px')).toHaveClass('!text-warning-6');
  });
});

describe('archived conversation title status', () => {
  it.each([0, 1730000000000])('shows archive status beside the original title for archive time %i', async (time) => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: time });
    const { setEditingTitle } = renderEditor({ title: '일일 보고' });

    const badge = await screen.findByTestId('conversation-archive-badge');
    expect(badge).toHaveTextContent('conversation.history.archiveSuccess');
    expect(screen.getByTestId('chat-title-editor-trigger').textContent).toBe('일일 보고');
    fireEvent.click(badge);
    expect(setEditingTitle).not.toHaveBeenCalled();
  });

  it.each([
    { exists: true, archived_at: null },
    { exists: false, archived_at: null },
  ])('does not mark an active or missing conversation as archived: %j', async (state) => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', ...state });
    renderEditor({ title: '일일 보고' });
    await waitFor(() => expect(getArchiveState).toHaveBeenCalledWith({ conversation_id: 'conv-1' }));
    expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument();
  });

  it('removes the badge when the open conversation is restored', async () => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: 10 });
    renderEditor({ title: '일일 보고' });
    await screen.findByTestId('conversation-archive-badge');
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: null });

    act(() => conversationListeners.forEach((listener) => listener({ conversation_id: 'conv-1' })));
    await waitFor(() => expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument());
  });

  it('refreshes on history changes and ignores another conversation update', async () => {
    renderEditor();
    await waitFor(() => expect(getArchiveState).toHaveBeenCalledTimes(1));
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: 10 });

    act(() => conversationListeners.forEach((listener) => listener({ conversation_id: 'other' })));
    expect(getArchiveState).toHaveBeenCalledTimes(1);
    act(() => {
      emitter.emit('chat.history.refresh');
    });
    expect(await screen.findByTestId('conversation-archive-badge')).toBeVisible();
  });

  it('does not apply a late archive response after switching conversations', async () => {
    let resolveFirst!: (state: ConversationArchiveState) => void;
    const first = new Promise<ConversationArchiveState>((resolve) => {
      resolveFirst = resolve;
    });
    getArchiveState.mockImplementation(({ conversation_id }) =>
      conversation_id === 'conv-1' ? first : Promise.resolve({ conversation_id, exists: true, archived_at: null })
    );
    const { rerender, props } = renderEditor({ title: '이전 대화' });
    rerender(<ChatTitleEditor {...props} title='현재 대화' conversation_id='conv-2' />);
    await waitFor(() => expect(getArchiveState).toHaveBeenCalledWith({ conversation_id: 'conv-2' }));
    await act(async () => {
      resolveFirst({ conversation_id: 'conv-1', exists: true, archived_at: 10 });
    });
    expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-title-editor-trigger')).toHaveTextContent('현재 대화');
  });

  it('keeps the title usable when archive lookup fails', async () => {
    getArchiveState.mockRejectedValue(new Error('Unavailable'));
    const { setEditingTitle } = renderEditor({ title: '일일 보고' });
    await waitFor(() => expect(getArchiveState).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-title-editor-trigger'));
    expect(setEditingTitle).toHaveBeenCalledWith(true);
  });

  it('does not request archive status without a conversation id', () => {
    renderEditor({ conversation_id: undefined });
    expect(getArchiveState).not.toHaveBeenCalled();
    expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument();
  });
});
