import { HEIST_LEVELS, SOLUTIONS } from "../src/content/heist/levels.js";
import { createInitialState, resolveTurn } from "../src/engine/heist/engine.js";

// Replays every authored solution and asserts it wins. This is check:content.

let fail = false;
for (const l of HEIST_LEVELS) {
  const sol = SOLUTIONS[l.id];
  if (!sol) { console.error(`${l.id}: no SOLUTIONS entry`); fail = true; continue; }
  let s = createInitialState(l);
  let turn = 0;
  for (const plans of sol) {
    const r = resolveTurn(l, s, plans);
    s = r.state;
    turn++;
    if (s.outcome !== null) break;
  }
  if (s.outcome?.result === "won") {
    console.log(`${l.id} ${l.title}: WON in ${turn} turns`);
  } else {
    const why = s.outcome?.result === "failed" ? s.outcome.reason : "still playing";
    console.error(`${l.id} ${l.title}: solution FAILS — ${why} on turn ${turn}`);
    fail = true;
  }
}
process.exit(fail ? 1 : 0);
