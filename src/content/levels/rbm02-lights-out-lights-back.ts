// RBM-02 "Lights Out, Lights Back" — second room of the Return by Midnight
// curriculum (master §II RBM-D). Taught property: BRIGHT.
//
// Lesson: temporary darkness and restored light serve different stages.
// The floor lamp's BRIGHT token is lent to the helper herself — the hall goes
// dark, the light walks the route on her shoulder, the vault's sensor wakes
// when she arrives with it, and the lamp must be lit again by midnight.
//
// Engine-grammar notes (frozen semantics):
// - Sensor powers while a token of the required property is hosted by an
//   entity standing at the sensor's cell. BRIGHT's observable effect is that
//   power flag — the "sensor enables the next step" is the sensor.power event
//   plus the required home return (tokenHome outcome).
// - The exit is held open by the candlestand resting on its plate; carrying
//   the stand is never required (and the stand is not the prize — the
//   statuette is).
// - Teeth come from the published patrol: the hall is watched beats 1–2 and
//   the hall + vault are watched again at beat 5, so the route must clear the
//   interior by the end of beat 5.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM02: RbmManifest = {
  levelId: "rbm-02",
  rulesVersion: "rbm-rules/1.0.0",
  title: "Lights Out, Lights Back",
  cells: [
    { id: "cell-foyer", region: "inside" },
    { id: "cell-hall", region: "inside" },
    { id: "cell-vault", region: "inside" },
    // The sealed east wing: unreachable (no edges), always empty — the
    // mid-run beam rests here.
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-foyer", b: "cell-hall" },
    { a: "cell-hall", b: "cell-vault" },
    { a: "cell-vault", b: "pad-out", gateId: "gate-exit" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // The grand floor lamp — BRIGHT's home. Too heavy to lift (mass 2 > limit 1):
    // the light must travel by loan, not by carrying the lamp itself.
    { kind: "prop", id: "prop-lamp", cellId: "cell-hall", baseMass: 2, accepts: [] },
    // The candlestand doorstop: its authored rest on plate-hold keeps the exit lifted.
    { kind: "prop", id: "prop-candle", cellId: "cell-hall", baseMass: 1, accepts: [], restingOn: "plate-hold" },
    { kind: "prop", id: "prop-statuette", cellId: "cell-vault", baseMass: 1, accepts: [] },
  ],
  crew: [
    // The helper hosts BRIGHT on her shoulder — she carries the light itself.
    { kind: "crew", id: "crew-helper", cellId: "cell-foyer", massLimit: 1, accepts: ["BRIGHT"] },
    { kind: "crew", id: "crew-operator", cellId: "cover-out", massLimit: 0 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Guards scan at their PREVIOUS post before stepping (engine phase 3),
      // so the hall stays lit through the beat he leaves — the window opens
      // one beat later, at beat 3.
      patrol: [
        { beat: 1, cellId: "guard-hall" },
        { beat: 2, cellId: "guard-far" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-watch", facing: "hall" },
      ],
      rays: {
        // Beats 1–2: the hall is lit by the patrol's own beam — do not be there
        // (beat-2 crossings are caught by the pre-move scan at this post).
        "guard-hall": [{ id: "beam-hall", segments: [{ cells: ["cell-hall"] }] }],
        // Beats 2–4: the beam sweeps the sealed east wing — always empty.
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
        // Beat 5: the watch sweeps the interior route — nobody may linger inside.
        "guard-watch": [
          { id: "beam-hall2", segments: [{ cells: ["cell-hall"] }] },
          { id: "beam-vault", segments: [{ cells: ["cell-vault"] }] },
        ],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-lamp", effects: {} },
  ],
  devices: [
    // Candlestand resting on the plate holds the service door lifted.
    {
      kind: "pressure-plate",
      id: "plate-hold",
      cellId: "cell-hall",
      threshold: 1,
      targets: [{ deviceId: "gate-exit", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-exit", initiallyOpen: false },
    // The gallery eye: powered while BRIGHT's host stands in the hall.
    { kind: "sensor", id: "sensor-eye", cellId: "cell-hall", requiresProperty: "BRIGHT" },
    // The vault's own tripwire: powered while BRIGHT's host stands in the vault —
    // the "later useful sensor" the return's journey must wake.
    { kind: "sensor", id: "sensor-vault", cellId: "cell-vault", requiresProperty: "BRIGHT" },
  ],
  loans: {
    maxRows: 1,
    legalDueBeats: [3, 4, 5, null],
    requiredTokens: ["TOKEN-B"],
  },
  outcomes: [
    { id: "statuette-delivered", kind: "entityAt", entityId: "prop-statuette", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "bright-returned", kind: "tokenHome", tokenId: "TOKEN-B" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 5 },
};

// ---------------------------------------------------------------------------
// Verified winning trace (asserted by tests/unit/rbm02-04.test.ts)
// ---------------------------------------------------------------------------

/** The manifest row: BRIGHT rides on the helper's shoulder, home at beat 5. */
export const RBM02_WINNING_ROW: LoanManifestRow = {
  rowId: "TOKEN-B->crew-helper@1~5",
  tokenId: "TOKEN-B",
  fromHostId: "prop-lamp",
  toHostId: "crew-helper",
  startBeat: 1,
  dueBeat: 5,
};

export function rbm02ReferencePlan(): RbmPlan {
  return {
    rows: [{ ...RBM02_WINNING_ROW }],
    commands: {
      // Beats 1–2: the hall is under the patrol beam — the helper waits in the foyer.
      3: { "crew-helper": { type: "move", to: "cell-hall" } },
      4: { "crew-helper": { type: "move", to: "cell-vault" } },
      5: { "crew-helper": { type: "pickup-and-move", propId: "prop-statuette", to: "pad-out" } },
    },
  };
}

/** Same route, with the loan due at a different beat (counterexample builder). */
export function rbm02PlanWithDue(dueBeat: number | null): RbmPlan {
  const plan = rbm02ReferencePlan();
  plan.rows[0] = { ...RBM02_WINNING_ROW, dueBeat };
  return plan;
}

export const RBM02_CARD: LevelCard = {
  levelId: "rbm-02",
  winningTraceSummary: [
    "Beat 1 — Loan BRIGHT from the floor lamp to the helper (due end of beat 5). The hall goes dark; the candlestand keeps the exit lifted.",
    "Beats 1–2 — Wait in the foyer. The custodian's beam is still sweeping the hall — it catches even a beat-2 crossing, because the guard scans before he steps away.",
    "Beat 3 — The beam is off the hall; the helper crosses the dark hall, carrying the borrowed light with her.",
    "Beat 4 — She reaches the vault; the vault's tripwire wakes to her shoulder-lamp (sensor powered).",
    "Beat 5 — She lifts the statuette and slips through the open exit to the pad; BRIGHT returns to the floor lamp — the hall's eye relights as the watch sweeps an empty interior.",
  ],
  wrongApproaches: [
    {
      name: "keep-forever",
      summary: "Take the longest loan — BRIGHT never returns to the lamp.",
      expectedFailure: "bright-returned fails (tokenHome): the lamp is still dark at midnight, and the hall sensor never relights.",
    },
    {
      name: "early-return",
      summary: "Due the loan at beat 4: the light goes home before the helper reaches the vault.",
      expectedFailure: "sensor-vault never powers — the visible dependency for the vault step is missing (the tripwire stays dark).",
    },
    {
      name: "skip-the-loan",
      summary: "Cross without borrowing the light at all.",
      expectedFailure: "plan.complete fails: the manifest is missing the required TOKEN-B row.",
    },
    {
      name: "cross-under-the-beam",
      summary: "Enter the hall at beat 2, while the custodian's beam still sweeps it.",
      expectedFailure: "guard.capture at beat 2 — noCapture fails.",
    },
    {
      name: "double-booking",
      summary: "Commit a second loan row over the same token.",
      expectedFailure: "manifest rejected: overlapping-loan — a token cannot be re-lent or renewed while held.",
    },
  ],
};
