import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';
import { TwitchSession } from '../twitch-session.mjs';

function fixtures() {
  const sockets = [], calls = [];
  class Socket {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.onclose?.(); }
    emit(type, payload, subscription) {
      return this.onmessage({ data: JSON.stringify({ metadata: { message_type: type, subscription_type: subscription }, payload }) });
    }
  }
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/validate')) {
      const owner = options.headers.Authorization.includes('owner-a-token') ? 'a' : 'b';
      return { ok: true, json: async () => ({ client_id: 'app-id', scopes: ['user:read:chat'], user_id: owner, login: `channel_${owner}` }) };
    }
    return { ok: true, status: 202, json: async () => ({ data: [] }) };
  };
  return { fetchImpl, WebSocketImpl: Socket, sockets, calls };
}

test('browsers have isolated Twitch credentials, notifications, and disconnects', async t => {
  const dependencies = fixtures();
  const app = createApp({ port: 0, clientId: 'app-id', ...dependencies });
  const origin = await app.listen();
  t.after(() => app.close());
  const post = async (path, body, cookie) => {
    const response = await fetch(origin + path, { method: 'POST', headers: {
      Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}),
    }, body: JSON.stringify(body) });
    const data = await response.json();
    return { response, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const first = await post('/api/connect', { token: 'owner-a-token' });
  const second = await post('/api/connect', { token: 'owner-b-token' });
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.notEqual(first.cookie, second.cookie);
  assert.ok(first.response.headers.get('set-cookie').includes('HttpOnly'));
  assert.ok(first.response.headers.get('set-cookie').includes('SameSite=Lax'));
  const [sessionA, sessionB] = app.sessions.values();
  assert.equal(sessionA.user.user_id, 'a');
  assert.equal(sessionB.user.user_id, 'b');
  const writesA = [], writesB = [];
  sessionA.clients.add({ write: value => writesA.push(value), end() {} });
  sessionB.clients.add({ write: value => writesB.push(value), end() {} });
  await dependencies.sockets[0].emit('session_welcome', { session: { id: 'a-socket' } });
  await dependencies.sockets[1].emit('session_welcome', { session: { id: 'b-socket' } });
  const event = { broadcaster_user_id: 'a', message_id: 'message-one', chatter_user_id: 'viewer', chatter_user_name: 'Viewer', message: { text: '!armor' } };
  await dependencies.sockets[0].emit('notification', { event }, 'channel.chat.message');
  await dependencies.sockets[0].emit('notification', { event }, 'channel.chat.message');
  assert.equal(writesA.filter(value => value.includes('event: command')).length, 1);
  assert.equal(writesB.filter(value => value.includes('event: command')).length, 0);
  await dependencies.sockets[0].emit('notification', { event: { ...event, message_id: 'shared', source_broadcaster_user_id: 'b' } }, 'channel.chat.message');
  assert.equal(writesA.filter(value => value.includes('event: command')).length, 1);
  await post('/api/disconnect', {}, second.cookie);
  assert.equal(sessionB.token, null);
  assert.equal(sessionA.token, 'owner-a-token');
  await post('/api/disconnect', {}, 'boss_session=unknown-id');
  assert.equal(sessionA.token, 'owner-a-token');
  assert.equal((await post('/api/disconnect', {}, first.cookie)).response.status, 200);
  assert.equal(sessionA.token, null);
});

test('HTTP assets and SSE remain available without Twitch; origin and payload checks reject bad requests', async t => {
  const app = createApp({ port: 0, clientId: '' });
  const origin = await app.listen();
  t.after(() => app.close());
  for (const path of ['/', '/app.js', '/style.css', '/stream.css', '/favicon.svg', '/health']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path); await response.text();
  }
  assert.equal(app.sessions.size, 0);
  const config = await (await fetch(origin + '/api/config')).json();
  assert.equal(config.redirectUri, origin);
  assert.equal(config.clientId, '');
  const controller = new AbortController();
  const stream = await fetch(origin + '/api/events', { signal: controller.signal });
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  assert.ok(stream.headers.get('set-cookie').includes('boss_session='));
  const reader = stream.body.getReader();
  const frame = new TextDecoder().decode((await reader.read()).value);
  assert.ok(frame.includes('"connected":false'));
  await reader.cancel(); controller.abort();
  const post = (headers, body) => fetch(origin + '/api/connect', { method: 'POST', headers, body });
  let response = await post({ Origin: 'https://other.example', 'Content-Type': 'application/json' }, '{}');
  assert.equal(response.status, 403); await response.json();
  response = await post({ Origin: origin, 'Content-Type': 'text/plain' }, '{}');
  assert.equal(response.status, 403); await response.json();
  response = await post({ Origin: origin, 'Content-Type': 'application/json' }, '[]');
  assert.equal(response.status, 400); await response.json();
  response = await post({ Origin: origin, 'Content-Type': 'application/json' }, JSON.stringify({ token: 'x'.repeat(17000) }));
  assert.equal(response.status, 400); await response.json();
});

test('production uses the configured HTTPS origin and secure cookies instead of request forwarding headers', async t => {
  const app = createApp({ port: 0, host: '127.0.0.1', publicUrl: 'https://boss.example' });
  await app.listen();
  t.after(() => app.close());
  const address = `http://127.0.0.1:${app.server.address().port}`;
  // Use node:http so the test can deliberately set Host (fetch reserves it).
  const send = (path, options = {}) => new Promise((resolve, reject) => {
    const request = httpRequest(address + path, options, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, data: JSON.parse(body) }));
    });
    request.on('error', reject); request.end(options.method === 'POST' ? '{}' : undefined);
  });
  let response = await send('/api/config', { headers: { Host: 'boss.example', 'X-Forwarded-Host': 'attacker.example' } });
  assert.equal(response.data.redirectUri, 'https://boss.example');
  response = await send('/api/disconnect', { method: 'POST', headers: {
    Host: 'boss.example', Origin: 'https://boss.example', 'Content-Type': 'application/json',
  } });
  assert.equal(response.status, 200);
  assert.ok(response.headers['set-cookie'][0].includes('; Secure'));
  response = await send('/', { headers: { Host: 'attacker.example' } });
  assert.equal(response.status, 421);
  response = await send('/health');
  assert.equal(response.status, 200);
  assert.throws(() => createApp({ publicUrl: 'http://public.example' }), /HTTPS/);
  assert.throws(() => createApp({ publicUrl: 'https://boss.example/path' }), /plain origin/);
});

test('session capacity is bounded while health and config remain usable', async t => {
  const app = createApp({ port: 0, maxSessions: 1 });
  const origin = await app.listen();
  t.after(() => app.close());
  const send = () => fetch(origin + '/api/disconnect', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  let response = await send(); assert.equal(response.status, 200); await response.json();
  response = await send(); assert.equal(response.status, 503); await response.json();
  response = await fetch(origin + '/health'); assert.equal(response.status, 200); await response.json();
  response = await fetch(origin + '/api/config'); assert.equal(response.status, 200); await response.json();
});

test('an in-flight token validation cannot undo a newer disconnect', async () => {
  let finish;
  const session = new TwitchSession({ clientId: 'app-id', fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  const connection = session.authorize('owner-a-token');
  session.disconnect();
  finish({ ok: true, json: async () => ({ client_id: 'app-id', scopes: ['user:read:chat'], user_id: 'a' }) });
  await assert.rejects(connection, /superseded/);
  assert.equal(session.token, null);
  session.close();
});

test('revoked subscriptions remove credentials and stop reconnect timers', async () => {
  const dependencies = fixtures();
  const session = new TwitchSession({ clientId: 'app-id', ...dependencies });
  await session.authorize('owner-a-token');
  await dependencies.sockets[0].emit('revocation', {});
  assert.equal(session.token, null);
  assert.equal(session.status.connected, false);
  assert.equal(session.timers.size, 0);
  assert.match(session.status.message, /revoked/);
  session.close();
});
