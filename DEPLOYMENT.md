# Deploy Bossforge on Render

The game and Node server deploy together as one **Web Service**. A static site alone does not run the Twitch adapter.

## Current deployment

- Live URL: **https://bossforge.onrender.com/**
- Verified October 31, 2026 in Chrome: the game page loads, `/health` returns `{"ok":true}`, and `/api/config` has a configured Client ID with redirect `https://bossforge.onrender.com`.
- User confirmed hosted Twitch authorization works after registering `https://bossforge.onrender.com` without a trailing slash.
- User confirmed a real `!armor` contribution works on the hosted game, completing the deployed chat-to-game check.
- Remaining live checks: hosted combat and separate-browser isolation.

## Prepared configuration

- Node.js **24.18.0** is pinned in `.node-version`.
- `render.yaml` runs `npm test && npm run check`, starts `node server.mjs`, and probes `/health`.
- The server binds to Render's `PORT` on `0.0.0.0`.
- `RENDER_EXTERNAL_URL` supplies the canonical HTTPS origin and Twitch OAuth redirect automatically. `PUBLIC_URL` can override this for a custom domain.
- Browser sessions have separate Twitch credentials, connections, statuses, and contribution feeds. Session cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS.
- Credentials stay in memory; no database or persistent disk is required. Restarting or deploying clears Twitch connections; visitors reconnect. Game state stays in each browser tab until reload.
- Inactive server sessions expire after six hours. Open game event streams keep their sessions active. The server caps sessions at 500 and event streams at four per browser session.
- Tokens are checked on connection and hourly. Revocation stops the session and its reconnect timers.
- The Blueprint explicitly starts on **Free** and disables automatic deployments. Review the selected plan before creating the service. An always-on paid instance is preferable for predictable judge access if you approve the cost.

## Publish the code

Publish **the contents of `boss/` as the repository root**. A separate Git repository has been initialized in this folder. Include `public/`, `test/`, `server.mjs`, `twitch-session.mjs`, `commands.mjs`, `package.json`, `.node-version`, `render.yaml`, and the docs. `.env`, `.layout-check/`, and `release/` are ignored; `.env.example` is generic.

Review the staged files before pushing. Do not upload Twitch access tokens, `.env`, or local credentials. The Twitch Client ID is public app metadata, but configure its value through Render rather than hardcoding it.

If you instead publish a parent repository containing both `boss/` and `supra/`, use the manual service setup below with Root Directory `boss`. For a Blueprint, select `boss/render.yaml` and add `rootDir: boss` to its service definition.

## Create the service

**Blueprint path:** connect the Boss repository in Render and select its `render.yaml`. Supply `TWITCH_CLIENT_ID` when prompted. Review the proposed service and plan, then create it.

**Manual path:** choose **New → Web Service**, connect the repository, and use:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root Directory | Empty for a Boss-only repository; `boss` for a parent repository |
| Build Command | `npm test && npm run check` |
| Start Command | `node server.mjs` |
| Health Check Path | `/health` |
| Instance count | 1 |
| Automatic deploys | Off |
| Environment: `TWITCH_CLIENT_ID` | The existing Boss application's Client ID |
| Environment: `HOST` | `0.0.0.0` |
| Environment: `NODE_ENV` | `production` |

Do not set `PORT` manually on Render. Do not add a Twitch client secret; this app uses the implicit user authorization flow.

Wait for the deployment to become healthy and record the actual assigned HTTPS URL. Do not assume the service name is available or invent the URL.

## Update Twitch after the URL is known

In the **Bossforge** application at the Twitch developer console, add the exact HTTPS origin reported by `<deployed-url>/api/config` as `redirectUri`. Preserve `http://localhost:3000` for local development. Keep While You Were AFK's separate application unchanged.

For example, if config reports `https://your-assigned-name.onrender.com`, register that exact value. The app uses an origin without a trailing slash. If using a custom domain, set `PUBLIC_URL` to that HTTPS origin, redeploy, and register its exact redirect value.

## Verify the hosted service

1. Open `/health`; expect `{ "ok": true }`.
2. Open the game in a fresh browser. Start a simulated round, then fight, pause/resume, enable sound, and test Stream view and fullscreen.
3. Open `/api/config` and verify the Client ID is configured and the redirect points to the actual hosted origin.
4. Connect your broadcaster account and send a real contribution. Confirm simulation switches off and the viewer name and boss update.
5. Open a separate private browser/profile and confirm it initially has no Twitch connection. Connecting or disconnecting that browser must not affect the first one.
6. Test a fresh checkout using the README. Verify the repository and video links are accessible to judges.
7. Record the deployed URL and submitted commit. Keep automatic deployments off after submission; preserve the judged revision.

## Runtime limits

Keep **one Node process / one instance**. Session state is in memory; scaling to multiple processes requires shared session routing/storage and a coordinated Twitch adapter.

Tabs in the same browser share the Twitch connection, while game state is local to each tab. Use one game tab during a live round. Separate visitors use separate browser sessions; a shared computer/profile is one browser session.

Render Free services can sleep after 15 idle minutes and take approximately a minute to wake. Service restarts clear Twitch connections. A free deployment is useful for an initial check, but judge-facing availability is better on an always-on instance.

References: [Render web services](https://render.com/docs/web-services), [Blueprint configuration](https://render.com/docs/blueprint-spec), [default environment variables](https://render.com/docs/environment-variables), and [Free service limits](https://render.com/docs/free).
