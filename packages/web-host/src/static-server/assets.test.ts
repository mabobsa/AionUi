import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http, { type IncomingHttpHeaders } from 'node:http';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { startStaticServer, type StaticServerHandle } from '../static-server';
import { acceptedEncodings } from './assets';

describe('optimized static assets', () => {
  let directory: string;
  let server: StaticServerHandle;
  const source = 'export const value = "한국어";';
  const asset = '/assets/webui-abcdefgh.js';

  function request(
    path: string,
    headers: Record<string, string> = {},
    method = 'GET'
  ): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
    return new Promise((resolve, reject) => {
      http
        .request(`${server.localUrl}${path}`, { method, headers: { ...headers, Connection: 'close' } }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
          res.on('error', reject);
        })
        .on('error', reject)
        .end();
    });
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'aionui-webui-assets-'));
    await mkdir(join(directory, 'assets'));
    await Promise.all([
      writeFile(join(directory, 'index.html'), '<!doctype html><title>WebUI</title>'),
      writeFile(join(directory, asset), source),
      writeFile(join(directory, `${asset}.br`), brotliCompressSync(source)),
      writeFile(join(directory, `${asset}.gz`), gzipSync(source)),
      writeFile(join(directory, 'assets/worker.js'), 'self.onmessage = () => {};'),
      writeFile(join(directory, 'assets/icon-abcdefgh.png'), Buffer.from([137, 80, 78, 71])),
    ]);
    server = await startStaticServer({ staticDir: directory, backendPort: 1, port: 0 });
  });

  afterEach(async () => {
    await server?.stop();
    await rm(directory, { recursive: true, force: true });
  });

  it('sends Brotli bytes and long-lived caching only for fingerprinted assets', async () => {
    const response = await request(asset, { 'Accept-Encoding': 'gzip, br' });
    expect(response.headers['content-encoding']).toBe('br');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(brotliDecompressSync(response.body).toString()).toBe(source);
  });

  it('honors a rejected Brotli encoding and falls back to gzip', async () => {
    const response = await request(asset, { 'Accept-Encoding': 'br;q=0, gzip;q=0.5' });
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(response.body).toString()).toBe(source);
  });

  it('serves the original script when compressed formats are not accepted', async () => {
    const response = await request(asset, { 'Accept-Encoding': 'identity' });
    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.headers.vary).toBe('Accept-Encoding');
    expect(response.body.toString()).toBe(source);
  });

  it('keeps HTML and unversioned assets revalidatable', async () => {
    const [html, worker] = await Promise.all([request('/'), request('/assets/worker.js')]);
    expect(html.headers['cache-control']).toBe('no-cache');
    expect(worker.headers['cache-control']).toBe('no-cache');
  });

  it('caches versioned images with their original content type', async () => {
    const response = await request('/assets/icon-abcdefgh.png');
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toContain('immutable');
  });

  it('returns 404 for a missing chunk rather than an HTML fallback', async () => {
    const response = await request('/assets/missing-abcdefgh.js');
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.length).toBe(0);
  });

  it('supports HEAD without transferring compressed content', async () => {
    const response = await request(asset, { 'Accept-Encoding': 'br' }, 'HEAD');
    expect(response.headers['content-encoding']).toBe('br');
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
    expect(response.body.length).toBe(0);
  });

  it('uses encoding-specific validators for conditional requests', async () => {
    const first = await request(asset, { 'Accept-Encoding': 'br' });
    const cached = await request(asset, { 'Accept-Encoding': 'br', 'If-None-Match': first.headers.etag! });
    const different = await request(asset, { 'Accept-Encoding': 'gzip', 'If-None-Match': first.headers.etag! });
    expect(cached.status).toBe(304);
    expect(cached.body.length).toBe(0);
    expect(different.status).toBe(200);
  });

  it('does not return compressed content for byte ranges', async () => {
    const response = await request(asset, { 'Accept-Encoding': 'br', Range: 'bytes=0-5' });
    expect(response.status).toBe(206);
    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.body.toString()).toBe(source.slice(0, 6));
  });
});

describe('compression negotiation', () => {
  it.each([
    [undefined, []],
    ['br;q=0, gzip;q=0', []],
    ['br;q=broken, gzip;q=2', []],
    ['br;q=0.1, gzip;q=1', ['gzip', 'br']],
    ['*;q=0.5, br;q=0', ['gzip']],
  ])('honors quality values in %s', (header, expected) => {
    expect(acceptedEncodings(header)).toEqual(expected);
  });
});
