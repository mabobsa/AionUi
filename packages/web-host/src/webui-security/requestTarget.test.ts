import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startStaticServer, type StaticServerHandle } from '../static-server';
import { nonCanonicalTargets, rawRequest } from './requestTargetFixtures';

describe.each([false, true])('request target boundary (development frontend: %s)', (development) => {
  let backend: http.Server;
  let web: StaticServerHandle;
  let calls: string[];
  beforeEach(async () => {
    calls = [];
    backend = http.createServer((req, res) => {
      calls.push(req.url!);
      res.end(req.url);
    });
    backend.on('upgrade', (req, socket) => {
      calls.push(req.url!);
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    });
    await new Promise<void>((resolve) => backend.listen(0, '127.0.0.1', resolve));
    const port = (backend.address() as { port: number }).port;
    // A shared observation server proves that neither routing destination was reached.
    web = await startStaticServer({
      staticDir: '.',
      backendPort: port,
      port: 0,
      ...(development ? { frontendUrl: `http://127.0.0.1:${port}` } : {}),
    });
  });
  afterEach(async () => {
    await web.stop();
    backend.closeAllConnections();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  });
  it.each(nonCanonicalTargets)('rejects the raw HTTP target %s before forwarding', async (target) => {
    expect(await rawRequest(web.port, target)).toMatch(/^HTTP\/1\.1 400 /);
    expect(calls).toEqual([]);
  });
  it.each(nonCanonicalTargets)('rejects the raw upgrade target %s before forwarding', async (target) => {
    expect(await rawRequest(web.port, target, true)).toMatch(/^HTTP\/1\.1 400 /);
    expect(calls).toEqual([]);
  });
  it('preserves the canonical public path and query bytes', async () => {
    const target = '/api/auth/status?next=..%2f..%2Flogin&literal=%2e%2e&x=1&x=2';
    expect(await rawRequest(web.port, target)).toMatch(/^HTTP\/1\.1 200 /);
    expect(calls).toEqual([target]);
  });
});
