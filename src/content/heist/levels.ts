import type { LevelDef, Plans } from "../../engine/heist/types.js";

export const HEIST_LEVELS: LevelDef[] = [
  {
    id: "L1",
    title: "Closing Time",
    intro: "The museum is nearly dark. Slip past Officer Brass and reach the side door together.",
    tiles: [
      "############",
      "#..........#",
      "#..........#",
      "#..........#",
      "######.#####",
      "#........EE#",
      "############",
    ],
    midnight: 8,
    crew: [
      { id: "pip", name: "Pip", look: "blue", x: 1, y: 1 },
      { id: "marlo", name: "Marlo", look: "red", x: 1, y: 2 },
    ],
    guards: [{
      id: "brass", name: "Officer Brass",
      route: [
        { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
        { x: 6, y: 3, face: "S" }, { x: 5, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 },
        { x: 3, y: 3, face: "S" },
      ],
      startIndex: 0, speed: 2, sight: 4, hearing: 0, facing: "E",
    }],
    objects: [
      { id: "crateW", kind: "crate", name: "the west crate", x: 5, y: 2 },
      { id: "crateE", kind: "crate", name: "the east crate", x: 7, y: 2 },
    ],
    tokens: [], doors: [],
    tips: [
      "The guard sees a wide wedge ahead, never behind.",
      "Officer Brass pauses at each end of his beat and looks south.",
      "Cross the gap on the turn his back is turned.",
    ],
  },
  {
    id: "L2",
    title: "The Vault Door",
    intro: "Borrow the safe's weight for the plate, then slip through the vault door before it closes.",
    tiles: [
      "############",
      "#..........#",
      "#..P.......#",
      "#.....#....#",
      "#.....D..EE#",
      "#.....#....#",
      "############",
    ],
    midnight: 10,
    crew: [
      { id: "pip", name: "Pip", look: "blue", x: 1, y: 2 },
      { id: "marlo", name: "Marlo", look: "teal", x: 1, y: 4 },
    ],
    guards: [{
      id: "brass", name: "Officer Brass",
      route: [{ x: 9, y: 1 }, { x: 9, y: 2 }, { x: 9, y: 3 }, { x: 9, y: 4 }, { x: 9, y: 3 }, { x: 9, y: 2 }],
      startIndex: 0, speed: 1, sight: 3, hearing: 0, facing: "S",
    }],
    objects: [
      { id: "safe", kind: "safe", name: "the safe", x: 2, y: 2 },
      { id: "crate", kind: "crate", name: "the crate", x: 3, y: 2 },
    ],
    tokens: [{ id: "weight", prop: "HEAVY", home: "safe", duration: 3 }],
    doors: [{ id: "vault", x: 6, y: 4, plates: [{ x: 3, y: 2 }] }],
    tips: [
      "A loan lasts three turns, then snaps home.",
      "Only HEAVY presses a plate; crew cannot.",
      "Borrow the safe's weight for the crate on the plate, then get both crew through.",
    ],
  },
  {
    id: "L3",
    title: "Lullaby Lure",
    intro: "Borrow a little music to turn the guard. Bring home the Clockwork Nightingale before midnight.",
    tiles: [
      "############",
      "#....#.....#",
      "#....#.....#",
      "#..........#",
      "#....#.....#",
      "#....#..EEE#",
      "############",
    ],
    midnight: 10,
    crew: [
      { id: "pip", name: "Pip", look: "blue", x: 1, y: 1 },
      { id: "marlo", name: "Marlo", look: "yellow", x: 1, y: 2 },
    ],
    guards: [{
      id: "brass", name: "Officer Brass",
      route: [{ x: 5, y: 3, face: "W" }, { x: 5, y: 3, face: "W" }],
      startIndex: 0, speed: 1, sight: 5, hearing: 4, facing: "W",
    }],
    objects: [
      { id: "music", kind: "musicBox", name: "the music box", x: 2, y: 1 },
      { id: "plinth", kind: "plinth", name: "the marble plinth", x: 3, y: 2 },
      { id: "toy", kind: "toy", name: "the wind-up toy", x: 8, y: 4 },
    ],
    tokens: [{ id: "lullaby", prop: "NOISY", home: "music", duration: 3 }],
    doors: [],
    prize: { id: "nightingale", name: "the Clockwork Nightingale", x: 8, y: 2 },
    tips: [
      "A NOISY toy draws a guard who can hear it.",
      "The guard turns toward a sound before he moves.",
      "Lend the lullaby, slip past while he investigates, and be clear before it ends.",
    ],
  },
];

/** Each solution lists one simultaneous plan set per turn. */
export const SOLUTIONS: Record<string, Plans[]> = {
  L1: [
    { pip: { path: [] }, marlo: { path: [{ x: 2, y: 2 }, { x: 3, y: 2 }] } },
    { pip: { path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }] }, marlo: { path: [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }] } },
    { pip: { path: [{ x: 5, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 2 }] }, marlo: { path: [{ x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }] } },
    { pip: { path: [{ x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 }] }, marlo: { path: [{ x: 6, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 5 }] } },
    { pip: { path: [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }] }, marlo: { path: [{ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }] } },
  ],
  L2: [
    { pip: { path: [{ x: 1, y: 3 }, { x: 2, y: 3 }], loan: { tokenId: "weight", targetId: "crate" } }, marlo: { path: [{ x: 2, y: 4 }] } },
    { pip: { path: [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }] }, marlo: { path: [{ x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }] } },
    { pip: { path: [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }] }, marlo: { path: [{ x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 }] } },
    { pip: { path: [{ x: 8, y: 4 }, { x: 9, y: 4 }] }, marlo: { path: [{ x: 9, y: 4 }, { x: 10, y: 4 }] } },
  ],
  L3: [
    { pip: { path: [] }, marlo: { path: [{ x: 2, y: 2 }] } },
    { pip: { path: [{ x: 1, y: 2 }, { x: 2, y: 2 }] }, marlo: { path: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }], loan: { tokenId: "lullaby", targetId: "toy" } } },
    { pip: { path: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }] }, marlo: { path: [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 2 }] } },
    { pip: { path: [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 4 }] }, marlo: { path: [{ x: 7, y: 2 }, { x: 8, y: 2 }, { x: 9, y: 2 }] } },
    { pip: { path: [{ x: 7, y: 4 }, { x: 7, y: 5 }, { x: 8, y: 5 }] }, marlo: { path: [{ x: 9, y: 3 }, { x: 9, y: 4 }, { x: 9, y: 5 }] } },
  ],
};
