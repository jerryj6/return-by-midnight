// RBM-05/06/07 acceptance suite — chapter-2 composition levels.
// Same contract as rbm02-04.test.ts: verified winning traces must pass
// end-to-end, each designed wrong approach must fail for the RIGHT reason.

import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../src/engine/contracts.js";
import { RbmEngine, type RbmAction, type RbmActionPayload, type RbmPlayState } from "../../src/engine/rbm/engine.js";
import { simulate } from "../../src/engine/rbm/sim.js";
import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../src/engine/rbm/types.js";
import { RBM05, rbm05AlternatePlan, rbm05ReferencePlan } from "../../src/content/levels/rbm05-one-light-two-jobs.js";
import { RBM06, rbm06AlternatePlan, rbm06PlanWithDue, rbm06ReferencePlan } from "../../src/content/levels/rbm06-the-door-that-pays-you-back.js";
import { RBM07, rbm07AlternatePlan, rbm07ReferencePlan } from "../../src/content/levels/rbm07-double-booking.js";

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
const firstEvent = (events: GameEvent[]): GameEvent => {
  expect(events.length, "expected at least one event").toBeGreaterThan(0);
  return events[0]!;
};

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
// RBM-05 — One Light, Two Jobs
// ---------------------------------------------------------------------------

describe("RBM-05 One Light, Two Jobs", () => {
  const result = simulate(RBM05, rbm05ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-6 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(firstEvent(eventsOf(result, "evaluation")).beat).toBe(6);
  });

  it("job one: the posted light opens the north door for exactly its loan window", () => {
    expect(atBeat(result.events, 1).some((e) => e.type === "gate.open" && e.entityId === "gate-north")).toBe(true);
    expect(atBeat(result.events, 4).some((e) => e.type === "gate.close" && e.entityId === "gate-north")).toBe(true);
  });

  it("the home interval fires: the lamp sensor powers at the beat-4 settle", () => {
    const lampPowers = eventsOf(result, "sensor.power").filter((e) => e.entityId === "sensor-lamp");
    expect(lampPowers.map((e) => e.beat)).toContain(4);
  });

  it("job two: the reloan opens the south door and both idols leave", () => {
    expect(atBeat(result.events, 5).some((e) => e.type === "gate.open" && e.entityId === "gate-south")).toBe(true);
    expect(cellOf(result, "prop-idol-north")).toBe("pad-out");
    expect(cellOf(result, "prop-idol-south")).toBe("pad-out");
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });

  it("the second allocation order is also a complete win", () => {
    const alt = simulate(RBM05, rbm05AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
  });
});

describe("RBM-05 wrong approaches fail for the right reason", () => {
  it("one-loan-two-rooms: a single loan kept forever leaves the second door shut and the lamp dark", () => {
    const plan = rbm05ReferencePlan();
    plan.rows = [{ ...plan.rows[0]!, dueBeat: null }];
    const r = simulate(RBM05, plan, SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "idol-south-out")?.passed).toBe(false);
    expect(outcome(r, "bright-home")?.passed).toBe(false);
  });

  it("no-home-interval: a second row starting on the first loan's due beat is rejected", () => {
    const rows = rbm05ReferencePlan().rows;
    const reason = validateRows(RBM05, [
      rows[0]!,
      { rowId: "row-rush", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-south", startBeat: 4, dueBeat: 6 },
    ]);
    expect(reason).toBe("overlapping-loan");
  });

  it("door-closed-crossing: exiting north at beat 5 hits the slammed door", () => {
    const plan = rbm05ReferencePlan();
    plan.commands = {
      3: { "crew-helper": { type: "move", to: "cell-north" } },
      5: { "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" } },
    };
    const r = simulate(RBM05, plan, SEED);
    const rejected = atBeat(r.events, 5).find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "idol-north-out")?.passed).toBe(false);
  });

  it("early-crossing: entering north at beat 2 is captured", () => {
    const plan = rbm05ReferencePlan();
    plan.commands = { 2: { "crew-helper": { type: "move", to: "cell-north" } } };
    const r = simulate(RBM05, plan, SEED);
    expect(eventsOf(r, "guard.capture").some((e) => e.data?.["crewId"] === "crew-helper")).toBe(true);
  });

  it("manifest-over-budget: a third row is rejected", () => {
    const rows = rbm05ReferencePlan().rows;
    const extra: LoanManifestRow = {
      rowId: "row-extra",
      tokenId: "TOKEN-B",
      fromHostId: "prop-lamp",
      toHostId: "prop-anchor-north",
      startBeat: 1,
      dueBeat: 3,
    };
    // rows[1] already occupies TOKEN-B on [5,6]; the extra row overlaps rows[0]
    // so this exercises the overlap guard — for budget coverage see RBM-07.
    expect(validateRows(RBM05, [...rows, extra])).toBe("overlapping-loan");
  });
});

// ---------------------------------------------------------------------------
// RBM-06 — The Door That Pays You Back
// ---------------------------------------------------------------------------

describe("RBM-06 The Door That Pays You Back", () => {
  const result = simulate(RBM06, rbm06ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-8 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(firstEvent(eventsOf(result, "evaluation")).beat).toBe(8);
  });

  it("posting the weight opens the store AND bolts the exit at beat 1", () => {
    const b1 = atBeat(result.events, 1);
    expect(b1.some((e) => e.type === "gate.open" && e.entityId === "gate-store")).toBe(true);
    expect(b1.some((e) => e.type === "gate.close" && e.entityId === "gate-exit")).toBe(true);
  });

  it("the one return changes two fixtures at the beat-5 settle", () => {
    const b5 = atBeat(result.events, 5);
    expect(b5.some((e) => e.type === "token.return" && e.entityId === "TOKEN-H")).toBe(true);
    // anchor presses → vault door + window unbar; lock releases → exit opens, store slams
    expect(b5.some((e) => e.type === "gate.open" && e.entityId === "gate-vault")).toBe(true);
    expect(b5.some((e) => e.type === "gate.open" && e.entityId === "gate-window")).toBe(true);
    expect(b5.some((e) => e.type === "gate.open" && e.entityId === "gate-exit")).toBe(true);
    expect(b5.some((e) => e.type === "gate.close" && e.entityId === "gate-store")).toBe(true);
  });

  it("the teammate's route rides the return: crown out the window, ledger out the front", () => {
    expect(cellOf(result, "prop-ledger")).toBe("pad-out");
    expect(cellOf(result, "prop-crown")).toBe("pad-out");
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });

  it("the swapped-jobs allocation is also a complete win", () => {
    const alt = simulate(RBM06, rbm06AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
  });
});

describe("RBM-06 wrong approaches fail for the right reason", () => {
  it("keep-forever: no payback → exit and vault stay shut", () => {
    const r = simulate(RBM06, rbm06PlanWithDue(null), SEED);
    expect(r.evaluation.success).toBe(false);
    const rejected = r.events.find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "helper-extracted")?.passed).toBe(false);
    expect(outcome(r, "crown-out")?.passed).toBe(false);
    expect(outcome(r, "heavy-home")?.passed).toBe(false);
  });

  it("pay-back-too-early: due 3 slams the store before the ledger leaves it", () => {
    const r = simulate(RBM06, rbm06PlanWithDue(3), SEED);
    expect(atBeat(r.events, 3).some((e) => e.type === "gate.close" && e.entityId === "gate-store")).toBe(true);
    const rejected = atBeat(r.events, 4).find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "ledger-out")?.passed).toBe(false);
  });

  it("borrow-from-self: lending HEAVY to the safe is rejected loan-to-own-home", () => {
    const reason = validateRows(RBM06, [
      { rowId: "self", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-safe", startBeat: 1, dueBeat: 5 },
    ]);
    expect(reason).toBe("loan-to-own-home");
  });

  it("hall-on-the-beam: entering the hall at beat 2 is captured", () => {
    const plan = rbm06ReferencePlan();
    plan.commands = { 2: { "crew-helper": { type: "move", to: "cell-hall" } } };
    const r = simulate(RBM06, plan, SEED);
    expect(eventsOf(r, "guard.capture").some((e) => e.data?.["crewId"] === "crew-helper")).toBe(true);
  });

  it("manifest-over-budget: a second committed row is rejected over the one-row budget", () => {
    const row = rbm06ReferencePlan().rows[0]!;
    // Non-overlapping with the committed row, so the budget check is what lands.
    const extra: LoanManifestRow = { ...row, rowId: "row-two", startBeat: 6, dueBeat: null };
    expect(validateRows(RBM06, [row, extra])).toBe("manifest-over-budget");
  });
});

// ---------------------------------------------------------------------------
// RBM-07 — Double Booking
// ---------------------------------------------------------------------------

describe("RBM-07 Double Booking", () => {
  const result = simulate(RBM07, rbm07ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-7 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(firstEvent(eventsOf(result, "evaluation")).beat).toBe(7);
  });

  it("the scarce weight serves its two jobs sequentially: north opens, closes; vault opens", () => {
    expect(atBeat(result.events, 1).some((e) => e.type === "gate.open" && e.entityId === "gate-north")).toBe(true);
    expect(atBeat(result.events, 4).some((e) => e.type === "gate.close" && e.entityId === "gate-north")).toBe(true);
    expect(atBeat(result.events, 5).some((e) => e.type === "gate.open" && e.entityId === "gate-vault")).toBe(true);
    // The interval between the two HEAVY loans is the token's beat-4 home gap.
    const returns = eventsOf(result, "token.return").filter((e) => e.entityId === "TOKEN-H");
    expect(returns.map((e) => e.beat)).toEqual([4, 7]);
  });

  it("the jingle opens the east corridor for the full run", () => {
    expect(atBeat(result.events, 1).some((e) => e.type === "gate.open" && e.entityId === "gate-east")).toBe(true);
  });

  it("all three idols out, all three crew clear, both tokens home", () => {
    expect(cellOf(result, "prop-idol-north")).toBe("pad-out");
    expect(cellOf(result, "prop-idol-east")).toBe("pad-out");
    expect(cellOf(result, "prop-idol-vault")).toBe("pad-out");
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });

  it("the reordered-jobs allocation is also a complete win", () => {
    const alt = simulate(RBM07, rbm07AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
  });

  it("drives the same win through the engine commit API (manifest.commit → command.queue → test.run)", () => {
    const run = engineRun(RBM07, rbm07ReferencePlan());
    expect(run?.evaluation.success).toBe(true);
  });
});

describe("RBM-07 wrong approaches fail for the right reason", () => {
  it("double-booking: HEAVY on both scales at once is rejected overlapping-loan", () => {
    const rows = rbm07ReferencePlan().rows;
    const reason = validateRows(RBM07, [
      rows[0]!,
      { rowId: "row-double", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 3, dueBeat: 7 },
    ]);
    expect(reason).toBe("overlapping-loan");
  });

  it("monopolize-the-weight: a single long vault posting leaves the north corridor shut", () => {
    const plan: RbmPlan = {
      rows: [
        { rowId: "TOKEN-H->scale-vault@1~7", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 1, dueBeat: 7 },
        rbm07ReferencePlan().rows[2]!,
      ],
      commands: {
        2: { "crew-helper": { type: "move", to: "cell-north" }, "crew-operator": { type: "move", to: "cell-east" } },
        3: { "crew-operator": { type: "pickup-and-move", propId: "prop-idol-east", to: "pad-out" } },
        4: { "crew-runner": { type: "move", to: "cell-vault" } },
        5: { "crew-runner": { type: "pickup-and-move", propId: "prop-idol-vault", to: "pad-out" } },
      },
    };
    const r = simulate(RBM07, plan, SEED);
    const rejected = atBeat(r.events, 2).find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "idol-north-out")?.passed).toBe(false);
  });

  it("forget-the-jingle: missing the NOISY row fails plan.complete", () => {
    const plan = rbm07ReferencePlan();
    plan.rows = plan.rows.filter((r) => r.tokenId !== "TOKEN-N");
    const r = simulate(RBM07, plan, SEED);
    expect(r.evaluation.success).toBe(false);
    expect(observation(r, "plan.complete")?.passed).toBe(false);
  });

  it("vault-before-the-repost: the vault door is still shut at beat 4", () => {
    const plan = rbm07ReferencePlan();
    plan.commands = { 4: { "crew-runner": { type: "move", to: "cell-vault" } } };
    const r = simulate(RBM07, plan, SEED);
    const rejected = atBeat(r.events, 4).find((e) => e.type === "command.rejected" && e.entityId === "crew-runner");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
  });

  it("early-door-rush: a corridor crossing at beat 1 is captured — the powered door is still inside the beam", () => {
    const plan = rbm07ReferencePlan();
    plan.commands = { 1: { "crew-helper": { type: "move", to: "cell-north" } } };
    const r = simulate(RBM07, plan, SEED);
    expect(atBeat(r.events, 1).some((e) => e.type === "guard.capture" && e.data?.["crewId"] === "crew-helper")).toBe(true);
    expect(r.evaluation.success).toBe(false);
  });

  it("manifest-over-budget: a fourth committed row is rejected over the three-row ledger", () => {
    const rows = rbm07ReferencePlan().rows;
    // Commit three non-overlapping rows (both HEAVY jobs + a short NOISY one),
    // then a fourth — still legal rows, but the ledger is full.
    const n1: LoanManifestRow = { rowId: "n-early", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 4 };
    const n2: LoanManifestRow = { ...n1, rowId: "n-late", startBeat: 5, dueBeat: 7 };
    expect(validateRows(RBM07, [rows[0]!, rows[1]!, n1, n2])).toBe("manifest-over-budget");
  });
});
