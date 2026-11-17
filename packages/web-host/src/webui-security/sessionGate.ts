import http, { type IncomingHttpHeaders } from 'node:http';

const PUBLIC_ROUTES = new Set([
  'POST /login',
  'POST /logout',
  'GET /api/auth/status',
  'POST /api/auth/qr-login',
  'POST /api/auth/refresh',
]);

/** Validate the raw origin-form path without URL normalization. Return the exact
 * path bytes forwarded to Core; decoding is only used to reject ambiguous segments.
 * In particular, a wildcard tail must never collapse into a public auth route.
 */
export function requestPath(raw: string): string {
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('#')) {
    throw new Error('Invalid request target');
  }
  const pathname = raw.split('?', 1)[0];
  for (const segment of pathname.split('/')) {
    const decoded = decodeURIComponent(segment);
    if (
      decoded === '.' ||
      decoded === '..' ||
      /[\\/%?#]/.test(decoded) ||
      [...decoded].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
    ) {
      throw new Error('Invalid path');
    }
  }
  return pathname;
}

/** Browser writes and upgrades must originate at this WebUI, including its port.
 * The current renderer has no Core double-submit token support. Origin checking
 * protects cookie-authenticated writes without changing the desktop transport.
 */
export function validOrigin(headers: IncomingHttpHeaders, required: boolean): boolean {
  const origin = headers.origin;
  if (!origin) return !required || !!headers.authorization;
  return origin === `http://${headers.host}`;
}

/** Ask Core to verify the existing access JWT, active user and session generation.
 * Never forward runtime/helper credentials or trust an arbitrary 2xx response.
 */
export function verifySession(headers: IncomingHttpHeaders, backendPort: number): Promise<number> {
  return new Promise((resolve) => {
    const credentials: IncomingHttpHeaders = {};
    if (headers.cookie) credentials.cookie = headers.cookie;
    if (headers.authorization) credentials.authorization = headers.authorization;
    const probe = http.request(
      {
        hostname: '127.0.0.1',
        port: backendPort,
        path: '/api/auth/webui-session',
        method: 'GET',
        headers: credentials,
        agent: false,
      },
      (response) => {
        response.resume();
        const status = response.statusCode;
        resolve(status === 204 ? 204 : status === 401 || status === 403 ? status : 502);
      }
    );
    probe.setTimeout(5000, () => probe.destroy(new Error('Session verification timeout')));
    probe.on('error', () => resolve(502));
    probe.end();
  });
}

/** Returns zero to allow the request, otherwise an HTTP rejection status. */
export async function authorizeRequest(
  method: string,
  pathname: string,
  headers: IncomingHttpHeaders,
  backendPort: number
): Promise<number> {
  // No browser exceptions for internal routes. Includes auth/cron internal APIs.
  // Decode only for conservative denial, never to select a public exception.
  const deniedPath = decodeURIComponent(pathname);
  if (
    deniedPath.split('/').includes('internal') ||
    deniedPath === '/api/webui' ||
    deniedPath.startsWith('/api/webui/')
  ) {
    return 403;
  }
  const protectedPath = pathname === '/api' || pathname.startsWith('/api/') || pathname === '/ws';
  const publicRoute = PUBLIC_ROUTES.has(`${method} ${pathname}`);
  if (!protectedPath && !publicRoute) return 0;
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (!validOrigin(headers, unsafe)) return 403;
  if (publicRoute) return 0;
  const status = await verifySession(headers, backendPort);
  return status === 204 ? 0 : status;
}
