import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConversationArchiveState } from './useConversationArchiveState';

/** Shared title status for desktop conversations and the mobile caption. */
const ArchivedConversationBadge: React.FC<{ conversationId?: string; className?: string }> = ({
  conversationId,
  className,
}) => {
  const { t } = useTranslation();
  const archived = useConversationArchiveState(conversationId);
  if (!archived) return null;

  return (
    <span
      role='status'
      data-testid='conversation-archive-badge'
      className={classNames(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-4px bg-fill-2 px-6px py-2px text-11px font-medium leading-16px text-t-secondary',
        className
      )}
    >
      {t('conversation.history.archiveSuccess')}
    </span>
  );
};

export default ArchivedConversationBadge;
