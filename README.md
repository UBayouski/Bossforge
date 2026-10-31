# Chat Builds the Boss

A Twitch audience assembles a monster, then the streamer fights it in a browser arena. Built with Codex for the Codex × TwitchCon hackathon.

Track remaining work in the [hackathon readiness checklist](HACKATHON_CHECKLIST.md).

Follow the [demo video scenario](DEMO_VIDEO.md) for the 2:40 storyboard, English narration, and recording checklist. Build session IDs are saved in [CODEX_SESSIONS.md](CODEX_SESSIONS.md).

## Run locally

Requires Node.js 24 (24.18.0 is the tested version). No dependencies, package installation, or runtime AI keys needed.

```powershell
npm start
```

Open **http://localhost:3000**. Click **Start building**. Simulated chat adds parts automatically; the three part buttons add extra simulated viewers. Click **Fight now** to skip the 45-second construction phase. Fight for up to 60 seconds using WASD/arrows to move, the mouse to aim, left-click or Space to shoot, and Shift while moving to dash. Shots travel toward your cursor without tracking the boss. The gun and crosshair show your aim. Aim coordinates scale with the arena, including fullscreen. Click the arena to give it keyboard focus. Switching away from the window pauses combat. Resume with the Pause/Resume button.

Armor adds health and the base boss moves slowly; legs increase speed and reduce health. Chaos adds attacks with longer vulnerability windows. Scaling uses diminishing returns. One contribution per real Twitch user per round. Contributions outside the build phase or while paused are ignored.

The boss alternates targeted explosions, aimed projectile fans, and crossfire from both sides of the arena. Warnings lock in before firing, giving you time to move or dash. At half health it enrages, moves faster, and attacks more frequently. Shots deal three times as much damage during brief recovery windows after attacks launch. Keep moving and take advantage of the **VULNERABLE** cue.

Construction now shows live health, speed, and attack/recovery previews. Armor adds broad plated shoulders, legs add articulated limbs and skitter animation, and chaos adds glowing spikes and orbiting sparks. Builds receive a title based on the dominant contribution (ties create a hybrid). When construction ends, a four-second reveal displays the finished monster, builder count, and stats before the full 60-second fight begins. You can pause the reveal; switching away also pauses it. Contributions are locked during the reveal. The result card repeats the monster's title.

## Real Twitch chat

1. Register an app at https://dev.twitch.tv/console/apps using a Twitch account with verified email and 2FA.
2. Add the exact OAuth redirect URL `http://localhost:3000` and choose an appropriate application category. The browser uses the implicit OAuth flow; no client secret is used.
3. Copy `.env.example` to `.env` and fill in `TWITCH_CLIENT_ID` with your app's Client ID.
4. Restart `npm start`, open **http://localhost:3000**, and click **Connect Twitch**. Authorize your broadcaster account for `user:read:chat`.
5. Start a build round. Send `!armor`, `!legs`, or `!chaos` in that account's channel chat. Each user can add one part per round. Connecting Twitch turns simulated chat off. Part buttons remain available for manual simulations.

Each browser session supports its authenticated account's own channel. Browser sessions have separate Twitch tokens, connections, and contribution feeds. Tokens are held in server memory and disappear on restart; they are validated on connection and hourly. Reauthorize after token expiry; automatic OAuth token renewal is not implemented. Use localhost, not 127.0.0.1, for local OAuth and origin checks. If changing PORT, update the registered redirect URL too. Never commit `.env` or access tokens. Disconnect closes that browser session's connection; revoke the app in Twitch settings to revoke authorization completely.

The server receives EventSub messages over an outbound WebSocket, handles Twitch migration reconnect messages, retries dropped connections, and deduplicates event IDs. No public server or tunnel is necessary. Twitch does not replay chat events missed during connection loss. The user confirmed a real chat contribution on October 30, 2026; broader multi-viewer and connection-recovery tests are still pending.

## OBS / demo

For a large or 4K display, maximize the browser and click **Stream view** in the header before recording. This hides the intro, removes the page width limit, and scales workshop commands, contributor names, and controls with the display width. Both the game and workshop remain visible. Canvas rendering adapts to the displayed size and device pixel ratio (up to 3× backing resolution), while gameplay and mouse coordinates stay in the same world space. Exit Stream view to return to the original layout. Try a short sample recording to verify text at the final viewing size.

Desktop Stream view fits the available viewport height, keeping the arena's top and bottom controls visible. The game preserves its aspect ratio with letterboxing when necessary; mouse aiming excludes the black bars. Workshop text, controls, and spacing scale with the panel's width and height to fit short or wide windows without a panel scrollbar. Narrow mobile layouts keep normal page scrolling.

The right workshop matches the left arena's height in side-by-side layouts. The contributions panel reserves seven rows, newest first. The whole workshop scales to fit the controls and reserved rows together: reserving fewer names gives the controls more space to grow, while more names makes them smaller. Narrow layouts stack the workshop below the arena. Scroll inside the names list using the mouse wheel, trackpad, touch, or keyboard to review all contributions from the current round; its scrollbar stays hidden. The full round history clears when starting a new round; the builder total includes everyone.

Play in the browser window and use OBS Window Capture to show it. Fullscreen expands the arena. A browser source does not automatically receive your keyboard controls. Suggested recording: show a real viewer's command, the matching contribution/monster part, then a fight and the results card. Capture Codex build footage as well for the submission. Local simulation is useful for development but does not replace footage of the real Twitch integration.

Keep one game tab open during a live session: game state is local to each tab; reloading resets the round. Keyboard play is intended for desktop. Mobile can view the page but touch combat controls are not included. Fonts fall back to system fonts if Google Fonts is unavailable. All game graphics are drawn in canvas, with no external artwork.

Click **Sound off** in the header to enable original synthesized effects for contributions, the reveal, combat, and results. Click **Sound on** to mute them. Audio starts only after enabling it, uses no external files, and defaults to off on reload. Effects are rate-limited and capped at twelve simultaneous voices. In OBS, check that game audio is captured and sits below your narration. Browsers without Web Audio support can still play silently.

## Validation

```powershell
npm test
node --check server.mjs
node --check public/app.js
```

## Render deployment

Follow [DEPLOYMENT.md](DEPLOYMENT.md) to publish the Boss repository and use the included `render.yaml`. The server uses Render's assigned public origin, secure browser sessions, a health endpoint, and the platform's port. The build runs tests and syntax checks. No database is needed; use one service instance because Twitch sessions live in memory.

Set `TWITCH_CLIENT_ID` in Render and register the exact production redirect after the real URL is assigned. The local `.env` is not uploaded. The initial Blueprint uses the Free plan; judge-facing availability is better with an always-on service if its cost is approved. Publishing and live verification are still pending.

## Build scope

Implemented: three contribution types, construction timer, animated procedural monster, keyboard arena combat, dash invulnerability, telegraphed area attacks and projectile fans, health bars, results, pause/reset, simulation, OAuth and own-channel EventSub chat adapter.

Not yet implemented: persistent accounts/rounds, hosted multi-channel service, touch controls, or production token renewal. Preserve the Codex session ID and record the actual Twitch demo before submission.
