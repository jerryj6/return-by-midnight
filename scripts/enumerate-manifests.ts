// Enumerate the manifest half of the solution space (AUTOMATED playtest):
// for each level, generate every legal manifest — every non-overlapping set of
// (token × compatible host × startBeat × dueBeat) rows that covers the required
// tokens within loans.maxRows — and replay the committed crew commands against
// each one. Winners are grouped into solve FAMILIES by their token→host routing
// signature: a family is an interestingly-distinct plan; variants inside a
// family are the designed multiplicity / tolerance band.
//
//   npx tsx scripts/enumerate-manifests.ts [--level rbm-05]
//
// Bounded: startBeat ∈ 1..horizonBeat, dueBeat ∈ legalDueBeats, ≤2 rows per
// token (no committed plan ever needs more). Commands stay fixed — this maps
// the manifest alternates, not the choreography space.
import { simulate } from "../src/engine/rbm/sim.js";
import type { LoanManifestRow, RbmDeviceDef, RbmManifest, RbmPlan } from "../src/engine/rbm/types.js";
import { RBM01, rbm01ReferencePlan } from "../src/content/levels/rbm01-weight-of-evidence.js";
import { RBM02, rbm02ReferencePlan } from "../src/content/levels/rbm02-lights-out-lights-back.js";
import { RBM03, rbm03ReferencePlan } from "../src/content/levels/rbm03-quiet-then-quite-loud.js";
import { RBM04, rbm04ReferencePlan } from "../src/content/levels/rbm04-the-traveling-owner.js";
import { RBM05, rbm05ReferencePlan } from "../src/content/levels/rbm05-one-light-two-jobs.js";
import { RBM06, rbm06ReferencePlan } from "../src/content/levels/rbm06-the-door-that-pays-you-back.js";
import { RBM07, rbm07ReferencePlan } from "../src/content/levels/rbm07-double-booking.js";
import { RBM08, rbm08ReferencePlan } from "../src/content/levels/rbm08-last-call.js";
import { RBM09, rbm09ReferencePlan } from "../src/content/levels/rbm09-the-moving-deposit.js";
import { RBM10, rbm10ReferencePlan } from "../src/content/levels/rbm10-the-quietest-exit.js";
import { RBM11, rbm11ReferencePlan } from "../src/content/levels/rbm11-night-shift.js";
import { RBM12, rbm12ReferencePlan } from "../src/content/levels/rbm12-midnight-returns.js";

const SEED = "enumerate";

interface CandidateRow { tokenId: string; fromHostId: string; toHostId: string; startBeat: number; dueBeat: number | null }

const levels: [RbmManifest, () => RbmPlan][] = [
  [RBM01, rbm01ReferencePlan], [RBM02, rbm02ReferencePlan], [RBM03, rbm03ReferencePlan],
  [RBM04, rbm04ReferencePlan], [RBM05, rbm05ReferencePlan], [RBM06, rbm06ReferencePlan],
  [RBM07, rbm07ReferencePlan], [RBM08, rbm08ReferencePlan], [RBM09, rbm09ReferencePlan],
  [RBM10, rbm10ReferencePlan], [RBM11, rbm11ReferencePlan], [RBM12, rbm12ReferencePlan],
];
const only = process.argv.find((a) => a.startsWith("--level="))?.split("=")[1];

function hostsFor(level: RbmManifest, property: string): string[] {
  const hosts: string[] = [];
  for (const p of level.props) if (p.accepts.includes(property as never)) hosts.push(p.id);
  for (const c of level.crew) if ((c.accepts ?? []).includes(property as never)) hosts.push(c.id);
  return hosts;
}

function candidates(level: RbmManifest, tokenId: string): CandidateRow[] {
  const token = level.tokens.find((t) => t.id === tokenId)!;
  const out: CandidateRow[] = [];
  for (const host of hostsFor(level, token.property)) {
    if (host === token.homeEntityId) continue;
    for (let s = 1; s <= level.verification.horizonBeat; s++) {
      for (const due of level.loans.legalDueBeats) {
        if (due !== null && due < s) continue;
        out.push({ tokenId, fromHostId: token.homeEntityId, toHostId: host, startBeat: s, dueBeat: due });
      }
    }
  }
  return out;
}

const end = (d: number | null) => (d === null ? Number.POSITIVE_INFINITY : d);
const overlaps = (a: CandidateRow, b: CandidateRow) =>
  a.tokenId === b.tokenId && a.startBeat <= end(b.dueBeat) && b.startBeat <= end(a.dueBeat);

/** All legal row subsets covering requiredTokens: per token, 1–2 non-overlapping rows. */
function manifests(level: RbmManifest): LoanManifestRow[][] {
  const perToken = rowSetsPerToken(level);
  // cross product, capped by maxRows
  const out: LoanManifestRow[][] = [[]];
  for (const { choices } of perToken) {
    const next: LoanManifestRow[][] = [];
    for (const acc of out) for (const c of choices) {
      const merged = [...acc, ...c];
      if (merged.length <= level.loans.maxRows) next.push(merged);
    }
    out.splice(0, out.length, ...next);
  }
  return out.filter((rows) => level.loans.requiredTokens.every((t) => rows.some((r) => r.tokenId === t)));
}

/** Per-token legal row subsets (1–2 non-overlapping rows; [] for optional tokens). */
function rowSetsPerToken(level: RbmManifest): { tokenId: string; required: boolean; choices: LoanManifestRow[][] }[] {
  const perToken: { tokenId: string; required: boolean; choices: LoanManifestRow[][] }[] = [];
  for (const t of level.tokens) {
    const req = level.loans.requiredTokens.includes(t.id);
    const cands = candidates(level, t.id).map((c) => ({ ...c, rowId: `${c.tokenId}->${c.toHostId}@${c.startBeat}~${c.dueBeat}` }));
    const singles = cands.map((r) => [r]);
    const pairs: LoanManifestRow[][] = [];
    for (let i = 0; i < cands.length; i++)
      for (let j = i + 1; j < cands.length; j++)
        if (!overlaps(cands[i]!, cands[j]!)) pairs.push([cands[i]!, cands[j]!]);
    const choices: LoanManifestRow[][] = [...singles, ...pairs];
    if (!req) choices.unshift([]); // optional token may carry zero rows
    perToken.push({ tokenId: t.id, required: req, choices });
  }
  return perToken;
}

const signature = (rows: LoanManifestRow[]) =>
  rows.map((r) => `${r.tokenId}→${r.toHostId}`).sort().join(" + ");

// ---------------------------------------------------------------------------
// Gate-coverage prefilter (refine-6): a manifest can only win under the
// committed commands if every gate the commands cross is pressed open at each
// crossing beat. Requirements are derived statically from the reference
// plan's gated edge crossings:
//   - normal gate: some row must host the plate's prop at that beat
//     (row.startBeat <= beat <= row.dueBeat)
//   - inverted gate (plate under a token's HOME prop, e.g. rbm-12's
//     gate-inner): the home token must be home at that beat — no active row.
// Manifests failing this are guaranteed gate-closed failures — counted and
// spot-checked, not simulated.
// ---------------------------------------------------------------------------

interface GateReq { gateId: string; beats: number[] }

/** (gate,beat) requirements of the committed reference plans, derived by hand
 *  from each plan's gated crossings (verified by the spot-check below). */
const REQUIREMENTS: Record<string, GateReq[]> = {
  "rbm-08": [
    // Crossings at b4 (hall→north, hall→east, hall→lobby) and b5 (hall→vault).
    // n1/lobby are press-to-CLOSE plates (dark-lamp = open doors): TOKEN-B must
    // be away. e1 is home-pressured (rattle home on the toy). v1 is press-open.
    { gateId: "gate-n1", beats: [4] },
    { gateId: "gate-lobby", beats: [4] },
    { gateId: "gate-e1", beats: [4] },
    { gateId: "gate-v1", beats: [5] },
  ],
  "rbm-10": [
    // bell loft crossed b2-3 (NOISY on the decoy), attic b5-6 (BRIGHT on the
    // lampstand), gallery window b6-7 (NOISY home — home-pressured plate-toy).
    { gateId: "gate-bell", beats: [2, 3] },
    { gateId: "gate-attic", beats: [5, 6] },
    { gateId: "gate-gallery-window", beats: [6, 7] },
  ],
  "rbm-11": [
    { gateId: "gate-west", beats: [3, 4] },
    { gateId: "gate-east", beats: [3, 4] },
    { gateId: "gate-west-win", beats: [6, 7] },
    { gateId: "gate-east-win", beats: [6, 7] },
  ],
  "rbm-12": [
    { gateId: "gate-hall", beats: [3] },
    { gateId: "gate-vault", beats: [4, 5] },
    { gateId: "gate-inner", beats: [5, 6] },
    { gateId: "gate-outer", beats: [6, 7] },
  ],
};

/** The three plate polarities seen in committed levels:
 *  - "host-open": posting a token onto the host presses the plate open
 *    (ordinary lending host, whenPressed:"open")
 *  - "home-open": the token weighted HOME presses the plate open — the gate
 *    opens when the posting ENDS (rbm-12 gate-inner; whenPressed:"open" on a
 *    homeEntityId prop)
 *  - "away-open": the plate CLOSES gates while pressed, so the gate opens
 *    while the home token is AWAY on loan (rbm-08's dark-lamp doors;
 *    whenPressed:"close" on a homeEntityId prop)
 *  - "away-open-host": whenPressed:"close" on a non-home host — open while
 *    the host carries nothing (no committed level; handled for completeness) */
type PlateMode = "host-open" | "home-open" | "away-open" | "away-open-host";

function plateOf(level: RbmManifest, gateId: string): { hostId: string; tokenId: string | null; mode: PlateMode } | null {
  const plate = level.devices.find(
    (d): d is RbmDeviceDef & { kind: "pressure-plate"; targets: { deviceId: string; whenPressed: "open" | "close" }[] } =>
      d.kind === "pressure-plate" && (d as { targets?: { deviceId: string }[] }).targets?.some((t) => t.deviceId === gateId) === true,
  );
  if (!plate) return null;
  const closeWhenPressed = plate.targets.some((t) => t.deviceId === gateId && t.whenPressed === "close");
  const host = level.props.find((p) => p.restingOn === plate.id);
  if (!host) return null;
  const homeToken = level.tokens.find((t) => t.homeEntityId === host.id);
  const mode: PlateMode = closeWhenPressed
    ? homeToken ? "away-open" : "away-open-host"
    : homeToken ? "home-open" : "host-open";
  return { hostId: host.id, tokenId: homeToken?.id ?? null, mode };
}

const activeAt = (rows: LoanManifestRow[], tokenId: string, b: number) =>
  rows.some((r) => r.tokenId === tokenId && r.startBeat <= b && b <= (r.dueBeat ?? Number.POSITIVE_INFINITY));
const hostedAt = (rows: LoanManifestRow[], hostId: string, b: number) =>
  rows.some((r) => r.toHostId === hostId && r.startBeat <= b && b <= (r.dueBeat ?? Number.POSITIVE_INFINITY));

/** Does the row-set satisfy the gate requirement at every listed beat? */
function covers(rows: LoanManifestRow[], level: RbmManifest, req: GateReq): boolean {
  const plate = plateOf(level, req.gateId);
  if (!plate) return true;
  for (const b of req.beats) {
    switch (plate.mode) {
      case "host-open": if (!hostedAt(rows, plate.hostId, b)) return false; break;
      case "home-open": if (plate.tokenId && activeAt(rows, plate.tokenId, b)) return false; break;
      case "away-open": if (!plate.tokenId || !activeAt(rows, plate.tokenId, b)) return false; break;
      case "away-open-host": if (hostedAt(rows, plate.hostId, b)) return false; break;
    }
  }
  return true;
}

/** The token that owns a gate requirement — the host's accepted property, or
 *  the home token for inverted (home-pressured) plates. */
function owningToken(level: RbmManifest, req: GateReq): string | null {
  const plate = plateOf(level, req.gateId);
  if (!plate) return null;
  // Home-linked modes are owned by the home token; host-open by the accepted
  // property's token; away-open-host by nobody (always satisfied).
  if (plate.mode === "home-open" || plate.mode === "away-open") return plate.tokenId;
  if (plate.mode === "away-open-host") return null;
  const host = level.props.find((p) => p.id === plate.hostId);
  const token = level.tokens.find((t) => host?.accepts.includes(t.property as never));
  return token?.id ?? null;
}

/** Manifest enumeration with per-token coverage prefilter: every gate is fed
 *  by exactly one token's host (or home), so filtering each token's row-sets
 *  independently eliminates all guaranteed gate-closed manifests before the
 *  cross product — keeps rbm-11/12 tractable without skipping a real winner.
 *  Rejected sets are sampled and sim-checked as a filter audit. */
function manifestsFiltered(level: RbmManifest, reqs: GateReq[]): { sets: LoanManifestRow[][]; eliminated: LoanManifestRow[][] } {
  const perToken = rowSetsPerToken(level);
  const eliminated: LoanManifestRow[][] = [];
  for (const pt of perToken) {
    const mine = reqs.filter((r) => owningToken(level, r) === pt.tokenId);
    if (!mine.length) continue;
    const keep = pt.choices.filter((rows) => mine.every((req) => covers(rows, level, req)));
    const drop = pt.choices.filter((rows) => !mine.every((req) => covers(rows, level, req)));
    // Audit the REJECTED SET, not its rows: coverage decisions are made on the
    // whole token-set, so padding a single row of a rejected pair would fake a
    // miss on a correct rejection.
    for (const rows of drop) eliminated.push(rows);
    pt.choices = keep;
  }
  const out: LoanManifestRow[][] = [[]];
  for (const { choices } of perToken) {
    const next: LoanManifestRow[][] = [];
    for (const acc of out) for (const c of choices) {
      const merged = [...acc, ...c];
      if (merged.length <= level.loans.maxRows) next.push(merged);
    }
    out.splice(0, out.length, ...next);
  }
  const sets = out.filter((rows) => level.loans.requiredTokens.every((t) => rows.some((r) => r.tokenId === t)));
  return { sets, eliminated };
}

let totalSims = 0;
for (const [level, ref] of levels) {
  if (only && level.levelId !== only) continue;
  const commands = ref().commands;
  const wins: LoanManifestRow[][] = [];
  const reqs = REQUIREMENTS[level.levelId] ?? [];
  let sets: LoanManifestRow[][];
  let eliminatedNote = "none";
  if (reqs.length) {
    const { sets: s, eliminated } = manifestsFiltered(level, reqs);
    sets = s;
    // Spot-check the filter: sample eliminated row-sets, pad to a full
    // manifest with other rejected rows — every one must lose.
    let misses = 0;
    // Pad each rejected token-set with the committed winning rows for the
    // OTHER tokens — only the eliminated component is defective; must lose.
    const refRows = ref().rows;
    for (const e of eliminated.slice(0, 100)) {
      const tokenIds = new Set(e.map((r) => r.tokenId));
      const padded = [...e, ...refRows.filter((r) => !tokenIds.has(r.tokenId))];
      if (padded.length > level.loans.maxRows) continue;
      totalSims++;
      if (simulate(level, { rows: padded, commands }, SEED).evaluation.success) {
        misses++;
        console.log(`  !! PREFILTER MISS — eliminated manifest wins: ${padded.map((r) => r.rowId).join(" + ")}`);
      }
    }
    eliminatedNote = `${eliminated.length} row-sets statically eliminated (padded spot-checks → ${misses} misses)`;
  } else {
    sets = manifests(level);
  }
  const survivors = sets;
  for (const rows of survivors) {
    const r = simulate(level, { rows, commands }, SEED);
    totalSims++;
    if (r.evaluation.success) wins.push(rows);
  }
  const families = new Map<string, LoanManifestRow[][]>();
  for (const w of wins) {
    const sig = signature(w);
    (families.get(sig) ?? families.set(sig, []).get(sig)!).push(w);
  }
  console.log(`\n=== ${level.levelId} — ${sets.length} manifests simulated (${eliminatedNote}), ${wins.length} win, ${families.size} families`);
  for (const [sig, fam] of [...families.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const beats = fam.map((rows) => rows.map((r) => `${r.rowId}`).join(" + "));
    console.log(`  FAMILY ${sig} — ${fam.length} winning manifests:`);
    for (const b of beats.slice(0, 12)) console.log(`    ${b}`);
    if (beats.length > 12) console.log(`    … +${beats.length - 12} more`);
  }
}
console.log(`\nTotal sims: ${totalSims}`);
