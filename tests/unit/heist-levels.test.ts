/** Level-content tests: every authored level is solvable via SOLUTIONS and the
 *  naive rush fails. */
import { describe, expect, it } from "vitest";
import { createInitialState, resolveTurn, reachableTiles } from "../../src/engine/heist/engine.js";
import { HEIST_LEVELS, SOLUTIONS } from "../../src/content/heist/levels.js";
import type { LevelDef, Plans, Pos } from "../../src/engine/heist/types.js";

function level(id: string): LevelDef {
  return HEIST_LEVELS.find(l => l.id === id)!;
}

function play(l: LevelDef, turns: Plans[]) {
  let s = createInitialState(l);
  let timeline;
  for (const plans of turns) {
    const r = resolveTurn(l, s, plans);
    s = r.state; timeline = r.timeline;
    if (s.outcome) return { s, timeline: timeline! };
  }
  return { s, timeline: timeline! };
}

/** Greedy rush: each turn each crew walks a shortest path toward the prize
 *  (if any and unclaimed) else the nearest exit; naive loan on turn 1 if a
 *  crew member starts adjacent to a token home. */
function naivePlans(l: LevelDef, s: ReturnType<typeof createInitialState>, withLoan: boolean): Plans {
  const exits: Pos[] = [];
  l.tiles.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "E") exits.push({ x, y }); }));
  const claimed = new Set<string>();
  const plans: Plans = {};
  for (const c of s.crew) {
    const targets = l.prize && s.prizeHolder === null ? [l.prize] : exits;
    let best: Pos[] | null = null;
    let bd = Infinity;
    for (const r of reachableTiles(l, s, c, 3)) {
      for (const tg of targets) {
        const on = r.pos.x === tg.x && r.pos.y === tg.y;
        const d = Math.abs(r.pos.x - tg.x) + Math.abs(r.pos.y - tg.y);
        const k = `${tg.x},${tg.y}`;
        if ((on && !claimed.has(k) && r.path.length < bd) || (!best && d < bd)) {
          best = r.path; bd = on ? r.path.length : d;
          if (on) claimed.add(k);
        }
      }
    }
    const plan = { path: best ?? [] } as Plans[string];
    if (withLoan) {
      for (const tok of s.tokens) {
        const def = l.tokens.find(t => t.id === tok.id)!;
        const home = l.objects.find(o => o.id === def.home)!;
        if (tok.at === def.home && tok.dueTurn === null && Math.max(Math.abs(c.x - home.x), Math.abs(c.y - home.y)) <= 1) {
          const tgt = l.objects.find(o => o.id !== def.home)!;
          plan.loan = { tokenId: tok.id, targetId: tgt.id };
        }
      }
    }
    plans[c.id] = plan;
  }
  return plans;
}

function naiveRun(l: LevelDef, withLoan: boolean) {
  let s = createInitialState(l);
  for (let t = 1; t <= l.midnight && !s.outcome; t++) {
    s = resolveTurn(l, s, naivePlans(l, s, withLoan && t === 1)).state;
  }
  return s;
}

for (const id of ["L1", "L2", "L3"]) {
  describe(id, () => {
    it("the scripted solution wins", () => {
      const l = level(id);
      const { s } = play(l, SOLUTIONS[id]!);
      expect(s.outcome).toMatchObject({ result: "won" });
      expect(s.turn).toBeLessThanOrEqual(l.midnight);
    });
  });
}

describe("L1 Closing Time", () => {
  it("the naive rush gets seen", () => {
    const s = naiveRun(level("L1"), false);
    expect(s.outcome).toMatchObject({ result: "failed", reason: "seen" });
  });
  it("stalling after crossing hits midnight (no tokens to leave out)", () => {
    const l = level("L1");
    let s = createInitialState(l);
    // cross on the solution's timing, then park: pip idles at (8,5),
    // marlo sits on the exit (9,5)… but both must be on exits to win.
    for (const p of SOLUTIONS.L1!.slice(0, 4)) s = resolveTurn(l, s, p).state;
    s = resolveTurn(l, s, {
      pip: { path: [{ x: 7, y: 5 }, { x: 8, y: 5 }] },
      marlo: { path: [{ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }] },
    }).state;
    for (let t = 6; t <= l.midnight && !s.outcome; t++) s = resolveTurn(l, s, {}).state;
    expect(s.outcome).toMatchObject({ result: "failed", reason: "midnight", turn: l.midnight });
  });
});

describe("L2 The Vault Door", () => {
  it("the naive loan-and-rush gets seen", () => {
    const s = naiveRun(level("L2"), true);
    expect(s.outcome).toMatchObject({ result: "failed", reason: "seen" });
  });
  it("a loan still out at midnight fails loanNotHome", () => {
    const l = level("L2");
    let s = createInitialState(l);
    // idle until turn 8, then lend → due turn 11 > midnight 10
    for (let t = 1; t <= 7; t++) s = resolveTurn(l, s, {}).state;
    s = resolveTurn(l, s, { pip: { path: [], loan: { tokenId: "weight", targetId: "crate" } }, marlo: { path: [] } }).state;
    for (let t = 9; t <= l.midnight && !s.outcome; t++) s = resolveTurn(l, s, {}).state;
    expect(s.outcome).toMatchObject({ result: "failed", reason: "loanNotHome", tokenIds: ["weight"] });
  });
});

describe("L3 Lullaby Lure", () => {
  it("the naive rush gets seen", () => {
    // walking straight up the watched corridor instead of using the lure
    const l = level("L3");
    const { s } = play(l, [{ pip: { path: [] }, marlo: { path: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }] } }]);
    expect(s.outcome).toMatchObject({ result: "failed", reason: "seen" });
  });
  it("a loan still out at midnight fails loanNotHome", () => {
    const l = level("L3");
    let s = createInitialState(l);
    for (let t = 1; t <= 7; t++) s = resolveTurn(l, s, {}).state;
    // both crew wait in the plinth's shadow; pip is adjacent to the music box
    s = resolveTurn(l, s, { pip: { path: [], loan: { tokenId: "lullaby", targetId: "toy" } }, marlo: { path: [] } }).state;
    for (let t = 9; t <= l.midnight && !s.outcome; t++) s = resolveTurn(l, s, {}).state;
    expect(s.outcome).toMatchObject({ result: "failed", reason: "loanNotHome", tokenIds: ["lullaby"] });
  });
});
