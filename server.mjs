import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { TwitchSession } from './twitch-session.mjs';

const cookieName = 'boss_session';
const sessionLifetime = 6 * 60 * 60 * 1000;

export function createApp({
  port = Number(process.env.PORT || 3000),
  publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '',
  host = process.env.HOST || (publicUrl ? '0.0.0.0' : '127.0.0.1'),
  clientId = process.env.TWITCH_CLIENT_ID || '',
  fetchImpl = fetch, WebSocketImpl = WebSocket, maxSessions = 500,
} = {}) {
  let origin = publicUrl ? new URL(publicUrl).origin : `http://localhost:${port}`;
  if (publicUrl) {
    const url = new URL(publicUrl);
    if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('PUBLIC_URL must be a plain origin, such as https://boss.example.com.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) throw new Error('A public deployment requires an HTTPS PUBLIC_URL.');
  }
  const sessions = new Map();
  function prune() {
    for (const [id, session] of sessions) {
      if (Date.now() - session.lastSeen > sessionLifetime) { session.close(); sessions.delete(id); }
    }
  }
  const cleanup = setInterval(prune, 60000); cleanup.unref();
  const json = (response, code, data) => {
    response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
  };
  function getSession(request, response) {
    const supplied = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    let session = sessions.get(supplied);
    if (!session) {
      prune();
      if (sessions.size >= maxSessions) return null;
      const id = randomBytes(32).toString('hex');
      session = new TwitchSession({ clientId, fetchImpl, WebSocketImpl }); sessions.set(id, session);
      response.setHeader('Set-Cookie', `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Lax${origin.startsWith('https:') ? '; Secure' : ''}`);
    }
    session.lastSeen = Date.now(); return session;
  }
  async function body(request) {
    let result = '';
    for await (const chunk of request) { result += chunk; if (Buffer.byteLength(result) > 16000) throw new Error('Request too large'); }
    const value = JSON.parse(result || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
    return value;
  }
  const staticFiles = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/stream.css': 'stream.css', '/favicon.svg': 'favicon.svg' };
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const path = new URL(request.url, origin).pathname;
      // Render health probes may use an internal Host header.
      if (path === '/health' && (request.method === 'GET' || request.method === 'HEAD')) { json(response, 200, { ok: true }); return; }
      if (request.headers.host !== new URL(origin).host) { json(response, 421, { error: `Open ${origin} to use this app.` }); return; }
      if (request.method === 'POST') {
        if (request.headers.origin !== origin || !request.headers['content-type']?.startsWith('application/json')) { json(response, 403, { error: 'Origin or content type not allowed' }); return; }
        if (!['/api/connect', '/api/disconnect'].includes(path)) { json(response, 404, { error: 'Not found' }); return; }
        const data = await body(request), session = getSession(request, response);
        if (!session) { json(response, 503, { error: 'The server is busy. Please try again later.' }); return; }
        if (path === '/api/connect') await session.authorize(data.token);
        else session.disconnect();
        json(response, 200, {}); return;
      }
      if (request.method !== 'GET') { json(response, 405, { error: 'Method not allowed' }); return; }
      if (path === '/api/config') { json(response, 200, { clientId, redirectUri: origin }); return; }
      if (path === '/api/events') {
        const session = getSession(request, response);
        if (!session) { json(response, 503, { error: 'The server is busy. Please try again later.' }); return; }
        if (session.clients.size >= 4) { json(response, 429, { error: 'Too many game tabs. Close another tab and retry.' }); return; }
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        session.clients.add(response);
        response.write(`event: status\ndata: ${JSON.stringify(session.status)}\n\n`);
        const timer = setInterval(() => { session.lastSeen = Date.now(); response.write(': ping\n\n'); }, 15000);
        timer.unref();
        response.on('close', () => { session.clients.delete(response); clearInterval(timer); }); return;
      }
      const file = staticFiles[path];
      if (!file) { json(response, 404, { error: 'Not found' }); return; }
      const contents = await readFile(new URL(`./public/${file}`, import.meta.url));
      const type = { js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', html: 'text/html; charset=utf-8' }[file.split('.').pop()];
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(contents);
    } catch (error) { json(response, 400, { error: error.message }); }
  });
  return { server, sessions, get origin() { return origin; },
    async listen() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      if (!publicUrl) origin = `http://localhost:${server.address().port}`;
      return origin;
    },
    async close() {
      clearInterval(cleanup);
      for (const session of sessions.values()) session.close();
      sessions.clear();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createApp();
  console.log(`Chat Builds the Boss → ${await app.listen()}`);
  const shutdown = () => { app.close().then(() => process.exit(0)); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
