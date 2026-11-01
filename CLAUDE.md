# CLAUDE.md

Rules for every AI agent working in this repo. Read this first, then `docs/plan.md` and the spec for your task in `docs/specs/`.

## What we're building

A browser-first hub of fast 1v1 PvP games (Arena Minigames, Aim Duel, Lane Duel, Kart Race) that friends launch from a challenge link or a Discord voice-channel Activity. The platform (links, series, head-to-head records) matters more than any single game. Launch target: **Dec 18, 2026**.

## Stack (do not change without the owner's approval)

- TypeScript everywhere, strict mode on
- pnpm workspaces monorepo
- Client: Three.js (WebGL 2), Preact for menus/HUD, Vite
- Server: Node.js LTS with uWebSockets.js; one process hosts many rooms
- Shared game rules: `packages/sim` (runs on client and server)
- Wire format: binary messages defined in `packages/protocol`
- Database: Postgres (Docker locally)
- Tests: Vitest
- Discord: Embedded App SDK (phase 3)

## Repo layout

```text
apps/client/         web client + Discord Activity wrapper
apps/server/         game server + lobby API
packages/sim/        shared, deterministic game rules (no DOM, no Node APIs, no Date.now/Math.random)
packages/protocol/   binary message encode/decode, versioned
games/<name>/        one folder per game: sim rules, client view, assets manifest
assets/              game-ready files only (Git LFS) + LICENSES.csv
tools/               asset build, bots, network chaos settings
docs/                plan, specs, patch notes
```

## Hard rules

1. **Server is authoritative.** Clients send inputs, never results. The server decides hits, scores, item rolls and wins.
2. **`packages/sim` is pure and deterministic.** No `Math.random` (use the seeded RNG passed in), no wall-clock time (use the tick number), no I/O. Same inputs must produce the same state, every time.
3. **Fixed timestep.** Server ticks at 60 Hz (Lane Duel 30 Hz); snapshots go out at 30 Hz. Never tie game logic to frame rate.
4. **Client prediction + reconciliation** for the local player; **interpolation (~100 ms)** for the opponent; **lag compensation (max 200 ms rewind)** for hitscan.
5. **Performance budgets fail the build:** first-load download under 10 MB compressed; steady 60 fps on integrated graphics; each game code-split so it loads only when picked.
6. **Original assets only.** No art, audio, names, characters, maps, items or logos from Riot, Valve, Blizzard, Nintendo or any other company. Every asset in `assets/` needs a row in `assets/LICENSES.csv` (source, license, author, date). When in doubt, use a placeholder primitive and flag it in the PR.
7. **No secrets in the repo.** Use `.env` (gitignored) and document new variables in `.env.example`.
8. **Never push to `main`.** One issue per branch (`<issue-number>-short-name`), one pull request per issue, CI must pass, the owner merges.

## Workflow for an agent

1. Read the issue and its acceptance criteria. If something is ambiguous, ask in the issue instead of guessing.
2. Write or update tests in `packages/sim` before game logic when the change touches rules.
3. Keep PRs small; if the work grows past the issue, stop and propose a follow-up issue.
4. Run the full check locally before opening the PR (see Commands).
5. In the PR description: what changed, how you tested it (including network chaos mode for netcode work), and any asset rows added.

## Commands

Phase 0 (issue: "Scaffold the monorepo") creates these; keep them working afterwards.

```bash
pnpm install          # install everything
pnpm dev              # client + server with hot reload
pnpm test             # Vitest across all packages
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # ESLint + Prettier check
pnpm build            # production build + bundle-size report
pnpm check            # typecheck + lint + test + build (what CI runs)
docker compose up -d  # local Postgres
```

## Network chaos mode

Every real-time feature must be tested with simulated 100 ms latency, ±20 ms jitter and 2% packet loss (`tools/chaos`). A feature that only works on localhost is not done.

## Style

- Small, named functions; no classes in `packages/sim` unless they hold no hidden state
- Prefer plain data (structs/arrays) for game state so it serializes cheaply
- Comments explain *why*, not *what*
- User-facing text is short, plain and friendly
