# RBM engine — implementation report

Deliverable: deterministic rules engine for **Return by Midnight** (RBM-01 "The Weight of Evidence"), per `DEVIN-CLOUD-MASTER-HANDOFF.md` (sha256 `9eafb3af…eea7`, per `HANDOFF-VALIDATION.json`).

## File list

| Path | Contents |
|---|---|
| `src/engine/contracts.ts` | Shared `DeterministicEngine` contract — copied **verbatim** from the dispatch (master §3.3 asks for the same shapes; no naming conflict found). |
| `src/engine/rbm/types.ts` | Level manifest, entities, devices, tokens, plan/command, sim-state types. |
| `src/engine/rbm/sim.ts` | `simulate(manifest, plan, seed)` → event-annotated timeline; `stableStringify`/`sha256` helpers. |
| `src/engine/rbm/engine.ts` | `RbmEngine implements DeterministicEngine<RbmManifest, RbmPlayState, RbmAction>`; planning commits, TestRun, undo, replay/save records, canonical hash. |
| `src/content/levels/rbm01-weight-of-evidence.ts` | RBM-01 manifest + reference/alternate/parameterized plans (data, not special-cased). |
| `tests/unit/rbm01.test.ts` | 17 vitest assertions covering all eight required checks plus supporting spec checks. |
| `package.json`, `tsconfig.json` | Toolchain (strict TS). |

## Spec compliance map

- **RBM-001** token conservation/immutable home: one `hostEntityId` per token; home identity follows the home entity (`token.return` event carries `homeCellId` = the moved safe's cell). Tested in (f), (h).
- **RBM-002** loans only from home, to a different compatible host; no re-lend/renew/early-return; finite `legalDueBeats` (incl. `null` = "keep forever", exposed so it can fail). Overlapping rows rejected at commit.
- **RBM-004** HEAVY mass semantics: safe/crate base 1, HEAVY +2, carrier limit 1, plate threshold 3. Return onto carried cargo settles it at the carrier's current valid cell (`cargo.settled`); overload blocks further carrying via the mass rule — no teleport home, no dragging through closed gates.
- **RBM-007** guards: finite authored patrol + declared ray regions (segments gated by open gates; a blocked segment darkens all later ones — the closed exit is opaque). Stable crew-id order; no hidden tie-break needed in RBM-01.
- **RBM-008** per-beat phase order, exactly: `loans` → `crew` → `guards` → `returns` → `settle`/`evaluate`. Guard attention scans precede each guard's patrol move and are re-evaluated on the new post (detection is continuous). Returns resolve as one simultaneous transition (RBM-009).
- **RBM-010** commands = `wait | move | pickup | drop | pickup-and-move`; missing entries auto-wait. Planning consumes no beats.
- **RBM-012** `verification.horizonBeat` is the last simulated beat and the end-of-beat evaluation point; earlier arrival is provisional (due-4 and permanent traces are caught by the beat-4 ray).
- **RBM-C** exact tutorial: layout, trace, and all counterexamples (return at 2 / 4 / never) implemented via general rules — no room-specific success script, no tutorial capture flag.
- **IV.5.1** deterministic replay (identical event logs), `canonicalHash` over stable-sorted JSON via `node:crypto`, undo(apply(x)) == x (audit fields excluded), duplicate command ids idempotent, stale `baseRevision` rejected, save corruption detected by checkpoint-hash mismatch, versioned `Replay`/`SaveEnvelope` (`rulesVersion` checked on restore/verify).
- **Budget enforcement**: `maxRows` rejects over-budget rows at commit; `requiredTokens` missing rows fail the `plan.complete` observation at evaluation (under-budget plans still simulate for feedback).

## Test output

```
Test Files  1 passed (1)
     Tests  17 passed (17)
```
`npx vitest run` — all pass; `npx tsc --noEmit -p tsconfig.json` — clean under `strict: true` (typescript 5.9.3, vitest 2.1.9, node v22.23.3).

Required assertions: (a) canonical 4-beat trace passes; (b) due-2 return settles the safe at the approach, rejects the exit move, fails; (c) due-4 return is preceded by guard movement → capture at the open exit → fail; (d) permanent loan leaves the gate open → capture + `tokenHome` fail; (e) alternate due-3 schedule (loan activates beat 2) passes; (f) single-host invariant over every snapshot + overlap/duplicate rejection; (g) byte-identical event logs across runs + versioned `verifyReplay`; (h) serialize/restore preserves mid-loan host and home identity + corruption detection.

## Ambiguities resolved (dispatch vs master — master followed per instructions)

1. **Property names**: dispatch mentioned `HEAVY/FAST/HIDE/QUIET` with effects ("+1 move beat", "planning token", "conceals exit", "dampens contact"). The master defines **HEAVY/BRIGHT/NOISY** (RBM-004/005/006; FLOATING explicitly excluded) and instructs "use the master's actual names if it defines them" — implemented the master's three; the alternate four do not exist.
2. **"HELPER prop exits room 1 at beat 2"**: mapped to `crew-helper` (the safe carrier) moving `room-safe → cell-approach` carrying the safe at beat 2 — the master's trace.
3. **"guard attention always before movement"**: implemented as an attention/detection scan at the guard's current post **before** its patrol step plus a scan on arrival (rays are continuous). A purely pre-move evaluation would miss the required beat-4 capture counterexample.
4. **"machinery paused/disabled tags ≤3 beats"**: `MachineryTag` on devices, `MAX_MACHINERY_TAG_BEATS = 3`, tags decrement in the machinery phase; unused by RBM-01.
5. **"return home through an open gate"**: **not** implemented — it contradicts the locked trace (HEAVY must return to the safe across the just-closed exit at end of beat 3). Returns are logical host transfers to the home entity's current position (RBM-004's "never teleports" applies to the prop, not the token).
6. **"under/over-budget machinery counts"**: no such field exists in the master; mapped onto the loan manifest budget (`maxRows` over-budget rejection at commit; `requiredTokens` → `plan.complete` observation for under-budget).
7. **Token states**: `home | staged | held | returned | converted` — `staged` = committed row whose `startBeat` hasn't arrived; `converted` reserved (unused); `returned` permits legal re-loan (RBM-05).
8. **`simulate` signature**: `simulate(level, plan, seed)` — `plan` = `{ rows: LoanManifestRow[], commands: {beat: {crewId: command}} }`.
9. **Event names**: master defines no literal event strings; used dot-namespaced names (`loan.start`, `crew.move`, `guard.attention`, `token.return`, `plate.press`, `gate.open`, `evaluation`, …). Beat phases named after RBM-008.

## Known scope limits

- BRIGHT/NOISY effect types exist (`lightCells`, `emitsSound`, `sensor` device) but have no level coverage yet; `pickup`/`drop` exist for vocabulary completeness but only `pickup-and-move`/`move`/`wait` are exercised by RBM-01.
- `getLegalActions` offers statically bounded candidates (compatible hosts × start beats × legal due beats; cursor-folded crew moves); deeper reachability is decided by the sim, which is the ground truth.
- Interaction commands (phase-1 device uses beyond loans) are reserved for rooms that introduce them.

No deviations from the master's rules. The single behavioral bug found during bring-up (gate targets applied on plate release instead of inverting; plate mass needed authored `restingOn`, not cell co-location) is fixed and covered by the trace tests.
