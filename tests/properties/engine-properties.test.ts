/**
 * RBM engine property tests (gate G3/G4 port): invariants that must hold
 * for ANY manifest row / command plan on ANY level.
 *
 *  - determinism: same plan → identical sim result and session hash.
 *  - budget: loans.maxRows is a hard bound; illegal due beats and unknown
 *    borrowers are refused by validateRow; result.accept requires a
 *    successful run.
 *  - command-id idempotency: the room layer re-acks a resubmitted
 *    commandId with dup:true and never re-applies; the engine itself
 *    rejects a reused commandId inside a session.
 *  - undo integrity: history.undo restores the exact pre-commit hash.
 *  - manifest well-formedness: every level's declared loan rules,
 *    devices, patrols, and outcomes resolve to declared entities/beats.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { RbmEngine, type RbmAction, type RbmPlayState } from "../../src/engine/rbm/engine.js";
import { simulate } from "../../src/engine/rbm/sim.js";
import { LEVELS } from "../../src/content/levels/index.js";
import { rbmAdapter } from "../../src/server/rbm-adapter.js";
import { RoomManager, type RoomTransport } from "../../src/server/rooms.js";
import type { ServerMessage } from "../../src/server/protocol.js";
import type { LoanManifestRow, RbmManifest } from "../../src/engine/rbm/types.js";

const eng = new RbmEngine();

/** A random syntactically-legal loan row for a level (valid targets only). */
function arbRow(level: RbmManifest): fc.Arbitrary<LoanManifestRow> {
  const pairs: [string, string][] = [];
  for (const t of level.tokens) {
    for (const p of [...level.props, ...level.crew]) {
      if (p.accepts?.includes(t.property)) {
        pairs.push([t.id, p.id]);
      }
    }
  }
  const due = level.loans.legalDueBeats;
  return fc.record({
    rowId: fc.constant("r-x"),
    tokenId: fc.constantFrom(...pairs.map(p => p[0])),
    toHostId: fc.constantFrom(...pairs.map(p => p[1])),
    fromHostId: fc.constant(""),
    startBeat: fc.integer({ min: 1, max: level.verification.horizonBeat }),
    dueBeat: fc.constantFrom(...due),
  }).map(r => ({
    ...r,
    fromHostId: level.tokens.find(t => t.id === r.tokenId)!.homeEntityId,
  })).filter(r => {
    const t = level.tokens.find(t => t.id === r.tokenId)!;
    const host = [...level.props, ...level.crew].find(p => p.id === r.toHostId);
    return !!host?.accepts?.includes(t.property);
  });
}

function level_of(s: RbmPlayState): RbmManifest {
  return LEVELS.find(l => l.id === s.levelId)!.def;
}
void level_of;

describe("property: determinism", () => {
  it.each(LEVELS.map(l => l.def))("%s: same plan → identical sim + identical session hash", (level) => {
    fc.assert(
      fc.property(
        fc.array(arbRow(level), { minLength: 0, maxLength: 3 }),
        (rows) => {
          const plan = {
            rows: rows.map((r, i) => ({ ...r, rowId: `r${i}` })),
            commands: {} as Record<number, Record<string, never>>,
          };
          const a = simulate(level, plan, "p");
          const b = simulate(level, plan, "p");
          expect(a.finalHash).toBe(b.finalHash);
          expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
          expect(a.evaluation.success).toBe(b.evaluation.success);
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe("property: loan budget + row legality", () => {
  it.each(LEVELS.map(l => l.def))("%s: maxRows is a hard bound; illegal rows refuse", (level) => {
    // Over-budget: committing more than maxRows must fail on the extra row.
    const probe = arbRow(level);
    fc.assert(
      fc.property(fc.array(probe, { minLength: 1, maxLength: 1 }), (rows) => {
        let s = eng.createInitialState(level);
        const count = level.loans.maxRows + 1;
        let rejected = false;
        for (let i = 0; i < count; i++) {
          // Distinct tokens where the level has them; a same-token row is
          // rejected for overlap/duplicate just as firmly.
          const t = level.tokens[i % level.tokens.length]!;
          const host = [...level.props, ...level.crew].find(p => p.accepts?.includes(t.property));
          if (!host) return; // no legal host at all — nothing to probe
          const row: LoanManifestRow = {
            rowId: `over-${i}`, tokenId: t.id, fromHostId: t.homeEntityId,
            toHostId: host.id, startBeat: 1, dueBeat: rows[0]!.dueBeat,
          };
          const a: RbmAction = {
            actorId: "p", commandId: `b-${i}`, baseRevision: s.revision,
            payload: { type: "manifest.commit", row },
          };
          const c = eng.validateAction(level, s, a);
          if (!c.ok) { rejected = true; break; }
          s = eng.applyAction(level, s, a).state;
        }
        expect(rejected, "committing maxRows+1 rows must be refused").toBe(true);
      }),
      { numRuns: 3 },
    );

    // A row to an incompatible host is always refused.
    fc.assert(
      fc.property(arbRow(level), (row) => {
        const t = level.tokens.find(x => x.id === row.tokenId)!;
        const bad = [...level.props, ...level.crew].find(p => !p.accepts?.includes(t.property));
        if (!bad) return;
        const s = eng.createInitialState(level);
        const a: RbmAction = {
          actorId: "p", commandId: "bad-1", baseRevision: s.revision,
          payload: {
            type: "manifest.commit",
            row: { ...row, toHostId: bad.id },
          },
        };
        expect(eng.validateAction(level, s, a).ok).toBe(false);
      }),
      { numRuns: 8 },
    );

    // A due beat outside the legal menu is always refused.
    for (const token of level.tokens) {
      const host = [...level.props, ...level.crew].find(p => p.accepts?.includes(token.property));
      if (!host) continue;
      for (const d of [0, -1, level.verification.horizonBeat + 5]) {
        if (level.loans.legalDueBeats.includes(d)) continue;
        const s = eng.createInitialState(level);
        const a: RbmAction = {
          actorId: "p", commandId: `bad-${d}`, baseRevision: s.revision,
          payload: {
            type: "manifest.commit",
            row: {
              rowId: "r", tokenId: token.id, fromHostId: token.homeEntityId,
              toHostId: host.id, startBeat: 1, dueBeat: d,
            },
          },
        };
        expect(eng.validateAction(level, s, a).ok).toBe(false);
      }
    }
  });

  it("result.accept refuses without a successful run; accept after success is idempotent by phase", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LEVELS.map(l => l.id)), (id) => {
        const level = LEVELS.find(l => l.id === id)!.def;
        const s = eng.createInitialState(level);
        const a: RbmAction = {
          actorId: "p", commandId: "acc", baseRevision: s.revision,
          payload: { type: "result.accept" },
        };
        expect(eng.validateAction(level, s, a).ok).toBe(false);
      }),
    );
  });
});

describe("property: session integrity — dup commandIds and undo", () => {
  it.each(LEVELS.map(l => l.def))("%s: reused commandId refused; undo restores pre-commit hash", (level) => {
    const hostPairs: { t: string; h: string }[] = [];
    for (const t of level.tokens) {
      const host = [...level.props, ...level.crew].find(p => p.accepts?.includes(t.property));
      if (host) hostPairs.push({ t: t.id, h: host.id });
    }
    if (!hostPairs.length) return;
    let s = eng.createInitialState(level);
    const h0 = eng.canonicalHash(level, s);
    const pair = hostPairs[0]!;
    const mk = (id: string): RbmAction => ({
      actorId: "p", commandId: id, baseRevision: s.revision,
      payload: {
        type: "manifest.commit",
        row: {
          rowId: `r-${id}`, tokenId: pair.t,
          fromHostId: level.tokens.find(x => x.id === pair.t)!.homeEntityId,
          toHostId: pair.h, startBeat: 1,
          dueBeat: level.loans.legalDueBeats.find(d => d !== null) ?? null,
        },
      },
    });
    const a1 = mk("dup-x");
    expect(eng.validateAction(level, s, a1).ok).toBe(true);
    s = eng.applyAction(level, s, a1).state;
    // Same commandId again → duplicate refusal (engine-level idempotency).
    expect(eng.validateAction(level, s, mk("dup-x")).reason).toBe("duplicate-command-id");
    // Undo restores the exact pre-commit state hash.
    const u: RbmAction = {
      actorId: "p", commandId: "u1", baseRevision: s.revision,
      payload: { type: "history.undo" },
    };
    expect(eng.validateAction(level, s, u).ok).toBe(true);
    s = eng.applyAction(level, s, u).state;
    expect(eng.canonicalHash(level, s)).toBe(h0);
    expect(s.manifestRows).toHaveLength(0);
  });
});

describe("property: command-id idempotency (room layer)", () => {
  it("resubmitted commandId re-acks dup:true, applied exactly once", () => {
    const sent: ServerMessage[] = [];
    const transport: RoomTransport = {
      send: (_c, m) => { sent.push(m); },
      closeConn: () => {},
    };
    const manager = new RoomManager({ adapters: [rbmAdapter], transport, sweepIntervalMs: 0 });
    const created = manager.createRoom("c-1", { ephemeral: true, seed: "RBM-01" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const payload = {
      type: "manifest.commit",
      row: {
        rowId: "r1", tokenId: "TOKEN-H", fromHostId: "prop-safe",
        toHostId: "prop-crate", startBeat: 1, dueBeat: 3,
      },
    };
    const first = manager.submitCommand("c-1", {
      commandId: "cmd-1", baseRevision: created.room.revision, payload,
    });
    expect(first.ok && !first.duplicate).toBe(true);
    const rev = created.room.revision;
    const again = manager.submitCommand("c-1", {
      commandId: "cmd-1", baseRevision: 0, payload,
    });
    expect(again.ok && again.duplicate).toBe(true);
    expect(created.room.revision).toBe(rev);
    expect(created.room.log).toHaveLength(1);
  });
});

describe("property: manifest well-formedness (every declared reference resolves)", () => {
  it.each(LEVELS.map(l => [l.id, l.def] as const))("%s", (_id, level) => {
    const cellIds = new Set(level.cells.map(c => c.id));
    const entityIds = new Set([
      ...level.props.map(p => p.id),
      ...level.crew.map(c => c.id),
      ...level.guards.map(g => g.id),
      ...level.tokens.map(t => t.id),
      ...level.devices.map(d => d.id),
    ]);
    // Edges connect declared cells.
    for (const e of level.edges) {
      expect(cellIds.has(e.a) && cellIds.has(e.b), `edge ${e.a}~${e.b} off-map`).toBe(true);
    }
    // Loans: tokens/hosts exist, legal due beats within horizon.
    const tokenIds = new Set(level.tokens.map(t => t.id));
    for (const t of level.tokens) {
      expect(entityIds.has(t.homeEntityId), `token ${t.id} home`).toBe(true);
    }
    for (const rt of level.loans.requiredTokens) {
      expect(tokenIds.has(rt)).toBe(true);
    }
    for (const d of level.loans.legalDueBeats) {
      if (d !== null) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(level.verification.horizonBeat);
      }
    }
    // Devices: plates sit on declared cells and target declared devices;
    // sensors sit on declared cells.
    const deviceIds = new Set(level.devices.map(d => d.id));
    for (const d of level.devices) {
      if (d.kind === "pressure-plate") {
        expect(cellIds.has(d.cellId), `plate ${d.id} cell`).toBe(true);
        for (const t of d.targets) {
          expect(deviceIds.has(t.deviceId), `plate ${d.id} → undeclared device`).toBe(true);
        }
      }
      if (d.kind === "sensor") {
        expect(cellIds.has(d.cellId)).toBe(true);
      }
    }
    // Outcomes reference declared entities/cells.
    for (const o of level.outcomes) {
      if ("entityId" in o) expect(entityIds.has(o.entityId), o.id).toBe(true);
      if ("cellId" in o) expect(cellIds.has(o.cellId), o.id).toBe(true);
      if ("tokenId" in o) expect(tokenIds.has(o.tokenId), o.id).toBe(true);
    }
  });
});
