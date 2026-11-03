/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claudeProjectDirectory,
  isProbeTranscript,
  removeProbeTranscripts,
} from '@process/usage/claude/probeSessionCleanup';

const lines = (...entries: object[]): string => `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;

const probeTranscript = lines(
  { type: 'mode', mode: 'normal', sessionId: 's' },
  { type: 'permission-mode', permissionMode: 'default', sessionId: 's' },
  { type: 'session-owner', sessionId: 's' },
  {
    type: 'system',
    subtype: 'local_command',
    content:
      '<command-name>/usage</command-name>\n<command-message>usage</command-message>\n<command-args></command-args>',
  },
  {
    type: 'system',
    subtype: 'local_command',
    content: '<local-command-stdout>Settings dialog dismissed</local-command-stdout>',
  },
  { type: 'last-prompt', leafUuid: 'u', sessionId: 's' },
  { type: 'cost-state', sessionId: 's', totalCostUSD: 0 }
);

describe('claudeProjectDirectory', () => {
  it('maps a folder to the project folder name Claude uses', () => {
    expect(claudeProjectDirectory('C:\\cfg', 'D:\\Git\\AionUi')).toBe(join('C:\\cfg', 'projects', 'D--Git-AionUi'));
    expect(claudeProjectDirectory('/cfg', '/home/me/system_default_user/aionui.dev')).toBe(
      join('/cfg', 'projects', '-home-me-system-default-user-aionui-dev')
    );
  });
});

describe('isProbeTranscript', () => {
  it('accepts a transcript that only opened /usage', () => {
    expect(isProbeTranscript(probeTranscript)).toBe(true);
  });

  it('rejects transcripts with a conversation, another command, or nothing to identify', () => {
    expect(isProbeTranscript(`${probeTranscript}${lines({ type: 'user', message: { content: 'hi' } })}`)).toBe(false);
    expect(
      isProbeTranscript(
        lines({ type: 'system', subtype: 'local_command', content: '<command-name>/model</command-name>' })
      )
    ).toBe(false);
    expect(isProbeTranscript(`${probeTranscript}${lines({ type: 'system', subtype: 'api_error' })}`)).toBe(false);
    expect(isProbeTranscript(`${probeTranscript}not json\n`)).toBe(false);
    expect(isProbeTranscript(lines({ type: 'mode' }, { type: 'permission-mode' }))).toBe(false);
  });
});

describe('removeProbeTranscripts', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'aionui-probe-cleanup-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const write = (name: string, text: string, ageMs: number, now: number): string => {
    const path = join(directory, name);
    writeFileSync(path, text, 'utf8');
    const time = new Date(now - ageMs);
    utimesSync(path, time, time);
    return path;
  };

  it('deletes only old probe transcripts and keeps real or recent sessions', () => {
    const now = Date.now();
    const oldProbe = write('old-probe.jsonl', probeTranscript, 10_000, now);
    const recentProbe = write('recent-probe.jsonl', probeTranscript, 500, now);
    const conversation = write(
      'conversation.jsonl',
      `${probeTranscript}${lines({ type: 'assistant', message: { content: 'answer' } })}`,
      10_000,
      now
    );
    const large = write('large.jsonl', `${probeTranscript}${' '.repeat(5_000)}\n`, 10_000, now);

    expect(removeProbeTranscripts(directory, 2_000, now)).toBe(1);
    expect(existsSync(oldProbe)).toBe(false);
    expect(existsSync(recentProbe)).toBe(true);
    expect(existsSync(conversation)).toBe(true);
    expect(existsSync(large)).toBe(true);
  });

  it('returns zero when the project folder does not exist yet', () => {
    expect(removeProbeTranscripts(join(directory, 'missing'), 2_000)).toBe(0);
  });
});
