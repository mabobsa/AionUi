/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Trigger } from '@arco-design/web-react';
import { Earth } from '@icon-park/react';
import { useNavigate } from 'react-router-dom';
import { useRemoteAccess, type RemoteState } from '@renderer/hooks/remote/useRemoteAccess';
import LoginModal from './LoginModal';

type ChipStyle = { bg: string; border: string; iconColor: string; pulse?: boolean };

const ActiveQRPanel: React.FC<{ qrUrl: string; onClose: () => void; onSettings: () => void; onScanned?: () => void }> = ({ qrUrl, onSettings, onScanned }) => {
  const [copied, setCopied] = useState(false);
  const copyUrl = () => {
    void navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingRight: 24 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(var(--success-6))', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.3 }}>扫码即可访问 AionUi</span>
      </div>
      {/* 说明 */}
      <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginBottom: 14, lineHeight: 1.6 }}>
        AionUi 内置远程服务，无需部署、无需公网 IP
      </div>

      {/* 二维码 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <div style={{ padding: 10, background: '#fff', borderRadius: 10, border: '1px solid var(--color-fill-2)', display: 'inline-block' }}>
          <QRCodeSVG value={qrUrl} size={128} level='M' />
        </div>
      </div>

      {/* URL 复制 */}
      <div
        onClick={copyUrl}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderRadius: 8, marginBottom: 12,
          background: 'var(--color-fill-1)', border: '1px solid var(--color-fill-2)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {qrUrl}
        </span>
        <span style={{ fontSize: 11, color: copied ? 'rgb(var(--success-6))' : 'var(--color-text-3)', marginLeft: 8, flexShrink: 0 }}>
          {copied ? '已复制' : '复制'}
        </span>
      </div>

      {/* 模拟扫码完成 */}
      {onScanned && (
        <button type='button' style={{ ...ctaStyle('primary'), marginBottom: 8 }} onClick={onScanned}>
          模拟扫码完成（已连接）
        </button>
      )}
      {/* 更多连接方式 — 弱化为文字链接 */}
      <button
        type='button'
        onClick={onSettings}
        style={{
          width: '100%', background: 'none', border: 'none', padding: '4px 0',
          fontSize: 12, color: 'var(--color-text-3)', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'center', textDecoration: 'underline',
          textDecorationColor: 'var(--color-fill-3)',
        }}
      >
        更多连接方式
      </button>
    </>
  );
};

const CHIP_STYLES: Record<RemoteState, ChipStyle> = {
  GUEST: { bg: 'rgba(var(--primary-6),0.12)', border: 'rgba(var(--primary-6),0.3)', iconColor: 'rgb(var(--primary-6))' },
  ACTIVE: { bg: 'rgba(var(--success-6),0.10)', border: 'rgba(var(--success-6),0.25)', iconColor: 'rgb(var(--success-6))' },
  INACTIVE: { bg: 'rgba(var(--primary-6),0.10)', border: 'rgba(var(--primary-6),0.25)', iconColor: 'rgb(var(--primary-6))' },
  OFFLINE: { bg: 'rgba(var(--warning-6),0.10)', border: 'rgba(var(--warning-6),0.25)', iconColor: 'rgb(var(--warning-6))', pulse: true },
};

export const HomeEarthPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, username, networkUrl, localUrl, devSetState } = useRemoteAccess();
  const navigate = useNavigate();
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  // 内部视图：当用户点"前往开启"后直接在弹窗内切到二维码，不等外部 state 变化
  const [showQR, setShowQR] = useState(false);

  const close = () => onClose();

  const effectiveState = showQR ? 'ACTIVE' : state;
  const isGuiding = effectiveState === 'GUEST' || effectiveState === 'INACTIVE';

  return (
    <div style={{
      width: effectiveState === 'ACTIVE' ? 300 : 280, background: 'var(--color-bg-1)',
      border: '1px solid var(--color-fill-2)', borderRadius: 16,
      boxShadow: '0 16px 48px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
      padding: isGuiding ? '20px 20px 18px' : '16px 18px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* 引导态背景装饰 */}
      {isGuiding && (
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 140, height: 140,
          borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(var(--primary-6),0.10) 0%, rgba(var(--primary-6),0) 70%)',
        }} />
      )}

      {/* 右上角 ✕ */}
      <button
        type='button'
        aria-label='关闭'
        onClick={close}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1,
          width: 22, height: 22, borderRadius: '50%',
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-3)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-fill-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'; }}
      >
        <svg width='11' height='11' viewBox='0 0 11 11' fill='none'>
          <path d='M1.5 1.5l8 8M9.5 1.5l-8 8' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
        </svg>
      </button>

      {effectiveState === 'GUEST' && (
        <div style={{ position: 'relative' }}>
          {/* 视觉头：图标圆 */}
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(var(--primary-6),0.16), rgba(var(--primary-6),0.06))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgb(var(--primary-6))', marginBottom: 12,
          }}>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
              <rect x='6' y='3' width='12' height='18' rx='2' stroke='currentColor' strokeWidth='1.6' />
              <path d='M10 18h4' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
              <circle cx='12' cy='7' r='3.2' stroke='currentColor' strokeWidth='1.6' />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 6, paddingRight: 24, lineHeight: 1.4 }}>
            手机也能用 AionUi
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.6 }}>
            登录账号后可在任意设备访问，无需配置 SSH 或内网穿透
          </div>
          <button type='button' style={ctaStyle('primary')} onClick={() => setLoginModalVisible(true)}>
            前往登录
          </button>
          <LoginModal
            visible={loginModalVisible}
            intent='remote'
            onClose={() => setLoginModalVisible(false)}
            onActivated={close}
          />
        </div>
      )}
      {effectiveState === 'INACTIVE' && (
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(var(--primary-6),0.16), rgba(var(--primary-6),0.06))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgb(var(--primary-6))', marginBottom: 12,
          }}>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
              <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.6' />
              <path d='M3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 6, paddingRight: 24, lineHeight: 1.4 }}>
            手机也能用 AionUi
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.6 }}>
            开启后即可在手机或外网通过专属地址访问 AionUi
          </div>
          <button type='button' style={ctaStyle('primary')} onClick={() => { if (devSetState) devSetState('ACTIVE'); setShowQR(true); }}>
            前往开启
          </button>
        </div>
      )}
      {effectiveState === 'ACTIVE' && !showQR && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingRight: 24 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(var(--success-6))', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)' }}>远程已连接</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.6 }}>
            手机或外网均可访问
          </div>
          <button
            type='button'
            onClick={() => { close(); void navigate('/settings/webui'); }}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 12.5, color: 'rgb(var(--primary-6))', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            查看二维码 / 管理连接 →
          </button>
        </div>
      )}
      {effectiveState === 'ACTIVE' && showQR && (
        <ActiveQRPanel
          qrUrl={networkUrl ?? localUrl ?? 'http://localhost:25808'}
          onClose={close}
          onSettings={() => { close(); void navigate('/settings/webui'); }}
          onScanned={() => setShowQR(false)}
        />
      )}
      {effectiveState === 'OFFLINE' && (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--warning-6))', marginBottom: 6 }}>⚠ 中继连接已断开</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 14, lineHeight: 1.6 }}>
            手机端暂时无法访问。专属地址保留，可点击重连。
          </div>
          {networkUrl && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 10px', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-3)' }}>局域网地址</span>
              <span style={{ fontFamily: 'monospace', color: 'rgb(var(--primary-6))' }}>{networkUrl}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type='button' style={ctaStyle('primary')} onClick={() => { close(); if (devSetState) devSetState('ACTIVE'); }}>重连</button>
            <button type='button' style={ctaStyle('ghost')} onClick={() => { close(); void navigate('/settings/webui'); }}>前往设置</button>
          </div>
        </>
      )}
    </div>
  );
};

function ctaStyle(type: 'primary' | 'ghost'): React.CSSProperties {
  return {
    width: '100%', height: 36, padding: '0 12px', borderRadius: 999,
    fontSize: 13, fontWeight: 500, lineHeight: 1,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: type === 'primary' ? 'rgb(var(--primary-6))' : 'var(--color-fill-2)',
    color: type === 'primary' ? '#fff' : 'var(--color-text-2)',
    transition: 'all 0.15s',
  };
}

const HomeRemoteChip: React.FC = () => {
  const { state } = useRemoteAccess();
  const [visible, setVisible] = useState(false);

  if (state === 'GUEST') return null;

  const s = CHIP_STYLES[state];

  return (
    <>
      {s.pulse && (
        <style>{`
          @keyframes home-chip-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(var(--warning-6),.4)} 50%{box-shadow:0 0 0 5px rgba(var(--warning-6),0)} }
          .home-chip-offline { animation: home-chip-pulse 1.5s ease-in-out infinite; }
        `}</style>
      )}
      <Trigger
        popup={() => <HomeEarthPopover onClose={() => setVisible(false)} />}
        trigger='click'
        position='bottom'
        popupVisible={visible}
        onVisibleChange={setVisible}
      >
        <button
          type='button'
          className={s.pulse ? 'home-chip-offline' : ''}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: '50%',
            border: `1px solid ${s.border}`, background: s.bg,
            color: s.iconColor, cursor: 'pointer', flexShrink: 0,
            padding: 0, transition: 'opacity 0.15s',
          }}
        >
          <Earth theme='outline' size={16} fill='currentColor' />
        </button>
      </Trigger>
    </>
  );
};

export default HomeRemoteChip;
