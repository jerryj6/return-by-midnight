// RBM-10 "The Quietest Exit" — last room of chapter 3 (master §II RBM-D).
// Helpful returns can expose another part of the team.
//
// The engine can express this literally: ray segments carry `gatedBy` — a
// beam stops at a closed door and pours through once it opens. The rattle's
// return is the helpful event (it presses the toy onto plate-toy, unbarring
// BOTH gallery doors for the runner) — and the same opening lets the west
// beam into the vestibule, where the lookout works. Bring the rattle home
// while she is still inside and the beam finds her.
//
// Coordinate passage so the useful return does not reveal a teammate:
// schedule the return after her vestibule visit, or accept a tighter route
// that finishes before the beam's next sweep of that wing.
//
// Engine-grammar notes (frozen semantics):
// - `seg.gatedBy` lists the gates that must ALL be open for the segment to
//   light; vestibule is dark while either gallery door is shut.
// - A teammate escapes the same beat the cell lights if her phase-2 move
//   clears it before the guard's scan — lingering is what gets her caught.
// - The rattle's away-job is real too: posted to the decoy it weights
//   plate-bell and opens the bell loft for the helper.

import type { RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM10: RbmManifest = {
  levelId: "rbm-10",
  rulesVersion: "rbm-rules/1.0.0",
  title: "The Quietest Exit",
  cells: [
    { id: "cell-foyer", region: "inside" },
    { id: "cell-vestibule", region: "inside" },
    { id: "cell-gallery", region: "inside" },
    { id: "cell-attic", region: "inside" },
    { id: "cell-bell", region: "inside" },
    { id: "cell-eastwing", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
  ],
  edges: [
    { a: "pad-out", b: "cell-foyer" },
    { a: "cell-foyer", b: "cell-vestibule" },
    { a: "cell-vestibule", b: "pad-out" },
    { a: "cell-foyer", b: "cell-gallery", gateId: "gate-gallery" },
    { a: "pad-out", b: "cell-gallery", gateId: "gate-gallery-window" },
    { a: "pad-out", b: "cell-attic", gateId: "gate-attic" },
    { a: "pad-out", b: "cell-bell", gateId: "gate-bell" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // NOISY's home: the winding toy weights plate-toy while home.
    { kind: "prop", id: "prop-toy", cellId: "cell-foyer", baseMass: 1, accepts: [], restingOn: "plate-toy" },
    // BRIGHT's home: the foyer lamp.
    { kind: "prop", id: "prop-lamp", cellId: "cell-foyer", baseMass: 1, accepts: [] },
    // The rattle's posting: the decoy sack weights plate-bell while it sings.
    { kind: "prop", id: "prop-decoy", cellId: "cell-foyer", baseMass: 1, accepts: ["NOISY"], restingOn: "plate-bell" },
    // The light's posting: the attic lampstand weights plate-attic.
    { kind: "prop", id: "prop-lampstand", cellId: "cell-attic", baseMass: 1, accepts: ["BRIGHT"], restingOn: "plate-attic" },
    // The take.
    { kind: "prop", id: "prop-idol-bell", cellId: "cell-bell", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-gallery", cellId: "cell-gallery", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-attic", cellId: "cell-attic", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-vest", cellId: "cell-vestibule", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cover-out", massLimit: 1 },
    { kind: "crew", id: "crew-runner", cellId: "cover-out", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cover-out", massLimit: 1 },
    { kind: "crew", id: "crew-lookout", cellId: "cover-out", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Two posts that matter: the west watch sweeps the foyer plus the
      // vestibule THROUGH the gallery door while it stands open; the east
      // watch sweeps gallery and attic. The pad is never covered.
      patrol: [
        { beat: 1, cellId: "guard-west" },
        { beat: 2, cellId: "guard-east" },
        { beat: 3, cellId: "guard-east" },
        { beat: 4, cellId: "guard-far" },
        { beat: 5, cellId: "guard-far" },
        { beat: 6, cellId: "guard-west" },
        { beat: 7, cellId: "guard-west" },
        { beat: 8, cellId: "guard-far" },
      ],
      rays: {
        "guard-west": [
          { id: "beam-foyer", segments: [{ cells: ["cell-foyer"] }] },
          // The vestibule segment exists only through the open gallery door —
          // the helpful return is what lets this beam in.
          { id: "beam-vest", segments: [{ cells: ["cell-vestibule"], gatedBy: ["gate-gallery"] }] },
        ],
        "guard-east": [
          { id: "beam-gal", segments: [{ cells: ["cell-gallery"] }] },
          { id: "beam-att", segments: [{ cells: ["cell-attic"] }] },
        ],
        "guard-far": [{ id: "beam-far", segments: [{ cells: ["cell-eastwing"] }] }],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-N", property: "NOISY", homeEntityId: "prop-toy", effects: { mass: 1, emitsSound: true } },
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-lamp", effects: { mass: 1 } },
  ],
  devices: [
    // The helpful return: the toy weighted home presses plate-toy and unbars
    // BOTH gallery doors — foyer side and delivery window alike.
    {
      kind: "pressure-plate",
      id: "plate-toy",
      cellId: "cell-foyer",
      threshold: 2,
      targets: [
        { deviceId: "gate-gallery", whenPressed: "open" },
        { deviceId: "gate-gallery-window", whenPressed: "open" },
      ],
    },
    { kind: "gate", id: "gate-gallery", initiallyOpen: false },
    { kind: "gate", id: "gate-gallery-window", initiallyOpen: false },
    // The rattle's away job: the singing sack opens the bell loft.
    {
      kind: "pressure-plate",
      id: "plate-bell",
      cellId: "cell-foyer",
      threshold: 2,
      targets: [{ deviceId: "gate-bell", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-bell", initiallyOpen: false },
    // The light's away job: the posted lamp opens the attic.
    {
      kind: "pressure-plate",
      id: "plate-attic",
      cellId: "cell-attic",
      threshold: 2,
      targets: [{ deviceId: "gate-attic", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-attic", initiallyOpen: false },
  ],
  loans: {
    maxRows: 2,
    legalDueBeats: [3, 4, 5, 6, 7, null],
    requiredTokens: ["TOKEN-N", "TOKEN-B"],
  },
  outcomes: [
    { id: "idol-bell-out", kind: "entityAt", entityId: "prop-idol-bell", cellId: "pad-out" },
    { id: "idol-gallery-out", kind: "entityAt", entityId: "prop-idol-gallery", cellId: "pad-out" },
    { id: "idol-attic-out", kind: "entityAt", entityId: "prop-idol-attic", cellId: "pad-out" },
    { id: "idol-vest-out", kind: "entityAt", entityId: "prop-idol-vest", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "runner-extracted", kind: "entityInRegion", entityId: "crew-runner", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "lookout-extracted", kind: "entityInRegion", entityId: "crew-lookout", region: "outside" },
    { id: "noisy-home", kind: "tokenHome", tokenId: "TOKEN-N" },
    { id: "bright-home", kind: "tokenHome", tokenId: "TOKEN-B" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 8 },
};

// ---------------------------------------------------------------------------
// Verified winning traces (asserted by tests/unit/rbm08-10.test.ts)
// ---------------------------------------------------------------------------

/** Strategy A — cautious: the rattle comes home at beat 5, after the
 * lookout's vestibule visit is over; the runner takes the outside window. */
export function rbm10ReferencePlan(): RbmPlan {
  return {
    rows: [
      { rowId: "TOKEN-N->decoy@1~5", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 5 },
      { rowId: "TOKEN-B->lampstand@1~7", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-lampstand", startBeat: 1, dueBeat: 7 },
    ],
    commands: {
      1: {
        "crew-helper": { type: "move", to: "pad-out" },
        "crew-runner": { type: "move", to: "pad-out" },
        "crew-operator": { type: "move", to: "pad-out" },
        "crew-lookout": { type: "move", to: "pad-out" },
      },
      // Bell loft open while the rattle sings in the sack.
      2: { "crew-helper": { type: "move", to: "cell-bell" } },
      3: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-bell", to: "pad-out" },
        // Foyer is dark at beat 3 — the lookout slips in before the return.
        "crew-lookout": { type: "move", to: "cell-foyer" },
      },
      4: {
        "crew-lookout": { type: "move", to: "cell-vestibule" },
      },
      5: {
        "crew-lookout": { type: "pickup-and-move", propId: "prop-idol-vest", to: "pad-out" },
        // The east watch only just left the attic — its beat-4 pre-scan still
        // covers the entry, so the operator goes in at beat 5.
        "crew-operator": { type: "move", to: "cell-attic" },
      },
      // Beat 5's settle: the rattle lands home, gallery unbars, the vestibule
      // goes under the beam — the lookout is already gone.
      6: {
        "crew-runner": { type: "move", to: "cell-gallery" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-attic", to: "pad-out" },
      },
      7: { "crew-runner": { type: "pickup-and-move", propId: "prop-idol-gallery", to: "pad-out" } },
    },
  };
}

/** Strategy B — bold: the rattle returns at beat 3 and the runner uses the
 * INSIDE corridor (foyer→gallery) instead of the window. Tradeoff: the
 * gallery job finishes two beats sooner, but the bell loft's posting window
 * shrinks to beats 2–3 — the helper's visit must be immediate. */
export function rbm10AlternatePlan(): RbmPlan {
  return {
    rows: [
      { rowId: "TOKEN-N->decoy@1~3", tokenId: "TOKEN-N", fromHostId: "prop-toy", toHostId: "prop-decoy", startBeat: 1, dueBeat: 3 },
      { rowId: "TOKEN-B->lampstand@1~7", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-lampstand", startBeat: 1, dueBeat: 7 },
    ],
    commands: {
      1: {
        "crew-helper": { type: "move", to: "pad-out" },
        "crew-runner": { type: "move", to: "pad-out" },
        "crew-operator": { type: "move", to: "pad-out" },
        "crew-lookout": { type: "move", to: "pad-out" },
      },
      2: { "crew-helper": { type: "move", to: "cell-bell" } },
      3: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-bell", to: "pad-out" },
        "crew-lookout": { type: "move", to: "cell-foyer" },
      },
      4: {
        "crew-lookout": { type: "move", to: "cell-vestibule" },
        "crew-runner": { type: "move", to: "cell-foyer" },
      },
      5: {
        "crew-lookout": { type: "pickup-and-move", propId: "prop-idol-vest", to: "pad-out" },
        "crew-operator": { type: "move", to: "cell-attic" },
        // The corridor route: through the foyer into the gallery (open since
        // the beat-3 return) — two beats earlier than the window route.
        "crew-runner": { type: "move", to: "cell-gallery" },
      },
      6: {
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-gallery", to: "pad-out" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-idol-attic", to: "pad-out" },
      },
    },
  };
}

export const RBM10_CARD: LevelCard = {
  levelId: "rbm-10",
  winningTraceSummary: [
    "Beat 1 — The rattle is lent to the decoy sack (the bell loft opens while it sings); the light to the attic lampstand (the attic opens). The vestibule is dark only while the gallery door stays shut.",
    "Beats 2–4 — Helper clears the bell loft; lookout slips through the dark foyer into the vestibule.",
    "Beat 5 — Lookout leaves by the hatch before the rattle lands home: the return presses the toy, unbarring both gallery doors — and pours the west beam into the now-empty vestibule.",
    "Beats 6–7 — Runner takes the delivery window into the open gallery and out with the idol.",
    "Alternative — bring the rattle home at beat 3 and send the runner through the inside corridor instead: same take, earlier finish, a tighter bell window.",
  ],
  wrongApproaches: [
    {
      name: "linger-in-the-vestibule",
      summary: "Return the rattle while the lookout still waits in the vestibule (idle through beat 6).",
      expectedFailure: "guard.capture — the opened gallery door lets the west beam into the vestibule; the helpful return exposes her.",
    },
    {
      name: "bell-shut-early",
      summary: "Due the rattle at beat 2: the sack goes quiet before the helper leaves the bell loft.",
      expectedFailure: "gate-bell seals at the beat-2 settle; her beat-3 exit is rejected gate-closed and the bell idol is stranded.",
    },
    {
      name: "never-return-the-rattle",
      summary: "Keep the rattle on the decoy forever — the vestibule stays dark, at a price.",
      expectedFailure: "Both gallery doors stay shut (runner's entry rejected gate-closed) and noisy-home fails — the exposure and the opening are the same event.",
    },
    {
      name: "borrower-mismatch",
      summary: "Lend BRIGHT to the decoy sack (a NOISY host).",
      expectedFailure: "manifest rejected: incompatible-host — the sack only takes the rattle.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a third row past the two-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget.",
    },
  ],
  // GME-007 four-contribution map: four distinct contribution types.
  coopNote: [
    "Manifest owner A — commits the rattle row; owns the due beat that opens the gallery AND exposes the vestibule.",
    "Manifest owner B — commits the lamp row; independent posting on a parallel schedule.",
    "Outside operators — helper, runner and operator each pilot pad-side entries riding different door windows.",
    "Exposure warden — the lookout owns the vestibule visit and reads the beam windows; her exit beat bounds when the return may land.",
  ],
};
