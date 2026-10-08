// Board geometry for the SVG scene. Level manifests carry only logical cells;
// pixel positions are a client concern (the same seam a Pixi stage will take
// over later — see SceneView). Positions are authored per level, with a
// deterministic fallback grid for levels that do not have one yet.

import type { RbmManifest } from "../engine/rbm/types.js";

export interface Pt {
  x: number;
  y: number;
}

const CELL_POS_BY_LEVEL: Record<string, Record<string, Pt>> = {
  "rbm-01": {
    "room-safe": { x: 170, y: 220 },
    "cell-approach": { x: 370, y: 220 },
    "guard-far": { x: 150, y: 100 },
    "guard-watch": { x: 370, y: 100 },
    "pad-out": { x: 585, y: 220 },
    "cover-out": { x: 655, y: 330 },
  },
};

/** Fine placement inside a cell, keyed by entity/device id. */
const ENTITY_OFFSET: Record<string, Pt> = {
  "prop-safe": { x: -42, y: 10 },
  "prop-crate": { x: 42, y: 26 },
  "plate-1": { x: 42, y: 44 },
  "crew-helper": { x: -52, y: -34 },
  "crew-operator": { x: 44, y: 10 },
};

export function cellPos(level: RbmManifest, cellId: string): Pt {
  const authored = CELL_POS_BY_LEVEL[level.levelId]?.[cellId];
  if (authored) return authored;
  // Fallback: inside cells march along the room, outside cells along the yard.
  const idx = level.cells.findIndex((c) => c.id === cellId);
  const cell = level.cells[idx];
  if (!cell) return { x: 80, y: 80 };
  const inside = level.cells.filter((c) => c.region === "inside");
  const outside = level.cells.filter((c) => c.region === "outside");
  if (cell.region === "inside") {
    const i = inside.findIndex((c) => c.id === cellId);
    return { x: 120 + (i % 4) * 120, y: 110 + Math.floor(i / 4) * 110 };
  }
  const j = outside.findIndex((c) => c.id === cellId);
  return { x: 540 + (j % 3) * 110, y: 120 + Math.floor(j / 3) * 110 };
}

export function entityOffset(entityId: string, slotIndex: number): Pt {
  const authored = ENTITY_OFFSET[entityId];
  if (authored) return authored;
  return { x: -20 + slotIndex * 26, y: 18 };
}
