import classNames from 'classnames';
import { Dropdown, Menu, Message } from '@arco-design/web-react';
import { Undo } from '@icon-park/react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConversationArchiveState } from './useConversationArchiveState';

/** Shared title status for desktop conversations and the mobile caption. */
const ArchivedConversationBadge: React.FC<{ conversationId?: string; className?: string }> = ({
  conversationId,
  className,
}) => {
  const { t } = useTranslation();
  const { archived, restore } = useConversationArchiveState(conversationId);
  const [restoring, setRestoring] = useState(false);
  const restoringRef = useRef(false);

  const handleRestore = async (): Promise<void> => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    setRestoring(true);
    try {
      await restore();
      Message.success(t('settings.archived.restoreSuccess'));
    } catch (error) {
      console.error('Failed to restore archived conversation:', error);
      Message.error(t('settings.archived.restoreFailed'));
    } finally {
      restoringRef.current = false;
      setRestoring(false);
    }
  };
  if (!archived) return null;

  return (
    <Dropdown
      key={conversationId}
      trigger='contextMenu'
      position='bl'
      droplist={
        <Menu onClickMenuItem={() => void handleRestore()}>
          <Menu.Item key='restore' disabled={restoring}>
            <span className='flex items-center gap-8px'>
              <Undo size={14} />
              {t('settings.archived.restore')}
            </span>
          </Menu.Item>
        </Menu>
      }
    >
      <span
        role='status'
        aria-busy={restoring}
        data-testid='conversation-archive-badge'
        className={classNames(
          'inline-flex shrink-0 cursor-context-menu items-center whitespace-nowrap rounded-4px bg-fill-2 px-6px py-2px text-11px font-medium leading-16px text-t-secondary',
          className
        )}
      >
        {t('conversation.history.archiveSuccess')}
      </span>
    </Dropdown>
  );
};

export default ArchivedConversationBadge;
