/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** 4-state remote access machine (matches v2.2 prototype) */
export type RemoteState = 'GUEST' | 'INACTIVE' | 'ACTIVE' | 'OFFLINE';

export type MockUser = {
  id: string;
  username: string;
  email: string;
};

export type RemoteStore = {
  state: RemoteState;
  user: MockUser | null;
  localUrl: string | null;
  networkUrl: string | null;
};
