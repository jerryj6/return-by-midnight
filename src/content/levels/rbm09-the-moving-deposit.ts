// RBM-09 "The Moving Deposit" — middle room of chapter 3 (master §II RBM-D).
// Position and orientation determine the effect of a restored property:
// move/aim the dormant home while its token is away, then restore it to
// enable another crew member's goal.
//
// Honest engine mapping: there is no "aim" verb — the introduced controls
// are pickup/move/drop. The dormant home is the lamp's STAND, which rests on
// plate-lamp (threshold 1 — the stand alone presses whenever it rests, lit
// or dark). Carrying the stand is what releases the plate and opens the
// dark-room door — and the move only pays while the light is away, because
// the stand can only be repositioned while it isn't carrying the lamp's
// lit weight (carried cargo never rests). Park it at the junction, restore
// the light, and the receiver sensor at the junction powers — the deposit
// aimed at the room that needed it. A wrong parking spot leaves the receiver
// dark and fails the entityAt outcome visibly.
//
// Engine-grammar notes (frozen semantics):
// - `pickup`/`drop` are separate verbs, so the carry window spans real
//   beats: pick up at 3, move at 4, set down at 5 — the dark door is open
//   for crossings at beats 4 and 5 (the settle needs the stand off its plate
//   for at least one beat to notice the release).
// - `restingOn` binds to a plate id, not a cell — the stand presses
//   plate-lamp wherever it is parked; only CARRYING suspends the press.
// - The return lands on the stand wherever it stands (homeCellId follows the
//   prop) — the restored light fires at the aimed cell.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM09: RbmManifest = {
  levelId: "rbm-09",
  rulesVersion: "rbm-rules/1.0.0",
  title: "The Moving Deposit",
  cells: [
    { id: "cell-parlor", region: "inside" },
    { id: "cell-junction", region: "inside" },
    { id: "cell-alcove", region: "inside" },
    { id: "cell-dark", region: "inside" },
    { id: "cell-loft", region: "inside" },
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-parlor", b: "cell-junction" },
    { a: "cell-parlor", b: "cell-alcove" },
    { a: "cell-parlor", b: "cell-dark", gateId: "gate-dark" },
    { a: "cell-parlor", b: "cell-loft", gateId: "gate-loft" },
    { a: "cell-dark", b: "pad-out" },
    { a: "cell-junction", b: "pad-out" },
    { a: "cell-loft", b: "pad-out" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // BRIGHT's home: the lamp's stand. Alone it still presses plate-lamp
    // (threshold 1) — only carrying it releases the dark-room door.
    { kind: "prop", id: "prop-stand", cellId: "cell-parlor", baseMass: 1, accepts: [], restingOn: "plate-lamp" },
    // The light's destination while away: the loft's candlestand.
    { kind: "prop", id: "prop-candlestick", cellId: "cell-loft", baseMass: 1, accepts: ["BRIGHT"], restingOn: "plate-loft" },
    // The take.
    { kind: "prop", id: "prop-idol-dark", cellId: "cell-dark", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-loft", cellId: "cell-loft", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-parlor", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-parlor", massLimit: 1 },
    { kind: "crew", id: "crew-runner", cellId: "cell-parlor", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Scan-before-move: the three side rooms are swept through the beat-3
      // pre-move scan; the parlor is swept at beat 6. Entries beat 4+ only.
      patrol: [
        { beat: 1, cellId: "guard-doors" },
        { beat: 2, cellId: "guard-doors" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-far" },
        { beat: 6, cellId: "guard-hall" },
        { beat: 7, cellId: "guard-far" },
      ],
      rays: {
        "guard-doors": [
          { id: "beam-d", segments: [{ cells: ["cell-dark"] }] },
          { id: "beam-l", segments: [{ cells: ["cell-loft"] }] },
          { id: "beam-j", segments: [{ cells: ["cell-junction"] }] },
        ],
        "guard-hall": [{ id: "beam-hall", segments: [{ cells: ["cell-parlor"] }] }],
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-stand", effects: { mass: 1 } },
  ],
  devices: [
    // The dormant deposit: the bare stand (mass 1 ≥ thr 1) holds the dark
    // room sealed whenever it rests. Carrying it releases the door.
    {
      kind: "pressure-plate",
      id: "plate-lamp",
      cellId: "cell-parlor",
      threshold: 1,
      targets: [{ deviceId: "gate-dark", whenPressed: "close" }],
    },
    { kind: "gate", id: "gate-dark", initiallyOpen: false },
    // The away job: the loft candlestand's hosted light opens the loft.
    {
      kind: "pressure-plate",
      id: "plate-loft",
      cellId: "cell-loft",
      threshold: 2,
      targets: [{ deviceId: "gate-loft", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-loft", initiallyOpen: false },
    // The receiver: powers only while BRIGHT's host stands at the junction —
    // i.e., the stand aimed here and the light restored.
    {
      kind: "sensor",
      id: "sensor-junction",
      cellId: "cell-junction",
      requiresProperty: "BRIGHT",
    },
  ],
  loans: {
    maxRows: 1,
    legalDueBeats: [4, 5, 6, 7, null],
    requiredTokens: ["TOKEN-B"],
  },
  outcomes: [
    { id: "idol-dark-out", kind: "entityAt", entityId: "prop-idol-dark", cellId: "pad-out" },
    { id: "idol-loft-out", kind: "entityAt", entityId: "prop-idol-loft", cellId: "pad-out" },
    { id: "stand-aimed", kind: "entityAt", entityId: "prop-stand", cellId: "cell-junction" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "runner-extracted", kind: "entityInRegion", entityId: "crew-runner", region: "outside" },
    { id: "bright-home", kind: "tokenHome", tokenId: "TOKEN-B" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 7 },
};

// ---------------------------------------------------------------------------
// Verified winning trace (asserted by tests/unit/rbm08-10.test.ts)
// ---------------------------------------------------------------------------

export const RBM09_WINNING_ROW: LoanManifestRow = {
  rowId: "TOKEN-B->candlestick@1~6",
  tokenId: "TOKEN-B",
  fromHostId: "prop-stand",
  toHostId: "prop-candlestick",
  startBeat: 1,
  dueBeat: 6,
};

export function rbm09ReferencePlan(): RbmPlan {
  return {
    rows: [{ ...RBM09_WINNING_ROW }],
    commands: {
      // Beat 3: helper takes the dormant stand off its plate — the dark door
      // releases at the settle.
      3: { "crew-helper": { type: "pickup", propId: "prop-stand" } },
      // Beat 4: still carried — the door stays open; the operator ducks into
      // the dark room and the runner takes the loft (open since the posting).
      4: {
        "crew-helper": { type: "move", to: "cell-junction" },
        "crew-operator": { type: "move", to: "cell-dark" },
        "crew-runner": { type: "move", to: "cell-loft" },
      },
      // Beat 5: last beat of the carry window — the stand is parked at the
      // junction while both thieves slip out with the take.
      5: {
        "crew-helper": { type: "drop" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-dark", to: "pad-out" },
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-loft", to: "pad-out" },
      },
      // Beat 6: BRIGHT returns to its re-sited stand — the junction receiver
      // fires. Helper leaves while the parlor is swept.
      6: { "crew-helper": { type: "move", to: "pad-out" } },
    },
  };
}

/** Same plan, different parking spot for the stand. */
export function rbm09PlanWithAim(aimCell: "cell-junction" | "cell-alcove"): RbmPlan {
  const plan = rbm09ReferencePlan();
  plan.commands = {
    3: { "crew-helper": { type: "pickup", propId: "prop-stand" } },
    4: {
      "crew-helper": { type: "move", to: aimCell },
      "crew-operator": { type: "move", to: "cell-dark" },
      "crew-runner": { type: "move", to: "cell-loft" },
    },
    5: {
      "crew-helper": { type: "drop" },
      "crew-operator": { type: "pickup-and-move", propId: "prop-idol-dark", to: "pad-out" },
      "crew-runner": { type: "pickup-and-move", propId: "prop-idol-loft", to: "pad-out" },
    },
    6: { "crew-helper": { type: "move", to: "pad-out" } },
  };
  return plan;
}

/** Same route, light due at a different beat. */
export function rbm09PlanWithDue(dueBeat: number | null): RbmPlan {
  const plan = rbm09ReferencePlan();
  plan.rows[0] = { ...RBM09_WINNING_ROW, dueBeat };
  return plan;
}

export const RBM09_CARD: LevelCard = {
  levelId: "rbm-09",
  insight: "Aim is a destination, not a position — name where the deposit should land when it returns, not where it stands now.",
  naiveApproach: "Aim at the anchor currently deployed — the deposit returns to a home that is not listening.",
  solutionPolicy: "due 4,5,7 all win (ref uses 6); starts 2–3 win.",
  winningTraceSummary: [
    "Beat 1 — Post the light to the loft candlestick (due 6): the loft opens for the runner, and the stand goes dormant — ready to be re-sited.",
    "Beat 3 — Helper lifts the bare stand: carried cargo never rests, so the lamp plate releases and the dark-room door opens.",
    "Beat 4 — Helper hauls the stand toward the junction (still carried, door still open); operator and runner enter their rooms.",
    "Beat 5 — Stand set down at the junction; both thieves exit through the last beat of the carry window.",
    "Beat 6 — The light returns to the re-sited stand: the junction receiver fires. The deposit's new position is what powered it.",
  ],
  wrongApproaches: [
    {
      name: "wrong-aim",
      summary: "Park the stand at the alcove instead of the junction.",
      expectedFailure: "stand-aimed fails (entityAt at cell-junction) and sensor-junction stays dark — the restored light lands where it does no good.",
    },
    {
      name: "carry-window-miss",
      summary: "Send the operator into the dark room after the stand is set down.",
      expectedFailure: "gate-dark re-seals at the beat-5 settle — a beat-6 crossing is rejected gate-closed; the door only exists while the deposit is in transit.",
    },
    {
      name: "keep-the-light-forever",
      summary: "Due the posting at never — the stand stays dormant but the light never returns.",
      expectedFailure: "bright-home fails (tokenHome) and the junction receiver never fires — restoring the property is part of the operation, not optional.",
    },
    {
      name: "entry-during-the-sweep",
      summary: "Cross a side-room door at beat 3 while the beam still covers them.",
      expectedFailure: "guard.capture at beat 3 — the door cells stay hot through the pre-move scan.",
    },
    {
      name: "overlapping-second-loan",
      summary: "Commit a second row on the same light while the first is outstanding.",
      expectedFailure: "manifest rejected: overlapping-loan — the single token cannot serve two hosts at once.",
    },
  ],
};
