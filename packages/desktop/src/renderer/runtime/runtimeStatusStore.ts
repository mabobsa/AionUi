import { ipcBridge } from '@/common';
import { systemSettings } from '@/common/adapter/ipcBridge';
import { useSyncExternalStore } from 'react';

import type { IRuntimeStatusEvent, IRuntimeStatusScope, RuntimeStatusPhase } from '@/common/adapter/ipcBridge';

export interface RuntimeSnapshot extends IRuntimeStatusEvent {
  observedAt: number;
}

const READY_DISMISS_DELAY_MS = 1200;

const listeners = new Set<() => void>();
const snapshots = new Map<string, RuntimeSnapshot>();
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
let initialized = false;

function scopeKey(scope: IRuntimeStatusScope): string {
  return `${scope.kind}:${scope.id}`;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function clearCleanupTimer(key: string) {
  const timer = cleanupTimers.get(key);
  if (!timer) {
    return;
  }
  clearTimeout(timer);
  cleanupTimers.delete(key);
}

function removeScope(scope: IRuntimeStatusScope) {
  const key = scopeKey(scope);
  clearCleanupTimer(key);
  if (snapshots.delete(key)) {
    emitChange();
  }
}

function ensureInitialized() {
  if (initialized) {
    return;
  }
  initialized = true;

  ipcBridge.runtime.statusChanged.on((event) => {
    const key = scopeKey(event.scope);
    clearCleanupTimer(key);
    snapshots.set(key, {
      ...event,
      observedAt: Date.now(),
    });
    emitChange();

    if (event.phase === 'ready') {
      const timer = setTimeout(() => {
        removeScope(event.scope);
      }, READY_DISMISS_DELAY_MS);
      cleanupTimers.set(key, timer);
    }
  });
}

function phasePriority(phase: RuntimeStatusPhase): number {
  switch (phase) {
    case 'failed':
      return 3;
    case 'waiting_for_lock':
    case 'downloading':
    case 'extracting':
    case 'validating':
      return 2;
    case 'ready':
      return 1;
  }
}

export async function retryRuntimeStatus(scope: IRuntimeStatusScope): Promise<void> {
  ensureInitialized();
  await systemSettings.ensureNodeRuntime.invoke({ scope });
}

export function dismissRuntimeStatus(scope: IRuntimeStatusScope) {
  ensureInitialized();
  removeScope(scope);
}

export function useGlobalRuntimeStatus(): RuntimeSnapshot | null {
  return useSyncExternalStore(
    (listener) => {
      ensureInitialized();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    (): RuntimeSnapshot | null => {
      ensureInitialized();
      const values = [...snapshots.values()];
      values.sort((a, b) => phasePriority(b.phase) - phasePriority(a.phase) || b.observedAt - a.observedAt);
      return values[0] ?? null;
    },
    (): RuntimeSnapshot | null => null
  );
}

export function isRuntimeActivePhase(phase: RuntimeStatusPhase): boolean {
  return phase === 'waiting_for_lock' || phase === 'downloading' || phase === 'extracting' || phase === 'validating';
}
