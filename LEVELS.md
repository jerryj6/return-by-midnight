# RBM-02..10 — Level authoring notes

Nine rooms following the master §II RBM-D arc (chapters 2 = composition,
3 = interdependence),
designed within the frozen engine semantics (manifest rows + per-beat crew
commands + guard rays + plate/gate machinery + sensors). Verified against
`simulate()` and `RbmEngine.validateAction`/`applyAction`; see
`tests/unit/rbm02-04.test.ts`, `tests/unit/rbm05-07.test.ts`, and
`tests/unit/rbm08-10.test.ts`.

Shared conventions: every level exports `<LEVEL>` (`RbmManifest`), a
`rbmNNReferencePlan()` returning the verified winning `RbmPlan`, a
`rbmNNPlanWithDue(dueBeat)` counterexample builder, and `<LEVEL>_CARD`
(`LevelCard` from `level-card.ts`) carrying `winningTraceSummary` +
`wrongApproaches` (name / summary / expectedFailure).

## RBM-02 — Lights Out, Lights Back (BRIGHT)

The floor lamp's BRIGHT token is lent to the *helper herself*
(`crew-helper.accepts: ["BRIGHT"]`) — a crew member can host a token, so the
light travels on her shoulder. The hall's eye (`sensor-eye`) goes dark at the
loan, the vault's tripwire (`sensor-vault`) wakes only when she arrives
carrying it (beat 4), and the lamp must be lit again at the horizon
(`tokenHome`).

- **Patrol teeth**: hall swept beats 1–2 (cross at 3+); hall + vault swept at
  beat 5 (be outside by then). The exit stays open because the candlestand's
  authored rest on `plate-hold` holds it (`whenPressed: "open"`).
- **Visible dependency**: `sensor-vault` power. Due-4 return fails it (the
  light leaves before she reaches the vault) — this is a *dependency-level*
  failure per the card, not an outcome failure; asserted via event absence.
- Winning due beats: 5 only (due 4 leaves the vault dark).

## RBM-03 — Quiet, Then Quite Loud (NOISY)

Frozen-engine honesty: there is no acoustic verb — the engine's `emitsSound`
flag is inert. The lesson is rendered through what exists: `sensor-ear`
(requiresProperty NOISY) at the listening post powers iff NOISY's *host* is
standing at that cell, so the diversion is the toy arriving at the post and
receiving its rattle back (due 6), producing a real `sensor.power` event.
The patrol is a fixed published table per RBM-007 — no dynamic diversion
exists; the card says so.

- **Mechanical spine**: `prop-toy` rests on `plate-lift` (`whenPressed:
  "close"` on `gate-lift`). Carrying it opens the dumbwaiter; parking it at
  the alcove re-closes the door — the beat-5 ordering (operator exits through
  the still-open gate *the same beat* the helper parks the toy) is the trick,
  because gate state settles at phase 5.
- **Teeth**: gallery swept beats 1–2 (the loud window), pad swept at beat 6
  through `gate-lift` — shut by then, so the ray is dark.
- Wrong approaches cover: stationary return (entityAt + no sensor event),
  early crossing (capture), keep-forever (tokenHome), missed lift window
  (`gate-closed` rejection).

## RBM-04 — The Traveling Owner (HEAVY × motion)

"A fixture moves the home owner automatically" — the engine has no self-
moving props, so the honest mapping is: the *alarm plate's* state tracks the
owner's position automatically. `prop-safe` rests on `plate-alarm`; carrying
it opens `gate-lobby`, and the HEAVY return (due 4) overloads the carrier so
`cargo.settled` (RBM-004) drops the safe *inside the vault* — re-pressing the
plate and slamming the lobby gate behind the crew. The return beat, not the
route, chooses where the owner lands.

- **Visible dependency**: `sensor-vault` (requiresProperty HEAVY) powers only
  once the weight is home at the vault.
- **Wrong approaches are the lesson**: due too early → settles at the gallery
  (the original cell); due too late → settles at the pad (past the vault);
  never return → the safe walks out. Each fails `safe-vaulted` for a distinct
  schedulable reason.
- **Second token**: `TOKEN-B` on `prop-nightlamp` exists only as a legal
  borrower target so the over-budget counterexample exercises the real
  `manifest-over-budget` rejection (single-token levels can only reach
  `overlapping-loan`).

## RBM-05 — One Light, Two Jobs (BRIGHT × sequential reuse)

The floor lamp's BRIGHT token serves *two* recipients: `prop-anchor-north`
and `prop-anchor-south` are loan borrowers that rest on their own thr-2
plates — each plate presses only while the posted light sits on it
(prop mass 1 + `effects.mass` 1), opening that room's exit door for exactly
the loan window.

- **The home interval is forced**: `loanOverlaps` is inclusive of the due
  beat, so a second row may only start ≥ `dueBeat + 1`. Row1
  `TOKEN-B→anchor-north @1~4`, row2 `TOKEN-B→anchor-south @5~6` — the lamp
  sits home during the beat-4 settle, powering `sensor-lamp`
  (requiresProperty BRIGHT) as the observable "home job".
- **Both orders are legal wins**: `rbm05AlternatePlan` borrows for the south
  room first — the master's "two valid order/route strategies" clause.
- Wrong approaches: keep-forever (second door shut + tokenHome), no home
  interval (`overlapping-loan`), door-closed crossing (`gate-closed` at b5),
  early crossing (capture at the b2 pre-move scan).

## RBM-06 — The Door That Pays You Back (one return, two fixtures)

HEAVY posts from `prop-safe` (resting on `plate-anchor`, thr 3) to
`prop-crate` (resting on `plate-lock`, thr 2). While posted: the store
unlocks **and** the front exit bolts (one plate, two targets). The return
inverts everything at once: anchor presses → vault door **and** delivery
window unbar; lock releases → exit opens, store slams.

- **The teammate's route rides the return**: operator can only reach the
  crown after the weight comes home (both vault openings anchor on it), and
  the helper can only leave by the front door for the same reason.
- **Two allocations verified**: reference (helper→store, operator→vault)
  and swapped jobs (`rbm06AlternatePlan`).
- Wrong approaches: keep-forever (exit+vault never reopen), pay-back-early
  (`gate-closed` — store slams with the ledger inside), borrow-from-self
  (`loan-to-own-home`), hall-on-the-beam (capture at b2 pre-move scan).

## RBM-07 — Double Booking (3 crew / 2 tokens / conflict)

Two doors need the same scarce weight: `prop-scale-north` and
`prop-scale-vault` both accept HEAVY and both drive thr-3 plates. `TOKEN-N`
(NOISY, mass 1) posted to `prop-decoy` drives the east door. Three crew,
three idols, three corridors — but HEAVY can only sit on one scale, and the
ledger won't take two rows over the same beats.

- **Resolution**: sequential reuse — north scale @1~4, forced home interval,
  vault scale @5~7. The alternate plan flips the job order (vault first).
- **Teeth**: all three door cells swept through b2 (entries at b3+), hub
  swept at the final scan (everyone outside by b8).
- Wrong approaches: double-booking (`overlapping-loan`), monopolize-the-
  weight (north corridor never opens), forget-the-jingle (`plan.complete`),
  vault-before-the-repost (`gate-closed` at b4), early rush (capture at b1),
  manifest-over-budget.

## Budget/rejection coverage

| Level | maxRows | over-budget rejection tested | overlap rejection tested |
|-------|---------|------------------------------|--------------------------|
| 02    | 1       | n/a (single token → overlap) | yes                      |
| 03    | 1       | n/a (single token → overlap) | yes                      |
| 04    | 1       | yes (`manifest-over-budget`) | yes                      |
| 05    | 2       | n/a (single token → overlap) | yes                      |
| 06    | 1       | yes (`manifest-over-budget`) | n/a (single row)         |
| 07    | 3       | yes (`manifest-over-budget`) | yes                      |
| 08    | 3       | yes (`manifest-over-budget`) | yes (both legs swap)     |
| 09    | 1       | n/a (single token)           | yes                      |
| 10    | 2       | yes (`manifest-over-budget`) | n/a (one row each)       |

## Frozen-engine constraints observed (not patched)

- `lightCells`/`emitsSound` are declared vocabulary consumed by nothing; BRIGHT
  and NOISY couple mechanically only through `sensor.requiresProperty` +
  token-home outcomes and the loan schedule itself. Dependencies are asserted
  via events; outcome-level failures are asserted via predicates.
- No automatic prop movement exists; RBM-04's "traveling owner" is carried by
  crew and the return lands wherever it stands.
- **Scan order**: guards scan at their *previous* post before applying the
  beat's patrol step, then again after moving — so a cell stays hot through
  the beat the beam leaves it. Every patrol table below is authored one step
  "early" so the pre-move scan is already off the crossing window.
- **Settle runs twice per beat**: `settleDevices` fires at the end of
  phase 1 (loans/interactions) AND at phase 5 (after returns). A token
  posted at beat N powers its plates *before* beat-N crew movement — the
  door is live the same beat the loan lands (RBM-07's beat-1 crossings are
  mechanically legal, and only the beams stop them).
- **Settle order**: in phase 5, plate/gate settling runs *before* the
  overloaded-cargo settle — a plate that re-presses because of a settled
  overload registers on the *next* beat's settle (RBM-04 relies on this).
- **Sensor init**: devices start unpowered — a sensor whose required
  property's host is never at its cell emits no `sensor.power`/`unpower`
  transitions; absence is the observable "dependency not met" signal.
- **`restingOn` is positional-agnostic**: a prop authored on a plate counts
  toward that plate's mass wherever it physically stands (until carried);
  RBM-04 uses this for the alarm-plate-follows-the-owner trick.
- Level cards are metadata for the client/UI; the engine ignores them.

## RBM-08 — Last Call (ordered returns compose a chain; 4-crew)

Three properties, one order that works: NOISY must return EARLY (its home
press reopens the bell corridor), HEAVY posts mid-run (the vault scale),
BRIGHT must stay AWAY (its stand holds the north door AND lobby exit shut
while lit — the away-window is the passage window). Swapping the rattle's
due beat with the lamp's breaks both legs of the chain at once.

- **Transition-gated doors (new engine fact)**: gate targets only fire on
  plate press/release TRANSITIONS — so "open while the token is away"
  requires the plate to register the weighted baseline first. The lamp loan
  therefore starts at beat 2, not beat 1: the beat-1 settle records the
  press that the beat-2 release inverts.
- Two complete strategies verified (canonical + earlier-weight/tighter-lamp
  schedule). `coopNote` carries the four-contribution map per GME-007.
- Wrong approaches: swapped due beats (chain collapses), lamp-home-early
  (lobby reseals on the lookout), skip-the-early-return (east never opens),
  entry-during-the-sweep (pre-move scan), over-budget.

## RBM-09 — The Moving Deposit (aim the dormant home)

"Move/aim the receiver while its property is away" mapped onto real
mechanics: the lamp's STAND rests on a thr-1 plate sealing the dark room;
carrying it (carried cargo never rests) opens the door for the operator's
crossing — the carry window IS the enabling act. Park it at the junction,
restore the light, and `sensor-junction` powers at the aimed cell
(`entityAt prop-stand @ cell-junction` makes the aim an outcome; wrong
parking visibly fails).

- **Verb note**: `pickup`/`drop` are separate verbs so the window spans
  beats — the plate must miss the stand for at least one settle.
- Single-token level: over-budget unreachable (documented in the table);
  overlap + keep-forever + wrong-aim + window-miss covered.

## RBM-10 — The Quietest Exit (returns can expose teammates; 4-crew)

Literal exposure via `seg.gatedBy`: the rattle's return presses plate-toy,
unbarring both gallery doors for the runner — AND the west beam's
vestibule segment is gated by `gate-gallery`, so the same opening pours
the beam into the room the lookout just used. Coordinate her exit before
the return lands.

- **Two strategies with an explicit tradeoff**: (A) late return + outside
  window route; (B) early return + inside foyer corridor — earlier gallery
  completion vs a tighter bell-loft window.
- The paired counterexamples prove the causality: the same linger is safe
  when the return never lands (no capture — but the gallery stays shut).
- `coopNote` carries the four-contribution map per GME-007.

## Appendix — designed multiplicity (verified tolerance bands)

**Playtester note:** every band below is measured against the engine (AUTOMATED
verification — mutation sweeps over `dueBeat`/`startBeat`/command timing). Solving
inside a listed band is a *designed alternate*, not a bug and not a shortcut that
needs a report. Report only a variant OUTSIDE these bands that wins, or a listed
alternate that loses. Canonical rows/commands are the committed reference plans.

| Level | Verified alternates (all still win) |
|---|---|
| RBM-01 | Enumerated — 14 manifests → **2 winners, 1 family** (`TOKEN-H→prop-crate` @1–2~3). `startBeat` 1–2 (beat 2 is the committed alternate); helper's beat-2 command also passes at beat 1. |
| RBM-02 | Enumerated — 17 manifests → **12 winners, 1 family**. `dueBeat` 3, 4, 5 all complete — but only **5** powers `sensor-vault`; 3/4 are TOLERATED shortcuts (carded). `startBeat` 2–5. |
| RBM-03 | Enumerated — 21 manifests → **15 winners, 1 family**; the entire legal band wins: every `startBeat` × every offered `dueBeat`. |
| RBM-04 | Enumerated — **2 winners / 20 manifests, 1 family** — the knife-edge: `startBeat` 2 forced, `dueBeat` 4–5. `TOKEN-B` is a proven inert distractor (`maxRows:1` makes it unreachable). |
| RBM-05 | Enumerated — 276 manifests → **12 winners, 1 family**. Row order is swappable (north-first or south-first are both committed alternates); row 0 `startBeat` 2–4, row 1 `startBeat` up to 6. |
| RBM-06 | Enumerated — 20 manifests → **4 winners, 1 family**: `dueBeat` exactly 5; `startBeat` 1–4 free. |
| RBM-07 | Enumerated — **540 winners / 24,128 manifests, 1 family** — the ocean: timing floats enormously on a fixed 3-row routing. Row 0 `dueBeat` 3–4; `TOKEN-H` vault `dueBeat` 3–6 + `startBeat` 2–3; `TOKEN-N` rattle `dueBeat` **3–7 all win** (due 1–2 strands the diversion, `null` fails `noisy-home`). |
| RBM-08 | Enumerated — 5,600 manifests (259 statically eliminated, 0 misses) → **1,485 winners, 1 family**. `TOKEN-B` `dueBeat` 5–7, `startBeat` 3–4 (start 1 fails — the beat-1 settle must register the weighted lamp first); `TOKEN-N` `dueBeat` 3 also wins (due 6 fails); `TOKEN-H` `dueBeat` 5–7, `startBeat` 1–5. |
| RBM-09 | Enumerated — 29 manifests → **12 winners, 1 family**. `dueBeat` 4, 5, 7 (canonical 6); `startBeat` 2–3. The aim is NOT free: `cell-junction` is the only viable landing (aiming `cell-alcove` fails). |
| RBM-10 | Enumerated — 90 manifests (246 statically eliminated, 0 misses) → **60 winners, 1 family**. `TOKEN-N` `dueBeat` 3–4, `startBeat` 2; `TOKEN-B` `dueBeat` ≥6, `startBeat` 2–5; the committed reference and the inside-corridor alternate are both carded routes. |
| RBM-11 | Enumerated — 1,296 manifests → **324 winners, 1 family** (the crossover). Corridor rows `dueBeat` 4–5, `startBeat` 1–3; window rows `dueBeat` 7–8, `startBeat` ≤6 — bound is `late.start > early.due`, not a fixed beat (a start-5 window wins when the early post ends at 4). Committed reference and asymmetric-shift alternate are both in this family. |
| RBM-12 | Enumerated — 92,160 manifests → **33,000 winners, 4 families**: canonical (1,440) `TOKEN-H` `dueBeat` 3–4 / `startBeat` 1–3, `TOKEN-B` `dueBeat` 5–9 / `startBeat` 1–4, `TOKEN-N` `dueBeat` 7–8 / `startBeat` 1–6; plus three **split-posting families** — any single posting may decompose into two shorter loans covering the same beats (`H@1~2 + H@3~3`, `B@1~2 + B@3~5`, `N@1~2 + N@3~7`; `maxRows:4` buys exactly one split). Same choreography — paperwork variants, not new routes. |

**Enumeration status (re-verified refine-8): all 12 levels swept twice —
family counts unchanged (rbm-12 exactly 4, all others exactly 1).** Per-level
sim counts and eliminated-set audits appear in each row above (prefiltered
levels: 259/246/3,388/890 row-sets statically eliminated on 08/10/11/12,
padded spot-checks 0 misses — counts tightened as the prefilter's coverage
model learned the third plate polarity). Every level except RBM-12 has exactly ONE token→host
routing family; no undiscovered alternate routes exist anywhere in the set.
RBM-12 alone has 4 families (canonical + three split-posting variants — same
choreography, paperwork variants). The remaining multiplicity is purely loan
timing.

Loosest spaces by design: RBM-12 (33,000 winners — the loan board is almost
free once the pattern is seen; the finale's real constraint is the door
choreography, not the paperwork), RBM-08 (chain orchestration is the lesson,
not clock arithmetic) and RBM-10 (precision lives in the vestibule lurk, not
the manifest).
The tight non-band is also by design: RBM-02 `dueBeat` ≤2 fails to a lit-hall
capture, and `TOKEN-B` at start 1 in RBM-08 fails outright — transition-gated
doors need the baseline press recorded before a release can invert it.

## Difficulty vectors (AUTOMATED, refine-10)

Per-level complexity from committed data + enum sweep. `density` = winning
manifests / manifests tried (lower = tighter manifest space); `orders`/`crew`
from the committed reference plan; `families` = distinct token→host routings.

| Level | rows | orders | crew | horizon | winners/tried | density | families |
|---|---|---|---|---|---|---|---|
| RBM-01 | 1 | 2 | 1 | 4 | 2/14 | 0.143 | 1 |
| RBM-02 | 1 | 3 | 1 | 5 | 12/17 | 0.706 | 1 |
| RBM-03 | 1 | 7 | 2 | 6 | 15/21 | 0.714 | 1 |
| RBM-04 | 1 | 4 | 1 | 6 | 2/20 | 0.100 | 1 |
| RBM-05 | 2 | 4 | 2 | 6 | 12/276 | 0.043 | 1 |
| RBM-06 | 1 | 7 | 2 | 8 | 4/20 | 0.200 | 1 |
| RBM-07 | 3 | 6 | 3 | 7 | 540/24128 | 0.022 | 1 |
| RBM-08 | 3 | 8 | 4 | 7 | 1485/5600 | 0.265 | 1 |
| RBM-09 | 1 | 8 | 3 | 7 | 12/29 | 0.414 | 1 |
| RBM-10 | 2 | 12 | 4 | 8 | 60/90 | 0.667 | 1 |
| RBM-11 | 4 | 12 | 4 | 9 | 324/1296 | 0.250 | 1 |
| RBM-12 | 3 | 18 | 4 | 9 | 33000/92160 | 0.358 | 4 |

### Read (honest curve report)

The composite curve ramps (orders 2→18, crew 1→4, rows 1→4), but the three
vectors deliberately do NOT move together — this is a non-monotonic design:

- **Manifest tightness peaks mid-game.** The two most constrained levels are
  RBM-07 (0.022) and RBM-05 (0.043) — both earlier than the loosest levels.
  Mid-game is the "precision wall": one family, few winners, and RBM-04's
  startBeat-2 forced point makes it harder than its size suggests.
- **Back half relaxes the manifest, grows the execution.** RBM-09/10/12 are
  the most permissive manifest spaces in the set (0.36–0.67), but the orders
  count climbs 8→12→18 and crew 3→4. Difficulty moves from "find the one
  window" to "coordinate the schedule" — the finale trades tightness for
  breadth (4 families, two live sensors to read).
- **Flagged inversions (by vector, not necessarily by player):** RBM-07 is
  33× tighter on the manifest axis than RBM-09 two levels later; RBM-05 is
  tighter than every level except 07; RBM-10's manifest is looser than
  RBM-02/03's. If playtesters call 05/07 "too hard for their slot", the enum
  data agrees — the wall is real and mid-placed. This is a design stance
  (teach precision, then relax into orchestration), not a ramp defect.

## Scripted solo playtests — RBM-01 & RBM-06 (AUTOMATED, refine-10)

Live-client win + fail probes (`scripts/browser-playtest.ts`):

- **RBM-01** — H→crate @1~3 + helper's two-command run wins; accepted banner.
  Fail probe (due 4, outside the proven {1~3,2~3} windows) fails with
  expected-vs-actual detail; accept correctly withheld.
- **RBM-06** — H→crate @1~5 + the seven-command two-crew run wins; accepted.
  Fail probe (due 4 — enum-proven forced due is 5) fails with detail.

## Manifest-shape audit (refine-11): offerable vs unreachable

Cross-checked all 61 carded approaches' manifests against each level's
`legalDueBeats` band. **60/61 are UI-reachable** (or command-level, which has
no offerability dimension). The one exception — **RBM-10 `bell-shut-early`
required due 2, below its band [3..7,never]** — was doubly misleading: the
nearest *offerable* dues (3–4) complete the run. Recarded as TOLERATED
(due-3/4 win; probe now asserts `succeeds`) and the audit table updated.
New check worth wiring: any carded approach whose mechanism depends on a
manifest field should assert the field value is UI-offerable — a 'ui-offerable'
assertion is meaningful for due beats specifically (the only bounded select).

## Role-necessity sweep — all 12 levels (AUTOMATED, refine-12)

Drop-each-crew's-entire-command-set probe. Every *commanded* crew member is
load-bearing on every level — **30/30 streams required**:

| Level | roster | commanded | all load-bearing? | unused slots |
|---|---|---|---|---|
| RBM-02 | 2 | 1 (helper) | yes | crew-operator (bench) |
| RBM-03 | 2 | 2 | yes | — |
| RBM-04 | 2 | 1 (helper) | yes | crew-operator (bench) |
| RBM-05 | 2 | 2 | yes | — |
| RBM-06 | 2 | 2 | yes | — |
| RBM-07 | 3 | 3 | yes | — |
| RBM-08 | 4 | 4 | yes | — |
| RBM-09 | 3 | 3 | yes | — |
| RBM-10 | 5 | 4 | yes | (1 bench) |
| RBM-11 | 5 | 4 | yes | (1 bench) |
| RBM-12 | 5 | 4 | yes | (1 bench) |

Bench crew (02/04 operator, 10–12's fifth) are scene fixtures, not coopNote
claims — the load-bearing rule applies to *commanded* streams only.

## Due-band edge probe (refine-12)

All 61 carded approaches' manifest dues audited against each level's
`legalDueBeats` band and all start beats against horizons: **100%
UI-reachable now** (the rbm-10 due-2 entry was recarded TOLERATED in
refine-11). No further unselectable-value defects exist in the card set.

## Undo/replay determinism soak (AUTOMATED, refine-15 — scripts/undo-soak.ts)

Per level: winning plan applied via applyAction (commits + orders sorted by
beat), canonicalHash recorded at every prefix. Undo K ∈ {1, 3, all} → hash
must equal the recorded prefix; re-apply popped payloads → hash must return
to tip. Divergence check: undo → plan.reset → hash changes, manifest clears.

| Level | actions | undo-1 | undo-3 | undo-all | diverge |
|---|---|---|---|---|---|
| RBM-01 | 3 | ✓ | ✓(=all) | ✓ | ✓ |
| RBM-02 | 4 | ✓ | ✓ | ✓ | ✓ |
| RBM-03 | 8 | ✓ | ✓ | ✓ | ✓ |
| RBM-04 | 5 | ✓ | ✓ | ✓ | ✓ |
| RBM-05 | 6 | ✓ | ✓ | ✓ | ✓ |
| RBM-06 | 8 | ✓ | ✓ | ✓ | ✓ |
| RBM-07 | 9 | ✓ | ✓ | ✓ | ✓ |
| RBM-08 | 11 | ✓ | ✓ | ✓ | ✓ |
| RBM-09 | 9 | ✓ | ✓ | ✓ | ✓ |
| RBM-10 | 14 | ✓ | ✓ | ✓ | ✓ |
| RBM-11 | 16 | ✓ | ✓ | ✓ | ✓ |
| RBM-12 | 21 | ✓ | ✓ | ✓ | ✓ |

RESULT: PASS — undo+replay deterministic, hash-exact, on all 12 levels.

## Hint-ladder audit, all 12 (refine-15)

Criteria: tier-1 gestures at the mechanic without spoiling numbers; tier-2
names the binding constraint; tier-3 routes to a verified plan. Result:
**36/36 tiers clean — 0 spoilers, 0 vacuous, 0 unverified routes.**
Spot-verified claims via sim: rbm-11's alternative schedule (H@2~4/N@6~7)
WINS; rbm-04 due-4 and due-5 both win (card routes to due-4); rbm-10
N-due-3 alternative WINS (the tolerated bell shortcut).
