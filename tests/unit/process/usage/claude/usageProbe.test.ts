/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { IPty } from 'node-pty';
import { ClaudeUsageProbe, resolveExecutableFromPath, type SpawnPty } from '@process/usage/claude/usageProbe';

class FakePty {
  readonly kill = vi.fn();
  readonly write = vi.fn();
  #dataListener: ((data: string) => void) | undefined;
  #exitListener: (() => void) | undefined;

  readonly onData = (listener: (data: string) => void): { dispose(): void } => {
    this.#dataListener = listener;
    return { dispose: vi.fn() };
  };

  readonly onExit = (listener: () => void): { dispose(): void } => {
    this.#exitListener = listener;
    return { dispose: vi.fn() };
  };

  emitData(data: string): void {
    this.#dataListener?.(data);
  }

  emitExit(): void {
    this.#exitListener?.();
  }
}

const completeUsage = `
Current session
25% used
Resets 8:30am
Current week (all models)
24% used
Resets Aug 4, 9pm
`;

const windowsPathExists = (path: string): boolean => path === 'C:\\tools\\claude.EXE';

describe('ClaudeUsageProbe', () => {
  it('waits for startup, runs /usage, exits cleanly, and caches concurrent reads', async () => {
    vi.useFakeTimers();
    try {
      const terminal = new FakePty();
      const spawnPty = vi.fn(() => terminal as unknown as IPty) as unknown as SpawnPty;
      const now = new Date(2026, 6, 31, 7, 0, 0).getTime();
      const probe = new ClaudeUsageProbe({
        command: process.execPath,
        commandDelayMs: 100,
        exitCommandDelayMs: 50,
        now: () => now,
        spawnPty,
      });

      const first = probe.getUsage(process.cwd());
      const concurrent = probe.getUsage(process.cwd());
      expect(spawnPty).toHaveBeenCalledWith(
        process.execPath,
        ['--ax-screen-reader', '--safe-mode'],
        expect.objectContaining({ cwd: process.cwd() })
      );

      await vi.advanceTimersByTimeAsync(99);
      expect(terminal.write).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(terminal.write).toHaveBeenCalledWith('/usage\r');

      terminal.emitData(completeUsage);
      expect(terminal.write).toHaveBeenCalledWith('\u001b');
      terminal.emitData('Settings dialog dismissed');
      await vi.advanceTimersByTimeAsync(50);
      expect(terminal.write).toHaveBeenCalledWith('/exit\r');
      terminal.emitExit();

      await expect(first).resolves.toMatchObject({
        session: { utilization: 25 },
        weekly: { utilization: 24 },
      });
      await expect(concurrent).resolves.toMatchObject({
        session: { utilization: 25 },
        weekly: { utilization: 24 },
      });
      await expect(probe.getUsage(process.cwd())).resolves.toMatchObject({
        session: { utilization: 25 },
      });
      expect(spawnPty).toHaveBeenCalledTimes(1);
      expect(terminal.kill).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns and caches null when the executable cannot be resolved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spawnPty = vi.fn();
    const probe = new ClaudeUsageProbe({
      command: 'missing-claude-command',
      env: { PATH: '' },
      spawnPty: spawnPty as unknown as SpawnPty,
    });

    await expect(probe.getUsage(process.cwd())).resolves.toBeNull();
    await expect(probe.getUsage(process.cwd())).resolves.toBeNull();
    expect(spawnPty).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns partial usage when Claude exits after rendering one bucket', async () => {
    const terminal = new FakePty();
    const spawnPty = vi.fn(() => terminal as unknown as IPty) as unknown as SpawnPty;
    const probe = new ClaudeUsageProbe({
      command: process.execPath,
      spawnPty,
    });

    const result = probe.getUsage(process.cwd());
    terminal.emitData('Current session\n18% used\nResets 11pm\n');
    terminal.emitExit();

    await expect(result).resolves.toMatchObject({
      session: { utilization: 18 },
    });
  });

  it('answers an interactive workspace trust prompt once', async () => {
    const terminal = new FakePty();
    const spawnPty = vi.fn(() => terminal as unknown as IPty) as unknown as SpawnPty;
    const probe = new ClaudeUsageProbe({
      command: process.execPath,
      spawnPty,
    });

    const result = probe.getUsage(process.cwd());
    terminal.emitData('Quick safety check\nYes, I trust this folder\nNo, exit\n');
    terminal.emitData('Quick safety check\nYes, I trust this folder\nNo, exit\n');
    terminal.emitExit();

    await expect(result).resolves.toBeNull();
    expect(terminal.write).toHaveBeenCalledTimes(1);
    expect(terminal.write).toHaveBeenCalledWith('y\r');
    expect(terminal.kill).not.toHaveBeenCalled();
  });
});

describe('resolveExecutableFromPath', () => {
  it('applies PATHEXT lookup before spawning on Windows', () => {
    expect(
      resolveExecutableFromPath(
        'claude',
        {
          PATH: 'C:\\tools',
          PATHEXT: '.COM;.EXE',
        },
        'win32',
        windowsPathExists
      )
    ).toBe('C:\\tools\\claude.EXE');
  });

  it('returns undefined when no candidate exists', () => {
    expect(resolveExecutableFromPath('claude', { PATH: '/bin' }, 'linux', () => false)).toBeUndefined();
  });
});
