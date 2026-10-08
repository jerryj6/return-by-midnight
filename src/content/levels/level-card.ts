// Shared level-card shape for RBM content: every shipped room exports a CARD
// with the verified winning trace (beat-by-beat) and its designed counter-
// examples (each with the reason the engine is expected to refuse it).

export interface WrongApproach {
  /** Short slug used by tests and docs, e.g. "keep-forever". */
  name: string;
  /** What the mistaken player is assumed to do. */
  summary: string;
  /** The engine-visible failure the approach must produce — the RIGHT reason. */
  expectedFailure: string;
}

export interface LevelCard {
  levelId: string;
  /** One-line lesson the level teaches — the mechanic it exists to show. */
  insight?: string;
  /** The obvious-but-incomplete first approach a player will reach for. */
  naiveApproach?: string;
  /**
   * Multiplicity note: which solve class the level tolerates (committed
   * alternates, timing bands, tolerated shortcuts) — see
   * docs/LEVEL-CARD-CONVENTIONS.md §3.
   */
  solutionPolicy?: string;
  /** Beat-indexed caption list of the verified winning plan. */
  winningTraceSummary: string[];
  wrongApproaches: WrongApproach[];
  /**
   * GME-007 cooperation map: one entry per distinct contribution type the
   * level supports in co-op (four entries on designated four-person levels:
   * RBM-08/10/11/12). Optional — solo-focused rooms may omit it.
   */
  coopNote?: string[];
}
