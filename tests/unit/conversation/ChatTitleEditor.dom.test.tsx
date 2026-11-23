/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { Message } from '@arco-design/web-react';
import type { ConversationArchiveState } from '@/common/types/sidebar';
import { emitter } from '@/renderer/utils/emitter';

const { getArchiveState, unarchive, conversationListeners } = vi.hoisted(() => ({
  getArchiveState: vi.fn<(params: { conversation_id: string }) => Promise<ConversationArchiveState>>(),
  unarchive: vi.fn<(params: { item_type: 'conversation'; item_id: string }) => Promise<void>>(),
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
        unarchive: { invoke: unarchive },
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
  // Static toast roots use the React adapter installed by main.tsx. This test
  // exercises the real context menu and verifies toast calls without that root.
  vi.spyOn(Message, 'success').mockReturnValue(() => {});
  vi.spyOn(Message, 'error').mockReturnValue(() => {});
  getArchiveState.mockReset().mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: null });
  unarchive.mockReset().mockResolvedValue(undefined);
  conversationListeners.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  Message.clear();
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
  it('opens the restore menu on right click and refreshes history after restoring', async () => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: 10 });
    unarchive.mockImplementation(async () => {
      getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: null });
    });
    const refresh = vi.spyOn(emitter, 'emit');
    const { setEditingTitle } = renderEditor({ title: '일일 보고' });
    const badge = await screen.findByTestId('conversation-archive-badge');
    fireEvent.click(badge);
    expect(screen.queryByText('settings.archived.restore')).not.toBeInTheDocument();
    fireEvent.contextMenu(badge);
    fireEvent.click(await screen.findByText('settings.archived.restore'));

    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ item_type: 'conversation', item_id: 'conv-1' }));
    await waitFor(() => expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalledWith('chat.history.refresh');
    expect(setEditingTitle).not.toHaveBeenCalled();
  });

  it('keeps the badge and permits retry when restoring fails', async () => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: 10 });
    unarchive.mockRejectedValueOnce(new Error('Unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorMessage = vi.spyOn(Message, 'error');
    renderEditor();
    const badge = await screen.findByTestId('conversation-archive-badge');
    fireEvent.contextMenu(badge);
    fireEvent.click(await screen.findByText('settings.archived.restore'));
    await waitFor(() => expect(errorMessage).toHaveBeenCalledWith('settings.archived.restoreFailed'));
    expect(badge).toBeVisible();

    unarchive.mockImplementation(async () => {
      getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: null });
    });
    fireEvent.contextMenu(badge);
    fireEvent.click(await screen.findByText('settings.archived.restore'));
    await waitFor(() => expect(unarchive).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument());
  });

  it('clears a successfully restored badge even when the follow-up read fails', async () => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: 10 });
    unarchive.mockImplementation(async () => {
      getArchiveState.mockRejectedValue(new Error('Revalidation unavailable'));
    });
    const errorMessage = vi.spyOn(Message, 'error');
    renderEditor();
    fireEvent.contextMenu(await screen.findByTestId('conversation-archive-badge'));
    fireEvent.click(await screen.findByText('settings.archived.restore'));
    await waitFor(() => expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument());
    expect(errorMessage).not.toHaveBeenCalled();
  });

  it('does not submit duplicate requests while restoration is pending', async () => {
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: 10 });
    let finishRestore!: () => void;
    unarchive.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRestore = resolve;
      })
    );
    renderEditor();
    const badge = await screen.findByTestId('conversation-archive-badge');
    fireEvent.contextMenu(badge);
    const item = await screen.findByText('settings.archived.restore');
    fireEvent.click(item);
    fireEvent.click(item);
    expect(unarchive).toHaveBeenCalledTimes(1);
    expect(badge).toHaveAttribute('aria-busy', 'true');
    getArchiveState.mockResolvedValue({ conversation_id: 'conv-1', exists: true, archived_at: null });
    await act(async () => {
      finishRestore();
    });
    await waitFor(() => expect(screen.queryByTestId('conversation-archive-badge')).not.toBeInTheDocument());
  });

  it('does not clear another conversation badge when an earlier restore completes after navigation', async () => {
    getArchiveState.mockImplementation(async ({ conversation_id }) => ({
      conversation_id,
      exists: true,
      archived_at: 10,
    }));
    let finishRestore!: () => void;
    unarchive.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRestore = resolve;
      })
    );
    const { rerender, props } = renderEditor();
    fireEvent.contextMenu(await screen.findByTestId('conversation-archive-badge'));
    fireEvent.click(await screen.findByText('settings.archived.restore'));
    rerender(<ChatTitleEditor {...props} conversation_id='conv-2' title='다른 보관 대화' />);
    await waitFor(() => expect(getArchiveState).toHaveBeenCalledWith({ conversation_id: 'conv-2' }));
    await act(async () => {
      finishRestore();
    });

    expect(unarchive).toHaveBeenCalledWith({ item_type: 'conversation', item_id: 'conv-1' });
    expect(screen.getByTestId('conversation-archive-badge')).toBeVisible();
    expect(screen.getByTestId('chat-title-editor-trigger')).toHaveTextContent('다른 보관 대화');
  });

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
