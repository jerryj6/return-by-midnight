// Undo/replay determinism soak (AUTOMATED): per level, build the winning
// plan through applyAction (commit rows, queue orders sorted by beat),
// recording canonicalHash at every prefix. Then undo K ∈ {1, 3, all},
// re-apply the popped payloads, and assert the hash returns to the recorded
// value — plus a divergence check (undo → different action → hash changes,
// manifest stays stable).
import { RbmEngine, type RbmAction, type RbmActionPayload } from "../src/engine/rbm/engine.js";
import type { RbmManifest, RbmPlan } from "../src/engine/rbm/types.js";
import { RBM01, rbm01ReferencePlan } from "../src/content/levels/rbm01-weight-of-evidence.js";
import { RBM02, rbm02ReferencePlan } from "../src/content/levels/rbm02-lights-out-lights-back.js";
import { RBM03, rbm03ReferencePlan } from "../src/content/levels/rbm03-quiet-then-quite-loud.js";
import { RBM04, rbm04ReferencePlan } from "../src/content/levels/rbm04-the-traveling-owner.js";
import { RBM05, rbm05ReferencePlan } from "../src/content/levels/rbm05-one-light-two-jobs.js";
import { RBM06, rbm06ReferencePlan } from "../src/content/levels/rbm06-the-door-that-pays-you-back.js";
import { RBM07, rbm07ReferencePlan } from "../src/content/levels/rbm07-double-booking.js";
import { RBM08, rbm08ReferencePlan } from "../src/content/levels/rbm08-last-call.js";
import { RBM09, rbm09ReferencePlan } from "../src/content/levels/rbm09-the-moving-deposit.js";
import { RBM10, rbm10ReferencePlan } from "../src/content/levels/rbm10-the-quietest-exit.js";
import { RBM11, rbm11ReferencePlan } from "../src/content/levels/rbm11-night-shift.js";
import { RBM12, rbm12ReferencePlan } from "../src/content/levels/rbm12-midnight-returns.js";

const engine = new RbmEngine();
let seq = 0;

function apply(level: RbmManifest, s: any, payload: RbmActionPayload): any {
  const action: RbmAction = {
    actorId: "soak",
    commandId: `soak-${++seq}`,
    baseRevision: s.revision,
    payload,
  };
  const res = engine.applyAction(level, s, action);
  return res.state;
}

function planActions(plan: RbmPlan): RbmActionPayload[] {
  const out: RbmActionPayload[] = [];
  for (const r of plan.rows) out.push({ type: "manifest.commit", row: r });
  const beats = Object.keys(plan.commands).map(Number).sort((a, b) => a - b);
  for (const b of beats) {
    for (const [crewId, command] of Object.entries(plan.commands[b] ?? {})) {
      out.push({ type: "command.queue", beat: b, crewId, command });
    }
  }
  return out;
}

function soak(level: RbmManifest, plan: RbmPlan): string {
  const log: string[] = [];
  const payloads = planActions(plan);
  const states: any[] = [engine.createInitialState(level)];
  const hashes: string[] = [engine.canonicalHash(level, states[0])];
  for (const p of payloads) {
    states.push(apply(level, states[states.length - 1], p));
    hashes.push(engine.canonicalHash(level, states[states.length - 1]));
  }
  const n = payloads.length;
  const undo: RbmActionPayload = { type: "history.undo" };

  function check(k: number): string {
    // Rebuild to prefix n-k by replaying recorded payloads — undo semantics
    // pop LIFO checkpoints, so k undos should land exactly at prefix n-k.
    let s = states[n];
    for (let i = 0; i < k; i++) s = apply(level, s, undo);
    const hUndo = engine.canonicalHash(level, s);
    if (hUndo !== hashes[n - k]) return `FAIL undo-${k}: hash ${hUndo} != prefix ${hashes[n - k]}`;
    if (s.manifestRows.length !== states[n - k].manifestRows.length) return `FAIL undo-${k}: manifest row count drifted`;
    // Re-apply the k popped payloads — must restore the tip hash.
    for (let i = n - k; i < n; i++) s = apply(level, s, payloads[i]!);
    const hRedo = engine.canonicalHash(level, s);
    if (hRedo !== hashes[n]) return `FAIL redo-${k}: hash ${hRedo} != tip ${hashes[n]}`;
    return `undo-${k}+redo ✓`;
  }

  log.push(check(1));
  if (n >= 4) log.push(check(3));
  log.push(check(n));

  // Divergence: undo 1, apply a different-but-legal payload, hash must change
  // while the manifest stays put.
  let s = states[n];
  s = apply(level, s, undo);
  const s2 = apply(level, s, { type: "plan.reset" });
  const hDiv = engine.canonicalHash(level, s2);
  log.push(hDiv !== hashes[n - 1] && s2.manifestRows.length === 0 ? "diverge-on-reset ✓ (hash changes, manifest cleared)" : `WARN diverge: hash ${hDiv === hashes[n - 1] ? "same" : "changed"}, rows=${s2.manifestRows.length}`);
  return `${level.levelId}: ${n} actions | ${log.join(" | ")}`;
}

const levels: [RbmManifest, RbmPlan][] = [
  [RBM01, rbm01ReferencePlan()],
  [RBM02, rbm02ReferencePlan()],
  [RBM03, rbm03ReferencePlan()],
  [RBM04, rbm04ReferencePlan()],
  [RBM05, rbm05ReferencePlan()],
  [RBM06, rbm06ReferencePlan()],
  [RBM07, rbm07ReferencePlan()],
  [RBM08, rbm08ReferencePlan()],
  [RBM09, rbm09ReferencePlan()],
  [RBM10, rbm10ReferencePlan()],
  [RBM11, rbm11ReferencePlan()],
  [RBM12, rbm12ReferencePlan()],
];

let fails = 0;
for (const [lvl, plan] of levels) {
  const line = soak(lvl, plan);
  if (line.includes("FAIL") || line.includes("WARN")) fails++;
  console.log(line);
}
console.log(fails === 0 ? "RESULT: PASS — undo+replay deterministic on all 12" : `RESULT: ${fails} level(s) with findings`);
