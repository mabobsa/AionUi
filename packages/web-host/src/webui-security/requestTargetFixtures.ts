import net from 'node:net';

// Raw targets: fetch/URL clients would erase the dot segments before sending.
export const nonCanonicalTargets = [
  '/api/ppt-proxy/4176/x/../../../auth/status',
  '/api/assets/logos/../../../login',
  '/api/office-watch-proxy/5000/a/../../../auth/status?x=1',
  '/api/extensions/demo/assets/../../../../login',
  '/api/ppt-proxy/4176/x/%2e%2e/%2E%2E/%2e%2e/auth/status',
  '/api/assets/logos/.%2e/%2e./%2E%2e/login',
  '/api/office-watch-proxy/5000/a/..%2f..%2F../auth/status?x=1',
  '/api/assets/logos/..%5c..%5C../login',
  '/api/assets/logos/file%3F/../../../login',
  '/api/assets/logos/file%23/../../../login',
  '/api/assets/logos/%252e%252e/login',
  '/api/assets/logos/./file.svg',
  '/ws/../api/auth/status',
  '/api/stt/stream/../../auth/status',
  '/api/stt/stream%2f..%2f../auth/status',
  '/api/stt/stream%3fignored',
  '/api/stt/stream%23ignored',
];

export const rawRequest = (port: number, target: string, upgrade = false, cookie = ''): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(
        `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: http://127.0.0.1:${port}\r\n${cookie ? `Cookie: ${cookie}\r\n` : ''}${upgrade ? 'Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' : 'Connection: close\r\n'}\r\n`
      );
    });
    let response = '';
    socket.on('data', (data) => {
      response += data.toString();
    });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('Raw request timed out'));
    });
  });
