/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import type { BrowserWindow } from 'electron';
import { app, clipboard, nativeImage } from 'electron';
import { ipcBridge } from '@/common';
import { ProcessConfig } from '@process/utils/initStorage';
import { getZoomFactor, setZoomFactor } from '@process/utils/zoom';
import { getCdpStatus, updateCdpConfig } from '@process/utils/configureChromium';
import { getGpuStatus, setGpuUserOverride } from '@process/utils/gpuRecovery';
import { initApplicationBridgeCore } from './applicationBridgeCore';
import type { IStartOnBootStatus } from '@/common/adapter/ipcBridge';
import { restartApplication } from './restartApplication';

let mainWindowRef: BrowserWindow | null = null;

const START_ON_BOOT_UNSUPPORTED_MESSAGE = 'Start on boot is only available in packaged macOS and Windows apps.';
export const START_ON_BOOT_WINDOWS_ARG = '--start-on-boot';

const isStartOnBootSupported = (): boolean => {
  return app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32');
};

const getStartOnBootWindowsArgs = (): string[] => [START_ON_BOOT_WINDOWS_ARG];

const getLoginItemSettings = () => {
  return process.platform === 'win32'
    ? app.getLoginItemSettings({ args: getStartOnBootWindowsArgs() })
    : app.getLoginItemSettings();
};

export function wasLaunchedAtLogin(): boolean {
  if (!app.isPackaged) {
    return false;
  }

  if (process.platform === 'darwin') {
    return Boolean(getLoginItemSettings().wasOpenedAtLogin);
  }

  if (process.platform === 'win32') {
    return process.argv.includes(START_ON_BOOT_WINDOWS_ARG);
  }

  return false;
}

export function getStartOnBootStatus(): IStartOnBootStatus {
  if (!isStartOnBootSupported()) {
    return {
      supported: false,
      enabled: false,
      isPackaged: app.isPackaged,
      platform: process.platform,
    };
  }

  const settings = getLoginItemSettings();
  const enabled =
    process.platform === 'win32'
      ? Boolean(settings.openAtLogin || settings.executableWillLaunchAtLogin)
      : Boolean(settings.openAtLogin);

  return {
    supported: true,
    enabled,
    isPackaged: app.isPackaged,
    platform: process.platform,
  };
}

export function setStartOnBootEnabled(enabled: boolean): IStartOnBootStatus {
  const currentStatus = getStartOnBootStatus();
  if (!currentStatus.supported) {
    return currentStatus;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    ...(process.platform === 'win32'
      ? {
          args: getStartOnBootWindowsArgs(),
          enabled: true,
        }
      : {}),
  });

  return getStartOnBootStatus();
}

// --- Taskbar completion badge + attention flashing ---------------------------
// Count of conversations with an unread "completed" (blue dot) state, mirrored
// onto the taskbar icon: a numeric overlay (max "9+") plus continuous flashing
// until the user focuses the window.
let flashTimer: ReturnType<typeof setInterval> | null = null;
let flashPhase = false;
let lastBadgeCount = 0;

const stopFlashing = (): void => {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  flashPhase = false;
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.flashFrame(false);
  }
};

const startFlashing = (): void => {
  if (flashTimer) return;
  // Toggle the flash state on an interval so the taskbar keeps blinking until
  // the window is focused (a single flashFrame(true) can stop after a few cycles).
  flashTimer = setInterval(() => {
    const win = mainWindowRef;
    if (!win || win.isDestroyed() || win.isFocused() || lastBadgeCount <= 0) {
      stopFlashing();
      return;
    }
    flashPhase = !flashPhase;
    win.flashFrame(flashPhase);
  }, 700);
};

const applyTaskbarBadge = (count: number, iconDataUrl?: string): void => {
  lastBadgeCount = count;
  // macOS / Linux (Unity): numeric dock/taskbar badge for free.
  app.badgeCount = count;

  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;

  if (process.platform === 'win32') {
    // The numeric overlay is rasterized in the renderer (canvas → PNG dataURL),
    // since nativeImage cannot reliably render SVG. Empty/absent → clear overlay.
    let overlay: Electron.NativeImage | null = null;
    if (count > 0 && iconDataUrl) {
      const image = nativeImage.createFromDataURL(iconDataUrl);
      overlay = image.isEmpty() ? null : image;
    }
    win.setOverlayIcon(overlay, count > 0 ? `${count} completed` : '');
  }

  if (count > 0 && !win.isFocused()) {
    startFlashing();
  } else {
    stopFlashing();
  }
};

export function setApplicationMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
  // Stop flashing the moment the user looks at the window.
  win.on('focus', () => stopFlashing());
}

/**
 * Fast path: a single Explorer-copied file exposes its path via the registered
 * CFSTR_FILENAMEW clipboard format, which Electron can read directly — no process
 * spawn, so it returns instantly. The buffer is a null-terminated UTF-16LE path.
 * Returns [] when the format is absent (e.g. multi-file selections, which only
 * populate CF_HDROP).
 */
function readClipboardFilePathsNative(): string[] {
  try {
    const buffer = clipboard.readBuffer('FileNameW');
    if (buffer && buffer.length > 0) {
      const path = buffer.toString('utf16le').replace(/\0+$/, '').trim();
      if (path) return [path];
    }
  } catch {
    // ignore — fall back to the PowerShell drop-list reader
  }
  return [];
}

/**
 * Fallback for multi-file selections: CF_HDROP isn't readable by name through
 * Electron, so use PowerShell's `Get-Clipboard -Format FileDropList`. Slower
 * (~1-2s cold start) but correct for multiple files. Forcing UTF-8 output keeps
 * non-ASCII (e.g. Korean) path segments intact.
 */
function readClipboardFilePathsViaPowerShell(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }',
      ],
      { windowsHide: true, timeout: 5000, encoding: 'utf8' },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        resolve(
          stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        );
      }
    );
  });
}

/**
 * Read absolute paths of files currently on the OS clipboard (e.g. files copied
 * in Explorer). Returns [] off Windows or when the clipboard holds no files.
 * Tries the instant native read first; falls back to PowerShell only when needed.
 */
function readClipboardFilePaths(): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const native = readClipboardFilePathsNative();
  if (native.length > 0) return Promise.resolve(native);
  return readClipboardFilePathsViaPowerShell();
}

export function initApplicationBridge(): void {
  // Platform-agnostic handlers: systemInfo, updateSystemInfo, getPath
  initApplicationBridgeCore();

  ipcBridge.application.restart.provider(async () => {
    // Backend subprocess shutdown is handled by backendManager.stop() in the
    // main window's before-quit hook; agent children are killed transitively
    // when backend exits.
    return restartApplication(app);
  });

  ipcBridge.application.isDevToolsOpened.provider(() => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      return Promise.resolve(mainWindowRef.webContents.isDevToolsOpened());
    }
    return Promise.resolve(false);
  });

  ipcBridge.application.openDevTools.provider(() => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      const win = mainWindowRef;
      const wasOpen = win.webContents.isDevToolsOpened();

      if (wasOpen) {
        win.webContents.closeDevTools();
        return Promise.resolve(false);
      } else {
        return new Promise((resolve) => {
          const onOpened = () => {
            win.webContents.off('devtools-opened', onOpened);
            resolve(true);
          };

          win.webContents.once('devtools-opened', onOpened);
          win.webContents.openDevTools();

          setTimeout(() => {
            win.webContents.off('devtools-opened', onOpened);
            if (win.isDestroyed()) {
              resolve(false);
              return;
            }
            resolve(win.webContents.isDevToolsOpened());
          }, 500);
        });
      }
    }
    return Promise.resolve(false);
  });

  ipcBridge.application.getZoomFactor.provider(() => Promise.resolve(getZoomFactor()));

  ipcBridge.application.getClipboardFilePaths.provider(() => readClipboardFilePaths());

  ipcBridge.application.setZoomFactor.provider(async ({ factor }) => {
    const updatedFactor = setZoomFactor(factor);
    try {
      await ProcessConfig.set('ui.zoomFactor', updatedFactor);
    } catch (error) {
      console.error('[ApplicationBridge] Failed to persist zoom factor:', error);
    }
    return updatedFactor;
  });

  ipcBridge.application.writeRendererLog.provider(async ({ level, tag, message, data }) => {
    const prefix = `[Renderer:${tag}] ${message}`;
    const args = data === undefined ? [prefix] : [prefix, data];
    if (level === 'error') {
      console.error(...args);
    } else if (level === 'warn') {
      console.warn(...args);
    } else {
      console.info(...args);
    }
  });

  // CDP status and configuration
  ipcBridge.application.getCdpStatus.provider(async () => {
    try {
      const status = getCdpStatus();
      // If port is set, CDP is considered enabled (verification is optional)
      return { success: true, data: status };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.updateCdpConfig.provider(async (config) => {
    try {
      const updatedConfig = updateCdpConfig(config);
      return { success: true, data: updatedConfig };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.getStartOnBootStatus.provider(async () => {
    try {
      return { success: true, data: getStartOnBootStatus() };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.setStartOnBoot.provider(async ({ enabled }) => {
    try {
      const status = setStartOnBootEnabled(enabled);
      if (!status.supported) {
        return { success: false, msg: START_ON_BOOT_UNSUPPORTED_MESSAGE, data: status };
      }
      return { success: true, data: status };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.getGpuStatus.provider(async () => {
    try {
      return { success: true, data: getGpuStatus() };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.setGpuOverride.provider(async ({ override }) => {
    try {
      return { success: true, data: setGpuUserOverride(override) };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.setTaskbarBadge.provider(async ({ count, iconDataUrl }) => {
    applyTaskbarBadge(Math.max(0, Math.floor(count)), iconDataUrl);
  });
}
