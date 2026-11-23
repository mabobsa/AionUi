import { ipcBridge } from '@/common';
import { addEventListener, emitter } from '@/renderer/utils/emitter';
import { useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';

/** Reads archive state without depending on the active sidebar's paged contents. */
export const useConversationArchiveState = (
  conversationId?: string
): { archived: boolean; restore: () => Promise<void> } => {
  const { mutate: mutateCache } = useSWRConfig();
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

  const restore = async (): Promise<void> => {
    if (!conversationId) return;
    await ipcBridge.sidebar.unarchive.invoke({ item_type: 'conversation', item_id: conversationId });
    // Update the requested conversation even if navigation changed while restoring.
    // A successful restore must also clear the badge when the follow-up read fails.
    await mutateCache(
      ['conversation-archive-state', conversationId],
      { conversation_id: conversationId, exists: true, archived_at: null },
      { revalidate: false }
    );
    emitter.emit('chat.history.refresh');
  };

  return {
    archived: Boolean(data?.exists && data.conversation_id === conversationId && data.archived_at != null),
    restore,
  };
};
