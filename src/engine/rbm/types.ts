// Return by Midnight — type vocabulary.
// Source: DEVIN-CLOUD-MASTER-HANDOFF.md, sections RBM-A..F (esp. RBM-001..012,
// RBM-C "The Weight of Evidence") and IV.5. Terminology follows the master.
import type { Beat, EntityId, GameEvent, RunEvaluation } from "../contracts";

export const RBM_RULES_VERSION = "rbm-rules/1.0.0";

/**
 * Conserved property vocabulary (master RBM-A, dossier property table).
 * FLOATING is explicitly excluded from required production scope (RBM-D note).
 */
export type PropertyType = "HEAVY" | "BRIGHT" | "NOISY";

/**
 * Token lifecycle states. The master fixes the physical facts (RBM-001/002);
 * the names below are the engine's state-machine vocabulary:
 * - home:      hosted by its home entity, never lent in this run.
 * - staged:    a committed manifest row exists whose startBeat has not arrived.
 * - held:      on loan, hosted by a non-home borrower entity.
 * - returned:  back at its home entity after at least one completed loan.
 *              A returned token may legally be re-loaned (RBM-05) — only
 *              onward lending from a non-home host is forbidden (RBM-002).
 * - converted: reserved for content that permanently transforms a property
 *              into another device state; unused by RBM-01 and the core three.
 */
export type TokenStatus = "home" | "staged" | "held" | "returned" | "converted";

/** A cell is a named logical location; routes are logical, never pixel-derived (RBM-007). */
export type RegionId = "inside" | "outside";

export interface RbmCell {
  id: EntityId;
  region: RegionId;
  /** Permanent cover: occupants are never inside a detection region (RBM-C operator). */
  cover?: boolean;
  /** Explicit narrow occupancy cap; absent = uncapped (RBM-010 keeps bodies non-blocking). */
  capacity?: number;
}

/** A traversable adjacency. A `gateId` edge is passable only while that gate is open. */
export interface RbmEdge {
  a: EntityId;
  b: EntityId;
  gateId?: EntityId;
}

/** Effect payload a property contributes while hosted. HEAVY adds declared mass (RBM-004). */
export interface PropertyEffects {
  /** Declared mass contribution while the token is hosted by an entity (HEAVY = 2 in RBM-01). */
  mass?: number;
  /** BRIGHT: radius/beam cells contributed by current host (RBM-005). Reserved for later rooms. */
  lightCells?: EntityId[];
  /** NOISY: whether host movement/activation emits a sound event (RBM-006). */
  emitsSound?: boolean;
}

export interface RbmTokenDef {
  id: EntityId;
  property: PropertyType;
  /** Immutable home identity; persists if the home entity itself moves (RBM-001). */
  homeEntityId: EntityId;
  effects: PropertyEffects;
}

export interface RbmPropDef {
  kind: "prop";
  id: EntityId;
  cellId: EntityId;
  baseMass: number;
  /** Which property types this entity can borrow (RBM-002 compatibility). */
  accepts: PropertyType[];
  /** Device id this prop physically rests on (e.g. a pressure plate). Resting
   *  is an authored relationship — a prop merely standing in the same cell
   *  does not press the plate. Carried cargo never rests. */
  restingOn?: EntityId;
}

export interface RbmCrewDef {
  kind: "crew";
  id: EntityId;
  cellId: EntityId;
  /** Maximum cargo mass this member may carry (RBM-004: carrier limit 1). */
  massLimit: number;
  /** Property types this member may temporarily host (default: none). */
  accepts?: PropertyType[];
}

/** One scheduled patrol post for a beat (RBM-007: finite, inspectable patrol). */
export interface RbmPatrolStep {
  beat: Beat;
  cellId: EntityId;
  facing?: string;
}

/**
 * One detection ray: ordered segments evaluated from the guard's post outward.
 * A segment is lit only while every gate in `gatedBy` is open; a blocked
 * segment darkens every later segment (the closed exit is opaque, RBM-C).
 */
export interface RbmRaySegment {
  cells: EntityId[];
  gatedBy?: EntityId[];
}

export interface RbmRaySpec {
  id: string;
  segments: RbmRaySegment[];
}

export interface RbmGuardDef {
  kind: "guard";
  id: EntityId;
  patrol: RbmPatrolStep[];
  /** Rays active while the guard occupies the keyed post cell. */
  rays: Record<EntityId, RbmRaySpec[]>;
}

export type RbmEntityDef = RbmPropDef | RbmCrewDef | RbmGuardDef;

/**
 * Machinery devices. `paused`/`disabled` tags are temporary world states
 * (e.g. a jammed plate): bounded to <= MAX_MACHINERY_TAG_BEATS beats and
 * validated at author time, so machinery cannot be frozen forever.
 */
export const MAX_MACHINERY_TAG_BEATS = 3;

export interface MachineryTag {
  kind: "paused" | "disabled";
  /** Beat on which the tag was applied. */
  appliedBeat: Beat;
  /** Remaining active beats; must satisfy duration <= MAX_MACHINERY_TAG_BEATS. */
  beatsRemaining: number;
}

export interface RbmPressurePlateDef {
  kind: "pressure-plate";
  id: EntityId;
  /** The cell whose total resting mass is measured. */
  cellId: EntityId;
  /** Pressed while mass resting on this plate >= threshold (RBM-004: threshold 3). */
  threshold: number;
  /** Device effects: `whenPressed` applies while pressed; the inverse applies
   *  on release (a gate told to 'open' on press closes on release). */
  targets: { deviceId: EntityId; whenPressed: "open" | "close" }[];
  tags?: MachineryTag[];
}

export interface RbmGateDef {
  kind: "gate";
  id: EntityId;
  /** Open state before any plate influence settles. */
  initiallyOpen: boolean;
  tags?: MachineryTag[];
}

/** BRIGHT-driven sensor placeholder for later rooms (RBM-005). */
export interface RbmSensorDef {
  kind: "sensor";
  id: EntityId;
  cellId: EntityId;
  requiresProperty: PropertyType;
  tags?: MachineryTag[];
}

export type RbmDeviceDef = RbmPressurePlateDef | RbmGateDef | RbmSensorDef;

/**
 * A loan manifest row is the player-authored unit of borrowing (RBM-002):
 * a token leaves its home entity for a compatible borrower at startBeat and
 * returns at the end of dueBeat. `dueBeat: null` is the finite "keep forever"
 * choice where a level exposes it — it schedules no return.
 */
export interface LoanManifestRow {
  rowId: string;
  tokenId: EntityId;
  /** Must equal the token's homeEntityId — loans start only from home. */
  fromHostId: EntityId;
  toHostId: EntityId;
  /** Beat at whose phase 1 the token transfers to the borrower. */
  startBeat: Beat;
  /** Beat at whose end (phase 4) the token returns. null = permanent. */
  dueBeat: Beat | null;
}

export interface RbmLoanRules {
  /** Over-budget enforcement: at most this many committed rows. */
  maxRows: number;
  /** Finite visible return choices (RBM-002); null = "keep forever" option. */
  legalDueBeats: (Beat | null)[];
  /** Under-budget enforcement: tokens that must appear in the manifest. */
  requiredTokens: EntityId[];
}

export type RbmOutcomePredicate =
  | { id: string; kind: "entityAt"; entityId: EntityId; cellId: EntityId }
  | { id: string; kind: "entityInRegion"; entityId: EntityId; region: RegionId }
  | { id: string; kind: "tokenHome"; tokenId: EntityId }
  /** No crew member may be captured during the whole run. */
  | { id: string; kind: "noCapture" };

/**
 * Verification is declared per level (RBM-012). `horizonBeat` is both the last
 * simulated beat and the end-of-beat point at which outcomes are evaluated;
 * reaching a cell earlier is only provisional extraction.
 */
export interface RbmVerification {
  horizonBeat: Beat;
}

export interface RbmManifest {
  levelId: string;
  rulesVersion: string;
  title: string;
  cells: RbmCell[];
  edges: RbmEdge[];
  props: RbmPropDef[];
  crew: RbmCrewDef[];
  guards: RbmGuardDef[];
  tokens: RbmTokenDef[];
  devices: RbmDeviceDef[];
  loans: RbmLoanRules;
  outcomes: RbmOutcomePredicate[];
  verification: RbmVerification;
}

// ------------------------- commands & plans -------------------------

/** Crew commands resolved during phase 2 (crew movement). `wait` is the idle default (RBM-010). */
export type RbmCrewCommand =
  | { type: "wait" }
  | { type: "move"; to: EntityId }
  | { type: "pickup"; propId: EntityId }
  | { type: "drop" }
  /** Documented combined pickup-and-move (RBM-C): take reachable portable cargo, then move. */
  | { type: "pickup-and-move"; propId: EntityId; to: EntityId };

/** A full player plan: committed manifest rows plus per-beat crew commands. */
export interface RbmPlan {
  rows: LoanManifestRow[];
  /** Sparse map beat -> crewId -> command; missing entries auto-wait. */
  commands: Record<number, Record<string, RbmCrewCommand>>;
}

// ------------------------- simulation state -------------------------

export interface RbmEntityState {
  id: EntityId;
  kind: "prop" | "crew" | "guard";
  cellId: EntityId;
  /** Crew only: currently carried prop. */
  cargoId?: EntityId | null;
  captured?: boolean;
}

export interface RbmLoanState {
  rowId: string;
  dueBeat: Beat | null;
}

export interface RbmTokenState {
  id: EntityId;
  status: TokenStatus;
  /** Entity currently hosting the token; exactly one at all times (RBM-001). */
  hostEntityId: EntityId;
  loan?: RbmLoanState;
  /** Count of completed loans, for `returned` vs `home` distinction. */
  completedLoans: number;
}

export interface RbmDeviceState {
  id: EntityId;
  kind: RbmDeviceDef["kind"];
  pressed?: boolean;
  open?: boolean;
  powered?: boolean;
  tags: MachineryTag[];
}

export interface RbmSimState {
  beat: Beat;
  entities: Record<EntityId, RbmEntityState>;
  tokens: Record<EntityId, RbmTokenState>;
  devices: Record<EntityId, RbmDeviceState>;
}

export interface RbmBeatSnapshot {
  beat: Beat;
  hash: string;
  state: RbmSimState;
}

export interface RbmSimResult {
  events: GameEvent[];
  /** Snapshot at end of each beat (index 0 = initial state before beat 1). */
  timeline: RbmBeatSnapshot[];
  evaluation: RunEvaluation;
  finalState: RbmSimState;
  finalHash: string;
}
