// Hint ladders keyed by levelId (GME-009: failing relationship → relevant
// tool → partial move; the full solution stays a separate, labeled choice).

export interface HintLadderContent {
  tiers: string[];
  solution?: { caption: string; lines: string[] };
}

export const RBM_HINTS: Record<string, HintLadderContent> = {
  "rbm-01": {
    tiers: [
      "The crate alone is too light for the plate — the exit stays shut while it weighs only 1. Find a way to lend the plate some extra mass.",
      "HEAVY can live somewhere else for exactly the beats you schedule. The exit gate only holds while the plate stays pressed — and the safe is only portable while it is light.",
      "The custodian reaches the watch square on beat 4, and his sight crosses the doorway only while the exit is open. If HEAVY is due at the end of beat 3, the gate closes behind you before he arrives.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Loan HEAVY from the safe to the crate: starts beat 1, due end of beat 3.",
        "Beat 2 — the carrier takes the safe to the doorway approach.",
        "Beat 3 — the carrier moves through the open exit to the pad.",
        "HEAVY returns at the end of beat 3; the crate releases the plate and the gate closes before the guard's beat-4 watch. Run the plan, then accept it.",
      ],
    },
  },
};
