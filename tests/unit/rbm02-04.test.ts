// RBM-02/03/04 acceptance suite.
//
// Every assertion is a designed obligation from the level card: the verified
// winning trace must pass end-to-end, and each designed wrong approach must
// fail for the RIGHT reason (the specific predicate or rejection the level
// teaches against) — never just "fails somehow".

import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../src/engine/contracts.js";
import { RbmEngine, type RbmAction, type RbmActionPayload, type RbmPlayState } from "../../src/engine/rbm/engine.js";
import { simulate } from "../../src/engine/rbm/sim.js";
import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../src/engine/rbm/types.js";
import { RBM02, rbm02PlanWithDue, rbm02ReferencePlan } from "../../src/content/levels/rbm02-lights-out-lights-back.js";
import { RBM03, rbm03PlanWithDue, rbm03ReferencePlan } from "../../src/content/levels/rbm03-quiet-then-quite-loud.js";
import { RBM04, rbm04PlanWithDue, rbm04ReferencePlan } from "../../src/content/levels/rbm04-the-traveling-owner.js";

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

function validateRow(level: RbmManifest, rows: LoanManifestRow[]): string | null {
  // Commits rows in order and returns the first rejection reason, if any.
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

/** Queue every planned command and run — used to assert queue-time legality. */
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

// ---------------------------------------------------------------------------
// RBM-02 — Lights Out, Lights Back
// ---------------------------------------------------------------------------

describe("RBM-02 The Weight of Evidence → Lights Out, Lights Back", () => {
  const result = simulate(RBM02, rbm02ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-5 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(eventsOf(result, "evaluation")[0]?.beat).toBe(5);
  });

  it("the loan darkens the hall at beat 1 and the carried light relights it at beat 3", () => {
    expect(
      atBeat(result.events, 1).some((e) => e.type === "loan.start" && e.entityId === "TOKEN-B" && e.data?.["to"] === "crew-helper"),
    ).toBe(true);
    // Sensors start unpowered: while BRIGHT's host is away the hall's eye
    // stays dark (no power event until the light physically walks back in).
    const eyePowers = eventsOf(result, "sensor.power").filter((e) => e.entityId === "sensor-eye");
    expect(eyePowers.every((e) => e.beat >= 3)).toBe(true);
    expect(eyePowers[0]?.beat).toBe(3); // the light walks in on her shoulder
  });

  it("the carried light wakes the vault sensor at beat 4", () => {
    expect(
      atBeat(result.events, 4).some((e) => e.type === "sensor.power" && e.entityId === "sensor-vault"),
    ).toBe(true);
  });

  it("beat 5: statuette crosses the open exit; BRIGHT relights the hall lamp", () => {
    const b5 = atBeat(result.events, 5);
    expect(b5.some((e) => e.type === "crew.move" && e.data?.["to"] === "pad-out" && e.data?.["withCargo"] === "prop-statuette")).toBe(true);
    expect(b5.some((e) => e.type === "token.return" && e.entityId === "TOKEN-B")).toBe(true);
    expect(b5.some((e) => e.type === "sensor.power" && e.entityId === "sensor-eye")).toBe(true);
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
    expect(cellOf(result, "prop-statuette")).toBe("pad-out");
  });

  it("committing the plan through the engine validates and accepts", () => {
    const s = commitPlan(RBM02, rbm02ReferencePlan());
    expect(s.lastRun?.success).toBe(true);
    const ok = engine.validateAction(RBM02, s, {
      actorId: "tester",
      commandId: "accept",
      baseRevision: s.revision,
      payload: { type: "result.accept" },
    });
    expect(ok.ok).toBe(true);
  });
});

describe("RBM-02 wrong approaches fail for the right reason", () => {
  it("keep-forever: longest loan never returns → tokenHome fails + hall stays dark", () => {
    const r = simulate(RBM02, rbm02PlanWithDue(null), SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "bright-returned")?.passed).toBe(false);
    // The visible dependency: the hall eye never relights after the loan starts.
    const afterStart = r.events.filter((e) => e.type === "sensor.power" && e.entityId === "sensor-eye" && e.beat > 4);
    expect(afterStart).toHaveLength(0);
  });

  it("early-return: due at beat 4 → the vault sensor never powers (dependency visibly unsatisfied)", () => {
    const r = simulate(RBM02, rbm02PlanWithDue(4), SEED);
    expect(eventsOf(r, "sensor.power").some((e) => e.entityId === "sensor-vault")).toBe(false);
    // The helper still escapes, so the lesson is the dependency, not capture.
    expect(outcome(r, "crew-safe")?.passed).toBe(true);
  });

  it("skip-the-loan: empty manifest fails plan.complete", () => {
    const r = simulate(RBM02, { rows: [], commands: rbm02ReferencePlan().commands }, SEED);
    expect(r.evaluation.success).toBe(false);
    expect(observation(r, "plan.complete")?.passed).toBe(false);
  });

  it("cross-under-the-beam: entering the hall at beat 2 is captured", () => {
    const plan: RbmPlan = {
      rows: [rbm02ReferencePlan().rows[0]!],
      commands: { 2: { "crew-helper": { type: "move", to: "cell-hall" } } },
    };
    const r = simulate(RBM02, plan, SEED);
    const captures = eventsOf(r, "guard.capture");
    expect(captures.some((e) => e.data?.["crewId"] === "crew-helper")).toBe(true);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "crew-safe")?.passed).toBe(false);
  });

  it("double-booking: a second row over the same token is rejected overlapping-loan", () => {
    const [row] = [rbm02ReferencePlan().rows[0]!];
    const reason = validateRow(RBM02, [
      row,
      { ...row, rowId: "row-again", startBeat: 3, dueBeat: 4 },
    ]);
    expect(reason).toBe("overlapping-loan");
  });
});

// ---------------------------------------------------------------------------
// RBM-03 — Quiet, Then Quite Loud
// ---------------------------------------------------------------------------

describe("RBM-03 Quiet, Then Quite Loud", () => {
  const result = simulate(RBM03, rbm03ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-6 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(eventsOf(result, "evaluation")[0]?.beat).toBe(6);
  });

  it("the quiet crossing: toy leaves the plate at beat 3, opening the lift door", () => {
    const b3 = atBeat(result.events, 3);
    expect(b3.some((e) => e.type === "crew.move" && e.data?.["to"] === "cell-gallery" && e.data?.["withCargo"] === "prop-toy")).toBe(true);
    expect(b3.some((e) => e.type === "plate.release" && e.entityId === "plate-lift")).toBe(true);
    expect(b3.some((e) => e.type === "gate.open" && e.entityId === "gate-lift")).toBe(true);
    // The quiet toy never rings the listening post on the way.
    expect(b3.some((e) => e.type === "sensor.power")).toBe(false);
  });

  it("beat 5: parked toy re-presses the plate — the lift door slams behind the operator", () => {
    const b5 = atBeat(result.events, 5);
    expect(b5.some((e) => e.type === "crew.drop" && e.entityId === "crew-helper")).toBe(true);
    expect(b5.some((e) => e.type === "crew.move" && e.entityId === "crew-operator" && e.data?.["to"] === "pad-out")).toBe(true);
    expect(b5.some((e) => e.type === "gate.close" && e.entityId === "gate-lift")).toBe(true);
  });

  it("beat 6: NOISY returns to the parked toy — the listening post rings; helper exits", () => {
    const b6 = atBeat(result.events, 6);
    expect(b6.some((e) => e.type === "token.return" && e.entityId === "TOKEN-N" && e.data?.["to"] === "prop-toy")).toBe(true);
    expect(b6.some((e) => e.type === "sensor.power" && e.entityId === "sensor-ear")).toBe(true);
    expect(b6.some((e) => e.type === "crew.move" && e.entityId === "crew-helper" && e.data?.["to"] === "pad-out")).toBe(true);
    // The watch beam finds the lift door shut: the pad stays dark.
    const attention = b6.filter((e) => e.type === "guard.attention").at(-1);
    expect(attention?.data?.["post"]).toBe("guard-south");
    expect(attention?.data?.["lit"]).toEqual([]);
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });
});

describe("RBM-03 wrong approaches fail for the right reason", () => {
  it("stationary-return: toy never moved → toy-posted fails and the post never rings", () => {
    const plan: RbmPlan = {
      rows: [rbm03ReferencePlan().rows[0]!],
      commands: {
        4: { "crew-operator": { type: "pickup-and-move", propId: "prop-bust", to: "cell-nursery" } },
        5: { "crew-operator": { type: "move", to: "pad-out" } },
      },
    };
    const r = simulate(RBM03, plan, SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "toy-posted")?.passed).toBe(false);
    expect(eventsOf(r, "sensor.power")).toHaveLength(0);
  });

  it("loud-window: toy through the gallery at beat 2 is captured", () => {
    const plan: RbmPlan = {
      rows: [rbm03ReferencePlan().rows[0]!],
      commands: { 2: { "crew-helper": { type: "pickup-and-move", propId: "prop-toy", to: "cell-gallery" } } },
    };
    const r = simulate(RBM03, plan, SEED);
    expect(eventsOf(r, "guard.capture").some((e) => e.data?.["crewId"] === "crew-helper")).toBe(true);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "crew-safe")?.passed).toBe(false);
  });

  it("keep-forever: NOISY never returns → tokenHome fails, post stays silent", () => {
    const r = simulate(RBM03, rbm03PlanWithDue(null), SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "noisy-returned")?.passed).toBe(false);
    expect(eventsOf(r, "sensor.power").some((e) => e.entityId === "sensor-ear")).toBe(false);
  });

  it("missed-lift-window: operator exits at beat 6 → gate-closed rejection", () => {
    const plan = rbm03ReferencePlan();
    plan.commands[5] = { "crew-helper": { type: "drop" } };
    plan.commands[6] = {
      "crew-helper": { type: "move", to: "pad-out" },
      "crew-operator": { type: "move", to: "pad-out" },
    };
    const r = simulate(RBM03, plan, SEED);
    const rejected = atBeat(r.events, 6).find(
      (e) => e.type === "command.rejected" && e.entityId === "crew-operator",
    );
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "operator-extracted")?.passed).toBe(false);
  });

  it("double-booking: a second row over the same token is rejected overlapping-loan", () => {
    const [row] = [rbm03ReferencePlan().rows[0]!];
    const reason = validateRow(RBM03, [
      row,
      { ...row, rowId: "row-again", startBeat: 2, dueBeat: 4 },
    ]);
    expect(reason).toBe("overlapping-loan");
  });
});

// ---------------------------------------------------------------------------
// RBM-04 — The Traveling Owner
// ---------------------------------------------------------------------------

describe("RBM-04 The Traveling Owner", () => {
  const result = simulate(RBM04, rbm04ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-6 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(eventsOf(result, "evaluation")[0]?.beat).toBe(6);
  });

  it("the loan lightens the safe and releases the alarm plate at beat 2", () => {
    // Beat 1 proves the fixture's starting state: the heavy safe presses the
    // alarm plate and the lobby gate is shut.
    const b1 = atBeat(result.events, 1);
    expect(b1.some((e) => e.type === "plate.press" && e.entityId === "plate-alarm")).toBe(true);
    const b2 = atBeat(result.events, 2);
    expect(b2.some((e) => e.type === "loan.start" && e.entityId === "TOKEN-H" && e.data?.["to"] === "prop-crate")).toBe(true);
    expect(b2.some((e) => e.type === "plate.release" && e.entityId === "plate-alarm")).toBe(true);
    expect(b2.some((e) => e.type === "gate.open" && e.entityId === "gate-lobby")).toBe(true);
  });

  it("beat 4: HEAVY returns to the carried owner and settles it inside the vault", () => {
    const b4 = atBeat(result.events, 4);
    const ret = b4.find((e) => e.type === "token.return" && e.entityId === "TOKEN-H");
    expect(ret?.data?.["to"]).toBe("prop-safe");
    expect(ret?.data?.["homeCellId"]).toBe("cell-vault"); // home followed the moved owner
    const settled = b4.find((e) => e.type === "cargo.settled");
    expect(settled?.data?.["cellId"]).toBe("cell-vault");
    // The weight-sense confirms the return landed at the new location.
    expect(b4.some((e) => e.type === "sensor.power" && e.entityId === "sensor-vault")).toBe(true);
  });

  it("beat 5: the returned weight re-presses the alarm plate — lobby gate slams behind", () => {
    // Engine phase 5 presses plates before settling overloaded cargo, so the
    // re-press lands one beat after the return (observable engine truth).
    const b5 = atBeat(result.events, 5);
    expect(b5.some((e) => e.type === "plate.press" && e.entityId === "plate-alarm")).toBe(true);
    expect(b5.some((e) => e.type === "gate.close" && e.entityId === "gate-lobby")).toBe(true);
  });

  it("beat 6: helper exits the delivery window; the shut gate darkens the pad ray", () => {
    expect(cellOf(result, "prop-safe")).toBe("cell-vault");
    expect(cellOf(result, "crew-helper")).toBe("pad-out");
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });
});

describe("RBM-04 wrong approaches fail for the right reason", () => {
  it("return-at-the-old-shelf: due beat 2 settles the safe back in the gallery", () => {
    const r = simulate(RBM04, rbm04PlanWithDue(2), SEED);
    const settled = firstEvent(eventsOf(r, "cargo.settled"));
    expect(settled.beat).toBe(2);
    expect(settled.data?.["cellId"]).toBe("cell-gallery");
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "safe-vaulted")?.passed).toBe(false);
    expect(eventsOf(r, "sensor.power").some((e) => e.entityId === "sensor-vault")).toBe(false);
  });

  it("keep-forever: HEAVY never returns → the safe walks out instead of landing", () => {
    const r = simulate(RBM04, rbm04PlanWithDue(null), SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "heavy-returned")?.passed).toBe(false);
    expect(outcome(r, "safe-vaulted")?.passed).toBe(false);
    expect(cellOf(r, "prop-safe")).toBe("pad-out"); // carried through
  });

  it("mid-route-return: due beat 3 lands the weight in the lobby, halfway there", () => {
    const r = simulate(RBM04, rbm04PlanWithDue(3), SEED);
    const settled = firstEvent(eventsOf(r, "cargo.settled"));
    expect(settled.data?.["cellId"]).toBe("cell-lobby");
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "safe-vaulted")?.passed).toBe(false);
    // The token did come home — it just landed at the wrong stop.
    expect(outcome(r, "heavy-returned")?.passed).toBe(true);
  });

  it("leave-the-owner: walking out without the safe fails entityAt", () => {
    const plan: RbmPlan = {
      rows: [rbm04ReferencePlan().rows[0]!],
      commands: {
        3: { "crew-helper": { type: "move", to: "cell-lobby" } },
        4: { "crew-helper": { type: "move", to: "cell-vault" } },
        6: { "crew-helper": { type: "move", to: "pad-out" } },
      },
    };
    const r = simulate(RBM04, plan, SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "safe-vaulted")?.passed).toBe(false);
    expect(cellOf(r, "prop-safe")).toBe("cell-gallery");
  });

  it("manifest-over-budget: a second committed row is rejected over the one-row budget", () => {
    const first = rbm04ReferencePlan().rows[0]!;
    const extra: LoanManifestRow = {
      rowId: "row-nightlamp",
      tokenId: "TOKEN-B",
      fromHostId: "prop-nightlamp",
      toHostId: "crew-operator",
      startBeat: 1,
      dueBeat: 4,
    };
    expect(validateRow(RBM04, [first, extra])).toBe("manifest-over-budget");
  });

  it("double-booking: a second row over the same token is rejected overlapping-loan", () => {
    const first = rbm04ReferencePlan().rows[0]!;
    const reason = validateRow(RBM04, [
      first,
      { ...first, rowId: "row-again", startBeat: 2, dueBeat: 3 },
    ]);
    expect(reason).toBe("overlapping-loan");
  });
});
