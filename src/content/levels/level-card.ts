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
  /** Beat-indexed caption list of the verified winning plan. */
  winningTraceSummary: string[];
  wrongApproaches: WrongApproach[];
}
