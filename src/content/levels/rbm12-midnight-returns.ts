// RBM-12 "Midnight Returns" — the campaign finale (master §II RBM-D).
// All three core properties, four fixed crew, no new rules: the remaining
// automatic returns finish the operation.
//
// The finale's signature is the INVERTED door. Every earlier gate in the
// campaign opened while a token was OUT on loan. Here the inner exit door
// opens only when HEAVY is HOME — the counterweight's own plate is under its
// stand, so the return that ends the heavy shift presses the plate that
// unlocks the way out. One return closes the hall door behind the crew and
// opens the vestibule: the museum locks up in their favor.
//
// The way out is a two-gate alignment window, engineered entirely by due
// beats:
//   gate-inner (hall -> vestibule): plate under HEAVY's home stand, pressed
//     only while HEAVY is home (2+2=4). Open from the end of HEAVY's due
//     beat onward — unless someone loans it out again and slams it.
//   gate-outer (vestibule -> pad): the exit chime, open only while NOISY is
//     still hosted there (1+1=2). It must be due early enough to slam shut
//     before the warden's midnight sweep — a due-9 row leaves the pad lit.
// So the window is [HEAVY home] AND [NOISY still out] AND [before the last
// return seals the door]. Two telltale sensors make the window visible:
// sensor-desk lights when HEAVY is home; sensor-window lights while the
// exit chime holds NOISY. Both lit = go.
//
// Meanwhile the vault is the last grab: BRIGHT's stand powers the vault door,
// and the walker rattles the vault on his beat-6 round — be out by five.
//
// Engine-grammar notes (frozen semantics — honest adaptation):
// - Guards scan at their PREVIOUS post before stepping, then at the new post
//   the same beat. The warden's hall sweep covers beats 1–2 (entries legal
//   from 3); the walker's vault rattle lands on 6 AND 7 (pre-move scan at 7).
// - Rays are segment lists: the midnight beam reaches the pad only through
//   BOTH doors (cell-exit via gate-inner, pad-out via gate-outer). HEAVY home
//   at the horizon means the vestibule segment is lit but empty; the outer
//   door must be closed or the pad is lit and carriers are captured.
// - Returns land in phase 4 and devices settle in phase 5 of the due beat:
//   a door fed by a home plate opens for the FOLLOWING beat's crew phase; a
//   door fed by a loaned host slams at the end of the due beat.

import type { LoanManifestRow, RbmManifest, RbmPlan } from "../../engine/rbm/types.js";
import type { LevelCard } from "./level-card.js";

export const RBM12: RbmManifest = {
  levelId: "rbm-12",
  rulesVersion: "rbm-rules/1.0.0",
  title: "Midnight Returns",
  cells: [
    // The foyer: shared start and the loan desk — all three homes live here.
    { id: "cell-foyer", region: "inside" },
    // The grand hall, gated from the foyer.
    { id: "cell-hall", region: "inside" },
    // The vault: the finale's grab, gated and rattled on the walker's round.
    { id: "cell-vault", region: "inside" },
    // The vestibule: between the inner door and the outer door.
    { id: "cell-exit", region: "inside" },
    // The sealed loft: unreachable dead cell for resting beams.
    { id: "cell-loft", region: "inside" },
    { id: "pad-out", region: "outside" },
    { id: "cover-out", region: "outside", cover: true },
    { id: "post-foyer", region: "inside" },
    { id: "post-rest", region: "inside" },
    { id: "post-midnight", region: "inside" },
    { id: "post-vaultwatch", region: "inside" },
    { id: "post-deep", region: "inside" },
  ],
  edges: [
    { a: "cell-foyer", b: "cell-hall", gateId: "gate-hall" },
    { a: "cell-hall", b: "cell-vault", gateId: "gate-vault" },
    { a: "cell-hall", b: "cell-exit", gateId: "gate-inner" },
    { a: "cell-exit", b: "pad-out", gateId: "gate-outer" },
    { a: "cover-out", b: "pad-out" },
  ],
  props: [
    // The three homes at the loan desk. All floor pieces (mass 2 > limit 1).
    { kind: "prop", id: "prop-counter", cellId: "cell-foyer", baseMass: 2, accepts: [], restingOn: "plate-inner" },
    { kind: "prop", id: "prop-windup", cellId: "cell-foyer", baseMass: 2, accepts: [] },
    { kind: "prop", id: "prop-lamp", cellId: "cell-foyer", baseMass: 2, accepts: [] },
    // The hall door's counterweight — sits on the hall side so the desk
    // telltale can tell "HEAVY out" from "HEAVY home".
    { kind: "prop", id: "prop-scale-h", cellId: "cell-hall", baseMass: 1, accepts: ["HEAVY"], restingOn: "plate-hall" },
    // The vault door's lit stand — powers the vault while it holds BRIGHT.
    { kind: "prop", id: "prop-stand-v", cellId: "cell-vault", baseMass: 1, accepts: ["BRIGHT"], restingOn: "plate-vault" },
    // The exit chime — the outer door lives while it holds NOISY.
    { kind: "prop", id: "prop-chime-ex", cellId: "cell-exit", baseMass: 1, accepts: ["NOISY"], restingOn: "plate-outer" },
    // The prizes: two in the hall, two in the vault.
    { kind: "prop", id: "prop-relic", cellId: "cell-hall", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-crown", cellId: "cell-hall", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-jewel", cellId: "cell-vault", baseMass: 1, accepts: [] },
    { kind: "prop", id: "prop-map", cellId: "cell-vault", baseMass: 1, accepts: [] },
  ],
  crew: [
    { kind: "crew", id: "crew-helper", cellId: "cell-foyer", massLimit: 1 },
    { kind: "crew", id: "crew-scout", cellId: "cell-foyer", massLimit: 1 },
    { kind: "crew", id: "crew-runner", cellId: "cell-foyer", massLimit: 1 },
    { kind: "crew", id: "crew-operator", cellId: "cell-foyer", massLimit: 1 },
  ],
  guards: [
    {
      kind: "guard",
      id: "guard-1",
      // The warden: an opening sweep over the hall, a long rest, then the
      // midnight beam that walks the exit route door by door.
      patrol: [
        { beat: 1, cellId: "post-foyer" },
        { beat: 2, cellId: "post-rest" },
        { beat: 9, cellId: "post-midnight", facing: "pad" },
      ],
      rays: {
        "post-foyer": [{ id: "beam-hall", segments: [{ cells: ["cell-hall"] }] }],
        "post-rest": [{ id: "beam-loft", segments: [{ cells: ["cell-loft"] }] }],
        // The vestibule segment is lit only through the inner door; the pad
        // segment only through the outer door. A closed outer door ends it.
        "post-midnight": [
          {
            id: "beam-exit",
            segments: [
              { cells: ["cell-exit"], gatedBy: ["gate-inner"] },
              { cells: ["pad-out"], gatedBy: ["gate-outer"] },
            ],
          },
        ],
      },
    },
    {
      kind: "guard",
      id: "guard-2",
      // The walker: opening sweep over the vault, then off round, then the
      // beat-6 vault rattle — which also lands on beat 7 (pre-move scan).
      patrol: [
        { beat: 1, cellId: "post-vaultwatch" },
        { beat: 2, cellId: "post-deep" },
        { beat: 6, cellId: "post-vaultwatch" },
        { beat: 7, cellId: "post-deep" },
      ],
      rays: {
        "post-vaultwatch": [{ id: "beam-vault", segments: [{ cells: ["cell-vault"] }] }],
        "post-deep": [{ id: "beam-loft-2", segments: [{ cells: ["cell-loft"] }] }],
      },
    },
  ],
  tokens: [
    { id: "TOKEN-H", property: "HEAVY", homeEntityId: "prop-counter", effects: { mass: 2 } },
    { id: "TOKEN-N", property: "NOISY", homeEntityId: "prop-windup", effects: { mass: 1, emitsSound: true } },
    { id: "TOKEN-B", property: "BRIGHT", homeEntityId: "prop-lamp", effects: { mass: 1 } },
  ],
  devices: [
    // The hall door: open while the hall scale hosts HEAVY (1+2=3).
    {
      kind: "pressure-plate",
      id: "plate-hall",
      cellId: "cell-hall",
      threshold: 3,
      targets: [{ deviceId: "gate-hall", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-hall", initiallyOpen: false },
    // The vault door: open while the vault stand hosts BRIGHT (1+1=2).
    {
      kind: "pressure-plate",
      id: "plate-vault",
      cellId: "cell-vault",
      threshold: 2,
      targets: [{ deviceId: "gate-vault", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-vault", initiallyOpen: false },
    // THE FINALE DOOR: the plate is under HEAVY's home stand — pressed only
    // while HEAVY is HOME (2+2=4). The return that ends the heavy posting
    // is the key that opens the way out.
    {
      kind: "pressure-plate",
      id: "plate-inner",
      cellId: "cell-foyer",
      threshold: 4,
      targets: [{ deviceId: "gate-inner", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-inner", initiallyOpen: false },
    // The outer door: open while the exit chime hosts NOISY (1+1=2) — it
    // lives only inside the posting's window.
    {
      kind: "pressure-plate",
      id: "plate-outer",
      cellId: "cell-exit",
      threshold: 2,
      targets: [{ deviceId: "gate-outer", whenPressed: "open" }],
    },
    { kind: "gate", id: "gate-outer", initiallyOpen: false },
    // Telltales — the alignment window made visible (RBM-005 vocabulary):
    // sensor-desk lights exactly while HEAVY's host stands in the foyer
    // (i.e., home: the hall scale is in cell-hall, so a posted HEAVY is dark).
    { kind: "sensor", id: "sensor-desk", cellId: "cell-foyer", requiresProperty: "HEAVY" },
    // sensor-window lights exactly while NOISY's host stands in the
    // vestibule (i.e., while the outer door is open).
    { kind: "sensor", id: "sensor-window", cellId: "cell-exit", requiresProperty: "NOISY" },
  ],
  loans: {
    maxRows: 4,
    legalDueBeats: [2, 3, 4, 5, 6, 7, 8, 9, null],
    requiredTokens: ["TOKEN-H", "TOKEN-N", "TOKEN-B"],
  },
  outcomes: [
    { id: "relic-out", kind: "entityAt", entityId: "prop-relic", cellId: "pad-out" },
    { id: "crown-out", kind: "entityAt", entityId: "prop-crown", cellId: "pad-out" },
    { id: "jewel-out", kind: "entityAt", entityId: "prop-jewel", cellId: "pad-out" },
    { id: "map-out", kind: "entityAt", entityId: "prop-map", cellId: "pad-out" },
    { id: "helper-extracted", kind: "entityInRegion", entityId: "crew-helper", region: "outside" },
    { id: "scout-extracted", kind: "entityInRegion", entityId: "crew-scout", region: "outside" },
    { id: "runner-extracted", kind: "entityInRegion", entityId: "crew-runner", region: "outside" },
    { id: "operator-extracted", kind: "entityInRegion", entityId: "crew-operator", region: "outside" },
    { id: "heavy-home", kind: "tokenHome", tokenId: "TOKEN-H" },
    { id: "noisy-home", kind: "tokenHome", tokenId: "TOKEN-N" },
    { id: "bright-home", kind: "tokenHome", tokenId: "TOKEN-B" },
    { id: "crew-safe", kind: "noCapture" },
  ],
  verification: { horizonBeat: 9 },
};

// ---------------------------------------------------------------------------
// Verified winning traces (asserted by tests/unit/rbm11-12.test.ts)
// ---------------------------------------------------------------------------

/**
 * Canonical operation: early heavy posting unlocks the inner door at the
 * end of beat 4; the vault pair make their one-beat snatch inside BRIGHT's
 * window; the whole crew is out by beat 7; beats 8–9 run on returns alone —
 * NOISY comes home and the outer door seals itself before the sweep.
 */
export const RBM12_WINNING_ROWS: LoanManifestRow[] = [
  { rowId: "TOKEN-H->scale-h@2~4", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-h", startBeat: 2, dueBeat: 4 },
  { rowId: "TOKEN-B->stand-v@2~5", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-stand-v", startBeat: 2, dueBeat: 5 },
  { rowId: "TOKEN-N->chime-ex@5~8", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-ex", startBeat: 5, dueBeat: 8 },
];

export function rbm12ReferencePlan(): RbmPlan {
  return {
    rows: RBM12_WINNING_ROWS.map((r) => ({ ...r })),
    commands: {
      // Beats 1–2: the opening sweeps cover the hall and the vault — all
      // four crew wait in the foyer while the postings come up.
      // Beat 3: everyone through the hall door (HEAVY's posting opened it).
      3: {
        "crew-helper": { type: "move", to: "cell-hall" },
        "crew-scout": { type: "move", to: "cell-hall" },
        "crew-runner": { type: "move", to: "cell-hall" },
        "crew-operator": { type: "move", to: "cell-hall" },
      },
      // Beat 4: vault pair in; hall pair bag the prizes in place. HEAVY comes
      // home at the end of this beat — the hall door slams, the inner door
      // opens (sensor-desk lights: the return IS the key).
      4: {
        "crew-scout": { type: "move", to: "cell-vault" },
        "crew-operator": { type: "move", to: "cell-vault" },
        "crew-helper": { type: "pickup", propId: "prop-relic" },
        "crew-runner": { type: "pickup", propId: "prop-crown" },
      },
      // Beat 5: the vault snatch — grab-and-go back to the hall before the
      // door seals at the end of BRIGHT's posting. Hall pair stage in the
      // vestibule (sensor-window lit: the outer door is live).
      5: {
        "crew-scout": { type: "pickup-and-move", propId: "prop-jewel", to: "cell-hall" },
        "crew-operator": { type: "pickup-and-move", propId: "prop-map", to: "cell-hall" },
        "crew-helper": { type: "move", to: "cell-exit" },
        "crew-runner": { type: "move", to: "cell-exit" },
      },
      // Beat 6: hall pair out through the outer door; vault pair cross the
      // inner door. The walker's rattle finds the vault empty.
      6: {
        "crew-helper": { type: "move", to: "pad-out" },
        "crew-runner": { type: "move", to: "pad-out" },
        "crew-scout": { type: "move", to: "cell-exit" },
        "crew-operator": { type: "move", to: "cell-exit" },
      },
      // Beat 7: last two out. The board is finished — nothing left to queue.
      7: {
        "crew-scout": { type: "move", to: "pad-out" },
        "crew-operator": { type: "move", to: "pad-out" },
      },
      // Beats 8–9: NO COMMANDS. NOISY's return seals the outer door at the
      // end of beat 8; the warden's midnight beam walks the vestibule and
      // dies on the closed outer door.
    },
  };
}

/**
 * Second operation — a different schedule, different roles, different risk:
 * the heavy posting runs a beat longer (hall open through 5), the vault pair
 * swap with the hall pair, and NOISY's window is the tight 6–7 slot, so the
 * whole crew must cross as one group on beats 6–7 instead of staggering.
 * The door seals a full beat earlier; beats 8–9 are pure watch.
 */
export const RBM12_ALT_ROWS: LoanManifestRow[] = [
  { rowId: "TOKEN-H->scale-h@2~5", tokenId: "TOKEN-H", fromHostId: "prop-counter", toHostId: "prop-scale-h", startBeat: 2, dueBeat: 5 },
  { rowId: "TOKEN-B->stand-v@3~5", tokenId: "TOKEN-B", fromHostId: "prop-lamp", toHostId: "prop-stand-v", startBeat: 3, dueBeat: 5 },
  { rowId: "TOKEN-N->chime-ex@6~7", tokenId: "TOKEN-N", fromHostId: "prop-windup", toHostId: "prop-chime-ex", startBeat: 6, dueBeat: 7 },
];

export function rbm12AlternatePlan(): RbmPlan {
  return {
    rows: RBM12_ALT_ROWS.map((r) => ({ ...r })),
    commands: {
      3: {
        "crew-helper": { type: "move", to: "cell-hall" },
        "crew-scout": { type: "move", to: "cell-hall" },
        "crew-runner": { type: "move", to: "cell-hall" },
        "crew-operator": { type: "move", to: "cell-hall" },
      },
      // Roles swapped: helper and runner run the vault; scout and operator
      // hold the hall prizes.
      4: {
        "crew-helper": { type: "move", to: "cell-vault" },
        "crew-runner": { type: "move", to: "cell-vault" },
        "crew-scout": { type: "pickup", propId: "prop-relic" },
        "crew-operator": { type: "pickup", propId: "prop-crown" },
      },
      // Beat 5: the vault pair's grab-and-go; the hall pair must WAIT — the
      // inner door opens at the end of this beat (HEAVY due 5, not 4).
      5: {
        "crew-helper": { type: "pickup-and-move", propId: "prop-jewel", to: "cell-hall" },
        "crew-runner": { type: "pickup-and-move", propId: "prop-map", to: "cell-hall" },
      },
      // Beats 6–7: the one-shot group crossing inside NOISY's tight window.
      6: {
        "crew-helper": { type: "move", to: "cell-exit" },
        "crew-scout": { type: "move", to: "cell-exit" },
        "crew-runner": { type: "move", to: "cell-exit" },
        "crew-operator": { type: "move", to: "cell-exit" },
      },
      7: {
        "crew-helper": { type: "move", to: "pad-out" },
        "crew-scout": { type: "move", to: "pad-out" },
        "crew-runner": { type: "move", to: "pad-out" },
        "crew-operator": { type: "move", to: "pad-out" },
      },
      // Beat 8–9: watch. The outer door sealed a beat earlier than the
      // canonical board's — different manifest, same midnight.
    },
  };
}

// ---------------------------------------------------------------------------

export const RBM12_COOP_NOTE: string[] = [
  "Independent crew operators: two players each drive one pair — the vault pair's grab-and-go and the hall pair's pickup-and-stage run in parallel with no shared cells.",
  "Parallel manifest ownership: a third player owns the loan board — HEAVY's early posting (which is also the inner-door key), BRIGHT's vault window, NOISY's exit window — and calls each due beat.",
  "Split door verification: a fourth watches the two telltales — sensor-desk lit means the inner door is unlocked (HEAVY home), sensor-window lit means the outer door is live (NOISY posted); the crossing is legal exactly while both hold.",
  "Watcher timing calls: the patrol clock — opening sweeps on 1–2, the walker's vault rattle at 6, the warden's midnight beam at 9 — and the veto on any exit past NOISY's due beat.",
];

export const RBM12_CARD: LevelCard = {
  levelId: "rbm-12",
  winningTraceSummary: [
    "Beats 1–2 — Opening sweeps cover the hall and the vault while the manifest posts: HEAVY to the hall scale (due 4), BRIGHT to the vault stand (due 5), NOISY to the exit chime (due 8).",
    "Beat 3 — All four crew through the hall door on the heavy posting.",
    "Beat 4 — Vault pair in; hall pair bag their prizes. At the end of the beat HEAVY's return does two things at once: the hall door slams and the inner door opens — the return is the key.",
    "Beat 5 — The one-beat vault snatch (grab-and-go before BRIGHT's door seals); hall pair stage in the vestibule as the outer door comes live.",
    "Beats 6–7 — The crossing inside the alignment window: hall pair out at 6, vault pair at 7, the walker's rattle finding the vault empty behind them.",
    "Beats 8–9 — No commands. NOISY's return seals the outer door at the end of beat 8; the warden's midnight beam walks the vestibule and dies on it.",
  ],
  wrongApproaches: [
    {
      name: "cross-before-the-return",
      summary: "Queue hall->vestibule crossings at beat 4–5 while HEAVY is still out on the hall scale.",
      expectedFailure: "command.rejected — gate-closed: the inner door is locked until HEAVY's return presses its home plate (end of the due beat).",
    },
    {
      name: "reloan-after-home",
      summary: "Post HEAVY back out to the hall scale a second time (@5~8) after it came home.",
      expectedFailure: "gate-inner slams shut (gate.close at the reloan's start beat): the counterweight plate only holds while HEAVY is home — a second posting re-locks the exit mid-window and strands carriers inside.",
    },
    {
      name: "exit-too-late",
      summary: "Run NOISY's exit posting due 9 (or keep-forever) so the outer door never closes.",
      expectedFailure: "guard.capture at beat 9 — the midnight beam walks the vestibule (inner door open, HEAVY home) and reaches the pad through the still-open outer door.",
    },
    {
      name: "vault-dawdler",
      summary: "Leave a vault pair member inside past BRIGHT's posting — or schedule it so they can't leave before the walker's round.",
      expectedFailure: "guard.capture at beat 6 — the walker's vault rattle lands on 6 and 7; the vault must stand empty by then.",
    },
    {
      name: "missing-the-light",
      summary: "Commit only HEAVY and NOISY rows — the manifest never schedules BRIGHT.",
      expectedFailure: "plan.complete observation fails (manifest missing required token rows: TOKEN-B), and gate-vault never opens — the vault prizes stay unreachable (entityAt fails).",
    },
    {
      name: "early-hall-entry",
      summary: "Step into the hall at beat 2 on the fresh heavy posting.",
      expectedFailure: "guard.capture at beat 2 — the warden's opening sweep still covers the hall; the door opens into light.",
    },
    {
      name: "manifest-over-budget",
      summary: "Commit a fifth row past the four-row ledger.",
      expectedFailure: "manifest rejected: manifest-over-budget.",
    },
  ],
};
