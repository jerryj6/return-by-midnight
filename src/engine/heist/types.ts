/** Return by Midnight — simultaneous-turn heist engine: shared types.
 *  Pure data. See docs/HEIST-RULES.md for the authoritative resolution order. */

export type Prop = "HEAVY" | "BRIGHT" | "NOISY";
export type Dir = "N" | "E" | "S" | "W";
export interface Pos { x: number; y: number }

/** Tile legend for LevelDef.tiles rows:
 *  '#' wall · '.' floor · ':' dark floor · 'E' exit (floor) · 'P' pressure plate (floor)
 *  'D' door (passable only while open) · ' ' void (outside the museum, impassable, not drawn) */
export type TileChar = "#" | "." | ":" | "E" | "P" | "D" | " ";

export type ObjectKind = "crate" | "safe" | "lamp" | "toy" | "musicBox" | "plinth";
export type CrewLook = "blue" | "red" | "teal" | "yellow";

export interface LevelCrew { id: string; name: string; look: CrewLook; x: number; y: number }
export interface RouteStep { x: number; y: number; face?: Dir }
export interface LevelGuard {
  id: string; name: string;
  /** Closed loop of tiles; consecutive entries (and last→first) are equal or orthogonally adjacent.
   *  A repeated entry is a pause; `face` sets the facing while standing there. */
  route: RouteStep[];
  startIndex: number;
  /** Tiles advanced per turn (1–3). */
  speed: number;
  /** Forward reach of the vision cone in tiles. */
  sight: number;
  /** Manhattan radius within which a NOISY object draws this guard. */
  hearing: number;
  facing: Dir;
}
export interface LevelObject { id: string; kind: ObjectKind; name: string; x: number; y: number }
export interface LevelToken {
  id: string; prop: Prop;
  /** Object that owns this property at rest. */
  home: string;
  /** Turns a loan lasts: borrowed on turn t, it snaps home at the start of turn t + duration. */
  duration: number;
}
export interface LevelDoor { id: string; x: number; y: number; plates: Pos[] }
export interface LevelPrize { id: string; name: string; x: number; y: number }

export interface LevelDef {
  id: string;            // "L1" | "L2" | "L3" …
  title: string;         // player-facing
  intro: string;         // one or two player-facing sentences
  tiles: string[];       // rows, all the same length
  /** Last playable turn. Turn numbers run 1..midnight. */
  midnight: number;
  crew: LevelCrew[];
  guards: LevelGuard[];
  objects: LevelObject[];
  tokens: LevelToken[];
  doors: LevelDoor[];
  prize?: LevelPrize;
  /** Player-facing tips, shown one at a time on request. */
  tips: string[];
}

export interface PlanLoan { tokenId: string; targetId: string }
export interface CrewPlan {
  /** Up to 3 tiles; path[0] is orthogonally adjacent to the crew's current tile. Empty = stay. */
  path: Pos[];
  loan?: PlanLoan;
}
export type Plans = Record<string, CrewPlan>; // crewId → plan; missing crew = stay, no loan

export interface CrewState { id: string; x: number; y: number }
export type GuardMode = "patrol" | "investigate" | "return";
export interface GuardState { id: string; x: number; y: number; facing: Dir; routeIndex: number; mode: GuardMode; noiseTarget: string | null }
export interface TokenState { id: string; prop: Prop; at: string; dueTurn: number | null }

export type FailReason = "seen" | "shutIn" | "midnight" | "loanNotHome";
export type Outcome =
  | { result: "won"; turn: number }
  | { result: "failed"; reason: FailReason; turn: number; step: number; crewId?: string; guardId?: string; tokenIds?: string[] };

export interface HeistState {
  levelId: string;
  /** The turn about to be planned/resolved (1-based). */
  turn: number;
  crew: CrewState[];
  guards: GuardState[];
  tokens: TokenState[];
  doorsOpen: Record<string, boolean>;
  prizeHolder: string | null;
  outcome: Outcome | null;
}

export interface GuardPose { x: number; y: number; facing: Dir }
export interface GuardIntent {
  guardId: string;
  mode: GuardMode;
  /** poses[k] = pose after step k, k = 0..3 (poses[0] = pose after turning at step 0). */
  poses: GuardPose[];
  noiseTarget: string | null;
}

export type TurnEvent =
  | { type: "loan.returned"; tokenId: string; from: string; to: string }
  | { type: "loan.made"; tokenId: string; crewId: string; from: string; to: string; dueTurn: number }
  | { type: "loan.fizzled"; tokenId: string; crewId: string; why: "notHome" | "notAdjacent" | "badTarget" }
  | { type: "door.opened" | "door.closed"; doorId: string }
  | { type: "guard.heard"; guardId: string; objectId: string }
  | { type: "crew.blocked"; crewId: string; at: Pos }
  | { type: "prize.taken"; crewId: string; prizeId: string }
  | { type: "crew.seen"; crewId: string; guardId: string }
  | { type: "crew.shutIn"; crewId: string; doorId: string };

export interface TurnStep {
  /** 0 = after returns/loans/doors, before anyone moves; 1..3 = after each movement step. */
  k: number;
  crew: CrewState[];
  guards: GuardPose[];   // same order as state.guards
  events: TurnEvent[];
}
export interface TurnTimeline {
  turn: number;
  intents: GuardIntent[];
  steps: TurnStep[];      // k = 0..3, truncated at the step where the heist ends
  outcome: Outcome | null;
}

export type PlanCheck = { ok: true } | { ok: false; reason: string };
