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

Prerequisites inside Ubuntu: Node.js LTS (via fnm), pnpm (via `corepack enable`), Git + Git LFS, Docker Desktop with WSL integration on.

```bash
git clone https://github.com/dbartdog/PvPminigame.git ~/code/PvPminigame
cd ~/code/PvPminigame
git lfs install
pnpm install        # available after Phase 0
docker compose up -d
pnpm dev
```

The real commands land with the Phase 0 scaffold; see `CLAUDE.md` for the full list.

## Assets

All art, audio and names are original or properly licensed. Every asset needs a row in `assets/LICENSES.csv`. No assets from existing games.
