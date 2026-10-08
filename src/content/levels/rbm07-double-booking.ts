// RBM-07 "Double Booking" — chapter-2 capstone (master §II RBM-D). Resource
// conflicts require negotiation: three crew, two scarce tokens, overlapping
// useful intervals.
//
// Two doors need HEAVY on their scale — the north scale for the helper's
// corridor, the vault scale for the runner's — but the token can only be
// posted to one at a time, and the ledger won't take two rows over the same
// beats. The east door wants NOISY's jingle (mass on the decoy's plate) for
// the operator. No extra tokens appear with the extra humans; the conflict is
// resolved by ordering the HEAVY jobs back-to-back with its forced home
// interval.
//
// Engine-grammar notes (frozen semantics):
// - Sequential reuse is the only legal way one token serves two fixtures:
//   inclusive overlap means due 4 → earliest reloan start 5.
// - Gates are open exactly while their prop hosts the required token mass —
//   the "useful interval" is concrete and inspectable.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM07: RbmManifest = {
  levelId: "rbm-07",
  rulesVersion: "rbm-rules/1.0.0",
  title: "Double Booking",
  cells: [
    { id: "cell-hub", region: "inside" },
    { id: "cell-north", region: "inside" },
    { id: "cell-east", region: "inside" },
    { id: "cell-vault", region: "inside" },
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-hub", b: "cell-north", gateId: "gate-north" },
    { a: "cell-hub", b: "cell-east", gateId: "gate-east" },
    { a: "cell-hub", b: "cell-vault", gateId: "gate-vault" },
    // Each side room has a free window straight outside.
    { a: "cell-north", b: "pad-out" },
    { a: "cell-east", b: "pad-out" },
    { a: "cell-vault", b: "pad-out" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // HEAVY's home.
    { kind: "prop", id: "prop-safe", cellId: "cell-hub", baseMass: 1, accepts: [] },
    // Scale one: the north corridor's counterweight. HEAVY posted here opens gate-north.
    { kind: "prop", id: "prop-scale-north", cellId: "cell-north", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-north" },
    // Scale two: the vault corridor's counterweight. HEAVY posted here opens gate-vault.
    { kind: "prop", id: "prop-scale-vault", cellId: "cell-vault", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-vault" },
    // NOISY's home: the winding toy.
    { kind: "prop", id: "prop-toy", cellId: "cell-hub", baseMass: 1, accepts: [] },
    // The decoy sack: NOISY's borrower. Its hosted jingle weights plate-east.
    { kind: "prop", id: "prop-decoy", cellId: "cell-east", baseMass: 1, accepts: ["NOISY"], restingOn: "plate-east" },
    { kind: "prop", id: "prop-idol-north", cellId: "cell-north", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-east", cellId: "cell-east", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-vault", cellId: "cell-vault", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-hub", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-hub", massLimit: 1 },
    { kind: "crew", id: "crew-runner", cellId: "cell-hub", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Scan-before-move: the three door cells are swept through beat 1 and
      // the hub itself is swept at the final scan — be gone by midnight.
      patrol: [
        { beat: 1, cellId: "guard-watch" },
        { beat: 2, cellId: "guard-far" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-far" },
        { beat: 6, cellId: "guard-far" },
        { beat: 7, cellId: "guard-last", facing: "hub" },
      ],
      rays: {
        "guard-watch": [
          { id: "beam-n", segments: [{ cells: ["cell-north"] }] },
          { id: "beam-e", segments: [{ cells: ["cell-east"] }] },
          { id: "beam-v", segments: [{ cells: ["cell-vault"] }] },
        ],
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
        "guard-last": [{ id: "beam-hub", segments: [{ cells: ["cell-hub"] }] }],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-safe", effects: { mass: 2 } },
    { id: "TOKEN-N", property: "NOISY", homeEntityId: "prop-toy", effects: { mass: 1, emitsSound: true } },
  ],
  devices: [
    // North corridor: opens while the scale hosts the weight (1+2=3).
    {
      kind: "pressure-plate",
      id: "plate-north",
      cellId: "cell-north",
      threshold: 3,
      targets: [{ deviceId: "gate-north", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-north", initiallyOpen: false },
    // Vault corridor: the second job for the same scarce weight.
    {
      kind: "pressure-plate",
      id: "plate-vault",
      cellId: "cell-vault",
      threshold: 3,
      targets: [{ deviceId: "gate-vault", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-vault", initiallyOpen: false },
    // East corridor: opens while the decoy hosts the jingle (1+1=2).
    {
      kind: "pressure-plate",
      id: "plate-east",
      cellId: "cell-east",
      threshold: 2,
      targets: [{ deviceId: "gate-east", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-east", initiallyOpen: false },
  ],
  loans: {
    maxRows: 3,
    legalDueBeats: [3, 4, 5, 6, 7, null],
    requiredTokens: ["TOKEN-H", "TOKEN-N"],
  },
  outcomes: [
    { id: "idol-north-out", kind: "entityAt", entityId: "prop-idol-north", cellId: "pad-out" },
    { id: "idol-east-out", kind: "entityAt", entityId: "prop-idol-east", cellId: "pad-out" },
    { id: "idol-vault-out", kind: "entityAt", entityId: "prop-idol-vault", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "runner-extracted", kind: "entityInRegion", entityId: "crew-runner", region: "outside" },
    { id: "heavy-home", kind: "tokenHome", tokenId: "TOKEN-H" },
    { id: "noisy-home", kind: "tokenHome", tokenId: "TOKEN-N" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 7 },
};

// ---------------------------------------------------------------------------
// Verified winning traces (asserted by tests/unit/rbm05-07.test.ts)
// ---------------------------------------------------------------------------

export const RBM07_WINNING_ROWS: LoanManifestRow[] = [
  // Scarce weight, job one: the north scale — helper's corridor.
  { rowId: "TOKEN-H->scale-north@1~4", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-north", startBeat: 1, dueBeat: 4 },
  // Forced home interval at beat 4's settle, then job two: the vault scale.
  { rowId: "TOKEN-H->scale-vault@5~7", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 5, dueBeat: 7 },
  // The jingle's one job: east door for the operator, all run long.
  { rowId: "TOKEN-N->decoy@1~7", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 7 },
];

export function rbm07ReferencePlan(): RbmPlan {
  return {
    rows: RBM07_WINNING_ROWS.map((r) => ({ ...r })),
    commands: {
      // Beats 1–2: the door cells are swept (the beam leaves only after the
      // beat-2 scan) — everyone holds in the hub.
      // Beat 3: helper through the open north door; operator through the east.
      3: {
        "crew-helper": { type: "move", to: "cell-north" },
        "crew-operator": { type: "move", to: "cell-east" },
      },
      // Beat 4: both lift their idols and leave by the free windows — just
      // before HEAVY's first posting lapses home.
      4: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-east", to: "pad-out" },
      },
      // Beats 4–5: HEAVY comes home (its interval), then is reposted to the
      // vault scale — the vault door opens at the end of beat 5.
      // Beat 6: runner ducks in; beat 7: out the window with the vault idol
      // before the last scan finds the hub.
      6: { "crew-runner": { type: "move", to: "cell-vault" } },
      7: { "crew-runner": { type: "pickup-and-move", propId: "prop-idol-vault", to: "pad-out" } },
    },
  };
}

/** Alternative allocation: vault job first, north job second — the conflict
 * resolves by reordering the jobs instead of the crews. */
export function rbm07AlternatePlan(): RbmPlan {
  return {
    rows: [
      { rowId: "TOKEN-H->scale-vault@1~4", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-vault", startBeat: 1, dueBeat: 4 },
      { rowId: "TOKEN-H->scale-north@5~7", tokenId: "TOKEN-H", fromHostId: "prop-safe", toHostId: "prop-scale-north", startBeat: 5, dueBeat: 7 },
      { rowId: "TOKEN-N->decoy@1~7", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 7 },
    ],
    commands: {
      3: {
        "crew-runner": { type: "move", to: "cell-vault" },
        "crew-operator": { type: "move", to: "cell-east" },
      },
      4: {
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-vault", to: "pad-out" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-east", to: "pad-out" },
      },
      6: { "crew-helper": { type: "move", to: "cell-north" } },
      7: { "crew-helper": { type: "pickup-and-move", propId: "prop-idol-north", to: "pad-out" } },
    },
  };
}

export const RBM07_CARD: LevelCard = {
  levelId: "rbm-07",
  insight: "Three rows, three jobs — the ledger forbids double-booking, and the jingle must be home inside the patrol hearing window.",
  naiveApproach: "Hold the weight on the vault scale all run (monopolize) — the scale job works but the door leg dies.",
  solutionPolicy: "Rattle due 3–6 tolerated; several ±1 retimes pass. The ordering constraint (vault after repost) is the real lock.",
  winningTraceSummary: [
    "Beat 1 — Three doors, two tokens: HEAVY posts to the north scale (due 4) and NOISY to the decoy sack (due 7). North and east corridors open; the vault stays shut — the weight can only be in one place.",
    "Beat 3 — Helper through the open north door; operator through the east (the door cells stay swept through beat 2).",
    "Beat 4 — Both lift their idols and leave by the free windows; HEAVY's first posting lapses home.",
    "Beats 4–5 — HEAVY's home interval, then the reloan to the vault scale (the only legal order — overlapping intervals are rejected). The vault door opens at the end of beat 5.",
    "Beats 6–7 — Runner takes the vault corridor and exits with the third idol before the last scan finds the hub.",
  ],
  wrongApproaches: [
    {
      name: "double-booking",
      summary: "Book HEAVY to both scales at once (rows @1~4 and @3~7).",
      expectedFailure: "manifest rejected: overlapping-loan — the weight cannot sit on two scales; the second booking must start after the first lapses home.",
    },
    {
      name: "monopolize-the-weight",
      summary: "Post HEAVY to the vault scale for the whole run and still try the north corridor.",
      expectedFailure: "gate-north never opens — the helper's beat-2 move is rejected gate-closed and the north idol is stranded (entityAt).",
    },
    {
      name: "forget-the-jingle",
      summary: "Schedule only HEAVY's two loans; assume three crew means three keys.",
      expectedFailure: "plan.complete fails: the manifest is missing the required TOKEN-N row — no extra tokens appear with extra humans.",
    },
    {
      name: "vault-before-the-repost",
      summary: "Send the runner into the vault at beat 4 — before the second loan has powered its scale.",
      expectedFailure: "command.rejected — gate-closed at beat 4: the vault scale hosts nothing until beat 5's settle.",
    },
    {
      name: "early-door-rush",
      summary: "Cross a corridor door at beat 1 — the powered door is still inside the opening beam.",
      expectedFailure: "guard.capture at beat 1 — the doors power at phase 1, but the beam still sweeps them; wait for the window.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a fourth row past the three-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget.",
    },
  ],
};
