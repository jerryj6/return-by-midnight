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
  "rbm-05": {
    tiers: [
      "One lamp, two jobs: the BRIGHT token must serve both dark rooms — and it can't be in two places at once. The ledger is the answer: the same token can be lent twice.",
      "Loans on one token must not overlap — book the first window end-to-end, then a second window after it comes home. Both anchors need the light at different beats; schedule the returns so each room is lit exactly when it must be.",
      "Commit the first loan for beats 1–4 and a second for beats 5–6. Order which anchor is served first by which door the operator needs open when.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 1 — Loan BRIGHT from the nursery lamp to the north anchor (due end of beat 4). The north door opens.",
        "Beat 3 — Helper slips into the dark north room; its door is open on loan.",
        "Beat 4 — She lifts the north idol and exits; the loan lapses home — the lamp's telltale fires at the settle (the home job).",
        "Beat 5 — BRIGHT is reloaned from home to the south anchor (legal only after the one-beat gap); the south door opens at the settle.",
        "Beat 6 — Operator lifts the south idol and exits through the open door; BRIGHT comes home to the lamp. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-06": {
    tiers: [
      "The job needs one thing carried and one thing weighed — and the only weight-token in the ledger can't do both at the same instant. The return lands the mass wherever the borrowed item *is*, not where it was.",
      "Borrow the HEAVY token to make the load portable, then let the loan expire *after* the load reaches the vault — the returning mass settles inside the vault and trips its weight-sense. Due it too early and the weight lands on the carried safe mid-route.",
      "Commit TOKEN-H with due at the end of beat 5. Get the safe moving early, and hold the operator's vault-window job (beats 6–7) until the mass is on its way back.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 1 — Post HEAVY from the safe to the light crate (due end of beat 5). The lock plate trips: the store opens, the exit bolts, the vault anchor releases.",
        "Beats 3–5 — Helper ducks through the open store and back with the ledger — before the posted weight comes home.",
        "Beat 5 (return phase) — HEAVY lands back on the safe: the alarm plate unbars the vault door AND delivery window while the lock plate releases the front exit — one return, three doors.",
        "Beats 6–7 — Helper leaves by the front door; operator slips in the vault window and out with the crown while the beam sweeps the hall. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-07": {
    tiers: [
      "Three rows, three jobs: the scales, the diversion, and the door. The ledger will not let one token sit on two scales at once — double-booking is rejected outright.",
      "The NOISY rattle only earns its diversion when it *returns* to a host that can make noise where the patrol can hear it. And the vault step must come after the repost — order matters more than speed.",
      "Book the weight first, the jingle second, and the door token last. The rattle's return beat is the loosest dial on the manifest — due anywhere from beat 3 on works (beat 1–2 strands the diversion, never returning fails the midnight check).",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 1 — Three doors, two tokens: HEAVY posts to the north scale (due 4) and NOISY to the decoy sack (due 7). North and east corridors open; the vault stays shut — the weight can only be in one place.",
        "Beat 3 — Helper through the open north door; operator through the east (the door cells stay swept through beat 2).",
        "Beat 4 — Both lift their idols and leave by the free windows; HEAVY's first posting lapses home.",
        "Beats 4–5 — HEAVY's home interval, then the reloan to the vault scale (the only legal order — overlapping intervals are rejected). The vault door opens at the end of beat 5.",
        "Beats 6–7 — Runner takes the vault corridor and exits with the third idol before the last scan finds the hub. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-08": {
    tiers: [
      "Two tokens, two different due beats — and they are not interchangeable. The trap is borrowing the right things but swapping which comes home when.",
      "The rattle's early return is *required*, not wasteful: something downstream needs the rattle back before the second half of the job. The lamp, by contrast, must stay out long enough to matter — bringing it home early leaves the second job dark.",
      "Due the NOISY token at beat 2 and the BRIGHT token at beat 6 — then check which crew member is inside the sweep when the patrol crosses the entry.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beats 1–2 — Three postings: the rattle to the decoy sack (due 2 — it must come home early), the light to the candlestick at beat 2 (due 6 — the beat-1 settle first registers the weighted lamp, so its release can open the doors), the weight stays home for now.",
        "Beat 2 — NOISY's return presses the toy onto its plate: the bell corridor reopens. The first return of the chain.",
        "Beat 4 — HEAVY lands on the vault scale (@4~6): the vault corridor opens. The rooms stop being swept — entries begin.",
        "Beats 4–5 — Helper, runner and operator clear the three corridors; the lookout takes the lobby ledger while the lamp is still dark.",
        "Beats 6–7 — The hall is swept behind them; everyone is already outside. Both late returns land home. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-09": {
    tiers: [
      "Only one loan tonight, and the place it must land *moves*. The deposit's anchor isn't where you aim it — it's where the anchor will be when the token comes home.",
      "pickup-and-move takes an aim: name the *destination* the token should settle into, not the cell it leaves from. Aiming at the wrong anchor completes the carry but returns to a home that isn't listening.",
      "Schedule the single loan due at 6 and aim the deposit at the junction stand (cell-junction) — the anchor that will have arrived, not the one standing at pickup time.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 1 — Post the light to the loft candlestick (due 6): the loft opens for the runner, and the stand goes dormant — ready to be re-sited.",
        "Beat 3 — Helper lifts the bare stand: carried cargo never rests, so the lamp plate releases and the dark-room door opens.",
        "Beat 4 — Helper hauls the stand toward the junction (still carried, door still open); operator and runner enter their rooms.",
        "Beat 5 — Stand set down at the junction; both thieves exit through the last beat of the carry window.",
        "Beat 6 — The light returns to the re-sited stand: the junction receiver fires. The deposit's new position is what powered it. Run the plan, then accept it.",
      ],
    },
  },
  "rbm-10": {
    tiers: [
      "The finale is quiet work: the rattle must come home (never keeping it fails the midnight check), and the bell must stay open until the last hand is through.",
      "Sequence the two tokens so their returns don't fight: the rattle home early enough to satisfy the ledger, the BRIGHT loan covering the corridor crossing. Closing the bell early strands the exit.",
      "Commit TOKEN-N due 5 and TOKEN-B due 7, move the lookout only when the patrol has already passed the vestibule — lingering there on an early beat is the one mistake this level punishes.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 1 — The rattle is lent to the decoy sack (the bell loft opens while it sings); the light to the attic lampstand (the attic opens). The vestibule is dark only while the gallery door stays shut.",
        "Beats 2–4 — Helper clears the bell loft; the lookout holds on the pad, then ducks straight into the vestibule ahead of the returning watch.",
        "Beat 5 — Lookout leaves by the hatch before the rattle lands home: the return presses the toy, unbarring both gallery doors — and pours the west beam into the now-empty vestibule.",
        "Beats 5–6 — Operator slips into the attic the moment the east watch leaves it, and drops to the pad with the attic idol.",
        "Beats 6–7 — Runner takes the delivery window into the open gallery and out with the idol.",
        "Alternative — bring the rattle home at beat 3 and send the runner through the inside corridor instead: same take, earlier finish, a tighter bell window.",
      ],
    },
  },
  "rbm-11": {
    tiers: [
      "Both wings want the same two keys: the HEAVY token serves the west scale and the NOISY token the east chime — read which stand takes which property.",
      "A token must come home before it can be reloaned: HEAVY and NOISY each post twice — the corridor legs first, the window legs second — and the beat-5 return is the shift boundary between them.",
      "Book the corridor postings to the scales and chimes for the same early window (start 2, due 5); the two window postings are the second shift, not a second pair of tokens — the crossover swap happens at beat 6.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Beat 1 — Everyone waits under the dome; the manifest posts HEAVY to the west scale and NOISY to the east chime (both due end of beat 5).",
        "Beats 2–5 — Early shift: both corridors stand open. Helpers take the mouth idols deep; scouts follow to the far ends.",
        "Beat 5 (return phase) — Both tokens come home: the corridor doors slam. Anyone still outside a wing stays outside.",
        "Beat 6 — The crossover: the same HEAVY now opens the EAST window, the same NOISY the WEST window (posted at beat 6 — the earliest legal reloan after the beat-5 return).",
        "Beats 6–7 — Mouth runners step out the windows with the idols; the deep pair lift the scrolls out.",
        "Beats 8–9 — Nobody moves. Windows slam at the end of beat 8; the midnight sweep reaches through them and finds the pad dark.",
        "Alternative — asymmetric 4/6→5/7 schedule: book HEAVY's west leg early (due 4) and let NOISY's window stretch to 7; same crossover, earlier east wing.",
      ],
    },
  },
  "rbm-12": {
    tiers: [
      "The two exit doors want opposite things: the INNER door opens when a token comes HOME (the plate under HEAVY's home prop presses on its return), the OUTER door stays open while NOISY is still out on loan.",
      "Watch the desk sensor and window sensor telltales — the exit crossing is legal only while both are lit: HEAVY home again AND NOISY still posted to the outer chime.",
      "Post HEAVY to the hall scale at beat 2, due 4 — its return presses the home plate and unlocks the inner door at beat 5. NOISY goes to the exit chime at 5, due 8 — it must still be out through the crossing.",
    ],
    solution: {
      caption: "A complete operation (spoiler)",
      lines: [
        "Post HEAVY to its early window and NOISY to the long one — the plate under HEAVY's home prop means its return unlocks the inner door.",
        "The crossing window is [HEAVY home ∧ NOISY still out]: legal while both telltales are lit. Queue nothing after beat 7.",
        "The beat-8 NOISY return seals the outer door before the beat-9 sweep — the last mechanical event of the campaign is a return.",
        "Alternative — tight-window group crossing: stagger nothing, move everyone through in the single shared beat the two windows overlap.",
      ],
    },
  },
};
