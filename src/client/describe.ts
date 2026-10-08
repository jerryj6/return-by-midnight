// Text + slug helpers for the RBM client: friendly names for ids, command
// <-> slug encoding for the per-beat editor, and one-line renderings of engine
// events / predicates (the shell's describeObs/describeOut analogue).

import type { GameEvent } from "../engine/contracts.js";
import type { RbmCrewCommand } from "../engine/rbm/types.js";

const NAMES: Record<string, string> = {
  "prop-safe": "the portable safe",
  "prop-crate": "the light crate",
  "crew-helper": "the carrier",
  "crew-operator": "the lookout",
  "guard-1": "the custodian",
  "plate-1": "the pressure plate",
  "gate-exit": "the exit gate",
  "TOKEN-H": "HEAVY",
  "room-safe": "the safe room",
  "cell-approach": "the doorway approach",
  "guard-far": "the far gallery",
  "guard-watch": "the watch square",
  "pad-out": "the outside pad",
  "cover-out": "the covered blind",
  inside: "inside",
  outside: "outside",
};

export function nameOf(id: string | undefined | null): string {
  if (!id) return "?";
  return NAMES[id] ?? id;
}

export const PROPERTY_COLOR: Record<string, string> = {
  HEAVY: "#6682A3",
  BRIGHT: "#E8C86A",
  NOISY: "#A780B7",
};

// ---- command slugs (stable, also used by the e2e spec) ---------------------

export function cmdSlug(c: RbmCrewCommand): string {
  switch (c.type) {
    case "wait":
      return "wait";
    case "drop":
      return "drop";
    case "move":
      return `move:${c.to}`;
    case "pickup":
      return `pickup:${c.propId}`;
    case "pickup-and-move":
      return `pm:${c.propId}:${c.to}`;
  }
}

export function slugCmd(slug: string): RbmCrewCommand | null {
  const p = slug.split(":");
  switch (p[0]) {
    case "wait":
      return { type: "wait" };
    case "drop":
      return { type: "drop" };
    case "move":
      return p[1] ? { type: "move", to: p[1] } : null;
    case "pickup":
      return p[1] ? { type: "pickup", propId: p[1] } : null;
    case "pm":
      return p[1] && p[2] ? { type: "pickup-and-move", propId: p[1], to: p[2] } : null;
    default:
      return null;
  }
}

export function describeCommand(c: RbmCrewCommand): string {
  switch (c.type) {
    case "wait":
      return "Wait";
    case "move":
      return `Move to ${nameOf(c.to)}`;
    case "pickup":
      return `Pick up ${nameOf(c.propId)}`;
    case "drop":
      return "Set cargo down";
    case "pickup-and-move":
      return `Take ${nameOf(c.propId)} to ${nameOf(c.to)}`;
  }
}

// ---- events ----------------------------------------------------------------

export function describeEvent(e: GameEvent): string {
  const d = e.data ?? {};
  const s = (k: string) => (d[k] == null ? "?" : String(d[k]));
  switch (e.type) {
    case "manifest.row.commit": {
      const row = d["row"] as { tokenId?: string; fromHostId?: string; toHostId?: string; startBeat?: number; dueBeat?: number | null } | undefined;
      if (!row) return "manifest row committed";
      return `${nameOf(row.tokenId)}: ${nameOf(row.fromHostId)} → ${nameOf(row.toHostId)}, starts beat ${row.startBeat}, due ${row.dueBeat === null ? "never" : `end of beat ${row.dueBeat}`}`;
    }
    case "manifest.row.retract":
      return `manifest row withdrawn`;
    case "command.queued":
      return `${nameOf(e.entityId)}: beat ${s("beat")} — ${describeCommand((d["command"] ?? { type: "wait" }) as RbmCrewCommand)}`;
    case "command.cleared":
      return `${nameOf(e.entityId)}: beat ${s("beat")} cleared`;
    case "loan.start":
      return `${nameOf(e.entityId)} moves to ${nameOf(s("to"))} — due ${d["dueBeat"] === null ? "never" : `end of beat ${s("dueBeat")}`}`;
    case "loan.rejected":
      return `loan refused: ${s("reason")}`;
    case "crew.wait":
      return `${nameOf(e.entityId)} waits`;
    case "crew.move":
      return `${nameOf(e.entityId)} moves ${nameOf(s("from"))} → ${nameOf(s("to"))}${d["withCargo"] ? ` carrying ${nameOf(String(d["withCargo"]))}` : ""}`;
    case "crew.pickup":
      return `${nameOf(e.entityId)} picks up ${nameOf(s("propId"))}`;
    case "crew.drop":
      return `${nameOf(e.entityId)} sets down ${nameOf(s("propId"))}`;
    case "command.rejected":
      return `${nameOf(e.entityId)} order fails: ${s("reason")}`;
    case "plate.press":
      return `${nameOf(e.entityId)} presses down (mass ${s("mass")} ≥ ${s("threshold")})`;
    case "plate.release":
      return `${nameOf(e.entityId)} releases`;
    case "gate.open":
      return `${nameOf(e.entityId)} opens`;
    case "gate.close":
      return `${nameOf(e.entityId)} closes`;
    case "sensor.power":
      return `${nameOf(e.entityId)} powers on`;
    case "sensor.unpower":
      return `${nameOf(e.entityId)} powers off`;
    case "guard.attention":
      return `${nameOf(e.entityId)} surveys from ${nameOf(s("post"))}`;
    case "guard.detect":
      return `${nameOf(e.entityId)} spots ${nameOf(s("crewId"))} at ${nameOf(s("cellId"))}!`;
    case "guard.capture":
      return `${nameOf(e.entityId)} catches ${nameOf(s("crewId"))} at ${nameOf(s("cellId"))}`;
    case "guard.move":
      return `${nameOf(e.entityId)} moves to ${nameOf(s("to"))}`;
    case "token.return":
      return `${nameOf(e.entityId)} returns home to ${nameOf(s("to"))} at ${nameOf(s("homeCellId"))}`;
    case "cargo.settled":
      return `${nameOf(e.entityId)} grows heavy and settles at ${nameOf(s("cellId"))}`;
    case "beat.end":
      return `beat ${e.beat} ends`;
    case "evaluation":
      return `the operation is judged`;
    case "run.success":
      return `operation succeeds at the horizon`;
    case "run.fail":
      return `operation fails`;
    case "test.run":
      return `plan tested (seed ${s("seed")})`;
    case "history.undone":
      return "plan undone one step";
    case "plan.reset":
      return "plan reset";
    case "result.accepted":
      return "result accepted";
    case "action.rejected":
      return `rejected: ${s("reason")}`;
    default:
      return e.type;
  }
}

// ---- predicates --------------------------------------------------------------

const PREDICATE_NAMES: Record<string, string> = {
  "plan.complete": "The manifest schedules every required token",
  "safe-delivered": "The safe reaches the outside pad",
  "helper-extracted": "The carrier ends outside",
  "operator-extracted": "The lookout ends outside",
  "crew-safe": "No one is caught",
  "heavy-returned": "HEAVY is home by midnight",
};

export function describePredicate(id: string): string {
  return PREDICATE_NAMES[id] ?? id;
}

export function tokenStatusLabel(status: string): string {
  switch (status) {
    case "home":
      return "home";
    case "staged":
      return "staged";
    case "held":
      return "on loan";
    case "returned":
      return "returned";
    case "converted":
      return "converted";
    default:
      return status;
  }
}
