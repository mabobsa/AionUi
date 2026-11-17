import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Respect q=0 and preference order; gzip remains available where Brotli is not advertised. */
export function acceptedEncodings(header: string | undefined): ('br' | 'gzip')[] {
  const qualities = new Map(
    (header ?? '')
      .toLowerCase()
      .split(',')
      .map((part) => {
        const [name, ...params] = part.trim().split(';');
        const q = params
          .find((value) => value.trim().startsWith('q='))
          ?.trim()
          .slice(2);
        return [name, q === undefined ? 1 : Number(q)] as const;
      })
  );
  return (['br', 'gzip'] as const)
    .map((encoding) => ({ encoding, q: qualities.get(encoding) ?? qualities.get('*') ?? 0 }))
    .filter((item) => Number.isFinite(item.q) && item.q > 0 && item.q <= 1)
    .sort((a, b) => b.q - a.q)
    .map((item) => item.encoding);
}

/** Serve precompressed fingerprinted assets. Never rewrite a missing chunk to HTML. */
export async function serveOptimizedAsset(req: IncomingMessage, res: ServerResponse, root: string): Promise<boolean> {
  const pathname = (req.url ?? '').split('?')[0];
  if (!pathname.startsWith('/assets/')) return false;
  if (!['GET', 'HEAD'].includes(req.method ?? '') || !/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname)) {
    res.writeHead(404, { 'cache-control': 'no-store' }).end();
    return true;
  }
  const file = join(root, pathname.slice(1));
  const original = await stat(file).catch((): null => null);
  if (!original?.isFile()) {
    res.writeHead(404, { 'cache-control': 'no-store' }).end();
    return true;
  }
  const contentType = CONTENT_TYPES[extname(file)];
  // Let serve-handler handle uncommon types and ranges using its existing MIME/range support.
  if (!contentType || req.headers.range) return false;
  let selected = file;
  let size = original.size;
  let encoding: 'br' | 'gzip' | undefined;
  for (const candidate of acceptedEncodings(req.headers['accept-encoding'])) {
    const compressed = `${file}.${candidate === 'gzip' ? 'gz' : 'br'}`;
    const info = await stat(compressed).catch((): null => null);
    if (info?.isFile()) {
      selected = compressed;
      size = info.size;
      encoding = candidate;
      break;
    }
  }
  const fingerprinted = /-[a-zA-Z0-9_-]{8,}\.[a-z]+$/.test(pathname);
  const etag = `"${pathname.slice(8)}-${encoding ?? 'identity'}-${original.mtimeMs}"`;
  res.setHeader('content-type', contentType);
  res.setHeader('vary', 'Accept-Encoding');
  res.setHeader('cache-control', fingerprinted ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.setHeader('etag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304).end();
    return true;
  }
  if (encoding) res.setHeader('content-encoding', encoding);
  res.setHeader('content-length', size);
  if (req.method === 'HEAD') {
    res.writeHead(200).end();
    return true;
  }
  await new Promise<void>((resolve) => {
    const stream = createReadStream(selected);
    stream.on('error', () => {
      res.destroy();
      resolve();
    });
    res.on('close', () => {
      stream.destroy();
      resolve();
    });
    res.on('finish', resolve);
    stream.pipe(res);
  });
  return true;
}
