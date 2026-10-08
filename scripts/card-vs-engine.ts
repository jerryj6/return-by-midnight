// scripts/card-vs-engine.ts — carded wrongApproach vs engine consistency check.
//
// For every LevelCard wrongApproach on committed levels (RBM-02..10), replays
// the approach's plan (identical construction to tests/unit/*) and checks that
// the carded `expectedFailure` text honestly describes what the engine does:
//
//   - if the plan is manifest-rejected, the produced reason must appear in the
//     carded text (drift = card names a reason the engine never produces);
//   - if the plan simulates to failure, the produced mechanism is checked and
//     the carded text must carry a keyword for it;
//   - if the plan SUCCEEDS, the carded text must contain "TOLERATED" — a
//     carded wrongApproach that wins is the silent-success class (docs/
//     GAME-DESIGN-BIBLE.md §3.5) and must be labeled, never implied to fail.
//
// Also truth-checks coopNote claims (row ownership and per-crew command
// presence are mechanical facts) and runs a delete-one minimality sweep on
// each reference plan (non-minimal traces are reported, not failed).
//
// Exit 0 = no drift. Exit 1 = at least one contradiction between card and
// engine. Warnings do not fail the check.
//
//   npx tsx scripts/card-vs-engine.ts
//
// Evidence class: AUTOMATED (scripted engine playthrough), not human playtest.
import { RbmEngine } from "../src/engine/rbm/engine.js";
import { simulate } from "../src/engine/rbm/sim.js";
import type { RbmAction } from "../src/engine/rbm/engine.js";
import type { LoanManifestRow, RbmManifest, RbmPlan, RbmSimResult } from "../src/engine/rbm/types.js";
import type { LevelCard } from "../src/content/levels/level-card.js";
import { NAMES, PREDICATE_NAMES } from "../src/client/describe.js";
import { RBM01, rbm01ReferencePlan } from "../src/content/levels/rbm01-weight-of-evidence.js";
import { RBM02, RBM02_CARD, rbm02PlanWithDue, rbm02ReferencePlan } from "../src/content/levels/rbm02-lights-out-lights-back.js";
import { RBM03, RBM03_CARD, rbm03PlanWithDue, rbm03ReferencePlan } from "../src/content/levels/rbm03-quiet-then-quite-loud.js";
import { RBM04, RBM04_CARD, rbm04PlanWithDue, rbm04ReferencePlan } from "../src/content/levels/rbm04-the-traveling-owner.js";
import { RBM05, RBM05_CARD, rbm05ReferencePlan } from "../src/content/levels/rbm05-one-light-two-jobs.js";
import { RBM06, RBM06_CARD, rbm06PlanWithDue, rbm06ReferencePlan } from "../src/content/levels/rbm06-the-door-that-pays-you-back.js";
import { RBM07, RBM07_CARD, rbm07ReferencePlan } from "../src/content/levels/rbm07-double-booking.js";
import { RBM08, RBM08_CARD, rbm08PlanWithDue, rbm08ReferencePlan } from "../src/content/levels/rbm08-last-call.js";
import { RBM09, RBM09_CARD, rbm09PlanWithAim, rbm09PlanWithDue, rbm09ReferencePlan } from "../src/content/levels/rbm09-the-moving-deposit.js";
import { RBM10, RBM10_CARD, rbm10ReferencePlan } from "../src/content/levels/rbm10-the-quietest-exit.js";

const SEED = "card-vs-engine";
const engine = new RbmEngine();

const eventsOf = (r: RbmSimResult, t: string) => r.events.filter((e) => e.type === t);
const atBeat = (r: RbmSimResult, b: number) => r.events.filter((e) => e.beat === b);
const outcome = (r: RbmSimResult, id: string) => r.evaluation.outcomes.find((o) => o.predicateId === id);
const observation = (r: RbmSimResult, id: string) => r.evaluation.observations.find((o) => o.predicateId === id);
const cellOf = (r: RbmSimResult, id: string) => r.finalState.entities[id]?.cellId;
const rejectedAt = (r: RbmSimResult, beat: number, crew: string, reason?: string) =>
  atBeat(r, beat).find((e) => e.type === "command.rejected" && e.entityId === crew && (!reason || e.data?.["reason"] === reason));
const captureAt = (r: RbmSimResult, beat: number, crew: string) =>
  atBeat(r, beat).find((e) => e.type === "guard.capture" && e.data?.["crewId"] === crew);
const captured = (r: RbmSimResult, crew: string) =>
  eventsOf(r, "guard.capture").some((e) => e.data?.["crewId"] === crew);
const sensorPowered = (r: RbmSimResult, id: string) =>
  eventsOf(r, "sensor.power").some((e) => e.entityId === id);

function validateRows(level: RbmManifest, rows: LoanManifestRow[]): string | null {
  let s = engine.createInitialState(level);
  let n = 0;
  for (const row of rows) {
    const action: RbmAction = { actorId: "check", commandId: `r-${++n}`, baseRevision: s.revision, payload: { type: "manifest.commit", row } };
    const check = engine.validateAction(level, s, action);
    if (!check.ok) return check.reason ?? "invalid";
    s = engine.applyAction(level, s, action).state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Probes. Each produces the OBSERVED mechanism; keyword lists define what the
// carded expectedFailure must contain for that mechanism to count as honestly
// described. SimProbe.check returns a mechanism slug ("" = inconclusive).
// ---------------------------------------------------------------------------
type SimProbe = { kind: "sim"; plan: () => RbmPlan; mechanism: (r: RbmSimResult) => string };
type RowProbe = { kind: "rows"; rows: () => LoanManifestRow[] };
type Probe = SimProbe | RowProbe;

// mechanism slug -> substrings the carded text must contain (any of)
const REQUIRED: Record<string, string[]> = {
  "rejects:overlapping-loan": ["overlapping"],
  "rejects:manifest-over-budget": ["over-budget"],
  "rejects:incompatible-host": ["incompatible"],
  "rejects:loan-to-own-home": ["own home", "own-home", "loan-to-own"],
  "rejects:start-beat-out-of-range": ["out-of-range", "range"],
  "fails:capture": ["capture", "captured", "patrol", "sweep"],
  "fails:gate-closed": ["gate", "door", "seal", "shut"],
  "fails:tokenHome": ["home", "return"],
  "fails:plan-complete": ["plan.complete", "incomplete", "required"],
  "fails:outcome": ["fails", "never", "dark", "unsatisfied"],
  "succeeds": ["TOLERATED", "tolerated", "shortcut"],
  "inconclusive": [],
};

const plan = (ref: () => RbmPlan, mutate: (p: RbmPlan) => void): (() => RbmPlan) => () => {
  const p = ref();
  mutate(p);
  return p;
};

const PROBES: Record<string, Record<string, Probe>> = {
  "rbm-02": {
    "keep-forever": { kind: "sim", plan: () => rbm02PlanWithDue(null), mechanism: (r) => (outcome(r, "bright-returned")?.passed === false ? "fails:tokenHome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "early-return": { kind: "sim", plan: () => rbm02PlanWithDue(4), mechanism: (r) => (r.evaluation.success ? "succeeds" : !sensorPowered(r, "sensor-vault") ? "fails:outcome" : "inconclusive") },
    "skip-the-loan": { kind: "sim", plan: plan(rbm02ReferencePlan, (p) => (p.rows = [])), mechanism: (r) => (observation(r, "plan.complete")?.passed === false ? "fails:plan-complete" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "cross-under-the-beam": { kind: "sim", plan: () => ({ rows: [rbm02ReferencePlan().rows[0]!], commands: { 2: { "crew-helper": { type: "move", to: "cell-hall" } } } }), mechanism: (r) => (captured(r, "crew-helper") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "double-booking": { kind: "rows", rows: () => { const row = rbm02ReferencePlan().rows[0]!; return [row, { ...row, rowId: "row-again", startBeat: 2, dueBeat: 4 }]; } },
  },
  "rbm-03": {
    "stationary-return": { kind: "sim", plan: () => ({ rows: [rbm03ReferencePlan().rows[0]!], commands: { 4: { "crew-operator": { type: "pickup-and-move", propId: "prop-bust", to: "cell-nursery" } }, 5: { "crew-operator": { type: "move", to: "pad-out" } } } }), mechanism: (r) => (outcome(r, "toy-posted")?.passed === false ? "fails:outcome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "loud-window": { kind: "sim", plan: () => ({ rows: [rbm03ReferencePlan().rows[0]!], commands: { 2: { "crew-helper": { type: "pickup-and-move", propId: "prop-toy", to: "cell-gallery" } } } }), mechanism: (r) => (captured(r, "crew-helper") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "keep-forever": { kind: "sim", plan: () => rbm03PlanWithDue(null), mechanism: (r) => (outcome(r, "noisy-returned")?.passed === false ? "fails:tokenHome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "missed-lift-window": { kind: "sim", plan: plan(rbm03ReferencePlan, (p) => { p.commands[5] = { "crew-helper": { type: "drop" } }; p.commands[6] = { "crew-helper": { type: "move", to: "pad-out" }, "crew-operator": { type: "move", to: "pad-out" } }; }), mechanism: (r) => (rejectedAt(r, 6, "crew-operator", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "double-booking": { kind: "rows", rows: () => { const row = rbm03ReferencePlan().rows[0]!; return [row, { ...row, rowId: "row-again", startBeat: 2, dueBeat: 4 }]; } },
  },
  "rbm-04": {
    "return-at-the-old-shelf": { kind: "sim", plan: () => rbm04PlanWithDue(2), mechanism: (r) => (eventsOf(r, "cargo.settled")[0]?.data?.["cellId"] === "cell-gallery" ? "fails:outcome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "keep-forever": { kind: "sim", plan: () => rbm04PlanWithDue(null), mechanism: (r) => (outcome(r, "heavy-returned")?.passed === false ? "fails:tokenHome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "mid-route-return": { kind: "sim", plan: () => rbm04PlanWithDue(3), mechanism: (r) => (eventsOf(r, "cargo.settled")[0]?.data?.["cellId"] === "cell-lobby" && outcome(r, "safe-vaulted")?.passed === false ? "fails:outcome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "leave-the-owner": { kind: "sim", plan: () => ({ rows: [rbm04ReferencePlan().rows[0]!], commands: { 3: { "crew-helper": { type: "move", to: "cell-lobby" } }, 4: { "crew-helper": { type: "move", to: "cell-vault" } }, 6: { "crew-helper": { type: "move", to: "pad-out" } } } }), mechanism: (r) => (cellOf(r, "prop-safe") === "cell-gallery" && outcome(r, "safe-vaulted")?.passed === false ? "fails:outcome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "manifest-over-budget": { kind: "rows", rows: () => { const first = rbm04ReferencePlan().rows[0]!; return [first, { rowId: "row-nightlamp", tokenId: "TOKEN-B", fromHostId: "prop-nightlamp", toHostId: "crew-operator", startBeat: 1, dueBeat: 4 }]; } },
    "double-booking": { kind: "rows", rows: () => { const row = rbm04ReferencePlan().rows[0]!; return [row, { ...row, rowId: "row-again", startBeat: 2, dueBeat: 5 }]; } },
  },
  "rbm-05": {
    "one-loan-two-rooms": { kind: "sim", plan: plan(rbm05ReferencePlan, (p) => (p.rows = [{ ...p.rows[0]!, dueBeat: null }])), mechanism: (r) => (outcome(r, "idol-south-out")?.passed === false ? "fails:outcome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "no-home-interval": { kind: "rows", rows: () => { const rows = rbm05ReferencePlan().rows; return [rows[0]!, { rowId: "row-rush", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-south", startBeat: 4, dueBeat: 6 }]; } },
    "door-closed-crossing": { kind: "sim", plan: plan(rbm05ReferencePlan, (p) => (p.commands = { 3: { "crew-helper": { type: "move", to: "cell-north" } }, 5: { "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" } } })), mechanism: (r) => (rejectedAt(r, 5, "crew-helper", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "early-crossing": { kind: "sim", plan: plan(rbm05ReferencePlan, (p) => (p.commands = { 2: { "crew-helper": { type: "move", to: "cell-north" } } })), mechanism: (r) => (captured(r, "crew-helper") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    // Carded text: "manifest rejected: overlapping-loan — the single token's window is
    // fully booked". Probe = the in-range third row a player would try.
    "manifest-over-budget": { kind: "rows", rows: () => { const rows = rbm05ReferencePlan().rows; return [...rows, { rowId: "row-extra", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-north", startBeat: 3, dueBeat: 4 }]; } },
  },
  "rbm-06": {
    "keep-forever": { kind: "sim", plan: () => rbm06PlanWithDue(null), mechanism: (r) => (r.evaluation.success ? "succeeds" : "fails:outcome") },
    "pay-back-too-early": { kind: "sim", plan: () => rbm06PlanWithDue(3), mechanism: (r) => (eventsOf(r, "command.rejected").some((e) => e.data?.["reason"] === "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "borrow-from-self": { kind: "rows", rows: () => [{ rowId: "self", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-safe", startBeat: 1, dueBeat: 5 }] },
    "hall-on-the-beam": { kind: "sim", plan: plan(rbm06ReferencePlan, (p) => (p.commands = { 2: { "crew-helper": { type: "move", to: "cell-hall" } } })), mechanism: (r) => (captured(r, "crew-helper") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "manifest-over-budget": { kind: "rows", rows: () => { const row = rbm06ReferencePlan().rows[0]!; return [row, { ...row, rowId: "row-two", startBeat: 6, dueBeat: null }]; } },
  },
  "rbm-07": {
    "double-booking": { kind: "rows", rows: () => { const rows = rbm07ReferencePlan().rows; return [rows[0]!, { rowId: "row-double", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 3, dueBeat: 7 }]; } },
    "monopolize-the-weight": { kind: "sim", plan: () => ({ rows: [{ rowId: "TOKEN-H->scale-vault@1~7", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 1, dueBeat: 7 }, rbm07ReferencePlan().rows[2]!], commands: { 2: { "crew-helper": { type: "move", to: "cell-north" }, "crew-operator": { type: "move", to: "cell-east" } }, 3: { "crew-operator": { type: "pickup-and-move", propId: "prop-idol-east", to: "pad-out" } }, 4: { "crew-runner": { type: "move", to: "cell-vault" } }, 5: { "crew-runner": { type: "pickup-and-move", propId: "prop-idol-vault", to: "pad-out" } } } }), mechanism: (r) => (rejectedAt(r, 2, "crew-helper", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "forget-the-jingle": { kind: "sim", plan: plan(rbm07ReferencePlan, (p) => (p.rows = p.rows.filter((r) => r.tokenId !== "TOKEN-N"))), mechanism: (r) => (observation(r, "plan.complete")?.passed === false ? "fails:plan-complete" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "vault-before-the-repost": { kind: "sim", plan: plan(rbm07ReferencePlan, (p) => (p.commands = { 4: { "crew-runner": { type: "move", to: "cell-vault" } } })), mechanism: (r) => (rejectedAt(r, 4, "crew-runner", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "early-door-rush": { kind: "sim", plan: plan(rbm07ReferencePlan, (p) => (p.commands = { 1: { "crew-helper": { type: "move", to: "cell-north" } } })), mechanism: (r) => (captureAt(r, 1, "crew-helper") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "manifest-over-budget": { kind: "rows", rows: () => { const rows = rbm07ReferencePlan().rows; const n1: LoanManifestRow = { rowId: "n-early", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 4 }; const n2: LoanManifestRow = { ...n1, rowId: "n-late", startBeat: 5, dueBeat: 7 }; return [rows[0]!, rows[1]!, n1, n2]; } },
  },
  "rbm-08": {
    "swap-the-due-beats": { kind: "sim", plan: plan(rbm08ReferencePlan, (p) => (p.rows = p.rows.map((r) => (r.tokenId === "TOKEN-B" ? { ...r, dueBeat: 3 } : r.tokenId === "TOKEN-N" ? { ...r, dueBeat: 6 } : r)))), mechanism: (r) => (rejectedAt(r, 4, "crew-runner", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "lamp-home-early": { kind: "sim", plan: () => rbm08PlanWithDue("TOKEN-B", 4), mechanism: (r) => (rejectedAt(r, 5, "crew-lookout", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "skip-the-early-return": { kind: "sim", plan: () => rbm08PlanWithDue("TOKEN-N", null), mechanism: (r) => (rejectedAt(r, 4, "crew-runner", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "entry-during-the-sweep": { kind: "sim", plan: plan(rbm08ReferencePlan, (p) => (p.commands = { 3: { "crew-helper": { type: "move", to: "cell-north" } } })), mechanism: (r) => (captured(r, "crew-helper") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "manifest-over-budget": { kind: "rows", rows: () => { const rows = rbm08ReferencePlan().rows; return [...rows, { rowId: "row-four", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-candlestick", startBeat: 7, dueBeat: null }]; } },
  },
  "rbm-09": {
    "wrong-aim": { kind: "sim", plan: () => rbm09PlanWithAim("cell-alcove"), mechanism: (r) => (!sensorPowered(r, "sensor-junction") && outcome(r, "stand-aimed")?.passed === false ? "fails:outcome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "carry-window-miss": { kind: "sim", plan: plan(rbm09ReferencePlan, (p) => (p.commands = { 3: { "crew-helper": { type: "pickup", propId: "prop-stand" } }, 4: { "crew-helper": { type: "move", to: "cell-junction" } }, 5: { "crew-helper": { type: "drop" } }, 6: { "crew-operator": { type: "move", to: "cell-dark" } } })), mechanism: (r) => (rejectedAt(r, 6, "crew-operator", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "keep-the-light-forever": { kind: "sim", plan: () => rbm09PlanWithDue(null), mechanism: (r) => (outcome(r, "bright-home")?.passed === false ? "fails:tokenHome" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "entry-during-the-sweep": { kind: "sim", plan: plan(rbm09ReferencePlan, (p) => (p.commands = { 3: { "crew-runner": { type: "move", to: "cell-loft" } } })), mechanism: (r) => (captureAt(r, 3, "crew-runner") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "overlapping-second-loan": { kind: "rows", rows: () => { const rows = rbm09ReferencePlan().rows; return [...rows, { rowId: "row-two", tokenId: "TOKEN-B", fromHostId: "prop-stand", toHostId: "prop-candlestick", startBeat: 4, dueBeat: 7 }]; } },
  },
  "rbm-10": {
    "linger-in-the-vestibule": { kind: "sim", plan: plan(rbm10ReferencePlan, (p) => (p.commands = { 1: { "crew-lookout": { type: "move", to: "pad-out" } }, 3: { "crew-lookout": { type: "move", to: "cell-foyer" } }, 4: { "crew-lookout": { type: "move", to: "cell-vestibule" } } })), mechanism: (r) => (r.events.some((e) => e.type === "guard.capture" && e.data?.["crewId"] === "crew-lookout" && e.data?.["cellId"] === "cell-vestibule") ? "fails:capture" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "bell-shut-early": { kind: "sim", plan: plan(rbm10ReferencePlan, (p) => (p.rows = p.rows.map((r) => (r.tokenId === "TOKEN-N" ? { ...r, dueBeat: 2 } : r)))), mechanism: (r) => (rejectedAt(r, 3, "crew-helper", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "never-return-the-rattle": { kind: "sim", plan: plan(rbm10ReferencePlan, (p) => (p.rows = p.rows.map((r) => (r.tokenId === "TOKEN-N" ? { ...r, dueBeat: null } : r)))), mechanism: (r) => (rejectedAt(r, 6, "crew-runner", "gate-closed") ? "fails:gate-closed" : r.evaluation.success ? "succeeds" : "fails:outcome") },
    "borrower-mismatch": { kind: "rows", rows: () => [{ rowId: "mismatch", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-decoy", startBeat: 1, dueBeat: 5 }] },
    "manifest-over-budget": { kind: "rows", rows: () => { const rows = rbm10ReferencePlan().rows; return [...rows, { rowId: "row-three", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 6, dueBeat: null }]; } },
  },
};

const REFS: [RbmManifest, () => RbmPlan][] = [
  [RBM01, rbm01ReferencePlan],
  [RBM02, rbm02ReferencePlan],
  [RBM03, rbm03ReferencePlan],
  [RBM04, rbm04ReferencePlan],
  [RBM05, rbm05ReferencePlan],
  [RBM06, rbm06ReferencePlan],
  [RBM07, rbm07ReferencePlan],
  [RBM08, rbm08ReferencePlan],
  [RBM09, rbm09ReferencePlan],
  [RBM10, rbm10ReferencePlan],
];

const CARDED: [RbmManifest, LevelCard][] = [
  [RBM02, RBM02_CARD], [RBM03, RBM03_CARD], [RBM04, RBM04_CARD], [RBM05, RBM05_CARD],
  [RBM06, RBM06_CARD], [RBM07, RBM07_CARD], [RBM08, RBM08_CARD], [RBM09, RBM09_CARD],
  [RBM10, RBM10_CARD],
];

let fails = 0;
let warns = 0;
let probed = 0;
let unprobed = 0;

// --- 1. Reference traces still win (sanity anchor for the probes below)
for (const [level, ref] of REFS) {
  const r = simulate(level, ref(), SEED);
  if (!r.evaluation.success) { console.error(`DRIFT ${level.levelId}: committed reference trace no longer wins`); fails++; }
}

// --- 2. Every carded wrongApproach: replay -> observed mechanism -> text check
for (const [level, card] of CARDED) {
  const probes = PROBES[level.levelId] ?? {};
  for (const wa of card.wrongApproaches) {
    const probe = probes[wa.name];
    if (!probe) {
      console.log(`NOTE  ${level.levelId} / ${wa.name}: no probe registered — carded text not verifiable by this script`);
      unprobed++;
      continue;
    }
    probed++;
    let mechanism: string;
    if (probe.kind === "rows") {
      mechanism = `rejects:${validateRows(level, probe.rows()) ?? "committed-all"}`;
    } else {
      mechanism = probe.mechanism(simulate(level, probe.plan(), SEED));
    }
    const text = wa.expectedFailure.toLowerCase();
    const needs = REQUIRED[mechanism] ?? [];
    const ok = needs.length === 0 || needs.some((k) => text.includes(k.toLowerCase()));
    if (!ok) {
      console.error(`DRIFT ${level.levelId} / ${wa.name}: engine produced "${mechanism}" but carded expectedFailure says "${wa.expectedFailure}"`);
      fails++;
    } else {
      console.log(`ok    ${level.levelId} / ${wa.name}: ${mechanism}`);
    }
  }
}

// --- 3. coopNote truth-check: contribution types are mechanical facts
// Claims checked: every carded coopNote entry that names a manifest owner must
// correspond to actual committed rows; "operator/warden" entries imply the
// referenced crew member issues ≥1 command in the verified plan.
for (const [level, card] of CARDED) {
  if (!card.coopNote) continue;
  const ref = REFS.find(([l]) => l.levelId === level.levelId)?.[1];
  if (!ref) continue;
  const p = ref();
  const crewWithCommands = new Set<string>();
  for (const beatCmds of Object.values(p.commands)) for (const c of Object.keys(beatCmds)) crewWithCommands.add(c);
  const manifestRoles = card.coopNote.filter((n) => /manifest owner/i.test(n)).length;
  if (manifestRoles > p.rows.length) {
    console.log(`WARN  ${level.levelId}: coopNote names ${manifestRoles} manifest owners but the plan commits ${p.rows.length} rows`);
    warns++;
  }
  const crewIds = level.crew.map((c) => c.id);
  const idle = crewIds.filter((c) => !crewWithCommands.has(c));
  const operatorClaims = card.coopNote.filter((n) => /operator|warden|pilot/i.test(n)).length;
  if (operatorClaims > 0 && crewIds.length > 1 && idle.length === crewIds.length) {
    console.log(`WARN  ${level.levelId}: coopNote claims operator/warden roles but no crew member issues a command`);
    warns++;
  }
  console.log(`ok    ${level.levelId}: coopNote ${card.coopNote.length} roles vs ${p.rows.length} rows, ${crewWithCommands.size}/${crewIds.length} crew commanded`);

  // Deep-check (refine-2): every coopNote role must be load-bearing, not
  // make-work. Dropping any manifest row or any crew member's entire command
  // set must fail the run — a role the plan can complete without is degenerate.
  for (let i = 0; i < p.rows.length; i++) {
    const cut: RbmPlan = { rows: p.rows.filter((_, j) => j !== i), commands: JSON.parse(JSON.stringify(p.commands)) as RbmPlan["commands"] };
    if (simulate(level, cut, SEED).evaluation.success) {
      console.log(`FAIL  ${level.levelId}: coopNote degenerate — dropping row[${i}] ${p.rows[i]!.rowId} still completes`);
      fails++;
    }
  }
  for (const crew of crewWithCommands) {
    const cmds = JSON.parse(JSON.stringify(p.commands)) as RbmPlan["commands"];
    for (const b of Object.keys(cmds)) delete cmds[Number(b)]![crew];
    if (simulate(level, { rows: p.rows, commands: cmds }, SEED).evaluation.success) {
      console.log(`FAIL  ${level.levelId}: coopNote degenerate — ${crew} contributes nothing`);
      fails++;
    }
  }
}

// --- 4. Delete-one-command minimality sweep (warning class — never fails)
for (const [level, ref] of REFS) {
  const p = ref();
  for (const [beatStr, cmds] of Object.entries(p.commands)) {
    for (const crewId of Object.keys(cmds)) {
      const cut: RbmPlan = { rows: p.rows.map((r) => ({ ...r })), commands: { ...p.commands } };
      const cmdsCopy = { ...(cmds as Record<string, (typeof cmds)[string]>) };
      delete cmdsCopy[crewId];
      cut.commands = { ...p.commands, [Number(beatStr)]: cmdsCopy };
      if (Object.keys(cmdsCopy).length === 0) delete cut.commands[Number(beatStr)];
      const r = simulate(level, cut, SEED);
      if (r.evaluation.success) {
        console.log(`WARN  ${level.levelId}: dropping ${crewId}@${beatStr} still completes — reference trace non-minimal`);
        warns++;
      }
    }
  }
}

// --- 5. UI text coverage: every predicate + named-rendered id must have a
// display name in describe.ts (the failed-run verdict and the inspector show
// these; a missing entry leaks the raw slug to players).
{
  const LEVELS_ALL = REFS.map(([l]) => l);
  const missing: string[] = [];
  if (!("plan.complete" in PREDICATE_NAMES)) missing.push("shared: predicate plan.complete");
  for (const level of LEVELS_ALL) {
    for (const p of level.outcomes) {
      if (!(p.id in PREDICATE_NAMES)) missing.push(`${level.levelId}:predicate ${p.id}`);
    }
    const idFields: string[] = [];
    for (const e of [...level.cells, ...level.props, ...level.crew, ...level.guards, ...level.devices]) idFields.push(e.id);
    for (const edge of level.edges) { idFields.push(edge.a, edge.b); if (edge.gateId) idFields.push(edge.gateId); }
    for (const t of level.tokens) { idFields.push(t.id, t.homeEntityId); }
    for (const o of level.outcomes) {
      if ("entityId" in o) idFields.push(o.entityId);
      if ("cellId" in o) idFields.push(o.cellId);
      if ("tokenId" in o) idFields.push(o.tokenId);
      if ("region" in o) idFields.push(o.region);
    }
    for (const id of new Set(idFields)) {
      if (!(id in NAMES)) missing.push(`${level.levelId}:id ${id}`);
    }
  }
  if (missing.length) {
    for (const m of missing) console.log(`FAIL  unnamed id rendered raw in UI — ${m}`);
    fails += missing.length;
  } else {
    console.log(`ok    UI text coverage: all predicates + entities named`);
  }
}

console.log(`\ncard-vs-engine: ${probed} carded approaches probed, ${unprobed} unprobed, ${warns} warnings`);
if (fails > 0) {
  console.error(`RESULT: FAIL — ${fails} card↔engine contradiction(s)`);
  process.exit(1);
}
console.log("RESULT: PASS — no card↔engine drift");
process.exit(0);
