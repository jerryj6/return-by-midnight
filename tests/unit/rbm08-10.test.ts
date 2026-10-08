// RBM-08/09/10 acceptance suite — chapter-3 interdependence levels.
// Same contract as earlier suites: verified winning traces must pass
// end-to-end, each designed wrong approach must fail for the RIGHT reason.

import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../src/engine/contracts.js";
import { RbmEngine, type RbmAction, type RbmActionPayload, type RbmPlayState } from "../../src/engine/rbm/engine.js";
import { simulate } from "../../src/engine/rbm/sim.js";
import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../src/engine/rbm/types.js";
import { RBM08, rbm08AlternatePlan, rbm08PlanWithDue, rbm08ReferencePlan } from "../../src/content/levels/rbm08-last-call.js";
import { RBM09, rbm09PlanWithAim, rbm09PlanWithDue, rbm09ReferencePlan } from "../../src/content/levels/rbm09-the-moving-deposit.js";
import { RBM10, rbm10AlternatePlan, rbm10ReferencePlan } from "../../src/content/levels/rbm10-the-quietest-exit.js";

const engine = new RbmEngine();
const SEED = "rbm-campaign-seed";

const eventsOf = (r: ReturnType<typeof simulate>, type: string): GameEvent[] =>
  r.events.filter((e) => e.type === type);
const atBeat = (events: GameEvent[], beat: number): GameEvent[] => events.filter((e) => e.beat === beat);
const outcome = (r: ReturnType<typeof simulate>, id: string) =>
  r.evaluation.outcomes.find((o) => o.predicateId === id);
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
// RBM-08 — Last Call
// ---------------------------------------------------------------------------

describe("RBM-08 Last Call", () => {
  const result = simulate(RBM08, rbm08ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-7 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(firstEvent(eventsOf(result, "evaluation")).beat).toBe(7);
  });

  it("the chain composes: rattle's early return reopens the east door at beat 2", () => {
    expect(atBeat(result.events, 2).some((e) => e.type === "token.return" && e.entityId === "TOKEN-N")).toBe(true);
    expect(atBeat(result.events, 2).some((e) => e.type === "gate.open" && e.entityId === "gate-e1")).toBe(true);
  });

  it("the lamp's away-window holds the north door and lobby exit open the whole run", () => {
    // The beat-1 settle registers the weighted lamp (press); the beat-2 loan
    // releases it — the away-window opens from the end of beat 2.
    expect(atBeat(result.events, 2).some((e) => e.type === "gate.open" && e.entityId === "gate-n1")).toBe(true);
    expect(atBeat(result.events, 2).some((e) => e.type === "gate.open" && e.entityId === "gate-lobby")).toBe(true);
    // The lamp relights on its beat-6 return — both doors reseal then.
    expect(atBeat(result.events, 6).some((e) => e.type === "gate.close" && e.entityId === "gate-n1")).toBe(true);
    expect(atBeat(result.events, 6).some((e) => e.type === "gate.close" && e.entityId === "gate-lobby")).toBe(true);
  });

  it("four crew, four take, three tokens home, nobody captured", () => {
    for (const id of ["prop-idol-north", "prop-idol-east", "prop-idol-vault", "prop-ledger"]) {
      expect(cellOf(result, id)).toBe("pad-out");
    }
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });

  it("the alternative schedule (earlier weight posting, tighter lamp window) also wins", () => {
    const alt = simulate(RBM08, rbm08AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
  });
});

describe("RBM-08 wrong approaches fail for the right reason", () => {
  it("swap-the-due-beats: rattle due 6 + lamp due 2 breaks both legs of the chain", () => {
    const plan = rbm08ReferencePlan();
    plan.rows = plan.rows.map((r) =>
      r.tokenId === "TOKEN-B" ? { ...r, dueBeat: 3 } : r.tokenId === "TOKEN-N" ? { ...r, dueBeat: 6 } : r,
    );
    const r = simulate(RBM08, plan, SEED);
    // East door never opens until beat 6: runner's beat-4 entry is refused.
    const rejected = atBeat(r.events, 4).find((e) => e.type === "command.rejected" && e.entityId === "crew-runner");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    // Lamp relit at beat 2: north door + lobby exit sealed the whole run.
    const helperRej = atBeat(r.events, 4).find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
    expect(helperRej?.data?.["reason"]).toBe("gate-closed");
    const lookoutRej = atBeat(r.events, 5).find((e) => e.type === "command.rejected" && e.entityId === "crew-lookout");
    expect(lookoutRej?.data?.["reason"]).toBe("gate-closed");
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "idol-east-out")?.passed).toBe(false);
    expect(outcome(r, "idol-north-out")?.passed).toBe(false);
  });

  it("lamp-home-early: due 4 reseals the lobby with the lookout inside", () => {
    const r = simulate(RBM08, rbm08PlanWithDue("TOKEN-B", 4), SEED);
    expect(atBeat(r.events, 4).some((e) => e.type === "gate.close" && e.entityId === "gate-lobby")).toBe(true);
    const rejected = atBeat(r.events, 5).find((e) => e.type === "command.rejected" && e.entityId === "crew-lookout");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "ledger-out")?.passed).toBe(false);
  });

  it("skip-the-early-return: the bell door never reopens", () => {
    const r = simulate(RBM08, rbm08PlanWithDue("TOKEN-N", null), SEED);
    const rejected = atBeat(r.events, 4).find((e) => e.type === "command.rejected" && e.entityId === "crew-runner");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "idol-east-out")?.passed).toBe(false);
    expect(outcome(r, "noisy-home")?.passed).toBe(false);
  });

  it("entry-during-the-sweep: a corridor crossing at beat 3 is captured", () => {
    const plan = rbm08ReferencePlan();
    plan.commands = { 3: { "crew-helper": { type: "move", to: "cell-north" } } };
    const r = simulate(RBM08, plan, SEED);
    expect(atBeat(r.events, 3).some((e) => e.type === "guard.capture" && e.data?.["crewId"] === "crew-helper")).toBe(true);
  });

  it("manifest-over-budget: a fourth committed row is rejected", () => {
    const rows = rbm08ReferencePlan().rows;
    const extra: LoanManifestRow = {
      rowId: "row-four",
      tokenId: "TOKEN-B",
      fromHostId: "prop-lamp",
      toHostId: "prop-candlestick",
      startBeat: 7,
      dueBeat: null,
    };
    expect(validateRows(RBM08, [...rows, extra])).toBe("manifest-over-budget");
  });
});

// ---------------------------------------------------------------------------
// RBM-09 — The Moving Deposit
// ---------------------------------------------------------------------------

describe("RBM-09 The Moving Deposit", () => {
  const result = simulate(RBM09, rbm09ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-7 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(firstEvent(eventsOf(result, "evaluation")).beat).toBe(7);
  });

  it("carrying the dormant stand releases the dark-room door for exactly the carry window", () => {
    // Lifted at 3, moved at 4, set down at 5 — the plate releases at 3–4
    // settles and re-seals at 5.
    expect(atBeat(result.events, 3).some((e) => e.type === "gate.open" && e.entityId === "gate-dark")).toBe(true);
    expect(atBeat(result.events, 5).some((e) => e.type === "gate.close" && e.entityId === "gate-dark")).toBe(true);
  });

  it("the re-sited stand receives the restored light: junction sensor powers at beat 6", () => {
    const powers = eventsOf(result, "sensor.power").filter((e) => e.entityId === "sensor-junction");
    expect(powers.map((e) => e.beat)).toContain(6);
    expect(cellOf(result, "prop-stand")).toBe("cell-junction");
    expect(atBeat(result.events, 6).some((e) => e.type === "token.return" && e.entityId === "TOKEN-B")).toBe(true);
  });

  it("the move enables the teammate's goal: operator leaves the dark room with the idol", () => {
    expect(cellOf(result, "prop-idol-dark")).toBe("pad-out");
    expect(cellOf(result, "prop-idol-loft")).toBe("pad-out");
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });
});

describe("RBM-09 wrong approaches fail for the right reason", () => {
  it("wrong-aim: the stand parked at the alcove leaves the receiver dark", () => {
    const r = simulate(RBM09, rbm09PlanWithAim("cell-alcove"), SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "stand-aimed")?.passed).toBe(false);
    expect(eventsOf(r, "sensor.power").filter((e) => e.entityId === "sensor-junction")).toHaveLength(0);
  });

  it("carry-window-miss: the dark door re-seals once the stand is set down", () => {
    const plan = rbm09ReferencePlan();
    plan.commands = {
      3: { "crew-helper": { type: "pickup", propId: "prop-stand" } },
      4: { "crew-helper": { type: "move", to: "cell-junction" } },
      5: { "crew-helper": { type: "drop" } },
      6: { "crew-operator": { type: "move", to: "cell-dark" } },
    };
    const r = simulate(RBM09, plan, SEED);
    const rejected = atBeat(r.events, 6).find((e) => e.type === "command.rejected" && e.entityId === "crew-operator");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "idol-dark-out")?.passed).toBe(false);
  });

  it("keep-the-light-forever: no restore, no receiver", () => {
    const r = simulate(RBM09, rbm09PlanWithDue(null), SEED);
    expect(r.evaluation.success).toBe(false);
    expect(outcome(r, "bright-home")?.passed).toBe(false);
    expect(eventsOf(r, "sensor.power").filter((e) => e.entityId === "sensor-junction")).toHaveLength(0);
  });

  it("entry-during-the-sweep: a side-room entry at beat 3 is captured", () => {
    const plan = rbm09ReferencePlan();
    plan.commands = { 3: { "crew-runner": { type: "move", to: "cell-loft" } } };
    const r = simulate(RBM09, plan, SEED);
    expect(atBeat(r.events, 3).some((e) => e.type === "guard.capture" && e.data?.["crewId"] === "crew-runner")).toBe(true);
  });

  it("overlapping-second-loan: the single light cannot serve two hosts at once", () => {
    const rows = rbm09ReferencePlan().rows;
    const second: LoanManifestRow = {
      rowId: "row-two",
      tokenId: "TOKEN-B",
      fromHostId: "prop-stand",
      toHostId: "prop-candlestick",
      startBeat: 4,
      dueBeat: 7,
    };
    expect(validateRows(RBM09, [...rows, second])).toBe("overlapping-loan");
  });
});

// ---------------------------------------------------------------------------
// RBM-10 — The Quietest Exit
// ---------------------------------------------------------------------------

describe("RBM-10 The Quietest Exit", () => {
  const result = simulate(RBM10, rbm10ReferencePlan(), SEED);

  it("canonical trace succeeds at the end-of-beat-8 horizon", () => {
    expect(result.evaluation.success).toBe(true);
    expect(firstEvent(eventsOf(result, "evaluation")).beat).toBe(8);
  });

  it("the helpful return unbars both gallery doors at the beat-5 settle", () => {
    const b5 = atBeat(result.events, 5);
    expect(b5.some((e) => e.type === "token.return" && e.entityId === "TOKEN-N")).toBe(true);
    expect(b5.some((e) => e.type === "gate.open" && e.entityId === "gate-gallery")).toBe(true);
    expect(b5.some((e) => e.type === "gate.open" && e.entityId === "gate-gallery-window")).toBe(true);
  });

  it("the same opening pours the beam into the vestibule — after the lookout has left", () => {
    // The vestibule segment is gated by gate-gallery; once open, the west
    // watch lights it. She exited at beat 5 — nobody is there to find.
    const detections = eventsOf(result, "guard.detect").filter((e) => e.data?.["cellId"] === "cell-vestibule");
    expect(detections).toHaveLength(0);
    expect(eventsOf(result, "guard.capture")).toHaveLength(0);
  });

  it("four crew, four idols out, both tokens home", () => {
    for (const id of ["prop-idol-bell", "prop-idol-gallery", "prop-idol-attic", "prop-idol-vest"]) {
      expect(cellOf(result, id)).toBe("pad-out");
    }
  });

  it("the inside-corridor strategy (early return, foyer route) also wins", () => {
    const alt = simulate(RBM10, rbm10AlternatePlan(), SEED);
    expect(alt.evaluation.success).toBe(true);
  });

  it("drives the canonical win through the engine commit API", () => {
    const run = engineRun(RBM10, rbm10ReferencePlan());
    expect(run?.evaluation.success).toBe(true);
  });
});

describe("RBM-10 wrong approaches fail for the right reason", () => {
  it("linger-in-the-vestibule: the helpful return exposes the teammate", () => {
    const plan = rbm10ReferencePlan();
    // Lookout enters the vestibule at beat 4 and just waits — the return at
    // beat 5 opens the gallery and the west beam finds her at beat 6.
    plan.commands = {
      1: { "crew-lookout": { type: "move", to: "pad-out" } },
      3: { "crew-lookout": { type: "move", to: "cell-foyer" } },
      4: { "crew-lookout": { type: "move", to: "cell-vestibule" } },
    };
    const r = simulate(RBM10, plan, SEED);
    const capture = r.events.find((e) => e.type === "guard.capture" && e.data?.["crewId"] === "crew-lookout");
    expect(capture, "expected the opened gallery to expose the vestibule").toBeTruthy();
    expect(capture?.data?.["cellId"]).toBe("cell-vestibule");
    expect(r.evaluation.success).toBe(false);
  });

  it("the same linger is SAFE when the return never lands — the exposure and the opening are one event", () => {
    const plan = rbm10ReferencePlan();
    plan.rows = plan.rows.map((r) => (r.tokenId === "TOKEN-N" ? { ...r, dueBeat: null } : r));
    plan.commands = {
      1: { "crew-lookout": { type: "move", to: "pad-out" } },
      3: { "crew-lookout": { type: "move", to: "cell-foyer" } },
      4: { "crew-lookout": { type: "move", to: "cell-vestibule" } },
      5: { "crew-lookout": { type: "pickup-and-move", propId: "prop-idol-vest", to: "pad-out" } },
    };
    const r = simulate(RBM10, plan, SEED);
    expect(eventsOf(r, "guard.capture")).toHaveLength(0);
    // But the gallery never opens and the token never comes home.
    expect(outcome(r, "idol-gallery-out")?.passed).toBe(false);
    expect(outcome(r, "noisy-home")?.passed).toBe(false);
  });

  it("bell-shut-early: the rattle home at beat 2 strands the helper inside the loft", () => {
    const plan = rbm10ReferencePlan();
    plan.rows = plan.rows.map((r) => (r.tokenId === "TOKEN-N" ? { ...r, dueBeat: 2 } : r));
    const r = simulate(RBM10, plan, SEED);
    expect(atBeat(r.events, 2).some((e) => e.type === "gate.close" && e.entityId === "gate-bell")).toBe(true);
    const rejected = atBeat(r.events, 3).find((e) => e.type === "command.rejected" && e.entityId === "crew-helper");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "idol-bell-out")?.passed).toBe(false);
  });

  it("never-return-the-rattle: the runner's window entry is refused", () => {
    const plan = rbm10ReferencePlan();
    plan.rows = plan.rows.map((r) => (r.tokenId === "TOKEN-N" ? { ...r, dueBeat: null } : r));
    const r = simulate(RBM10, plan, SEED);
    const rejected = atBeat(r.events, 6).find((e) => e.type === "command.rejected" && e.entityId === "crew-runner");
    expect(rejected?.data?.["reason"]).toBe("gate-closed");
    expect(outcome(r, "idol-gallery-out")?.passed).toBe(false);
  });

  it("borrower-mismatch: BRIGHT will not sit in a NOISY sack", () => {
    const reason = validateRows(RBM10, [
      { rowId: "mismatch", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-decoy", startBeat: 1, dueBeat: 5 },
    ]);
    expect(reason).toBe("incompatible-host");
  });

  it("manifest-over-budget: a third committed row is rejected", () => {
    const rows = rbm10ReferencePlan().rows;
    const extra: LoanManifestRow = {
      rowId: "row-three",
      tokenId: "TOKEN-N",
      fromHostId: "prop-toy",
      toHostId: "prop-decoy",
      startBeat: 6,
      dueBeat: 7,
    };
    expect(validateRows(RBM10, [...rows, extra])).toBe("manifest-over-budget");
  });
});
