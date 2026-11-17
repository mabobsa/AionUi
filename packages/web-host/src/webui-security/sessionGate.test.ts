import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { startStaticServer, type StaticServerHandle } from '../static-server';

const fetch = (url: string, init?: RequestInit) =>
  globalThis.fetch(url, {
    ...init,
    headers: { Connection: 'close', ...init?.headers },
  });

describe('WebUI session boundary', () => {
  let backend: http.Server;
  let web: StaticServerHandle;
  let backendPort: number;
  let probeStatus: number;
  let calls: string[];
  let handled: number;
  beforeEach(async () => {
    probeStatus = 204;
    calls = [];
    handled = 0;
    backend = http.createServer((req, res) => {
      if (req.url === '/api/auth/webui-session') {
        const valid = req.headers.cookie === 'aionui-session=valid' || req.headers.authorization === 'Bearer valid';
        res.writeHead(valid ? probeStatus : 401).end();
        return;
      }
      calls.push(req.url ?? '');
      res.end('backend');
    });
    await new Promise<void>((resolve) => backend.listen(0, '127.0.0.1', resolve));
    backendPort = (backend.address() as AddressInfo).port;
    web = await startStaticServer({
      staticDir: '.',
      backendPort,
      port: 0,
      requestHandler: async (req, res) => {
        if (req.url === '/api/mobile-push') {
          handled++;
          res.end('push');
          return true;
        }
        return false;
      },
    });
  });
  afterEach(async () => {
    await web.stop();
    backend.closeAllConnections();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  });
  const raw = (port: number, request: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write(request));
      let result = '';
      socket.on('data', (data) => {
        result += data.toString();
      });
      socket.on('end', () => resolve(result));
      socket.on('error', reject);
      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(new Error('timeout'));
      });
    });

  it.each(['/api/conversations', '/api/fs/read', '/api/mobile-push', '/api/ws-token', '/api/auth/user'])(
    'rejects anonymous %s before dispatch',
    async (path) => {
      expect((await fetch(web.localUrl + path)).status).toBe(401);
      expect(calls).toEqual([]);
      expect(handled).toBe(0);
    }
  );
  it.each(['/api/conversations', '/api/conversations/id/messages', '/api/conversations/id/confirm', '/api/fs/write'])(
    'rejects anonymous writes to %s',
    async (path) => {
      expect((await fetch(web.localUrl + path, { method: 'POST', headers: { Origin: web.localUrl } })).status).toBe(
        401
      );
      expect(calls).toEqual([]);
    }
  );
  it.each(['reset-password', 'change-password', 'change-username', 'generate-qr-token'])(
    'blocks desktop administration %s even after login',
    async (name) => {
      expect(
        (
          await fetch(`${web.localUrl}/api/webui/${name}`, {
            method: 'POST',
            headers: { Origin: web.localUrl, Cookie: 'aionui-session=valid' },
          })
        ).status
      ).toBe(403);
      expect(calls).toEqual([]);
    }
  );
  it.each([
    '/api/internal/session-messages/remote',
    '/api/internal/conversation-runtimes/active',
    '/api/auth/internal/users',
    '/api/cron/internal/system-resume',
    '/api/%69nternal/test',
    '/api/webui/%72eset-password',
  ])('blocks internal and encoded routes %s', async (path) => {
    expect((await fetch(web.localUrl + path, { headers: { Cookie: 'aionui-session=valid' } })).status).toBe(403);
    expect(calls).toEqual([]);
  });
  it.each([
    ['POST', '/login'],
    ['POST', '/logout'],
    ['POST', '/api/auth/qr-login'],
    ['POST', '/api/auth/refresh'],
    ['GET', '/api/auth/status'],
  ])('forwards the explicit login exception %s %s', async (method, path) => {
    expect((await fetch(web.localUrl + path, { method, headers: { Origin: web.localUrl } })).status).toBe(200);
    expect(calls).toEqual([path]);
  });
  it('does not exempt unknown auth paths or methods', async () => {
    expect(
      (await fetch(web.localUrl + '/api/auth/status', { method: 'POST', headers: { Origin: web.localUrl } })).status
    ).toBe(401);
    expect((await fetch(web.localUrl + '/api/auth/future')).status).toBe(401);
  });
  it('allows logged-in API, navigation and desktop push handlers', async () => {
    for (const path of [
      '/api/conversations',
      '/api/integrations/mindnprogress/conversations/id/navigation',
      '/api/mobile-push',
    ]) {
      expect(
        (
          await fetch(web.localUrl + path, {
            method: 'POST',
            headers: { Origin: web.localUrl, Cookie: 'aionui-session=valid' },
            body: '{}',
          })
        ).status
      ).toBe(200);
    }
    expect(handled).toBe(1);
  });
  it('rejects cross-origin and missing-origin cookie writes including runtime-token spoofing', async () => {
    for (const origin of [undefined, 'http://evil.test', 'null']) {
      expect(
        (
          await fetch(web.localUrl + '/api/conversations', {
            method: 'POST',
            headers: {
              Cookie: 'aionui-session=valid',
              'x-aionui-runtime-token': 'forged',
              ...(origin ? { Origin: origin } : {}),
            },
          })
        ).status
      ).toBe(403);
    }
    expect(calls).toEqual([]);
  });
  it.each([200, 404, 500])('fails closed if Core returns %s instead of the verification contract', async (status) => {
    probeStatus = status;
    expect(
      (await fetch(web.localUrl + '/api/conversations', { headers: { Cookie: 'aionui-session=valid' } })).status
    ).toBe(502);
    expect(calls).toEqual([]);
  });
  it('checks every request on a persistent HTTP connection', async () => {
    const reply = await raw(
      web.port,
      `GET /api/conversations HTTP/1.1\r\nHost: localhost\r\nCookie: aionui-session=valid\r\n\r\nGET /api/fs/read HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`
    );
    expect(reply).toContain('401');
    expect(calls).toEqual(['/api/conversations']);
  });
  it.each(['/ws', '/api/stt/stream'])('rejects anonymous upgrade %s and its pipelined payload', async (path) => {
    const reply = await raw(
      web.port,
      `GET ${path} HTTP/1.1\r\nHost: localhost\r\nOrigin: http://localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nGET /api/internal/test HTTP/1.1\r\nHost: localhost\r\n\r\n`
    );
    expect(reply).toContain('401');
    expect(calls).toEqual([]);
  });
  it('never forwards pipelined HTTP after a rejected authenticated upgrade', async () => {
    const reply = await raw(
      web.port,
      `GET /ws HTTP/1.1\r\nHost: localhost\r\nOrigin: http://localhost\r\nCookie: aionui-session=valid\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nGET /api/internal/test HTTP/1.1\r\nHost: localhost\r\n\r\n`
    );
    expect(reply).toContain('502');
    expect(calls).toEqual(['/ws']);
  });
  it('leaves direct loopback backend requests unchanged', async () => {
    expect((await fetch(`http://127.0.0.1:${backendPort}/api/internal/test`)).status).toBe(200);
  });
});
