// Browser client for the authoritative room server (src/server/protocol.ts).
// The server resolves turns; clients only render the public view it broadcasts.

import type { GuardIntent, HeistState, Plans, TurnTimeline } from "../../engine/heist/types";

export interface HeistView {
  levelId: string;
  game: HeistState;
  lockedSeats: number[];
  crewSeats: Record<string, number>;
  lastTimeline: TurnTimeline | null;
  pings: Record<string, { x: number; y: number; seq: number }>;
  resolvedTurns: number;
}
export type { GuardIntent };

export interface RoomMember { actorId: string; seat: number; displayName: string; connected: boolean }

export interface RoomEvents {
  onView(view: HeistView): void;
  onRoster(members: RoomMember[], mySeat: number, code: string): void;
  onError(message: string): void;
  onClose(): void;
}

export type HeistCommand =
  | { type: "lock"; plans: Plans }
  | { type: "unlock" }
  | { type: "ping"; x: number; y: number }
  | { type: "restart" }
  | { type: "level"; levelId: string };

function b64decode(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function viewFromEvents(events: unknown): HeistView | null {
  if (!Array.isArray(events)) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i] as { type?: string; view?: HeistView };
    if (e?.type === "heist.view" && e.view) return e.view;
  }
  return null;
}

export class RoomClient {
  private ws: WebSocket | null = null;
  actorId: string | null = null;
  seat = -1;
  code = "";
  private revision = -1;
  private seq = 0;
  private members = new Map<string, RoomMember>();
  private pending: { id: string; payload: HeistCommand } | null = null;
  private closedByUs = false;

  constructor(private ev: RoomEvents) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.onopen = () => { this.send({ type: "hello", protocolVersion: 1 }); resolve(); };
      ws.onerror = () => reject(new Error("Couldn't reach the room server."));
      ws.onclose = () => { if (!this.closedByUs) this.ev.onClose(); };
      ws.onmessage = (m) => this.handle(JSON.parse(m.data as string) as Record<string, unknown>);
    });
  }

  create(levelId: string, displayName: string) {
    this.send({ type: "create", gameType: "rbm", seed: levelId, displayName });
  }
  join(code: string, displayName: string) {
    this.send({ type: "join", room: code.trim().toUpperCase(), displayName });
  }

  command(payload: HeistCommand) {
    this.seq += 1;
    const id = `${this.actorId ?? "anon"}-${Date.now().toString(36)}-${this.seq}`;
    this.pending = { id, payload };
    this.send({ type: "command", commandId: id, baseRevision: this.revision, payload });
  }

  close() {
    this.closedByUs = true;
    this.send({ type: "leave" });
    this.ws?.close();
    this.ws = null;
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private roster() {
    const list = [...this.members.values()].sort((a, b) => a.seat - b.seat);
    this.ev.onRoster(list, this.seat, this.code);
  }

  private handle(m: Record<string, unknown>) {
    switch (m.type) {
      case "full_state": {
        this.actorId = m.actorId as string;
        this.seat = m.seat as number;
        this.code = (m.room as { roomCode?: string }).roomCode ?? "";
        this.revision = m.revision as number;
        this.members.clear();
        for (const mem of (m.members as RoomMember[]) ?? []) this.members.set(mem.actorId, mem);
        this.roster();
        const history = (m.history as { events: unknown[] }[]) ?? [];
        let view: HeistView | null = null;
        for (const h of history) view = viewFromEvents(h.events) ?? view;
        if (!view) {
          const snap = m.snapshot as { data: string } | undefined;
          if (snap?.data) view = JSON.parse(b64decode(snap.data)) as HeistView;
        }
        if (view) this.ev.onView(view);
        break;
      }
      case "state_patch": {
        this.revision = m.revision as number;
        if (this.pending && m.commandId === this.pending.id) this.pending = null;
        const view = viewFromEvents(m.events);
        if (view) this.ev.onView(view);
        break;
      }
      case "join": {
        const a = m.actorId as string;
        this.members.set(a, { actorId: a, seat: m.seat as number, displayName: (m.displayName as string) ?? "", connected: true });
        this.roster();
        break;
      }
      case "leave": {
        const a = m.actorId as string;
        const mem = this.members.get(a);
        if (mem) {
          if (m.reason === "disconnect" || m.reconnectDeadline) this.members.set(a, { ...mem, connected: false });
          else this.members.delete(a);
        }
        this.roster();
        break;
      }
      case "error": {
        const code = String(m.code);
        if (/stale/i.test(code) && this.pending) {
          const p = this.pending.payload;
          setTimeout(() => this.command(p), 150);
          return;
        }
        this.pending = null;
        this.ev.onError(friendlyError(code, String(m.message ?? "")));
        break;
      }
      default:
        break;
    }
  }
}

function friendlyError(code: string, message: string): string {
  if (/not_found|no such room|unknown room/i.test(code + message)) return "No room with that code. Check the letters and try again.";
  if (/full/i.test(code + message)) return "That room is full.";
  if (/validation/i.test(code)) return message && !/[_.{}]/.test(message) ? message : "That plan isn't allowed.";
  return "Something went wrong with the room connection.";
}
