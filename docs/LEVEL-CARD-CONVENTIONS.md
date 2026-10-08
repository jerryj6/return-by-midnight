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
| RBM-07 | row 0 `dueBeat` 3–4; row 2 `dueBeat` 3–6 and `startBeat` 2–3 (the "all run long" jingle framing is not binding); four ±1 retimes. |
| RBM-08 | row 0 `dueBeat` 5–7, `startBeat` 3–4; row 1 `dueBeat` ≥3, `startBeat` 2; row 2 `dueBeat` 5–7, `startBeat` 1–5; six ±1 retimes. Widest in the set. |
| RBM-09 | `dueBeat` 4,5,7 win (ref 6); `startBeat` 2,3 win; four ±1 retimes. |
| RBM-10 | row 0 `dueBeat` 3–4, `startBeat` 2; row 1 `dueBeat` ≥6, `startBeat` 2–5; **lookout's beat-3 foyer visit is droppable** (trace non-minimal); eight ±1 retimes. Loosest in the set — worth a look since the finale should demand *more* precision, not less. |

Policy: where a tolerance is *designed* multiplicity, add one "Tolerance note" line to the
card's trace summary. Where it undercuts the taught lesson (rbm-02's dark tripwire), the
card marks the shortcut `TOLERATED`.

## 4. Enrichment fields (optional, PFT-style)

Cards may carry `insight`, `naiveApproach`, and `solutionPolicy` — see the interface
comments in `src/content/levels/level-card.ts`. All are documentation-only; no engine or
client surface consumes them yet.
