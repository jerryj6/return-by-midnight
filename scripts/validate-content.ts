import { HEIST_LEVELS } from "../src/content/heist/levels.js";
import { isStaticPassable, tileAt } from "../src/engine/heist/engine.js";
import type { LevelDef, Pos } from "../src/engine/heist/types.js";

// Structural content check for heist level definitions.
// Solution replay (SOLUTIONS must win) lives in scripts/verify-levels.ts —
// this file is the fast schema pass.

let fail = false;
const err = (id: string, msg: string) => { console.error(`${id}: ${msg}`); fail = true; };
const key = (p: Pos) => `${p.x},${p.y}`;
const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

// Tiles a placed thing (crew member, object, prize) may sit on.
const placeable = new Set([".", ":", "E", "P"]);

const levelIds = new Set<string>();
for (const l of HEIST_LEVELS) {
  const id = l.id;
  if (levelIds.has(id)) err(id, "duplicate level id");
  levelIds.add(id);
  validate(id, l);
}

function validate(id: string, l: LevelDef): void {
  if (!l.title || !l.intro) err(id, "missing title/intro");
  if (!Array.isArray(l.tips) || l.tips.length < 1) err(id, "needs at least one tip");
  const h = l.tiles.length;
  const w = l.tiles[0]?.length ?? 0;
  if (w < 1 || w > 12 || h < 1 || h > 10) err(id, `board ${w}x${h} exceeds 12x10 limit`);
  const width = new Set(l.tiles.map(r => r.length));
  if (width.size !== 1) err(id, `rows have unequal lengths: ${[...width].join(",")}`);

  // Unique ids across everything with an id.
  const ids = new Set<string>();
  const uniq = (kind: string, i: string) => {
    if (!i) { err(id, `${kind} with empty id`); return; }
    if (ids.has(i)) err(id, `duplicate id ${i} (${kind})`);
    ids.add(i);
  };
  l.crew.forEach(c => uniq("crew", c.id));
  l.guards.forEach(g => uniq("guard", g.id));
  l.objects.forEach(o => uniq("object", o.id));
  l.tokens.forEach(t => uniq("token", t.id));
  l.doors.forEach(d => uniq("door", d.id));
  if (l.prize) {
    if (ids.has(l.prize.id)) err(id, `duplicate id ${l.prize.id} (prize)`);
    ids.add(l.prize.id);
    if (!l.prize.name) err(id, "prize missing name");
  }

  const onPlaceable = (kind: string, p: Pos) => {
    const t = tileAt(l, p);
    if (!placeable.has(t)) err(id, `${kind} at ${key(p)} on tile '${t}'`);
  };

  const objectTiles = new Set(l.objects.map(o => `${o.x},${o.y}`));
  for (const c of l.crew) {
    onPlaceable(`crew ${c.id}`, c);
    if (objectTiles.has(key(c))) err(id, `crew ${c.id} starts on an object`);
    if (!c.look || !c.name) err(id, `crew ${c.id} missing look/name`);
  }
  if (new Set(l.crew.map(c => c.look)).size !== l.crew.length) err(id, "crew looks must be distinct");

  for (const o of l.objects) onPlaceable(`object ${o.id}`, o);
  if (l.prize) onPlaceable("prize", l.prize);

  for (const d of l.doors) {
    if (tileAt(l, d) !== "D") err(id, `door ${d.id} at ${key(d)} but tile is '${tileAt(l, d)}'`);
    for (const p of d.plates) {
      if (tileAt(l, p) !== "P") err(id, `door ${d.id} plate at ${key(p)} but tile is '${tileAt(l, p)}'`);
    }
  }
  // Every 'P' tile is wired to a door.
  for (let y = 0; y < l.tiles.length; y++)
    for (let x = 0; x < (l.tiles[y]?.length ?? 0); x++) {
      if (l.tiles[y]![x] === "P" && !l.doors.some(d => d.plates.some(p => p.x === x && p.y === y)))
        err(id, `plate tile ${x},${y} not linked to any door`);
    }

  for (const t of l.tokens) {
    if (!l.objects.some(o => o.id === t.home)) err(id, `token ${t.id} home '${t.home}' is not an object`);
    if (t.duration < 1) err(id, `token ${t.id} duration ${t.duration} < 1`);
  }

  for (const g of l.guards) {
    const r = g.route;
    if (r.length < 1) err(id, `guard ${g.id} has empty route`);
    for (let i = 0; i < r.length; i++) {
      const p = r[i]!;
      const t = tileAt(l, p);
      if (!isStaticPassable(l, p)) err(id, `guard ${g.id} route[${i}] ${key(p)} on non-passable tile '${t}'`);
      if (objectTiles.has(key(p))) err(id, `guard ${g.id} route[${i}] ${key(p)} on an object`);
      const nxt = r[(i + 1) % r.length]!;
      if (!adjacent(p, nxt) && !(p.x === nxt.x && p.y === nxt.y))
        err(id, `guard ${g.id} route[${i}] → [${(i + 1) % r.length}] not adjacent`);
    }
    if (g.startIndex < 0 || g.startIndex >= r.length) err(id, `guard ${g.id} startIndex out of route`);
    if (g.speed < 1 || g.sight < 1) err(id, `guard ${g.id} speed/sight must be ≥ 1`);
  }

  if (l.midnight < 1) err(id, `midnight ${l.midnight} < 1`);
  const exitCount = l.tiles.reduce((n, row) => n + [...row].filter(t => t === "E").length, 0);
  if (!exitCount) err(id, "no exit tiles");
}

console.log(`content: ${HEIST_LEVELS.length} heist levels structurally ${fail ? "INVALID" : "ok"}`);
process.exit(fail ? 1 : 0);
