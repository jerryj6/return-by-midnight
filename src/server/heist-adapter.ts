/** heist-adapter.ts — online adapter for the heist rules.
 *
 *  Commands (payload.type):
 *    lock {plans}   — lock this seat's plans for the turn; when every seat that
 *                     owns crew has locked, the turn resolves and the timeline
 *                     is broadcast inside the heist.view event.
 *    unlock         — withdraw the lock before resolution.
 *    ping {x,y}     — record a cursor ping (with a per-seat seq).
 *    restart        — reset to this level's initial state.
 *    level {levelId}— reset to that level's initial state.
 *
 *  Crew ownership: occupied seats sorted ascending; crew index i belongs to
 *  seats[i % seats.length]. Locked plan contents are hidden from other seats:
 *  redactPayload strips them from broadcasts/history and publicSnapshot emits
 *  only the public view. The durable store keeps raw payloads for replay.
 */
import {
  createInitialState, resolveTurn, validatePlan, heistHash,
} from "../engine/heist/engine.js";
import type { CrewPlan, HeistState, Plans, TurnTimeline } from "../engine/heist/types.js";
import { HEIST_LEVELS } from "../content/heist/levels.js";
import type { GameAdapter, RoomDraft, RoomInitContext, RoomView, ValidationResult } from "./adapter.js";

export interface Ping { x: number; y: number; seq: number }
export interface HeistRoomState {
  levelId: string;
  game: HeistState;
  locked: Record<string, Plans>;        // seat → plans
  lastTimeline: TurnTimeline | null;
  pings: Record<string, Ping>;          // seat → ping
  resolvedTurns: number;
}

interface Cmd {
  type: string;
  plans?: Record<string, CrewPlan>;
  x?: number;
  y?: number;
  levelId?: string;
}

function levelOf(id: string) {
  return HEIST_LEVELS.find(l => l.id === id);
}

/** Occupied seats ascending → crewId → seat. */
function crewSeats(room: RoomView<HeistRoomState> | RoomDraft<HeistRoomState>, level: { crew: { id: string }[] }): Record<string, number> {
  const seats = [...new Set([...room.members.values()].map(m => m.seat))].sort((a, b) => a - b);
  const out: Record<string, number> = {};
  level.crew.forEach((c, i) => { out[c.id] = seats[i % seats.length]!; });
  return out;
}

function publicView(room: RoomView<HeistRoomState>): unknown {
  const level = levelOf(room.state.levelId)!;
  return {
    levelId: room.state.levelId,
    game: room.state.game,
    lockedSeats: Object.keys(room.state.locked).map(Number).sort((a, b) => a - b),
    crewSeats: crewSeats(room, level),
    lastTimeline: room.state.lastTimeline,
    pings: room.state.pings,
    resolvedTurns: room.state.resolvedTurns,
  };
}

function reset(state: HeistRoomState, levelId: string): void {
  const level = levelOf(levelId)!;
  state.levelId = levelId;
  state.game = createInitialState(level);
  state.locked = {};
  state.lastTimeline = null;
  state.pings = {};
  state.resolvedTurns = 0;
}

export const heistAdapter: GameAdapter<HeistRoomState> = {
  gameType: "rbm",
  rulesVersion: "heist-1",

  initRoomState(ctx: RoomInitContext): HeistRoomState {
    const s: HeistRoomState = {
      levelId: "L1", game: createInitialState(levelOf("L1")!),
      locked: {}, lastTimeline: null, pings: {}, resolvedTurns: 0,
    };
    if (ctx.seed && levelOf(ctx.seed)) reset(s, ctx.seed);
    return s;
  },

  validateCommand(room: RoomView<HeistRoomState>, actorId: string, cmd: unknown): ValidationResult {
    const c = cmd as Cmd | null;
    if (!c || typeof c !== "object" || typeof c.type !== "string") return { ok: false, reason: "malformed command" };
    const seat = room.seatOf(actorId);
    if (seat === null) return { ok: false, reason: "not seated" };
    const level = levelOf(room.state.levelId)!;
    switch (c.type) {
      case "lock": {
        if (!c.plans || typeof c.plans !== "object") return { ok: false, reason: "lock needs plans" };
        const owned = crewSeats(room, level);
        for (const [crewId, plan] of Object.entries(c.plans)) {
          if (owned[crewId] !== seat) return { ok: false, reason: "Not your crew member" };
          const p = plan as CrewPlan;
          if (!p || !Array.isArray(p.path)) return { ok: false, reason: "bad plan" };
          const v = validatePlan(level, room.state.game, crewId, p);
          if (!v.ok) return v;
        }
        return { ok: true };
      }
      case "unlock":
        return { ok: true };
      case "ping":
        if (typeof c.x !== "number" || typeof c.y !== "number") return { ok: false, reason: "bad ping" };
        return { ok: true };
      case "restart":
        return { ok: true };
      case "level":
        return levelOf(String(c.levelId)) ? { ok: true } : { ok: false, reason: "unknown level" };
      default:
        return { ok: false, reason: `unknown command ${c.type}` };
    }
  },

  applyCommand(room: RoomDraft<HeistRoomState>, actorId: string, cmd: unknown): unknown[] {
    const c = cmd as Cmd;
    const seat = room.seatOf(actorId)!;
    const st = room.state;
    const level = levelOf(st.levelId)!;
    switch (c.type) {
      case "lock": {
        st.locked[String(seat)] = c.plans as Plans;
        const owned = crewSeats(room, level);
        const needed = new Set(Object.values(owned));
        if ([...needed].every(s2 => st.locked[String(s2)] !== undefined)) {
          const merged: Plans = {};
          for (const seatId of needed) Object.assign(merged, st.locked[String(seatId)]);
          const { state, timeline } = resolveTurn(level, st.game, merged);
          st.game = state;
          st.lastTimeline = timeline;
          st.locked = {};
          st.resolvedTurns += 1;
        }
        break;
      }
      case "unlock":
        delete st.locked[String(seat)];
        break;
      case "ping": {
        const prev = st.pings[String(seat)];
        st.pings[String(seat)] = { x: c.x!, y: c.y!, seq: (prev?.seq ?? 0) + 1 };
        break;
      }
      case "restart":
        reset(st, st.levelId);
        break;
      case "level":
        reset(st, String(c.levelId));
        break;
    }
    return [{ type: "heist.view", view: publicView(room) }];
  },

  snapshot(room: RoomView<HeistRoomState>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(room.state));
  },
  restore(draft: { state: HeistRoomState }, bytes: Uint8Array): void {
    draft.state = JSON.parse(new TextDecoder().decode(bytes)) as HeistRoomState;
  },
  hashState(room: RoomView<HeistRoomState>): string {
    return heistHash(room.state as unknown as HeistState);
  },

  redactPayload(cmd: unknown): unknown {
    const c = cmd as Cmd | null;
    if (c && c.type === "lock") return { type: "lock" };
    return cmd;
  },
  publicSnapshot(room: RoomView<HeistRoomState>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(publicView(room)));
  },

  isFinished(): boolean {
    return false; // rooms can always restart
  },
};
