# Level-card & hint conventions (RBM)

Written down once, so the pattern stops looking accidental. All findings below are
AUTOMATED evidence (scripted engine playthrough, `scripts/card-vs-engine.ts` and
the audit sweep) — not human playtest.

## 1. Card coverage

| Convention | Rule |
|---|---|
| Tutorial exemption | **RBM-01 ships no `LevelCard`** — its beat-by-beat sequence is the tutorial itself; the teaching trace lives in `RBM_HINTS["rbm-01"].solution` instead. Every post-tutorial level (02–12) MUST export a card with ≥1 `winningTraceSummary` line and ≥1 `wrongApproaches` entry. Enforced by `scripts/validate-content.ts`. |
| Card id | `card.levelId` equals the lowercase index id (`"rbm-02"`), the `CARDS` map key is uppercase (`"RBM-02"`). |
| coopNote | Only on designated co-op levels (GME-007): currently RBM-08 and RBM-10. Four entries = four distinct contribution types (two manifest owners + route operators + a warden). Other levels omit it — solo design is the default, not a gap. |

## 2. `expectedFailure` honesty rules

- The field describes what the ENGINE does to the approach, not what the designer wishes.
- An approach that **succeeds anyway** is a tolerated shortcut: the text must start
  `TOLERATED SHORTCUT` and describe the teaching loss (precedent: RBM-02 `early-return`).
- A manifest-rejected approach's text must name the rejection reason the engine actually
  produces (`overlapping-loan`, `manifest-over-budget`, `incompatible-host`,
  `loan-to-own-home`, `start-beat-out-of-range`). Rejection precedence is
  overlap → due-legality → budget → host-compat, so the *first* failing check is the
  truth (precedent: RBM-05, where `manifest-over-budget` is unreachable because the
  token's window is fully booked).
- `scripts/card-vs-engine.ts` enforces both rules: a carded approach that produces a
  mechanism the carded text doesn't name fails the check.

## 3. Timing tolerances (measured, AUTOMATED)

The committed reference plans overstate precision in several places. These tolerances
are *verified* — mutation sweeps over due/start beats and ±1-beat command retimes.
Authors may either tighten the level or document the band; silent looseness is the bug.

| Level | Verified tolerance |
|---|---|
| RBM-01 | `startBeat` 1–2 both win (the second is the committed alternate); helper's beat-2 command also passes at beat 1. |
| RBM-02 | `dueBeat` 3,4,5 all complete — but only **5** powers `sensor-vault` (3/4 = TOLERATED shortcuts). `dueBeat` ≤2 fails (lit-hall capture). `startBeat` 2–5 all win. |
| RBM-03 | `dueBeat` 4,5,6 all win; `startBeat` 2–6 all win — only the *return* beat matters. |
| RBM-04 | `dueBeat` 4,5 win; helper's beat-6 command passes at 5. |
| RBM-05 | row 0 `startBeat` 2–4; row 1 `startBeat` up to 6; three ±1 command retimes pass. |
| RBM-06 | `startBeat` 2–4; three ±1 retimes pass. |
| RBM-07 | row 0 `dueBeat` 3–4; `TOKEN-N` rattle `dueBeat` 3–7 all win — due 1–2 fails the diversion, `null` fails `noisy-home` (the "all run long" framing is not binding); `TOKEN-H` vault row `startBeat` 2–3; four ±1 retimes. |
| RBM-08 | `TOKEN-B` `dueBeat` 5–7, `startBeat` 3–4 (start 1 fails: the beat-1 settle must register the weighted lamp first); `TOKEN-N` `dueBeat` 3 also wins but due 6 fails — early return required; `TOKEN-H` `dueBeat` 5–7, `startBeat` 1–5; six ±1 retimes. Widest in the set. |
| RBM-09 | `dueBeat` 4,5,7 win (ref 6); `startBeat` 2,3 win; four ±1 retimes. |
| RBM-10 | row 0 `dueBeat` 3–4, `startBeat` 2; row 1 `dueBeat` ≥6, `startBeat` 2–5; eight ±1 retimes. Still the loosest timing band in the set — designed multiplicity, kept deliberately (the finale's precision lives in the vestibule lurk, not the manifest). Trace was made minimal in refine-2 (see §5). |

Policy: where a tolerance is *designed* multiplicity, add one "Tolerance note" line to the
card's trace summary. Where it undercuts the taught lesson (rbm-02's dark tripwire), the
card marks the shortcut `TOLERATED`.

## 5. Refine-2 engine-semantics findings (AUTOMATED)

- **RBM-10 committed traces made minimal.** The lookout's beat-3 foyer visit was dead
  time: `pad-out↔cell-vestibule` is a direct edge and her vestibule lurk only needs to
  be in place by beat 5. Removed from both `rbm10ReferencePlan` and
  `rbm10AlternatePlan`; card trace + `solutionPolicy` updated. Tightening was
  considered (cut the `pad↔vest` edge, forcing pad→foyer→vest): the reroute's
  feasibility depends on `gate-gallery` opening and the ungated `beam-foyer` window
  (guard-1 sits west at beats 6–7), and removing an edge changes the level's geometry
  and identity — a level-author call, not a card-side fix. Minimal trace chosen.
- **CoopNote roles verified non-degenerate (AUTOMATED).** Per-role command-removal
  probes on rbm-08/10: dropping any manifest row or any crew member's entire command
  set fails the run. rbm-10 is a clean 1:1 — helper=bell, runner=gallery,
  operator=attic, lookout=vestibule, each owning exactly one outcome.
- **`history.undo` across `manifest.commit` — RULING: sanctioned, not a loophole.**
  Checkpoints are LIFO full-state snapshots pushed on every non-undo action. Undoing
  past a committed row cleanly un-commits it — but only after popping every action
  queued since, so a player cannot surgically un-commit a loan while keeping its
  downstream effects (verified: commit → queue → undo pops the command, then the
  row). The spec *intends* this: RBM-002 ("Players may undo a committed beat through
  the ordinary history mechanism"), GME-010 (undo a mistake and retry quickly), and
  FLOW-05 (ordinary undo requires no confirmation) all treat the manifest as a plan
  under edit, not an irrevocable contract — a loan row is only binding once the run
  is tested and *accepted*. A mid-window undo is therefore a legal rewind of your
  own paperwork, and the listed edge case "undo across return" (MASTER-HANDOFF
  verification table) is expected to work. Engine behavior is correct; no change.
- **Degenerate-solve sweep rbm-06/07/09 clean.** Dropping any single crew member's
  commands or any manifest row from the committed plans fails the run; no
  single-crew or row-less shortcut exists.

## 6. Enrichment fields (optional, PFT-style)

Cards may carry `insight`, `naiveApproach`, and `solutionPolicy` — see the interface
comments in `src/content/levels/level-card.ts`. All are documentation-only; no engine or
client surface consumes them yet.
