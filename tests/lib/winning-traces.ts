/**
 * winning-traces.ts — registry of the verified winning plans exported by
 * every RBM level file (rbmNNReferencePlan + alternates where authored),
 * shared by the campaign, depth, and performance suites.
 */
import type { RbmManifest, RbmPlan } from "../../src/engine/rbm/types.js";
import { simulate } from "../../src/engine/rbm/sim.js";
import { RbmEngine, type RbmAction, type RbmActionPayload, type RbmPlayState } from "../../src/engine/rbm/engine.js";
import { rbm01ReferencePlan, rbm01AlternatePlan } from "../../src/content/levels/rbm01-weight-of-evidence.js";
import { rbm02ReferencePlan } from "../../src/content/levels/rbm02-lights-out-lights-back.js";
import { rbm03ReferencePlan } from "../../src/content/levels/rbm03-quiet-then-quite-loud.js";
import { rbm04ReferencePlan } from "../../src/content/levels/rbm04-the-traveling-owner.js";
import { rbm05ReferencePlan, rbm05AlternatePlan } from "../../src/content/levels/rbm05-one-light-two-jobs.js";
import { rbm06ReferencePlan, rbm06AlternatePlan } from "../../src/content/levels/rbm06-the-door-that-pays-you-back.js";
import { rbm07ReferencePlan, rbm07AlternatePlan } from "../../src/content/levels/rbm07-double-booking.js";
import { rbm08ReferencePlan, rbm08AlternatePlan } from "../../src/content/levels/rbm08-last-call.js";
import { rbm09ReferencePlan } from "../../src/content/levels/rbm09-the-moving-deposit.js";
import { rbm10ReferencePlan, rbm10AlternatePlan } from "../../src/content/levels/rbm10-the-quietest-exit.js";
import { rbm11ReferencePlan, rbm11AlternatePlan } from "../../src/content/levels/rbm11-night-shift.js";
import { rbm12ReferencePlan, rbm12AlternatePlan } from "../../src/content/levels/rbm12-midnight-returns.js";

export interface WinningTrace {
  readonly name: string;
  readonly plan: () => RbmPlan;
}

export const WINNING_TRACES: Record<string, readonly WinningTrace[]> = {
  "RBM-01": [
    { name: "reference", plan: rbm01ReferencePlan },
    { name: "alternate", plan: rbm01AlternatePlan },
  ],
  "RBM-02": [{ name: "reference", plan: rbm02ReferencePlan }],
  "RBM-03": [{ name: "reference", plan: rbm03ReferencePlan }],
  "RBM-04": [{ name: "reference", plan: rbm04ReferencePlan }],
  "RBM-05": [
    { name: "north-first", plan: rbm05ReferencePlan },
    { name: "south-first", plan: rbm05AlternatePlan },
  ],
  "RBM-06": [
    { name: "helper-store", plan: rbm06ReferencePlan },
    { name: "swapped-jobs", plan: rbm06AlternatePlan },
  ],
  "RBM-07": [
    { name: "north-first", plan: rbm07ReferencePlan },
    { name: "vault-first", plan: rbm07AlternatePlan },
  ],
  "RBM-08": [
    { name: "canonical", plan: rbm08ReferencePlan },
    { name: "earlier-weight", plan: rbm08AlternatePlan },
  ],
  "RBM-09": [{ name: "reference", plan: rbm09ReferencePlan }],
  "RBM-10": [
    { name: "late-return", plan: rbm10ReferencePlan },
    { name: "early-return", plan: rbm10AlternatePlan },
  ],
  "RBM-11": [
    { name: "crossover-shift", plan: rbm11ReferencePlan },
    { name: "asymmetric-shift", plan: rbm11AlternatePlan },
  ],
  "RBM-12": [
    { name: "wide-window", plan: rbm12ReferencePlan },
    { name: "tight-window", plan: rbm12AlternatePlan },
  ],
};

export const SEED = "rbm-verify-seed";

/** Fast path: simulate a whole plan directly. */
export function replay(level: RbmManifest, plan: RbmPlan, seed = SEED) {
  return simulate(level, plan, seed);
}

/** Full session-engine path: commit rows, queue commands, test.run, accept. */
export function committedRun(eng: RbmEngine, level: RbmManifest, plan: RbmPlan, seed = SEED) {
  let s = eng.createInitialState(level);
  let n = 0;
  const commit = (payload: RbmActionPayload) => {
    const action: RbmAction = {
      actorId: "suite", commandId: `c-${++n}`, baseRevision: s.revision, payload,
    };
    const check = eng.validateAction(level, s, action);
    if (!check.ok) return { state: s, error: check.reason ?? "invalid" };
    s = eng.applyAction(level, s, action).state;
    return { state: s };
  };
  for (const row of plan.rows) {
    const r = commit({ type: "manifest.commit", row });
    if ("error" in r) return { state: r.state, error: r.error };
  }
  for (const [beatStr, perCrew] of Object.entries(plan.commands)) {
    const beat = Number(beatStr);
    for (const [crewId, command] of Object.entries(perCrew)) {
      const r = commit({ type: "command.queue", beat, crewId, command });
      if ("error" in r) return { state: r.state, error: r.error };
    }
  }
  const r = commit({ type: "test.run", seed });
  if ("error" in r) return { state: r.state, error: r.error };
  return { state: r.state };
}

export function outcomeOk(res: ReturnType<typeof simulate>, id: string) {
  return res.evaluation.outcomes.find(o => o.predicateId === id)?.passed;
}
export function observedOk(res: ReturnType<typeof simulate>, id: string) {
  return res.evaluation.observations.find(o => o.predicateId === id)?.passed;
}
export type { RbmPlayState };
