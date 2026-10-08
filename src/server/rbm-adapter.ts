import { RbmEngine, type RbmPlayState, type RbmActionPayload } from "../engine/rbm/engine.js";
import type { RbmManifest } from "../engine/rbm/types.js";
import { LEVELS } from "../content/levels/index.js";
import { sha256Hex } from "../engine/hash.js";
import type { GameAdapter, RoomDraft, RoomInitContext, RoomView, ValidationResult } from "./adapter.js";

const engine = new RbmEngine();

export interface RbmRoomState { levelId: string; state: RbmPlayState }

function levelOf(id: string) {
  const l = LEVELS.find(x => x.id === id);
  if (!l) throw new Error(`unknown level ${id}`);
  return l.def as RbmManifest;
}

function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
}

export const rbmAdapter: GameAdapter<RbmRoomState> = {
  gameType: "rbm",
  rulesVersion: "rbm-0.1.0",

  initRoomState(ctx: RoomInitContext): RbmRoomState {
    const levelId = ctx.seed?.match(/^RBM-\d+/) ? ctx.seed : "RBM-01";
    return { levelId, state: engine.createInitialState(levelOf(levelId)) };
  },

  validateCommand(room: RoomView<RbmRoomState>, actorId: string, cmd: unknown): ValidationResult {
    const payload = cmd as RbmActionPayload;
    if (!payload || typeof payload !== "object" || !("type" in payload)) return { ok: false, reason: "malformed command" };
    const action = { actorId, commandId: `${actorId}@${room.revision}`, baseRevision: room.revision, payload };
    const r = engine.validateAction(levelOf(room.state.levelId), room.state.state, action);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  },

  applyCommand(room: RoomDraft<RbmRoomState>, actorId: string, cmd: unknown): unknown[] {
    const action = { actorId, commandId: `${actorId}@${room.revision}`, baseRevision: room.revision, payload: cmd as RbmActionPayload };
    const res = engine.applyAction(levelOf(room.state.levelId), room.state.state, action);
    room.state.state = res.state;
    return res.events;
  },

  snapshot(room: RoomView<RbmRoomState>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(room.state));
  },
  restore(draft: { state: RbmRoomState }, bytes: Uint8Array): void {
    draft.state = JSON.parse(new TextDecoder().decode(bytes)) as RbmRoomState;
  },
  hashState(room: RoomView<RbmRoomState>): string {
    return sha256Hex(stable(room.state));
  },
  isFinished(room: RoomView<RbmRoomState>): boolean {
    const s = room.state.state as unknown as { solved?: boolean; completed?: boolean };
    return s.solved === true || s.completed === true;
  },
};
