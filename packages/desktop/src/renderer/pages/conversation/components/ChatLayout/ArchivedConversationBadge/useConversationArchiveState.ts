import { ipcBridge } from '@/common';
import { addEventListener } from '@/renderer/utils/emitter';
import { useEffect } from 'react';
import useSWR from 'swr';

/** Reads archive state without depending on the active sidebar's paged contents. */
export const useConversationArchiveState = (conversationId?: string): boolean => {
  const { data, mutate } = useSWR(
    conversationId ? ['conversation-archive-state', conversationId] : null,
    () => ipcBridge.sidebar.getConversationArchiveState.invoke({ conversation_id: conversationId! }),
    {
      keepPreviousData: false,
      shouldRetryOnError: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  useEffect(() => {
    if (!conversationId) return;
    const refresh = () => {
      // SWR retains the last confirmed state if revalidation fails.
      void mutate().catch((): undefined => undefined);
    };
    const unsubscribe = ipcBridge.conversation.listChanged.on((event) => {
      if (event.conversation_id === conversationId) refresh();
    });
    const removeRefreshListener = addEventListener('chat.history.refresh', refresh);
    return () => {
      unsubscribe();
      removeRefreshListener();
    };
  }, [conversationId, mutate]);

  return Boolean(data?.exists && data.conversation_id === conversationId && data.archived_at != null);
};
