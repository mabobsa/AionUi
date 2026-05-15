/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dev-only floating console for switching remote access state.
 * Only rendered when process.env.NODE_ENV === 'development'.
 */

import React, { useState } from 'react';
import { useRemoteAccess, type RemoteState } from '@renderer/hooks/remote/useRemoteAccess';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { remoteMockStore } from '@renderer/services/remoteMock';

const STATES: RemoteState[] = ['INACTIVE', 'ACTIVE', 'OFFLINE'];


const STATE_COLORS: Record<RemoteState, string> = {
  GUEST: '#888',
  INACTIVE: '#5b8af0',
  ACTIVE: '#52c41a',
  OFFLINE: '#fa8c16',
};

const DevRemoteConsole: React.FC = () => {
  const { state, devSetState } = useRemoteAccess();
  const { status, login, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isLoggedIn = status === 'authenticated';

  if (process.env.NODE_ENV !== 'development' || !devSetState) return null;

  const handleStateClick = async (s: RemoteState) => {
    if (isLoggedIn) {
      devSetState(s);
    } else {
      // Pre-set state in mock store so useRemoteAccess picks it up after login
      remoteMockStore.setState(s);
      await login({ username: 'demo', password: 'demo', remember: false });
      // Auth status → 'authenticated' triggers ProtectedLayout redirect to main UI
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 99999,
        background: 'rgba(20,20,25,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: collapsed ? '6px 10px' : '10px 12px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#ccc',
        minWidth: collapsed ? 0 : 160,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: collapsed ? 0 : 8, cursor: 'pointer' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLORS[state], display: 'inline-block', flexShrink: 0 }} />
        <span style={{ color: '#fff', fontWeight: 600 }}>Remote</span>
        <span style={{ color: STATE_COLORS[state], marginLeft: 2 }}>{state}</span>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 10 }}>{collapsed ? '▲' : '▼'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STATES.map((s) => (
            <button
              key={s}
              type='button'
              onClick={() => void handleStateClick(s)}
              style={{
                background: state === s ? `${STATE_COLORS[s]}22` : 'transparent',
                border: `1px solid ${state === s ? STATE_COLORS[s] : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 5,
                color: state === s ? STATE_COLORS[s] : '#999',
                fontFamily: 'monospace',
                fontSize: 11,
                padding: '3px 8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: state === s ? 700 : 400,
                transition: 'all 0.1s',
              }}
            >
              {s}
            </button>
          ))}
          {/* 退出登录场景 — 跳转到登录页 */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
          <button
            type='button'
            onClick={() => { devSetState('GUEST'); void logout(); }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 5,
              color: '#e05c5c',
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '3px 8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.1s',
            }}
          >
            LOGOUT →
          </button>
        </div>
      )}
    </div>
  );
};

export default DevRemoteConsole;
