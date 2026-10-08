// Return by Midnight — deterministic beat simulation.
//
// Implements RBM-008's exact per-beat phase order:
//   1. loans + interaction commands, then device settling
//   2. crew movement under occupancy/capacity rules
//   3. machinery and guard movement/detection (guard attention scan precedes
//      each guard's patrol movement; detection rays are re-evaluated after)
//   4. due properties return simultaneously (RBM-009)
//   5. settle affected devices, record events, evaluate applicable goals
//
// Outcomes are evaluated at the level's verification horizon, which is an
// end-of-beat point (RBM-012): reaching the pad before beat 4 is provisional.
import { sha256Hex } from "../hash.js";
import type { Beat, EntityId, GameEvent, PredicateResult, RunEvaluation } from "../contracts";
import {
  type RbmBeatSnapshot,
  type RbmCrewCommand,
  type RbmDeviceState,
  type RbmEntityDef,
  type RbmEntityState,
  type RbmGuardDef,
  type RbmManifest,
  type RbmPlan,
  type RbmSimResult,
  type RbmSimState,
  type RbmTokenDef,
  type RbmTokenState,
} from "./types";

// ---------------------------------------------------------------------------
// canonical hashing / stable stringify (unordered collections made explicit)

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(",")}}`;
}

export function sha256(text: string): string {
  return sha256Hex(text);
}

function hashSimState(state: RbmSimState): string {
  return sha256(stableStringify(state));
}

/** Deterministic seeded generator (mulberry32) reserved for future tie-breaks. */
export function seededRng(seed: string): () => number {
  let a = 0;
  for (const c of seed) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  a = a || 0x9e3779b9;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// lookups

interface World {
  level: RbmManifest;
  entities: Map<EntityId, RbmEntityDef>;
  cellRegion: Map<EntityId, "inside" | "outside">;
  cellCover: Map<EntityId, boolean>;
  cellCapacity: Map<EntityId, number>;
  edgeByPair: Map<string, EntityId | null>; // "a|b" -> gateId | null
  tokenDefs: Map<EntityId, RbmTokenDef>;
}

function pairKey(a: EntityId, b: EntityId): string {
  return `${a}|${b}`;
}

function buildWorld(level: RbmManifest): World {
  const entities = new Map<EntityId, RbmEntityDef>();
  for (const e of [...level.props, ...level.crew, ...level.guards]) entities.set(e.id, e);
  const cellRegion = new Map(level.cells.map((c) => [c.id, c.region]));
  const cellCover = new Map(level.cells.map((c) => [c.id, c.cover === true]));
  const cellCapacity = new Map(
    level.cells.filter((c) => c.capacity !== undefined).map((c) => [c.id, c.capacity as number]),
  );
  const edgeByPair = new Map<string, EntityId | null>();
  for (const e of level.edges) {
    edgeByPair.set(pairKey(e.a, e.b), e.gateId ?? null);
    edgeByPair.set(pairKey(e.b, e.a), e.gateId ?? null);
  }
  const tokenDefs = new Map(level.tokens.map((t) => [t.id, t]));
  return { level, entities, cellRegion, cellCover, cellCapacity, edgeByPair, tokenDefs };
}

export function initialSimState(level: RbmManifest, plan: RbmPlan): RbmSimState {
  const entities: Record<EntityId, RbmEntityState> = {};
  for (const p of level.props) entities[p.id] = { id: p.id, kind: "prop", cellId: p.cellId };
  for (const c of level.crew) entities[c.id] = { id: c.id, kind: "crew", cellId: c.cellId, cargoId: null };
  for (const g of level.guards) entities[g.id] = { id: g.id, kind: "guard", cellId: g.patrol[0]?.cellId ?? g.id };

  const tokens: Record<EntityId, RbmTokenState> = {};
  for (const t of level.tokens) {
    const staged = plan.rows.some((r) => r.tokenId === t.id);
    tokens[t.id] = {
      id: t.id,
      status: staged ? "staged" : "home",
      hostEntityId: t.homeEntityId,
      completedLoans: 0,
    };
  }

  const devices: Record<EntityId, RbmDeviceState> = {};
  for (const d of level.devices) {
    const tags = (d.tags ?? []).map((t) => ({ ...t }));
    if (d.kind === "pressure-plate") devices[d.id] = { id: d.id, kind: d.kind, pressed: false, tags };
    else if (d.kind === "gate") devices[d.id] = { id: d.id, kind: d.kind, open: d.initiallyOpen, tags };
    else devices[d.id] = { id: d.id, kind: d.kind, powered: false, tags };
  }
  return { beat: 0, entities, tokens, devices };
}

/** Effective mass of an entity = base mass + mass effects of hosted tokens (RBM-004). */
function effectiveMass(world: World, state: RbmSimState, entityId: EntityId): number {
  const def = world.entities.get(entityId);
  if (!def || def.kind !== "prop") return 0;
  let mass = def.baseMass;
  for (const tok of Object.values(state.tokens)) {
    if (tok.hostEntityId === entityId) {
      mass += world.tokenDefs.get(tok.id)?.effects.mass ?? 0;
    }
  }
  return mass;
}

/** Mass resting on a plate: props authored as resting on it (carried cargo
 *  never rests). Tokens hosted by a resting prop count through its mass. */
function restingMass(world: World, state: RbmSimState, plateId: EntityId): number {
  const carried = new Set(
    Object.values(state.entities)
      .map((e) => e.cargoId)
      .filter((x): x is EntityId => typeof x === "string"),
  );
  let total = 0;
  for (const e of Object.values(state.entities)) {
    if (e.kind !== "prop" || carried.has(e.id)) continue;
    const def = world.entities.get(e.id);
    if (def?.kind === "prop" && def.restingOn === plateId) {
      total += effectiveMass(world, state, e.id);
    }
  }
  return total;
}

function tagActive(dev: RbmDeviceState, kind: "paused" | "disabled"): boolean {
  return dev.tags.some((t) => t.kind === kind && t.beatsRemaining > 0);
}

function tickTags(dev: RbmDeviceState): void {
  dev.tags = dev.tags
    .map((t) => ({ ...t, beatsRemaining: t.beatsRemaining - 1 }))
    .filter((t) => t.beatsRemaining > 0);
}

/**
 * Recompute all devices from world state. Emits only transitions.
 * `disabled` devices are inert; `paused` devices keep their last output.
 */
function settleDevices(world: World, state: RbmSimState, beat: Beat, events: GameEvent[]): void {
  const pending: { deviceId: EntityId; set: "open" | "close" }[] = [];
  const invert = (s: "open" | "close"): "open" | "close" => (s === "open" ? "close" : "open");
  for (const id of Object.keys(state.devices).sort()) {
    const dev = state.devices[id];
    const def = world.level.devices.find((d) => d.id === id);
    if (!dev || !def || tagActive(dev, "disabled") || tagActive(dev, "paused")) continue;
    if (def.kind === "pressure-plate") {
      const mass = restingMass(world, state, id);
      const pressed = mass >= def.threshold;
      if (pressed !== dev.pressed) {
        dev.pressed = pressed;
        events.push({
          beat,
          phase: "settle",
          type: pressed ? "plate.press" : "plate.release",
          entityId: id,
          data: { cellId: def.cellId, mass, threshold: def.threshold },
        });
        for (const t of def.targets) {
          pending.push({ deviceId: t.deviceId, set: pressed ? t.whenPressed : invert(t.whenPressed) });
        }
      }
    } else if (def.kind === "sensor") {
      const powered = Object.values(state.tokens).some((tok) => {
        const tdef = world.tokenDefs.get(tok.id);
        const host = state.entities[tok.hostEntityId];
        return tdef?.property === def.requiresProperty && host?.cellId === def.cellId;
      });
      if (powered !== dev.powered) {
        dev.powered = powered;
        events.push({ beat, phase: "settle", type: powered ? "sensor.power" : "sensor.unpower", entityId: id });
      }
    }
  }
  for (const act of pending) {
    const dev = state.devices[act.deviceId];
    if (!dev || tagActive(dev, "disabled") || tagActive(dev, "paused")) continue;
    const open = act.set === "open";
    if (dev.open !== open) {
      dev.open = open;
      events.push({ beat, phase: "settle", type: open ? "gate.open" : "gate.close", entityId: act.deviceId });
    }
  }
}

// ---------------------------------------------------------------------------
// guards (RBM-007: finite inspectable patrol + declared detection regions)

function litCells(state: RbmSimState, guard: RbmGuardDef, post: EntityId): Set<EntityId> {
  const lit = new Set<EntityId>();
  for (const ray of guard.rays[post] ?? []) {
    for (const seg of ray.segments) {
      const blocked = (seg.gatedBy ?? []).some((g) => state.devices[g]?.open !== true);
      if (blocked) break; // an opaque surface ends the ray: later segments stay dark
      for (const c of seg.cells) lit.add(c);
    }
  }
  return lit;
}

function scanGuard(
  world: World,
  state: RbmSimState,
  beat: Beat,
  guard: RbmGuardDef,
  events: GameEvent[],
  seen: Set<string>,
): void {
  const g = state.entities[guard.id];
  if (!g) return;
  const lit = litCells(state, guard, g.cellId);
  const hits = Object.values(state.entities)
    .filter(
      (e) =>
        e.kind === "crew" &&
        !e.captured &&
        lit.has(e.cellId) &&
        world.cellCover.get(e.cellId) !== true,
    )
    .map((e) => e.id)
    .sort();
  events.push({
    beat,
    phase: "guards",
    type: "guard.attention",
    entityId: guard.id,
    data: { post: g.cellId, lit: [...lit].sort(), detected: hits },
  });
  for (const crewId of hits) {
    const key = `${guard.id}:${crewId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const crew = state.entities[crewId];
    if (!crew) continue;
    crew.captured = true;
    events.push({
      beat,
      phase: "guards",
      type: "guard.detect",
      entityId: guard.id,
      data: { crewId, cellId: crew.cellId },
    });
    events.push({
      beat,
      phase: "guards",
      type: "guard.capture",
      entityId: guard.id,
      data: { crewId, cellId: crew.cellId },
    });
  }
}

// ---------------------------------------------------------------------------
// crew movement (RBM-010: explicit occupancy/capacity, auto-wait default)

function crewOccupants(state: RbmSimState, cellId: EntityId, except?: EntityId): number {
  return Object.values(state.entities).filter(
    (e) => e.kind === "crew" && e.cellId === cellId && e.id !== except && !e.captured,
  ).length;
}

function reject(events: GameEvent[], beat: Beat, crewId: EntityId, command: RbmCrewCommand, reason: string): void {
  events.push({ beat, phase: "crew", type: "command.rejected", entityId: crewId, data: { command, reason } });
}

function tryMove(
  world: World,
  state: RbmSimState,
  beat: Beat,
  crewId: EntityId,
  to: EntityId,
  events: GameEvent[],
): boolean {
  const crew = state.entities[crewId];
  if (!crew) return false;
  const from = crew.cellId;
  const gateId = world.edgeByPair.get(pairKey(from, to));
  if (gateId === undefined) {
    reject(events, beat, crewId, { type: "move", to }, "no-adjacent-edge");
    return false;
  }
  if (gateId !== null && state.devices[gateId]?.open !== true) {
    reject(events, beat, crewId, { type: "move", to }, "gate-closed");
    return false;
  }
  const cap = world.cellCapacity.get(to);
  if (cap !== undefined && crewOccupants(state, to, crewId) >= cap) {
    reject(events, beat, crewId, { type: "move", to }, "cell-capacity");
    return false;
  }
  if (crew.cargoId) {
    const mass = effectiveMass(world, state, crew.cargoId);
    const limit = (world.entities.get(crewId) as { massLimit: number } | undefined)?.massLimit ?? 0;
    if (mass > limit) {
      reject(events, beat, crewId, { type: "move", to }, "overloaded-cargo");
      return false;
    }
  }
  crew.cellId = to;
  const carried = crew.cargoId ? state.entities[crew.cargoId] : null;
  if (carried) carried.cellId = to;
  // (carried is a prop entity; props always exist when cargoId is set)
  events.push({
    beat,
    phase: "crew",
    type: "crew.move",
    entityId: crewId,
    data: { from, to, withCargo: crew.cargoId ?? null },
  });
  return true;
}

function tryPickup(
  world: World,
  state: RbmSimState,
  beat: Beat,
  crewId: EntityId,
  propId: EntityId,
  events: GameEvent[],
): boolean {
  const crew = state.entities[crewId];
  if (!crew) return false;
  const prop = state.entities[propId];
  const def = world.entities.get(propId);
  if (!prop || prop.kind !== "prop" || !def || def.kind !== "prop") {
    reject(events, beat, crewId, { type: "pickup", propId }, "not-a-prop");
    return false;
  }
  if (prop.cellId !== crew.cellId) {
    reject(events, beat, crewId, { type: "pickup", propId }, "not-in-reach");
    return false;
  }
  if (Object.values(state.entities).some((e) => e.cargoId === propId)) {
    reject(events, beat, crewId, { type: "pickup", propId }, "already-carried");
    return false;
  }
  const mass = effectiveMass(world, state, propId);
  const limit = (world.entities.get(crewId) as { massLimit: number } | undefined)?.massLimit ?? 0;
  if (mass > limit) {
    reject(events, beat, crewId, { type: "pickup", propId }, "too-heavy");
    return false;
  }
  crew.cargoId = propId;
  events.push({ beat, phase: "crew", type: "crew.pickup", entityId: crewId, data: { propId } });
  return true;
}

function runCrewCommand(
  world: World,
  state: RbmSimState,
  beat: Beat,
  crewId: EntityId,
  command: RbmCrewCommand | undefined,
  events: GameEvent[],
): void {
  const crew = state.entities[crewId];
  if (!crew || crew.kind !== "crew") return;
  const cmd = command ?? { type: "wait" as const };
  if (crew.captured) {
    reject(events, beat, crewId, cmd, "captured");
    return;
  }
  switch (cmd.type) {
    case "wait":
      if (command) events.push({ beat, phase: "crew", type: "crew.wait", entityId: crewId });
      return;
    case "move":
      tryMove(world, state, beat, crewId, cmd.to, events);
      return;
    case "pickup":
      tryPickup(world, state, beat, crewId, cmd.propId, events);
      return;
    case "drop": {
      const cargo = crew.cargoId;
      if (!cargo) {
        reject(events, beat, crewId, cmd, "no-cargo");
        return;
      }
      crew.cargoId = null;
      events.push({ beat, phase: "crew", type: "crew.drop", entityId: crewId, data: { propId: cargo, cellId: crew.cellId } });
      return;
    }
    case "pickup-and-move": {
      if (!crew.cargoId && !tryPickup(world, state, beat, crewId, cmd.propId, events)) return;
      if (crew.cargoId !== cmd.propId) {
        reject(events, beat, crewId, cmd, "different-cargo-held");
        return;
      }
      tryMove(world, state, beat, crewId, cmd.to, events);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// evaluation (RBM-012: verification horizon, provisional != success)

function evaluate(world: World, state: RbmSimState, plan: RbmPlan): RunEvaluation {
  const observations: PredicateResult[] = [];
  const scheduled = new Set(plan.rows.map((r) => r.tokenId));
  const missing = world.level.loans.requiredTokens.filter((t) => !scheduled.has(t));
  observations.push({
    predicateId: "plan.complete",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? "all required tokens are scheduled in the manifest"
        : `manifest missing required token rows: ${missing.join(", ")}`,
  });

  const outcomes: PredicateResult[] = world.level.outcomes.map((p) => {
    switch (p.kind) {
      case "entityAt": {
        const e = state.entities[p.entityId];
        const ok = e?.cellId === p.cellId;
        return {
          predicateId: p.id,
          passed: ok,
          detail: ok ? `${p.entityId} at ${p.cellId}` : `${p.entityId} at ${e?.cellId ?? "?"}, required ${p.cellId}`,
        };
      }
      case "entityInRegion": {
        const e = state.entities[p.entityId];
        const region = e ? world.cellRegion.get(e.cellId) : undefined;
        const ok = region === p.region;
        return {
          predicateId: p.id,
          passed: ok,
          detail: ok ? `${p.entityId} in ${p.region}` : `${p.entityId} in ${region ?? "?"}, required ${p.region}`,
        };
      }
      case "tokenHome": {
        const t = state.tokens[p.tokenId];
        const home = world.tokenDefs.get(p.tokenId)?.homeEntityId;
        const ok = t?.hostEntityId === home;
        return {
          predicateId: p.id,
          passed: ok,
          detail: ok ? `${p.tokenId} home at ${home}` : `${p.tokenId} hosted by ${t?.hostEntityId ?? "?"}, home is ${home}`,
        };
      }
      case "noCapture": {
        const caught = Object.values(state.entities).filter((e) => e.kind === "crew" && e.captured);
        return {
          predicateId: p.id,
          passed: caught.length === 0,
          detail: caught.length === 0 ? "no crew captured" : `captured: ${caught.map((c) => c.id).join(", ")}`,
        };
      }
    }
  });

  const allObservationsPass = observations.every((o) => o.passed);
  const allOutcomesPass = outcomes.every((o) => o.passed);
  return { success: allObservationsPass && allOutcomesPass, allObservationsPass, allOutcomesPass, observations, outcomes };
}

// ---------------------------------------------------------------------------
// simulate

export function simulate(level: RbmManifest, plan: RbmPlan, seed: string): RbmSimResult {
  const world = buildWorld(level);
  const rng = seededRng(seed); // reserved for declared tie-breaks (RBM-007); deterministic
  void rng;
  const state = initialSimState(level, plan);
  const events: GameEvent[] = [];
  const timeline: RbmBeatSnapshot[] = [{ beat: 0, hash: hashSimState(state), state: structuredClone(state) }];
  const horizon = level.verification.horizonBeat;
  const rows = [...plan.rows].sort((a, b) => a.startBeat - b.startBeat || a.rowId.localeCompare(b.rowId));

  let evaluation: RunEvaluation | null = null;
  const captureSeen = new Set<string>();

  for (let beat = 1; beat <= horizon; beat++) {
    state.beat = beat;

    // Phase 1 — accepted loans and interaction commands, then device settling.
    for (const row of rows.filter((r) => r.startBeat === beat)) {
      const tok = state.tokens[row.tokenId];
      const homeOk = tok !== undefined && tok.hostEntityId === row.fromHostId;
      if (!homeOk || !tok) {
        events.push({ beat, phase: "loans", type: "loan.rejected", entityId: row.tokenId, data: { rowId: row.rowId, reason: "token-not-at-origin" } });
        continue;
      }
      tok.hostEntityId = row.toHostId;
      tok.status = "held";
      tok.loan = { rowId: row.rowId, dueBeat: row.dueBeat };
      events.push({
        beat,
        phase: "loans",
        type: "loan.start",
        entityId: row.tokenId,
        data: { rowId: row.rowId, from: row.fromHostId, to: row.toHostId, dueBeat: row.dueBeat },
      });
    }
    settleDevices(world, state, beat, events);

    // Phase 2 — crew movement under occupancy/capacity rules.
    const beatCmds = plan.commands[beat] ?? {};
    for (const crewId of level.crew.map((c) => c.id).sort()) {
      runCrewCommand(world, state, beat, crewId, beatCmds[crewId], events);
    }

    // Phase 3 — machinery and guard movement/detection.
    // Machinery tags tick; guards resolve attention at their current post
    // BEFORE patrol movement, then detection rays again after moving.
    for (const id of Object.keys(state.devices).sort()) {
      const d = state.devices[id];
      if (d) tickTags(d);
    }
    for (const g of [...level.guards].sort((a, b) => a.id.localeCompare(b.id))) {
      const gstate = state.entities[g.id];
      if (!gstate) continue;
      scanGuard(world, state, beat, g, events, captureSeen); // attention before movement
      const step = g.patrol.find((p) => p.beat === beat);
      if (step && step.cellId !== gstate.cellId) {
        const from = gstate.cellId;
        gstate.cellId = step.cellId;
        events.push({ beat, phase: "guards", type: "guard.move", entityId: g.id, data: { from, to: step.cellId, facing: step.facing ?? null } });
      }
      scanGuard(world, state, beat, g, events, captureSeen); // post-move detection
    }

    // Phase 4 — properties due on this beat return simultaneously (RBM-009).
    const due = Object.values(state.tokens)
      .filter((t) => t.loan && t.loan.dueBeat === beat)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const tok of due) {
      const homeId = world.tokenDefs.get(tok.id)?.homeEntityId ?? tok.hostEntityId;
      const from = tok.hostEntityId;
      tok.hostEntityId = homeId;
      delete tok.loan;
      tok.completedLoans += 1;
      tok.status = "returned";
      events.push({
        beat,
        phase: "returns",
        type: "token.return",
        entityId: tok.id,
        data: { from, to: homeId, homeCellId: state.entities[homeId]?.cellId ?? null },
      });
    }

    // Phase 5 — settle affected devices, record events, evaluate goals.
    settleDevices(world, state, beat, events);
    for (const crewId of Object.keys(state.entities).sort()) {
      const crew = state.entities[crewId];
      if (!crew || crew.kind !== "crew" || !crew.cargoId) continue;
      const def = world.entities.get(crewId) as { massLimit: number } | undefined;
      const mass = effectiveMass(world, state, crew.cargoId);
      if (def && mass > def.massLimit) {
        const propId = crew.cargoId;
        const prop = state.entities[propId];
        if (!prop) continue;
        crew.cargoId = null;
        prop.cellId = crew.cellId; // settles at the carrier's current valid location (RBM-004)
        events.push({
          beat,
          phase: "settle",
          type: "cargo.settled",
          entityId: propId,
          data: { crewId, cellId: crew.cellId, mass, massLimit: def.massLimit, reason: "overloaded" },
        });
      }
    }

    events.push({ beat, phase: "settle", type: "beat.end", data: { hash: hashSimState(state) } });
    timeline.push({ beat, hash: hashSimState(state), state: structuredClone(state) });

    if (beat === horizon) {
      evaluation = evaluate(world, state, plan);
      events.push({
        beat,
        phase: "evaluate",
        type: "evaluation",
        data: { success: evaluation.success, outcomes: evaluation.outcomes.map((o) => ({ id: o.predicateId, passed: o.passed })) },
      });
      events.push({ beat, phase: "evaluate", type: evaluation.success ? "run.success" : "run.fail" });
    }
  }

  const finalHash = hashSimState(state);
  return {
    events,
    timeline,
    evaluation: evaluation ?? evaluate(world, state, plan),
    finalState: state,
    finalHash,
  };
}
