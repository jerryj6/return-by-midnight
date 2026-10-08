# Return by Midnight — what a judge sees in 60 seconds (honest review)

**0–10s.** Title screen with generated art and two entry points
(`play-solo`, `play-coop`). The museum-at-night mood carries the heist
promise immediately; the 1672×941 cover exists but the 2400×1350 final is
still pending.

**10–25s.** Level select lists the full twelve-heist campaign. RBM-01 opens
to a legible scene: crew, manifest panel, and the ledger framing that sells
"borrow, schedule, return."

**25–50s.** The distinctive verb lands: writing a loan row — which object,
which property, out on which beat, due back when — then queuing crew orders
and hitting `test-run`. Watching a borrowed HEAVY press a plate while its
window ticks down is the game's identity, and it reads on first contact.

**50–60s.** `accept-result` closes the ledger. Beyond: undo, reset-plan,
hints, and the co-op lobby with room codes.

## Honest weak spots

- **The manifest is the steepest first-contact concept.** "Loan a property"
  is the whole game and it's genuinely novel — which means a judge may need
  RBM-01's guided row before the metaphor clicks. Hints exist; the first
  level teaches, but a skim-reader can miss the due-beat idea until a loan
  strands.
- **Less immediate spectacle than its siblings.** The payoff is a clean
  schedule, not a visual explosion; the trailer's beats 4–7 must show the
  test-run animation clearly or the pitch undersells.
- **Co-op discoverability** — same as siblings: `play-coop` works, but a
  one-device judge won't see multiplayer unless the trailer shows it.
- **Playtests pending (G5)** — pacing and difficulty are designed, not
  player-validated; kit copy must not imply otherwise.

## The 5 presentation rules applied (sourced from MASTER-HANDOFF.md §4 + release sections)

1. **Real footage only** — every trailer beat maps to shipped UI; no
   composited multiplayer, no unimplemented scenery.
2. **Every claim checkable** — kit cites real testids/verbs, the real build
   (`dist/build-id.json` SHA), flags pending items.
3. **Judge path ≤60s** — URL → `play-solo` → RBM-01 → accepted ledger with
   zero setup.
4. **Plain-language differentiation** — "borrow the property, keep the
   deadline" — a scheduling heist, not another block-pusher.
5. **Truthful evidence map** — 12 levels, deterministic replay, live 2–4
   co-op verified; playtests + final cover res marked PENDING.
