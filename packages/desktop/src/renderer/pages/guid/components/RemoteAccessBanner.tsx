/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Alert, Button } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';
import { useRemoteAccess } from '@renderer/hooks/remote/useRemoteAccess';

const SNOOZE_KEY = 'aion-home-remote-banner-snooze';

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

const RemoteAccessBanner: React.FC = () => {
  const { state } = useRemoteAccess();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => isSnoozeActive());

  // Banner removed per UX decision — chip-only approach
  void state;
  void dismissed;
  return null;

  const isGuest = state === 'GUEST';
  const title = isGuest ? '手机也能继续用 Aion' : '手机也能继续用 Aion';
  const desc = isGuest ? '登录后可在手机继续看进度，无需配置' : '不用配 SSH / 内网穿透，一键开启';
  const ctaText = isGuest ? '登录' : '立即开启';

  const handleCta = () => {
    if (isGuest) {
      void navigate('/settings/model');
    } else {
      void navigate('/settings/webui');
    }
  };

  const handleClose = () => {
    setSnooze();
    setDismissed(true);
  };

  return (
    <div className='mx-auto mb-12px w-full max-w-720px px-16px'>
      <Alert
        type='info'
        closable
        onClose={handleClose}
        title={
          <span>
            <span className='font-500'>{title}</span>
            <span className='text-t-tertiary ml-6px text-12px'>{desc}</span>
          </span>
        }
        icon={<span style={{ fontSize: 18 }}>📱</span>}
        action={
          <Button size='mini' type='primary' onClick={handleCta}>
            {ctaText}
          </Button>
        }
      />
    </div>
  );
};

export default RemoteAccessBanner;
