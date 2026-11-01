# Spec: Phase 0 — Foundation (Nov 2 to Nov 8)

Goal: an empty-but-real game platform. By the end of the week, two browser tabs connect to a local game server, join the same room by link, and exchange inputs at a fixed tick, with tests and CI guarding all of it. No real game yet.

## Deliverables

### 1. Monorepo scaffold
- pnpm workspaces with `apps/client`, `apps/server`, `packages/sim`, `packages/protocol`, `games/`, `tools/`
- Shared `tsconfig.base.json` (strict), ESLint + Prettier, Vitest
- Root scripts: `dev`, `test`, `typecheck`, `lint`, `build`, `check` (see CLAUDE.md)
- `docker-compose.yml` with Postgres 16+ and a named volume; `.env.example`

### 2. Shared simulation core (`packages/sim`)
- `Sim<State, Input>` contract: `init(seed) -> State`, `step(state, inputs[2], tick) -> State`, `isOver(state) -> winner | null`
- Seeded RNG utility (e.g. a small PCG or xorshift) passed into `step`
- Fixed-timestep accumulator helper used by both client and server
- Determinism test: run 10,000 ticks of a toy sim twice with the same seed and inputs; final state hashes must match

### 3. Protocol (`packages/protocol`)
- Versioned binary encoding with a 1-byte message type and a protocol version in the handshake
- Messages: `Hello`, `Welcome`, `JoinRoom`, `RoomState`, `Input` (tick + payload), `Snapshot` (tick + payload), `Ping`/`Pong`, `Error`
- Round-trip encode/decode tests for every message

### 4. Room server (`apps/server`)
- uWebSockets.js server; rooms keyed by a short, URL-safe code (6+ chars, no ambiguous characters)
- `POST /rooms` creates a room and returns its code; rooms expire after 30 minutes idle
- Room runs the toy sim at 60 Hz, relays snapshots at 30 Hz, measures each player's RTT via Ping/Pong
- Guest identity: server issues a signed device token on first `Hello`; display name chosen by the player
- Health endpoint `GET /health`

### 5. Client shell (`apps/client`)
- Vite + Preact app: home screen (enter name, Create challenge), room screen (copy link, waiting, connected)
- Opening `/r/<code>` joins that room directly
- Three.js canvas mounted but showing only a placeholder scene
- Debug overlay: FPS, frame time, RTT, tick, snapshot age

### 6. Network chaos mode (`tools/chaos`)
- A WebSocket proxy (or client/server shim) that adds configurable latency, jitter and packet loss
- Default profile: 100 ms ±20 ms, 2% loss; toggled by an env var or URL flag in dev only

### 7. CI (GitHub Actions)
- On every PR: install, `pnpm check`, determinism test, bundle-size report (fail if client initial JS > 500 KB gzipped for now)
- Cache pnpm store

## Acceptance criteria

- [ ] `pnpm install && pnpm dev` works on a fresh WSL2 Ubuntu clone with only Node LTS, pnpm and Docker installed
- [ ] Two tabs (one in a private window) can create and join a room by link and both see the opponent's name and live RTT
- [ ] The same works with chaos mode on, without errors or disconnects over 5 minutes
- [ ] Determinism test passes; protocol round-trip tests pass
- [ ] CI runs on a PR and blocks merge on failure
- [ ] README "Getting started" section updated with the real commands
