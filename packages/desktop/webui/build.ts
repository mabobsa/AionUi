import { build } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { webuiConfig } from './config';
import { webuiSourceHash } from './identity';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
process.chdir(root);
const sourceHash = webuiSourceHash(root);
const outputRoot = join(root, 'out/webui');
const output = join(outputRoot, sourceHash);
type OutputFile = { path: string; sha256: string };
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

function reusable(): boolean {
  try {
    const record = JSON.parse(readFileSync(join(output, 'build.json'), 'utf8')) as {
      sourceHash: string;
      files: OutputFile[];
    };
    return (
      record.sourceHash === sourceHash &&
      record.files.length > 0 &&
      record.files.every(
        (file) => existsSync(join(output, file.path)) && digest(readFileSync(join(output, file.path))) === file.sha256
      )
    );
  } catch {
    return false;
  }
}

if (!reusable()) {
  mkdirSync(outputRoot, { recursive: true });
  // Pin a running server to one snapshot even when another build is prepared.
  await build(await webuiConfig(root, output));
  renameSync(join(output, 'webui.html'), join(output, 'index.html'));
  const files: OutputFile[] = [];
  function collect(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        collect(file);
        continue;
      }
      const bytes = readFileSync(file);
      files.push({ path: relative(output, file).replaceAll('\\', '/'), sha256: digest(bytes) });
      if (/\.(?:js|css|svg|json)$/.test(file) && bytes.length > 512) {
        for (const [suffix, compressed] of [
          ['br', brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })],
          ['gz', gzipSync(bytes)],
        ] as const) {
          writeFileSync(`${file}.${suffix}`, compressed);
          files.push({ path: `${relative(output, file).replaceAll('\\', '/')}.${suffix}`, sha256: digest(compressed) });
        }
      }
    }
  }
  collect(output);
  if (webuiSourceHash(root) !== sourceHash)
    throw new Error('WebUI sources changed during build; run build:webui again.');
  writeFileSync(join(output, 'build.json'), JSON.stringify({ sourceHash, language: 'ko-KR', files }, null, 2));
  console.log(`[WebUI] Optimized Korean build completed: ${sourceHash.slice(0, 12)}`);
} else {
  console.log(`[WebUI] Verified cached build: ${sourceHash.slice(0, 12)}`);
}
const pointer = join(outputRoot, `build.${process.pid}.json`);
writeFileSync(pointer, JSON.stringify({ sourceHash, language: 'ko-KR' }, null, 2));
renameSync(pointer, join(outputRoot, 'build.json'));
