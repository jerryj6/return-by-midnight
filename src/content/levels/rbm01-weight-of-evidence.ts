// RBM-01 "The Weight of Evidence" — mandatory tutorial (master RBM-C).
//
// Locked layout per spec:
//  - safe carrier (crew-helper) inside; loan-tool operator (crew-operator)
//    safely outside behind permanent cover and never crossing the exit.
//  - prop-safe hosts TOKEN-H (HEAVY, +2 mass). prop-crate (mass 1) rests on a
//    pressure plate (threshold 3) linked to the exit gate.
//  - Two movement segments from the safe to the outside pad:
//    room-safe -> cell-approach -> pad-out (gated by the exit).
//  - Guard patrol has no line of sight to the route on beats 1-3; on beat 4 it
//    reaches the interior watch square facing the exit. Its ray crosses the
//    doorway and includes the outside pad ONLY while the exit is open; a closed
//    exit is opaque and blocks the far segment.
//  - Verification horizon: end of beat 4 (RBM-012). Pad arrival earlier is
//    provisional extraction only.
import type { RbmManifest, RbmPlan } from "../../engine/rbm/types";
import { RBM_RULES_VERSION } from "../../engine/rbm/types";

export const RBM01: RbmManifest = {
  levelId: "rbm-01",
  rulesVersion: RBM_RULES_VERSION,
  title: "The Weight of Evidence",
  cells: [
    { id: "room-safe", region: "inside" },
    { id: "cell-approach", region: "inside" },
    { id: "guard-far", region: "inside" },
    { id: "guard-watch", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "room-safe", b: "cell-approach" },
    { a: "cell-approach", b: "pad-out", gateId: "gate-exit" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // Portable safe: base mass 1, carries HEAVY (+2) as its home property.
    { kind: "prop", id: "prop-safe", cellId: "room-safe", baseMass: 1, accepts: [] },
    // Light crate resting on the pressure plate: cannot press it alone (1 < 3).
    { kind: "prop", id: "prop-crate", cellId: "room-safe", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-1" },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "room-safe", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cover-out", massLimit: 0 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      patrol: [
        { beat: 1, cellId: "guard-far" },
        { beat: 2, cellId: "guard-far" },
        { beat: 3, cellId: "guard-far" },
        { beat: 4, cellId: "guard-watch", facing: "exit" },
      ],
      rays: {
        "guard-watch": [
          {
            id: "exit-ray",
            segments: [
              { cells: ["cell-approach"] },
              { cells: ["pad-out"], gatedBy: ["gate-exit"] },
            ],
          },
        ],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-safe", effects: { mass: 2 } },
  ],
  devices: [
    {
      kind: "pressure-plate",
      id: "plate-1",
      cellId: "room-safe",
      threshold: 3,
      targets: [{ deviceId: "gate-exit", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-exit", initiallyOpen: false },
  ],
  loans: {
    maxRows: 1,
    // Finite visible return choices (RBM-002); null = the "keep forever"
    // option the tutorial exposes precisely so it can fail (RBM-C tests).
    legalDueBeats: [1, 2, 3, 4, null],
    requiredTokens: ["TOKEN-H"],
  },
  outcomes: [
    { id: "safe-delivered", kind: "entityAt", entityId: "prop-safe", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "crew-safe", kind: "noCapture" },
    { id: "heavy-returned", kind: "tokenHome", tokenId: "TOKEN-H" },
  ],
  verification: { horizonBeat: 4 },
};

/**
 * The master's exact winning trace (RBM-C): loan at beat 1 due end of beat 3;
 * helper exits room 1 carrying the safe at beat 2; exits through the open gate
 * to the pad at beat 3; waits outside while the return closes the route.
 */
export function rbm01ReferencePlan(): RbmPlan {
  return {
    rows: [
      {
        rowId: "row-token-h",
        tokenId: "TOKEN-H",
        fromHostId: "prop-safe",
        toHostId: "prop-crate",
        startBeat: 1,
        dueBeat: 3,
      },
    ],
    commands: {
      2: { "crew-helper": { type: "pickup-and-move", propId: "prop-safe", to: "cell-approach" } },
      3: { "crew-helper": { type: "move", to: "pad-out" } },
    },
  };
}

/** Alternate due-at-3 plan: the loan activates at beat 2 instead of beat 1. */
export function rbm01AlternatePlan(): RbmPlan {
  return {
    rows: [
      {
        rowId: "row-token-h-alt",
        tokenId: "TOKEN-H",
        fromHostId: "prop-safe",
        toHostId: "prop-crate",
        startBeat: 2,
        dueBeat: 3,
      },
    ],
    commands: {
      2: { "crew-helper": { type: "pickup-and-move", propId: "prop-safe", to: "cell-approach" } },
      3: { "crew-helper": { type: "move", to: "pad-out" } },
    },
  };
}

/** Same movements, but HEAVY is due at the given beat (null = permanent). */
export function rbm01PlanWithDue(dueBeat: number | null): RbmPlan {
  const plan = rbm01ReferencePlan();
  const row = plan.rows[0];
  if (!row) throw new Error("reference plan has no rows");
  plan.rows[0] = { ...row, dueBeat };
  return plan;
}
