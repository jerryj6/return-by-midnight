// RBM-11/12 acceptance suite — the chapter-4 finale pair.
// Same contract as rbm02-04 / rbm05-07: verified winning traces must pass
// end-to-end (simulate AND the live engine commit path), each designed wrong
// approach must fail for the RIGHT reason (named predicate or rejection
// reason), the manifest must reject mis-scheduled/over-budget rows, and runs
// must be deterministic.

import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../src/engine/contracts.js";
import { RbmEngine, type RbmAction, type RbmActionPayload, type RbmPlayState } from "../../src/engine/rbm/engine.js";
import { simulate } from "../../src/engine/rbm/sim.js";
import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../src/engine/rbm/types.js";
import {
  RBM11,
  RBM11_ALT_ROWS,
  RBM11_WINNING_ROWS,
  rbm11AlternatePlan,
  rbm11ReferencePlan,
} from "../../src/content/levels/rbm11-night-shift.js";
import {
  RBM12,
  RBM12_ALT_ROWS,
  RBM12_WINNING_ROWS,
  rbm12AlternatePlan,
  rbm12ReferencePlan,
} from "../../src/content/levels/rbm12-midnight-returns.js";

const engine = new RbmEngine();
const SEED = "rbm-campaign-seed";

const eventsOf = (r: ReturnType<typeof simulate>, type: string): GameEvent[] =>
  r.events.filter((e) => e.type === type);
const atBeat = (events: GameEvent[], beat: number): GameEvent[] => events.filter((e) => e.beat === beat);
const outcome = (r: ReturnType<typeof simulate>, id: string) =>
  r.evaluation.outcomes.find((o) => o.predicateId === id);
const observation = (r: ReturnType<typeof simulate>, id: string) =>
  r.evaluation.observations.find((o) => o.predicateId === id);
const cellOf = (r: ReturnType<typeof simulate>, entityId: string) =>
  r.finalState.entities[entityId]?.cellId;

function validateRows(level: RbmManifest, rows: LoanManifestRow[]): string | null {
  let s = engine.createInitialState(level);
  let n = 0;
  for (const row of rows) {
    const action: RbmAction = {
      actorId: "tester",
      commandId: `row-${++n}`,
      baseRevision: s.revision,
      payload: { type: "manifest.commit", row },
    };
    const check = engine.validateAction(level, s, action);
    if (!check.ok) return check.reason ?? "invalid";
    s = engine.applyAction(level, s, action).state;
  }
  return null;
}

function commitPlan(level: RbmManifest, plan: RbmPlan, seed = SEED): RbmPlayState {
  let s = engine.createInitialState(level);
  let n = 0;
  const commit = (payload: RbmActionPayload, id: string) => {
    const action: RbmAction = { actorId: "tester", commandId: id, baseRevision: s.revision, payload };
    const check = engine.validateAction(level, s, action);
    expect(check.ok, `expected ${id} valid, got ${check.reason}`).toBe(true);
    s = engine.applyAction(level, s, action).state;
  };
  for (const row of plan.rows) commit({ type: "manifest.commit", row }, `row-${++n}`);
  for (const [beat, byCrew] of Object.entries(plan.commands)) {
    for (const [crewId, command] of Object.entries(byCrew)) {
      commit({ type: "command.queue", beat: Number(beat), crewId, command }, `cmd-${++n}`);
    }
  }
  commit({ type: "test.run", seed }, `run-${++n}`);
  return s;
}

/** Runs a plan through the live engine commit API (not just simulate). */
function engineRun(level: RbmManifest, plan: RbmPlan) {
  return commitPlan(level, plan).lastRun;
}

// ---------------------------------------------------------------------------
// RBM-11 — Night Shift (two wings, one return schedule)
// ---------------------------------------------------------------------------

describe("RBM-11 Night Shift", () => {
  const result = simulate(RBM11, rbm11ReferencePlan(), SEED);

  it("canonical trace succeeds at the beat-9 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(result.evaluation.allOutcomesPass).toBe(true);
  });

  it("wins through the live engine commit path, not only simulate", () => {
    const run = engineRun(RBM11, rbm11ReferencePlan());
    expect(run?.evaluation.success).toBe(true);
    expect(run?.finalHash).toBe(result.finalHash);
  });

  it("the early shift opens both corridors on the crossover postings", () => {
    expect(
      atBeat(result.events, 2).some(
        (e) => e.type === "gate.open" && e.entityId === "gate-west",
      ),
    ).toBe(true);
    expect(
      atBeat(result.events, 2).some(
        (e) => e.type === "gate.open" && e.entityId === "gate-east",
      ),
    ).toBe(true);
  });

  it("the beat-5 double return slams both corridors; beat-6 crossover opens both windows", () => {
    const returns5 = eventsOf(result, "token.return").filter((e) => e.beat === 5);
    expect(returns5.map((e) => e.entityId).sort()).toEqual(["TOKEN-H", "TOKEN-N"]);
    expect(
      atBeat(result.events, 5).some((e) => e.type === "gate.close" && e.entityId === "gate-west"),
    ).toBe(true);
    expect(
      atBeat(result.events, 5).some((e) => e.type === "gate.close" && e.entityId === "gate-east"),
    ).toBe(true);
    // The same tokens re-posted to the OPPOSITE wings' windows.
    const starts6 = eventsOf(result, "loan.start").filter((e) => e.beat === 6);
    expect(starts6.map((e) => e.entityId).sort()).toEqual(["TOKEN-H", "TOKEN-N"]);
    expect(
      atBeat(result.events, 6).some(
        (e) => e.type === "gate.open" && e.entityId === "gate-west-win",
      ),
    ).toBe(true);
    expect(
      atBeat(result.events, 6).some(
        (e) => e.type === "gate.open" && e.entityId === "gate-east-win",
      ),
    ).toBe(true);
  });

  it("all prizes and crew are out; both tokens home; nobody captured", () => {
    for (const p of ["prop-idol-w", "prop-scroll-w", "prop-idol-e", "prop-scroll-e"]) {
      expect(cellOf(result, p)).toBe("pad-out");
    }
    for (const c of ["crew-helper", "crew-scout", "crew-runner", "crew-operator"]) {
      expect(outcome(result, `${c.replace("crew-", "")}-extracted`)?.passed).toBe(true);
    }
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });

  it("the alternate shift assignment is also a complete win", () => {
    const alt = simulate(RBM11, rbm11AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
    // strategically distinct: different manifest -> different mid-run world
    // state (beat 5: alt's early NOISY crossover already has the west window
    // open while canonical is still mid-handover). Same end state by design.
    expect(alt.timeline[5]?.hash).not.toBe(result.timeline[5]?.hash);
    expect(
      validateRows(RBM11, RBM11_ALT_ROWS),
    ).toBeNull();
  });

  it("is deterministic: identical plans replay to identical events and hash", () => {
    const a = simulate(RBM11, rbm11ReferencePlan(), SEED);
    const b = simulate(RBM11, rbm11ReferencePlan(), SEED);
    expect(a.finalHash).toBe(b.finalHash);
    expect(a.events.length).toBe(b.events.length);
    expect(simulate(RBM11, rbm11ReferencePlan(), "other-seed").finalHash).toBe(a.finalHash);
  });
});

describe("RBM-11 wrong approaches fail for the right reason", () => {
  it("wing-local-booking: booking one token to two hosts over the same beats is overlapping-loan", () => {
    const reason = validateRows(RBM11, [
      { rowId: "r1", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-w", startBeat: 2, dueBeat: 8 },
      { rowId: "r2", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-e", startBeat: 3, dueBeat: 8 },
    ]);
    expect(reason).toBe("overlapping-loan");
  });

  it("swap-the-keys: NOISY on a scale is incompatible-host", () => {
    const reason = validateRows(RBM11, [
      { rowId: "r1", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-scale-w", startBeat: 2, dueBeat: 5 },
    ]);
    expect(reason).toBe("incompatible-host");
  });

  it("dark-window-exit: stepping out the west window before the late shift starts is gate-closed", () => {
    const plan = rbm11ReferencePlan();
    plan.commands[5] = { "crew-helper": { type: "move", to: "pad-out" } };
    const r = simulate(RBM11, plan, SEED);
    const rej = eventsOf(r, "command.rejected").find(
      (e) => e.beat === 5 && e.entityId === "crew-helper",
    );
    expect(rej?.data?.reason).toBe("gate-closed");
    expect(r.evaluation.success).toBe(false);
  });

  it("midnight-straggler: a window posting due at 9 leaves the pad lit for the sweep", () => {
    const plan = rbm11ReferencePlan();
    plan.rows = plan.rows.map((r) =>
      r.rowId === "TOKEN-N->chime-w@6~8" ? { ...r, dueBeat: 9 } : r,
    );
    const r = simulate(RBM11, plan, SEED);
    const cap = eventsOf(r, "guard.capture");
    expect(cap.length).toBeGreaterThan(0);
    expect(cap[0]!.beat).toBe(9);
    expect(outcome(r, "crew-safe")?.passed).toBe(false);
  });

  it("early-wing-entry: entering a wing mouth at beat 2 walks into the dome sweep", () => {
    const plan = rbm11ReferencePlan();
    plan.commands[2] = { "crew-helper": { type: "move", to: "cell-west" } };
    const r = simulate(RBM11, plan, SEED);
    const cap = eventsOf(r, "guard.capture");
    expect(cap.length).toBeGreaterThan(0);
    expect(cap[0]!.beat).toBe(2);
    expect(cap[0]!.entityId).toBe("guard-1");
  });

  it("forget-the-second-posting: corridors only — nobody can leave the wings", () => {
    const plan: RbmPlan = {
      rows: RBM11_WINNING_ROWS.slice(0, 2),
      commands: rbm11ReferencePlan().commands,
    };
    const r = simulate(RBM11, plan, SEED);
    expect(r.evaluation.success).toBe(false);
    expect(eventsOf(r, "guard.capture")).toHaveLength(0); // trapped, not caught
    expect(outcome(r, "helper-extracted")?.passed).toBe(false);
  });

  it("manifest-over-budget: a fifth row is refused", () => {
    const extra: LoanManifestRow = {
      rowId: "r5",
      tokenId: "TOKEN-N",
      fromHostId: "prop-windup",
      toHostId: "prop-chime-w",
      startBeat: 9,
      dueBeat: null,
    };
    expect(validateRows(RBM11, [...RBM11_WINNING_ROWS, extra])).toBe("manifest-over-budget");
  });

  it("depth check (IV.5.4): a no-return window posting turns into a real guard consequence, not bookkeeping", () => {
    const plan = rbm11ReferencePlan();
    // keep-forever on the west window: never returns -> window never slams.
    plan.rows = plan.rows.map((r) =>
      r.rowId === "TOKEN-N->chime-w@6~8" ? { ...r, dueBeat: null } : r,
    );
    const r = simulate(RBM11, plan, SEED);
    const cap = eventsOf(r, "guard.capture");
    expect(cap.length).toBeGreaterThan(0);
    expect(cap[0]!.beat).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// RBM-12 — Midnight Returns (campaign finale)
// ---------------------------------------------------------------------------

describe("RBM-12 Midnight Returns", () => {
  const result = simulate(RBM12, rbm12ReferencePlan(), SEED);

  it("canonical trace succeeds at the beat-9 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(result.evaluation.allOutcomesPass).toBe(true);
    expect(result.evaluation.allObservationsPass).toBe(true);
  });

  it("wins through the live engine commit path, not only simulate", () => {
    const run = engineRun(RBM12, rbm12ReferencePlan());
    expect(run?.evaluation.success).toBe(true);
    expect(run?.finalHash).toBe(result.finalHash);
  });

  it("the inverted door: gate-inner is open while HEAVY is home, closes on the posting, reopens on the return", () => {
    // Home at start: pressed from beat 1.
    expect(
      atBeat(result.events, 1).some((e) => e.type === "gate.open" && e.entityId === "gate-inner"),
    ).toBe(true);
    expect(
      atBeat(result.events, 1).some((e) => e.type === "sensor.power" && e.entityId === "sensor-desk"),
    ).toBe(true);
    // Posting at beat 2 slams it (HEAVY leaves the counter).
    expect(
      atBeat(result.events, 2).some((e) => e.type === "gate.close" && e.entityId === "gate-inner"),
    ).toBe(true);
    expect(
      atBeat(result.events, 2).some((e) => e.type === "sensor.unpower" && e.entityId === "sensor-desk"),
    ).toBe(true);
    // The beat-4 return presses the home plate again: one return closes the
    // hall door and opens the exit — the signature finale event.
    expect(
      atBeat(result.events, 4).some((e) => e.type === "token.return" && e.entityId === "TOKEN-H"),
    ).toBe(true);
    expect(
      atBeat(result.events, 4).some((e) => e.type === "gate.close" && e.entityId === "gate-hall"),
    ).toBe(true);
    expect(
      atBeat(result.events, 4).some((e) => e.type === "gate.open" && e.entityId === "gate-inner"),
    ).toBe(true);
    expect(
      atBeat(result.events, 4).some((e) => e.type === "sensor.power" && e.entityId === "sensor-desk"),
    ).toBe(true);
  });

  it("the alignment window: gate-outer lives exactly inside NOISY's posting", () => {
    expect(
      atBeat(result.events, 5).some((e) => e.type === "gate.open" && e.entityId === "gate-outer"),
    ).toBe(true);
    expect(
      atBeat(result.events, 5).some((e) => e.type === "sensor.power" && e.entityId === "sensor-window"),
    ).toBe(true);
    // The last return seals it before the midnight sweep.
    expect(
      atBeat(result.events, 8).some((e) => e.type === "token.return" && e.entityId === "TOKEN-N"),
    ).toBe(true);
    expect(
      atBeat(result.events, 8).some((e) => e.type === "gate.close" && e.entityId === "gate-outer"),
    ).toBe(true);
    expect(
      atBeat(result.events, 8).some((e) => e.type === "sensor.unpower" && e.entityId === "sensor-window"),
    ).toBe(true);
  });

  it("the walker's vault rattle lands on beats 6 and 7 and finds the vault empty", () => {
    const moves = eventsOf(result, "guard.move").filter((e) => e.entityId === "guard-2");
    expect(moves.find((m) => m.data?.to === "post-vaultwatch")?.beat).toBe(6);
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
    expect(cellOf(result, "prop-jewel")).toBe("pad-out");
    expect(cellOf(result, "prop-map")).toBe("pad-out");
  });

  it("the finale is automatic: beats 8–9 run on committed returns alone", () => {
    // The canonical plan queues nothing after beat 7 — the last beats are the
    // museum locking itself back up.
    const plan = rbm12ReferencePlan();
    const lateBeats = Object.keys(plan.commands).map(Number).filter((b) => b >= 8);
    expect(lateBeats).toEqual([]);
    expect(result.evaluation.success).toBe(true);
  });

  it("the one-shot group crossing is also a complete win (different manifest)", () => {
    const alt = simulate(RBM12, rbm12AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
    // strategically distinct: different manifest -> different mid-run state
    // (beat 4: canonical's HEAVY return has already unlocked the inner door;
    // alt's posting runs a beat longer and it is still closed).
    expect(alt.timeline[4]?.hash).not.toBe(result.timeline[4]?.hash);
    expect(validateRows(RBM12, RBM12_ALT_ROWS)).toBeNull();
  });

  it("is deterministic: identical plans replay to identical events and hash", () => {
    const a = simulate(RBM12, rbm12ReferencePlan(), SEED);
    const b = simulate(RBM12, rbm12ReferencePlan(), SEED);
    expect(a.finalHash).toBe(b.finalHash);
    expect(a.events.length).toBe(b.events.length);
  });
});

describe("RBM-12 wrong approaches fail for the right reason", () => {
  it("cross-before-the-return: vestibule crossing while HEAVY is still out is gate-closed", () => {
    const plan = rbm12ReferencePlan();
    plan.commands[4] = {
      ...plan.commands[4]!,
      "crew-helper": { type: "move", to: "cell-exit" },
    };
    const r = simulate(RBM12, plan, SEED);
    const rej = eventsOf(r, "command.rejected").find(
      (e) => e.beat === 4 && e.entityId === "crew-helper",
    );
    expect(rej?.data?.reason).toBe("gate-closed");
    expect(r.evaluation.success).toBe(false);
  });

  it("reloan-after-home: posting HEAVY back out mid-window slams the inner door", () => {
    const plan = rbm12ReferencePlan();
    plan.rows = [
      ...plan.rows,
      {
        rowId: "TOKEN-H->scale-h@5~8",
        tokenId: "TOKEN-H",
        fromHostId: "prop-counter",
        toHostId: "prop-scale-h",
        startBeat: 5,
        dueBeat: 8,
      },
    ];
    const r = simulate(RBM12, plan, SEED);
    expect(
      atBeat(r.events, 5).some((e) => e.type === "gate.close" && e.entityId === "gate-inner"),
    ).toBe(true);
    const rejs = eventsOf(r, "command.rejected").filter((e) => e.data?.reason === "gate-closed");
    expect(rejs.length).toBeGreaterThan(0);
    expect(r.evaluation.success).toBe(false);
  });

  it("exit-too-late: an outer-door posting due at 9 leaves the pad lit for the sweep", () => {
    const plan = rbm12ReferencePlan();
    plan.rows = plan.rows.map((r) =>
      r.rowId === "TOKEN-N->chime-ex@5~8" ? { ...r, dueBeat: 9 } : r,
    );
    const r = simulate(RBM12, plan, SEED);
    const cap = eventsOf(r, "guard.capture");
    expect(cap.length).toBeGreaterThan(0);
    expect(cap[0]!.beat).toBe(9);
    expect(outcome(r, "crew-safe")?.passed).toBe(false);
  });

  it("vault-dawdler: a crew left in the vault is caught by the walker's beat-6 rattle", () => {
    const plan = rbm12ReferencePlan();
    const b5 = { ...plan.commands[5]! } as Record<string, unknown>;
    delete b5["crew-operator"];
    plan.commands[5] = b5 as typeof plan.commands[5];
    const r = simulate(RBM12, plan, SEED);
    const op = eventsOf(r, "guard.capture").find((e) => e.data?.crewId === "crew-operator");
    expect(op).toBeDefined();
    expect(op!.beat).toBe(6);
    expect(op!.data?.cellId).toBe("cell-vault");
  });

  it("missing-the-light: a manifest without BRIGHT fails plan.complete and the vault never opens", () => {
    const plan = rbm12ReferencePlan();
    plan.rows = plan.rows.filter((r) => r.tokenId !== "TOKEN-B");
    const r = simulate(RBM12, plan, SEED);
    expect(observation(r, "plan.complete")?.passed).toBe(false);
    expect(
      eventsOf(r, "gate.open").find((e) => e.entityId === "gate-vault"),
    ).toBeUndefined();
    expect(outcome(r, "jewel-out")?.passed).toBe(false);
    expect(r.evaluation.success).toBe(false);
  });

  it("early-hall-entry: entering the hall at beat 2 walks into the opening sweep", () => {
    const plan = rbm12ReferencePlan();
    plan.commands[2] = { "crew-helper": { type: "move", to: "cell-hall" } };
    const r = simulate(RBM12, plan, SEED);
    const cap = eventsOf(r, "guard.capture");
    expect(cap.length).toBeGreaterThan(0);
    expect(cap[0]!.beat).toBe(2);
    expect(cap[0]!.entityId).toBe("guard-1");
  });

  it("manifest-over-budget: a fifth row is refused (canonical uses 3 of 4)", () => {
    const extras: LoanManifestRow[] = [
      { rowId: "r4", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-stand-v", startBeat: 6, dueBeat: 7 },
      { rowId: "r5", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-ex", startBeat: 9, dueBeat: null },
    ];
    expect(validateRows(RBM12, [...RBM12_WINNING_ROWS, ...extras])).toBe("manifest-over-budget");
  });

  it("depth check (IV.5.4): skipping the NOISY posting leaves the outer door shut — a real dependency, not bookkeeping", () => {
    const plan = rbm12ReferencePlan();
    plan.rows = plan.rows.filter((r) => r.tokenId !== "TOKEN-N");
    const r = simulate(RBM12, plan, SEED);
    expect(eventsOf(r, "gate.open").find((e) => e.entityId === "gate-outer")).toBeUndefined();
    const rejs = eventsOf(r, "command.rejected").filter((e) => e.data?.reason === "gate-closed");
    expect(rejs.length).toBeGreaterThan(0);
    expect(outcome(r, "helper-extracted")?.passed).toBe(false);
  });
});
