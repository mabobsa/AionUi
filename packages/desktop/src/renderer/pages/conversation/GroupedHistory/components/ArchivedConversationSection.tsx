/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { getActivityTime } from '@/renderer/utils/chat/timeline';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import ConversationRow from '../ConversationRow';
import type { ConversationRowProps } from '../types';
import { isConversationArchived } from '../utils/groupingHelpers';

type SectionLabelProps = {
  sectionKey: string;
  label: string;
  trailing?: React.ReactNode;
};

type ArchivedConversationSectionProps = {
  conversations: TChatConversation[];
  collapsed: boolean;
  expanded: boolean;
  sectionLabel: React.ComponentType<SectionLabelProps>;
  onClear: (conversations: TChatConversation[]) => void;
  getConversationRowProps: (conversation: TChatConversation) => ConversationRowProps;
  onRestore: (conversation: TChatConversation) => void;
  onPermanentDelete: (conversationId: string) => void;
};

const ArchivedConversationSection: React.FC<ArchivedConversationSectionProps> = ({
  conversations,
  collapsed,
  expanded,
  sectionLabel: SectionLabel,
  onClear,
  getConversationRowProps,
  onRestore,
  onPermanentDelete,
}) => {
  const { t } = useTranslation();
  const archivedConversations = useMemo(
    () =>
      conversations
        .filter((conversation) => isConversationArchived(conversation))
        .toSorted((a, b) => getActivityTime(b) - getActivityTime(a)),
    [conversations]
  );
  if (archivedConversations.length === 0) return null;

  return (
    <div className='min-w-0'>
      {!collapsed && (
        <SectionLabel
          sectionKey='archived'
          label={t('conversation.history.archived')}
          trailing={
            <span
              role='button'
              tabIndex={0}
              className='text-12px text-t-secondary hover:text-warning cursor-pointer px-6px transition-colors'
              onClick={(event) => {
                event.stopPropagation();
                onClear(archivedConversations);
              }}
            >
              {t('conversation.history.clearArchived')}
            </span>
          }
        />
      )}
      {expanded && (
        <div className='flex flex-col min-w-0'>
          {archivedConversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              {...getConversationRowProps(conversation)}
              dimIcon
              archived
              onArchive={undefined}
              onRestore={onRestore}
              onPermanentDelete={onPermanentDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchivedConversationSection;
