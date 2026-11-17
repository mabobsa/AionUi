import type { IncomingHttpHeaders } from 'node:http';
import net, { type Socket } from 'node:net';
import { authorizeRequest, requestPath, validOrigin } from './sessionGate';

/** Authorize a raw upgrade without using Bun's broken inbound upgrade socket.
 * Only the parsed handshake is sent upstream. Buffered client bytes are released
 * AFTER 101, preventing HTTP pipelining into the Local backend after a failed WS.
 */
export async function forwardUpgrade(client: Socket, bytes: Buffer, backendPort: number): Promise<void> {
  client.pause();
  client.on('error', () => client.destroy());
  const reject = (status: number): void => {
    client.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, () => client.destroy());
  };
  try {
    const end = bytes.indexOf('\r\n\r\n');
    if (end < 0) return reject(400);
    const lines = bytes.subarray(0, end).toString('latin1').split('\r\n');
    const requestLine = lines.shift() ?? '';
    const match = /^GET (\S+) HTTP\/1\.1$/.exec(requestLine);
    if (!match) return reject(400);
    const headers: IncomingHttpHeaders = {};
    for (const line of lines) {
      const header = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+):[ \t]*(.*)$/.exec(line);
      if (!header || headers[header[1].toLowerCase()] !== undefined) return reject(400);
      headers[header[1].toLowerCase()] = header[2].trim();
    }
    const pathname = requestPath(match[1]);
    if (!['/ws', '/api/stt/stream'].includes(pathname)) return reject(403);
    if (headers.upgrade?.toLowerCase() !== 'websocket' || headers['content-length'] || headers['transfer-encoding']) {
      return reject(400);
    }
    if (!validOrigin(headers, true)) return reject(403);
    const denied = await authorizeRequest('GET', pathname, headers, backendPort);
    if (denied) return reject(denied);
    if (client.destroyed) return;
    const upstream = net.connect({ host: '127.0.0.1', port: backendPort });
    let response = Buffer.alloc(0);
    let upgraded = false;
    const close = (): void => {
      client.destroy();
      upstream.destroy();
    };
    upstream.setTimeout(5000, () => {
      reject(502);
      upstream.destroy();
    });
    upstream.on('error', () => {
      if (upgraded) close();
      else {
        reject(502);
        upstream.destroy();
      }
    });
    upstream.on('close', () => {
      if (upgraded || !client.writableEnded) client.destroy();
    });
    client.once('close', () => upstream.destroy());
    // The Local backend accepts only a loopback Host and the app's own origins.
    // This gate already authorized the browser, so hand over as a local client.
    const localHandshake = Buffer.from(
      [
        requestLine,
        `Host: 127.0.0.1:${backendPort}`,
        ...lines.filter((line) => !/^(?:host|origin):/i.test(line)),
        '',
        '',
      ].join('\r\n'),
      'latin1'
    );
    upstream.once('connect', () => upstream.write(localHandshake));
    const handshake = (chunk: Buffer): void => {
      response = Buffer.concat([response, chunk]);
      const headerEnd = response.indexOf('\r\n\r\n');
      if (headerEnd < 0 && response.length <= 16384) return;
      upstream.removeListener('data', handshake);
      const status = /^HTTP\/1\.[01] (\d{3}) /.exec(response.toString('latin1'))?.[1];
      if (headerEnd < 0 || headerEnd > 16384 || status !== '101') {
        reject(status && Number(status) >= 400 ? Number(status) : 502);
        upstream.destroy();
        return;
      }
      upstream.setTimeout(0);
      upgraded = true;
      client.write(response);
      if (bytes.length > end + 4) upstream.write(bytes.subarray(end + 4));
      upstream.pipe(client);
      client.pipe(upstream);
    };
    upstream.on('data', handshake);
  } catch {
    reject(400);
  }
}
