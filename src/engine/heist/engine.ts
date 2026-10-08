/** Return by Midnight — heist engine. Pure, deterministic; see docs/HEIST-RULES.md. */
import { sha256Hex } from "../hash.js";
import type {
  CrewPlan,
  Dir,
  GuardIntent,
  GuardPose,
  GuardState,
  HeistState,
  LevelDef,
  LevelGuard,
  PlanCheck,
  Plans,
  Pos,
  Prop,
  TurnEvent,
  TurnStep,
  TurnTimeline,
} from "./types.js";

const DIRS: Record<Dir, Pos> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
const DIR_ORDER: Dir[] = ["N", "E", "S", "W"];

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const manh = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

/* ---------------- geometry ---------------- */

export function tileAt(level: LevelDef, p: Pos): string {
  if (p.y < 0 || p.y >= level.tiles.length) return " ";
  const row = level.tiles[p.y]!;
  if (p.x < 0 || p.x >= row.length) return " ";
  return row[p.x]!;
}

function objectAt(level: LevelDef, p: Pos) {
  return level.objects.find(o => o.x === p.x && o.y === p.y);
}

function doorAt(level: LevelDef, p: Pos) {
  return level.doors.find(d => d.x === p.x && d.y === p.y);
}

/** Passable regardless of door state: floor/dark/exit/plate with no object on it.
 *  Door tiles are NOT static-passable — callers who allow doors check separately. */
export function isStaticPassable(level: LevelDef, p: Pos): boolean {
  const t = tileAt(level, p);
  if (t !== "." && t !== ":" && t !== "E" && t !== "P") return false;
  return !objectAt(level, p);
}

/** Passable right now: static-passable, or an open door tile. */
export function isPassable(level: LevelDef, state: HeistState, p: Pos): boolean {
  if (isStaticPassable(level, p)) return true;
  const d = doorAt(level, p);
  return d !== undefined && state.doorsOpen[d.id] === true;
}

function isSightBlocker(level: LevelDef, state: HeistState, p: Pos): boolean {
  const t = tileAt(level, p);
  if (t === "#" || t === " ") return true;
  if (objectAt(level, p)) return true;
  const d = doorAt(level, p);
  if (d && !state.doorsOpen[d.id]) return true;
  return false;
}

/** Does segment a→b cross the open square of tile (tx,ty)?
 *  Exact integer arithmetic: tile centres at (2x+1, 2y+1), tile square the open
 *  region (2x, 2x+2) × (2y, 2y+2). Grazing an edge or corner does not count. */
function segHitsSquareInterior(ax: number, ay: number, bx: number, by: number, tx: number, ty: number): boolean {
  const axes: [number, number, number, number][] = [
    [2 * ax + 1, 2 * (bx - ax), 2 * tx, 2 * tx + 2],
    [2 * ay + 1, 2 * (by - ay), 2 * ty, 2 * ty + 2],
  ];
  // t-interval of "inside the open slab", as rationals loN/loD .. hiN/hiD.
  let loN = 0, loD = 1, hiN = 1, hiD = 1;
  for (const [p0, dp, s0, s1] of axes) {
    if (dp === 0) {
      if (p0 <= s0 || p0 >= s1) return false;
      continue;
    }
    let eN = s0 - p0, xN = s1 - p0, d = dp;
    if (d < 0) { eN = -eN; xN = -xN; d = -d; }
    const en = Math.min(eN, xN), xn = Math.max(eN, xN);
    if (en * loD > loN * d) { loN = en; loD = d; }
    if (xn * hiD < hiN * d) { hiN = xn; hiD = d; }
  }
  return loN * hiD < hiN * loD;
}

/** LOS: the segment between tile centres must not cross the interior of any
 *  blocker tile (the endpoints' own tiles excluded). Edges/corners don't block. */
export function lineOfSight(level: LevelDef, state: HeistState, a: Pos, b: Pos): boolean {
  if (same(a, b)) return true;
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      if ((x === a.x && y === a.y) || (x === b.x && y === b.y)) continue;
      if (!isSightBlocker(level, state, { x, y })) continue;
      if (segHitsSquareInterior(a.x, a.y, b.x, b.y, x, y)) return false;
    }
  }
  return true;
}

/* ---------------- light / properties ---------------- */

export function objectProps(state: HeistState, objectId: string): Prop[] {
  return state.tokens.filter(t => t.at === objectId).map(t => t.prop);
}

/** A plate is pressed iff an object holding HEAVY stands on it. */
export function plateIsPressed(level: LevelDef, state: HeistState, p: Pos): boolean {
  const o = objectAt(level, p);
  return o !== undefined && objectProps(state, o.id).includes("HEAVY");
}

function doorIsOpen(level: LevelDef, state: HeistState, doorId: string): boolean {
  const d = level.doors.find(dd => dd.id === doorId);
  return d !== undefined && d.plates.some(p => plateIsPressed(level, state, p));
}

function isLit(level: LevelDef, state: HeistState, p: Pos): boolean {
  if (tileAt(level, p) !== ":") return true;
  for (const o of level.objects) {
    if (!objectProps(state, o.id).includes("BRIGHT")) continue;
    if (cheb(o, p) <= 2 && lineOfSight(level, state, o, p)) return true;
  }
  return false;
}

/** Every drawable tile that counts as lit: all non-dark tiles plus dark tiles
 *  within Chebyshev 2 (with LOS) of an object holding BRIGHT. */
export function litTiles(level: LevelDef, state: HeistState): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < level.tiles.length; y++) {
    for (let x = 0; x < level.tiles[y]!.length; x++) {
      const p = { x, y };
      const t = tileAt(level, p);
      if (t === " " || t === "#") continue;
      if (isLit(level, state, p)) out.push(p);
    }
  }
  return out;
}

/* ---------------- vision ---------------- */

/** Tiles the pose sees: forward distance 1..sight, |lateral| ≤ forward, LOS,
 *  and not an unlit dark tile. `pose` is matched to a level guard by position
 *  for its sight stat; an unmatched pose sees nothing. */
export function visibleTiles(level: LevelDef, state: HeistState, pose: GuardPose): Pos[] {
  const gi = state.guards.findIndex(sg => sg.x === pose.x && sg.y === pose.y);
  if (gi < 0) return [];
  return coneTiles(level, state, pose, level.guards[gi]!.sight);
}

function coneTiles(level: LevelDef, state: HeistState, gp: GuardPose, sight: number): Pos[] {
  const out: Pos[] = [];
  const f = DIRS[gp.facing];
  const side = gp.facing === "N" || gp.facing === "S" ? { x: 1, y: 0 } : { x: 0, y: 1 };
  for (let d = 1; d <= sight; d++) {
    for (let l = -d; l <= d; l++) {
      const p = { x: gp.x + f.x * d + side.x * l, y: gp.y + f.y * d + side.y * l };
      const t = tileAt(level, p);
      if (t === " " || t === "#") continue;
      if (!isLit(level, state, p)) continue;
      if (lineOfSight(level, state, gp, p)) out.push(p);
    }
  }
  return out;
}

/* ---------------- BFS ---------------- */

/** All tiles reachable in ≤ maxSteps steps (static-passable plus currently-open
 *  doors), each with a shortest path; neighbour order N,E,S,W.
 *  The start tile is not included. */
export function reachableTiles(level: LevelDef, state: HeistState, from: Pos, maxSteps: number): { pos: Pos; path: Pos[] }[] {
  const seen = new Map<string, Pos[]>();
  const q: Pos[] = [from];
  seen.set(`${from.x},${from.y}`, []);
  const out: { pos: Pos; path: Pos[] }[] = [];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]!;
    const path = seen.get(`${cur.x},${cur.y}`)!;
    if (path.length >= maxSteps) continue;
    for (const d of DIR_ORDER) {
      const np = { x: cur.x + DIRS[d].x, y: cur.y + DIRS[d].y };
      const k = `${np.x},${np.y}`;
      if (seen.has(k) || !isPassable(level, state, np)) continue;
      const npath = [...path, np];
      seen.set(k, npath);
      q.push(np);
      out.push({ pos: np, path: npath });
    }
  }
  return out;
}

/** BFS shortest path from→to over currently-passable tiles, or null. */
function bfsPath(level: LevelDef, state: HeistState, from: Pos, to: Pos): Pos[] | null {
  if (same(from, to)) return [];
  if (!isPassable(level, state, to)) return null;
  const prev = new Map<string, Pos>();
  prev.set(`${from.x},${from.y}`, from);
  const q: Pos[] = [from];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]!;
    for (const d of DIR_ORDER) {
      const np = { x: cur.x + DIRS[d].x, y: cur.y + DIRS[d].y };
      const k = `${np.x},${np.y}`;
      if (prev.has(k) || !isPassable(level, state, np)) continue;
      prev.set(k, cur);
      if (same(np, to)) {
        const path: Pos[] = [np];
        let c = cur;
        while (!same(c, from)) { path.unshift(c); c = prev.get(`${c.x},${c.y}`)!; }
        return path;
      }
      q.push(np);
    }
  }
  return null;
}

function facingToward(from: Pos, to: Pos, fallback: Dir): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
}

function dirBetween(a: Pos, b: Pos): Dir {
  if (b.x > a.x) return "E";
  if (b.x < a.x) return "W";
  if (b.y > a.y) return "S";
  return "N";
}

/* ---------------- state setup ---------------- */

export function createInitialState(level: LevelDef): HeistState {
  const s: HeistState = {
    levelId: level.id,
    turn: 1,
    crew: level.crew.map(c => ({ id: c.id, x: c.x, y: c.y })),
    guards: level.guards.map(g => ({
      id: g.id, x: g.route[g.startIndex]!.x, y: g.route[g.startIndex]!.y,
      facing: g.facing, routeIndex: g.startIndex, mode: "patrol", noiseTarget: null,
    })),
    tokens: level.tokens.map(t => ({ id: t.id, prop: t.prop, at: t.home, dueTurn: null })),
    doorsOpen: {},
    prizeHolder: null,
    outcome: null,
  };
  for (const d of level.doors) s.doorsOpen[d.id] = doorIsOpen(level, s, d.id);
  return s;
}

/* ---------------- validation ---------------- */

export function validatePlan(level: LevelDef, state: HeistState, crewId: string, plan: CrewPlan): PlanCheck {
  const crew = state.crew.find(c => c.id === crewId);
  if (!crew) return { ok: false, reason: "Not your crew member" };
  if (state.outcome) return { ok: false, reason: "The heist is already over" };
  if (plan.path.length > 3) return { ok: false, reason: "Too many steps for one turn" };
  let cur: Pos = crew;
  for (const step of plan.path) {
    if (Math.abs(step.x - cur.x) + Math.abs(step.y - cur.y) !== 1) {
      return { ok: false, reason: "Steps must move to a neighbouring tile" };
    }
    const t = tileAt(level, step);
    if (t === "#" || t === " ") return { ok: false, reason: "A wall blocks the way" };
    if (objectAt(level, step)) return { ok: false, reason: "Something's in the way" };
    // door tiles are allowed regardless of current open state
    cur = step;
  }
  if (plan.loan) {
    const tok = level.tokens.find(tk => tk.id === plan.loan!.tokenId);
    if (!tok) return { ok: false, reason: "Can't borrow that" };
    const ts = state.tokens.find(tk => tk.id === tok.id);
    const home = level.objects.find(o => o.id === tok.home);
    // a token due back at the start of this turn counts as home
    const effectivelyHome = ts !== undefined && ts.at === tok.home && (ts.dueTurn === null || ts.dueTurn === state.turn);
    if (!effectivelyHome) return { ok: false, reason: "Already borrowed" };
    if (!home || cheb(crew, home) > 1) return { ok: false, reason: "Too far to reach it" };
    const target = level.objects.find(o => o.id === plan.loan!.targetId);
    if (!target || target.id === tok.home) return { ok: false, reason: "Can't lend it there" };
  }
  return { ok: true };
}

/* ---------------- turn phases ---------------- */

interface Work {
  s: HeistState;
  /** remaining paths per crew index (truncated when blocked) */
  paths: Pos[][];
}

function applyReturns(level: LevelDef, s: HeistState): TurnEvent[] {
  const ev: TurnEvent[] = [];
  for (const t of s.tokens) {
    const def = level.tokens.find(td => td.id === t.id)!;
    if (t.dueTurn === s.turn) {
      const from = t.at;
      t.at = def.home;
      t.dueTurn = null;
      ev.push({ type: "loan.returned", tokenId: t.id, from, to: def.home });
    }
  }
  return ev;
}

function applyLoans(level: LevelDef, s: HeistState, plans: Plans): TurnEvent[] {
  const ev: TurnEvent[] = [];
  for (const c of s.crew) {
    const loan = plans[c.id]?.loan;
    if (!loan) continue;
    const tok = s.tokens.find(tk => tk.id === loan.tokenId);
    const def = tok ? level.tokens.find(tk => tk.id === tok.id)! : undefined;
    const home = def ? level.objects.find(o => o.id === def.home) : undefined;
    const target = level.objects.find(o => o.id === loan.targetId);
    const fizzle = (why: "notHome" | "notAdjacent" | "badTarget") =>
      ev.push({ type: "loan.fizzled", tokenId: loan.tokenId, crewId: c.id, why });
    if (!tok || !def || tok.at !== def.home) { fizzle("notHome"); continue; }
    if (!home || cheb(c, home) > 1) { fizzle("notAdjacent"); continue; }
    if (!target || target.id === def.home) { fizzle("badTarget"); continue; }
    tok.at = target.id;
    tok.dueTurn = s.turn + def.duration;
    ev.push({ type: "loan.made", tokenId: tok.id, crewId: c.id, from: def.home, to: target.id, dueTurn: tok.dueTurn });
  }
  return ev;
}

/** Recompute every door; returns change events plus shutIn failures. */
function applyDoors(level: LevelDef, s: HeistState): { events: TurnEvent[]; shutIn: TurnEvent[] } {
  const events: TurnEvent[] = [];
  const shutIn: TurnEvent[] = [];
  for (const d of level.doors) {
    let open = d.plates.some(p => plateIsPressed(level, s, p));
    if (!open && s.guards.some(g => g.x === d.x && g.y === d.y)) open = true; // a door can't close on a guard
    const was = s.doorsOpen[d.id] === true;
    s.doorsOpen[d.id] = open;
    if (open && !was) events.push({ type: "door.opened", doorId: d.id });
    if (!open && was) events.push({ type: "door.closed", doorId: d.id });
    if (!open) {
      for (const c of s.crew) {
        if (c.x === d.x && c.y === d.y) shutIn.push({ type: "crew.shutIn", crewId: c.id, doorId: d.id });
      }
    }
  }
  return { events, shutIn };
}

interface IntentResult {
  intent: GuardIntent;
  end: { routeIndex: number; mode: GuardState["mode"]; noiseTarget: string | null };
  heard: TurnEvent | null;
}

function guardIntent(level: LevelDef, s: HeistState, g: GuardState, def: LevelGuard): IntentResult {
  // noise: nearest object holding NOISY within Manhattan hearing (tie: object order)
  let src: { id: string; x: number; y: number } | null = null;
  let srcDist = Infinity;
  for (const o of level.objects) {
    if (!objectProps(s, o.id).includes("NOISY")) continue;
    const d = manh(g, o);
    if (d <= def.hearing && d < srcDist) { src = o; srcDist = d; }
  }

  let x = g.x, y = g.y, facing = g.facing, routeIndex = g.routeIndex;
  let mode: GuardState["mode"] = g.mode;
  const poses: GuardPose[] = [{ x, y, facing }];

  if (src) {
    mode = "investigate";
    poses[0] = { x, y, facing: facingToward({ x, y }, src, facing) };
    // nearest passable tile orthogonally adjacent to the source (N,E,S,W tie order)
    let best: Pos[] | null = null;
    for (const d of DIR_ORDER) {
      const adj = { x: src.x + DIRS[d].x, y: src.y + DIRS[d].y };
      if (!isPassable(level, s, adj)) continue;
      const p = bfsPath(level, s, { x, y }, adj);
      if (p && (best === null || p.length < best.length)) best = p;
    }
    const path = best ?? [];
    for (let k = 1; k <= 3; k++) {
      if (k <= def.speed && k <= path.length) {
        const np = path[k - 1]!;
        facing = dirBetween({ x, y }, np);
        x = np.x; y = np.y;
      } else {
        facing = facingToward({ x, y }, src, facing);
      }
      poses.push({ x, y, facing });
    }
    return {
      intent: { guardId: g.id, mode, poses, noiseTarget: src.id },
      end: { routeIndex, mode, noiseTarget: src.id },
      heard: { type: "guard.heard", guardId: g.id, objectId: src.id },
    };
  }

  const routeTile = def.route[routeIndex]!;
  if ((g.mode === "investigate" || g.mode === "return") && !(x === routeTile.x && y === routeTile.y)) {
    mode = "return";
    const path = bfsPath(level, s, { x, y }, routeTile) ?? [];
    let reached = x === routeTile.x && y === routeTile.y;
    for (let k = 1; k <= 3; k++) {
      if (!reached && k <= def.speed && k <= path.length) {
        const np = path[k - 1]!;
        facing = dirBetween({ x, y }, np);
        x = np.x; y = np.y;
        if (x === routeTile.x && y === routeTile.y) { reached = true; mode = "patrol"; }
      }
      poses.push({ x, y, facing });
    }
    return {
      intent: { guardId: g.id, mode: "return", poses, noiseTarget: null },
      end: { routeIndex, mode, noiseTarget: null },
      heard: null,
    };
  }

  mode = "patrol";
  for (let k = 1; k <= def.speed; k++) {
    routeIndex = (routeIndex + 1) % def.route.length;
    const step = def.route[routeIndex]!;
    if (step.x === x && step.y === y) {
      if (step.face) facing = step.face;
    } else {
      facing = dirBetween({ x, y }, step);
      x = step.x; y = step.y;
    }
    poses.push({ x, y, facing });
  }
  while (poses.length < 4) poses.push({ x, y, facing });
  return {
    intent: { guardId: g.id, mode, poses, noiseTarget: null },
    end: { routeIndex, mode, noiseTarget: null },
    heard: null,
  };
}

function intentsFor(level: LevelDef, s: HeistState): IntentResult[] {
  return s.guards.map((g, i) => guardIntent(level, s, g, level.guards[i]!));
}

/** The intents resolveTurn would use this turn: after scheduled returns and the
 *  loans in `plans`, with doors recomputed. Missing plans = stay. */
export function computeIntents(level: LevelDef, state: HeistState, plans: Plans): GuardIntent[] {
  const s = structuredClone(state);
  applyReturns(level, s);
  applyLoans(level, s, plans);
  applyDoors(level, s);
  return intentsFor(level, s).map(r => r.intent);
}

/* ---------------- resolution ---------------- */

export function resolveTurn(level: LevelDef, state: HeistState, plans: Plans): { state: HeistState; timeline: TurnTimeline } {
  const s = structuredClone(state);
  const t = s.turn;
  const steps: TurnStep[] = [];
  const w: Work = { s, paths: s.crew.map(c => [...(plans[c.id]?.path ?? [])]) };

  if (s.outcome) {
    return { state: s, timeline: { turn: t, intents: [], steps: [], outcome: s.outcome } };
  }

  // steps 1–3: returns → loans → doors
  const ev0: TurnEvent[] = [
    ...applyReturns(level, s),
    ...applyLoans(level, s, plans),
  ];
  const doors = applyDoors(level, s);
  ev0.push(...doors.events, ...doors.shutIn);
  if (doors.shutIn.length) {
    const f = doors.shutIn[0] as Extract<TurnEvent, { type: "crew.shutIn" }>;
    const step: TurnStep = { k: 0, crew: s.crew.map(c => ({ ...c })), guards: s.guards.map(g => ({ x: g.x, y: g.y, facing: g.facing })), events: ev0 };
    const outcome = { result: "failed", reason: "shutIn", turn: t, step: 0, crewId: f.crewId } as const;
    s.outcome = outcome;
    return { state: s, timeline: { turn: t, intents: [], steps: [step], outcome } };
  }

  // step 4: intents, step-0 snapshot, vision check
  const ends = intentsFor(level, s);
  const intents = ends.map(r => r.intent);
  for (const r of ends) if (r.heard) ev0.push(r.heard);
  const posesAt = (k: number): GuardPose[] => ends.map(r => r.intent.poses[k]!);

  const visionCheck = (k: number): { crewId: string; guardId: string } | null => {
    for (let gi = 0; gi < s.guards.length; gi++) {
      const gp = intents[gi]!.poses[k]!;
      const cone = coneTiles(level, s, gp, level.guards[gi]!.sight);
      for (const c of s.crew) {
        if (c.x === gp.x && c.y === gp.y) return { crewId: c.id, guardId: s.guards[gi]!.id };
        if (cone.some(p => p.x === c.x && p.y === c.y)) return { crewId: c.id, guardId: s.guards[gi]!.id };
      }
    }
    return null;
  };

  steps.push({ k: 0, crew: s.crew.map(c => ({ ...c })), guards: posesAt(0), events: ev0 });
  let seen = visionCheck(0);
  if (seen) {
    ev0.push({ type: "crew.seen", crewId: seen.crewId, guardId: seen.guardId });
    const outcome = { result: "failed", reason: "seen", turn: t, step: 0, crewId: seen.crewId, guardId: seen.guardId } as const;
    s.outcome = outcome;
    return { state: s, timeline: { turn: t, intents, steps, outcome } };
  }

  // step 5: movement steps 1..3
  for (let k = 1; k <= 3; k++) {
    const ev: TurnEvent[] = [];
    const newPoses = posesAt(k);

    // a guard moving onto a crew member's tile (or onto one who then swaps away) sees them
    for (let gi = 0; gi < s.guards.length && !seen; gi++) {
      for (const c of s.crew) {
        if (c.x === newPoses[gi]!.x && c.y === newPoses[gi]!.y) {
          seen = { crewId: c.id, guardId: s.guards[gi]!.id };
          break;
        }
      }
    }

    // crew conflict resolution to a fixpoint
    const n = s.crew.length;
    const targets: (Pos | null)[] = s.crew.map((_, i) => w.paths[i]!.length > 0 ? w.paths[i]![0]! : null);
    const blocked = new Array<boolean>(n).fill(false);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; i++) {
        const T = targets[i];
        if (blocked[i] || !T) continue;
        let bad = !isPassable(level, s, T);
        for (let j = 0; j < n && !bad; j++) {
          if (j === i) continue;
          const cj = s.crew[j]!;
          const jT = targets[j];
          const jMoves = !blocked[j] && jT !== null;
          if (!jMoves && cj.x === T.x && cj.y === T.y) bad = true;
          else if (jMoves && jT!.x === T.x && jT!.y === T.y && j < i) bad = true;
          else if (jMoves && jT!.x === s.crew[i]!.x && jT!.y === s.crew[i]!.y && T.x === cj.x && T.y === cj.y) bad = true;
        }
        if (bad) { blocked[i] = true; changed = true; }
      }
    }
    for (let i = 0; i < n; i++) {
      const c = s.crew[i]!;
      if (targets[i] && !blocked[i]) {
        c.x = targets[i]!.x; c.y = targets[i]!.y;
        w.paths[i]!.shift();
      } else if (targets[i] && blocked[i]) {
        ev.push({ type: "crew.blocked", crewId: c.id, at: { x: c.x, y: c.y } });
        w.paths[i] = [];
      }
    }

    if (!seen) {
      if (level.prize && s.prizeHolder === null) {
        const holder = s.crew.find(c => c.x === level.prize!.x && c.y === level.prize!.y);
        if (holder) {
          s.prizeHolder = holder.id;
          ev.push({ type: "prize.taken", crewId: holder.id, prizeId: level.prize.id });
        }
      }
      seen = visionCheck(k);
    }
    if (seen) ev.push({ type: "crew.seen", crewId: seen.crewId, guardId: seen.guardId });
    steps.push({ k, crew: s.crew.map(c => ({ ...c })), guards: newPoses, events: ev });
    if (seen) {
      commitGuards(s, ends, k);
      const outcome = { result: "failed", reason: "seen", turn: t, step: k, crewId: seen.crewId, guardId: seen.guardId } as const;
      s.outcome = outcome;
      return { state: s, timeline: { turn: t, intents, steps, outcome } };
    }
  }

  commitGuards(s, ends, 3);

  // step 6: end of turn
  const allExit = s.crew.every(c => tileAt(level, c) === "E");
  const prizeOk = !level.prize || s.prizeHolder !== null;
  const tokensOut = s.tokens.filter(tok => tok.at !== level.tokens.find(td => td.id === tok.id)!.home);
  let outcome: TurnTimeline["outcome"] = null;
  if (allExit && prizeOk && tokensOut.length === 0) {
    outcome = { result: "won", turn: t };
  } else if (t === level.midnight) {
    outcome = tokensOut.length
      ? { result: "failed", reason: "loanNotHome", turn: t, step: 3, tokenIds: tokensOut.map(tok => tok.id) }
      : { result: "failed", reason: "midnight", turn: t, step: 3 };
  } else {
    s.turn = t + 1;
  }
  s.outcome = outcome;
  return { state: s, timeline: { turn: t, intents, steps, outcome } };
}

function commitGuards(s: HeistState, ends: IntentResult[], uptoPose: number): void {
  for (let i = 0; i < s.guards.length; i++) {
    const g = s.guards[i]!;
    const e = ends[i]!;
    const pose = e.intent.poses[Math.min(uptoPose, 3)]!;
    g.x = pose.x; g.y = pose.y; g.facing = pose.facing;
    g.routeIndex = e.end.routeIndex;
    g.mode = e.end.mode;
    g.noiseTarget = e.end.noiseTarget;
  }
}

export function heistHash(state: HeistState): string {
  return sha256Hex(canonical(state));
}
