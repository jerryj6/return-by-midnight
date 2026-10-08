# RBM Systems Card (bible Part 4 applied)

One-page reference for the frozen engine's actual mechanics. Every claim below is
verified against `src/engine/rbm/` source or scripted playthrough (AUTOMATED).

## Verb table (the whole player vocabulary)

| Verb | Action | Cost / constraint |
|---|---|---|
| Loan | `manifest.commit` row {token, from home, to compatible host, start, due} | ≤ `maxRows`; no same-token overlap; from-home only; due ∈ `legalDueBeats` (null = keep-forever) |
| Choreograph | `command.queue` {beat, crew, command} | command types: `wait`, `move`, `pickup`, `drop`, `pickup-and-move` (with aim) |
| Rewind | `history.undo` | LIFO full-state checkpoint; un-commits rows only after popping everything queued since (sanctioned — RBM-002) |
| Verify | test run (deterministic `simulate`, seeded) | free; produces predicate-level verdict |
| Commit | accept the run | gated: only a *successful* test run can be accepted |

Five command primitives + one manifest verb — the depth is combinatorial, not
verbal (24k+ legal manifests enumerated on rbm-07 alone; exactly one routing
family wins).

## Nouns

cells / edges (optionally `gateId`-gated) / props (`baseMass`, `accepts`,
`restingOn`) / crew (`massLimit`, `accepts`) / guards (patrol `posts` +
`beam` vision segments, optionally `gatedBy` a gate) / tokens (`property`,
`homeEntityId`, `effects`) / manifest rows / devices: plates (press/release
**transition** targets gates: `whenPressed: open|close`), sensors
(`requiresProperty`), gates (`initiallyOpen`).

**Plate polarity has three classes.** Normal plates sit under a *posting* prop
(scale/chime/stand with an `accepts` list) and are pressed while a loan is
hosted. **Home-pressured (inverted) plates** sit under a token's *home* prop
(`restingOn` the `homeEntityId`): pressed only while the token is home, so a
posting *opens the gate when it ENDS* — the return is the key (rbm-12's
`plate-inner`/`gate-inner`, rbm-08's `plate-toy`/`gate-e1`, rbm-10's
`plate-toy`→both gallery doors). An inverted gate's open window is the gap
*between* a token's loans, not inside one; a second posting of the same token
re-locks it mid-window. **Press-to-close ("dark-lamp") plates** target gates
with `whenPressed: "close"`: the gate is open only while the plate is
UNpressed, so on a home prop the door opens while the token is *away on loan*
— the posting itself is the key (rbm-08's `plate-lamp`→`gate-n1`/`gate-lobby`;
posting B's lamp out is what opens the north corridor). Homes are implicit
via `homeEntityId` — home props MUST carry `accepts: []`.

## Property effects (the three tools)

- **HEAVY** — adds declared `mass` while hosted; trips weight plates.
- **BRIGHT** — lights/powers `requiresProperty: BRIGHT` sensors and suppresses
  ungated beams where hosted; `tokenHome` outcomes demand it home by horizon.
- **NOISY** — `emitsSound` on *return* to a host (the diversion is the return
  event, not the loan); `tokenHome` outcomes likewise.

## Resolution order (per beat, deterministic)

loans start → crew commands execute → guards move + scan (scanning the post a
guard *left*, not the one it enters) → returns land → settle (plate transitions
fire gates; sensors evaluate). `history.undo` pops checkpoints outside this loop.

## Rejection precedence (manifest.commit, source order)

`loan-not-from-home` → `loan-to-own-home` → `unknown-host` → `incompatible-host`
→ `start-beat-out-of-range` → `due-beat-not-offered` → `due-before-start` →
`duplicate-row-id` → `overlapping-loan` → `manifest-over-budget`.
(Card `expectedFailure` text must name these strings — enforced by
`check:content`.)

## Balancing heuristics observed in committed levels

- One routing family per level (enumerated rbm-02..07, rbm-11); difficulty
  lives in timing bands and choreography, not routing choice. Exception
  class: rbm-12's `maxRows:4` over 3 required rows buys exactly one
  **split posting** — any single posting may decompose into two shorter
  loans covering the same beats (three extra families, same choreography).
  If a lesson needs an atomic posting, tighten `maxRows`/due options —
  don't write around it in the card.
- Tolerance is sized to the lesson: RBM-02/05/07 are wide (teach the tool);
  RBM-04 is a knife-edge (start=2 exactly); RBM-10 puts precision in the
  vestibule lurk, not the manifest.
- Distractors exist and are legal content: rbm-04 ships `TOKEN-B` unreachable
  under `maxRows=1` — a red herring the enumeration proves never needed.
- New composition patterns shipped on 11/12: the **crossover** (one token
  serves two posts in two windows, forced home interval between them);
  the **return-as-key** (inverted plate — see Nouns); the **one-beat
  snatch** (a crew step inside a single-beat posting window); the
  **scan-before-move opening sweep** (the beat-2 guard scans his beat-1
  post — entry windows open at beat 3, used identically on 11 and 12).
- Gated beams couple outcomes to the manifest: opening a gallery door and
  pouring a beam into the vestibule are the *same* event (rbm-10).

## Feel loop (Part 8 applied)

test run → verdict lists every failed predicate with expected-vs-actual detail
(`describePredicate` + `detail`, all ids named — enforced by `check:content`
§5 UI-text coverage) → edit manifest/commands → re-run → accept gated on
success. `history.undo` is the fast-retry half of the loop; no confirmation
(FLOW-05).
