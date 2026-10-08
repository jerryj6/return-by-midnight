# Return by Midnight — Submission Kit

Prepared for manual entry by the owner. Everything below is stated against
the actual build in this repository; pending items are flagged **PENDING**.

> **Sourcing note:** `docs/GAME-DESIGN-BIBLE.md` was not included in the ref
> snapshot this kit was authored from. The five presentation rules below were
> extracted from `docs/MASTER-HANDOFF.md` (competition-positioning and
> release sections). Reconcile with the bible before final submission.

## 1. Game identity

- **Title:** Return by Midnight
- **One-line pitch:** A property-loan scheduling heist — borrow what the
  museum's objects can do, and get every loan back before midnight.
- **Genre:** Browser puzzle game (temporal planning / scheduling heist)
- **Tagline candidates:**
  1. "Borrow the property. Keep the deadline."
  2. "Everything must be back by midnight — including your alibi."
  3. "A heist where the loot is a verb."
- **Description (≈80 words):**
  Tonight's crew can borrow HEAVY, BRIGHT, NOISY from the museum's exhibits —
  but the ledger is watching. In Return by Midnight you write the loan
  manifest yourself: every borrowed property rides a window, presses a
  plate, holds a gate, then comes home before its due beat. Twelve authored
  heists, solo or live 2–4 player co-op, on a deterministic engine where
  every plan replays identically.
- **Description (20 words):**
  Scheduling-heist puzzle: loan out properties on a manifest, hold the doors,
  and return every borrowed verb before midnight.
- **Controls summary:** Mouse or touch only. Fill the loan manifest
  (`loan-token`, `loan-start`, `loan-to`, `loan-due`, `commit-row`), queue
  crew orders per beat, then `test-run` the plan and `accept-result` when
  every loan lands home. `undo`, `reset-plan`, and hints sit on the board.
- **Solo:** `play-solo` → pick a level (`level-rbm-01` … `level-rbm-12`) →
  build the manifest + orders → `test-run` → `accept-result`.
- **Co-op (2/3/4 players):** `play-coop` → lobby → `Host a room (<level>)` →
  share the room code; teammates `Join` with it. Every order lands on every
  planner's board through the authoritative server.
- **Browser requirements:** Modern desktop or mobile browser with WebGL and
  WebSocket support (Chrome/Edge/Firefox/Safari, current). No install, no
  account.
- **Tech stack (truthful):** TypeScript, Vite, React client, PixiJS scene
  renderer, `ws` WebSocket room server on Node, vitest/fast-check test
  suite, Playwright e2e.

## 2. Play instructions (for a judge)

- **Hosted:** open `<DEPLOYED-URL>` — site and room server share one port.
- **Local fallback:** `npm ci && npm run build && npm start`, then open
  `http://localhost:8787` (server listens on `PORT`, default 8787). `npm run build` emits the client `dist/`, the
  server bundle, and `dist/build-id.json` = `{ sha, builtAt,
  game: "return-by-midnight" }` — verify the SHA against the submitted
  commit.
- **60-second path:** `play-solo` → `level-rbm-01` → commit the manifest
  rows and queue orders → `test-run` → `accept-result`. Expected: the
  accepted banner and a completed ledger.

## 3. Assets checklist

- [ ] **Cover art** — `public/assets/rbm-cover.png` exists at **1672×941**;
      **PENDING:** export the final submission cover at **2400×1350**.
- [ ] **Screenshots** (≥1920×1080, fresh profile):
  - Title — `/` with `play-solo`/`play-coop` visible.
  - Level select — grid of RBM-01…RBM-12 after `play-solo`.
  - Gameplay — RBM-01 mid-plan: manifest rows committed, order queue,
    `test-run` result visible.
  - Co-op room — lobby with live room code; second device mid-join if
    available (do not composite).
- [ ] **Trailer (30–60s, 10 beats):**
  1. Night-establishing shot: museum, crew staging.
  2. The problem: door sealed, guard pattern on beat.
  3. Text card: "Borrow the property."
  4. Fill a manifest row — HEAVY loaned to the statue.
  5. Queue the crew's beats.
  6. `test-run` — plates press, gates hold, loan returns.
  7. `accept-result` — heist lands, ledger balances.
  8. Later-level glimpse (multi-crew, tight windows).
  9. Co-op: two boards, one plan, live.
  10. Title card + URL + credits.
  Real footage only; no composited multiplayer, no unimplemented scenery.

## 4. Truthfulness (required reading before submitting)

- All in-game art is **AI-generated** under a documented per-game art bible;
  provenance in `art/manifests/assets.json` (generator, per-asset prompt
  log, cutout tooling).
- The engine is **deterministic** — identical plans produce identical final
  hashes; verified by the property/campaign test suite.
- **Playtests: PENDING (gate G5).** No human playtest sessions conducted or
  claimed. No tester quotes, difficulty claims, or player-reaction copy.
- Claims to keep verbatim-true: 12 authored levels, solo + 2–4 player live
  co-op, no-install browser play, deterministic replay.
- Claims to avoid: human playtest results, "hand-drawn" art, unreachable
  features.

## 5. Platform & submission

**itch.io upload checklist**
- [ ] Project page: title, tagline #1, 80-word description
- [ ] Kind: HTML / browser game; viewport 1280×800, embed enabled
- [ ] Upload zipped `dist/` or link the hosted deployment URL — confirm the
      surface accepts external-URL entries
- [ ] Cover: 2400×1350 final (from current 1672×941 source)
- [ ] Screenshots ×4, trailer video
- [ ] Tags: `puzzle`, `heist`, `scheduling`, `logic`, `co-op`,
      `browser-game`, `singleplayer`, `multiplayer`
- [ ] Team credits: **Devin (Cognition AI)** — design, engineering, art
      direction; **owner** — direction, review, submission.
- [ ] Truthfulness note (section 4) in the description footer
- [ ] Manual submission only — owner clicks submit.
