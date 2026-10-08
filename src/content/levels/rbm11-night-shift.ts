// RBM-11 "Night Shift" — second room of chapter 4 (master §II RBM-D).
// Mastery lesson: two wings share ONE return schedule and limited tokens;
// each wing's local solution competes for a token or timing window, and only
// an integrated schedule serves both.
//
// The trick is the key crossover. The west corridor wants HEAVY on its scale
// while its delivery window wants NOISY on its chime — and the east wing wants
// the exact opposite pair. A wing-local manifest ("my corridor key plus my
// window key, all night") books each token twice over the same beats and the
// ledger refuses it. The only way through is to treat the manifest as a
// single night-shift board: both corridors run the early shift, then each
// token comes home and crosses to the OTHER wing's window for the late shift.
//
// Engine-grammar notes (frozen semantics — honest adaptation):
// - loanOverlaps is INCLUSIVE of the due beat: the first posting must lapse
//   home (return phase of beat 5) before the second may start (beat 6). The
//   half-time swap is therefore mechanically enforced.
// - Gates are open exactly while their counterweight/chime hosts the posted
//   token; when it goes home the plate releases and the door slams (end of
//   the due beat, phase 5).
// - Guards scan at their PREVIOUS post before stepping: the dome beam holds
//   both wing mouths through beat 2 — entries are legal from beat 3.
// - The midnight post's rays reach the pad only through an OPEN wing window;
//   every exit posting must be due by beat 8 so the sweep at beat 9 finds
//   the pad dark (RBM-01's sealed-door lesson at campaign scale).
// - A token-weighted counterweight cannot be lifted (mass over limit), so
//   the posted keys physically pin their fixtures for the shift.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM11: RbmManifest = {
  levelId: "rbm-11",
  rulesVersion: "rbm-rules/1.0.0",
  title: "Night Shift",
  cells: [
    // The rotunda: shared hub under the dome. Crew start here; the loan
    // desk's tokens live here.
    { id: "cell-rotunda", region: "inside" },
    // West wing: display room, then the deep end with the delivery window.
    { id: "cell-west", region: "inside" },
    { id: "cell-westend", region: "inside" },
    // East wing: mirrored.
    { id: "cell-east", region: "inside" },
    { id: "cell-eastend", region: "inside" },
    // The sealed loft: unreachable and always empty — the beam rests here
    // during the working beats (the dark middle of the patrol).
    { id: "cell-loft", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
    // Guard posts (unreachable cells, per campaign convention).
    { id: "post-dome", region: "inside" },
    { id: "post-dark", region: "inside" },
    { id: "post-midnight", region: "inside" },
  ],
  edges: [
    { a: "cell-rotunda", b: "cell-west", gateId: "gate-west" },
    { a: "cell-west", b: "cell-westend" },
    { a: "cell-rotunda", b: "cell-east", gateId: "gate-east" },
    { a: "cell-east", b: "cell-eastend" },
    // Each wing's deep end has its own delivery window to the pad — the only
    // way out; the rotunda has no exterior door.
    { a: "cell-westend", b: "pad-out", gateId: "gate-west-win" },
    { a: "cell-eastend", b: "pad-out", gateId: "gate-east-win" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // HEAVY's home: the grand counterweight on the rotunda's loan desk.
    // A floor piece — too massive to carry (keeps the schedule honest).
    { kind: "prop", id: "prop-counter", cellId: "cell-rotunda", baseMass: 2, accepts: [] },
    // NOISY's home: the wind-up toy beside it. Same story.
    { kind: "prop", id: "prop-windup", cellId: "cell-rotunda", baseMass: 2, accepts: [] },
    // The west door's counterweight scale: hosting HEAVY opens gate-west.
    { kind: "prop", id: "prop-scale-w", cellId: "cell-west", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-w-door" },
    // The east window's ballast scale: hosting HEAVY opens gate-east-win —
    // the SAME token the west corridor is built on.
    { kind: "prop", id: "prop-scale-e", cellId: "cell-eastend", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-e-win" },
    // The east door's chime stand: hosting NOISY opens gate-east.
    { kind: "prop", id: "prop-chime-e", cellId: "cell-east", baseMass: 1, accepts: ["NOISY"], restingOn: "plate-e-door" },
    // The west window's chime stand: hosting NOISY opens gate-west-win —
    // the SAME token the east corridor is built on.
    { kind: "prop", id: "prop-chime-w", cellId: "cell-westend", baseMass: 1, accepts: ["NOISY"], restingOn: "plate-w-win" },
    // The prizes: one in each wing's mouth room, one in each deep end.
    { kind: "prop", id: "prop-idol-w", cellId: "cell-west", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-scroll-w", cellId: "cell-westend", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-idol-e", cellId: "cell-east", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-scroll-e", cellId: "cell-eastend", baseMass: 1, accepts: [] },
  ],
  crew: [
    // Four fixed crew, two per wing (RBM-011): west pair and east pair.
    { kind: "crew", id: "crew-helper", cellId: "cell-rotunda", massLimit: 1 },
    { kind: "crew", id: "crew-scout", cellId: "cell-rotunda", massLimit: 1 },
    { kind: "crew", id: "crew-runner", cellId: "cell-rotunda", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-rotunda", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // Scan-before-move (engine phase 3): the dome beam still holds both
      // wing mouths during the beat-2 scan before it steps away — the
      // working window opens at beat 3, not beat 2.
      patrol: [
        { beat: 1, cellId: "post-dome" },
        { beat: 2, cellId: "post-dark" },
        { beat: 3, cellId: "post-dark" },
        { beat: 4, cellId: "post-dark" },
        { beat: 5, cellId: "post-dark" },
        { beat: 6, cellId: "post-dark" },
        { beat: 7, cellId: "post-dark" },
        { beat: 8, cellId: "post-dark" },
        { beat: 9, cellId: "post-midnight", facing: "pad" },
      ],
      rays: {
        // Early: both wing mouths are swept — no entries yet.
        "post-dome": [
          { id: "beam-west", segments: [{ cells: ["cell-west"] }] },
          { id: "beam-east", segments: [{ cells: ["cell-east"] }] },
        ],
        // Working beats: the beam rests on the sealed loft.
        "post-dark": [{ id: "beam-loft", segments: [{ cells: ["cell-loft"] }] }],
        // Midnight: the last sweep reaches the pad through any wing window
        // still open — a loan left out keeps a door lit. Every window must
        // have slammed by then.
        "post-midnight": [
          { id: "beam-pad-west", segments: [{ cells: ["pad-out"], gatedBy: ["gate-west-win"] }] },
          { id: "beam-pad-east", segments: [{ cells: ["pad-out"], gatedBy: ["gate-east-win"] }] },
        ],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-counter", effects: { mass: 2 } },
    { id: "TOKEN-N", property: "NOISY", homeEntityId: "prop-windup", effects: { mass: 1, emitsSound: true } },
  ],
  devices: [
    // West corridor: opens while the west scale hosts the weight (1+2=3).
    {
      kind: "pressure-plate",
      id: "plate-w-door",
      cellId: "cell-west",
      threshold: 3,
      targets: [{ deviceId: "gate-west", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-west", initiallyOpen: false },
    // East corridor: opens while the east chime hosts the rattle (1+1=2).
    {
      kind: "pressure-plate",
      id: "plate-e-door",
      cellId: "cell-east",
      threshold: 2,
      targets: [{ deviceId: "gate-east", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-east", initiallyOpen: false },
    // West delivery window: opens while the west chime hosts NOISY.
    {
      kind: "pressure-plate",
      id: "plate-w-win",
      cellId: "cell-westend",
      threshold: 2,
      targets: [{ deviceId: "gate-west-win", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-west-win", initiallyOpen: false },
    // East delivery window: opens while the east scale hosts HEAVY.
    {
      kind: "pressure-plate",
      id: "plate-e-win",
      cellId: "cell-eastend",
      threshold: 3,
      targets: [{ deviceId: "gate-east-win", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-east-win", initiallyOpen: false },
  ],
  loans: {
    maxRows: 4,
    // Finite visible choices (RBM-002). Beat 9 stays on the board: a posting
    // due that late is legal to write and visibly fatal at the midnight sweep.
    legalDueBeats: [2, 3, 4, 5, 6, 7, 8, 9, null],
    requiredTokens: ["TOKEN-H", "TOKEN-N"],
  },
  outcomes: [
    { id: "idol-w-out", kind: "entityAt", entityId: "prop-idol-w", cellId: "pad-out" },
    { id: "scroll-w-out", kind: "entityAt", entityId: "prop-scroll-w", cellId: "pad-out" },
    { id: "idol-e-out", kind: "entityAt", entityId: "prop-idol-e", cellId: "pad-out" },
    { id: "scroll-e-out", kind: "entityAt", entityId: "prop-scroll-e", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "scout-extracted", kind: "entityInRegion", entityId: "crew-scout", region: "outside" },
    { id: "runner-extracted", kind: "entityInRegion", entityId: "crew-runner", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "heavy-home", kind: "tokenHome", tokenId: "TOKEN-H" },
    { id: "noisy-home", kind: "tokenHome", tokenId: "TOKEN-N" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 9 },
};

// ---------------------------------------------------------------------------
// Verified winning traces (asserted by tests/unit/rbm11-12.test.ts)
// ---------------------------------------------------------------------------

/**
 * The crossover schedule: both corridors on the early shift, both windows on
 * the late shift — each token changes wings at its forced home interval.
 */
export const RBM11_WINNING_ROWS: LoanManifestRow[] = [
  // Early shift: HEAVY powers the west corridor, NOISY the east corridor.
  { rowId: "TOKEN-H->scale-w@2~5", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-w", startBeat: 2, dueBeat: 5 },
  { rowId: "TOKEN-N->chime-e@2~5", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-e", startBeat: 2, dueBeat: 5 },
  // Late shift: the SAME tokens cross over — NOISY to the west window,
  // HEAVY to the east window. (Inclusive overlap: start 6 > due 5.)
  { rowId: "TOKEN-N->chime-w@6~8", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-w", startBeat: 6, dueBeat: 8 },
  { rowId: "TOKEN-H->scale-e@6~8", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-e", startBeat: 6, dueBeat: 8 },
];

export function rbm11ReferencePlan(): RbmPlan {
  return {
    rows: RBM11_WINNING_ROWS.map((r) => ({ ...r })),
    commands: {
      // Beats 1–2: the dome beam still sweeps both wing mouths — all four
      // crew wait in the rotunda.
      // Beat 3: the near-prize runner on each wing steps in.
      3: {
        "crew-helper": { type: "move", to: "cell-west" },
        "crew-runner": { type: "move", to: "cell-east" },
      },
      // Beat 4: they carry the mouth prizes deeper; the deep-prize pair
      // follows into the wing mouths.
      4: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-idol-w", to: "cell-westend" },
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-e", to: "cell-eastend" },
        "crew-scout": { type: "move", to: "cell-west" },
        "crew-operator": { type: "move", to: "cell-east" },
      },
      // Beat 5: the scouts move up to the deep ends — last beat of the
      // corridor shift.
      5: {
        "crew-scout": { type: "move", to: "cell-westend" },
        "crew-operator": { type: "move", to: "cell-eastend" },
      },
      // Beat 6: the windows are open — the near-prize runners deliver.
      6: {
        "crew-helper": { type: "move", to: "pad-out" },
        "crew-runner": { type: "move", to: "pad-out" },
      },
      // Beat 7: the deep pair lifts their scrolls out through the windows.
      7: {
        "crew-scout": { type: "pickup-and-move", propId: "prop-scroll-w", to: "pad-out" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-scroll-e", to: "pad-out" },
      },
      // Beats 8–9: nobody moves. The loans come home, the windows slam, and
      // the midnight sweep finds the pad dark.
    },
  };
}

/**
 * Alternative shift assignment: same crossover, different tempo — the east
 * corridor runs a SHORT early shift (due 4) and the west corridor a long one
 * (due 6); NOISY crosses to the west window a beat early while HEAVY's
 * east-window posting waits for its forced home interval. A different return
 * schedule (4/6 corridors, 5–8 and 7–8 windows), not a reordering.
 */
export const RBM11_ALT_ROWS: LoanManifestRow[] = [
  { rowId: "TOKEN-H->scale-w@2~6", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-w", startBeat: 2, dueBeat: 6 },
  { rowId: "TOKEN-N->chime-e@2~4", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-e", startBeat: 2, dueBeat: 4 },
  { rowId: "TOKEN-N->chime-w@5~8", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-w", startBeat: 5, dueBeat: 8 },
  { rowId: "TOKEN-H->scale-e@7~8", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-e", startBeat: 7, dueBeat: 8 },
];

export function rbm11AlternatePlan(): RbmPlan {
  return {
    rows: RBM11_ALT_ROWS.map((r) => ({ ...r })),
    commands: {
      // East wing works its short early shift (corridor open 2–4): BOTH east
      // crew step inside at beat 3.
      3: {
        "crew-runner": { type: "move", to: "cell-east" },
        "crew-operator": { type: "move", to: "cell-east" },
      },
      // Beat 4: runner lifts the mouth idol deeper; operator follows it to
      // the deep end (the corridor slams behind them at end of beat 4 — they
      // are committed). West wing enters on its longer corridor window.
      4: {
        "crew-runner": { type: "pickup-and-move", propId: "prop-idol-e", to: "cell-eastend" },
        "crew-operator": { type: "move", to: "cell-eastend" },
        "crew-helper": { type: "move", to: "cell-west" },
      },
      5: { "crew-helper": { type: "pickup-and-move", propId: "prop-idol-w", to: "cell-westend" } },
      // Beat 6: last beat of the west corridor posting — scout slips in.
      6: { "crew-scout": { type: "move", to: "cell-west" } },
      // Beat 7: west window is open (NOISY crossed over at 5) — helper out
      // with the idol; scout moves up to the deep end.
      7: {
        "crew-scout": { type: "move", to: "cell-westend" },
        "crew-helper": { type: "move", to: "pad-out" },
      },
      // Beat 8: last call on both windows — west scroll out, and BOTH east
      // exits through the east window (HEAVY crossed over at 7).
      8: {
        "crew-scout": { type: "pickup-and-move", propId: "prop-scroll-w", to: "pad-out" },
        "crew-runner": { type: "move", to: "pad-out" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-scroll-e", to: "pad-out" },
      },
    },
  };
}

// ---------------------------------------------------------------------------

export const RBM11_COOP_NOTE: string[] = [
  "Independent wing operators: two players each run a wing pair (mouth runner + deep runner), owning that wing's crew commands end to end.",
  "Parallel manifest ownership: one player owns the HEAVY rows (west scale, then east window), another owns the NOISY rows (east chime, then west window) — the crossover cannot be booked without both.",
  "Split door verification: a third watches which plates are actually pressed each beat (corridor open vs window open) and calls the shift boundary at beats 5/6.",
  "Watcher timing calls: the fourth owns the patrol clock — dome sweep through beat 2, midnight sweep at 9 — and vetoes any exit scheduled past the window loans.",
];

export const RBM11_CARD: LevelCard = {
  levelId: "rbm-11",
  winningTraceSummary: [
    "Beat 1 — Everyone waits under the dome; the manifest posts HEAVY to the west scale and NOISY to the east chime (both due end of beat 5).",
    "Beats 2–5 — Early shift: both corridors stand open. Helpers take the mouth idols deep; scouts follow to the far ends.",
    "Beat 5 (return phase) — Both tokens come home: the corridor doors slam. Anyone still outside a wing stays outside.",
    "Beat 6 — The crossover: the same HEAVY now opens the EAST window, the same NOISY the WEST window (posted at beat 6 — the earliest legal reloan after the beat-5 return).",
    "Beats 6–7 — Mouth runners step out the windows with the idols; the deep pair lift the scrolls out.",
    "Beats 8–9 — Nobody moves. Windows slam at the end of beat 8; the midnight sweep reaches through them and finds the pad dark.",
  ],
  wrongApproaches: [
    {
      name: "wing-local-booking",
      summary: "Book each wing's own pair for the whole night — HEAVY to the west scale AND the east window over the same beats.",
      expectedFailure: "manifest rejected: overlapping-loan — one token cannot hold two posts at once; the wings must take turns on the same schedule.",
    },
    {
      name: "swap-the-keys",
      summary: "Post NOISY to a scale or HEAVY to a chime stand.",
      expectedFailure: "manifest rejected: incompatible-host — the scale only takes the weight, the chime only takes the rattle.",
    },
    {
      name: "dark-window-exit",
      summary: "Run a wing deep and exit while its window posting hasn't started (west window before beat 6).",
      expectedFailure: "command.rejected — gate-closed: the window opens only on the late shift; the runner is stranded until it does.",
    },
    {
      name: "midnight-straggler",
      summary: "Schedule a window loan due at beat 9 — or loiter one beat too long inside.",
      expectedFailure: "guard.capture at beat 9 — the midnight sweep reaches the pad through the still-open window; due beats must be 8 or earlier.",
    },
    {
      name: "early-wing-entry",
      summary: "Step into a wing mouth at beat 2 while the dome beam is still on it.",
      expectedFailure: "guard.capture at beat 2 — the guard scans his old post before stepping away; the corridor opens into light.",
    },
    {
      name: "forget-the-second-posting",
      summary: "Schedule only the early shift: corridors open, windows never posted.",
      expectedFailure: "crew are trapped inside the wings at the horizon — extraction outcomes fail (entityInRegion) even though the doors opened.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a fifth row past the four-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget.",
    },
  ],
};
