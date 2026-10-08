# Return by Midnight

A browser heist-tactics game — simultaneous turns in a toy museum.

Each turn, every crew member plans a path of up to 3 tiles plus an optional
property loan (HEAVY/BRIGHT/NOISY, lent from its home object to another
object). Guards telegraph their next move; everything resolves at once; loans
snap home after N turns. The heist fails if a crew member is seen, if midnight
arrives, or if a loan isn't home when the heist ends. Grab the prize, get the
whole crew out.

- **3 authored levels** (L1–L3) with authored solutions
- **Live 2–4 player co-op**: host a room, share the code; plans lock in per
  seat and resolve on the authoritative server (locked plans stay hidden)

## Run

```bash
npm ci && npm run build && npm start   # serves site + ws rooms on :10000
npm run dev                          # vite dev server (client only)
npm run dev:server                   # room server dev
```

## Verify

```bash
npm run check:source && npm run check:static
npm run check:content    # replays authored solutions, must all win
npm run test:unit && npm run test:network && npm run test:e2e
npm run audit:assets && npm run audit:release
npm run verify:production --url https://<deployed> --sha <commit>
```

## Layout

- `docs/HEIST-RULES.md` — authoritative rules
- `src/engine/heist` — pure deterministic rules (no DOM/network/time)
- `src/content/heist` — level definitions + authored solutions
- `src/client` — React UI · `src/server` — ws room server
- `public/assets` — generated art; `art/manifests/assets.json`
- `docs/` — MASTER-HANDOFF (binding contract), REQUIREMENTS, DECISIONS
- `evidence/INDEX.md` — verification evidence index
