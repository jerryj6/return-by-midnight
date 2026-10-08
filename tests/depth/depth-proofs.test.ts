/**
 * RBM depth proofs (gate G3): load-bearing structure — remove any single
 * authored ingredient (manifest row or scheduled command) from a winning
 * plan and the run must stop succeeding — plus scheduled counterexamples
 * (wrong due beats) must fail on targeted predicates, never a blanket
 * rejection. Where a level authors a parameterized counterexample
 * (rbmNNPlanWithDue), the same plan with a wrong due beat is compared
 * against the winning one and must differ exactly in outcome failures.
 */
import { describe, it, expect } from "vitest";
import { simulate } from "../../src/engine/rbm/sim.js";
import { RbmEngine, type RbmAction } from "../../src/engine/rbm/engine.js";
import { LEVELS } from "../../src/content/levels/index.js";
import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../src/engine/rbm/types.js";
import { WINNING_TRACES, committedRun, SEED } from "../lib/winning-traces.js";
import { rbm02PlanWithDue } from "../../src/content/levels/rbm02-lights-out-lights-back.js";
import { rbm03PlanWithDue } from "../../src/content/levels/rbm03-quiet-then-quite-loud.js";
import { rbm04PlanWithDue } from "../../src/content/levels/rbm04-the-traveling-owner.js";
import { rbm06PlanWithDue } from "../../src/content/levels/rbm06-the-door-that-pays-you-back.js";
import { rbm08PlanWithDue } from "../../src/content/levels/rbm08-last-call.js";
import { rbm09PlanWithDue } from "../../src/content/levels/rbm09-the-moving-deposit.js";

const eng = new RbmEngine();
const levelDef = (id: string): RbmManifest => LEVELS.find(l => l.id === id)!.def;

describe("depth: an empty plan never solves", () => {
  it.each(LEVELS.map(l => [l.id, l.def] as const))("%s", (_id, level) => {
    const res = simulate(level, { rows: [], commands: {} }, SEED);
    expect(res.evaluation.success).toBe(false);
  });
});

describe("depth: every committed manifest row is load-bearing", () => {
  for (const [id, traces] of Object.entries(WINNING_TRACES)) {
    const level = levelDef(id);
    for (const trace of traces) {
      const plan = trace.plan();
      for (let drop = 0; drop < plan.rows.length; drop++) {
        it(`${id}/${trace.name}: removing row ${plan.rows[drop]!.rowId} breaks the run`, () => {
          const partial: RbmPlan = {
            rows: plan.rows.filter((_, i) => i !== drop),
            commands: plan.commands,
          };
          const res = simulate(level, partial, SEED);
          expect(res.evaluation.success).toBe(false);
        });
      }
    }
  }
});

describe("depth: queued commands are load-bearing (redundancy set is exactly as documented)", () => {
  /**
   * Commands whose removal does NOT break the run. RBM-10's lookout
   * vestibule trip is an authored side-errand no outcome binds (the
   * declared outcomes cover extractions only), so clearing her foyer/exit
   * steps leaves the contract solved — a real finding about the level
   * design, asserted here verbatim rather than silently exempted. Every
   * other command across the campaign must be load-bearing: this set is
   * the contract, and growth means a new redundancy appeared.
   */
  const KNOWN_REDUNDANT: Record<string, Record<string, string[]>> = {
    "RBM-10": {
      // lookout's foyer step is flavor-bound: without it her later
      // vestibule commands are unreachable/dropped, she stays outside,
      // and the extraction outcomes still pass — the vestibule idol is
      // not outcome-bound.
      "late-return": ["crew-lookout@3"],
      "early-return": ["crew-lookout@3", "crew-runner@4"],
    },
  };

  for (const [id, traces] of Object.entries(WINNING_TRACES)) {
    const level = levelDef(id);
    for (const trace of traces) {
      it(`${id}/${trace.name}: clearing a command breaks the run — except documented redundancies`, () => {
        const plan = trace.plan();
        const flat = Object.entries(plan.commands).flatMap(([beat, per]) =>
          Object.keys(per).map(crewId => `${crewId}@${beat}`));
        const redundant: string[] = [];
        for (const key of flat) {
          const [crewId, beatStr] = key.split("@") as [string, string];
          const commands: RbmPlan["commands"] = JSON.parse(JSON.stringify(plan.commands));
          delete commands[Number(beatStr)]![crewId];
          const res = simulate(level, { rows: plan.rows, commands }, SEED);
          if (res.evaluation.success) redundant.push(key);
        }
        expect(redundant.sort(), `${id}/${trace.name} unexpected non-load-bearing commands`)
          .toEqual((KNOWN_REDUNDANT[id]?.[trace.name] ?? []).slice().sort());
      });
    }
  }
});

describe("depth: overlapping loans are refused (conflict is mechanical, not advisory)", () => {
  it.each(LEVELS.map(l => [l.id, l.def] as const))("%s", (_id, level) => {
    for (const token of level.tokens) {
      const host = [...level.props, ...level.crew].find(p => p.accepts?.includes(token.property));
      if (!host) continue;
      const dueA = level.loans.legalDueBeats.find(d => typeof d === "number" && d >= 3) ?? 3;
      const row = (id: string, start: number, due: number | null): LoanManifestRow => ({
        rowId: id, tokenId: token.id, fromHostId: token.homeEntityId,
        toHostId: host.id, startBeat: start, dueBeat: due,
      });
      // Same token, two overlapping windows.
      let s = eng.createInitialState(level);
      const mk = (r: LoanManifestRow, cid: string): RbmAction => ({
        actorId: "d", commandId: cid, baseRevision: s.revision,
        payload: { type: "manifest.commit", row: r },
      });
      const c1 = eng.validateAction(level, s, mk(row("a", 1, dueA), "r1"));
      if (!c1.ok) continue; // token can't legally leave → nothing to test
      s = eng.applyAction(level, s, mk(row("a", 1, dueA), "r1")).state;
      const c2 = eng.validateAction(level, s, mk(row("b", 2, dueA + 1 > (level.verification.horizonBeat) ? dueA : dueA + 1), "r2"));
      expect(c2.ok).toBe(false);
      expect(c2.reason).toMatch(/overlap|conflict|already/i);
    }
  });
});

describe("depth: wrong due beats fail on outcome predicates (targeted, not generic)", () => {
  const PARAM: [string, (d: number | null) => RbmPlan][] = [
    ["RBM-02", rbm02PlanWithDue],
    ["RBM-03", rbm03PlanWithDue],
    ["RBM-04", rbm04PlanWithDue],
    ["RBM-06", rbm06PlanWithDue],
    ["RBM-09", rbm09PlanWithDue],
  ];
  for (const [id, mk] of PARAM) {
    const level = levelDef(id);
    it(`${id}: a wrong due beat produces a targeted outcome failure`, () => {
      // Find the winning due beat from the reference row, then try every
      // other legal due beat — at least one must fail on outcomes (not a
      // validation rejection).
      const win = WINNING_TRACES[id]![0]!.plan();
      const due = win.rows[0]!.dueBeat;
      const wrongs = level.loans.legalDueBeats.filter(d => d !== due);
      let sawTargetedFailure = false;
      for (const d of wrongs) {
        const res = simulate(level, mk(d), SEED);
        if (!res.evaluation.success) {
          const failedOutcomes = res.evaluation.outcomes.filter(o => !o.passed);
          expect(failedOutcomes.length).toBeGreaterThan(0);
          sawTargetedFailure = true;
        }
      }
      expect(sawTargetedFailure, `${id}: no wrong due beat failed`).toBe(true);
    });
  }

  it("RBM-08: swapping the rattle's due beat collapses the chain", () => {
    const level = levelDef("RBM-08");
    for (const t of ["TOKEN-B", "TOKEN-N", "TOKEN-H"] as const) {
      const res = simulate(level, rbm08PlanWithDue(t, null), SEED);
      // keeping any one of the three forever must break the contract
      expect(res.evaluation.success, `${t} keep-forever should fail`).toBe(false);
    }
  });
});

describe("depth: session-engine path agrees (committed plan → accepted)", () => {
  it.each(Object.keys(WINNING_TRACES))("%s committed reference plan reaches accepted", (id) => {
    const level = levelDef(id);
    const { state, error } = committedRun(eng, level, WINNING_TRACES[id]![0]!.plan());
    expect(error).toBeUndefined();
    expect(state.lastRun?.success).toBe(true);
  });
});
