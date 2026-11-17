import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Fingerprint actual inputs, including uncommitted changes, rather than trusting Git HEAD. */
export function webuiSourceHash(root: string): string {
  const hash = createHash('sha256');
  // Renderer defines and optional instrumentation also affect emitted bytes.
  for (const name of [
    'env',
    'AIONUI_MULTI_INSTANCE',
    'IS_DISCONTINUED_BUILD',
    'SENTRY_DSN',
    'SENTRY_RELEASE',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'SENTRY_UPLOAD_SOURCE_MAPS',
    'CI',
  ]) {
    hash.update(`${name}\0${process.env[name] ?? ''}\0`);
  }
  hash.update(`sentryPlugin\0${Boolean(process.env.SENTRY_AUTH_TOKEN)}\0`);
  const visit = (file: string): void => {
    if (statSync(file).isDirectory()) {
      for (const name of readdirSync(file).sort()) visit(join(file, name));
    } else {
      hash.update(relative(root, file).replaceAll('\\', '/'));
      hash.update('\0');
      hash.update(readFileSync(file));
      hash.update('\0');
    }
  };
  for (const input of [
    'packages/desktop/src',
    'packages/desktop/webui',
    'packages/desktop/electron.vite.config.ts',
    'public',
    'uno.config.ts',
    'package.json',
    'bun.lock',
  ]) {
    visit(join(root, input));
  }
  return hash.digest('hex');
}

/** Missing build metadata must never silently select a stale development renderer. */
export function readWebuiBuildId(root: string): string {
  try {
    const record = JSON.parse(readFileSync(join(root, 'out/webui/build.json'), 'utf8')) as { sourceHash?: string };
    return /^[a-f0-9]{64}$/.test(record.sourceHash ?? '') ? record.sourceHash! : '';
  } catch {
    return '';
  }
}

/** Resolve the exact snapshot compiled into the host; never fall back to stale assets. */
export function resolveWebuiSnapshot(base: string, expectedBuildId: string): string {
  let buildId: string | undefined;
  try {
    buildId = (JSON.parse(readFileSync(join(base, 'build.json'), 'utf8')) as { sourceHash?: string }).sourceHash;
  } catch {
    throw new Error('[WebUI] Optimized assets are missing. Run bun run build:webui before starting AionUi.');
  }
  if (!buildId || !/^[a-f0-9]{64}$/.test(buildId) || buildId !== expectedBuildId) {
    throw new Error('[WebUI] Optimized assets do not match this app. Run bun run build:webui and restart AionUi.');
  }
  const directory = join(base, buildId);
  if (!existsSync(join(directory, 'index.html'))) {
    throw new Error('[WebUI] Optimized assets are missing. Run bun run build:webui before starting AionUi.');
  }
  return directory;
}
