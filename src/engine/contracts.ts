// Shared deterministic engine contract (all three games).
export type RULES_VERSION = string;
export type EntityId = string;
export type Beat = number;
export type Revision = number;
export interface ProposedAction { actorId: string; commandId: string; baseRevision: Revision; payload: unknown; }
export interface CommittedAction extends ProposedAction { revision: Revision; }
export interface GameEvent { beat: Beat; phase: string; type: string; entityId?: EntityId; data?: Record<string, unknown>; }
export interface PredicateResult { predicateId: string; passed: boolean; detail?: string; }
export interface RunEvaluation { success: boolean; allObservationsPass: boolean; allOutcomesPass: boolean; observations: PredicateResult[]; outcomes: PredicateResult[]; }
export interface Replay { rulesVersion: RULES_VERSION; levelId: string; seed: string; actions: CommittedAction[]; finalHash: string; }
export interface SaveEnvelope { rulesVersion: RULES_VERSION; levelId: string; checkpointHash: string; state: unknown; }
export interface ApplyResult<S> { state: S; events: GameEvent[]; }
export interface DeterministicEngine<L, S, A> {
  createInitialState(level: L): S;
  getLegalActions(level: L, state: S): A[];
  validateAction(level: L, state: S, action: A): { ok: boolean; reason?: string };
  applyAction(level: L, state: S, action: A): ApplyResult<S>;
  canonicalHash(level: L, state: S): string;
  serialize(level: L, state: S): string;
  restore(level: L, blob: string): S;
}
