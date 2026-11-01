# 1v1 Browser PvP Platform — Prototype & MVP Plan

As of Nov 1, 2026 · Owner: Devon Bartlett

> Source of truth for product decisions. The editable original lives in Claude Docs; this file is the copy agents read. If the two disagree, ask the owner.

## Vision

A free, browser-first hub of fast 1v1 PvP games built on mechanics every gamer already knows, so friends in a Discord voice channel can settle it heads up in seconds. One link, no installs, a best-of series across several games, and a running head-to-head record between two players.

The product is the rivalry, not any single game. Each game is a small module; the platform (challenge links, series, records) is what people come back for.

**Pillars**

- **Instant:** click a link and be in a match in under 15 seconds. Guest play, no account, no download.
- **Skill, not grind:** pure mechanics, no unlocks or stat advantages. Same kit for both players.
- **Fast rounds:** 1 to 3 minutes per round, so a 5-game series fits a voice-chat break.
- **Social first:** built for Discord voice channels, friends, and randos who want a quick duel.
- **Nostalgic feel, original art:** looks like a WC3 custom game or a 1.6-era shooter, but every asset is ours.

**Working name:** to be decided (see open decisions). Not "Bro vs Bro", which is Ludwig's series.

## Lessons from D2 Survivors and Arena of Champions

Both are free solo fan projects that went viral by shipping fast and removing every barrier to the first match. We copy their delivery model, not their asset sourcing.

| What they did | Source | What we take |
| --- | --- | --- |
| Browser first, plus an optional desktop app that works offline and auto-updates | [D2 Survivors](https://d2survivors.org/troubleshoot) | Browser first; desktop client later only if latency demands it |
| Optional Windows client for players with high browser ping; settings and keybinds sync across both | [Arena of Champions](https://arenaofchampions.net/download/) | Account settings and keybinds stored server-side from day one |
| Guest entry added at v0.11, a week after v0.1 | [AoC timeline](https://arenabrowser.com/timeline/) | Guest play in the very first prototype |
| About 20 public releases in 10 days, Oct 20 to 29, 2026 | [AoC timeline](https://arenabrowser.com/timeline/) | Ship weekly at minimum; public patch notes from build 1 |
| Rust compiled to WebAssembly, about 45 MB client, WebGL 2 | [playgamesinbrowser.com](https://playgamesinbrowser.com/game/arena-of-champions) | Smaller TypeScript client; target under 10 MB first load |
| Server-full queue with position and wait time; in-game Discord NPC | [AoC guide](https://arenabrowser.com/arena-of-champions/) | Graceful overload handling; Discord link inside the game |
| Reads art from the player's own Diablo II install; standing takedown offer | [Gadget Pilipinas](https://www.gadgetpilipinas.net/2026/10/d2-survivors-diablo-2-browser-game/) | Not our model: it breaks one-link instant play (see IP policy) |

## IP and art direction policy

We ship only original art, sound and names, styled to evoke the eras players remember. This keeps the project listable as a Discord Activity, safe from takedowns, and open to monetization later.

**Why not borrowed assets**

- Riot forbids its IP in fan games and apps, including character looks, abilities, maps, icons and items ([Riot Legal Jibber Jabber](https://www.riotgames.com/zh-hans/legal)), and has shut down a fan League server before ([PC Gamer](https://pcgamer.com/au/riot-shuts-fan-made-league-of-legends-legacy-project-denies-complaints-of-extortion)).
- Warcraft III art belongs to Blizzard and CS 1.6 art belongs to Valve. DotA's history does not change that.
- Every extra rights holder is another party who can shut down the whole hub.
- Bring-your-own-files would force a friend to own every source game, which kills one-link instant play.

**Art direction**

- **Arena Minigames:** a bright, toy-like stadium with original mascot characters. No creatures that resemble an existing monster-collecting franchise.
- **Aim Duel:** low-resolution textures, boxy geometry and a tan desert palette, in the spirit of a 1.6-era aim map.
- **Lane Duel:** chunky, hand-painted low-poly heroes and a bright fantasy lane, in the spirit of a WC3 custom map.
- **Kart Race:** original drivers, karts and track. No borrowed characters, item designs or track names.
- **Sources:** CC0 and paid asset packs, AI-assisted textures and sprites, and simple procedural geometry. Keep a license log for every asset.
- **Naming:** generic, original names for heroes, maps, abilities and minigames. No borrowed trademarks anywhere, including domains and search tags. Nintendo is especially strict with fan games, so the minigame and kart modes get extra review.

**Escape hatch:** the art layer is built as swappable skin packs, so any asset can be replaced in one place without touching game code.

Not legal advice; get a lawyer's review before charging money.

## MVP scope

The MVP is the platform plus four games: Arena Minigames, Aim Duel, Lane Duel and Kart Race. More games come only after players ask for rematches.

**Platform features**

| Feature | In MVP | Detail |
| --- | --- | --- |
| Challenge link | Yes | Create a room, copy a link, friend joins; room expires after 30 minutes idle |
| Guest play | Yes | Pick a display name; a device token keeps the identity until the player links Discord |
| Discord sign-in | Yes | OAuth, used for names, avatars and keeping records across devices |
| Series mode | Yes | Best of 3, 5 or 7; the challenger sets the game list or picks random; loser picks the next game |
| Head-to-head record | Yes | Lifetime wins and losses per pair of players, shown on the results screen |
| Rematch button | Yes | One click, same room, same opponent |
| Spectate by link | Yes | Read-only view of a live match for people in the voice channel |
| Discord Activity | Yes | The same web app launched inside a voice channel |
| Public matchmaking | Later | Random opponent queue per game, with a simple rating |
| Ranked ratings | Later | Glicko-2 per game once there is a queue |
| Replays and clips | Later | Server already records inputs, so this is mostly UI |
| Desktop client | Later | Only if browser latency is a real complaint |
| Mobile | Later | Mechanics games need keyboard and mouse first |

**Out of scope for MVP:** cosmetics, payments, chat (Discord already has it), more than 2 players per match, and anti-cheat beyond server authority.

## Launch games

Four classic PvP formats, each testing one familiar skill in rounds of 1 to 3 minutes. Arena Minigames starts with Quick Draw because it proves the platform end to end with almost no game code.

| Game | Skill tested | Inspired by | Build difficulty | Build order |
| --- | --- | --- | --- | --- |
| Arena Minigames | Reaction, rhythm, nerve | Party minigame collections | Low per minigame | 1 (Quick Draw), then 5 |
| Aim Duel | Flicks, tracking, counter-strafing | Aim maps in classic tactical shooters | Medium | 2 |
| Lane Duel | Last-hitting, skillshots, trading | 1v1 mid lane in MOBAs | Medium-high | 3 |
| Kart Race | Racing lines, drifting, item timing | Party kart racers | High | 4 |

**Arena Minigames**

- A rotation of 20 to 60 second minigames played as a best-of set. Each minigame is a small plug-in, about 1 to 3 days of AI-assisted work, so the collection can grow weekly after launch.
- **Quick Draw:** a signal fires after a random 2 to 6 seconds; first valid click wins, clicking early is a foul. The server judges timing against each player's measured latency. Also our latency test bed.
- **Mash Dash:** a sprint powered by key presses, with a stamina meter so steady rhythm beats blind mashing.
- **Sumo Ring:** push your opponent off a shrinking platform; dash and brace are the only two moves.
- First to 3 minigame wins takes the set.

**Aim Duel**

- First-person, small symmetrical arena with a few boxes and one mid lane, original low-poly 1.6-era look.
- One rifle: hitscan, headshot kills, body shots take two. Moving while firing adds spread, so stopping before you shoot (counter-strafing) is the core skill.
- One life per round, 30-second round timer, sudden-death shrinking zone if time runs out.
- First to 10 rounds; sides swap at 5.

**Lane Duel**

- Top-down 3D, one lane, one tower and one well per side. Minion waves spawn every 30 seconds.
- Each hero has a basic attack and three abilities: a skillshot, a mobility move and a defensive or burst skill. Levels 1 to 6 only, no items in MVP.
- Classic 1v1 win rules: first kill, 100 minion last-hits, or first tower destroyed.
- Two original heroes at launch (a ranged mage and a melee bruiser), plus a mirror-match option.

**Kart Race**

- Party racing on one short original track: 2 laps of about 45 seconds each, in a best-of-3 race set.
- Arcade handling: hold a drift to charge a boost, release for speed, and time the start-line boost.
- Item boxes on the track give one random powerup. Five original powerups at launch:
  - **Boost Canister:** a burst of speed.
  - **Ricochet Orb:** a projectile fired forward that bounces off walls.
  - **Oil Slick:** a trap dropped behind you that spins out whoever drives through it.
  - **Bumper Shield:** blocks one hit, or can be dropped as a trap.
  - **Seeker Bolt:** a rare homing shot that only the trailing player can roll; it chases down the leader.
- Comeback mechanics: item odds depend on position, so the leader mostly gets defensive items and the trailing player gets the strong ones. The trailing player also gains a slipstream boost when driving close behind the leader.
- A room setting for comeback strength: **Off** for pure skill, **Light** as the default, **Party** for maximum chaos.
- Karts pass through each other, but items and traps hit karts. The server checks every checkpoint and lap time, so shortcuts and speed hacks fail.

## Technical architecture

TypeScript end to end, with Three.js on the client and a lean Node.js game server. For 1v1 games the bottleneck is the network and the download, not the CPU, so the winning stack is the one with the smallest client, one shared simulation and the fastest path into Discord.

```text
 Clients (one TypeScript web app)
 ┌───────────────────────────────┐  ┌───────────────────────────────┐
 │ Browser                       │  │ Discord Activity              │
 │ Three.js renderer, input, UI  │  │ Same client in a voice channel│
 │ Shared sim predicts own moves │  │ Embedded App SDK, Discord proxy│
 └───────────────────────────────┘  └───────────────────────────────┘
        │ download            │ HTTPS               │ WebSocket (binary, both ways)
        ▼                     ▼                     ▼
 ┌──────────────┐     ┌────────────────────┐   ┌──────────────────────────────┐
 │ Static CDN   │     │ Lobby and API      │   │ Game server (authoritative)  │
 │ bundle+assets│     │ links, rooms,      │   │ 60 Hz rooms, shared sim,     │
 │ <10 MB first │     │ sign-in, series,   │   │ lag compensation             │
 └──────────────┘     │ records            │   └──────────────────────────────┘
                      └────────────────────┘                │ match results
                        │ sign-in   │ records               ▼
                        ▼           ▼
               ┌───────────────┐ ┌──────────────────────────┐
               │ Discord OAuth │ │ Postgres                 │
               │ names,avatars │ │ players, records, matches│
               └───────────────┘ └──────────────────────────┘
```

Players download the client from the CDN, create or join rooms through the API, then play over a binary WebSocket to the game server, which writes results to Postgres.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript everywhere | One codebase across client, server and Discord SDK; strongest AI coding support |
| Renderer | Three.js on WebGL 2 | Mature, small, ideal for low-poly 3D in all launch games |
| UI | Preact overlays | Menus and HUD for a few KB instead of a large framework |
| Build | Vite | Fast rebuilds, code splitting so each game loads only when picked |
| Game server | Node.js with uWebSockets.js | One of the fastest WebSocket servers available; many rooms per process |
| Shared simulation | `packages/sim` | Same rules on client and server; enables exact prediction |
| Protocol | Binary messages with delta compression | Small packets, low bandwidth, less latency |
| Database | Postgres | Players, head-to-head records, match history |
| Auth | Guest token plus Discord OAuth | Instant play, optional identity |
| Discord | Embedded App SDK | Same app runs as a voice-channel Activity |

**Why not Rust like Arena of Champions:** Rust compiled to WebAssembly wins on heavy CPU work, but it ships larger downloads and slows iteration. If profiling ever shows the simulation is the bottleneck, `packages/sim` can be ported to Rust and compiled to WebAssembly without changing the rest.

## Netcode approach

The server is authoritative for every game, and the game rules live in one shared TypeScript package that both the client and server run. That shared simulation is what makes prediction exact and cheating hard.

**Shared model for real-time games**

1. Server simulates at a fixed 60 ticks per second and sends compact state snapshots 30 times per second.
2. The client predicts its own player instantly from local input, then replays unconfirmed inputs when a snapshot arrives (reconciliation).
3. The opponent is drawn about 100 ms in the past, interpolated between snapshots, so movement looks smooth.
4. For hitscan shots, the server rewinds the opponent to where the shooter saw them, capped at 200 ms of lag compensation.
5. Messages are binary, with delta compression against the last acknowledged snapshot.

| Game | Tick rate | What the client predicts | Special handling |
| --- | --- | --- | --- |
| Arena Minigames | Event-based or 30 Hz | Own movement in Sumo Ring | Quick Draw judged against each player's measured round-trip time; Sumo pushes resolved on the server |
| Aim Duel | 60 Hz | Own movement and own shot effects | Lag-compensated hit detection; server confirms every hit |
| Lane Duel | 30 Hz | Own movement and ability start-up effects | Minions and towers simulated only on the server |
| Kart Race | 60 Hz | Own kart physics | Opponent kart interpolated; item rolls and hits decided on the server, with projectiles shown instantly on the client; server checks checkpoints |
| Fighting game (later) | 60 Hz | Everything | Rollback netcode with a fully deterministic simulation |

**Transport:** WebSockets for the MVP, because they work in every browser and inside a Discord Activity, where network traffic must route through Discord's proxy (to verify in phase 3). Unreliable transports such as WebTransport or WebRTC data channels are a later upgrade for the standalone browser build if measured latency needs it.

**Hosting:** start with one US-Central region, near Kansas City and most US players. Add US-East, US-West and EU servers when players come from there; each room runs on the region closest to both players.

## Roadmap

Kickoff is Monday, Nov 2 and public launch is Friday, Dec 18, 2026: seven weeks, with a friends playtest over Thanksgiving weekend. Announce both dates in the project Discord so the deadline is public.

| Workstream or milestone | Start | End |
| --- | --- | --- |
| Foundation | Nov 2 | Nov 8 |
| Quick Draw and links | Nov 9 | Nov 15 |
| **Milestone: First duel by link** | Nov 13 | |
| Aim Duel | Nov 16 | Nov 29 |
| Series and records | Nov 23 | Dec 6 |
| **Milestone: Friends playtest** | Nov 27 | |
| Lane Duel | Nov 30 | Dec 13 |
| Kart Race | Nov 30 | Dec 13 |
| Discord Activity | Dec 1 | Dec 10 |
| Mash Dash and Sumo Ring | Dec 7 | Dec 13 |
| **Milestone: Kart gate** | Dec 11 | |
| Polish and load test | Dec 14 | Dec 17 |
| **Milestone: Public launch** | Dec 18 | |

Series and records overlap Aim Duel, and Lane Duel and Kart Race run side by side, because each is an independent module. That parallel stretch is where AI-assisted coding has to carry the load.

**Gates: what "done" means at each milestone**

1. **First duel by link (Nov 13):** two people on different networks play Quick Draw from a shared link, as guests, under 15 seconds from click to match.
2. **Friends playtest (Nov 27):** Aim Duel holds 60 fps and feels fair at 100 ms simulated latency; at least 6 friends play a best-of-5 series and fill in a feedback form.
3. **Kart gate (Dec 11):** two players finish a full race at 60 fps with no visible desync. If not, Kart Race becomes a January content drop and launch goes ahead with three games.
4. **Public launch (Dec 18):** all four games, series mode, head-to-head records and the Discord Activity work; every performance budget passes in CI; landing page and patch notes are live.

## Performance budgets and success metrics

Performance here means low latency, fast loading and a steady frame rate on an ordinary laptop. These budgets are checked on every build, and a build that misses one does not ship.

| Budget | Target | How we check it |
| --- | --- | --- |
| Link click to in a match | Under 15 seconds | Timed in playtests |
| First load download | Under 10 MB, compressed | Build report in CI |
| Repeat load | Under 2 seconds | Cached assets, measured in the browser |
| Frame rate | Steady 60 fps on integrated graphics | In-game frame-time overlay |
| Input to on-screen response | Under 50 ms locally | Prediction means own actions never wait on the network |
| Round-trip time, same region | Under 60 ms at the 95th percentile | Server telemetry |
| Server cost per match | Under 5% of one CPU core | Load test with 200 bot matches |

**Success metrics for the MVP launch**

| Metric | Target |
| --- | --- |
| Rematch rate | Over 50% of finished matches get a rematch |
| Series completion | Over 70% of started series finish |
| Discord Activity launches | 25% of matches start inside Discord |
| Week-one return | 30% of players play again within 7 days |
| Crash and disconnect rate | Under 2% of matches |

## AI-assisted development workflow

AI writes most of the code; the owner owns the design, the playtesting and the merge button. The process is built so AI output is easy to check and hard to break silently.

- **One monorepo:** `packages/sim` (shared game rules), `apps/client`, `apps/server`, `packages/protocol` (message formats), `games/<name>` (one folder per game).
- **Project memory file:** `CLAUDE.md` at the repo root holds the architecture rules, the performance budgets and the netcode model, so every AI session starts with the same constraints.
- **Small changes:** one feature per branch and pull request, with CI running before every merge.
- **Tests the AI cannot fake:** the shared simulation is tested headless. The same inputs must always produce the same state, and a bot-versus-bot match must finish without errors.
- **Network chaos testing:** a built-in mode that adds 100 ms delay, jitter and 2% packet loss, used in every playtest of a new feature.
- **Budgets in CI:** bundle size and a headless frame-time benchmark fail the build when they regress.
- **Weekly release:** a tagged build every Friday with short public patch notes, starting with the first prototype.
- **Playtest loop:** a feedback channel in the project Discord; every bug report gets a tag and a fix date.

## Dev environment and agent handoff

The Windows 11 desktop runs the code in WSL2, keeps the repo on GitHub with large art in Git LFS, and backs up raw art files separately. Agents get everything they need from the repo itself: the plan, the rules and a queue of issues.

**Machine setup:** WSL2 with Ubuntu (repo in `~/code/`), Node.js LTS via fnm, pnpm via Corepack, Git + Git LFS + GitHub CLI, Docker Desktop with WSL2 integration, VS Code with the WSL extension, Claude Code installed inside WSL2. Never put the repo in a OneDrive-synced folder.

**Asset pipeline**

Raw source files and game-ready files are stored separately. Agents and the build only ever touch game-ready files.

| Asset | Made with | Raw source format | Game-ready format | Stored in |
| --- | --- | --- | --- | --- |
| 3D models (heroes, karts, arenas) | Blender | `.blend` | `.glb`, compressed with glTF-Transform | Raw: R2 backup · Game-ready: Git LFS |
| Textures and sprites | Krita or Aseprite, AI tools | `.kra`, `.aseprite`, `.png` | KTX2 or WebP | Raw: R2 backup · Game-ready: Git LFS |
| Sound effects and music | Audacity, asset packs | `.wav` | `.ogg` (Opus) | Raw: R2 backup · Game-ready: Git LFS |
| UI icons | Figma or Inkscape | `.svg` | `.svg` | Git |
| Bought or free packs | Vendor downloads | Original zip | Converted as above | R2 backup, plus a row in `assets/LICENSES.csv` |

An `assets:build` script converts raw exports into game-ready files and fails if any asset lacks a license row.

## Costs, risks and open decisions

Running costs stay under about $50 a month until real traffic arrives. The biggest risk is scope, not money.

**Approximate monthly costs (estimates, not quotes)**

| Item | Cost |
| --- | --- |
| Game server, one US-Central VPS | $10 to $40 |
| Database, managed Postgres free or starter tier | $0 to $25 |
| Static hosting and CDN | $0 |
| Domain | About $15 per year |
| Asset packs and audio, one-time | $0 to $150 |

**Risks**

| Risk | Mitigation |
| --- | --- |
| Scope creep into ten games | No fifth game until rematch rate passes 50%; Kart Race moves to a January drop if it misses its Dec 11 gate |
| Netcode feels bad | Network chaos mode from week 1; Quick Draw proves the pipe before real-time games |
| Discord Activity rules differ from the browser (proxy, sign-in, sizes) | Prototype the Activity wrapper early in phase 3, not at launch |
| Lane Duel balance eats time | Two heroes only, mirror match available, no items |
| Momentum fades without outside pressure | Public playtest dates announced in the project Discord |
| Art looks too close to the inspirations | Art review against the IP policy before each release |

**Open decisions**

- [ ] Project name and domain
- [ ] Client renderer: Three.js (recommended) or Babylon.js
- [ ] Hosting provider for the game server
- [ ] Who joins the week-4 friends playtest
- [ ] Public launch channel: Discord App Directory, itch.io, Reddit, or creator outreach
