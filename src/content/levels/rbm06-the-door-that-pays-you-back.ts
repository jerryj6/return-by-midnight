// RBM-06 "The Door That Pays You Back" — second room of chapter 2
// (master §II RBM-D). Composition lesson: ONE return changes two useful
// devices; a teammate's route depends on the return.
//
// The HEAVY safe's weight is posted to the weighing crate: while the crate
// hosts it, the lock plate presses — the store room opens AND the exit slams
// (the loan's price). When the weight comes home, the safe's alarm plate
// presses (the vault opens — the anchor) AND the lock plate releases (the
// exit reopens — the payback). One return, two fixtures; the operator's
// vault route exists only because the return happened.
//
// Engine-grammar notes (frozen semantics):
// - `restingOn` is positional-agnostic, so the crate presses plate-lock while
//   hosting HEAVY wherever it stands; one plate drives BOTH doors through
//   `targets[]` (press → store opens + exit closes; release → reverse).
// - `whenPressed: "open"` on plate-anchor makes the vault open while the
//   safe is weighted — the anchor/lock two-fixture inversion per the arc.
// - Guards scan at their previous post before stepping; the hall is hot
//   through beat 2 and again at beat 7's post-move scan — nobody may stand
//   in it then. The alcove is cover:true, immune to detection.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM06: RbmManifest = {
  levelId: "rbm-06",
  rulesVersion: "rbm-rules/1.0.0",
  title: "The Door That Pays You Back",
  cells: [
    { id: "cell-alcove", region: "inside", cover: true },
    { id: "cell-hall", region: "inside" },
    { id: "cell-store", region: "inside" },
    { id: "cell-vault", region: "inside" },
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-alcove", b: "cell-hall" },
    { a: "cell-hall", b: "cell-store", gateId: "gate-store" },
    { a: "cell-hall", b: "cell-vault", gateId: "gate-vault" },
    { a: "cell-hall", b: "pad-out", gateId: "gate-exit" },
    // The vault window: climbable only while the alarm plate is pressed —
    // i.e., while the weight is home. The teammate's route depends on the return.
    { a: "cell-vault", b: "pad-out", gateId: "gate-window" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // HEAVY's home. Resting on the alarm plate: weighted, it anchors the
    // vault door OPEN; while the weight is away the vault stays shut.
    { kind: "prop", id: "prop-safe", cellId: "cell-hall", baseMass: 1, accepts: [], restingOn: "plate-anchor" },
    // The weighing crate: HEAVY's borrower. Its hosted weight trips the lock
    // plate — opening the store and shutting the exit — until it is paid back.
    { kind: "prop", id: "prop-crate", cellId: "cell-hall", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-lock" },
    { kind: "prop", id: "prop-ledger", cellId: "cell-store", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-crown", cellId: "cell-vault", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-alcove", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-alcove", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Scan-before-move: the hall is swept through beat 2 and again after
      // the watch returns at beat 7 — the alcove is the crew's safe cover.
      patrol: [
        { beat: 1, cellId: "guard-watch" },
        { beat: 2, cellId: "guard-far" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-far" },
        { beat: 6, cellId: "guard-far" },
        { beat: 7, cellId: "guard-watch", facing: "hall" },
      ],
      rays: {
        "guard-watch": [{ id: "beam-hall", segments: [{ cells: ["cell-hall"] }] }],
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-safe", effects: { mass: 2 } },
  ],
  devices: [
    // The anchor: while the safe is weighted (mass 3), BOTH vault openings
    // unbar — the hall door and the delivery window alike.
    {
      kind: "pressure-plate",
      id: "plate-anchor",
      cellId: "cell-hall",
      threshold: 3,
      targets: [
        { deviceId: "gate-vault", whenPressed: "open" },
        { deviceId: "gate-window", whenPressed: "open" },
      ],
    },
    { kind: "gate", id: "gate-vault", initiallyOpen: false },
    { kind: "gate", id: "gate-window", initiallyOpen: false },
    // The lock: while the crate carries the posted weight (mass 3), the
    // store unlocks AND the front exit bolts — the price of the posting.
    {
      kind: "pressure-plate",
      id: "plate-lock",
      cellId: "cell-hall",
      threshold: 2,
      targets: [
        { deviceId: "gate-store", whenPressed: "open" },
        { deviceId: "gate-exit", whenPressed: "close" },
      ],
    },
    { kind: "gate", id: "gate-store", initiallyOpen: false },
    { kind: "gate", id: "gate-exit", initiallyOpen: true },
  ],
  loans: {
    maxRows: 1,
    legalDueBeats: [3, 4, 5, null],
    requiredTokens: ["TOKEN-H"],
  },
  outcomes: [
    { id: "ledger-out", kind: "entityAt", entityId: "prop-ledger", cellId: "pad-out" },
    { id: "crown-out", kind: "entityAt", entityId: "prop-crown", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "heavy-home", kind: "tokenHome", tokenId: "TOKEN-H" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 8 },
};

// ---------------------------------------------------------------------------
// Verified winning traces (asserted by tests/unit/rbm05-07.test.ts)
// ---------------------------------------------------------------------------

export const RBM06_WINNING_ROW: LoanManifestRow = {
  rowId: "TOKEN-H->prop-crate@1~5",
  tokenId: "TOKEN-H",
  fromHostId: "prop-safe",
  toHostId: "prop-crate",
  startBeat: 1,
  dueBeat: 5,
};

/** Early posting: borrow at beat 1, pay back at end of beat 5. */
export function rbm06ReferencePlan(): RbmPlan {
  return {
    rows: [{ ...RBM06_WINNING_ROW }],
    commands: {
      // Beats 1–2 the hall is swept — both crew wait under the alcove's cover.
      // Beat 3: into the hall; beat 4: helper ducks into the open store.
      3: { "crew-helper": { type: "move", to: "cell-hall" } },
      4: { "crew-helper": { type: "move", to: "cell-store" } },
      // Beat 5: last beat the store door is open — she carries the ledger back
      // to the hall. The return then pays: vault opens, exit opens, store slams.
      // Beats 5–7: paid-back doors — helper slips out of the store and out the
      // front; operator crosses the hall into the vault and out the window.
      5: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-ledger", to: "cell-hall" },
        "crew-operator": { type: "move", to: "cell-hall" },
      },
      6: {
        "crew-helper": { type: "move", to: "pad-out" },
        "crew-operator": { type: "move", to: "cell-vault" },
      },
      7: {
        "crew-operator": { type: "pickup-and-move", propId: "prop-crown", to: "pad-out" },
      },
    },
  };
}

/** Alternative allocation: same schedule, swapped jobs — operator takes the
 * store route; helper goes long way round to the vault window. */
export function rbm06AlternatePlan(): RbmPlan {
  return {
    rows: [{ ...RBM06_WINNING_ROW }],
    commands: {
      3: { "crew-operator": { type: "move", to: "cell-hall" } },
      4: { "crew-operator": { type: "move", to: "cell-store" } },
      5: {
        "crew-operator": { type: "pickup-and-move", propId: "prop-ledger", to: "cell-hall" },
        "crew-helper": { type: "move", to: "cell-hall" },
      },
      6: {
        "crew-operator": { type: "move", to: "pad-out" },
        "crew-helper": { type: "move", to: "cell-vault" },
      },
      7: { "crew-helper": { type: "pickup-and-move", propId: "prop-crown", to: "pad-out" } },
    },
  };
}

/** Same route, with the posting paid back at a different beat. */
export function rbm06PlanWithDue(dueBeat: number | null): RbmPlan {
  const plan = rbm06ReferencePlan();
  plan.rows[0] = { ...RBM06_WINNING_ROW, dueBeat };
  return plan;
}

export const RBM06_CARD: LevelCard = {
  levelId: "rbm-06",
  winningTraceSummary: [
    "Beat 1 — Post HEAVY from the safe to the weighing crate (due end of beat 5). The lock plate trips: the store opens, the exit bolts, the vault anchor releases.",
    "Beats 3–5 — Helper ducks through the open store and back with the ledger — before the posted weight comes home.",
    "Beat 5 (return phase) — HEAVY lands back on the safe: the alarm plate unbars the vault door AND delivery window while the lock plate releases the front exit — one return, three doors.",
    "Beats 6–7 — Helper leaves by the front door; operator slips in the vault window and out with the crown while the beam sweeps the hall.",
  ],
  wrongApproaches: [
    {
      name: "keep-forever",
      summary: "Never pay the posting back: hold HEAVY through the run.",
      expectedFailure: "gate-exit and the vault doors never reopen — helper's beat-6 exit is rejected gate-closed and the crown is locked in. heavy-home fails too.",
    },
    {
      name: "pay-back-too-early",
      summary: "Due the posting at beat 3, before the store is used.",
      expectedFailure: "The lock plate releases and gate-store slams at the end of beat 3 — the helper's beat-4 store entry is rejected gate-closed and the ledger is stranded.",
    },
    {
      name: "borrow-from-self",
      summary: "Lend HEAVY to the safe itself instead of the crate.",
      expectedFailure: "manifest rejected: loan-to-own-home — a token cannot be borrowed by its own home.",
    },
    {
      name: "hall-on-the-beam",
      summary: "Step into the hall at beat 2 while the custodian's beam still sweeps it.",
      expectedFailure: "guard.capture at beat 2 — the pre-move scan still holds the watch post.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a second row past the one-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget — no compatible second loan exists anyway, but the budget lands first for a non-overlapping row.",
    },
  ],
};
