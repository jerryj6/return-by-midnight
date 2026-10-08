// RBM-03 "Quiet, Then Quite Loud" — third room of the Return by Midnight
// curriculum (master §II RBM-D). Taught property: NOISY.
//
// Lesson: NOISY needs a real emission event. The winding toy is the token's
// home; while NOISY sits in the decoy sack the toy can travel the gallery
// silently. Parked at the listening post with its rattle restored, it becomes
// the night's diversion — and its weight off the dumbwaiter plate is what
// actually opens the lift door for the loot.
//
// Engine-grammar notes (frozen semantics — honest mapping):
// - There is no acoustic verb; the "emission" is the sensor powering while
//   NOISY's host stands at the listening post (sensor-ear, requiresProperty
//   NOISY at cell-alcove). A stationary return produces no power — the toy
//   must physically be at the post. The patrol itself is a fixed published
//   table (RBM-007); the decoy's diversion is expressed as the observable
//   sensor event plus the required toy placement, not a patrol override.
// - plate-lift keeps gate-lift CLOSED while the toy rests on it
//   (whenPressed: close). Carrying the toy opens the lift door; the door
//   slams again the moment the toy is set down at the alcove post — closing
//   behind the crew exactly like RBM-01's exit.
// - Teeth: the gallery is swept on beats 1–2 (the loud window); the pad is
//   watched on beat 6 through the lift door, which is shut by then.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM03: RbmManifest = {
  levelId: "rbm-03",
  rulesVersion: "rbm-rules/1.0.0",
  title: "Quiet, Then Quite Loud",
  cells: [
    { id: "cell-nursery", region: "inside" },
    { id: "cell-gallery", region: "inside" },
    { id: "cell-alcove", region: "inside" },
    { id: "cell-landing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-nursery", b: "cell-gallery" },
    { a: "cell-gallery", b: "cell-alcove" },
    // The decoy window: the listening post slips straight outside, ungated.
    { a: "cell-alcove", b: "pad-out" },
    // The dumbwaiter: open only while the toy is off its plate.
    { a: "cell-nursery", b: "pad-out", gateId: "gate-lift" },
    { a: "cell-landing", b: "cell-alcove" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // NOISY's home: the winding toy. Its authored rest on plate-lift holds the
    // dumbwaiter shut until somebody picks it up.
    { kind: "prop", id: "prop-toy", cellId: "cell-nursery", baseMass: 1, accepts: [], restingOn: "plate-lift" },
    // The decoy sack: the compatible temporary host. It stays in the nursery
    // holding the rattle while the toy travels quiet.
    { kind: "prop", id: "prop-sack", cellId: "cell-nursery", baseMass: 1, accepts: ["NOISY"] },
    { kind: "prop", id: "prop-bust", cellId: "cell-gallery", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-nursery", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-nursery", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Guards scan at their PREVIOUS post before stepping (engine phase 3):
      // the gallery is caught through beat 2, the quiet window opens at 3.
      patrol: [
        { beat: 1, cellId: "guard-watch" },
        { beat: 2, cellId: "guard-far" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-far" },
        { beat: 6, cellId: "guard-south", facing: "exit" },
      ],
      rays: {
        // The loud window: beats 1–2 the gallery is under the beam.
        "guard-watch": [{ id: "beam-gallery", segments: [{ cells: ["cell-gallery"] }] }],
        // Mid-run the patrol sweeps the far landing only — a dead end.
        "guard-far": [{ id: "beam-landing", segments: [{ cells: ["cell-landing"] }] }],
        // Beat 6: the watch returns and finds the lift door shut — the pad
        // stays dark because the toy's weight already pressed it closed.
        "guard-south": [
          { id: "beam-pad", segments: [{ cells: ["pad-out"], gatedBy: ["gate-lift"] }] },
        ],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-N", property: "NOISY", homeEntityId: "prop-toy", effects: { emitsSound: true } },
  ],
  devices: [
    {
      kind: "pressure-plate",
      id: "plate-lift",
      cellId: "cell-nursery",
      threshold: 1,
      targets: [{ deviceId: "gate-lift", whenPressed: "close" }],
    },
    { kind: "gate", id: "gate-lift", initiallyOpen: false },
    // The listening post: powered while NOISY's host stands at the alcove —
    // the loud toy arriving home from its errand is the diversion.
    { kind: "sensor", id: "sensor-ear", cellId: "cell-alcove", requiresProperty: "NOISY" },
  ],
  loans: {
    maxRows: 1,
    legalDueBeats: [4, 5, 6, null],
    requiredTokens: ["TOKEN-N"],
  },
  outcomes: [
    { id: "toy-posted", kind: "entityAt", entityId: "prop-toy", cellId: "cell-alcove" },
    { id: "bust-delivered", kind: "entityAt", entityId: "prop-bust", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "noisy-returned", kind: "tokenHome", tokenId: "TOKEN-N" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 6 },
};

// ---------------------------------------------------------------------------
// Verified winning trace (asserted by tests/unit/rbm02-04.test.ts)
// ---------------------------------------------------------------------------

/** NOISY sits in the decoy sack for the crossing; it comes home to the parked toy at beat 6. */
export const RBM03_WINNING_ROW: LoanManifestRow = {
  rowId: "TOKEN-N->prop-sack@1~6",
  tokenId: "TOKEN-N",
  fromHostId: "prop-toy",
  toHostId: "prop-sack",
  startBeat: 1,
  dueBeat: 6,
};

export function rbm03ReferencePlan(): RbmPlan {
  return {
    rows: [{ ...RBM03_WINNING_ROW }],
    commands: {
      // Beats 1–2 the gallery is swept: everyone waits in the nursery.
      // Beat 3: helper walks the QUIET toy out (lift door opens); operator
      // shadows into the gallery to reach the bust.
      3: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-toy", to: "cell-gallery" },
        "crew-operator": { type: "move", to: "cell-gallery" },
      },
      // Beat 4: toy to the listening post; loot carried back to the nursery.
      4: {
        "crew-helper": { type: "move", to: "cell-alcove" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-bust", to: "cell-nursery" },
      },
      // Beat 5: toy parked; the lift door slams shut. Operator slips through
      // it while it is still open — the ordering is the whole trick.
      5: {
        "crew-helper": { type: "drop" },
        "crew-operator": { type: "move", to: "pad-out" },
      },
      // Beat 6: NOISY returns to the toy at the post — the post rings; the
      // helper steps out the decoy window behind the shut lift door.
      6: { "crew-helper": { type: "move", to: "pad-out" } },
    },
  };
}

/** Same route, with the loan due at a different beat (counterexample builder). */
export function rbm03PlanWithDue(dueBeat: number | null): RbmPlan {
  const plan = rbm03ReferencePlan();
  plan.rows[0] = { ...RBM03_WINNING_ROW, dueBeat };
  return plan;
}

export const RBM03_CARD: LevelCard = {
  levelId: "rbm-03",
  winningTraceSummary: [
    "Beat 1 — Loan NOISY from the winding toy to the decoy sack (due end of beat 6). The toy is now silent; the sack holds the rattle.",
    "Beats 1–2 — Wait. The patrol beam sweeps the gallery; nobody crosses it yet.",
    "Beat 3 — Helper lifts the toy and crosses the gallery quietly; its weight leaving the plate opens the lift door. Operator slips into the gallery behind her.",
    "Beat 4 — Toy to the listening post; operator picks up the bust and falls back to the nursery.",
    "Beat 5 — Helper sets the toy down at the post — its weight re-presses the plate and the lift door slams shut behind the operator, who steps out through it while it was still open.",
    "Beat 6 — NOISY returns to the parked toy; the listening post rings (sensor powered). Helper leaves by the decoy window while the watch sweeps a pad the shut door has already darkened.",
  ],
  wrongApproaches: [
    {
      name: "stationary-return",
      summary: "Leave the toy in the nursery and let NOISY return to it there.",
      expectedFailure: "toy-posted fails (entityAt) and sensor-ear never powers — a stationary return produces no diversion.",
    },
    {
      name: "loud-window",
      summary: "Carry the toy through the gallery at beat 2 while the beam still sweeps it.",
      expectedFailure: "guard.capture at beat 2 — the crossing is exposed before the quiet window opens.",
    },
    {
      name: "keep-forever",
      summary: "Due the NOISY loan never: the rattle stays in the sack.",
      expectedFailure: "noisy-returned fails (tokenHome) — the toy never rings at the post and the token never comes home.",
    },
    {
      name: "missed-lift-window",
      summary: "Exit through the dumbwaiter after the toy is already parked (operator waits, then moves at beat 6).",
      expectedFailure: "command.rejected — gate-closed: the toy's weight shut the lift door at the end of beat 5.",
    },
    {
      name: "double-booking",
      summary: "Commit a second loan row over the same token.",
      expectedFailure: "manifest rejected: overlapping-loan — a token cannot be re-lent or renewed while held.",
    },
  ],
};
