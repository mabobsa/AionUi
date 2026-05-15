/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { webui, type IWebUIStatus } from '@/common/adapter/ipcBridge';
import { useCallback, useEffect, useState } from 'react';

export type WebuiStatus = {
  running: boolean;
  localUrl: string | null;
  networkUrl: string | null;
  raw: IWebUIStatus | null;
};

const DEFAULT_STATUS: WebuiStatus = {
  running: false,
  localUrl: null,
  networkUrl: null,
  raw: null,
};

export function useWebuiStatus(): WebuiStatus & { refresh: () => Promise<void> } {
  const [status, setStatus] = useState<WebuiStatus>(DEFAULT_STATUS);

  const applyRaw = useCallback((raw: IWebUIStatus | null) => {
    if (!raw) {
      setStatus(DEFAULT_STATUS);
      return;
    }
    setStatus({
      running: raw.running,
      localUrl: raw.localUrl ?? null,
      networkUrl: raw.networkUrl ?? null,
      raw,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const raw = await webui.getStatus.invoke();
      applyRaw(raw ?? null);
    } catch {
      setStatus(DEFAULT_STATUS);
    }
  }, [applyRaw]);

  useEffect(() => {
    void refresh();
    const unsub = webui.statusChanged.on((data) => {
      setStatus((prev) => ({
        running: data.running === true,
        localUrl: data.localUrl ?? prev.localUrl,
        networkUrl: data.networkUrl ?? prev.networkUrl,
        raw: prev.raw
          ? { ...prev.raw, running: data.running === true, localUrl: data.localUrl ?? prev.raw.localUrl }
          : null,
      }));
    });
    return unsub;
  }, [refresh]);

  return { ...status, refresh };
}
