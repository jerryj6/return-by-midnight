/**
 * RBM campaign completeness (gate G3): every registered level replays its
 * authored reference plan to `accepted`, carries a complete LevelCard
 * (winningTraceSummary + ≥2 wrongApproaches each carrying an expectedFailure),
 * and the four-person set (RBM-08/10 + any later coop levels) names ≥4
 * contribution types. Enumerates LEVELS so future RBM-11/12 are covered
 * automatically — they must land with matching exports.
 */
import { describe, it, expect } from "vitest";
import { RbmEngine } from "../../src/engine/rbm/engine.js";
import { LEVELS } from "../../src/content/levels/index.js";
import { LEVEL_CARDS } from "../../src/content/level-cards.js";
import type { LevelCard } from "../../src/content/levels/level-card.js";
import { WINNING_TRACES, committedRun, replay } from "../lib/winning-traces.js";

const eng = new RbmEngine();
const card = (id: string): LevelCard | undefined => LEVEL_CARDS[id];

describe("campaign shape", () => {
  it("registers ≥10 levels in shipped order", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(10);
    LEVELS.forEach((l, i) => {
      expect(l.id).toBe(`RBM-${String(i + 1).padStart(2, "0")}`);
      expect(l.def.levelId.toUpperCase()).toBe(l.id);
    });
  });
});

describe("per-level completeness", () => {
  it.each(LEVELS.map(l => [l.id, l.def] as const))(
    "%s: every registered winning plan runs to a successful evaluation",
    (id, level) => {
      const traces = WINNING_TRACES[id];
      expect(traces, `no winning trace registered for ${id}`).toBeDefined();
      for (const trace of traces!) {
        const res = replay(level, trace.plan());
        expect(res.evaluation.success, `${id}/${trace.name}: eval failed`).toBe(true);
        // and via the full session engine to accepted
        const { state, error } = committedRun(eng, level, trace.plan());
        expect(error, `${id}/${trace.name}: commit rejected (${error})`).toBeUndefined();
        expect(state.lastRun?.success).toBe(true);
        const a = {
          actorId: "suite", commandId: `acc-${id}`, baseRevision: state.revision,
          payload: { type: "result.accept" } as const,
        };
        expect(eng.validateAction(level, state, a).ok).toBe(true);
        const accepted = eng.applyAction(level, state, a).state;
        expect(accepted.accepted).toBe(true);
      }
    });

  it.each(LEVELS.map(l => [l.id, l.def] as const))(
    "%s: LevelCard complete (trace summary + ≥2 designed wrong approaches with expected failures)",
    (id) => {
      const c = card(id);
      expect(c, `no LevelCard for ${id}`).toBeDefined();
      expect(c!.winningTraceSummary.length).toBeGreaterThan(0);
      expect(c!.wrongApproaches.length).toBeGreaterThanOrEqual(2);
      for (const w of c!.wrongApproaches) {
        expect(w.name.length).toBeGreaterThan(0);
        expect(w.summary.length).toBeGreaterThan(0);
        expect(w.expectedFailure.length).toBeGreaterThan(0);
      }
    });
});

describe("GME-005: ≥4 levels with ≥2 strategically distinct solutions", () => {
  it("the multi-solution set covers ≥4 levels, all verified", () => {
    const multi = LEVELS.filter(l => (WINNING_TRACES[l.id]?.length ?? 0) >= 2)
      .map(l => l.id);
    expect(multi).toEqual(
      expect.arrayContaining(["RBM-01", "RBM-05", "RBM-06", "RBM-07", "RBM-08", "RBM-10"]));
    expect(multi.length).toBeGreaterThanOrEqual(4);
    // Both strategies of each must succeed with different event streams.
    for (const id of multi) {
      const level = LEVELS.find(l => l.id === id)!.def;
      const eventLogs = WINNING_TRACES[id]!.map(t => {
        const res = replay(level, t.plan());
        expect(res.evaluation.success, `${id}/${t.name} must solve`).toBe(true);
        return JSON.stringify(res.events.map(e => [e.beat, e.type, e.entityId]));
      });
      expect(new Set(eventLogs).size, `${id} alternates must differ`).toBe(eventLogs.length);
    }
  });
});

describe("GME-007: four-person levels carry real coopNotes", () => {
  it("every level whose card declares coopNote enumerates ≥4 contributions", () => {
    const coop = LEVELS.filter(l => (card(l.id)?.coopNote?.length ?? 0) > 0).map(l => l.id);
    expect(coop).toEqual(expect.arrayContaining(["RBM-08", "RBM-10"]));
    for (const id of coop) {
      const note = card(id)!.coopNote!;
      expect(note.length, `${id} coopNote should list ≥4 contribution types`).toBeGreaterThanOrEqual(4);
      for (const line of note) expect(line.length).toBeGreaterThan(0);
    }
  });
});
