// SVG scene for Return by Midnight — a deliberate placeholder for the Pixi
// stage that lands later (III.3 "playfield first"). It renders the committed
// simulation snapshot: cell graph, gated edges, devices, crew/guard/props,
// token chips on their current hosts, loan threads, and live guard rays.
// Swap boundary: everything below derives from RbmSimState + the level
// manifest, so a Pixi stage can replace these elements without touching
// App state.

import type {
  LoanManifestRow,
  RbmGuardDef,
  RbmManifest,
  RbmSimState,
} from "../engine/rbm/types.js";
import { cellPos, entityOffset } from "./layout";
import { nameOf, PROPERTY_COLOR } from "./describe";

interface Props {
  level: RbmManifest;
  sim: RbmSimState;
  rows: LoanManifestRow[];
  selectedId: string | null;
  focusedRow: string | null;
  onSelect: (id: string | null) => void;
  onFocusRow: (rowId: string | null) => void;
}

/** Cells lit by a guard at `post` — mirrors litCells in src/engine/rbm/sim.ts:
 *  a segment gated by any closed gate darkens it and every later segment. */
function litCells(guard: RbmGuardDef, post: string, sim: RbmSimState): string[] {
  const lit: string[] = [];
  for (const ray of guard.rays[post] ?? []) {
    for (const seg of ray.segments) {
      const blocked = (seg.gatedBy ?? []).some((g) => sim.devices[g]?.open !== true);
      if (blocked) break;
      for (const c of seg.cells) lit.push(c);
    }
  }
  return lit;
}

const TOKEN_GLYPH: Record<string, string> = { HEAVY: "◆", BRIGHT: "✶", NOISY: "≈" };

export default function SceneView({ level, sim, rows, selectedId, focusedRow, onSelect, onFocusRow }: Props) {
  const pos = (cellId: string) => cellPos(level, cellId);

  const carriedIds = new Set(
    Object.values(sim.entities)
      .map((e) => e.cargoId)
      .filter((x): x is string => typeof x === "string"),
  );

  // Slot index for entities sharing a cell so nothing stacks invisibly.
  const slotOf = (id: string) => {
    const cellId = sim.entities[id]?.cellId;
    const same = Object.values(sim.entities).filter((e) => e.cellId === cellId).map((e) => e.id).sort();
    return Math.max(0, same.indexOf(id));
  };

  const entityPt = (id: string) => {
    const e = sim.entities[id];
    if (!e) return { x: 0, y: 0 };
    const carriedBy = Object.values(sim.entities).find((c) => c.cargoId === id);
    if (carriedBy) {
      const cp = pos(carriedBy.cellId);
      return { x: cp.x, y: cp.y - 34 };
    }
    const p = pos(e.cellId);
    const o = entityOffset(id, slotOf(id));
    return { x: p.x + o.x, y: p.y + o.y };
  };

  return (
    <svg
      className="scene"
      viewBox="0 0 800 440"
      role="img"
      aria-label="Museum room"
      data-testid="scene"
      onClick={() => onSelect(null)}
    >
      <defs>
        <radialGradient id="lit-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8C86A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#E8C86A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c3b4c" />
          <stop offset="100%" stopColor="#222d3c" />
        </linearGradient>
      </defs>

      {/* ground */}
      <rect x="0" y="0" width="800" height="440" className="outside-ground" />
      {/* museum interior */}
      <rect x="48" y="48" width="420" height="330" rx="10" className="room-floor" />
      <rect x="48" y="48" width="420" height="330" rx="10" className="room-wall" />
      <text x="258" y="76" className="zone-label">the east wing</text>
      <text x="640" y="76" className="zone-label">the grounds</text>

      {/* edges */}
      {level.edges.map((e, i) => {
        const a = pos(e.a);
        const b = pos(e.b);
        const gated = e.gateId ? sim.devices[e.gateId]?.open === true : null;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={e.gateId ? "edge gated" : "edge"} />
            {e.gateId ? (
              <g className={gated ? "gate open" : "gate closed"}>
                <image href={`/assets/sprites/props/rbm-prop-states-${gated ? "06" : "05"}.png`}
                  x={(a.x + b.x) / 2 - 26} y={(a.y + b.y) / 2 - 40} width="52" height="60"
                  preserveAspectRatio="xMidYMid meet" />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 40} className="gate-label">
                  {gated ? "open" : "shut"}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* cells */}
      {level.cells.map((c) => {
        const p = pos(c.id);
        return (
          <g key={c.id}>
            <circle cx={p.x} cy={p.y} r="13" className={c.cover ? "cell cover" : "cell"} />
            <text x={p.x} y={p.y + 34} className="cell-label">
              {nameOf(c.id)}
            </text>
          </g>
        );
      })}

      {/* guard detection rays */}
      {level.guards.map((g) => {
        const gs = sim.entities[g.id];
        if (!gs) return null;
        const post = gs.cellId;
        const gp = pos(post);
        const lit = litCells(g, post, sim);
        return (
          <g key={`rays-${g.id}`} className="guard-rays">
            {lit.map((cellId) => {
              const cp = pos(cellId);
              return (
                <g key={cellId}>
                  <line x1={gp.x} y1={gp.y - 12} x2={cp.x} y2={cp.y} className="ray-line" />
                  <ellipse cx={cp.x} cy={cp.y} rx="34" ry="26" className="ray-pool" />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* devices: plates at their cells, gates drawn on the edge above */}
      {level.devices.map((d) => {
        if (d.kind === "pressure-plate") {
          const cp = pos(d.cellId);
          const o = entityOffset(d.id, 0);
          const pressed = sim.devices[d.id]?.pressed === true;
          return (
            <g key={d.id} className={pressed ? "device plate pressed" : "device plate"}>
              <image href={`/assets/sprites/props/rbm-prop-states-${pressed ? "04" : "07"}.png`}
                x={cp.x + o.x - 30} y={cp.y + o.y - 26} width="60" height="34"
                preserveAspectRatio="xMidYMid meet" />
              <text x={cp.x + o.x} y={cp.y + o.y + 24} className="device-label">
                plate {pressed ? "pressed" : "up"}
              </text>
            </g>
          );
        }
        if (d.kind === "sensor") {
          const cp = pos(d.cellId);
          const powered = sim.devices[d.id]?.powered === true;
          return <circle key={d.id} cx={cp.x + 44} cy={cp.y - 30} r="7" className={powered ? "device sensor on" : "device sensor"} />;
        }
        return null;
      })}

      {/* loan threads between committed row endpoints */}
      {rows.map((r) => {
        const a = entityPt(r.fromHostId);
        const b = entityPt(r.toHostId);
        const tok = level.tokens.find((t) => t.id === r.tokenId);
        const color = PROPERTY_COLOR[tok?.property ?? ""] ?? "#C99A43";
        const mx = (a.x + b.x) / 2;
        const my = Math.min(a.y, b.y) - 46;
        const focused = focusedRow === r.rowId;
        return (
          <g key={r.rowId} onClick={(ev) => { ev.stopPropagation(); onFocusRow(focused ? null : r.rowId); }} className="loan-thread-hit">
            <path d={`M ${a.x} ${a.y - 18} Q ${mx} ${my} ${b.x} ${b.y - 18}`} className={focused ? "loan-thread focused" : "loan-thread"} stroke={color} />
            <circle cx={a.x} cy={a.y - 18} r="4" fill={color} />
            <circle cx={b.x} cy={b.y - 18} r="4" fill={color} />
            <text x={mx} y={my - 4} className="loan-label">
              {tok?.property ?? r.tokenId} · due {r.dueBeat === null ? "never" : `b${r.dueBeat}`}
            </text>
          </g>
        );
      })}

      {/* props */}
      {level.props.map((p) => {
        const pt = entityPt(p.id);
        const carried = carriedIds.has(p.id);
        const selected = selectedId === p.id;
        const mass = p.baseMass + Object.values(sim.tokens).filter((t) => t.hostEntityId === p.id).reduce((m, t) => m + (level.tokens.find((d) => d.id === t.id)?.effects.mass ?? 0), 0);
        return (
          <g
            key={p.id}
            className={`prop ${selected ? "selected" : ""}`}
            onClick={(ev) => { ev.stopPropagation(); onSelect(selected ? null : p.id); }}
            data-testid={`ent-${p.id}`}
          >
            <image href={`/assets/sprites/props/rbm-prop-states-${p.id.includes("safe") ? "00" : "02"}.png`}
              x={pt.x - 26} y={pt.y - 34} width="52" height="48" preserveAspectRatio="xMidYMid meet" />
            {p.restingOn ? <rect x={pt.x - 26} y={pt.y + 14} width="52" height="6" rx="3" className="prop-rest" /> : null}
            <text x={pt.x} y={pt.y + 34} className="ent-label">
              {nameOf(p.id)}{carried ? " (carried)" : ""} ·m{mass}
            </text>
          </g>
        );
      })}

      {/* crew */}
      {level.crew.map((c, ci) => {
        const s = sim.entities[c.id];
        if (!s) return null;
        const pt = entityPt(c.id);
        const selected = selectedId === c.id;
        return (
          <g
            key={c.id}
            className={`crew ${selected ? "selected" : ""} ${s.captured ? "captured" : ""}`}
            onClick={(ev) => { ev.stopPropagation(); onSelect(selected ? null : c.id); }}
            data-testid={`ent-${c.id}`}
          >
            <image href={`/assets/sprites/crew/rbm-crew-sheet-0${ci % 4}.png`}
              x={pt.x - 16} y={pt.y - 34} width="32" height="44"
              preserveAspectRatio="xMidYMax meet" />
            {s.captured ? <circle cx={pt.x} cy={pt.y - 12} r="16" className="caught-ring" /> : null}
            <text x={pt.x} y={pt.y + 34} className="ent-label">
              {nameOf(c.id)}{s.captured ? " — caught" : ""}
            </text>
          </g>
        );
      })}

      {/* guards */}
      {level.guards.map((g) => {
        const s = sim.entities[g.id];
        if (!s) return null;
        const pt = entityPt(g.id);
        const selected = selectedId === g.id;
        return (
          <g
            key={g.id}
            className={`guard ${selected ? "selected" : ""}`}
            onClick={(ev) => { ev.stopPropagation(); onSelect(selected ? null : g.id); }}
            data-testid={`ent-${g.id}`}
          >
            <image href="/assets/sprites/crew/rbm-crew-sheet-04.png"
              x={pt.x - 17} y={pt.y - 36} width="34" height="48"
              preserveAspectRatio="xMidYMax meet" />
            <text x={pt.x} y={pt.y + 36} className="ent-label">
              {nameOf(g.id)}
            </text>
          </g>
        );
      })}

      {/* token chips on their current hosts */}
      {level.tokens.map((t) => {
        const ts = sim.tokens[t.id];
        if (!ts) return null;
        const host = entityPt(ts.hostEntityId);
        const color = PROPERTY_COLOR[t.property] ?? "#C99A43";
        return (
          <g key={t.id} className={`token status-${ts.status}`} data-testid={`token-${t.id}`}>
            <rect x={host.x - 16} y={host.y - 44} width="32" height="18" rx="9" fill={color} />
            <text x={host.x} y={host.y - 31} className="token-glyph">
              {TOKEN_GLYPH[t.property] ?? "•"} {t.id.replace(/^TOKEN-/, "")}
            </text>
            <line x1={host.x} y1={host.y - 26} x2={host.x} y2={host.y - 14} className="token-pin" />
          </g>
        );
      })}
    </svg>
  );
}
