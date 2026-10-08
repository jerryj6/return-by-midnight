// RBM-04 "The Traveling Owner" — fourth room of the Return by Midnight
// curriculum (master §II RBM-D). Combines the taught property HEAVY (RBM-01)
// with the lesson that a home object's motion changes WHERE a return lands.
//
// Lesson: schedule the return for the owner's new location, not its original
// cell. The safe — HEAVY's immutable home — is carted off its alarm plate and
// up to the vault. HEAVY is due home the beat the safe arrives; the return
// overloads the carrier and the weight settles the safe exactly where it is:
// inside the vault. A return scheduled for the gallery lands there instead.
//
// Engine-grammar notes (frozen semantics — honest adaptation):
// - The engine has no self-moving props; "a fixture moves the home owner" is
//   expressed by the alarm plate whose state tracks the owner's position:
//   plate-alarm presses while the safe rests (or settles) anywhere, releasing
//   the lobby gate only while the safe is carried — and slamming it again the
//   moment the returned weight drops the safe inside the vault.
// - cargo.settled (RBM-004) is the mechanic under test: a HEAVY return to
//   carried cargo over capacity deposits the prop at the carrier's current
//   valid cell. The return beat, not the route, chooses the landing site.
// - sensor-vault (requiresProperty HEAVY) is the visible dependency: it powers
//   only once the weight is physically home inside the vault.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM04: RbmManifest = {
  levelId: "rbm-04",
  rulesVersion: "rbm-rules/1.0.0",
  title: "The Traveling Owner",
  cells: [
    { id: "cell-gallery", region: "inside" },
    { id: "cell-lobby", region: "inside" },
    { id: "cell-vault", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "cell-gallery", b: "cell-lobby", gateId: "gate-lobby" },
    { a: "cell-lobby", b: "cell-vault" },
    // The vault's own delivery window — ungated, straight outside.
    { a: "cell-vault", b: "pad-out" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // HEAVY's home — and the prize. It rests on the gallery's alarm plate,
    // pinning the lobby gate shut until somebody lifts it.
    { kind: "prop", id: "prop-safe", cellId: "cell-gallery", baseMass: 1, accepts: [], restingOn: "plate-alarm" },
    // The transport crate: HEAVY's borrower. Lending the weight away is what
    // makes the safe portable at all (mass 3 → 1).
    { kind: "prop", id: "prop-crate", cellId: "cell-gallery", baseMass: 1, accepts: ["HEAVY"] },
    // A dim night lamp — flavor host for the second token (used by the
    // over-budget counterexample only; the contract needs HEAVY alone).
    { kind: "prop", id: "prop-nightlamp", cellId: "cell-lobby", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-gallery", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cover-out", massLimit: 0, accepts: ["BRIGHT"] },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Guards scan at their PREVIOUS post before stepping (engine phase 3):
      // the north beam holds the lobby through beat 2 and sweeps the gallery
      // from the south post on beats 3–4 while the helper is already past it.
      patrol: [
        { beat: 1, cellId: "watch-north" },
        { beat: 2, cellId: "watch-south" },
        { beat: 3, cellId: "watch-south" },
        { beat: 4, cellId: "watch-south" },
        { beat: 5, cellId: "watch-north", facing: "lobby" },
      ],
      rays: {
        // Early: the lobby approach is swept — wait for the south patrol.
        "watch-north": [{ id: "beam-lobby", segments: [{ cells: ["cell-lobby"] }] }],
        // Mid-run: the outside pad, seen through the lobby door. The open
        // lobby gate would expose it; the dropped safe closes it (one beat
        // after the settle — engine phase 5 presses plates before it settles
        // overloaded cargo).
        "watch-south": [
          { id: "beam-pad", segments: [{ cells: ["pad-out"], gatedBy: ["gate-lobby"] }] },
        ],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-safe", effects: { mass: 2 } },
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-nightlamp", effects: {} },
  ],
  devices: [
    // The alarm plate under the safe: while it presses, the lobby gate is shut.
    {
      kind: "pressure-plate",
      id: "plate-alarm",
      cellId: "cell-gallery",
      threshold: 3,
      targets: [{ deviceId: "gate-lobby", whenPressed: "close" }],
    },
    { kind: "gate", id: "gate-lobby", initiallyOpen: false },
    // The vault's weight-sense: powered only while HEAVY's host stands in the
    // vault — the visible proof the return landed at the new location.
    { kind: "sensor", id: "sensor-vault", cellId: "cell-vault", requiresProperty: "HEAVY" },
  ],
  loans: {
    maxRows: 1,
    legalDueBeats: [2, 3, 4, 5, null],
    requiredTokens: ["TOKEN-H"],
  },
  outcomes: [
    { id: "safe-vaulted", kind: "entityAt", entityId: "prop-safe", cellId: "cell-vault" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "heavy-returned", kind: "tokenHome", tokenId: "TOKEN-H" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 6 },
};

// ---------------------------------------------------------------------------
// Verified winning trace (asserted by tests/unit/rbm02-04.test.ts)
// ---------------------------------------------------------------------------

/** HEAVY rides on the crate, due home the beat the safe reaches the vault. */
// The loan activates at beat 2 — letting the alarm plate register one settle
// while the heavy safe still rests on it (pressed → close is what holds
// gate-lobby shut until the weight leaves).
export const RBM04_WINNING_ROW: LoanManifestRow = {
  rowId: "TOKEN-H->prop-crate@2~4",
  tokenId: "TOKEN-H",
  fromHostId: "prop-safe",
  toHostId: "prop-crate",
  startBeat: 2,
  dueBeat: 4,
};

export function rbm04ReferencePlan(): RbmPlan {
  return {
    rows: [{ ...RBM04_WINNING_ROW }],
    commands: {
      // Beat 2: lift the safe while the lobby is still swept — the gate opens
      // under it; the helper waits holding the lightened safe.
      2: { "crew-helper": { type: "pickup", propId: "prop-safe" } },
      // Beats 3–4: the beam is south; carry the owner through the lobby to the vault.
      3: { "crew-helper": { type: "move", to: "cell-lobby" } },
      4: { "crew-helper": { type: "move", to: "cell-vault" } },
      // Beat 4 (return phase): HEAVY comes home to the carried safe; over
      // capacity, it settles inside the vault. Beat 5 the helper holds while
      // the alarm plate re-presses and the lobby gate slams behind; beat 6
      // she steps out the delivery window.
      6: { "crew-helper": { type: "move", to: "pad-out" } },
    },
  };
}

/** Same route, with the loan due at a different beat (counterexample builder). */
export function rbm04PlanWithDue(dueBeat: number | null): RbmPlan {
  const plan = rbm04ReferencePlan();
  plan.rows[0] = { ...RBM04_WINNING_ROW, dueBeat };
  return plan;
}

export const RBM04_CARD: LevelCard = {
  levelId: "rbm-04",
  insight: "HEAVY returns to wherever its home object IS — lighten the safe to move it, then let the returning mass land inside the vault.",
  naiveApproach: "Return the weight to the old shelf (due 2) — it settles in the gallery, not the vault.",
  solutionPolicy: "due 4–5 win; the vault leg tolerates a one-beat early retime.",
  winningTraceSummary: [
    "Beat 1 — The heavy safe presses the alarm plate; the lobby gate is shut.",
    "Beat 2 — Loan HEAVY from the safe to the transport crate (due end of beat 4). The safe lightens to mass 1 and the plate releases the lobby gate; the helper lifts the safe.",
    "Beats 3–4 — The beam is south; she carts the owner through the lobby into the vault.",
    "Beat 4 (return phase) — HEAVY comes home to the carried safe; over capacity, it settles — landing inside the vault, where the weight-sense wakes.",
    "Beat 5 — The returned weight re-presses the alarm plate; the lobby gate slams shut behind the crew.",
    "Beat 6 — The helper steps out the delivery window while the returning beam sweeps an empty lobby.",
  ],
  wrongApproaches: [
    {
      name: "return-at-the-old-shelf",
      summary: "Due HEAVY at beat 2 — the schedule assumes the owner still sits on the gallery plate.",
      expectedFailure: "The return lands on the carried safe in the gallery; cargo.settled drops it there and safe-vaulted fails (entityAt). sensor-vault never powers.",
    },
    {
      name: "keep-forever",
      summary: "Never return HEAVY: the lightened safe rides all the way to the pad.",
      expectedFailure: "heavy-returned fails (tokenHome) and safe-vaulted fails — the safe walks out instead of landing in the vault.",
    },
    {
      name: "mid-route-return",
      summary: "Due HEAVY at beat 3 — the owner is only halfway up the lobby.",
      expectedFailure: "The return lands on the carried safe in the lobby; cargo.settled drops it there and safe-vaulted fails (entityAt).",
    },
    {
      name: "leave-the-owner",
      summary: "Extract the helper without ever lifting the safe.",
      expectedFailure: "safe-vaulted fails (entityAt) — the owner never traveled; the alarm plate never released.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a second row (any compatible borrower) past the one-row budget.",
      expectedFailure: "manifest rejected: manifest-over-budget — the ledger holds one row.",
    },
    {
      name: "double-booking",
      summary: "Commit a second loan over the same token.",
      expectedFailure: "manifest rejected: overlapping-loan — no re-lending or renewal.",
    },
  ],
};
