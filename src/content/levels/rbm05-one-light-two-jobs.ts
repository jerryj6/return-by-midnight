// RBM-05 "One Light, Two Jobs" — first room of chapter 2 (master §II RBM-D).
// Composition lesson: one token serving sequential jobs with an essential
// home interval.
//
// One BRIGHT token, two recipients, a home sensor that must fire between
// loans. The lantern's light is borrowed twice: onto the mooring bust to open
// the north door, home again (one beat — the engine's inclusive overlap rule
// forces the gap), then onto the ballast urn to open the south door.
//
// Engine-grammar notes (frozen semantics):
// - `loanOverlaps` is INCLUSIVE of the due beat: a second row on the same
//   token must satisfy startBeat >= prior.dueBeat + 1. The one-beat home
//   interval is therefore mechanically enforced; during it the lamp sensor
//   powers (the "essential home job" made visible).
// - Loans always originate at the token's home entity (RBM-002) — a second
//   loan is legal only because the first returned.
// - Each borrower is a prop resting on a plate whose press opens a door; the
//   door is open exactly while the light is on loan to that side.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM05: RbmManifest = {
  levelId: "rbm-05",
  rulesVersion: "rbm-rules/1.0.0",
  title: "One Light, Two Jobs",
  cells: [
    { id: "cell-nursery", region: "inside" },
    { id: "cell-north", region: "inside" },
    { id: "cell-south", region: "inside" },
    // The sealed east wing: unreachable, always empty — the mid-run beam rests here.
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-nursery", b: "cell-north" },
    { a: "cell-nursery", b: "cell-south" },
    { a: "cell-north", b: "pad-out", gateId: "gate-north" },
    { a: "cell-south", b: "pad-out", gateId: "gate-south" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // BRIGHT's home: the nursery lamp. Heavy; the light travels by loan.
    { kind: "prop", id: "prop-lamp", cellId: "cell-nursery", baseMass: 2, accepts: [] },
    // Recipient one: the mooring bust. Hosting BRIGHT presses plate-north.
    { kind: "prop", id: "prop-anchor-north", cellId: "cell-north", baseMass: 1, accepts: ["BRIGHT"], restingOn: "plate-north" },
    // Recipient two: the ballast urn. Hosting BRIGHT presses plate-south.
    { kind: "prop", id: "prop-anchor-south", cellId: "cell-south", baseMass: 1, accepts: ["BRIGHT"], restingOn: "plate-south" },
    { kind: "prop", id: "prop-idol-north", cellId: "cell-north", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-south", cellId: "cell-south", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-nursery", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-nursery", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Scan-before-move ordering: the entry cells stay lit through beat 2;
      // crossings are legal from beat 3 — but the doors decide the real pace.
      patrol: [
        { beat: 1, cellId: "guard-watch" },
        { beat: 2, cellId: "guard-far" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-far" },
        { beat: 6, cellId: "guard-watch", facing: "inward" },
      ],
      rays: {
        "guard-watch": [
          { id: "beam-north", segments: [{ cells: ["cell-north"] }] },
          { id: "beam-south", segments: [{ cells: ["cell-south"] }] },
        ],
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
      },
    },
  ],
  tokens: [
    // The light bundle counts as carried bulk on a prop: mass 1 — enough to
    // tip the thr-2 plates only while the token is physically hosted.
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-lamp", effects: { mass: 1 } },
  ],
  devices: [
    // North door: opens while the bust presses (bust + hosted light = 2).
    {
      kind: "pressure-plate",
      id: "plate-north",
      cellId: "cell-north",
      threshold: 2,
      targets: [{ deviceId: "gate-north", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-north", initiallyOpen: false },
    // South door: same trick, second job.
    {
      kind: "pressure-plate",
      id: "plate-south",
      cellId: "cell-south",
      threshold: 2,
      targets: [{ deviceId: "gate-south", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-south", initiallyOpen: false },
    // The lamp's own telltale: powered while BRIGHT's host stands in the
    // nursery — the home job that must fire between the two loans.
    { kind: "sensor", id: "sensor-lamp", cellId: "cell-nursery", requiresProperty: "BRIGHT" },
  ],
  loans: {
    maxRows: 2,
    legalDueBeats: [3, 4, 5, 6, null],
    requiredTokens: ["TOKEN-B"],
  },
  outcomes: [
    { id: "idol-north-out", kind: "entityAt", entityId: "prop-idol-north", cellId: "pad-out" },
    { id: "idol-south-out", kind: "entityAt", entityId: "prop-idol-south", cellId: "pad-out" },
    { id: "crew-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "bright-home", kind: "tokenHome", tokenId: "TOKEN-B" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 6 },
};

// ---------------------------------------------------------------------------
// Verified winning trace (asserted by tests/unit/rbm05-07.test.ts)
// ---------------------------------------------------------------------------

export const RBM05_WINNING_ROWS: LoanManifestRow[] = [
  // Job one: light the north door for the helper, home at end of beat 4.
  { rowId: "TOKEN-B->anchor-north@1~4", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-north", startBeat: 1, dueBeat: 4 },
  // Home interval: beat-4 settle finds the token home (lamp sensor fires);
  // overlap is inclusive, so the earliest legal reloan starts at beat 5.
  // Job two: light the south door for the operator, home at end of beat 6.
  { rowId: "TOKEN-B->anchor-south@5~6", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-south", startBeat: 5, dueBeat: 6 },
];

export function rbm05ReferencePlan(): RbmPlan {
  return {
    rows: RBM05_WINNING_ROWS.map((r) => ({ ...r })),
    commands: {
      // Beats 1–2: entry cells are swept — both crew hold in the nursery.
      // Beat 3: helper slips into the dark north room (its door is open on loan).
      3: { "crew-helper": { type: "move", to: "cell-north" } },
      // Beat 4: last beat the north door is open — she lifts the idol out;
      // the loan lapses home at the return phase and the door slams.
      4: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" },
        "crew-operator": { type: "move", to: "cell-south" },
      },
      // Beat 6: the south door opened end of beat 5 — operator exits with the idol;
      // BRIGHT comes home to the lamp at the return phase.
      6: { "crew-operator": { type: "pickup-and-move", propId: "prop-idol-south", to: "pad-out" } },
    },
  };
}

/** Alternative allocation: the south job borrows first, north second. */
export function rbm05AlternatePlan(): RbmPlan {
  return {
    rows: [
      { rowId: "TOKEN-B->anchor-south@1~4", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-south", startBeat: 1, dueBeat: 4 },
      { rowId: "TOKEN-B->anchor-north@5~6", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-anchor-north", startBeat: 5, dueBeat: 6 },
    ],
    commands: {
      3: { "crew-operator": { type: "move", to: "cell-south" } },
      4: {
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-south", to: "pad-out" },
        "crew-helper": { type: "move", to: "cell-north" },
      },
      6: { "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" } },
    },
  };
}

export const RBM05_CARD: LevelCard = {
  levelId: "rbm-05",
  winningTraceSummary: [
    "Beat 1 — Loan BRIGHT from the nursery lamp to the mooring bust (due end of beat 4). The north door opens.",
    "Beat 3 — Helper slips into the dark north room; its door is open on loan.",
    "Beat 4 — She lifts the north idol and exits; the loan lapses home — the lamp's telltale fires at the settle (the home job).",
    "Beat 5 — BRIGHT is reloaned from home to the ballast urn (legal only after the one-beat gap); the south door opens at the settle.",
    "Beat 6 — Operator lifts the south idol and exits through the open door; BRIGHT comes home to the lamp.",
  ],
  wrongApproaches: [
    {
      name: "one-loan-two-rooms",
      summary: "Keep the single loan out forever: borrow once, try both doors.",
      expectedFailure: "bright-home fails (tokenHome) and the second door never opens — the other idol is stranded (entityAt).",
    },
    {
      name: "no-home-interval",
      summary: "Reloan starting the same beat the first loan lapses (start 4 after due 4).",
      expectedFailure: "manifest rejected: overlapping-loan — the interval is inclusive of the due beat; the token must sit home one beat.",
    },
    {
      name: "door-closed-crossing",
      summary: "Exit the north room at beat 5, after the first return has shut its door.",
      expectedFailure: "command.rejected — gate-closed at beat 5: the released plate slammed it.",
    },
    {
      name: "early-crossing",
      summary: "Enter either lit room at beat 2 while the beam still sweeps it.",
      expectedFailure: "guard.capture at beat 2 — the pre-move scan still holds the post.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a third row past the two-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget.",
    },
  ],
};
