import { RBM01 } from "./rbm01-weight-of-evidence.js";
import { RBM02, RBM02_CARD } from "./rbm02-lights-out-lights-back.js";
import { RBM03, RBM03_CARD } from "./rbm03-quiet-then-quite-loud.js";
import { RBM04, RBM04_CARD } from "./rbm04-the-traveling-owner.js";

export const LEVELS = [
  { id: "RBM-01", def: RBM01 },
  { id: "RBM-02", def: RBM02 },
  { id: "RBM-03", def: RBM03 },
  { id: "RBM-04", def: RBM04 },
] as const;

export const CARDS: Record<string, unknown> = {
  "RBM-02": RBM02_CARD,
  "RBM-03": RBM03_CARD,
  "RBM-04": RBM04_CARD,
};
