/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Earth, Logout, Moon, SettingTwo, SunOne } from '@icon-park/react';
import { useNavigate } from 'react-router-dom';
import { useRemoteAccess, type RemoteState } from '@renderer/hooks/remote/useRemoteAccess';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import { useAuth } from '@renderer/hooks/context/AuthContext';

type Props = {
  onClose: () => void;
};

const REMOTE_DOT: Record<RemoteState, { color: string; label: string | null }> = {
  GUEST: { color: 'var(--color-text-3)', label: null },
  INACTIVE: { color: 'var(--color-text-3)', label: null },
  ACTIVE: { color: 'rgb(var(--success-6))', label: null },
  OFFLINE: { color: 'rgb(var(--warning-6))', label: '远程连接异常' },
};

const REMOTE_LABEL: Record<RemoteState, string> = {
  GUEST: '未开启',
  INACTIVE: '未开启',
  ACTIVE: '运行中',
  OFFLINE: '连接异常',
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
};

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, right, onClick, danger }) => (
  <button
    type='button'
    onClick={onClick}
    className={`flex items-center gap-10px w-full px-8px h-36px rd-8px border-none bg-transparent cursor-pointer transition-colors active:bg-fill-3 ${danger ? 'text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]' : 'text-t-primary hover:bg-fill-2'}`}
  >
    <span className={`size-20px inline-flex items-center justify-center shrink-0 ${danger ? 'text-[var(--danger)]' : 'text-t-secondary'}`}>
      {icon}
    </span>
    <span className='flex-1 text-left text-13px'>{label}</span>
    {right}
  </button>
);

const Divider: React.FC = () => <div className='h-1px bg-[var(--color-fill-3)] my-4px' />;

const popoverStyle: React.CSSProperties = {
  width: 240,
  background: 'var(--dialog-fill-0)',
  border: '1px solid var(--border-base)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-popover)',
  overflow: 'hidden',
  margin: '0 12px 12px',
};

const AccountPopover: React.FC<Props> = ({ onClose }) => {
  const { state, username, devSetState } = useRemoteAccess();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeContext();

  const go = (path: string) => {
    onClose();
    sessionStorage.setItem('aion-last-settings-path', path);
    void navigate(path);
  };

  const avatarInitial = username ? username.charAt(0).toUpperCase() : 'A';
  const dot = REMOTE_DOT[state];
  const themeLabel = theme === 'dark' ? '深色' : '浅色';
  const ThemeIcon = theme === 'dark' ? SunOne : Moon;

  return (
    <div style={popoverStyle}>
      {/* 头部：头像 + 用户名 */}
      <div className='flex items-center gap-10px px-12px pt-12px pb-10px'>
        <div
          className='size-28px rd-50% flex items-center justify-center text-12px font-600 shrink-0'
          style={{ background: 'linear-gradient(135deg, #7583b2, rgb(var(--primary-6)))', color: '#fff' }}
        >
          {avatarInitial}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-13px font-500 text-t-primary truncate'>{username ?? 'Aion User'}</div>
          {dot.label && (
            <div className='flex items-center gap-5px mt-2px'>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, flexShrink: 0, display: 'inline-block' }} />
              <span className='text-12px text-t-tertiary'>{dot.label}</span>
            </div>
          )}
        </div>
      </div>

      <Divider />

      {/* 远程连接 */}
      <div className='px-4px py-4px'>
        <MenuItem
          icon={<Earth theme='outline' size={18} fill='currentColor' />}
          label='远程连接'
          right={
            <div className='flex items-center gap-6px shrink-0'>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, display: 'inline-block', flexShrink: 0 }} />
              <span className='text-12px text-t-secondary'>{REMOTE_LABEL[state]}</span>
              <span className='text-13px text-t-secondary'>›</span>
            </div>
          }
          onClick={() => go('/settings/webui')}
        />
      </div>

      <Divider />

      {/* 设置 + 主题 */}
      <div className='px-4px py-4px'>
        <MenuItem
          icon={<SettingTwo theme='outline' size={18} fill='currentColor' />}
          label='设置'
          right={<span className='text-13px text-t-tertiary'>›</span>}
          onClick={() => go('/settings/general')}
        />
        <MenuItem
          icon={<ThemeIcon theme='outline' size={18} fill='currentColor' />}
          label='主题'
          right={<span className='text-12px text-t-secondary'>{themeLabel}</span>}
          onClick={() => { void setTheme(theme === 'dark' ? 'light' : 'dark'); }}
        />
      </div>

      <Divider />

      {/* 退出登录 */}
      <div className='px-4px py-4px'>
        <MenuItem
          icon={<Logout theme='outline' size={18} fill='currentColor' />}
          label='退出登录'
          danger
          onClick={() => {
            if (confirm('退出后远程访问将停止，确定？')) {
              onClose();
              if (devSetState) devSetState('GUEST');
              void logout();
            }
          }}
        />
      </div>
    </div>
  );
};

export default AccountPopover;
