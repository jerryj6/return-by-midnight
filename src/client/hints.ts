// Hint ladders keyed by levelId (GME-009: failing relationship → relevant
// tool → partial move; the full solution stays a separate, labeled choice).

export interface HintLadderContent {
  tiers: string[];
  solution?: { caption: string; lines: string[] };
}

export const RBM_HINTS: Record<string, HintLadderContent> = {
  "rbm-01": {
    tiers: [
      "The crate alone is too light for the plate — the exit stays shut while it weighs only 1. Find a way to lend the plate some extra mass.",
      "HEAVY can live somewhere else for exactly the beats you schedule. The exit gate only holds while the plate stays pressed — and the safe is only portable while it is light.",
      "The custodian reaches the watch square on beat 4, and his sight crosses the doorway only while the exit is open. If HEAVY is due at the end of beat 3, the gate closes behind you before he arrives.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Loan HEAVY from the safe to the crate: starts beat 1, due end of beat 3.",
        "Beat 2 — the carrier takes the safe to the doorway approach.",
        "Beat 3 — the carrier moves through the open exit to the pad.",
        "HEAVY returns at the end of beat 3; the crate releases the plate and the gate closes before the guard's beat-4 watch. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-02": {
    tiers: [
      "The hall crossing needs two things at once: darkness to hide the helper, and light at the vault to wake its tripwire. One lamp can serve both — the question is where its light lives, and when it comes home.",
      "The custodian's beam still sweeps the hall on beats 1–2, so crossing early is capture regardless of the light. The useful window opens at beat 3 — and the helper keeps the borrowed BRIGHT with her, so the vault sensor powers exactly when she arrives.",
      "Schedule the return for the END of beat 5: she lifts the statuette and steps to the pad as the lamp relights behind her. An earlier return leaves the tripwire dark; never returning leaves the hall's eye dead at midnight.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Loan BRIGHT from the floor lamp to the helper: starts beat 1, due end of beat 5.",
        "Beats 1–2 — wait in the foyer; the beam still covers the hall.",
        "Beat 3 — cross the dark hall carrying the light.",
        "Beat 4 — reach the vault; its tripwire wakes to her shoulder-lamp.",
        "Beat 5 — lift the statuette, exit to the pad; BRIGHT returns and the hall's eye relights on an empty room. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-03": {
    tiers: [
      "The toy does two jobs: its weight holds a plate, and its rattle can pull a patrol. Right now those jobs fight each other — a property loan can separate them.",
      "NOISY only earns its diversion when it RETURNS to a moving or winding host. A return to a parked toy is silence. Carry the toy while it is quiet, post it where it must ring, then let the rattle come home.",
      "The gallery beam sweeps early beats — cross at beat 3, after it moves on. The toy's weight leaving the plate is what opens the lift door for the operator, and setting it down at beat 5 is what closes it again on time.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Loan NOISY from the winding toy to the decoy sack: starts beat 1, due end of beat 6.",
        "Beats 1–2 — wait out the patrol beam.",
        "Beat 3 — helper lifts the toy and crosses quietly; its weight leaving the plate opens the lift door and the operator slips in.",
        "Beat 4 — toy to the listening post; operator takes the bust back to the nursery.",
        "Beat 5 — toy set down re-presses the plate; the lift door shuts behind the operator.",
        "Beat 6 — NOISY returns to the parked toy; the post rings and the helper leaves by the window. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-04": {
    tiers: [
      "The safe is too heavy to carry AND too heavy to leave — its weight is holding the alarm plate shut. The same HEAVY token must do the plate's job twice, in two different places.",
      "HEAVY returns to wherever its home object IS, not where it was. Lighten the safe to move it, then schedule the return for after it reaches the vault — the returning mass lands inside the vault and wakes its weight-sense.",
      "Due HEAVY at the end of beat 4 — after the cart is in the vault, while the patrol beam is still sweeping south. Return too early and the weight settles on the carried safe mid-route; never return and both the vault sense and the home check fail.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 2 — loan HEAVY from the safe to the transport crate: due end of beat 4. The safe lightens; the plate releases the lobby gate.",
        "Beats 3–4 — cart the safe through the lobby into the vault while the beam is south.",
        "End of beat 4 — HEAVY comes home to the carried safe; it settles inside the vault and the weight-sense wakes.",
        "Beat 5 — the returned weight re-presses the alarm plate; the lobby gate slams shut behind the crew.",
        "Beat 6 — the helper steps out the delivery window. Run the plan, then accept it.",
      ],
    },
  },
};
