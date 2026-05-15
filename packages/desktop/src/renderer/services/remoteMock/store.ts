/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MockUser, RemoteState, RemoteStore } from './types';

const MOCK_USER: MockUser = {
  id: 'mock-1',
  username: 'Demo',
  email: 'demo@aionui.com',
};

const STORAGE_KEY = '__aion_dev_remote_state__';

function loadState(): RemoteState {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'GUEST' || v === 'INACTIVE' || v === 'ACTIVE' || v === 'OFFLINE') return v;
  } catch {
    // ignore
  }
  return 'INACTIVE';
}

function saveState(s: RemoteState): void {
  try {
    localStorage.setItem(STORAGE_KEY, s);
  } catch {
    // ignore
  }
}

type Listener = (store: RemoteStore) => void;

class RemoteMockStore {
  private _state: RemoteState;
  private _listeners: Set<Listener> = new Set();

  constructor() {
    this._state = loadState();
  }

  get snapshot(): RemoteStore {
    const isAuth = this._state !== 'GUEST';
    return {
      state: this._state,
      user: isAuth ? MOCK_USER : null,
      localUrl: this._state === 'ACTIVE' ? 'http://localhost:25808' : null,
      networkUrl: this._state === 'ACTIVE' ? 'http://192.168.1.100:25808' : null,
    };
  }

  setState(next: RemoteState): void {
    if (next === this._state) return;
    this._state = next;
    saveState(next);
    const snap = this.snapshot;
    this._listeners.forEach((fn) => fn(snap));
  }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

export const remoteMockStore = new RemoteMockStore();
