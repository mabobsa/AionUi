/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { remoteMockStore } from '../../services/remoteMock';
import { useAuth } from '../context/AuthContext';
import { useWebuiStatus } from '../system/useWebuiStatus';

export type RemoteState = 'GUEST' | 'INACTIVE' | 'ACTIVE' | 'OFFLINE';

export type RemoteAccess = {
  state: RemoteState;
  /** Authenticated username, null when GUEST */
  username: string | null;
  /** WebUI local URL, only set when ACTIVE */
  localUrl: string | null;
  networkUrl: string | null;
  /** Switch state — only present in dev mode */
  devSetState?: (s: RemoteState) => void;
};

const IS_DEV = process.env.NODE_ENV === 'development';

export function useRemoteAccess(): RemoteAccess {
  // ── mock state (dev only) ──
  const [mockSnap, setMockSnap] = useState(() => (IS_DEV ? remoteMockStore.snapshot : null));

  useEffect(() => {
    if (!IS_DEV) return;
    setMockSnap(remoteMockStore.snapshot);
    return remoteMockStore.subscribe(setMockSnap);
  }, []);

  const devSetState = useCallback(
    (s: RemoteState) => {
      if (IS_DEV) remoteMockStore.setState(s);
    },
    []
  );

  // ── real state ──
  const { user, status: authStatus } = useAuth();
  const { running, localUrl, networkUrl } = useWebuiStatus();

  if (IS_DEV && mockSnap) {
    return {
      state: mockSnap.state,
      username: mockSnap.user?.username ?? null,
      localUrl: mockSnap.localUrl,
      networkUrl: mockSnap.networkUrl,
      devSetState,
    };
  }

  let state: RemoteState;
  if (authStatus !== 'authenticated' || !user) {
    state = 'GUEST';
  } else if (running) {
    state = 'ACTIVE';
  } else {
    state = 'INACTIVE';
  }

  return {
    state,
    username: user?.username ?? null,
    localUrl: running ? localUrl : null,
    networkUrl: running ? networkUrl : null,
    devSetState: IS_DEV ? devSetState : undefined,
  };
}
