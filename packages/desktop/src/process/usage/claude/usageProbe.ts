/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Run and cache the interactive Claude subscription-usage probe. */
import type { ClaudeUsageSnapshot } from '@/common/types/platform/claudeUsage';
import { existsSync } from 'node:fs';
import { delimiter, extname, join } from 'node:path';
import { spawn, type IPty } from 'node-pty';
import { parseClaudeUsageOutput, stripClaudeUsageTerminalOutput } from './usageParser';

const DEFAULT_SUCCESS_TTL_MS = 60_000;
const DEFAULT_FAILURE_TTL_MS = 60_000;
const DEFAULT_COMMAND_DELAY_MS = 8_000;
const DEFAULT_READY_COMMAND_DELAY_MS = 750;
const DEFAULT_EXIT_COMMAND_DELAY_MS = 1_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_CAPTURE_CHARS = 256 * 1024;
const TRUST_CONFIRMATION = /quick safety check|trust this folder/i;
const USAGE_DIALOG_DISMISSED = /settings dialog dismissed/i;

export type SpawnPty = typeof spawn;

export type ClaudeUsageProbeOptions = {
  command?: string;
  commandDelayMs?: number;
  env?: NodeJS.ProcessEnv;
  exitCommandDelayMs?: number;
  failureTtlMs?: number;
  now?: () => number;
  readyCommandDelayMs?: number;
  spawnPty?: SpawnPty;
  successTtlMs?: number;
  timeoutMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  value: ClaudeUsageSnapshot | null;
};

const executableExtensions = (env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] => {
  if (platform !== 'win32') return [''];
  const configured = env.PATHEXT?.split(';').filter(Boolean) ?? ['.COM', '.EXE', '.BAT', '.CMD'];
  return ['', ...configured];
};

/**
 * Resolve an executable before passing it to node-pty. On Windows, ConPTY does
 * not perform PATHEXT lookup for a bare command name.
 */
export const resolveExecutableFromPath = (
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  pathExists: (path: string) => boolean = existsSync
): string | undefined => {
  if (command.includes('/') || command.includes('\\')) {
    return pathExists(command) ? command : undefined;
  }

  const extensions = extname(command) ? [''] : executableExtensions(env, platform);
  const pathEntries = env.PATH?.split(delimiter).map((entry) => entry.replace(/^"|"$/g, '').trim()) ?? [];
  for (const pathEntry of pathEntries) {
    if (!pathEntry) continue;
    for (const extension of extensions) {
      const candidate = join(pathEntry, `${command}${extension}`);
      if (pathExists(candidate)) return candidate;
    }
  }
  return undefined;
};

export class ClaudeUsageProbe {
  readonly #command: string;
  readonly #commandDelayMs: number;
  readonly #env: NodeJS.ProcessEnv;
  readonly #exitCommandDelayMs: number;
  readonly #failureTtlMs: number;
  readonly #now: () => number;
  readonly #readyCommandDelayMs: number;
  readonly #spawnPty: SpawnPty;
  readonly #successTtlMs: number;
  readonly #timeoutMs: number;

  #cache: CacheEntry | undefined;
  #inFlight: Promise<ClaudeUsageSnapshot | null> | undefined;

  constructor(options: ClaudeUsageProbeOptions = {}) {
    this.#command = options.command ?? 'claude';
    this.#commandDelayMs = options.commandDelayMs ?? DEFAULT_COMMAND_DELAY_MS;
    this.#env = options.env ?? process.env;
    this.#exitCommandDelayMs = options.exitCommandDelayMs ?? DEFAULT_EXIT_COMMAND_DELAY_MS;
    this.#failureTtlMs = options.failureTtlMs ?? DEFAULT_FAILURE_TTL_MS;
    this.#now = options.now ?? Date.now;
    this.#readyCommandDelayMs = options.readyCommandDelayMs ?? DEFAULT_READY_COMMAND_DELAY_MS;
    this.#spawnPty = options.spawnPty ?? spawn;
    this.#successTtlMs = options.successTtlMs ?? DEFAULT_SUCCESS_TTL_MS;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getUsage(cwd: string): Promise<ClaudeUsageSnapshot | null> {
    const now = this.#now();
    if (this.#cache && this.#cache.expiresAt > now) return this.#cache.value;
    if (this.#inFlight) return this.#inFlight;

    const request = this.#runProbe(cwd)
      .then((value) => {
        this.#cache = {
          value,
          expiresAt: this.#now() + (value ? this.#successTtlMs : this.#failureTtlMs),
        };
        return value;
      })
      .catch((error: unknown): ClaudeUsageSnapshot | null => {
        console.warn('[ClaudeUsageProbe] Unable to refresh Claude plan usage', {
          reason: error instanceof Error ? error.message : String(error),
        });
        this.#cache = {
          value: null,
          expiresAt: this.#now() + this.#failureTtlMs,
        };
        return null;
      })
      .finally(() => {
        if (this.#inFlight === request) this.#inFlight = undefined;
      });

    this.#inFlight = request;
    return request;
  }

  #runProbe(cwd: string): Promise<ClaudeUsageSnapshot | null> {
    const executable = resolveExecutableFromPath(this.#command, this.#env);
    if (!executable) {
      return Promise.reject(new Error('Claude executable was not found on PATH'));
    }

    return new Promise((resolve, reject) => {
      let terminal: IPty;
      try {
        terminal = this.#spawnPty(executable, ['--ax-screen-reader', '--safe-mode'], {
          cwd,
          env: this.#env,
          name: 'xterm-256color',
          cols: 120,
          rows: 50,
        });
      } catch (error) {
        reject(error);
        return;
      }

      let captured = '';
      let completedSnapshot: ClaudeUsageSnapshot | undefined;
      let commandSent = false;
      let exitCommandQueued = false;
      let exited = false;
      let settled = false;
      let trustConfirmed = false;
      let dataSubscription: { dispose(): void } | undefined;
      let exitSubscription: { dispose(): void } | undefined;
      let commandTimer: ReturnType<typeof setTimeout> | undefined;
      let readyCommandTimer: ReturnType<typeof setTimeout> | undefined;
      let exitCommandTimer: ReturnType<typeof setTimeout> | undefined;
      let shutdownTimer: ReturnType<typeof setTimeout> | undefined;
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (value: ClaudeUsageSnapshot | null, error?: Error): void => {
        if (settled) return;
        settled = true;
        if (commandTimer) clearTimeout(commandTimer);
        if (readyCommandTimer) clearTimeout(readyCommandTimer);
        if (exitCommandTimer) clearTimeout(exitCommandTimer);
        if (shutdownTimer) clearTimeout(shutdownTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        dataSubscription?.dispose();
        exitSubscription?.dispose();
        if (!exited) {
          try {
            terminal.kill();
          } catch {
            // The process may already have exited.
          }
        }
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      };

      const writeIfActive = (value: string): boolean => {
        if (settled || exited) return false;
        try {
          terminal.write(value);
          return true;
        } catch {
          return false;
        }
      };

      const sendUsageCommand = (): void => {
        if (commandSent || !writeIfActive('/usage\r')) return;
        commandSent = true;
        if (commandTimer) clearTimeout(commandTimer);
        if (readyCommandTimer) clearTimeout(readyCommandTimer);
      };

      const scheduleFallbackCommand = (): void => {
        if (commandTimer) clearTimeout(commandTimer);
        commandTimer = setTimeout(sendUsageCommand, this.#commandDelayMs);
      };

      const scheduleReadyCommand = (): void => {
        if (commandSent || settled || exited) return;
        if (readyCommandTimer) clearTimeout(readyCommandTimer);
        readyCommandTimer = setTimeout(sendUsageCommand, this.#readyCommandDelayMs);
      };

      const closeGracefully = (snapshot: ClaudeUsageSnapshot): void => {
        if (completedSnapshot) return;
        completedSnapshot = snapshot;
        if (commandTimer) clearTimeout(commandTimer);
        if (readyCommandTimer) clearTimeout(readyCommandTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);

        // `/usage` is a settings dialog. Close it before sending `/exit`; sending
        // both commands back-to-back can concatenate `/exit` into a chat prompt.
        writeIfActive('\u001b');
        shutdownTimer = setTimeout(() => finish(snapshot), DEFAULT_SHUTDOWN_TIMEOUT_MS);
      };

      dataSubscription = terminal.onData((chunk) => {
        captured = `${captured}${chunk}`.slice(-MAX_CAPTURE_CHARS);
        const plainOutput = stripClaudeUsageTerminalOutput(captured);
        if (!trustConfirmed && TRUST_CONFIRMATION.test(plainOutput)) {
          trustConfirmed = true;
          writeIfActive('y\r');
          scheduleFallbackCommand();
          return;
        }

        if (completedSnapshot) {
          if (!exitCommandQueued && USAGE_DIALOG_DISMISSED.test(plainOutput)) {
            exitCommandQueued = true;
            exitCommandTimer = setTimeout(() => {
              writeIfActive('/exit\r');
            }, this.#exitCommandDelayMs);
          }
          return;
        }

        const snapshot = parseClaudeUsageOutput(captured, new Date(this.#now()));
        if (snapshot?.session && snapshot.weekly) {
          closeGracefully(snapshot);
        } else if (plainOutput.trim()) {
          // Claude startup time varies with local configuration. Send /usage
          // after the interactive screen has become quiet, while retaining the
          // fixed delay as a fallback for CLI versions with no readable prompt.
          scheduleReadyCommand();
        }
      });

      exitSubscription = terminal.onExit(() => {
        exited = true;
        finish(completedSnapshot ?? parseClaudeUsageOutput(captured, new Date(this.#now())));
      });

      scheduleFallbackCommand();

      timeoutTimer = setTimeout(() => {
        const partial = parseClaudeUsageOutput(captured, new Date(this.#now()));
        finish(partial, partial ? undefined : new Error('Claude usage probe timed out'));
      }, this.#timeoutMs);
    });
  }
}
