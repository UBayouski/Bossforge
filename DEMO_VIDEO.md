# Boss by Chat — demo video scenario

Target length: **2:40**, including the closing frame. English narration and captions.
Working title: **Boss by Chat**. Tagline: **You build it. I fight it.**

## Storyboard and narration

| Time | Picture / action | Narration |
| --- | --- | --- |
| 0:00–0:12 | Open on a real combat highlight: dodge a warning, fire at the monster, then show the title. | “What if Twitch chat could build the boss you have to fight? This is Boss by Chat. You build it. I fight it.” |
| 0:12–0:42 | Show the connected channel and simulated chat switched off. Start building. Keep real Twitch chat visible beside the game. Capture a viewer sending a command, their name appearing, and the corresponding boss change. Show all three commands using distinct viewers or clearly labeled cuts between rounds. | “Viewers build the monster through Twitch chat. Each viewer adds one part per round: armor, legs, or chaos. Their name appears in the workshop, and their choice changes the boss.” |
| 0:42–1:00 | Cut between armor-heavy, legs-heavy, and chaos-heavy builds. Hold each stat preview long enough to read; use short captions for the tradeoffs. Label these as different builds. | “Armor adds health but slows movement. Legs make it faster but more fragile. Chaos creates more dangerous attacks, with longer recovery windows. Chat is choosing the fight's strengths and weaknesses.” |
| 1:00–1:08 | Show the boss reveal and title. Leave the full four-second reveal visible. | “When building ends, the finished monster is revealed. Then it's the streamer's turn.” |
| 1:08–1:45 | Show mouse aiming and firing, a deliberate dash out of a warning, side crossfire, and a recovery window. Include the phase-two moment if available. Let a few seconds of game audio play without narration. | “I aim with the mouse, dodge the attack warnings, and dash out of trouble. Recovery windows are my chance to hit harder. At half health, the boss enrages. The audience gets to watch its decisions turn into consequences.” |
| 1:45–2:00 | Show an actual win or loss and the results card with contributor credit. Hold for readability. | “The round ends with a result and credit for the builders. Then we start again, and chat gets to create a different problem.” |
| 2:00–2:27 | Show genuine Codex build footage from the saved threads: a request, the resulting implementation, and passing tests. Good examples: real chat integration, manual aiming, or responsive panel sizing. Keep private information out of frame. | “I built this with Codex, directing the game rules and iterating on the result. Codex helped implement the Twitch EventSub connection, combat, procedural boss visuals, responsive layout, and automated checks. I tested it with real chat and refined the controls and presentation.” |
| 2:27–2:40 | Return to a short, clean gameplay moment, then a closing frame with the name and tagline. | “Boss by Chat gives viewers a direct role in the action, and gives the streamer a challenge the community created together.” |

## Capture plan

1. Record gameplay first, then record the narration separately so playing does not interrupt the explanation.
2. Use OBS Window Capture. Enable Stream view, click **Sound off** to turn effects on, and check game audio is included in the recording. Keep effects quieter than the narration.
3. Record at native 4K if that keeps text sharp; inspect an exported 1080p sample at normal playback size before recording the final takes.
4. Connect Twitch and turn simulated chat off. Record a genuine command-to-name-to-boss-change sequence without a cut across that interaction.
5. One viewer can contribute only once per round. To show three commands, use three real viewers or record separate rounds and make those cuts clear. Keep the Twitch chat timestamps/usernames and game contribution names readable.
6. Record one complete round and additional takes for the three build types. Condense waiting time with a visible cut or “later in the round” caption. The actual build lasts 45 seconds; do not imply the edited sequence is real time.
7. Capture an actual result. Either a win or a loss supports the story; use the take with the clearest action.
8. Open the initial build and follow-up Codex threads for genuine build evidence. If recreating a change, record an actual new request and its result; do not present a staged conversation as original footage.
9. Capture three screenshots: construction with real contributors, combat, and results.

## Before uploading

- Use one project name consistently in the video, Devpost entry, and repository. The current page title still says “Chat Builds the Boss”; align it when the final name is confirmed.
- Keep credentials, environment files, account tokens, unrelated tabs, and notifications out of the recording.
- Use the game's original synthesized effects. Any additional music or footage needs permission.
- Confirm the final video is under three minutes and has readable captions and UI.
- Upload to YouTube. The rules specify public visibility; the organizer FAQ also permits unlisted. Private videos are not suitable for judge access.
- Verify the YouTube and repository links while logged out, or verify the required judge access for a private repository.
- Add the primary Codex session ID from [CODEX_SESSIONS.md](CODEX_SESSIONS.md) to the submission.

Requirements checked against the [official rules](https://twitchcon-codex.devpost.com/rules) and [organizer FAQ](https://twitchcon-codex.devpost.com/resources): show the project working on Twitch and show how it was built with Codex; include an accessible repository, project description, and Codex session ID.
