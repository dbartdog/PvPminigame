# PvP Minigame (working name)

Fast 1v1 PvP games in the browser. Send a friend a link, settle it heads up in seconds. Built for Discord voice channels.

**Launch games:** Arena Minigames · Aim Duel · Lane Duel · Kart Race
**Target launch:** Friday, Dec 18, 2026

## Docs

- [Plan](docs/plan.md): vision, scope, architecture, netcode, roadmap, budgets
- [Agent rules](CLAUDE.md): read before writing any code
- [Specs](docs/specs/): one per phase or game
- [Patch notes](docs/patch-notes.md)

## Getting started (Windows 11 + WSL2)

Prerequisites inside Ubuntu: Node.js LTS (via fnm), pnpm (`npm install -g pnpm`), Git + Git LFS, Docker Desktop with WSL integration on. Node 25 and later no longer include Corepack, so `corepack enable` won't work here.

```bash
git clone https://github.com/dbartdog/PvPminigame.git ~/code/PvPminigame
cd ~/code/PvPminigame
git lfs install
pnpm install
cp .env.example .env    # optional: local overrides
docker compose up -d    # local Postgres
pnpm dev                # client on http://localhost:5173, plus the server
```

Before opening a pull request, run `pnpm check`. It runs typecheck, lint, tests and the production build. See `CLAUDE.md` for the other commands.

## Assets

All art, audio and names are original or properly licensed. Every asset needs a row in `assets/LICENSES.csv`. No assets from existing games.
