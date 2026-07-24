/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { emitter } from '@/renderer/utils/emitter';
import { Message, Modal } from '@arco-design/web-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type RemoveConversation = (conversationId: string) => Promise<boolean>;

export const useConversationArchiveActions = (removeConversation: RemoveConversation) => {
  const { t } = useTranslation();

  const setArchived = useCallback(
    async (conversation: TChatConversation, archived: boolean) => {
      try {
        const success = await ipcBridge.conversation.update.invoke({
          id: conversation.id,
          updates: { extra: { archived } as Partial<TChatConversation['extra']> } as Partial<TChatConversation>,
          merge_extra: true,
        });
        if (success) {
          emitter.emit('chat.history.refresh');
          Message.success(t(archived ? 'conversation.history.archiveSuccess' : 'conversation.history.restoreSuccess'));
        } else {
          Message.error(t('conversation.history.archiveFailed'));
        }
      } catch (error) {
        console.error('Failed to update archived state:', error);
        Message.error(t('conversation.history.archiveFailed'));
      }
    },
    [t]
  );

  const handleArchive = useCallback(
    (conversation: TChatConversation): void => {
      void setArchived(conversation, true);
    },
    [setArchived]
  );

  const handleRestore = useCallback(
    (conversation: TChatConversation): void => {
      void setArchived(conversation, false);
    },
    [setArchived]
  );

  const handleClearArchived = useCallback(
    (archivedConversations: TChatConversation[]) => {
      if (archivedConversations.length === 0) return;
      Modal.confirm({
        title: t('conversation.history.clearArchivedTitle'),
        content: t('conversation.history.clearArchivedConfirm', { count: archivedConversations.length }),
        okText: t('conversation.history.confirmDelete'),
        cancelText: t('conversation.history.cancelDelete'),
        okButtonProps: { status: 'warning' },
        onOk: async () => {
          try {
            const results = await Promise.all(
              archivedConversations.map((conversation) => removeConversation(conversation.id))
            );
            const successCount = results.filter(Boolean).length;
            emitter.emit('chat.history.refresh');
            if (successCount > 0) {
              Message.success(t('conversation.history.batchDeleteSuccess', { count: successCount }));
            } else {
              Message.error(t('conversation.history.deleteFailed'));
            }
          } catch (error) {
            console.error('Failed to clear archived conversations:', error);
            Message.error(t('conversation.history.deleteFailed'));
          }
        },
        style: { borderRadius: '12px' },
        alignCenter: true,
        getPopupContainer: () => document.body,
      });
    },
    [removeConversation, t]
  );

  return { handleArchive, handleRestore, handleClearArchived };
};
