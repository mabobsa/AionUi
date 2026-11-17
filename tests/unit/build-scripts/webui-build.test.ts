import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readWebuiBuildId, resolveWebuiSnapshot, webuiSourceHash } from '../../../packages/desktop/webui/identity';

describe('optimized WebUI build identity', () => {
  let root: string;
  const write = (name: string, text: string): void => {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aionui-webui-build-'));
    for (const file of [
      'packages/desktop/src/main.ts',
      'packages/desktop/webui/config.ts',
      'packages/desktop/electron.vite.config.ts',
      'public/sw.js',
      'uno.config.ts',
      'package.json',
      'bun.lock',
    ]) {
      write(file, 'initial');
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('invalidates a cached build when uncommitted sources or public assets change', () => {
    const initial = webuiSourceHash(root);
    write('packages/desktop/src/main.ts', 'updated');
    const edited = webuiSourceHash(root);
    write('public/sw.js', 'updated');
    expect(edited).not.toBe(initial);
    expect(webuiSourceHash(root)).not.toBe(edited);
  });

  it('does not invalidate the source hash when build output is written', () => {
    const initial = webuiSourceHash(root);
    write('out/webui/build.json', '{}');
    expect(webuiSourceHash(root)).toBe(initial);
  });

  it('invalidates the snapshot when a renderer build flag changes', () => {
    vi.stubEnv('IS_DISCONTINUED_BUILD', 'false');
    const active = webuiSourceHash(root);
    vi.stubEnv('IS_DISCONTINUED_BUILD', 'true');
    expect(webuiSourceHash(root)).not.toBe(active);
  });

  it('selects a matching built snapshot', () => {
    const sourceHash = webuiSourceHash(root);
    write('out/webui/build.json', JSON.stringify({ sourceHash }));
    write(`out/webui/${sourceHash}/index.html`, '<title>WebUI</title>');
    expect(readWebuiBuildId(root)).toBe(sourceHash);
    expect(resolveWebuiSnapshot(join(root, 'out/webui'), sourceHash)).toBe(join(root, 'out/webui', sourceHash));
  });

  it('refuses an app/snapshot mismatch instead of serving a stale renderer', () => {
    const sourceHash = webuiSourceHash(root);
    write('out/webui/build.json', JSON.stringify({ sourceHash }));
    write(`out/webui/${sourceHash}/index.html`, '<title>WebUI</title>');
    expect(() => resolveWebuiSnapshot(join(root, 'out/webui'), '0'.repeat(64))).toThrow('do not match');
  });

  it('rejects incomplete or malformed build metadata', () => {
    expect(readWebuiBuildId(root)).toBe('');
    write('out/webui/build.json', '{');
    expect(() => resolveWebuiSnapshot(join(root, 'out/webui'), '')).toThrow('missing');
    write('out/webui/build.json', JSON.stringify({ sourceHash: '../renderer' }));
    expect(() => resolveWebuiSnapshot(join(root, 'out/webui'), '../renderer')).toThrow('do not match');
  });

  it('rejects a snapshot with no HTML entry', () => {
    const sourceHash = webuiSourceHash(root);
    write('out/webui/build.json', JSON.stringify({ sourceHash }));
    expect(() => resolveWebuiSnapshot(join(root, 'out/webui'), sourceHash)).toThrow('missing');
  });
});
