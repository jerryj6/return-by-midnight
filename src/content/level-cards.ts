/**
 * level-cards.ts — complete LevelCard map for the campaign, including
 * RBM-01 whose canonical upstream file has no card export. Mirrors the
 * TRS verification pattern: suites read this, not the per-file exports.
 */
import { CARDS } from "./levels/index.js";
import type { LevelCard } from "./levels/level-card.js";

const RBM01_CARD: LevelCard = {
  levelId: "RBM-01",
  winningTraceSummary: [
    "Beat 1 — loan HEAVY from the safe to the crate (start 1, due 3): the safe's plate releases and the lobby gate opens.",
    "Beat 2 — the helper carries the safe across the approach while the hall beam is away.",
    "Beat 3 — she reaches the pad; the loan settles and the weight returns home behind her.",
  ],
  wrongApproaches: [
    {
      name: "keep-forever",
      summary: "Sign the loan with no due beat — the crate keeps the weight and the door stays locked to the ledger.",
      expectedFailure: "the `tokenHome` outcome fails: HEAVY never returns to the safe.",
    },
    {
      name: "early-crossing",
      summary: "Send the helper through the hall during beats 1–2 while the east beam still sweeps it.",
      expectedFailure: "a `capture` event / `noCapture` outcome fails at the pre-move scan.",
    },
  ],
};

export const LEVEL_CARDS: Record<string, LevelCard> = {
  ...(CARDS as Record<string, LevelCard>),
  "RBM-01": RBM01_CARD,
};
