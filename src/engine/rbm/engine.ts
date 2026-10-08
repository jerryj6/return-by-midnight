// Return by Midnight — engine wrapper around the deterministic sim.
//
// RbmEngine implements DeterministicEngine<RbmManifest, RbmPlayState, RbmAction>
// (src/engine/contracts.ts — copied verbatim per dispatch).
//
// - Planning phase commits manifest rows (loans) and per-beat crew commands;
//   none of it consumes in-world time (RBM-010).
// - `test.run` simulates the committed plan (master RBM-008 phase order).
// - Manifest budget enforcement: over-budget rows rejected at commit;
//   under-budget plans surface as a failed `plan.complete` observation.
// - `result.accept` succeeds only when the last TestRun evaluated success.
// - canonicalHash = sha256 over stable-sorted canonical JSON (node:crypto);
//   audit fields (revision, history, checkpoint stack) are excluded by design.
// - undo = checkpoint stack; replay/save records carry rulesVersion.
import type {
  ApplyResult,
  CommittedAction,
  DeterministicEngine,
  GameEvent,
  ProposedAction,
  Replay,
  Revision,
  SaveEnvelope,
} from "../contracts";
import { sha256, simulate, stableStringify } from "./sim";
import {
  RBM_RULES_VERSION,
  type LoanManifestRow,
  type PropertyType,
  type RbmBeatSnapshot,
  type RbmCrewCommand,
  type RbmManifest,
  type RbmPlan,
  type RbmSimResult,
} from "./types";

// ---------------------------------------------------------------------------

export type RbmActionPayload =
  | { type: "manifest.commit"; row: LoanManifestRow }
  | { type: "manifest.retract"; rowId: string }
  | { type: "command.queue"; beat: number; crewId: string; command: RbmCrewCommand }
  | { type: "command.clear"; beat: number; crewId: string }
  | { type: "test.run"; seed?: string }
  | { type: "history.undo" }
  | { type: "result.accept" }
  | { type: "plan.reset" };

export interface RbmAction extends ProposedAction {
  payload: RbmActionPayload;
}

interface RbmRunRecord {
  seed: string;
  finalHash: string;
  success: boolean;
  evaluation: RbmSimResult["evaluation"];
  events: GameEvent[];
  timeline: RbmBeatSnapshot[];
}

interface RbmCheckpoint {
  manifestRows: LoanManifestRow[];
  commands: Record<number, Record<string, RbmCrewCommand>>;
  lastRun: RbmRunRecord | undefined;
  accepted: boolean;
  history: CommittedAction[];
}

export interface RbmPlayState {
  levelId: string;
  rulesVersion: string;
  phase: "planning" | "accepted";
  revision: Revision;
  manifestRows: LoanManifestRow[];
  commands: Record<number, Record<string, RbmCrewCommand>>;
  lastRun: RbmRunRecord | undefined;
  accepted: boolean;
  /** Committed canonical action log (provenance for replays; excluded from hash). */
  history: CommittedAction[];
  checkpoints: RbmCheckpoint[];
}

const PLAN_PHASE = "planning";

function evt(type: string, entityId: string | undefined, data?: Record<string, unknown>): GameEvent {
  return {
    beat: 0,
    phase: PLAN_PHASE,
    type,
    ...(entityId !== undefined ? { entityId } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function planOf(state: RbmPlayState): RbmPlan {
  return { rows: clone(state.manifestRows), commands: clone(state.commands) };
}

// ---------------------------------------------------------------------------

export class RbmEngine implements DeterministicEngine<RbmManifest, RbmPlayState, RbmAction> {
  readonly rulesVersion = RBM_RULES_VERSION;

  createInitialState(level: RbmManifest): RbmPlayState {
    return {
      levelId: level.levelId,
      rulesVersion: this.rulesVersion,
      phase: "planning",
      revision: 0,
      manifestRows: [],
      commands: {},
      lastRun: undefined,
      accepted: false,
      history: [],
      checkpoints: [],
    };
  }

  // ---- helpers -----------------------------------------------------------

  private checkpoint(state: RbmPlayState): RbmCheckpoint {
    return {
      manifestRows: clone(state.manifestRows),
      commands: clone(state.commands),
      lastRun: clone(state.lastRun),
      accepted: state.accepted,
      history: clone(state.history),
    };
  }

  private tokenDef(level: RbmManifest, tokenId: string) {
    return level.tokens.find((t) => t.id === tokenId);
  }

  private loanOverlaps(a: LoanManifestRow, b: LoanManifestRow): boolean {
    if (a.tokenId !== b.tokenId) return false;
    const end = (d: number | null) => (d === null ? Number.POSITIVE_INFINITY : d);
    return a.startBeat <= end(b.dueBeat) && b.startBeat <= end(a.dueBeat);
  }

  private hostAccepts(level: RbmManifest, hostId: string, property: string): boolean {
    const prop = level.props.find((p) => p.id === hostId);
    if (prop) return prop.accepts.includes(property as PropertyType);
    const crew = level.crew.find((c) => c.id === hostId);
    if (crew) return (crew.accepts ?? []).includes(property as PropertyType);
    return false;
  }

  private hostExists(level: RbmManifest, hostId: string): boolean {
    return (
      level.props.some((p) => p.id === hostId) ||
      level.crew.some((c) => c.id === hostId)
    );
  }

  private validateRow(
    level: RbmManifest,
    state: RbmPlayState,
    row: LoanManifestRow,
  ): { ok: boolean; reason?: string } {
    const horizon = level.verification.horizonBeat;
    const token = this.tokenDef(level, row.tokenId);
    if (!token) return { ok: false, reason: `unknown-token:${row.tokenId}` };
    if (row.fromHostId !== token.homeEntityId)
      return { ok: false, reason: "loan-not-from-home" }; // RBM-002
    if (row.toHostId === token.homeEntityId)
      return { ok: false, reason: "loan-to-own-home" };
    if (!this.hostExists(level, row.toHostId))
      return { ok: false, reason: `unknown-host:${row.toHostId}` };
    if (!this.hostAccepts(level, row.toHostId, token.property))
      return { ok: false, reason: "incompatible-host" };
    if (row.startBeat < 1 || row.startBeat > horizon)
      return { ok: false, reason: "start-beat-out-of-range" };
    if (!level.loans.legalDueBeats.includes(row.dueBeat))
      return { ok: false, reason: "due-beat-not-offered" };
    if (row.dueBeat !== null && row.dueBeat < row.startBeat)
      return { ok: false, reason: "due-before-start" };
    if (state.manifestRows.some((r) => r.rowId === row.rowId))
      return { ok: false, reason: "duplicate-row-id" };
    if (state.manifestRows.some((r) => this.loanOverlaps(r, row)))
      return { ok: false, reason: "overlapping-loan" }; // no re-lent/renewed loans
    if (state.manifestRows.length >= level.loans.maxRows)
      return { ok: false, reason: "manifest-over-budget" };
    return { ok: true };
  }

  private validateCommand(level: RbmManifest, cmd: RbmCrewCommand): { ok: boolean; reason?: string } {
    const cells = new Set(level.cells.map((c) => c.id));
    const props = new Set(level.props.map((p) => p.id));
    switch (cmd.type) {
      case "wait":
      case "drop":
        return { ok: true };
      case "move":
        return cells.has(cmd.to) ? { ok: true } : { ok: false, reason: `unknown-cell:${cmd.to}` };
      case "pickup":
        return props.has(cmd.propId) ? { ok: true } : { ok: false, reason: `unknown-prop:${cmd.propId}` };
      case "pickup-and-move":
        if (!props.has(cmd.propId)) return { ok: false, reason: `unknown-prop:${cmd.propId}` };
        if (!cells.has(cmd.to)) return { ok: false, reason: `unknown-cell:${cmd.to}` };
        return { ok: true };
      default:
        return { ok: false, reason: "unknown-command-type" };
    }
  }

  // ---- DeterministicEngine ------------------------------------------------

  validateAction(
    level: RbmManifest,
    state: RbmPlayState,
    action: RbmAction,
  ): { ok: boolean; reason?: string } {
    if (action.baseRevision !== state.revision)
      return { ok: false, reason: `stale-revision:${action.baseRevision}!=${state.revision}` };
    if (state.history.some((h) => h.commandId === action.commandId))
      return { ok: false, reason: "duplicate-command-id" };
    const p = action.payload;
    switch (p.type) {
      case "manifest.commit":
        return this.validateRow(level, state, p.row);
      case "manifest.retract":
        return state.manifestRows.some((r) => r.rowId === p.rowId)
          ? { ok: true }
          : { ok: false, reason: "no-such-row" };
      case "command.queue": {
        if (p.beat < 1 || p.beat > level.verification.horizonBeat)
          return { ok: false, reason: "beat-out-of-range" };
        if (!level.crew.some((c) => c.id === p.crewId))
          return { ok: false, reason: `unknown-crew:${p.crewId}` };
        return this.validateCommand(level, p.command);
      }
      case "command.clear":
        return { ok: true };
      case "test.run":
        return state.accepted ? { ok: false, reason: "already-accepted" } : { ok: true };
      case "history.undo":
        return state.checkpoints.length > 0 ? { ok: true } : { ok: false, reason: "nothing-to-undo" };
      case "result.accept":
        return state.lastRun?.success === true
          ? { ok: true }
          : { ok: false, reason: "no-successful-run" };
      case "plan.reset":
        return { ok: true };
      default:
        return { ok: false, reason: "unknown-action" };
    }
  }

  applyAction(level: RbmManifest, prev: RbmPlayState, action: RbmAction): ApplyResult<RbmPlayState> {
    const check = this.validateAction(level, prev, action);
    const state = clone(prev);
    if (!check.ok) {
      return {
        state: prev,
        events: [evt("action.rejected", action.actorId, { commandId: action.commandId, reason: check.reason })],
      };
    }

    const events: GameEvent[] = [];
    if (action.payload.type !== "history.undo") state.checkpoints.push(this.checkpoint(state));

    const p = action.payload;
    switch (p.type) {
      case "manifest.commit": {
        state.manifestRows.push(clone(p.row));
        events.push(evt("manifest.row.commit", p.row.tokenId, { row: clone(p.row) as unknown as Record<string, unknown> }));
        break;
      }
      case "manifest.retract": {
        state.manifestRows = state.manifestRows.filter((r) => r.rowId !== p.rowId);
        events.push(evt("manifest.row.retract", undefined, { rowId: p.rowId }));
        break;
      }
      case "command.queue": {
        (state.commands[p.beat] ??= {})[p.crewId] = clone(p.command);
        events.push(evt("command.queued", p.crewId, { beat: p.beat, command: clone(p.command) as unknown as Record<string, unknown> }));
        break;
      }
      case "command.clear": {
        delete state.commands[p.beat]?.[p.crewId];
        events.push(evt("command.cleared", p.crewId, { beat: p.beat }));
        break;
      }
      case "test.run": {
        const seed = p.seed ?? "";
        const result = simulate(level, planOf(state), seed);
        state.lastRun = {
          seed,
          finalHash: result.finalHash,
          success: result.evaluation.success,
          evaluation: result.evaluation,
          events: result.events,
          timeline: result.timeline,
        };
        events.push(evt("test.run", undefined, { seed, success: result.evaluation.success, finalHash: result.finalHash }));
        break;
      }
      case "history.undo": {
        const cp = state.checkpoints.pop();
        if (!cp) break; // validated non-empty
        state.manifestRows = cp.manifestRows;
        state.commands = cp.commands;
        state.lastRun = cp.lastRun;
        state.accepted = cp.accepted;
        state.history = cp.history;
        events.push(evt("history.undone", undefined, { restoredRevision: cp.history.length }));
        break;
      }
      case "result.accept": {
        state.accepted = true;
        state.phase = "accepted";
        events.push(evt("result.accepted", undefined, { finalHash: state.lastRun?.finalHash }));
        break;
      }
      case "plan.reset": {
        state.manifestRows = [];
        state.commands = {};
        state.lastRun = undefined;
        state.accepted = false;
        state.phase = "planning";
        events.push(evt("plan.reset", undefined));
        break;
      }
    }

    state.revision = (state.revision + 1) as Revision;
    state.history.push({ ...clone(action), revision: state.revision });
    return { state, events };
  }

  getLegalActions(level: RbmManifest, state: RbmPlayState): RbmAction[] {
    const out: RbmAction[] = [];
    let n = 0;
    const mk = (payload: RbmActionPayload): RbmAction => ({
      actorId: "local",
      commandId: `auto-${++n}`,
      baseRevision: state.revision,
      payload,
    });

    // Loan rows: every compatible host x startBeat x offered dueBeat (finite choices).
    if (state.manifestRows.length < level.loans.maxRows) {
      const horizon = level.verification.horizonBeat;
      for (const token of level.tokens) {
        for (const host of [...level.props.map((p) => p.id), ...level.crew.map((c) => c.id)]) {
          if (host === token.homeEntityId) continue;
          if (!this.hostAccepts(level, host, token.property)) continue;
          for (let start = 1; start <= horizon; start++) {
            for (const due of level.loans.legalDueBeats) {
              if (due !== null && due < start) continue;
              const row: LoanManifestRow = {
                rowId: `${token.id}->${host}@${start}~${due ?? "never"}`,
                tokenId: token.id,
                fromHostId: token.homeEntityId,
                toHostId: host,
                startBeat: start,
                dueBeat: due,
              };
              if (this.validateRow(level, state, row).ok) out.push(mk({ type: "manifest.commit", row }));
            }
          }
        }
      }
    }

    // Crew commands: per crew, per beat, against a statically folded cursor.
    const cells = new Set(level.cells.map((c) => c.id));
    const adj = new Map<string, string[]>();
    const link = (from: string, to: string) => {
      const l = adj.get(from);
      if (l) l.push(to);
      else adj.set(from, [to]);
    };
    for (const e of level.edges) {
      link(e.a, e.b);
      link(e.b, e.a);
    }
    for (const crew of level.crew) {
      let cursor = crew.cellId;
      for (let beat = 1; beat <= level.verification.horizonBeat; beat++) {
        const queued = state.commands[beat]?.[crew.id];
        const base = cursor;
        if (!queued) {
          out.push(mk({ type: "command.queue", beat, crewId: crew.id, command: { type: "wait" } }));
          for (const to of (adj.get(base) ?? []).filter((c) => cells.has(c))) {
            out.push(mk({ type: "command.queue", beat, crewId: crew.id, command: { type: "move", to } }));
            for (const prop of level.props.filter((pr) => pr.cellId === base)) {
              out.push(
                mk({ type: "command.queue", beat, crewId: crew.id, command: { type: "pickup-and-move", propId: prop.id, to } }),
              );
            }
          }
        } else {
          if ((queued.type === "move" || queued.type === "pickup-and-move") && cells.has(queued.to)) {
            cursor = queued.to;
          }
          out.push(mk({ type: "command.clear", beat, crewId: crew.id }));
        }
      }
    }

    out.push(mk({ type: "test.run", seed: "rbm01" }));
    if (state.checkpoints.length > 0) out.push(mk({ type: "history.undo" }));
    if (state.lastRun?.success) out.push(mk({ type: "result.accept" }));
    return out;
  }

  canonicalHash(_level: RbmManifest, state: RbmPlayState): string {
    const canonical = {
      rulesVersion: state.rulesVersion,
      levelId: state.levelId,
      phase: state.phase,
      accepted: state.accepted,
      manifestRows: [...state.manifestRows].sort((a, b) => a.rowId.localeCompare(b.rowId)),
      commands: state.commands,
      lastRun: state.lastRun
        ? { seed: state.lastRun.seed, finalHash: state.lastRun.finalHash, success: state.lastRun.success }
        : null,
    };
    return sha256(stableStringify(canonical));
  }

  serialize(level: RbmManifest, state: RbmPlayState): string {
    const envelope: SaveEnvelope = {
      rulesVersion: this.rulesVersion,
      levelId: level.levelId,
      checkpointHash: this.canonicalHash(level, state),
      state,
    };
    return JSON.stringify(envelope);
  }

  restore(level: RbmManifest, blob: string): RbmPlayState {
    const envelope = JSON.parse(blob) as SaveEnvelope;
    if (envelope.rulesVersion !== this.rulesVersion)
      throw new Error(`incompatible-rules-version:${envelope.rulesVersion}`);
    if (envelope.levelId !== level.levelId)
      throw new Error(`level-mismatch:${envelope.levelId}!=${level.levelId}`);
    const state = envelope.state as RbmPlayState;
    const hash = this.canonicalHash(level, state);
    if (hash !== envelope.checkpointHash)
      throw new Error("save-corrupted:checkpoint-hash-mismatch");
    return state;
  }

  // ---- replay --------------------------------------------------------------

  /** Versioned replay of the last run's committed plan (IV.5.1). */
  buildReplay(level: RbmManifest, state: RbmPlayState): Replay {
    return {
      rulesVersion: this.rulesVersion,
      levelId: level.levelId,
      seed: state.lastRun?.seed ?? "",
      actions: clone(state.history),
      finalHash: state.lastRun?.finalHash ?? "",
    };
  }

  /** Replay a recorded action log under this rules version; compare hashes. */
  verifyReplay(level: RbmManifest, replay: Replay): { ok: boolean; reason?: string } {
    if (replay.rulesVersion !== this.rulesVersion)
      return { ok: false, reason: `incompatible-rules-version:${replay.rulesVersion}` };
    if (replay.levelId !== level.levelId)
      return { ok: false, reason: "level-mismatch" };
    let state = this.createInitialState(level);
    for (const action of replay.actions as RbmAction[]) {
      const check = this.validateAction(level, state, action);
      if (!check.ok) return { ok: false, reason: `replay-action-rejected:${action.commandId}:${check.reason}` };
      state = this.applyAction(level, state, action).state;
    }
    if (!state.lastRun) return { ok: false, reason: "replay-contained-no-run" };
    return state.lastRun.finalHash === replay.finalHash
      ? { ok: true }
      : { ok: false, reason: "final-hash-mismatch" };
  }
}
