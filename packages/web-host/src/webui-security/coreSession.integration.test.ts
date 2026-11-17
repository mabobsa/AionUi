import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startStaticServer, type StaticServerHandle } from '../static-server';
import WebSocket from 'ws';
import { nonCanonicalTargets, rawRequest } from './requestTargetFixtures';

const waitPort = (child: ChildProcessWithoutNullStreams): Promise<number> =>
  new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', (data) => {
      output += String(data);
      const match = /PORT=(\d+)/.exec(output);
      if (match) resolve(Number(match[1]));
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`Fixture exited: ${code}`)));
  });
const stop = async (child?: ChildProcessWithoutNullStreams): Promise<void> => {
  if (child && child.exitCode === null) {
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.stdin.end('\n');
    });
  }
};

// Build AionCore's webui_session_fixture example, then set this absolute path.
describe.skipIf(!process.env.AIONUI_WEBUI_AUTH_FIXTURE).each(['node', 'bun'])(
  'real Core sessions through %s WebUI',
  (runtime) => {
    let core: ChildProcessWithoutNullStreams;
    let bunHost: ChildProcessWithoutNullStreams | undefined;
    let web: StaticServerHandle;
    let direct: string;
    let cookie = '';
    let refreshCookie = '';
    beforeAll(async () => {
      core = spawn(process.env.AIONUI_WEBUI_AUTH_FIXTURE!, [], { windowsHide: true });
      const port = await waitPort(core);
      direct = `http://127.0.0.1:${port}`;
      if (runtime === 'node') {
        web = await startStaticServer({ staticDir: '.', backendPort: port, port: 0 });
      } else {
        // Exercise Bun's real socket implementation in a separate owned process.
        const script = `import { startStaticServer } from './packages/web-host/src/static-server.ts';
        const host = await startStaticServer({staticDir: '.', backendPort: ${port}, port: 0});
        console.log('PORT=' + host.port);
        const stop = async () => { await host.stop(); process.exit(0); };
        process.stdin.once('data', stop);
        process.stdin.once('end', stop);`;
        bunHost = spawn('bun', ['-e', script], { windowsHide: true });
        const publicPort = await waitPort(bunHost);
        web = { port: publicPort, localUrl: `http://127.0.0.1:${publicPort}`, url: '', stop: () => stop(bunHost) };
      }
    }, 20000);
    afterAll(async () => {
      await web?.stop();
      await stop(core);
    });
    const post = (base: string, path: string, body: unknown, session = '') =>
      fetch(base + path, {
        method: 'POST',
        headers: { Origin: base, Cookie: session, 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify(body),
      });
    it('rejects anonymous API and accepts the password login session', async () => {
      expect((await fetch(web.localUrl + '/api/auth/user', { headers: { Connection: 'close' } })).status).toBe(401);
      const login = await post(web.localUrl, '/login', { username: 'admin', password: 'TestPassword123!' });
      expect(login.status).toBe(200);
      const cookies = login.headers.getSetCookie();
      cookie = cookies.find((value) => value.startsWith('aionui-session='))!.split(';')[0];
      refreshCookie = cookies.find((value) => value.startsWith('aionui-refresh='))!.split(';')[0];
      expect(
        (await fetch(web.localUrl + '/api/auth/user', { headers: { Cookie: cookie, Connection: 'close' } })).status
      ).toBe(200);
    });
    it('refreshes through the public exception without a valid access cookie', async () => {
      expect((await post(web.localUrl, '/api/auth/refresh', {}, refreshCookie)).status).toBe(200);
    });
    it('allows desktop QR issuance, blocks WebUI issuance, and accepts QR login', async () => {
      expect((await post(web.localUrl, '/api/webui/generate-qr-token', {}, cookie)).status).toBe(403);
      const issued = await post(direct, '/api/webui/generate-qr-token', {});
      expect(issued.status).toBe(200);
      const data = (await issued.json()) as { data: { token: string } };
      expect((await post(web.localUrl, '/api/auth/qr-login', { qr_token: data.data.token })).status).toBe(200);
    });
    it.each(['/ws', '/api/stt/stream'])('relays authenticated upgrade and frames at %s', async (path) => {
      const reply = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(web.localUrl.replace('http:', 'ws:') + path, {
          headers: { Cookie: cookie, Origin: web.localUrl },
        });
        socket.on('open', () => socket.send('probe'));
        socket.on('message', (data) => {
          resolve(data.toString());
          socket.close();
        });
        socket.on('error', reject);
      });
      expect(reply).toBe('probe');
    });
    it.each(nonCanonicalTargets.filter((target) => !target.startsWith('/ws') && !target.startsWith('/api/stt/')))(
      'blocks raw wildcard target %s which Axum would accept',
      async (target) => {
        const directPort = Number(new URL(direct).port);
        // Establish the backend behavior first: Axum does NOT collapse this tail.
        expect(await rawRequest(directPort, target)).toMatch(/^HTTP\/1\.1 200 /);
        const hits = () =>
          fetch(direct + '/fixture/wildcard-hits', { headers: { Connection: 'close' } }).then((r) => r.text());
        const before = await hits();
        const replies = await Promise.all([rawRequest(web.port, target), rawRequest(web.port, target, true)]);
        expect(replies.every((reply) => reply.startsWith('HTTP/1.1 400 '))).toBe(true);
        expect(await hits()).toBe(before);
      }
    );
    it('preserves a canonical encoded asset path and query after authentication', async () => {
      const target = '/api/assets/logos/%ED%95%9C%EA%B8%80.svg?next=..%2f..%2Flogin&x=1&x=2';
      const response = await rawRequest(web.port, target, false, cookie);
      expect(response).toMatch(/^HTTP\/1\.1 200 /);
      expect(response).toContain(target);
    });
  }
);
