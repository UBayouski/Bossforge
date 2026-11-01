# Bossforge

**Chat builds the boss. You fight it.**

Bossforge turns Twitch chat into a boss-building workshop. Viewers contribute armor, legs, and chaos to assemble a monster, then the streamer faces that creation in a browser arena. Every round gives the audience a different way to make the fight harder.

[Play Bossforge](https://bossforge.onrender.com/)

## Features

- **A boss built by chat.** Each viewer contributes one part per round, with their name shown in the contribution feed.
- **Visible tradeoffs.** Armor adds health, legs increase speed at the cost of health, and chaos changes attacks and recovery windows. The monster's appearance reflects its build.
- **Arena combat.** Aim manually, dodge projectile fans and telegraphed explosions, and dash through danger. The boss enrages at half health and takes extra damage during recovery windows.
- **A complete round loop.** A 45-second build phase leads into a four-second reveal, a fight lasting up to 60 seconds, and a results card crediting the builders.
- **Stream-friendly presentation.** Stream view, fullscreen, responsive canvas rendering, and optional synthesized sound effects.
- **Play without an audience.** Simulated viewers and manual part buttons work without Twitch setup.

## Run locally

Requires **Node.js 24**. The project pins **24.18.0** in `.node-version`. No package installation or runtime AI API key is required.

From the repository root:

```sh
npm start
```

Open **http://localhost:3000**, click **Start building**, and let simulated chat assemble the boss. Use the part buttons to add more contributions. Click **Fight now** to end construction early.

## Controls

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Aim | Mouse |
| Shoot | Left mouse button or Space |
| Dash | Shift while moving |
| Pause or resume | Pause/Resume button |
| Restart the game | Reset button |

Click the arena to give it keyboard focus. Switching away from the window pauses combat and the boss reveal. Sound starts off; use the header's sound button to enable or mute it.

## Connect Twitch

The hosted app provides **Connect Twitch** for your broadcaster account. To configure your own local instance:

1. Register a Twitch application in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Register the exact OAuth redirect **http://localhost:3000**, without a trailing slash.
3. Copy `.env.example` to `.env` and set your application's Client ID:

   ```dotenv
   TWITCH_CLIENT_ID=your_twitch_client_id
   PORT=3000
   ```

4. Restart the server, open **http://localhost:3000**, and select **Connect Twitch**. Authorize the broadcaster whose channel you want to use.
5. Start a build round and invite viewers to contribute:

| Command | Contribution |
| --- | --- |
| `!armor` | More health and a plated silhouette |
| `!legs` | Faster movement, less health, and articulated limbs |
| `!chaos` | More dangerous attacks, longer recovery windows, and glowing spikes |

Each Twitch user can contribute once during an active, unpaused build phase. Connecting Twitch turns automatic simulation off; manual simulation buttons remain available.

The app requests `user:read:chat` and uses the connected broadcaster's own channel. No client secret is used. Use `localhost` for local setup; changing the port also requires updating the registered redirect.

## Use with OBS

Regular desktop view uses the original layout when there is enough height. On shorter screens, it automatically compacts the intro and fits the arena and workshop into the viewport. Narrow mobile layouts retain normal page scrolling.

Open the game in a browser and capture that window with OBS. **Stream view** keeps the arena and workshop together while enlarging the presentation for capture; **Fullscreen** expands the arena. Play in the browser window so keyboard and mouse controls reach the game.

Keep one game tab open for a live round. Enable the synthesized sound effects if desired and include browser audio in your OBS mix.

## How it works

The game uses vanilla JavaScript, HTML Canvas, CSS, and Web Audio. Graphics and sound effects are generated in the browser. A dependency-free Node.js server handles Twitch authorization and EventSub chat messages over an outbound WebSocket.

Each browser session has its own Twitch credentials, connection, and contribution feed. Tabs in that browser share the Twitch connection, while each tab runs its own game. Tokens stay in server memory and are validated on connection and hourly.

## Limitations

- Rounds live in the browser tab and reset on reload; there are no saved games.
- Combat requires a desktop keyboard and mouse; touch controls are not included.
- Reconnect Twitch after a server restart or expired authorization. Automatic OAuth token renewal is not implemented, and chat messages missed during an outage cannot be replayed.
- The server runs as one process/instance because Twitch sessions are held in memory.

## Development

```sh
npm test
npm run check
```

Tests cover gameplay, contribution rules, aiming, audio, server behavior, and Twitch session isolation.

## Deployment

The repository includes a Render Blueprint, runtime pin, and `/health` endpoint. Deploy the game and server together as a Node Web Service, set `TWITCH_CLIENT_ID`, and register the hosted HTTPS origin as the Twitch OAuth redirect. No database or persistent disk is required.

See [DEPLOYMENT.md](DEPLOYMENT.md) for configuration and hosting details.
