import type { HeistState, LevelDef, Outcome, Prop } from "../../engine/heist/types";

export const PROP_WORD: Record<Prop, string> = { HEAVY: "weight", BRIGHT: "glow", NOISY: "noise" };

export function nameOf(level: LevelDef, id: string | undefined): string {
  if (!id) return "";
  return level.crew.find((c) => c.id === id)?.name ?? level.guards.find((g) => g.id === id)?.name ?? level.objects.find((o) => o.id === id)?.name ?? "";
}

export function outcomeCopy(level: LevelDef, o: Outcome, st: HeistState): { title: string; body: string } {
  if (o.result === "won") return { title: "Heist complete", body: `Out clean with ${level.midnight - o.turn} ${level.midnight - o.turn === 1 ? "turn" : "turns"} to spare.` };
  switch (o.reason) {
    case "seen":
      return { title: "Spotted!", body: `${nameOf(level, o.guardId) || "A guard"} saw ${nameOf(level, o.crewId) || "the crew"}. Rewind and find a gap in the cone.` };
    case "shutIn":
      return { title: "Caught in the doorway", body: `${nameOf(level, o.crewId) || "Someone"} was still under the gate when it swung shut.` };
    case "midnight":
      return { title: "Midnight struck", body: "The crew didn't make it out in time. Everyone has to be standing on an exit." };
    case "loanNotHome": {
      const ids = o.tokenIds ?? st.tokens.filter((t) => t.dueTurn !== null).map((t) => t.id);
      const toks = level.tokens.filter((t) => ids.includes(t.id));
      const what = toks.map((t) => `the ${nameOf(level, t.home).toLowerCase() || "object"}'s ${PROP_WORD[t.prop]}`).join(" and ");
      return { title: "A loan wasn't returned", body: `At midnight ${what || "a borrowed property"} was still away from home. Everything you borrow must be home before you leave.` };
    }
  }
}
