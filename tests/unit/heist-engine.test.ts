/** One focused test per rule in docs/HEIST-RULES.md, on synthetic levels. */
import { describe, expect, it } from "vitest";
import {
  computeIntents, createInitialState, heistHash, lineOfSight, reachableTiles,
  resolveTurn, tileAt, validatePlan, isStaticPassable, isPassable, visibleTiles,
  litTiles, plateIsPressed,
} from "../../src/engine/heist/engine.js";
import type { HeistState, LevelDef, Plans } from "../../src/engine/heist/types.js";

function mkLevel(over: Partial<LevelDef>): LevelDef {
  return {
    id: "T", title: "T", intro: "", midnight: 10,
    tiles: ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#######"],
    crew: [
      { id: "a", name: "A", look: "blue", x: 1, y: 1 },
      { id: "b", name: "B", look: "red", x: 1, y: 4 },
    ],
    guards: [], objects: [], tokens: [], doors: [], tips: [],
    ...over,
  };
}
const at = (s: HeistState, crewId: string) => s.crew.find(c => c.id === crewId)!;
const ev = (tl: { steps: { events: { type: string }[] }[] }, type: string) =>
  tl.steps.flatMap(s => s.events).filter(e => e.type === type);

describe("movement + simultaneity", () => {
  it("moves each crew along its path and increments the turn", () => {
    const l = mkLevel({});
    const s = createInitialState(l);
    const r = resolveTurn(l, s, { a: { path: [{ x: 2, y: 1 }, { x: 3, y: 1 }] }, b: { path: [{ x: 1, y: 3 }] } });
    expect(at(r.state, "a")).toMatchObject({ x: 3, y: 1 });
    expect(at(r.state, "b")).toMatchObject({ x: 1, y: 3 });
    expect(r.state.turn).toBe(2);
  });

  it("missing plan means stay", () => {
    const l = mkLevel({});
    const r = resolveTurn(l, createInitialState(l), {});
    expect(at(r.state, "a")).toMatchObject({ x: 1, y: 1 });
    expect(r.timeline.steps.length).toBe(4);
  });

  it("same-tile conflict: lower crew index goes, other is blocked", () => {
    const l = mkLevel({ crew: [
      { id: "a", name: "A", look: "blue", x: 1, y: 2 },
      { id: "b", name: "B", look: "red", x: 3, y: 2 },
    ] });
    const r = resolveTurn(l, createInitialState(l), {
      a: { path: [{ x: 2, y: 2 }] }, b: { path: [{ x: 2, y: 2 }] },
    });
    expect(at(r.state, "a")).toMatchObject({ x: 2, y: 2 });
    expect(at(r.state, "b")).toMatchObject({ x: 3, y: 2 });
    expect(ev(r.timeline, "crew.blocked").length).toBe(1);
  });

  it("two crew swapping tiles are both blocked", () => {
    const l = mkLevel({ crew: [
      { id: "a", name: "A", look: "blue", x: 1, y: 2 },
      { id: "b", name: "B", look: "red", x: 2, y: 2 },
    ] });
    const r = resolveTurn(l, createInitialState(l), {
      a: { path: [{ x: 2, y: 2 }] }, b: { path: [{ x: 1, y: 2 }] },
    });
    expect(at(r.state, "a")).toMatchObject({ x: 1, y: 2 });
    expect(at(r.state, "b")).toMatchObject({ x: 2, y: 2 });
    expect(ev(r.timeline, "crew.blocked").length).toBe(2);
  });

  it("crew may follow into a tile another crew vacates in the same step", () => {
    const l = mkLevel({ crew: [
      { id: "a", name: "A", look: "blue", x: 1, y: 2 },
      { id: "b", name: "B", look: "red", x: 2, y: 2 },
    ] });
    const r = resolveTurn(l, createInitialState(l), {
      a: { path: [{ x: 2, y: 2 }] }, b: { path: [{ x: 3, y: 2 }] },
    });
    expect(at(r.state, "a")).toMatchObject({ x: 2, y: 2 });
    expect(at(r.state, "b")).toMatchObject({ x: 3, y: 2 });
    expect(ev(r.timeline, "crew.blocked").length).toBe(0);
  });

  it("a blocked crew member drops the rest of its path", () => {
    const l = mkLevel({ crew: [
      { id: "a", name: "A", look: "blue", x: 2, y: 2 },
      { id: "b", name: "B", look: "red", x: 1, y: 2 },
    ] });
    // a wants (3,2) then (4,2); b wants (3,2) then stays… actually b blocks a's second step?
    // Simpler: a's first step is onto the tile b is staying on → a is blocked and drops (4,2).
    const r = resolveTurn(l, createInitialState(l), {
      a: { path: [{ x: 1, y: 2 }, { x: 1, y: 1 }] }, // (1,2) occupied by staying b → blocked
      b: { path: [] },
    });
    expect(at(r.state, "a")).toMatchObject({ x: 2, y: 2 }); // stayed put
    expect(ev(r.timeline, "crew.blocked")[0]).toMatchObject({ crewId: "a" });
  });
});

describe("plan validation", () => {
  const l = mkLevel({ objects: [{ id: "o", kind: "crate", name: "crate", x: 4, y: 1 }] });
  const s = createInitialState(l);
  it("rejects >3 steps, non-adjacent steps, walls, void and objects", () => {
    expect(validatePlan(l, s, "a", { path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }] }).ok).toBe(false); // >3 steps
    expect(validatePlan(l, s, "a", { path: [{ x: 3, y: 1 }] }).ok).toBe(false); // not adjacent
    expect(validatePlan(l, s, "a", { path: [{ x: 1, y: 1 }] }).ok).toBe(false); // same tile isn't a step
    expect(validatePlan(l, s, "a", { path: [{ x: 1, y: 0 }] }).ok).toBe(false); // wall
    expect(validatePlan(l, s, "a", { path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }] }).ok).toBe(false); // object tile
    expect(validatePlan(l, s, "a", { path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }).ok).toBe(true);
  });
  it("rejection reasons are player-facing strings without identifiers", () => {
    const r = validatePlan(l, s, "a", { path: [{ x: 0, y: 1 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/wall/i);
  });
});

describe("line of sight", () => {
  it("blocked by wall interiors, open on edge/corner grazes", () => {
    const lv = mkLevel({ tiles: [
      "#####",
      "#...#",
      "#.#.#",
      "#...#",
      "#####",
    ] }); // wall at (2,2)
    const s = createInitialState(lv);
    expect(lineOfSight(lv, s, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
    expect(lineOfSight(lv, s, { x: 1, y: 2 }, { x: 3, y: 2 })).toBe(false);
    // (1,1)->(3,3) passes right through the wall's interior
    expect(lineOfSight(lv, s, { x: 1, y: 1 }, { x: 3, y: 3 })).toBe(false);
    // corner graze: diagonal between two walls touches only shared corners
    const lg = mkLevel({ tiles: [
      "####",
      "#.##",
      "##.#",
      "####",
    ] }); // walls (2,1) and (1,2); segment (1,1)->(2,2) grazes their corner
    const sg = createInitialState(lg);
    expect(lineOfSight(lg, sg, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(true);
  });
  it("objects block sight", () => {
    const lv = mkLevel({ objects: [{ id: "o", kind: "crate", name: "c", x: 3, y: 2 }] });
    const s = createInitialState(lv);
    expect(lineOfSight(lv, s, { x: 1, y: 2 }, { x: 5, y: 2 })).toBe(false);
  });
});

describe("vision cone + dark + BRIGHT", () => {
  const l = mkLevel({
    guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3 }], startIndex: 0, speed: 1, sight: 2, hearing: 0, facing: "E" }],
  });
  it("cone covers forward wedge, not behind or beyond sight", () => {
    const s = createInitialState(l);
    const vis = visibleTiles(l, s, { x: 3, y: 3, facing: "E" });
    expect(vis).toContainEqual({ x: 4, y: 3 });
    expect(vis).toContainEqual({ x: 4, y: 2 });
    expect(vis).toContainEqual({ x: 5, y: 1 });
    expect(vis).not.toContainEqual({ x: 2, y: 3 });
    expect(vis).not.toContainEqual({ x: 5, y: 5 });
  });
  it("vision is checked at step 0 — a crew in the open fails instantly", () => {
    const s = createInitialState(l);
    s.crew[0]!.x = 4; s.crew[0]!.y = 3; // directly ahead of the guard
    const r = resolveTurn(l, s, {});
    expect(r.timeline.outcome).toMatchObject({ result: "failed", reason: "seen", step: 0 });
    expect(r.timeline.steps.length).toBe(1);
  });
  it("a crew stepping through the cone mid-step is caught at that step", () => {
    const lv = mkLevel({
      guards: l.guards,
      crew: [{ id: "a", name: "A", look: "blue", x: 1, y: 2 }, { id: "b", name: "B", look: "red", x: 1, y: 4 }],
    });
    const s = createInitialState(lv);
    // (4,2) is inside the E-facing cone from (3,3) at d=1 lateral -1
    const r = resolveTurn(lv, s, { a: { path: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }] }, b: { path: [] } });
    expect(r.timeline.outcome).toMatchObject({ result: "failed", reason: "seen" });
  });
  it("unlit dark tiles are invisible; BRIGHT lights them", () => {
    const lv = mkLevel({
      tiles: ["#######", "#.....#", "#..:..#", "#.....#", "#.....#", "#######"],
      guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3 }], startIndex: 0, speed: 1, sight: 4, hearing: 0, facing: "N" }],
    });
    const s = createInitialState(lv);
    // guard at (3,3) facing N: (3,2) dark — not seen while unlit
    s.crew[0]!.x = 3; s.crew[0]!.y = 2;
    const r1 = resolveTurn(lv, s, {});
    expect(r1.state.outcome).toBeNull();
    // now a lamp with BRIGHT at (2,3) lights the dark tile
    const lv2 = mkLevel({
      tiles: lv.tiles,
      guards: lv.guards,
      objects: [{ id: "lamp", kind: "lamp", name: "lamp", x: 1, y: 2 }],
      tokens: [{ id: "glow", prop: "BRIGHT", home: "lamp", duration: 2 }],
      crew: [{ id: "a", name: "A", look: "blue", x: 3, y: 2 }, { id: "b", name: "B", look: "red", x: 1, y: 4 }],
    });
    const s2 = createInitialState(lv2);
    expect(litTiles(lv2, s2)).toContainEqual({ x: 3, y: 2 });
    const r2 = resolveTurn(lv2, s2, {});
    expect(r2.state.outcome).toMatchObject({ result: "failed", reason: "seen" });
  });
});

describe("plates, doors, shutIn", () => {
  const l = mkLevel({
    tiles: ["#######", "#.....#", "#..P..#", "#..D..#", "#.....#", "#######"],
    objects: [{ id: "crate", kind: "crate", name: "crate", x: 3, y: 2 }],
    tokens: [{ id: "w", prop: "HEAVY", home: "crate", duration: 3 }],
    doors: [{ id: "d", x: 3, y: 3, plates: [{ x: 3, y: 2 }] }],
  });
  it("a HEAVY object on a plate opens the door; without it the door is shut", () => {
    const s = createInitialState(l);
    expect(plateIsPressed(l, s, { x: 3, y: 2 })).toBe(true);
    expect(s.doorsOpen.d).toBe(true);
    expect(isPassable(l, s, { x: 3, y: 3 })).toBe(true);
    expect(isStaticPassable(l, { x: 3, y: 3 } as never)).toBe(false);
  });
  it("when the loan ends the door closes; a crew in the doorway is shut in", () => {
    // token's home is a safe off the plate; it is out on the plate crate and due now
    const l2 = mkLevel({
      tiles: l.tiles,
      objects: [{ id: "safe", kind: "safe", name: "safe", x: 1, y: 1 }, { id: "crate", kind: "crate", name: "crate", x: 3, y: 2 }],
      tokens: [{ id: "w", prop: "HEAVY", home: "safe", duration: 3 }],
      doors: l.doors,
      crew: [{ id: "a", name: "A", look: "blue", x: 3, y: 3 }, { id: "b", name: "B", look: "red", x: 1, y: 4 }],
    });
    const s2 = createInitialState(l2);
    s2.tokens[0]!.at = "crate";
    s2.tokens[0]!.dueTurn = 1; // returns at start of this turn → door closes on 'a'
    s2.doorsOpen.d = true;     // it was open while the crate held HEAVY
    const r = resolveTurn(l2, s2, {});
    expect(ev(r.timeline, "loan.returned").length).toBe(1);
    expect(r.timeline.outcome).toMatchObject({ result: "failed", reason: "shutIn", crewId: "a" });
    expect(ev(r.timeline, "crew.shutIn").length).toBe(1);
  });
  it("a guard standing in a doorway keeps it open", () => {
    const l3 = mkLevel({
      tiles: l.tiles,
      objects: l.objects,
      tokens: l.tokens,
      doors: l.doors,
      guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3 }], startIndex: 0, speed: 1, sight: 1, hearing: 0, facing: "N" }],
      crew: [{ id: "a", name: "A", look: "blue", x: 5, y: 4 }, { id: "b", name: "B", look: "red", x: 1, y: 4 }],
    });
    const s = createInitialState(l3);
    s.tokens[0]!.at = "crate2"; // token out (no such object needed for the door calc)
    s.doorsOpen.d = true;      // was open last turn
    const r = resolveTurn(l3, s, {});
    // plate unpressed, but the guard stands on the door tile → stays open, no close event
    expect(r.state.doorsOpen.d).toBe(true);
    expect(ev(r.timeline, "door.closed").length).toBe(0);
  });
});

describe("loans", () => {
  const l = mkLevel({
    objects: [{ id: "safe", kind: "safe", name: "safe", x: 2, y: 1 }, { id: "crate", kind: "crate", name: "crate", x: 4, y: 4 }],
    tokens: [{ id: "w", prop: "HEAVY", home: "safe", duration: 3 }],
    crew: [{ id: "a", name: "A", look: "blue", x: 1, y: 1 }, { id: "b", name: "B", look: "red", x: 1, y: 2 }],
  });
  it("a loan moves the token for exactly `duration` turns, then it snaps home", () => {
    let s = createInitialState(l);
    const loan = { tokenId: "w", targetId: "crate" };
    const r1 = resolveTurn(l, s, { a: { path: [], loan }, b: { path: [] } });
    s = r1.state;
    expect(s.tokens[0]).toMatchObject({ at: "crate", dueTurn: 4 });
    s = resolveTurn(l, s, {}).state; // t2
    expect(s.tokens[0]!.at).toBe("crate");
    const r3 = resolveTurn(l, s, {}); // t3
    expect(r3.state.tokens[0]!.at).toBe("crate");
    const r4 = resolveTurn(l, r3.state, {}); // t4: returns
    expect(r4.state.tokens[0]).toMatchObject({ at: "safe", dueTurn: null });
    expect(ev(r4.timeline, "loan.returned")[0]).toMatchObject({ tokenId: "w", from: "crate", to: "safe" });
  });
  it("two crew lending the same token: lower index wins, the other fizzles", () => {
    const s = createInitialState(l);
    // both adjacent to safe: a(1,1) cheb1, b(1,2) cheb1
    const r = resolveTurn(l, s, {
      a: { path: [], loan: { tokenId: "w", targetId: "crate" } },
      b: { path: [], loan: { tokenId: "w", targetId: "crate" } },
    });
    expect(ev(r.timeline, "loan.made")[0]).toMatchObject({ crewId: "a" });
    expect(ev(r.timeline, "loan.fizzled")[0]).toMatchObject({ crewId: "b", why: "notHome" });
  });
  it("a loan fizzles when the crew member is not adjacent to the home", () => {
    const s = createInitialState(l);
    s.crew[0]!.x = 5; s.crew[0]!.y = 4;
    const r = resolveTurn(l, s, { a: { path: [], loan: { tokenId: "w", targetId: "crate" } }, b: { path: [] } });
    expect(ev(r.timeline, "loan.fizzled")[0]).toMatchObject({ crewId: "a", why: "notAdjacent" });
  });
  it("returns happen before new loans, so a due token can be re-lent that turn", () => {
    const s = createInitialState(l);
    s.tokens[0]!.at = "crate"; s.tokens[0]!.dueTurn = 1;
    const r = resolveTurn(l, s, { a: { path: [], loan: { tokenId: "w", targetId: "crate" } }, b: { path: [] } });
    expect(ev(r.timeline, "loan.returned").length).toBe(1);
    expect(ev(r.timeline, "loan.made").length).toBe(1);
  });
});

describe("guard intents", () => {
  const l = mkLevel({
    guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3, face: "W" }, { x: 4, y: 3 }], startIndex: 0, speed: 1, sight: 3, hearing: 3, facing: "W" }],
    objects: [{ id: "mb", kind: "musicBox", name: "mb", x: 5, y: 1 }, { id: "toy", kind: "toy", name: "toy", x: 5, y: 4 }],
    tokens: [{ id: "n", prop: "NOISY", home: "mb", duration: 2 }],
    crew: [{ id: "a", name: "A", look: "blue", x: 5, y: 1 }, { id: "b", name: "B", look: "red", x: 4, y: 4 }], // hmm a on object tile - move
  });
  it("a heard NOISY object makes the guard investigate toward it, facing it at step 0", () => {
    const lv = mkLevel({
      guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3, face: "W" }, { x: 4, y: 3 }], startIndex: 0, speed: 1, sight: 1, hearing: 4, facing: "W" }],
      objects: [{ id: "mb", kind: "musicBox", name: "mb", x: 2, y: 2 }, { id: "toy", kind: "toy", name: "toy", x: 5, y: 3 }],
      tokens: [{ id: "n", prop: "NOISY", home: "mb", duration: 2 }],
      crew: [{ id: "a", name: "A", look: "blue", x: 2, y: 1 }, { id: "b", name: "B", look: "red", x: 1, y: 4 }],
    });
    const s = createInitialState(lv);
    const r = resolveTurn(lv, s, { a: { path: [], loan: { tokenId: "n", targetId: "toy" } }, b: { path: [] } });
    const intent = r.timeline.intents[0]!;
    expect(intent.mode).toBe("investigate");
    expect(intent.noiseTarget).toBe("toy");
    expect(ev(r.timeline, "guard.heard").length).toBe(1);
    expect(intent.poses[0]!.facing).toBe("E"); // step 0 already faces the source
    expect(intent.poses[1]).toMatchObject({ x: 4, y: 3 }); // walked toward the toy
    const r2 = resolveTurn(lv, r.state, {});
    expect(r2.timeline.intents[0]!.mode).toBe("investigate"); // noise still out
    // turn 3: token snaps home — the music box itself is now the nearest source
    const r3 = resolveTurn(lv, r2.state, {});
    expect(r3.timeline.intents[0]!.mode).toBe("investigate");
    expect(r3.timeline.intents[0]!.noiseTarget).toBe("mb");
    expect(r3.timeline.intents[0]!.poses[1]).toMatchObject({ x: 4, y: 2 }); // heads back toward it
  });
  it("a guard back on its route tile resumes patrol", () => {
    const lv = mkLevel({
      guards: [{ id: "g", name: "G", route: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }], startIndex: 0, speed: 1, sight: 1, hearing: 0, facing: "E" }],
    });
    const s = createInitialState(lv);
    s.guards[0]!.x = 1; s.guards[0]!.y = 2; s.guards[0]!.mode = "return"; // off route tile (2,2)
    const r = resolveTurn(lv, s, {});
    expect(r.timeline.intents[0]!.mode).toBe("return");
    // reached (2,2) → mode patrol next turn
    const r2 = resolveTurn(lv, r.state, {});
    expect(r2.timeline.intents[0]!.mode).toBe("patrol");
    expect(r2.timeline.intents[0]!.poses[1]).toMatchObject({ x: 3, y: 2, facing: "E" });
  });
  it("computeIntents matches the intents resolveTurn uses (loans applied, no mutation)", () => {
    const s = createInitialState(l);
    const plans: Plans = { a: { path: [], loan: { tokenId: "n", targetId: "toy" } }, b: { path: [] } };
    const before = structuredClone(s);
    const intents = computeIntents(l, s, plans);
    const r = resolveTurn(l, s, plans);
    expect(intents).toEqual(r.timeline.intents);
    expect(s).toEqual(before);
  });
});

describe("win / fail edges", () => {
  it("wins only when every crew is on an exit, prize carried, tokens home", () => {
    const l = mkLevel({
      tiles: ["#####", "#...#", "#..E#", "#.EE#", "#####"],
      crew: [{ id: "a", name: "A", look: "blue", x: 1, y: 2 }, { id: "b", name: "B", look: "red", x: 1, y: 3 }],
      prize: { id: "p", name: "prize", x: 2, y: 1 },
    });
    let s = createInitialState(l);
    // grab prize + reach exits
    const r1 = resolveTurn(l, s, { a: { path: [{ x: 2, y: 1 }] }, b: { path: [{ x: 1, y: 3 }] } });
    s = r1.state;
    expect(s.prizeHolder).toBe("a");
    const r2 = resolveTurn(l, s, { a: { path: [{ x: 3, y: 1 }, { x: 3, y: 2 }] }, b: { path: [{ x: 2, y: 3 }] } });
    expect(r2.state.outcome).toMatchObject({ result: "won", turn: 2 });
  });
  it("prize pickup fires prize.taken on stepping onto it", () => {
    const l = mkLevel({ prize: { id: "p", name: "prize", x: 2, y: 1 } });
    const r = resolveTurn(l, createInitialState(l), { a: { path: [{ x: 2, y: 1 }] }, b: { path: [] } });
    expect(ev(r.timeline, "prize.taken")[0]).toMatchObject({ crewId: "a", prizeId: "p" });
  });
  it("midnight fails the heist; a token still out gives loanNotHome", () => {
    const l = mkLevel({ midnight: 2 });
    let s = createInitialState(l);
    s = resolveTurn(l, s, {}).state;
    const r = resolveTurn(l, s, {});
    expect(r.state.outcome).toMatchObject({ result: "failed", reason: "midnight", turn: 2 });
    // with a token out at midnight → loanNotHome with tokenIds
    const l2 = mkLevel({
      midnight: 2,
      objects: [{ id: "safe", kind: "safe", name: "s", x: 2, y: 1 }, { id: "crate", kind: "crate", name: "c", x: 4, y: 4 }],
      tokens: [{ id: "w", prop: "HEAVY", home: "safe", duration: 3 }],
    });
    let s2 = createInitialState(l2);
    s2 = resolveTurn(l2, s2, { a: { path: [], loan: { tokenId: "w", targetId: "crate" } }, b: { path: [] } }).state;
    const r2 = resolveTurn(l2, s2, {});
    expect(r2.state.outcome).toMatchObject({ result: "failed", reason: "loanNotHome", tokenIds: ["w"] });
  });
  it("a crew stepping onto a guard's tile, or a guard onto theirs, is seen (bumped)", () => {
    const l = mkLevel({
      guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3 }], startIndex: 0, speed: 1, sight: 0, hearing: 0, facing: "N" }],
    });
    const s = createInitialState(l);
    const r = resolveTurn(l, s, { a: { path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }] }, b: { path: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 3 }] } });
    // b steps onto the guard's tile at step 3 → seen
    expect(r.state.outcome).toMatchObject({ result: "failed", reason: "seen", guardId: "g" });
  });
});

describe("determinism + purity + helpers", () => {
  const l = mkLevel({ guards: [{ id: "g", name: "G", route: [{ x: 3, y: 3 }, { x: 4, y: 3 }], startIndex: 0, speed: 1, sight: 2, hearing: 0, facing: "E" }] });
  it("same inputs → same hash and identical timeline", () => {
    const s = createInitialState(l);
    const p: Plans = { a: { path: [{ x: 2, y: 1 }] }, b: { path: [{ x: 1, y: 3 }] } };
    const r1 = resolveTurn(l, s, p);
    const r2 = resolveTurn(l, structuredClone(s), structuredClone(p));
    expect(heistHash(r1.state)).toBe(heistHash(r2.state));
    expect(r1.timeline).toEqual(r2.timeline);
  });
  it("resolveTurn never mutates its input state or plans", () => {
    const s = createInitialState(l);
    const before = structuredClone(s);
    const p: Plans = { a: { path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }, b: { path: [] } };
    const pb = structuredClone(p);
    resolveTurn(l, s, p);
    expect(s).toEqual(before);
    expect(p).toEqual(pb);
  });
  it("geometry helpers: tileAt bounds, reachableTiles BFS respects walls/objects", () => {
    const lv = mkLevel({ objects: [{ id: "o", kind: "crate", name: "c", x: 2, y: 1 }] });
    const s = createInitialState(lv);
    expect(tileAt(lv, { x: -1, y: 0 })).toBe(" ");
    expect(tileAt(lv, { x: 1, y: 1 })).toBe(".");
    const reach = reachableTiles(lv, s, { x: 1, y: 1 }, 1);
    expect(reach.map(r => r.pos)).toContainEqual({ x: 1, y: 2 });
    expect(reach.map(r => r.pos)).not.toContainEqual({ x: 2, y: 1 }); // object blocks
    const r2 = reachableTiles(lv, s, { x: 1, y: 1 }, 4).find(r => r.pos.x === 3 && r.pos.y === 1)!;
    expect(r2.path).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }]);
  });
});
