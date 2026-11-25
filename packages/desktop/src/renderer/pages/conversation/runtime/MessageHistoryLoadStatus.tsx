/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spin } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Short loads finish before the reader would notice a flash. */
const LOADING_SHOW_DELAY_MS = 200;

type MessageHistoryLoadStatusProps = {
  loading: boolean;
  failed?: boolean;
  onRetry: () => void;
};

/**
 * Fork: floating status for older-message loads. It overlays the list rather
 * than taking a row, so it never changes the height used to keep the reader's
 * scroll position while a page is prepended.
 */
const MessageHistoryLoadStatus: React.FC<MessageHistoryLoadStatusProps> = ({ loading, failed, onRetry }) => {
  const { t } = useTranslation();
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), LOADING_SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const showFailure = !loading && failed === true;
  if (!showLoading && !showFailure) return null;

  return (
    <div
      role='status'
      aria-live='polite'
      data-testid='message-history-load-status'
      className={classNames(
        'absolute top-8px left-50% transform -translate-x-50% z-100 flex items-center gap-6px px-12px py-4px',
        'rd-full bg-base shadow-md border-1 border-solid border-3 text-12px text-t-secondary whitespace-nowrap',
        { 'pointer-events-none': !showFailure }
      )}
    >
      {showFailure ? (
        <>
          <span>{t('messages.olderMessagesLoadFailed')}</span>
          <Button type='text' size='mini' onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </>
      ) : (
        <>
          <Spin size={12} />
          <span>{t('messages.olderMessagesLoading')}</span>
        </>
      )}
    </div>
  );
};

export default MessageHistoryLoadStatus;
