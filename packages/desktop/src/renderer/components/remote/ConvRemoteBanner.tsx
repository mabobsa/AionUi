/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@arco-design/web-react';
import { useRemoteAccess } from '@renderer/hooks/remote/useRemoteAccess';
import { HomeEarthPopover } from '@renderer/components/remote/HomeRemoteChip';
import { Trigger } from '@arco-design/web-react';

const SNOOZE_KEY = 'aion-conv-remote-banner-snooze';
const TASK_THRESHOLD_MS = process.env.NODE_ENV === 'development' ? 3_000 : 30_000;

function isSnoozeActive(): boolean {
  try {
    const t = parseInt(localStorage.getItem(SNOOZE_KEY) ?? '0', 10);
    return t > Date.now();
  } catch {
    return false;
  }
}

function setSnooze(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

type Props = { conversationId?: string };

const ConvRemoteBanner: React.FC<Props> = ({ conversationId }) => {
  const { state } = useRemoteAccess();
  const [taskMature, setTaskMature] = useState(false);
  const [dismissed, setDismissed] = useState(() => isSnoozeActive());
  const [popoverVisible, setPopoverVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 每次切换会话重置计时，30s 后才允许显示
  useEffect(() => {
    setTaskMature(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!conversationId) return;
    timerRef.current = setTimeout(() => setTaskMature(true), TASK_THRESHOLD_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [conversationId]);

  if (!taskMature) return null;
  if (dismissed) return null;
  if (state !== 'GUEST' && state !== 'INACTIVE') return null;

  const isGuest = state === 'GUEST';

  const handleClose = () => {
    setSnooze();
    setDismissed(true);
  };

  return (
    <div className='px-16px pb-8px'>
      <div className='flex items-center gap-10px px-14px py-9px rd-10px bg-fill-1 border border-[var(--color-border-1)]'>
        <span className='text-15px shrink-0'>📱</span>
        <div className='flex-1 min-w-0'>
          <span className='text-13px font-500 text-t-primary'>任务还在跑？</span>
          <span className='text-13px text-t-tertiary ml-6px'>
            {isGuest ? '登录后可在手机继续看进度' : '开启远程可在手机继续看'}
          </span>
        </div>
        <Trigger
          popup={() => <HomeEarthPopover onClose={() => setPopoverVisible(false)} />}
          trigger='click'
          position='top'
          popupVisible={popoverVisible}
          onVisibleChange={setPopoverVisible}
        >
          <Button size='mini' type='primary' shape='round'>
            {isGuest ? '登录' : '开启'}
          </Button>
        </Trigger>
        <button
          type='button'
          className='shrink-0 flex items-center justify-center w-18px h-18px rd-50% border-none bg-transparent cursor-pointer text-t-tertiary hover:text-t-primary hover:bg-fill-2 transition-colors p-0'
          onClick={handleClose}
        >
          <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
            <path d='M1 1l8 8M9 1L1 9' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ConvRemoteBanner;
