// Text + slug helpers for the RBM client: friendly names for ids, command
// <-> slug encoding for the per-beat editor, and one-line renderings of engine
// events / predicates (the shell's describeObs/describeOut analogue).

import type { GameEvent } from "../engine/contracts.js";
import type { RbmCrewCommand } from "../engine/rbm/types.js";

export const NAMES: Record<string, string> = {
  "prop-safe": "the portable safe",
  "prop-crate": "the light crate",
  "crew-helper": "the carrier",
  "crew-operator": "the lookout",
  "guard-1": "the custodian",
  "plate-1": "the pressure plate",
  "gate-exit": "the exit gate",
  "TOKEN-H": "HEAVY",
  "TOKEN-B": "BRIGHT",
  "TOKEN-N": "NOISY",
  "room-safe": "the safe room",
  "cell-approach": "the doorway approach",
  "guard-far": "the far gallery",
  "guard-watch": "the watch square",
  "pad-out": "the outside pad",
  "cover-out": "the covered blind",
  inside: "inside",
  outside: "outside",

  // ---- crew (rbm-08/10 four-hand levels) ---------------------------------
  "crew-runner": "the runner",
  "crew-lookout": "the warden",

  // ---- cells ---------------------------------------------------------------
  "cell-alcove": "the alcove",
  "cell-attic": "the attic",
  "cell-bell": "the bell loft",
  "cell-dark": "the dark room",
  "cell-east": "the east room",
  "cell-eastwing": "the east wing",
  "cell-foyer": "the foyer",
  "cell-gallery": "the gallery",
  "cell-hall": "the hall",
  "cell-hub": "the hub",
  "cell-junction": "the junction",
  "cell-landing": "the landing",
  "cell-lobby": "the lobby",
  "cell-loft": "the loft",
  "cell-north": "the north room",
  "cell-nursery": "the nursery",
  "cell-parlor": "the parlor",
  "cell-south": "the south room",
  "cell-store": "the storeroom",
  "cell-vault": "the vault",
  "cell-vestibule": "the vestibule",

  // ---- props ---------------------------------------------------------------
  "prop-anchor-north": "the north anchor",
  "prop-anchor-south": "the south anchor",
  "prop-bust": "the marble bust",
  "prop-candle": "the candle",
  "prop-candlestick": "the candlestick",
  "prop-crown": "the crown",
  "prop-decoy": "the decoy",
  "prop-idol-attic": "the attic idol",
  "prop-idol-bell": "the bell idol",
  "prop-idol-dark": "the dark-room idol",
  "prop-idol-east": "the east idol",
  "prop-idol-gallery": "the gallery idol",
  "prop-idol-loft": "the loft idol",
  "prop-idol-north": "the north idol",
  "prop-idol-south": "the south idol",
  "prop-idol-vault": "the vault idol",
  "prop-idol-vest": "the vestibule idol",
  "prop-lamp": "the lamp",
  "prop-lampstand": "the lamp stand",
  "prop-ledger": "the ledger",
  "prop-nightlamp": "the nightlamp",
  "prop-sack": "the sack",
  "prop-scale-north": "the north scale",
  "prop-scale-vault": "the vault scale",
  "prop-stand": "the lamp stand",
  "prop-statuette": "the statuette",
  "prop-toy": "the wind-up toy",

  // ---- gates ---------------------------------------------------------------
  "gate-attic": "the attic gate",
  "gate-bell": "the bell-loft gate",
  "gate-dark": "the dark-room gate",
  "gate-e1": "the east door",
  "gate-east": "the east gate",
  "gate-gallery": "the gallery door",
  "gate-gallery-window": "the gallery window",
  "gate-lift": "the lift gate",
  "gate-lobby": "the lobby door",
  "gate-loft": "the loft gate",
  "gate-n1": "the north door",
  "gate-north": "the north gate",
  "gate-south": "the south gate",
  "gate-store": "the storeroom door",
  "gate-v1": "the vault door",
  "gate-vault": "the vault gate",
  "gate-window": "the vault window",

  // ---- pressure plates -------------------------------------------------------
  "plate-alarm": "the alarm plate",
  "plate-anchor": "the anchor plate",
  "plate-attic": "the attic plate",
  "plate-bell": "the bell plate",
  "plate-east": "the east plate",
  "plate-hold": "the hold plate",
  "plate-lamp": "the lamp plate",
  "plate-lift": "the lift plate",
  "plate-lock": "the lock plate",
  "plate-loft": "the loft plate",
  "plate-north": "the north plate",
  "plate-south": "the south plate",
  "plate-toy": "the toy plate",
  "plate-vault": "the vault plate",

  // ---- beams (guard vision cones) --------------------------------------------
  "beam-att": "the attic beam",
  "beam-d": "the dark-room beam",
  "beam-e": "the east beam",
  "beam-far": "the far beam",
  "beam-foyer": "the foyer beam",
  "beam-gal": "the gallery beam",
  "beam-gallery": "the gallery beam",
  "beam-hall": "the hall beam",
  "beam-hall2": "the second hall beam",
  "beam-hub": "the hub beam",
  "beam-j": "the junction beam",
  "beam-l": "the loft beam",
  "beam-landing": "the landing beam",
  "beam-lobby": "the lobby beam",
  "beam-n": "the north beam",
  "beam-north": "the north beam",
  "beam-pad": "the pad beam",
  "beam-south": "the south beam",
  "beam-v": "the vault beam",
  "beam-vault": "the vault beam",
  "beam-vest": "the vestibule beam",

  // ---- sensors ---------------------------------------------------------------
  "sensor-ear": "the ear sensor",
  "sensor-eye": "the eye sensor",
  "sensor-junction": "the junction sensor",
  "sensor-lamp": "the lamp sensor",
  "sensor-vault": "the vault sensor",
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

export const PREDICATE_NAMES: Record<string, string> = {
  "plan.complete": "The manifest schedules every required token",
  "safe-delivered": "The safe reaches the outside pad",
  "helper-extracted": "The carrier ends outside",
  "operator-extracted": "The lookout ends outside",
  "crew-safe": "No one is caught",
  "heavy-returned": "HEAVY is home by midnight",

  // shared shapes across levels
  "runner-extracted": "The runner ends outside",
  "lookout-extracted": "The warden ends outside",
  "crew-extracted": "The carrier ends outside",
  "bright-returned": "BRIGHT is home by midnight",
  "bright-home": "BRIGHT is home by midnight",
  "noisy-returned": "NOISY is home by midnight",
  "noisy-home": "NOISY is home by midnight",
  "heavy-home": "HEAVY is home by midnight",

  // per-level deliveries
  "statuette-delivered": "The statuette reaches the outside pad",
  "bust-delivered": "The marble bust reaches the outside pad",
  "toy-posted": "The wind-up toy waits in the alcove",
  "safe-vaulted": "The safe rests in the vault",
  "ledger-out": "The ledger reaches the outside pad",
  "crown-out": "The crown reaches the outside pad",
  "stand-aimed": "The lamp stand is left at the junction",
  "idol-north-out": "The north idol reaches the outside pad",
  "idol-south-out": "The south idol reaches the outside pad",
  "idol-east-out": "The east idol reaches the outside pad",
  "idol-vault-out": "The vault idol reaches the outside pad",
  "idol-dark-out": "The dark-room idol reaches the outside pad",
  "idol-loft-out": "The loft idol reaches the outside pad",
  "idol-bell-out": "The bell idol reaches the outside pad",
  "idol-gallery-out": "The gallery idol reaches the outside pad",
  "idol-attic-out": "The attic idol reaches the outside pad",
  "idol-vest-out": "The vestibule idol reaches the outside pad",
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
