import { ipcBridge } from '@/common';
import { resolveLocaleKey } from '@/common/utils';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import {
  applyAssistantSortOrders,
  buildAssistantSortUpdates,
  reorderAssistantList,
  sortAssistants as sortAssistantsUtil,
} from '@/renderer/pages/settings/AssistantSettings/assistantUtils';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Pure predicate: an assistant is extension-sourced.
 */
export const isExtensionAssistant = (assistant: Assistant | null | undefined): boolean =>
  assistant?.source === 'extension';

/**
 * Manages the assistant list: loading from backend, sorting, and tracking the
 * active selection. The backend merges builtin + user + extension into a single
 * ordered list, so no client-side merge logic is needed.
 */
export const useAssistantList = () => {
  const { i18n } = useTranslation();
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const localeKey = resolveLocaleKey(i18n.language);

  const loadAssistants = useCallback(async () => {
    try {
      const list = await ipcBridge.assistants.list.invoke();
      const sorted = sortAssistantsUtil(list);
      setAssistants(sorted);
      setActiveAssistantId((prev) => {
        if (prev && sorted.some((a) => a.id === prev)) return prev;
        return sorted[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Failed to load assistants:', error);
    }
  }, []);

  const reorderAssistants = useCallback(
    async (activeId: string, overId: string) => {
      const reorderedAssistants = reorderAssistantList(assistants, activeId, overId);
      if (reorderedAssistants === assistants) {
        return;
      }

      const normalizedAssistants = applyAssistantSortOrders(reorderedAssistants);
      const sortUpdates = buildAssistantSortUpdates(assistants, normalizedAssistants);
      if (sortUpdates.length === 0) {
        setAssistants(normalizedAssistants);
        return;
      }

      const previousAssistants = assistants;
      setAssistants(normalizedAssistants);

      try {
        await Promise.all(sortUpdates.map((update) => ipcBridge.assistants.setState.invoke(update)));
      } catch (error) {
        console.error('Failed to reorder assistants:', error);
        setAssistants(previousAssistants);
      }
    },
    [assistants]
  );

  useEffect(() => {
    void loadAssistants();
  }, [loadAssistants]);

  const activeAssistant = assistants.find((a) => a.id === activeAssistantId) ?? null;

  return {
    assistants,
    setAssistants,
    activeAssistantId,
    setActiveAssistantId,
    activeAssistant,
    isExtensionAssistant,
    loadAssistants,
    reorderAssistants,
    localeKey,
  };
};
