/** heist-room.test.ts — live-server tests for the heist adapter.
 *  Hidden-plan redaction, lock/resolve flow, pings and crew-seat assignment.
 */
import { afterEach, describe, expect, it } from "vitest";
import { startRoomServer, type RoomServer } from "../../src/server/index.js";
import { heistAdapter } from "../../src/server/heist-adapter.js";
import { TestClient } from "./helpers.js";
import { HEIST_LEVELS } from "../../src/content/heist/levels.js";

const open: TestClient[] = [];
const servers: RoomServer[] = [];

afterEach(async () => {
  while (open.length) await open.pop()!.close();
  while (servers.length) await servers.pop()!.close();
});

async function boot(): Promise<RoomServer> {
  const srv = await startRoomServer({
    adapters: [heistAdapter],
    defaultGameType: "rbm",
    port: 0,
    host: "127.0.0.1",
    dataDir: null,
    sweepIntervalMs: 0,
    heartbeatMs: 60_000,
    logger: () => {},
  });
  servers.push(srv);
  return srv;
}

async function client(port: number): Promise<TestClient> {
  const c = await TestClient.connect(port);
  open.push(c);
  return c;
}

function viewOf(m: { type: string; events?: unknown[] } | undefined): any {
  const ev = (m?.events ?? []) as { type?: string; view?: unknown }[];
  return ev.find(e => e.type === "heist.view")?.view;
}

const plan1 = { plans: { pip: { path: [{ x: 2, y: 1 }] } } };
const plan2 = { plans: { marlo: { path: [{ x: 2, y: 2 }] } } };

describe("heist room", () => {
  it("two seats lock separately; plan contents are never leaked, then the turn resolves", async () => {
    const srv = await boot();
    const a = await client(srv.port);
    await a.create({ gameType: "rbm" });
    const b = await client(srv.port);
    await b.join(a.roomCode);

    // seat 1 owns pip, seat 2 owns marlo (crew index % seats)
    const r1 = await a.command(a.newCommandId(), a.knownRev, { type: "lock", ...plan1 });
    expect(r1.type).toBe("state_patch");
    if (r1.type === "state_patch") {
      // the broadcast payload is redacted
      expect(JSON.stringify(r1.payload)).toBe('{"type":"lock"}');
      const v = viewOf(r1);
      expect(v.lockedSeats).toEqual([1]);
      expect(v.crewSeats).toEqual({ pip: 1, marlo: 2 });
      // view contains no plan contents for the other seat
      expect(JSON.stringify(v)).not.toContain('"path"');
    }
    // b sees the same redacted patch — wait for the state_patch b received
    const bPatch = await b.waitFor("state_patch", p => p.revision === a.knownRev);
    expect(bPatch).toBeDefined();
    expect(JSON.stringify(bPatch!.payload)).toBe('{"type":"lock"}');
    expect(JSON.stringify(bPatch!.events)).not.toContain('"path"');

    // a late joiner gets a redacted snapshot + history
    const c = await client(srv.port);
    const fs = await c.join(a.roomCode);
    const snap = JSON.parse(Buffer.from(fs.snapshot.data, "base64").toString("utf8"));
    expect(snap.lockedSeats).toEqual([1]);
    expect(JSON.stringify(fs.history)).not.toContain('"path"');
    await c.close();

    // seat 2 locks → turn resolves for everyone
    const r2 = await b.command(b.newCommandId(), b.knownRev, { type: "lock", ...plan2 });
    expect(r2.type).toBe("state_patch");
    if (r2.type === "state_patch") {
      const v = viewOf(r2);
      expect(v.resolvedTurns).toBe(1);
      expect(v.lastTimeline).not.toBeNull();
      expect(v.game.turn).toBe(2);
      expect(v.lockedSeats).toEqual([]);
      // crew actually moved
      const pip = v.game.crew.find((x: { id: string }) => x.id === "pip");
      const marlo = v.game.crew.find((x: { id: string }) => x.id === "marlo");
      expect(pip).toMatchObject({ x: 2, y: 1 });
      expect(marlo).toMatchObject({ x: 2, y: 2 });
    }
    // both clients saw the same timeline
    const aPatch = await a.waitFor("state_patch", p => p.revision === b.knownRev);
    expect(aPatch).toBeDefined();
    expect(viewOf(aPatch).lastTimeline).toEqual(viewOf(r2).lastTimeline);
  });

  it("a seat may not lock crew it does not own; unlock withdraws", async () => {
    const srv = await boot();
    const a = await client(srv.port);
    await a.create({ gameType: "rbm" });
    const b = await client(srv.port);
    await b.join(a.roomCode);

    const bad = await a.command(a.newCommandId(), a.knownRev, { type: "lock", plans: { marlo: { path: [] } } });
    expect(bad.type).toBe("error");

    await a.command(a.newCommandId(), a.knownRev, { type: "lock", plans: { pip: { path: [] } } });
    const un = await a.command(a.newCommandId(), a.knownRev, { type: "unlock" });
    expect(un.type).toBe("state_patch");
    if (un.type === "state_patch") expect(viewOf(un).lockedSeats).toEqual([]);
    void b;
  });

  it("a solo seat owns every crew member; lock resolves immediately", async () => {
    const srv = await boot();
    const a = await client(srv.port);
    const fs = await a.create({ gameType: "rbm" });
    const snap = JSON.parse(Buffer.from(fs.snapshot.data, "base64").toString("utf8"));
    expect(snap.crewSeats).toEqual({ pip: 1, marlo: 1 });
    const both = { pip: { path: [] }, marlo: { path: [] } };
    const r = await a.command(a.newCommandId(), a.knownRev, { type: "lock", plans: both });
    expect(r.type).toBe("state_patch");
    if (r.type === "state_patch") {
      const v = viewOf(r);
      expect(v.resolvedTurns).toBe(1);
      expect(v.game.turn).toBe(2);
    }
  });

  it("ping records a cursor with an incrementing seq; restart and level reset the room", async () => {
    const srv = await boot();
    const a = await client(srv.port);
    await a.create({ gameType: "rbm" });
    const b = await client(srv.port);
    await b.join(a.roomCode);

    const p1 = await a.command(a.newCommandId(), a.knownRev, { type: "ping", x: 4, y: 2 });
    expect(viewOf(p1).pings["1"]).toMatchObject({ x: 4, y: 2, seq: 1 });
    const p2 = await a.command(a.newCommandId(), a.knownRev, { type: "ping", x: 5, y: 1 });
    expect(viewOf(p2).pings["1"]).toMatchObject({ x: 5, y: 1, seq: 2 });
    await b.waitFor("state_patch", p => p.revision === (p2 as { revision: number }).revision);
    const p3 = await b.command(b.newCommandId(), b.knownRev, { type: "ping", x: 1, y: 1 });
    expect(viewOf(p3).pings["2"]).toMatchObject({ x: 1, y: 1, seq: 1 });

    // level switch resets to L2's initial state
    const lv = await a.command(a.newCommandId(), a.knownRev, { type: "level", levelId: "L2" });
    const v = viewOf(lv);
    expect(v.levelId).toBe("L2");
    expect(v.game.turn).toBe(1);
    expect(v.game.crew.length).toBe(HEIST_LEVELS[1]!.crew.length);

    // restart resets turn and timeline
    await a.command(a.newCommandId(), a.knownRev, { type: "lock", plans: { pip: { path: [] } } });
    await b.waitFor("state_patch");
    await b.command(b.newCommandId(), b.knownRev, { type: "lock", plans: { marlo: { path: [] } } });
    const rs = await a.command(a.newCommandId(), a.knownRev, { type: "restart" });
    const rv = viewOf(rs);
    expect(rv.game.turn).toBe(1);
    expect(rv.lastTimeline).toBeNull();
    expect(rv.resolvedTurns).toBe(0);
  });
});
