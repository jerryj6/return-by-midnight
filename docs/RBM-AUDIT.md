# RBM Level Audit — Return by Midnight, levels 01–10

**Standard applied:** `docs/GAME-DESIGN-BIBLE.md` — Part 3 (puzzle design: hint ladders §3.4, wrong-approach legibility §3.5, multi-solution tolerance, reading order), Part 9 (onboarding), Part 10 (LevelCard metadata).
**Evidence class: AUTOMATED (scripted engine playthrough).** Every claim below was produced by executing plans through `simulate()` / `validateRow(s)` in `src/engine/rbm/` — this is an automated playtest, not a human one. No findings are fabricated or extrapolated from reading alone.
**Method:** `audit-work/rbm-audit.ts` replays each committed reference + alternate trace, re-runs determinism, replays every carded `wrongApproach` against the *asserted* mechanism (specific rejection reason, capture event, dark sensor, failed outcome — not merely `success === false`), then sweeps degenerate mutations over the verified plan (dueBeat / startBeat per row, command drops, ±1-beat retimes, host swaps among compatible acceptors).
**Result totals: 86 pass / 2 fail / 89 warn.** The two fails are card-content defects, not engine defects. The 89 warns consolidate to four classes, listed under Systemic Issues.

---

## Per-level findings

### RBM-01 — Weight of Evidence (tutorial, Part 9)
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference trace | PASS | succeeds @horizon 4, 25 events, deterministic hash `5ef8d331…` | — |
| Alternate trace (startBeat 2) | PASS | identical hash — claimed committed alternate | — |
| LevelCard coverage | WARN | no `CARD` export; only level without one | Optional: add a minimal tutorial card (see §10.3: exempt-by-convention is fine, but the convention should be written down once) |
| Command timing | WARN | helper's beat-2 command retimed to beat 1 still wins | Fine — tutorial slack is correct per §9 (low retry cost). No change. |

### RBM-02 — Lights Out, Lights Back
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference trace | PASS | succeeds @horizon 5, deterministic `87d2d497…` | — |
| keep-forever (due null) | PASS | `bright-returned` fails; no `sensor.power` on sensor-eye after beat 4 — as carded | — |
| **early-return (due 4)** | **FAIL** | **`evaluation.success === true`** — the vault sensor never powers (carded part is true) but **the contract still completes**. Also `due 3` wins. The card lists this under `wrongApproaches`, but mechanically it is a *tolerated shortcut*, not a failure — bible §3.5's silent-success trap: the lesson goes unenforced and the winning player never sees the tripwire | `diffs/rbm02-card-fix.md` — mark it TOLERATED in the card text, or gate `sensor-vault` behind an outcome (level-author decision) |
| skip-the-loan (empty manifest) | PASS | `plan.complete` observation fails — as carded | — |
| cross-under-the-beam | PASS | `guard.capture` on crew-helper; `crew-safe` fails — as carded | — |
| double-booking | PASS | `validateRow` → `overlapping-loan` — as carded | — |
| Loan tolerance | WARN | due 3,4,5 all win; startBeat 2–5 all win | Only due<3 fails (light home early → lit hall during crossing → capture). The load-bearing window is *due ≥3*; the *taught* value 5 is the only one that wakes sensor-vault. Document the band in the card |
| Start timing | WARN | startBeat 2–5 all win | startBeat is never load-bearing here; only the return matters. Acceptable multiplicity — card should say so |

### RBM-03 — Quiet, Then Quite Loud
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference trace | PASS | succeeds @horizon 6, deterministic `6c6e28a8…` | — |
| stationary-return / loud-window / keep-forever / missed-lift-window | PASS ×4 | each fails for the carded mechanism | — |
| double-booking | PASS | `overlapping-loan` — as carded | — |
| Loan tolerance | WARN | due 4,5,6 all win; startBeat 2–6 all win | The NOISY loan's only load-bearing knob is *due ≥4*; the diversion is carried by the parked-toy re-ring, not the loan window. By design (the toy must be quiet while carried), but the card frames beat-6 return as THE solution — worth one tolerance line |

### RBM-04 — The Traveling Owner
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference trace | PASS | succeeds @horizon 6, deterministic `eb9afc70…` | — |
| All 6 wrongApproaches | PASS | incl. `manifest-over-budget` correctly reached by TOKEN-B→crew-operator extra row (accepts BRIGHT) | — |
| Loan tolerance | WARN | due 4,5 win; helper beat-6 command retimes to 5 | Minor slack; acceptable |

### RBM-05 — One Light, Two Jobs
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference + order-swap alternate | PASS | identical hash `fd196e68…` — true committed multiplicity | — |
| one-loan-two-rooms / door-closed-crossing / early-crossing / no-home-interval | PASS ×4 | carded mechanisms reproduce | — |
| **manifest-over-budget** | **FAIL** | Card claims `manifest-over-budget`. **Unreachable**: the single token's window is fully booked by the two committed rows (@1~4, @5~6), so any in-range third row is `overlapping-loan`; `@7~null` is `start-beat-out-of-range`. The committed test itself asserts `overlapping-loan` ("for budget coverage see RBM-07") — the card text contradicts the test | `diffs/rbm05-card-fix.md` — expectedFailure → `overlapping-loan` wording |
| Timing tolerance | WARN | row[0] start 2–4, row[1] start 6, three ±1 retimes all win | Wider than carded; note in card |

### RBM-06 — Under Borrowed Weight
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference trace | PASS | `1e56aa57…` | — |
| Alternate (jobs-swap) | PASS | succeeds, **different final hash** `520f52bc…` — lands a genuinely different end state | Good: real multi-solution, exactly what the card claims |
| All 5 wrongApproaches | PASS | incl. `manifest-over-budget` via non-overlapping second row @6~null (budget check lands before host-compat — as carded) | — |
| Tolerance | WARN | starts 2–4, three ±1 retimes win | Note in card |

### RBM-07 — Double Booking
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference + alternate | PASS | `fd315d06…` | — |
| All 6 wrongApproaches | PASS | incl. correctly carded `manifest-over-budget` | — |
| Loan tolerance | WARN | row[0] due 3–4, row[2] due 3–6 and start 2–3 all win | The NOISY jingle's "all run long" framing isn't binding — its effective window is much narrower. Card the tolerance or tighten |

### RBM-08 — Last Call
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference + tighter-window alternate | PASS | `60db5240…` | — |
| All 5 wrongApproaches | PASS | incl. `manifest-over-budget` | — |
| Tolerance | WARN | due 5/7 on rows 0 & 2, starts 3–4/2/1–3/5, six ±1 retimes win | Widest tolerance in the set; the two-token interplay stays load-bearing but individual windows are loose |

### RBM-09 — The Moving Deposit
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference trace | PASS | `135acece…` | — |
| All 5 wrongApproaches | PASS | incl. `overlapping-second-loan` (maxRows 1 → single-token overlap, as carded) | — |
| Tolerance | WARN | due 4,5,7 win (ref 6); starts 2,3 win; four ±1 retimes | The aim-window narrative implies tighter timing than enforced |

### RBM-10 — The Quietest Exit
| Item | Result | Evidence (AUTOMATED) | Proposed fix |
|---|---|---|---|
| Reference + inside-corridor alternate | PASS | `de908fbd…`; alternate emits 63 vs 62 events but same hash — a real route variant | — |
| All 5 wrongApproaches | PASS | incl. `manifest-over-budget` (TOKEN-N→decoy @6~null, legal due) | — |
| **Trace non-minimal** | WARN | **dropping crew-lookout's beat-3 command still completes** — the committed reference trace carries a dead action | Either tighten the committed trace or confirm the vestibule visit is required under a different ordering; content-side fix |
| Tolerance | WARN | due 3,4 / 6 on rows 0,1; starts 2 / 2–5; eight ±1 retimes win | Loosest in the set — final level should probably *demand* the most precision, not the least |

---

## Top 5 systemic issues

1. **Carded wrongApproaches can be tolerated shortcuts, not failures (silent-success class, §3.5).** RBM-02's `early-return` is the confirmed instance: the run completes, only the teaching marker is lost. Any `wrongApproaches` entry whose mechanism is event-absence rather than outcome-failure must be labeled `tolerated` — otherwise cards overstate enforcement. Sweep found none worse than rbm-02, but the *class* is now proven to exist.
2. **Card `expectedFailure` text drifts from the engine's actual rejection.** RBM-05 cards `manifest-over-budget` where only `overlapping-loan` is reachable. Tests assert the *mechanism* but not the *card string*; a card-vs-engine consistency check (run each carded approach, compare the produced reason to the carded text) would catch this class automatically — recommend adding it to `check:content` scope.
3. **Hint coverage is incomplete and asymmetric.** `RBM_HINTS` (src/client/hints.ts) covers only rbm-01..04 — levels 05–10 ship no hint ladder at all, and RBM's `LevelCard` schema has no `hints` field (PFT cards do). Players hitting rbm-05+ have nothing between "stuck" and "read the test file." See `diffs/rbm-hints-05-10.md` for drafted tiers.
4. **Loan timing is looser than cards imply.** In 8 of 10 levels, `startBeat` is fully non-load-bearing, and most `dueBeat` windows tolerate ±1–3 beats; ±1-beat command retimes win almost everywhere. Either the tolerance is *designed* multiplicity (then cards should say so, per §3's multiplicity documentation rule) or the difficulty ceiling is lower than authored. Currently undocumented either way.
5. **Metadata coverage gaps.** RBM-01 has no card; only rbm-08 and rbm-10 carry `coopNote`. If the pattern is "tutorial exempt, co-op note only where co-op changes the solve," that convention should be written in the card schema doc — today it looks like an accident.

### What verified clean
All 10 reference traces + 5 committed alternates execute successfully and deterministically (hash-stable across runs). 48 of 50 carded wrongApproaches reproduce their *asserted* mechanism exactly. The engine's rejection precedence (overlap → due-legality → budget → host-compat) is consistent and, where carded correctly (rbm-04/06/07/08/10), the budget row lands as documented.
