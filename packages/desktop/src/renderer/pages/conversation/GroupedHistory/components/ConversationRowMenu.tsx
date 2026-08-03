/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dropdown, Menu } from '@arco-design/web-react';
import { Copy, CopyOne, EditOne, Export, FolderClose, Inbox, MoreOne, Star, Timer } from '@icon-park/react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConversationRowProps } from '../types';
import styles from './ConversationRowMenu.module.css';

type ConversationRowMenuProps = Pick<
  ConversationRowProps,
  | 'conversation'
  | 'menuVisible'
  | 'onOpenMenu'
  | 'onMenuVisibleChange'
  | 'onEditStart'
  | 'onCreateCronTask'
  | 'onExport'
  | 'onCopy'
  | 'onCopyAll'
  | 'onArchive'
  | 'onTogglePin'
  | 'onToggleManualUnread'
  | 'isManualUnread'
> & {
  isMobile: boolean;
  isPinned: boolean;
};

const ConversationRowMenu: React.FC<ConversationRowMenuProps> = ({
  conversation,
  isMobile,
  isPinned,
  menuVisible,
  onOpenMenu,
  onMenuVisibleChange,
  onEditStart,
  onCreateCronTask,
  onExport,
  onCopy,
  onCopyAll,
  onArchive,
  onTogglePin,
  onToggleManualUnread,
  isManualUnread,
}) => {
  const { t } = useTranslation();

  const handleMenuItemClick = (key: string): void => {
    const conversationActions: Partial<Record<string, () => void>> = {
      copy: onCopy ? () => onCopy(conversation) : undefined,
      copyAll: onCopyAll ? () => onCopyAll(conversation) : undefined,
      pin: () => onTogglePin(conversation),
      toggleManualUnread: () => onToggleManualUnread(conversation),
      rename: () => onEditStart(conversation),
      createCronTask: () => onCreateCronTask(conversation),
      export: onExport ? () => onExport(conversation) : undefined,
      archive: () => onArchive(conversation),
    };
    conversationActions[key]?.();
  };

  return (
    <Dropdown
      droplist={
        <Menu className={styles.rowMenu} onClickMenuItem={handleMenuItemClick}>
          {onCopy && (
            <Menu.Item key='copy'>
              <div className='flex items-center gap-8px'>
                <Copy theme='outline' size='14' />
                <span>{t('messages.copy')}</span>
              </div>
            </Menu.Item>
          )}
          {onCopyAll && (
            <Menu.Item key='copyAll'>
              <div className='flex items-center gap-8px'>
                <CopyOne theme='outline' size='14' />
                <span>{t('conversation.history.copyAll')}</span>
              </div>
            </Menu.Item>
          )}
          <Menu.Item key='pin'>
            <div className='flex items-center gap-8px'>
              <Star theme={isPinned ? 'filled' : 'outline'} size='14' fill='currentColor' />
              <span>{isPinned ? t('conversation.history.removeBookmark') : t('conversation.history.addBookmark')}</span>
            </div>
          </Menu.Item>
          <Menu.Item key='toggleManualUnread'>
            <div className='flex items-center gap-8px'>
              <Inbox theme='outline' size='14' />
              <span>
                {isManualUnread ? t('conversation.history.markAsRead') : t('conversation.history.markAsUnread')}
              </span>
            </div>
          </Menu.Item>
          <Menu.Item key='rename'>
            <div className='flex items-center gap-8px'>
              <EditOne theme='outline' size='14' />
              <span>{t('conversation.history.rename')}</span>
            </div>
          </Menu.Item>
          <Menu.Item key='createCronTask'>
            <div className='flex items-center gap-8px'>
              <Timer theme='outline' size='14' />
              <span>{t('conversation.history.createCronTask')}</span>
            </div>
          </Menu.Item>
          {onExport && (
            <Menu.Item key='export'>
              <div className='flex items-center gap-8px'>
                <Export theme='outline' size='14' />
                <span>{t('conversation.history.export')}</span>
              </div>
            </Menu.Item>
          )}
          <Menu.Item key='archive'>
            <div className='flex items-center gap-8px'>
              <FolderClose theme='outline' size='14' />
              <span>{t('conversation.history.archive')}</span>
            </div>
          </Menu.Item>
        </Menu>
      }
      trigger='click'
      position='br'
      popupVisible={menuVisible}
      onVisibleChange={(visible) => onMenuVisibleChange(conversation.id, visible)}
      getPopupContainer={() => document.body}
      unmountOnExit={false}
    >
      <span
        data-testid={`conversation-row-menu-${conversation.id}`}
        className={classNames(
          'flex-center cursor-pointer transition-colors text-t-secondary hover:text-t-primary size-20px rd-4px sider-action-btn',
          {
            flex: isMobile || menuVisible,
            'hidden group-hover:flex': !isMobile && !menuVisible,
          }
        )}
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(conversation);
        }}
      >
        <MoreOne theme='outline' size='14' fill='currentColor' className='block leading-none' />
      </span>
    </Dropdown>
  );
};

export default ConversationRowMenu;
