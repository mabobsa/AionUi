/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Trigger } from '@arco-design/web-react';
import { ArrowCircleLeft, Moon, SunOne } from '@icon-park/react';
import classNames from 'classnames';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { useRemoteAccess, type RemoteState } from '@renderer/hooks/remote/useRemoteAccess';
import AccountPopover from './AccountPopover';

interface SiderFooterProps {
  isMobile: boolean;
  isSettings: boolean;
  collapsed?: boolean;
  theme: string;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
  onThemeToggle: () => void;
  /** @deprecated handled via AccountPopover now */
  showLogout?: boolean;
  /** @deprecated handled via AccountPopover now */
  onLogoutClick?: () => void;
}

type DotState = { bg: string; label: string };

const DOT_STATES: Record<RemoteState, DotState> = {
  GUEST: { bg: 'var(--color-text-4)', label: '点此登录' },
  ACTIVE: { bg: 'rgb(var(--success-6))', label: '远程已连接' },
  INACTIVE: { bg: 'var(--color-text-4)', label: '远程未开启' },
  OFFLINE: { bg: 'rgb(var(--warning-6))', label: '中继断开' },
};

const SiderFooter: React.FC<SiderFooterProps> = ({
  isMobile,
  isSettings,
  collapsed = false,
  theme,
  siderTooltipProps,
  onSettingsClick,
  onThemeToggle,
}) => {
  const { t } = useTranslation();
  const { state, username } = useRemoteAccess();
  const [popoverVisible, setPopoverVisible] = useState(false);

  const dot = DOT_STATES[state];
  const showThemeToggle = isSettings && !collapsed;
  const themeTooltip = theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode');

  const handleAccountClick = useCallback(() => {
    setPopoverVisible((v) => !v);
  }, []);

  const avatarInitial = username ? username.charAt(0).toUpperCase() : 'A';
  const displayName = username ?? 'Aion User';

  return (
    <div className='shrink-0 sider-footer mt-auto pt-8px pb-8px border-t border-solid border-[var(--color-border-2)] border-l-0 border-r-0 border-b-0'>

      {/* 对话页：整行账号区，点击弹菜单 */}
      {!isSettings && (
        <Trigger
          popup={() => <AccountPopover onClose={() => setPopoverVisible(false)} />}
          trigger='click'
          position='top'
          popupVisible={popoverVisible}
          onVisibleChange={setPopoverVisible}
        >
          <div
            className={classNames(
              'flex items-center gap-8px rd-8px cursor-pointer transition-colors hover:bg-fill-2 active:bg-fill-3',
              collapsed ? 'justify-center px-0 py-8px' : 'px-8px py-6px'
            )}
            onClick={handleAccountClick}
          >
            {/* 头像 */}
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1,
                background: 'linear-gradient(135deg, #7583b2, rgb(var(--primary-6)))',
                color: '#fff',
                position: 'relative',
              }}
            >
              {avatarInitial}
              <span
                style={{
                  position: 'absolute',
                  right: -1,
                  bottom: -1,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  border: '1.5px solid var(--color-bg-1)',
                  background: dot.bg,
                }}
              />
            </span>

            {/* 文字区 */}
            {!collapsed && (
              <div className='min-w-0 flex-1 flex items-center gap-4px overflow-hidden'>
                <span className='text-13px font-[500] text-t-primary truncate leading-snug'>{displayName}</span>
                <span className='text-12px text-t-tertiary shrink-0'>·</span>
                <span className='text-12px text-t-tertiary shrink-0'>Aion</span>
                <svg className='shrink-0 text-t-tertiary' width='12' height='12' viewBox='0 0 48 48' fill='none'>
                  <path d='M12 20l12 12 12-12' stroke='currentColor' strokeWidth='4' strokeLinecap='round' strokeLinejoin='round' />
                </svg>
              </div>
            )}
          </div>
        </Trigger>
      )}

      {/* 设置页：返回按钮 + 主题切换 */}
      {isSettings && (
        <div className={classNames('flex', collapsed ? 'flex-col gap-2px' : 'items-center gap-2px')}>
          <Tooltip {...siderTooltipProps} content={t('common.back')} position='right'>
            <div
              onClick={onSettingsClick}
              className={classNames(
                'group h-34px flex items-center rd-0.5rem cursor-pointer transition-colors bg-fill-3',
                collapsed ? 'w-full justify-center' : 'flex-1 min-w-0 justify-start gap-8px pl-10px pr-8px',
                isMobile && 'sider-footer-btn-mobile'
              )}
            >
              <span className='size-22px flex items-center justify-center shrink-0 text-t-secondary'>
                <ArrowCircleLeft theme='outline' size='16' fill='currentColor' className='block leading-none' style={{ lineHeight: 0 }} />
              </span>
              <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px truncate'>{t('common.back')}</span>
            </div>
          </Tooltip>
          {showThemeToggle && (
            <Tooltip {...siderTooltipProps} content={themeTooltip} position='right'>
              <div
                onClick={onThemeToggle}
                className={classNames(
                  'h-32px w-40px shrink-0 flex items-center justify-center cursor-pointer rd-0.5rem transition-colors text-t-secondary hover:bg-fill-2 hover:text-t-primary active:bg-fill-3',
                  isMobile && 'sider-footer-btn-mobile'
                )}
                aria-label={themeTooltip}
              >
                <span className='w-28px h-28px flex items-center justify-center shrink-0'>
                  {theme === 'dark' ? (
                    <SunOne theme='outline' size='18' fill='currentColor' className='block leading-none' />
                  ) : (
                    <Moon theme='outline' size='18' fill='currentColor' className='block leading-none' />
                  )}
                </span>
              </div>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
};

export default SiderFooter;
