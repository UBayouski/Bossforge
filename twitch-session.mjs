import { parseCommand } from './commands.mjs';

// One browser session owns its Twitch credentials, events, and reconnections.
export class TwitchSession {
  constructor({ clientId, fetchImpl = fetch, WebSocketImpl = WebSocket }) {
    Object.assign(this, { clientId, fetchImpl, WebSocketImpl });
    this.clients = new Set();
    this.timers = new Set();
    this.seen = new Set();
    this.generation = 0;
    this.lastSeen = Date.now();
    this.status = { connected: false, message: 'Playground · Twitch optional' };
  }
  broadcast(type, data) {
    for (const response of this.clients)
      if (!response.destroyed) response.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  setStatus(message, connected = false) {
    this.status = { message, connected };
    this.broadcast('status', this.status);
  }
  later(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    timer.unref?.();
    this.timers.add(timer);
    return timer;
  }
  async validate(token) {
    const response = await this.fetchImpl('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Invalid or expired Twitch token. Connect again.');
    const info = await response.json();
    if (info.client_id !== this.clientId || !info.scopes?.includes('user:read:chat'))
      throw new Error('Wrong Twitch app or missing chat permission.');
    return info;
  }
  async authorize(token) {
    if (!this.clientId)
      throw new Error(
        'Twitch is not configured on this server. The local simulation is available.',
      );
    if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{10,2048}$/.test(token))
      throw new Error('Invalid Twitch token.');
    // A later connect or disconnect must win over an earlier slow validation.
    this.disconnect();
    const run = this.generation,
      info = await this.validate(token);
    if (run !== this.generation) throw new Error('Connection request was superseded.');
    this.token = token;
    this.user = info;
    this.setStatus(`Connecting to ${info.login}…`);
    this.connect(undefined, false, run);
    this.scheduleValidation(run);
  }
  scheduleValidation(run) {
    this.later(
      async () => {
        if (run !== this.generation || !this.token) return;
        try {
          await this.validate(this.token);
          if (run === this.generation) this.scheduleValidation(run);
        } catch {
          if (run !== this.generation) return;
          this.disconnect();
          this.setStatus('Twitch authorization could not be validated. Connect again.');
        }
      },
      60 * 60 * 1000,
    );
  }
  async api(path, options = {}) {
    const response = await this.fetchImpl(`https://api.twitch.tv/helix/${path}`, {
      ...options,
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Client-Id': this.clientId,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const error = new Error(
        `Twitch API returned ${response.status}. Connect again if authorization expired.`,
      );
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  connect(url = 'wss://eventsub.wss.twitch.tv/ws', transferring = false, run = this.generation) {
    if (run !== this.generation || !this.token) return;
    const address = new URL(url);
    if (address.protocol !== 'wss:' || !address.hostname.endsWith('.twitch.tv'))
      throw new Error('Invalid Twitch reconnect address.');
    const previous = this.socket,
      ws = new this.WebSocketImpl(url);
    this.socket = ws;
    let watchdog;
    const heartbeat = (seconds = 30) => {
      clearTimeout(watchdog);
      this.timers.delete(watchdog);
      watchdog = this.later(() => ws.close(), (seconds + 5) * 1000);
    };
    ws.onmessage = async ({ data }) => {
      if (run !== this.generation || this.socket !== ws) return;
      try {
        const { metadata, payload } = JSON.parse(data);
        heartbeat(payload.session?.keepalive_timeout_seconds || 30);
        if (metadata.message_type === 'session_welcome') {
          if (transferring) previous?.close();
          else
            await this.api('eventsub/subscriptions', {
              method: 'POST',
              body: JSON.stringify({
                type: 'channel.chat.message',
                version: '1',
                condition: { broadcaster_user_id: this.user.user_id, user_id: this.user.user_id },
                transport: { method: 'websocket', session_id: payload.session.id },
              }),
            });
          if (run === this.generation && this.socket === ws)
            this.setStatus(`Connected to ${this.user.login}`, true);
        } else if (metadata.message_type === 'session_reconnect') {
          this.connect(payload.session.reconnect_url, true, run);
        } else if (metadata.message_type === 'revocation') {
          this.disconnect();
          this.setStatus('Twitch permission revoked. Connect again.');
        } else if (
          metadata.message_type === 'notification' &&
          metadata.subscription_type === 'channel.chat.message'
        ) {
          const event = payload.event;
          if (
            event.broadcaster_user_id !== this.user.user_id ||
            (event.source_broadcaster_user_id &&
              event.source_broadcaster_user_id !== this.user.user_id)
          )
            return;
          const command = parseCommand(event.message?.text || ''),
            id = event.message_id || metadata.message_id;
          if (!command || !id || this.seen.has(id)) return;
          this.seen.add(id);
          if (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value);
          this.broadcast('command', {
            command,
            id: event.chatter_user_id,
            name: event.chatter_user_name,
            source: 'twitch',
          });
        }
      } catch (error) {
        if (run !== this.generation || this.socket !== ws) return;
        if (error.status === 401 || error.status === 403) {
          this.disconnect();
          this.setStatus(error.message);
        } else {
          this.setStatus(error.message);
          ws.close();
        }
      }
    };
    ws.onclose = () => {
      clearTimeout(watchdog);
      this.timers.delete(watchdog);
      if (this.socket !== ws || run !== this.generation || !this.token) return;
      this.setStatus('Twitch disconnected · reconnecting…');
      this.later(() => this.connect(undefined, false, run), 5000);
    };
    ws.onerror = () => {
      if (run === this.generation && this.socket === ws) this.setStatus('Twitch connection error');
    };
    heartbeat();
  }
  disconnect() {
    this.generation++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.socket?.close();
    this.socket = null;
    this.token = null;
    this.user = null;
    this.seen.clear();
    this.setStatus('Playground · Twitch optional');
  }
  close() {
    this.disconnect();
    for (const response of this.clients) response.end();
    this.clients.clear();
  }
}
