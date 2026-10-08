# Return by Midnight

A browser puzzle game — property-loan scheduling heist.

Borrow properties (HEAVY/BRIGHT/NOISY) from museum objects; schedule their returns to close doors, press plates, and finish the job before midnight.

- **12 authored main levels** (solo campaign) + optional mastery extras
- **Live 2–4 player co-op**: host a room, share the code; every command resolves on the authoritative server and replays deterministically on every client
- Generated art (per-game art bible) + procedural WebAudio cues

## Run

```bash
npm ci && npm run build && npm start   # serves site + ws rooms on :10000
npm run dev                            # vite dev server (client only)
npm run dev:server                     # room server dev
```

## Verify

```bash
npm run check:source && npm run check:static
npm run test:unit && npm run test:campaign && npm run test:depth && npm run test:network && npm run test:e2e
npm run audit:assets && npm run audit:release
npm run verify:production --url https://<deployed> --sha <commit>
```

## Layout

- `src/engine` — pure deterministic rules (no DOM/network/time)
- `src/content/levels` — 12 authored levels + LevelCards (RBM-01 … RBM-12)
- `src/client` — React UI · `src/server` — ws room server
- `public/assets` — generated art (sprites/, covers, materials); `art/manifests/assets.json`
- `docs/` — MASTER-HANDOFF (binding contract), REQUIREMENTS, DECISIONS, AUDIO-MANIFEST, PLAYTEST-KIT
- `evidence/INDEX.md` — verification evidence index
