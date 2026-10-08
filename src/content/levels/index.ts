import { RBM01 } from "./rbm01-weight-of-evidence.js";
import { RBM02, RBM02_CARD } from "./rbm02-lights-out-lights-back.js";
import { RBM03, RBM03_CARD } from "./rbm03-quiet-then-quite-loud.js";
import { RBM04, RBM04_CARD } from "./rbm04-the-traveling-owner.js";
import { RBM05, RBM05_CARD } from "./rbm05-one-light-two-jobs.js";
import { RBM06, RBM06_CARD } from "./rbm06-the-door-that-pays-you-back.js";
import { RBM07, RBM07_CARD } from "./rbm07-double-booking.js";
import { RBM08, RBM08_CARD } from "./rbm08-last-call.js";
import { RBM09, RBM09_CARD } from "./rbm09-the-moving-deposit.js";
import { RBM10, RBM10_CARD } from "./rbm10-the-quietest-exit.js";

export const LEVELS = [
  { id: "RBM-01", def: RBM01 },
  { id: "RBM-02", def: RBM02 },
  { id: "RBM-03", def: RBM03 },
  { id: "RBM-04", def: RBM04 },
  { id: "RBM-05", def: RBM05 },
  { id: "RBM-06", def: RBM06 },
  { id: "RBM-07", def: RBM07 },
  { id: "RBM-08", def: RBM08 },
  { id: "RBM-09", def: RBM09 },
  { id: "RBM-10", def: RBM10 },
] as const;

export const CARDS: Record<string, unknown> = {
  "RBM-02": RBM02_CARD,
  "RBM-03": RBM03_CARD,
  "RBM-04": RBM04_CARD,
  "RBM-05": RBM05_CARD,
  "RBM-06": RBM06_CARD,
  "RBM-07": RBM07_CARD,
  "RBM-08": RBM08_CARD,
  "RBM-09": RBM09_CARD,
  "RBM-10": RBM10_CARD,
};
