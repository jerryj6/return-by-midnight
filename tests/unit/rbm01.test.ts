// RBM-01 acceptance suite — every assertion is a spec requirement from
// RBM-B (RBM-001..012), RBM-C (The Weight of Evidence trace + counterexamples),
// RBM-F, and IV.5.4 (mandatory RBM example tests).
import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../src/engine/contracts";
import { RbmEngine, type RbmAction, type RbmActionPayload, type RbmPlayState } from "../../src/engine/rbm/engine";
import { simulate } from "../../src/engine/rbm/sim";
import type { LoanManifestRow } from "../../src/engine/rbm/types";
import {
  RBM01,
  rbm01AlternatePlan,
  rbm01PlanWithDue,
  rbm01ReferencePlan,
} from "../../src/content/levels/rbm01-weight-of-evidence";

const engine = new RbmEngine();
const SEED = "rbm01-seed";

function eventsOf(result: ReturnType<typeof simulate>, type: string): GameEvent[] {
  return result.events.filter((e) => e.type === type);
}

function atBeat(events: GameEvent[], beat: number): GameEvent[] {
  return events.filter((e) => e.beat === beat);
}

/** Drive the engine with auto command ids / tracked revision. */
function commit(state: RbmPlayState, payload: RbmActionPayload, id: string): RbmPlayState {
  const action: RbmAction = { actorId: "tester", commandId: id, baseRevision: state.revision, payload };
  const check = engine.validateAction(RBM01, state, action);
  expect(check.ok, `expected ${id} valid, got ${check.reason}`).toBe(true);
  return engine.applyAction(RBM01, state, action).state;
}

function commitPlan(plan: ReturnType<typeof rbm01ReferencePlan>, seed = SEED): RbmPlayState {
  let s = engine.createInitialState(RBM01);
  let n = 0;
  for (const row of plan.rows) s = commit(s, { type: "manifest.commit", row }, `row-${++n}`);
  for (const [beat, byCrew] of Object.entries(plan.commands)) {
    for (const [crewId, command] of Object.entries(byCrew)) {
      s = commit(s, { type: "command.queue", beat: Number(beat), crewId, command }, `cmd-${++n}`);
    }
  }
  s = commit(s, { type: "test.run", seed }, `run-${++n}`);
  return s;
}

// (a) The master's exact 4-beat winning trace passes.
describe("RBM-C canonical trace", () => {
  const result = simulate(RBM01, rbm01ReferencePlan(), SEED);

  it("succeeds at the end-of-beat-4 verification horizon", () => {
    expect(result.evaluation.success).toBe(true);
    const evalEvent = eventsOf(result, "evaluation")[0]!;
    expect(evalEvent.beat).toBe(4);
    expect(evalEvent.phase).toBe("evaluate");
  });

  it("beat 1: loan activates, plate presses, exit opens, safe becomes portable", () => {
    const b1 = atBeat(result.events, 1);
    expect(b1.some((e) => e.type === "loan.start" && e.entityId === "TOKEN-H" && e.data?.["to"] === "prop-crate")).toBe(true);
    expect(b1.some((e) => e.type === "plate.press" && e.entityId === "plate-1")).toBe(true);
    expect(b1.some((e) => e.type === "gate.open" && e.entityId === "gate-exit")).toBe(true);
    // safe now weighs 1 (HEAVY on the crate) — pickup at beat 2 must be legal.
    const b2 = atBeat(result.events, 2);
    expect(b2.some((e) => e.type === "crew.pickup" && e.entityId === "crew-helper" && e.data?.["propId"] === "prop-safe")).toBe(true);
  });

  it("beat 2: helper exits room 1 to the approach square with the safe", () => {
    const move = atBeat(result.events, 2).find((e) => e.type === "crew.move" && e.entityId === "crew-helper");
    expect(move?.data?.["from"]).toBe("room-safe");
    expect(move?.data?.["to"]).toBe("cell-approach");
    expect(move?.data?.["withCargo"]).toBe("prop-safe");
  });

  it("beat 3: exit crossing to the pad, then HEAVY returns and the gate closes behind", () => {
    const b3 = atBeat(result.events, 3);
    const moveIdx = b3.findIndex((e) => e.type === "crew.move" && e.entityId === "crew-helper");
    expect(moveIdx).toBeGreaterThanOrEqual(0);
    expect(b3[moveIdx]!.data?.["to"]).toBe("pad-out");
    const ret = b3.find((e) => e.type === "token.return" && e.entityId === "TOKEN-H");
    // RBM-008: returns (phase 4) resolve after crew movement (phase 2).
    expect(ret).toBeTruthy();
    expect(b3.indexOf(ret!)).toBeGreaterThan(moveIdx);
    expect(ret?.data?.["to"]).toBe("prop-safe");
    expect(ret?.data?.["homeCellId"]).toBe("pad-out"); // home follows the moved safe
    expect(b3.some((e) => e.type === "plate.release")).toBe(true);
    expect(b3.some((e) => e.type === "gate.close" && e.entityId === "gate-exit")).toBe(true);
  });

  it("beat 4: guard reaches the watch square; the closed exit blocks its ray", () => {
    const b4 = atBeat(result.events, 4);
    expect(b4.some((e) => e.type === "guard.move" && e.data?.["to"] === "guard-watch")).toBe(true);
    const attention = b4.filter((e) => e.type === "guard.attention").at(-1);
    expect(attention?.data?.["post"]).toBe("guard-watch");
    expect(attention?.data?.["lit"]).toEqual(["cell-approach"]); // pad-out dark: opaque closed exit
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });
});

// (b) Returning TOKEN-H at beat 2 blocks the helper's exit.
it("return due at beat 2 settles the safe mid-route and the exit run fails", () => {
  const result = simulate(RBM01, rbm01PlanWithDue(2), SEED);
  // HEAVY returns to the carried safe at the approach square: it settles there.
  const settled = eventsOf(result, "cargo.settled")[0]!;
  expect(settled.beat).toBe(2);
  expect(settled.data?.["cellId"]).toBe("cell-approach");
  expect(settled.data?.["reason"]).toBe("overloaded");
  // The crate releases the plate and the exit closes at end of beat 2.
  expect(atBeat(result.events, 2).some((e) => e.type === "gate.close")).toBe(true);
  // The beat-3 exit move is rejected — the helper never leaves the building.
  const rejected = atBeat(result.events, 3).find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
  expect(rejected).toBeTruthy();
  expect(result.finalState.entities["prop-safe"]!.cellId).not.toBe("pad-out");
  expect(result.evaluation.success).toBe(false);
});

// (c) Returning at beat 4 misses the verification horizon: the guard moves first.
it("return due at beat 4 is too late — open exit lets the beat-4 ray capture", () => {
  const result = simulate(RBM01, rbm01PlanWithDue(4), SEED);
  // The exit is still open through the guard's beat-4 movement (RBM-008: guard
  // movement precedes the end-of-beat-4 return).
  const capture = eventsOf(result, "guard.capture")[0]!;
  expect(capture.beat).toBe(4);
  expect(capture.data?.["crewId"]).toBe("crew-helper");
  expect(capture.data?.["cellId"]).toBe("pad-out");
  const ret = eventsOf(result, "token.return")[0]!;
  expect(ret.beat).toBe(4);
  // capture (phase 3) is recorded before the return (phase 4)
  const b4 = atBeat(result.events, 4);
  expect(b4.indexOf(capture)).toBeLessThan(b4.indexOf(ret));
  expect(result.evaluation.success).toBe(false);
});

// (d) A permanent loan leaves the exit open and fails.
it("permanent loan (never returned) leaves the gate open and fails", () => {
  const result = simulate(RBM01, rbm01PlanWithDue(null), SEED);
  expect(eventsOf(result, "token.return")).toHaveLength(0);
  const capture = eventsOf(result, "guard.capture")[0]!;
  expect(capture.beat).toBe(4);
  expect(capture.data?.["crewId"]).toBe("crew-helper");
  const heavyOutcome = result.evaluation.outcomes.find((o) => o.predicateId === "heavy-returned");
  expect(heavyOutcome?.passed).toBe(false);
  expect(result.evaluation.success).toBe(false);
});

// (e) An alternate due-at-beat-3 valid trace also passes (loan starts beat 2).
it("alternate valid schedule with due beat 3 also succeeds", () => {
  const result = simulate(RBM01, rbm01AlternatePlan(), SEED);
  expect(result.evaluation.success).toBe(true);
  // Activation order differs (beat 2) but the causal chain is the same.
  expect(atBeat(result.events, 2).some((e) => e.type === "loan.start")).toBe(true);
  expect(atBeat(result.events, 3).some((e) => e.type === "token.return")).toBe(true);
});

// (f) The same token is never in two units at once.
describe("token conservation (RBM-001)", () => {
  it("TOKEN-H has exactly one host at every point of every run", () => {
    for (const plan of [rbm01ReferencePlan(), rbm01PlanWithDue(2), rbm01PlanWithDue(4), rbm01PlanWithDue(null)]) {
      const result = simulate(RBM01, plan, SEED);
      for (const snap of result.timeline) {
        const tok = snap.state.tokens["TOKEN-H"]!;
        expect(tok).toBeTruthy();
        expect(Object.keys(snap.state.entities)).toContain(tok.hostEntityId);
        // one token record => one host; no second entity can claim it.
        expect(Object.values(snap.state.tokens).filter((t) => t.id === "TOKEN-H")).toHaveLength(1);
      }
    }
  });

  it("overlapping loans and duplicate commands cannot duplicate the token", () => {
    let s = engine.createInitialState(RBM01);
    const row = rbm01ReferencePlan().rows[0]!;
    s = commit(s, { type: "manifest.commit", row }, "r1");
    // A second overlapping row for the same token is rejected before execution.
    const overlap: LoanManifestRow = { ...row, rowId: "r2", startBeat: 2, dueBeat: 4 };
    const a2: RbmAction = { actorId: "t", commandId: "r2", baseRevision: s.revision, payload: { type: "manifest.commit", row: overlap } };
    const check = engine.validateAction(RBM01, s, a2);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("overlapping-loan");
    // A replayed command id is idempotently rejected (IV.5.1).
    const dup: RbmAction = { actorId: "t", commandId: "r1", baseRevision: s.revision, payload: { type: "manifest.commit", row } };
    expect(engine.validateAction(RBM01, s, dup).reason).toBe("duplicate-command-id");
    expect(s.manifestRows).toHaveLength(1);
  });
});

// (g) Deterministic replay: two runs produce identical event logs.
it("is deterministic: identical plans replay to identical events and hash", () => {
  const a = simulate(RBM01, rbm01ReferencePlan(), SEED);
  const b = simulate(RBM01, rbm01ReferencePlan(), SEED);
  expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  expect(a.finalHash).toBe(b.finalHash);
  // seed is recorded but no nondeterminism enters the tutorial rules
  const c = simulate(RBM01, rbm01ReferencePlan(), "different-seed");
  expect(c.finalHash).toBe(a.finalHash);
  // versioned replay verifies through the engine's canonical action log
  const state = commitPlan(rbm01ReferencePlan());
  const replay = engine.buildReplay(RBM01, state);
  expect(engine.verifyReplay(RBM01, replay)).toEqual({ ok: true });
  const tampered = { ...replay, rulesVersion: "rbm-rules/0.0.0" };
  expect(engine.verifyReplay(RBM01, tampered).ok).toBe(false);
});

// (h) Token home state is stable across serialize/restore round-trips (incl. mid-loan).
it("serialize/restore preserves token home and mid-loan host", () => {
  const state = commitPlan(rbm01ReferencePlan());
  const blob = engine.serialize(RBM01, state);
  const restored = engine.restore(RBM01, blob);
  expect(engine.canonicalHash(RBM01, restored)).toBe(engine.canonicalHash(RBM01, state));

  // beat-2/3 snapshots sit mid-loan: hosted by the crate, home still the safe.
  const midLoan = restored.lastRun!.timeline[2]!.state;
  expect(midLoan.tokens["TOKEN-H"]!.status).toBe("held");
  expect(midLoan.tokens["TOKEN-H"]!.hostEntityId).toBe("prop-crate");
  expect(RBM01.tokens.find((t) => t.id === "TOKEN-H")?.homeEntityId).toBe("prop-safe");
  // after restore, the same token is back home by the horizon snapshot
  const final = restored.lastRun!.timeline[4]!.state;
  expect(final.tokens["TOKEN-H"]!.hostEntityId).toBe("prop-safe");
  expect(final.tokens["TOKEN-H"]!.status).toBe("returned");

  // corruption is detected, not silently accepted
  const tampered = JSON.parse(blob);
  tampered.state.accepted = true;
  expect(() => engine.restore(RBM01, JSON.stringify(tampered))).toThrow(/checkpoint-hash-mismatch/);
});

// ---- supporting spec checks (RBM-002, RBM-C interface rules, undo) ----

it("enforces manifest budget and loan legality before execution", () => {
  let s = engine.createInitialState(RBM01);
  const row = rbm01ReferencePlan().rows[0]!;
  // loan must start from home: a row pretending another origin is illegal
  const wrongOrigin: LoanManifestRow = { ...row, rowId: "x1", fromHostId: "prop-crate" };
  const a1: RbmAction = { actorId: "t", commandId: "x1", baseRevision: s.revision, payload: { type: "manifest.commit", row: wrongOrigin } };
  expect(engine.validateAction(RBM01, s, a1).reason).toBe("loan-not-from-home");
  // incompatible host: the safe cannot borrow HEAVY (does not accept it)
  const badHost: LoanManifestRow = { ...row, rowId: "x2", toHostId: "prop-safe" };
  const a2: RbmAction = { actorId: "t", commandId: "x2", baseRevision: s.revision, payload: { type: "manifest.commit", row: badHost } };
  expect(engine.validateAction(RBM01, s, a2).ok).toBe(false);
  // an unlisted due beat is rejected
  const badDue: LoanManifestRow = { ...row, rowId: "x3", dueBeat: 9 };
  const a3: RbmAction = { actorId: "t", commandId: "x3", baseRevision: s.revision, payload: { type: "manifest.commit", row: badDue } };
  expect(engine.validateAction(RBM01, s, a3).reason).toBe("due-beat-not-offered");
  // over-budget: maxRows is 1
  s = commit(s, { type: "manifest.commit", row }, "ok1");
  const extra: LoanManifestRow = { ...row, rowId: "x4", startBeat: 2, dueBeat: 3 };
  const a4: RbmAction = { actorId: "t", commandId: "x4", baseRevision: s.revision, payload: { type: "manifest.commit", row: extra } };
  const r4 = engine.validateAction(RBM01, s, a4);
  expect(r4.ok).toBe(false);
});

it("undo across a committed loan restores the prior plan exactly", () => {
  let s = engine.createInitialState(RBM01);
  const before = engine.canonicalHash(RBM01, s);
  s = commit(s, { type: "manifest.commit", row: rbm01ReferencePlan().rows[0]! }, "u1");
  s = commit(s, { type: "history.undo" }, "u2");
  expect(s.manifestRows).toHaveLength(0);
  expect(engine.canonicalHash(RBM01, s)).toBe(before); // undo(apply(x)) == x
});

it("accept-result succeeds only after a successful test run", () => {
  // failing plan cannot be accepted
  let bad = commitPlan(rbm01PlanWithDue(4));
  const failAccept: RbmAction = { actorId: "t", commandId: "acc-bad", baseRevision: bad.revision, payload: { type: "result.accept" } };
  expect(engine.validateAction(RBM01, bad, failAccept).reason).toBe("no-successful-run");
  // winning plan accepts
  const good = commitPlan(rbm01ReferencePlan());
  const accepted = commit(good, { type: "result.accept" }, "acc-good");
  expect(accepted.accepted).toBe(true);
  expect(accepted.phase).toBe("accepted");
});

it("under-budget manifest (no loan row) fails the plan.complete observation", () => {
  const empty = simulate(RBM01, { rows: [], commands: {} }, SEED);
  expect(empty.evaluation.success).toBe(false);
  expect(empty.evaluation.observations.find((o) => o.predicateId === "plan.complete")?.passed).toBe(false);
});
