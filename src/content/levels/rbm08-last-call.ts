// RBM-08 "Last Call" — first room of chapter 3 (master §II RBM-D).
// Ordered returns compose a chain: three properties, a clear sequence of
// sensors/patrol/doors, fixed four-crew operation. Return order matters —
// swap the rattle's early return and the lamp's late return and the whole
// operation folds.
//
// The chain: NOISY must come home EARLY (its return presses plate-toy and
// reopens the bell corridor for the runner). HEAVY must be POSTED mid-run
// (the vault scale opens its corridor for the operator). BRIGHT must stay
// AWAY until the last crossing (its stand on plate-lamp holds the north door
// AND the lobby exit shut whenever the lamp is lit — the away-window is the
// passage window). Three return/posting beats, one order that works.
//
// Engine-grammar notes (frozen semantics):
// - All four crew start inside the hall; room corridors are the gated
//   entries, room windows are free exits (same idiom as RBM-07).
// - A return's plate press lands at the phase-5 settle of the due beat; the
//   door is usable from the next beat's phase 2.
// - Gates only move on plate TRANSITIONS: for "open while the token is
//   away" to work, the plate must register the weighted baseline first — so
//   the lamp loan starts at beat 2, letting the beat-1 settle record the
//   press the release will invert.
// - The hall itself is swept at beats 6–7 — everyone must be clear of it by
//   the end of beat 5.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM08: RbmManifest = {
  levelId: "rbm-08",
  rulesVersion: "rbm-rules/1.0.0",
  title: "Last Call",
  cells: [
    { id: "cell-hall", region: "inside" },
    { id: "cell-north", region: "inside" },
    { id: "cell-east", region: "inside" },
    { id: "cell-vault", region: "inside" },
    { id: "cell-lobby", region: "inside" },
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-hall", b: "cell-north", gateId: "gate-n1" },
    { a: "cell-hall", b: "cell-east", gateId: "gate-e1" },
    { a: "cell-hall", b: "cell-vault", gateId: "gate-v1" },
    { a: "cell-hall", b: "cell-lobby" },
    { a: "cell-lobby", b: "pad-out", gateId: "gate-lobby" },
    { a: "cell-north", b: "pad-out" },
    { a: "cell-east", b: "pad-out" },
    { a: "cell-vault", b: "pad-out" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // BRIGHT's home: the floor lamp weights plate-lamp while lit (2 mass).
    // While the light is posted away the lamp is too light to press — the
    // north door and the lobby exit both stand open.
    { kind: "prop", id: "prop-lamp", cellId: "cell-hall", baseMass: 1, accepts: [], restingOn: "plate-lamp" },
    // NOISY's home: the winding toy weights plate-toy while home.
    { kind: "prop", id: "prop-toy", cellId: "cell-lobby", baseMass: 1, accepts: [], restingOn: "plate-toy" },
    // HEAVY's home.
    { kind: "prop", id: "prop-safe", cellId: "cell-hall", baseMass: 1, accepts: [] },
    // The borrowers.
    { kind: "prop", id: "prop-candlestick", cellId: "cell-hall", baseMass: 1, accepts: ["BRIGHT"] },
    { kind: "prop", id: "prop-decoy", cellId: "cell-lobby", baseMass: 1, accepts: ["NOISY"] },
    { kind: "prop", id: "prop-scale-vault", cellId: "cell-vault", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-vault" },
    // The take: one idol per corridor room, plus the lobby ledger.
    { kind: "prop", id: "prop-idol-north", cellId: "cell-north", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-east", cellId: "cell-east", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-vault", cellId: "cell-vault", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-ledger", cellId: "cell-lobby", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-hall", massLimit: 1 },
    { kind: "crew", id: "crew-runner", cellId: "cell-hall", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-hall", massLimit: 1 },
    { kind: "crew", id: "crew-lookout", cellId: "cell-hall", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Scan-before-move: the three corridor rooms are swept through the
      // beat-3 pre-move scan (entries are safe only from beat 4), and the
      // hall itself is swept from beat 6 — the house is hostile after that.
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
          { id: "beam-n", segments: [{ cells: ["cell-north"] }] },
          { id: "beam-e", segments: [{ cells: ["cell-east"] }] },
          { id: "beam-v", segments: [{ cells: ["cell-vault"] }] },
        ],
        "guard-hall": [{ id: "beam-hall", segments: [{ cells: ["cell-hall", "cell-lobby"] }] }],
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-lamp", effects: { mass: 1 } },
    { id: "TOKEN-N", property: "NOISY", homeEntityId: "prop-toy", effects: { mass: 1, emitsSound: true } },
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-safe", effects: { mass: 2 } },
  ],
  devices: [
    // Dark lamp = open doors: the away-window IS the passage window.
    {
      kind: "pressure-plate",
      id: "plate-lamp",
      cellId: "cell-hall",
      threshold: 2,
      targets: [
        { deviceId: "gate-n1", whenPressed: "close" },
        { deviceId: "gate-lobby", whenPressed: "close" },
      ],
    },
    { kind: "gate", id: "gate-n1", initiallyOpen: false },
    { kind: "gate", id: "gate-lobby", initiallyOpen: false },
    // The bell corridor opens only while the rattle is home on the toy.
    {
      kind: "pressure-plate",
      id: "plate-toy",
      cellId: "cell-lobby",
      threshold: 2,
      targets: [{ deviceId: "gate-e1", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-e1", initiallyOpen: false },
    // The vault corridor opens while the scale carries the posted weight.
    {
      kind: "pressure-plate",
      id: "plate-vault",
      cellId: "cell-vault",
      threshold: 3,
      targets: [{ deviceId: "gate-v1", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-v1", initiallyOpen: false },
  ],
  loans: {
    maxRows: 3,
    legalDueBeats: [2, 3, 4, 5, 6, 7, null],
    requiredTokens: ["TOKEN-B", "TOKEN-N", "TOKEN-H"],
  },
  outcomes: [
    { id: "idol-north-out", kind: "entityAt", entityId: "prop-idol-north", cellId: "pad-out" },
    { id: "idol-east-out", kind: "entityAt", entityId: "prop-idol-east", cellId: "pad-out" },
    { id: "idol-vault-out", kind: "entityAt", entityId: "prop-idol-vault", cellId: "pad-out" },
    { id: "ledger-out", kind: "entityAt", entityId: "prop-ledger", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "runner-extracted", kind: "entityInRegion", entityId: "crew-runner", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "lookout-extracted", kind: "entityInRegion", entityId: "crew-lookout", region: "outside" },
    { id: "bright-home", kind: "tokenHome", tokenId: "TOKEN-B" },
    { id: "noisy-home", kind: "tokenHome", tokenId: "TOKEN-N" },
    { id: "heavy-home", kind: "tokenHome", tokenId: "TOKEN-H" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 7 },
};

// ---------------------------------------------------------------------------
// Verified winning traces (asserted by tests/unit/rbm08-10.test.ts)
// ---------------------------------------------------------------------------

export const RBM08_WINNING_ROWS: LoanManifestRow[] = [
  // The chain: rattle home early (east reopens), weight posted mid-run
  // (vault opens), light stays out until the last crossing.
  { rowId: "TOKEN-B->candlestick@2~6", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-candlestick", startBeat: 2, dueBeat: 6 },
  { rowId: "TOKEN-N->decoy@1~2", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 2 },
  { rowId: "TOKEN-H->scale-vault@4~6", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 4, dueBeat: 6 },
];

export function rbm08ReferencePlan(): RbmPlan {
  return {
    rows: RBM08_WINNING_ROWS.map((r) => ({ ...r })),
    commands: {
      // Corridor rooms stay swept through the beat-3 pre-scan; entries b4+.
      4: {
        "crew-helper": { type: "move", to: "cell-north" },
        "crew-runner": { type: "move", to: "cell-east" },
        "crew-lookout": { type: "move", to: "cell-lobby" },
      },
      5: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" },
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-east", to: "pad-out" },
        "crew-lookout": { type: "pickup-and-move", propId: "prop-ledger", to: "pad-out" },
        // The vault scale has been weighted since beat 4 — operator ducks in.
        "crew-operator": { type: "move", to: "cell-vault" },
      },
      6: { "crew-operator": { type: "pickup-and-move", propId: "prop-idol-vault", to: "pad-out" } },
    },
  };
}

/** Alternative schedule: the lamp's away-window shrinks (due 5) and the
 * weight posts earlier (@3~5) — different resource timing, same chain. */
export function rbm08AlternatePlan(): RbmPlan {
  return {
    rows: [
      { rowId: "TOKEN-B->candlestick@2~5", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-candlestick", startBeat: 2, dueBeat: 5 },
      { rowId: "TOKEN-N->decoy@1~2", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 2 },
      { rowId: "TOKEN-H->scale-vault@3~5", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 3, dueBeat: 5 },
    ],
    commands: {
      4: {
        "crew-helper": { type: "move", to: "cell-north" },
        "crew-runner": { type: "move", to: "cell-east" },
        "crew-lookout": { type: "move", to: "cell-lobby" },
        // The earlier posting already holds the vault door open.
        "crew-operator": { type: "move", to: "cell-vault" },
      },
      5: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" },
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-east", to: "pad-out" },
        "crew-lookout": { type: "pickup-and-move", propId: "prop-ledger", to: "pad-out" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-vault", to: "pad-out" },
      },
    },
  };
}

/** Same plan with two due beats swapped: rattle late, lamp early. */
export function rbm08PlanWithDue(tokenId: "TOKEN-B" | "TOKEN-N" | "TOKEN-H", dueBeat: number | null): RbmPlan {
  const plan = rbm08ReferencePlan();
  for (const row of plan.rows) if (row.tokenId === tokenId) row.dueBeat = dueBeat;
  return plan;
}

export const RBM08_CARD: LevelCard = {
  levelId: "rbm-08",
  winningTraceSummary: [
    "Beats 1–2 — Three postings: the rattle to the decoy sack (due 2 — it must come home early), the light to the candlestick at beat 2 (due 6 — the beat-1 settle first registers the weighted lamp, so its release can open the doors), the weight stays home for now.",
    "Beat 2 — NOISY's return presses the toy onto its plate: the bell corridor reopens. The first return of the chain.",
    "Beat 4 — HEAVY lands on the vault scale (@4~6): the vault corridor opens. The rooms stop being swept — entries begin.",
    "Beats 4–5 — Helper, runner and operator clear the three corridors; the lookout takes the lobby ledger while the lamp is still dark.",
    "Beats 6–7 — The hall is swept behind them; everyone is already outside. Both late returns land home.",
  ],
  wrongApproaches: [
    {
      name: "swap-the-due-beats",
      summary: "Swap the identified pair: rattle due 6, lamp due 2.",
      expectedFailure: "gate-e1 stays shut until beat 6 (runner's entry rejected gate-closed) and gate-n1 + gate-lobby slam at the end of beat 2 (helper's entry and lookout's exit rejected gate-closed). The chain only composes in one order.",
    },
    {
      name: "lamp-home-early",
      summary: "Due the light at beat 4 — the doors close mid-operation.",
      expectedFailure: "gate-lobby slams at the end of beat 4 with the lookout still inside; her beat-5 exit is rejected gate-closed and the ledger is stranded.",
    },
    {
      name: "skip-the-early-return",
      summary: "Leave the rattle out on the decoy the whole run.",
      expectedFailure: "gate-e1 never reopens — the runner's corridor entry is rejected gate-closed, and noisy-home fails at the horizon.",
    },
    {
      name: "entry-during-the-sweep",
      summary: "Cross a corridor door at beat 3 — the rooms are still lit by the pre-move scan.",
      expectedFailure: "guard.capture at beat 3 — the beam leaves the door cells only after its beat-3 scan.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a fourth row past the three-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget.",
    },
  ],
  // GME-007 four-contribution map: four distinct contribution types.
  coopNote: [
    "Manifest owner A — commits the lamp and rattle rows; owns the two due beats whose order composes the chain.",
    "Manifest owner B — commits the vault posting on its own schedule, independent of the lamp's chain.",
    "Corridor operators — helper/runner/operator each pilot an inside-out route riding a different door window.",
    "Exit warden — the lookout owns the lobby crossing, the route that exists only while the light is out, and watches the sweep timings.",
  ],
};
