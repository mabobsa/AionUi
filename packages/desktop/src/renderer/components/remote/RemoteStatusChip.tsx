/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Earth } from '@icon-park/react';
import { Trigger } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';
import { useRemoteAccess, type RemoteState } from '@renderer/hooks/remote/useRemoteAccess';
import { HomeEarthPopover } from '@renderer/components/remote/HomeRemoteChip';

type StateConfig = {
  label: string;
  dotColor: string;
  iconColor: string;
  pulse?: boolean;
};

const STATE_CONFIG: Record<RemoteState, StateConfig> = {
  GUEST: {
    label: '登录解锁手机访问',
    dotColor: 'var(--color-text-4)',
    iconColor: 'var(--color-text-3)',
  },
  INACTIVE: {
    label: '开启远程',
    dotColor: 'var(--color-text-4)',
    iconColor: 'var(--color-text-3)',
  },
  ACTIVE: {
    label: '远程已开',
    dotColor: '#00b42a',
    iconColor: 'var(--color-text-2)',
  },
  OFFLINE: {
    label: '中继断开',
    dotColor: '#ff7d00',
    iconColor: 'var(--color-text-2)',
    pulse: true,
  },
};

const RemoteStatusChip: React.FC = () => {
  const { state } = useRemoteAccess();
  const navigate = useNavigate();
  const [popoverVisible, setPopoverVisible] = useState(false);

  const cfg = STATE_CONFIG[state];
  const isGuiding = state === 'GUEST' || state === 'INACTIVE';

  const chip = (
    <>
      {cfg.pulse && (
        <style>{`@keyframes remote-dot-pulse{0%,100%{opacity:1}50%{opacity:0.4}}.remote-dot-pulse{animation:remote-dot-pulse 1.4s ease-in-out infinite}`}</style>
      )}
      <button
        type='button'
        className='inline-flex items-center gap-4px rounded-full px-8px py-2px bg-2 border-none cursor-pointer transition-colors hover:bg-fill-3'
        style={{ fontFamily: 'inherit' }}
        onClick={isGuiding ? undefined : () => navigate('/settings/webui')}
      >
        <Earth theme='outline' size={13} fill={cfg.iconColor} />
        <span className='text-12px text-t-secondary ml-1px'>{cfg.label}</span>
        <span
          className={`w-7px h-7px rounded-full ml-2px shrink-0${cfg.pulse ? ' remote-dot-pulse' : ''}`}
          style={{ background: cfg.dotColor }}
        />
      </button>
    </>
  );

  if (isGuiding) {
    return (
      <Trigger
        popup={() => <HomeEarthPopover onClose={() => setPopoverVisible(false)} />}
        trigger='click'
        position='bottom'
        popupVisible={popoverVisible}
        onVisibleChange={setPopoverVisible}
      >
        {chip}
      </Trigger>
    );
  }

  return chip;
};

export default RemoteStatusChip;
