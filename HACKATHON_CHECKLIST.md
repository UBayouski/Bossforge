# Boss by Chat — hackathon readiness

Updated October 30, 2026. Checked means implemented or verified as described; unchecked means still pending. This is a working checklist, not a declaration that the entry is ready.

**Current status:** playable prototype; real chat contribution confirmed by the user (`ubayouski`). User approved the harder combat pass; filled cone warnings were restored on request. Distinct boss silhouettes, live stat previews, build titles, and a four-second reveal are implemented. Fourteen automated checks pass; the visual changes still need an in-browser playtest.

## 1. Entry requirements — must complete

Based on the [official rules](https://twitchcon-codex.devpost.com/rules) and [organizer FAQ](https://twitchcon-codex.devpost.com/resources), checked October 30.

- [ ] Confirm entrant eligibility under Section 3; enter as an individual or eligible team.
- [ ] Join the hackathon and create the Devpost entry.
- [x] Create new work during the October 23–November 2 submission window.
- [x] Build with Codex and connect interactively to Twitch.
- [ ] Submit a GitHub/GitLab/Bitbucket repository with source, assets, and runnable instructions; arrange judge access if private.
- [ ] Write the project description, including functionality and Codex's contribution.
- [x] Save the main build thread's Codex session ID for submission: `01a18eb6-9943-7fd2-9fd8-7276c2b00874`. Both build sessions are recorded in [Codex build sessions](CODEX_SESSIONS.md).
- [ ] Provide English materials or English translations.
- [ ] Confirm ownership and permissions for submitted assets and footage.
- [ ] Upload an under-three-minute YouTube demo showing real Twitch functionality and Codex build footage. Use public visibility to follow the official rules conservatively; the FAQ also accepts unlisted.
- [ ] Provide free judge access through the end of judging on November 15.
- [ ] Click **Submit**, then verify the entry says **Submitted** before **November 2, 2026, 2 p.m. Pacific**. Aim for November 1 internally.
- [ ] Freeze submitted repo/video/materials after the deadline; use a separate copy for further development as directed by the FAQ.

## 2. Core game — necessary for a convincing demo

- [x] Construction → fight → result → new round loop implemented.
- [x] Armor, legs, and chaos visibly modify the boss and its stats.
- [x] One contribution per viewer per round; only accept contributions during active construction.
- [x] Local simulation supports testing without an audience.
- [x] Movement, dash, health, projectile fans, and telegraphed area attacks implemented.
- [x] Remove auto-aim: mouse aiming, crosshair, directional gun, left-click/Space firing.
- [x] Automated regression checks cover manual aiming, scaled pointer coordinates, attack warnings, enrage reset, and idle-player defeat.
- [x] Playtest manual aiming: user says aiming feels fine; difficulty still needs tuning.
- [x] Implement faster attacks, targeted blasts, side crossfire, delayed recovery windows, and a half-health enrage phase.
- [ ] Playtest the new difficulty pass: verify attacks feel avoidable and victory requires movement and aim.
- [ ] Compare armor-heavy, legs-heavy, chaos-heavy, and mixed builds; confirm each feels distinct.
- [ ] Tune health, movement, cooldowns, and attack timing after that playtest. Avoid compensating only by adding health.
- [ ] Verify wins, deaths, timeout, pause/resume, reset, and repeated rounds in the actual browser.
- [ ] Verify pointer alignment and keyboard controls at normal size and fullscreen; confirm losing focus never leaves firing stuck on.

## 3. Real Twitch and stream rehearsal

- [x] Twitch app registered; local Client ID configured.
- [x] Real channel connected and contribution from `ubayouski` observed by the user.
- [ ] Verify all three commands from real chat, across fresh rounds.
- [x] Verify duplicate contributions from one account are ignored and that account can contribute next round (user confirmed).
- [x] Test two distinct viewers contributing to the same round (user confirmed).
- [ ] Confirm wrong commands and messages outside construction do not alter the boss.
- [ ] Test connection loss/recovery and reauthorization after expiry/disconnect; make failure visible to the streamer.
- [ ] Rehearse one full round on Twitch through OBS Window Capture, with the game window receiving controls.
- [ ] Ensure simulated viewers are off for the real-chat demonstration.
- [ ] Record Twitch chat, contributor attribution, transformation, and combat clearly enough to read in the final video.
- [x] Record a local rehearsal (user completed).
- [ ] Fix recording readability: first rehearsal was hard to read; diagnose text size versus blur and re-record a short sample.
- [x] User identified small text on a 32-inch 4K display; 4K recording resolved blur.
- [x] Implement Stream view with larger responsive workshop text, expanded arena, and HiDPI canvas rendering.
- [x] Constrain desktop Stream view to the viewport height; preserve arena proportions and adjust aiming for letterboxing. Sixteen automated checks pass.
- [ ] Verify Stream view visually and re-record a short sample; confirm readability at final playback size.
- [x] User confirmed viewport fit after sizing correction; bottom-right contributions show four rows in either layout, with a scrollbar for the full current-round history.

## 4. Presentation — high value before adding features

- [ ] Confirm the name, then make app title, page branding, README, repo, and Devpost consistent. Working name: **Boss by Chat**.
- [x] Implement plated shoulders, articulated skittering limbs, glowing chaos spikes, and orbiting effects.
- [x] Add assembly pulses, contributor callouts, and live previews of actual combat stats.
- [x] Add a four-second boss reveal and countdown; pause on loss of focus.
- [ ] Visually verify all three silhouettes, stat cards, and reveal at normal size and fullscreen.
- [ ] Improve hit, dodge, vulnerability, and victory feedback; sound is optional, with mute control if added.
- [x] Add original synthesized sound effects with an explicit on/off button, contribution throttling, and a simultaneous voice limit. Eighteen automated checks pass, including mute and unsupported-audio behavior.
- [ ] Listen to the sound effects in the browser and verify their balance beneath narration in an OBS recording.
- [x] Add build titles and dominant-trait descriptions to the reveal; repeat the title on results alongside contributor credit.
- [ ] Verify result credit and trait information read clearly in the recorded demo.
- [ ] Check readability at a typical 1080p stream layout, including controls and contribution names.

## 5. Repository and judge setup

- [x] Prepare Render Blueprint, Node runtime pin, health check, production origin handling, and isolated browser Twitch sessions. Twenty-four automated checks pass.
- [ ] Connect GitHub and Render, publish the prepared Boss repository, and complete the hosted deployment.
- [ ] Register the assigned hosted OAuth redirect in the Boss Twitch application and verify a real command on the deployed service.

- [x] Document local startup, Twitch setup, controls, OBS workflow, and current limitations.
- [x] Ignore `.env`; keep runtime tokens in server memory.
- [ ] Publish a repository and review its contents/history for tokens, secrets, and unrelated files.
- [x] Keep `.env.example` generic for other builders; document using their own Twitch app.
- [x] Verify the staged clean checkout without `.env`: HTTP assets, local game transitions, simulation, and all 24 automated checks pass.
- [ ] Test a fresh checkout with the documented Twitch configuration.
- [ ] Verify the documented minimum Node version supports the actual start/test commands.
- [x] Run `npm test` and `npm run check` on the prepared Render revision: all 24 tests and syntax checks pass. Repeat after further code changes.
- [ ] Record the submitted commit and preserve its runnable state for judging.

## 6. Demo and submission assets

The full storyboard, English narration, and recording plan are in [DEMO_VIDEO.md](DEMO_VIDEO.md).

- [x] Prepare a 2:40 demo scenario covering real Twitch contributions, boss tradeoffs, combat, results, and genuine Codex build footage.

Suggested video sequence (target 2:40, leaving margin):

| Time | Evidence to show |
| --- | --- |
| 0:00–0:15 | Hook: “You build it. I fight it.” Show the resulting monster. |
| 0:15–0:55 | Real Twitch commands adding parts, with named contributions. |
| 0:55–1:40 | Manual aiming, dodging, distinct attacks, and win/loss payoff. |
| 1:40–2:10 | How chat's choices create different strengths and weaknesses. |
| 2:10–2:35 | Actual Codex build footage and a concrete example of its contribution. |
| 2:35–2:40 | Clear project name and closing frame. |

- [ ] Capture clean screenshots of construction, combat, and results.
- [ ] Explain the intended streamer/viewer experience and what distinguishes it from generic chat voting.
- [ ] Explain implementation and tradeoffs honestly: local game state, one channel, no token renewal, desktop controls.
- [ ] Verify video and repository links as a logged-out viewer (or with judge access for private code).
- [ ] Check the project against all four equally weighted criteria: innovation, impact, implementation/Codex use, and design.

## Immediate priorities

1. Playtest the new transformations, stat previews, and boss reveal.
2. Validate all three Twitch commands and multiple real viewers.
3. Improve transformations and rehearse the live demo.
4. Package the repository, record the video, and submit early.

Persistent accounts, hosting, touch controls, runtime AI, and a Twitch Extension are not prerequisites for this MVP. Revisit only after the submission essentials are complete.
