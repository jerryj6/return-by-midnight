// Full-window PixiJS scene for the heist board. Draws only; game decisions live in GameScreen.
import { Application, Assets, BlurFilter, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import type { Dir, GuardIntent, HeistState, LevelDef, Plans, Pos, Prop, TurnEvent, TurnTimeline } from "../../engine/heist/types";
import { isStaticPassable, litTiles, objectProps, plateIsPressed, tileAt, visibleTiles } from "../../engine/heist/engine";
import { C, CREW_COLOR, PROP_COLOR } from "./palette";
import { drawBirdBadge, drawLock, drawMusicBox, drawNightingale, drawSideGate, drawToy } from "./procedural";

const TEX = {
  blue: "crew/rbm-crew-sheet-00", red: "crew/rbm-crew-sheet-01", teal: "crew/rbm-crew-sheet-02", yellow: "crew/rbm-crew-sheet-03",
  guard: "crew/rbm-crew-sheet-04", guardAlert: "crew/rbm-crew-sheet-05",
  safeHeavy: "props/rbm-prop-states-00", safe: "props/rbm-prop-states-01",
  crate: "props/rbm-prop-states-02", crateHeavy: "props/rbm-prop-states-03",
  plateUp: "props/rbm-prop-states-04", plateDown: "props/rbm-prop-states-07",
  gateShut: "props/rbm-prop-states-05", gateOpen: "props/rbm-prop-states-06",
  lantern: "env/rbm-env-kit-33", plinth: "env/rbm-env-kit-03",
} as const;
type TexKey = keyof typeof TEX;

export type Hit = { kind: "crew"; id: string } | { kind: "token"; id: string } | { kind: "object"; id: string } | { kind: "tile" };

export interface BoardHandlers {
  onTap(pos: Pos, hit: Hit): void;
  onDragPath(crewId: string, path: Pos[]): void;
  onTokenDrop(tokenId: string, targetId: string | null): void;
}

export interface BoardModel {
  level: LevelDef;
  state: HeistState;
  plans: Plans;
  controllable: ReadonlySet<string>;
  selected: string | null;
  reach: Pos[];
  intents: GuardIntent[] | null;
  /** Board after this turn's returns and planned loans — used for the ghost cones. */
  ghostState: HeistState | null;
  seenAt: { pos: Pos; guardId: string } | null;
  lend: { tokenId: string; targets: string[] } | null;
  pings: { x: number; y: number; color: number; key: string }[];
  ownerColor: Record<string, number | null>;
  lockedCrew: ReadonlySet<string>;
  pingMode: boolean;
}

interface Insets { top: number; bottom: number; left: number; right: number }
interface Pose { x: number; y: number; facing: Dir }
interface Flight { prop: Prop; from: string; to: string; t0: number; dur: number }

const DIRV: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const key = (p: Pos) => `${p.x},${p.y}`;
const PROP_LABEL: Record<Prop, string> = { HEAVY: "HEAVY", BRIGHT: "BRIGHT", NOISY: "NOISY" };

class TextPool {
  private items: Text[] = [];
  private used = 0;
  private keys = new WeakMap<Text, string>();
  constructor(private parent: Container) {}
  begin() { this.used = 0; }
  get(text: string, size: number, color: number, opts: { bold?: boolean; serif?: boolean; stroke?: boolean } = {}): Text {
    let t = this.items[this.used];
    if (!t) {
      t = new Text({ text: "", style: { fontFamily: "system-ui, sans-serif", fontSize: 12, fill: 0xffffff } });
      t.anchor.set(0.5);
      t.resolution = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
      this.parent.addChild(t);
      this.items.push(t);
    }
    this.used++;
    t.visible = true;
    t.alpha = 1;
    if (t.text !== text) t.text = text;
    const k = `${Math.round(size)}|${color}|${opts.bold ? 1 : 0}|${opts.serif ? 1 : 0}|${opts.stroke ? 1 : 0}`;
    if (this.keys.get(t) !== k) {
      this.keys.set(t, k);
      const st = t.style;
      st.fontSize = Math.round(size);
      st.fill = color;
      st.fontWeight = opts.bold ? "700" : "500";
      st.fontFamily = opts.serif ? '"Iowan Old Style", Palatino, Georgia, serif' : 'system-ui, "Segoe UI", Roboto, sans-serif';
      st.stroke = opts.stroke ? { color: 0x141a26, width: Math.max(2, size * 0.22) } : { color: 0, width: 0 };
    }
    return t;
  }
  end() { for (let i = this.used; i < this.items.length; i++) this.items[i]!.visible = false; }
}

export class Board {
  private app!: Application;
  private tex = {} as Record<TexKey, Texture>;
  private handlers: BoardHandlers;
  private model: BoardModel | null = null;
  private insets: Insets = { top: 60, bottom: 120, left: 0, right: 0 };

  private bg = new Graphics();
  private floor = new Container();
  private floorG = new Graphics();
  private light = new Graphics();
  private lightLayer = new Container();
  private under = new Graphics();
  private world = new Container();
  private over = new Graphics();
  private top = new Container();
  private topG = new Graphics();
  private texts!: TextPool;

  private T = 48;
  private ox = 0;
  private oy = 0;
  private builtFor = "";

  private wallG = new Map<number, Graphics>();
  private plates = new Map<string, Sprite>();
  private doors = new Map<string, { sprite: Sprite | null; g: Graphics | null; side: boolean; x: number; y: number }>();
  private objects = new Map<string, { node: Container; g: Graphics | null; sprite: Sprite | null; height: number }>();
  private crew = new Map<string, { sprite: Sprite; look: keyof typeof CREW_COLOR }>();
  private guards = new Map<string, Sprite>();
  private prizeG = new Graphics();

  // animation
  private anim: { from: Map<string, Pose>; to: Map<string, Pose>; t0: number; dur: number } | null = null;
  private drawState: HeistState | null = null;
  private flights: Flight[] = [];
  private bubbles: { x: number; y: number; text: string; color: number; t0: number; dur: number }[] = [];
  private pingStart = new Map<string, number>();
  private alertGuards = new Set<string>();
  private shake = 0;

  // input
  private tagHits: { tokenId: string; x: number; y: number; w: number; h: number }[] = [];
  private drag: { crewId: string | null; tokenId: string | null; start: Pos; path: Pos[]; moved: boolean; sx: number; sy: number; px: number; py: number } | null = null;

  private constructor(handlers: BoardHandlers) { this.handlers = handlers; }

  static async create(host: HTMLElement, handlers: BoardHandlers): Promise<Board> {
    const b = new Board(handlers);
    await b.init(host);
    return b;
  }

  private async init(host: HTMLElement) {
    this.app = new Application();
    await this.app.init({ resizeTo: host, background: C.ink, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Heist board");
    this.app.canvas.style.touchAction = "none";
    const base = import.meta.env.BASE_URL;
    const entries = Object.entries(TEX) as [TexKey, string][];
    const loaded = await Promise.all(entries.map(([, p]) => Assets.load<Texture>(`${base}assets/sprites/${p}.png`)));
    entries.forEach(([k], i) => { this.tex[k] = loaded[i]!; });

    this.lightLayer.addChild(this.light);
    this.lightLayer.filters = [new BlurFilter({ strength: 10, quality: 2 })];
    this.lightLayer.blendMode = "add";
    this.world.sortableChildren = true;
    this.texts = new TextPool(this.top);
    this.top.addChild(this.topG);
    this.floor.addChild(this.floorG);
    this.app.stage.addChild(this.bg, this.floor, this.under, this.lightLayer, this.world, this.over, this.top);

    const cv = this.app.canvas;
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp);
    cv.addEventListener("pointercancel", () => { this.drag = null; });
    this.app.renderer.on("resize", () => { this.builtFor = ""; });
    this.app.ticker.add(() => this.frame());
    if (import.meta.env.DEV) (window as unknown as { __rbmBoard?: Board }).__rbmBoard = this;
  }

  destroy() {
    this.app.canvas.removeEventListener("pointerdown", this.onDown);
    this.app.destroy(true, { children: true });
  }

  setInsets(i: Insets) {
    if (i.top !== this.insets.top || i.bottom !== this.insets.bottom || i.left !== this.insets.left || i.right !== this.insets.right) {
      this.insets = i;
      this.builtFor = "";
    }
  }

  setModel(m: BoardModel) {
    if (this.model?.level.id !== m.level.id) {
      this.builtFor = "";
      this.anim = null;
      this.flights = [];
      this.bubbles = [];
      this.alertGuards.clear();
    }
    this.model = m;
    if (!this.anim) this.drawState = m.state;
    for (const p of m.pings) if (!this.pingStart.has(p.key)) this.pingStart.set(p.key, performance.now());
  }

  get tileSize() { return this.T; }

  /** Animate a resolved turn. Resolves when the reveal is finished. */
  async playTimeline(prev: HeistState, tl: TurnTimeline, next: HeistState, onEvent: (e: TurnEvent, k: number) => void): Promise<void> {
    if (!this.model) return;
    const level = this.model.level;
    let cur: HeistState = prev;
    const poseMap = (s: { crew: { id: string; x: number; y: number }[]; guards: Pose[] }, base: HeistState) => {
      const m = new Map<string, Pose>();
      s.crew.forEach((c) => { const old = base.crew.find((o) => o.id === c.id); m.set(c.id, { x: c.x, y: c.y, facing: faceFrom(old, c) }); });
      s.guards.forEach((g, i) => m.set(base.guards[i]!.id, { x: g.x, y: g.y, facing: g.facing }));
      return m;
    };
    let prize = prev.prizeHolder;
    for (const step of tl.steps) {
      const fromState = cur;
      const stepState: HeistState = {
        ...prev,
        tokens: next.tokens,
        doorsOpen: next.doorsOpen,
        prizeHolder: prize,
        crew: step.crew.map((c) => ({ ...c })),
        guards: prev.guards.map((g, i) => ({ ...g, ...step.guards[i]! })),
      };
      for (const e of step.events) {
        onEvent(e, step.k);
        this.reactTo(e, level);
        if (e.type === "prize.taken") { prize = e.crewId; stepState.prizeHolder = prize; }
      }
      const hasLoans = step.events.some((e) => e.type === "loan.made" || e.type === "loan.returned");
      const dur = step.k === 0 ? (hasLoans ? 650 : step.events.length ? 380 : 220) : 430;
      const from = new Map<string, Pose>();
      fromState.crew.forEach((c) => from.set(c.id, { x: c.x, y: c.y, facing: this.facingOf(c.id) }));
      fromState.guards.forEach((g) => from.set(g.id, { x: g.x, y: g.y, facing: g.facing }));
      const to = poseMap({ crew: step.crew, guards: step.guards }, fromState);
      // cones/doors switch at the start of the step for step 0, at the end for movement steps
      if (step.k === 0) this.drawState = stepState;
      this.anim = { from, to, t0: performance.now(), dur };
      await wait(dur);
      this.anim = null;
      this.drawState = stepState;
      for (const [id, p] of to) this.lastFacing.set(id, p.facing);
      cur = stepState;
      if (step.events.some((e) => e.type === "crew.seen" || e.type === "crew.shutIn")) await wait(500);
    }
    this.drawState = next;
    this.alertGuards.clear();
    for (const g of next.guards) if (g.mode === "investigate") this.alertGuards.add(g.id);
    if (tl.outcome?.result === "failed" && tl.outcome.reason !== "seen" && tl.outcome.reason !== "shutIn") await wait(300);
  }

  private lastFacing = new Map<string, Dir>();
  private facingOf(id: string): Dir { return this.lastFacing.get(id) ?? "E"; }

  private reactTo(e: TurnEvent, level: LevelDef) {
    const now = performance.now();
    if (e.type === "loan.made" || e.type === "loan.returned") {
      const tok = level.tokens.find((t) => t.id === e.tokenId);
      if (tok) this.flights.push({ prop: tok.prop, from: e.from, to: e.to, t0: now, dur: 600 });
    } else if (e.type === "guard.heard") {
      this.alertGuards.add(e.guardId);
      const g = this.drawState?.guards.find((x) => x.id === e.guardId);
      if (g) this.bubbles.push({ x: g.x, y: g.y, text: "?", color: C.gold, t0: now, dur: 1400 });
    } else if (e.type === "crew.seen") {
      const c = this.drawState?.crew.find((x) => x.id === e.crewId);
      const g = this.drawState?.guards.find((x) => x.id === e.guardId);
      if (g) this.bubbles.push({ x: g.x, y: g.y, text: "!", color: C.danger, t0: now, dur: 4000 });
      this.alertGuards.add(e.guardId);
      if (c) this.shake = now;
    } else if (e.type === "crew.blocked") {
      this.bubbles.push({ x: e.at.x, y: e.at.y, text: "bump", color: C.cream, t0: now, dur: 900 });
    }
  }

  // ---------------------------------------------------------------- layout & static

  private layout(level: LevelDef) {
    const W = this.app.screen.width, H = this.app.screen.height;
    const rows = level.tiles.length, cols = level.tiles[0]!.length;
    const pad = 10;
    const availW = W - this.insets.left - this.insets.right - pad * 2;
    const availH = H - this.insets.top - this.insets.bottom - pad * 2;
    const T = Math.floor(Math.min(availW / cols, availH / (rows + 0.6), 96));
    this.T = Math.max(16, T);
    this.ox = Math.round(this.insets.left + pad + (availW - cols * this.T) / 2);
    this.oy = Math.round(this.insets.top + pad + 0.6 * this.T + (availH - (rows + 0.6) * this.T) / 2);
    const lb = this.lightLayer.filters as BlurFilter[];
    lb[0]!.strength = Math.max(4, this.T * 0.16);
  }

  private ch(level: LevelDef, x: number, y: number): string {
    return level.tiles[y]?.[x] ?? " ";
  }

  private build(level: LevelDef) {
    this.layout(level);
    const { T, ox, oy } = this;
    const W = this.app.screen.width, H = this.app.screen.height;
    const rows = level.tiles.length, cols = level.tiles[0]!.length;

    // backdrop: velvet recess with a warm spill behind the board
    this.bg.clear();
    this.bg.rect(0, 0, W, H).fill(C.ink);
    const cx = ox + (cols * T) / 2, cy = oy + (rows * T) / 2;
    for (let i = 8; i >= 1; i--) this.bg.ellipse(cx, cy, (cols * T) * (0.5 + i * 0.09), (rows * T) * (0.5 + i * 0.1)).fill({ color: 0x2a2440, alpha: 0.05 });

    const g = this.floorG;
    g.clear();
    for (const s of this.plates.values()) s.destroy();
    this.plates.clear();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const c = this.ch(level, x, y);
      if (c === " " || c === "#") continue;
      const px = ox + x * T, py = oy + y * T;
      const r = hash(x, y);
      if (c === ":") {
        g.rect(px, py, T, T).fill((x + y) % 2 ? 0x1c1f27 : 0x1f222b);
        g.rect(px + 1, py + 1, T - 2, T - 2).stroke({ width: 1, color: 0x2a2e3a, alpha: 0.8 });
      } else if (c === "E") {
        g.rect(px, py, T, T).fill(0x2c5a55);
        g.rect(px + T * 0.08, py + T * 0.08, T * 0.84, T * 0.84).stroke({ width: Math.max(1.5, T * 0.04), color: C.gold, alpha: 0.9 });
        g.rect(px + T * 0.16, py + T * 0.16, T * 0.68, T * 0.68).fill({ color: 0x1f4642 });
      } else {
        // warm limestone, worn in the middle of the galleries
        const base = (x + y) % 2 ? 0x51493a : 0x564e3e;
        g.rect(px, py, T, T).fill(base);
        g.rect(px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88).fill({ color: 0xffffff, alpha: 0.02 + r * 0.025 });
        if (r > 0.7) g.moveTo(px + T * r * 0.6, py + T * 0.3).lineTo(px + T * (r * 0.6 + 0.2), py + T * 0.42).stroke({ width: 1, color: 0x3a342a, alpha: 0.7 });
        g.rect(px, py, T, T).stroke({ width: 1, color: 0x322d24, alpha: 0.9 });
      }
      if (c === "P") {
        const s = new Sprite(this.tex.plateUp);
        s.anchor.set(0.5, 0.5);
        s.width = T * 0.92; s.height = T * 0.92 * (198 / 339);
        s.position.set(px + T / 2, py + T * 0.55);
        this.floor.addChild(s);
        this.plates.set(key({ x, y }), s);
      }
      // contact shadow cast by a wall to the north
      if (this.ch(level, x, y - 1) === "#") g.rect(px, py, T, T * 0.22).fill({ color: 0x000000, alpha: 0.28 });
      if (this.ch(level, x - 1, y) === "#") g.rect(px, py, T * 0.1, T).fill({ color: 0x000000, alpha: 0.18 });
    }
    // plate → door links: a faint dashed brass line so the wiring reads without text
    for (const d of level.doors) for (const p of d.plates) {
      const ax = ox + p.x * T + T / 2, ay = oy + p.y * T + T * 0.62;
      const bx = ox + d.x * T + T / 2, by = oy + d.y * T + T * 0.5;
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      const dash = T * 0.18, gap = T * 0.12;
      for (let s = dash; s < len - gap; s += dash + gap) {
        const e2 = Math.min(s + dash, len - gap);
        g.moveTo(ax + ux * s, ay + uy * s).lineTo(ax + ux * e2, ay + uy * e2).stroke({ width: Math.max(1.5, T * 0.035), color: C.gold, alpha: 0.35 });
      }
    }
    if (T >= 34) {
      // exits get a small brass plaque
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (this.ch(level, x, y) === "E") {
        const px = ox + x * T, py = oy + y * T;
        g.moveTo(px + T * 0.36, py + T * 0.34).lineTo(px + T * 0.56, py + T * 0.5).lineTo(px + T * 0.36, py + T * 0.66).stroke({ width: Math.max(2, T * 0.06), color: C.gold, cap: "round", join: "round" });
        g.moveTo(px + T * 0.5, py + T * 0.34).lineTo(px + T * 0.7, py + T * 0.5).lineTo(px + T * 0.5, py + T * 0.66).stroke({ width: Math.max(2, T * 0.06), color: C.gold, alpha: 0.6, cap: "round", join: "round" });
      }
    }

    // walls: raised blocks, y-sorted with everything standing on the floor
    for (const w of this.wallG.values()) w.destroy();
    this.wallG.clear();
    const rise = T * 0.42;
    for (let y = 0; y < rows; y++) {
      const wg = new Graphics();
      let any = false;
      for (let x = 0; x < cols; x++) {
        if (this.ch(level, x, y) !== "#") continue;
        any = true;
        const px = ox + x * T, py = oy + y * T;
        const below = this.ch(level, x, y + 1);
        const capH = below === "#" ? T : T - rise;
        wg.rect(px, py, T, capH).fill(0x2f4f4c);
        // stone coursing on the cap
        wg.rect(px + 2, py + 2, T - 4, capH - 4).stroke({ width: 1, color: 0x406b66, alpha: 0.7 });
        const edge = (dx: number, dy: number) => { const n = this.ch(level, x + dx, y + dy); return n !== "#"; };
        const trim = Math.max(2, T * 0.06);
        if (edge(0, -1)) wg.rect(px, py, T, trim).fill(0xd8c9a6);
        if (edge(-1, 0)) wg.rect(px, py, trim, capH).fill(0xc9b991);
        if (edge(1, 0)) wg.rect(px + T - trim, py, trim, capH).fill(0xa8996f);
        if (below !== "#") {
          wg.rect(px, py + T - rise, T, rise).fill(0x1d3432);
          wg.rect(px, py + T - rise, T, Math.max(1.5, T * 0.04)).fill({ color: C.gold, alpha: 0.75 });
          wg.rect(px, py + T - rise * 0.35, T, rise * 0.35).fill({ color: 0x14100c, alpha: 0.45 });
          if (below !== " ") wg.rect(px, py + T, T, T * 0.06).fill({ color: 0x000000, alpha: 0.35 });
        }
      }
      if (!any) { wg.destroy(); continue; }
      wg.zIndex = y * 10 + 5;
      this.world.addChild(wg);
      this.wallG.set(y, wg);
    }

    // doors
    for (const d of this.doors.values()) { d.sprite?.destroy(); d.g?.destroy(); }
    this.doors.clear();
    for (const d of level.doors) {
      const side = this.ch(level, d.x, d.y - 1) === "#" && this.ch(level, d.x, d.y + 1) === "#";
      if (side) {
        const gg = new Graphics();
        gg.zIndex = d.y * 10 + 6;
        this.world.addChild(gg);
        this.doors.set(d.id, { sprite: null, g: gg, side, x: d.x, y: d.y });
      } else {
        const s = new Sprite(this.tex.gateShut);
        s.anchor.set(0.5, 1);
        s.zIndex = d.y * 10 + 6;
        this.world.addChild(s);
        this.doors.set(d.id, { sprite: s, g: null, side, x: d.x, y: d.y });
      }
    }

    // objects
    for (const o of this.objects.values()) o.node.destroy({ children: true });
    this.objects.clear();
    for (const o of level.objects) {
      const node = new Container();
      node.zIndex = o.y * 10 + 6;
      let sprite: Sprite | null = null, gg: Graphics | null = null;
      const sh = new Graphics();
      sh.ellipse(0, -T * 0.06, T * 0.42, T * 0.1).fill({ color: 0x000000, alpha: 0.4 });
      node.addChild(sh);
      if (o.kind === "toy" || o.kind === "musicBox") { gg = new Graphics(); node.addChild(gg); }
      else {
        const k: TexKey = o.kind === "crate" ? "crate" : o.kind === "safe" ? "safe" : o.kind === "lamp" ? "lantern" : "plinth";
        sprite = new Sprite(this.tex[k]);
        sprite.anchor.set(0.5, 1);
        node.addChild(sprite);
      }
      node.position.set(ox + o.x * T + T / 2, oy + o.y * T + T * 0.9);
      this.world.addChild(node);
      this.objects.set(o.id, { node, g: gg, sprite, height: T * 0.9 });
    }

    // characters
    for (const c of this.crew.values()) c.sprite.destroy();
    this.crew.clear();
    for (const c of level.crew) {
      const s = new Sprite(this.tex[c.look]);
      s.anchor.set(0.5, 0.97);
      this.world.addChild(s);
      this.crew.set(c.id, { sprite: s, look: c.look });
      if (!this.lastFacing.has(c.id)) this.lastFacing.set(c.id, "E");
    }
    for (const s of this.guards.values()) s.destroy();
    this.guards.clear();
    for (const gd of level.guards) {
      const s = new Sprite(this.tex.guard);
      s.anchor.set(0.5, 0.97);
      this.world.addChild(s);
      this.guards.set(gd.id, s);
    }
    this.prizeG.zIndex = 0;
    this.world.addChild(this.prizeG);
    this.builtFor = `${level.id}:${W}x${H}:${this.insets.top}:${this.insets.bottom}`;
  }

  // ---------------------------------------------------------------- per-frame

  private center(p: { x: number; y: number }) { return { x: this.ox + p.x * this.T + this.T / 2, y: this.oy + p.y * this.T + this.T / 2 }; }

  private pose(id: string, fallback: Pose, now: number): Pose & { fx: number; fy: number } {
    const a = this.anim;
    if (a) {
      const f = a.from.get(id), t = a.to.get(id);
      if (f && t) {
        const k = ease(Math.min(1, (now - a.t0) / a.dur));
        return { x: t.x, y: t.y, facing: t.facing, fx: f.x + (t.x - f.x) * k, fy: f.y + (t.y - f.y) * k };
      }
    }
    return { ...fallback, fx: fallback.x, fy: fallback.y };
  }

  private frame() {
    const m = this.model;
    if (!m) return;
    const level = m.level;
    const want = `${level.id}:${this.app.screen.width}x${this.app.screen.height}:${this.insets.top}:${this.insets.bottom}`;
    if (this.builtFor !== want) this.build(level);
    const st = this.drawState ?? m.state;
    const now = performance.now();
    const t = now / 1000;
    const { T, ox, oy } = this;
    const animating = this.anim !== null;

    // camera shake on being seen
    const sh = now - this.shake < 380 ? (1 - (now - this.shake) / 380) * T * 0.08 : 0;
    this.app.stage.position.set(sh ? Math.sin(now * 0.09) * sh : 0, sh ? Math.cos(now * 0.13) * sh * 0.6 : 0);

    // plates and doors
    for (const [k, s] of this.plates) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      const pressed = level.objects.some((o) => o.x === x && o.y === y && objectProps(st, o.id).includes("HEAVY"));
      s.texture = pressed ? this.tex.plateDown : this.tex.plateUp;
      s.height = s.width * (pressed ? 181 / 337 : 198 / 339);
    }
    for (const [id, d] of this.doors) {
      const open = st.doorsOpen[id] ?? false;
      if (d.sprite) {
        d.sprite.texture = open ? this.tex.gateOpen : this.tex.gateShut;
        d.sprite.width = T * 1.18;
        d.sprite.height = T * 1.18 * (open ? 368 / 428 : 371 / 421);
        d.sprite.position.set(ox + d.x * T + T / 2, oy + d.y * T + T * 0.98);
      } else if (d.g) { d.g.clear(); drawSideGate(d.g, ox + d.x * T, oy + d.y * T, T, open); }
    }

    // objects: state-dependent silhouettes
    for (const o of level.objects) {
      const e = this.objects.get(o.id)!;
      const props = objectProps(st, o.id);
      if (e.sprite) {
        if (o.kind === "crate") { e.sprite.texture = props.includes("HEAVY") ? this.tex.crateHeavy : this.tex.crate; fit(e.sprite, T * 0.86); }
        else if (o.kind === "safe") { e.sprite.texture = props.includes("HEAVY") ? this.tex.safeHeavy : this.tex.safe; fit(e.sprite, T * 0.86); }
        else if (o.kind === "lamp") { fitH(e.sprite, T * 0.95); e.sprite.tint = props.includes("BRIGHT") ? 0xffffff : 0x8a8a96; }
        else fit(e.sprite, T * 0.8);
        e.height = e.sprite.height;
        if (props.includes("HEAVY") && o.kind !== "crate" && o.kind !== "safe") e.sprite.scale.y *= 0.92;
      } else if (e.g) {
        e.g.clear();
        e.height = o.kind === "toy" ? drawToy(e.g, 0, 0, T) : drawMusicBox(e.g, 0, 0, T, props.includes("NOISY"));
        if (o.kind === "toy" && props.includes("NOISY")) e.g.rotation = Math.sin(t * 18) * 0.05;
        else e.g.rotation = 0;
      }
    }

    // characters
    const crewPos = new Map<string, { fx: number; fy: number; facing: Dir }>();
    for (const c of st.crew) {
      const e = this.crew.get(c.id);
      if (!e) continue;
      const p = this.pose(c.id, { x: c.x, y: c.y, facing: this.facingOf(c.id) }, now);
      crewPos.set(c.id, p);
      const s = e.sprite;
      s.height = T * 1.22; s.scale.x = Math.abs(s.scale.y) * (p.facing === "W" ? -1 : 1);
      const bob = animating ? Math.abs(Math.sin(now / 70)) * T * 0.04 : m.selected === c.id ? Math.sin(t * 4) * T * 0.02 : 0;
      s.position.set(ox + p.fx * T + T / 2, oy + p.fy * T + T * 0.92 - bob);
      s.zIndex = Math.round(p.fy * 10) + 7 + (p.fy % 1 ? 10 : 0);
      s.alpha = 1;
    }
    const guardPos = new Map<string, { fx: number; fy: number; facing: Dir }>();
    for (const g of st.guards) {
      const s = this.guards.get(g.id);
      if (!s) continue;
      const p = this.pose(g.id, { x: g.x, y: g.y, facing: g.facing }, now);
      guardPos.set(g.id, p);
      s.texture = this.alertGuards.has(g.id) ? this.tex.guardAlert : this.tex.guard;
      s.height = T * 1.32;
      const flip = p.facing === "W" ? -1 : p.facing === "E" ? 1 : Math.sign(s.scale.x) || 1;
      s.scale.x = Math.abs(s.scale.y) * flip;
      const bob = animating ? Math.abs(Math.sin(now / 85)) * T * 0.035 : 0;
      s.position.set(ox + p.fx * T + T / 2, oy + p.fy * T + T * 0.92 - bob);
      s.zIndex = Math.round(p.fy * 10) + 7 + (p.fy % 1 ? 10 : 0);
    }

    // prize
    this.prizeG.clear();
    if (level.prize && !st.prizeHolder) {
      drawNightingale(this.prizeG, ox + level.prize.x * T + T / 2, oy + level.prize.y * T + T * 0.9, T, t);
      this.prizeG.zIndex = level.prize.y * 10 + 6;
    }

    this.drawLight(level, st, guardPos, now);
    this.drawUnder(m, st, now, crewPos);
    this.drawOver(m, st, now, crewPos, guardPos);
  }

  private drawLight(level: LevelDef, st: HeistState, guardPos: Map<string, { fx: number; fy: number; facing: Dir }>, now: number) {
    const g = this.light;
    const { T, ox, oy } = this;
    g.clear();
    for (const p of litTiles(level, st)) {
      g.rect(ox + p.x * T, oy + p.y * T, T, T).fill({ color: 0xffd58a, alpha: 0.2 });
    }
    for (const o of level.objects) if (objectProps(st, o.id).includes("BRIGHT")) {
      const c = this.center(o);
      g.circle(c.x, c.y - T * 0.3, T * 0.6).fill({ color: 0xffe7a8, alpha: 0.35 + Math.sin(now / 300) * 0.04 });
    }
    for (const gs of st.guards) {
      const tiles = visibleTiles(level, st, { x: gs.x, y: gs.y, facing: gs.facing });
      const gp = guardPos.get(gs.id);
      for (const p of tiles) {
        const d = Math.abs(p.x - gs.x) + Math.abs(p.y - gs.y);
        g.rect(ox + p.x * T, oy + p.y * T, T, T).fill({ color: C.light, alpha: Math.max(0.22, 0.58 - d * 0.05) });
      }
      if (gp) {
        const [dx, dy] = DIRV[gp.facing];
        g.circle(ox + (gp.fx + 0.5 + dx * 0.45) * T, oy + (gp.fy + 0.5 + dy * 0.45) * T, T * 0.28).fill({ color: 0xfff1c8, alpha: 0.5 });
      }
    }
  }

  private drawUnder(m: BoardModel, st: HeistState, now: number, crewPos: Map<string, { fx: number; fy: number; facing: Dir }>) {
    const g = this.under;
    const { T, ox, oy } = this;
    const level = m.level;
    g.clear();
    if (this.anim === null) {
      // ghost cones for next turn: hatched, outlined in rust
      if (m.intents && m.ghostState) {
        for (const it of m.intents) {
          const fin = it.poses[it.poses.length - 1]!;
          const gst = m.ghostState;
          const moved = { ...gst, guards: gst.guards.map((gd) => (gd.id === it.guardId ? { ...gd, x: fin.x, y: fin.y, facing: fin.facing } : gd)) };
          const set = new Set(visibleTiles(level, moved, fin).map(key));
          for (const k of set) {
            const [x, y] = k.split(",").map(Number) as [number, number];
            hatch(g, ox + x * T, oy + y * T, T, C.rust, 0.42);
          }
          for (const k of set) {
            const [x, y] = k.split(",").map(Number) as [number, number];
            const px = ox + x * T, py = oy + y * T;
            const lw = Math.max(1.5, T * 0.04);
            if (!set.has(`${x},${y - 1}`)) g.moveTo(px, py).lineTo(px + T, py).stroke({ width: lw, color: C.rust, alpha: 0.95 });
            if (!set.has(`${x},${y + 1}`)) g.moveTo(px, py + T).lineTo(px + T, py + T).stroke({ width: lw, color: C.rust, alpha: 0.95 });
            if (!set.has(`${x - 1},${y}`)) g.moveTo(px, py).lineTo(px, py + T).stroke({ width: lw, color: C.rust, alpha: 0.95 });
            if (!set.has(`${x + 1},${y}`)) g.moveTo(px + T, py).lineTo(px + T, py + T).stroke({ width: lw, color: C.rust, alpha: 0.95 });
          }
        }
      }
      // current cones: solid gold outline so the live vision reads at a glance
      for (const gs of st.guards) {
        const set = new Set(visibleTiles(level, st, { x: gs.x, y: gs.y, facing: gs.facing }).map(key));
        const lw = Math.max(1.5, T * 0.035);
        for (const k of set) {
          const [x, y] = k.split(",").map(Number) as [number, number];
          const px = ox + x * T, py = oy + y * T;
          if (!set.has(`${x},${y - 1}`)) g.moveTo(px, py).lineTo(px + T, py).stroke({ width: lw, color: C.gold, alpha: 0.7 });
          if (!set.has(`${x},${y + 1}`)) g.moveTo(px, py + T).lineTo(px + T, py + T).stroke({ width: lw, color: C.gold, alpha: 0.7 });
          if (!set.has(`${x - 1},${y}`)) g.moveTo(px, py).lineTo(px, py + T).stroke({ width: lw, color: C.gold, alpha: 0.7 });
          if (!set.has(`${x + 1},${y}`)) g.moveTo(px + T, py).lineTo(px + T, py + T).stroke({ width: lw, color: C.gold, alpha: 0.7 });
        }
      }
      // planned path lines, drawn under the crew sprites with a lane per crew
      if (!st.outcome) {
        const n = st.crew.length;
        st.crew.forEach((c, ci) => {
          const plan = m.plans[c.id];
          if (!plan || !plan.path.length) return;
          const col = CREW_COLOR[this.crew.get(c.id)!.look];
          const lane = (ci - (n - 1) / 2) * T * 0.1;
          const pts = [{ x: c.x, y: c.y }, ...plan.path].map((p) => this.center(p));
          g.moveTo(pts[0]!.x + lane, pts[0]!.y + lane);
          for (const p of pts.slice(1)) g.lineTo(p.x + lane, p.y + lane);
          g.stroke({ width: Math.max(3, T * 0.09), color: col, alpha: 0.9, cap: "round", join: "round" });
        });
      }
      // plate rims: a brass ring reads even under an object; soft glow when pressed
      for (const d of level.doors) for (const p of d.plates) {
        const px = ox + p.x * T + T / 2, py = oy + p.y * T + T * 0.62;
        const pressed = plateIsPressed(level, st, p);
        if (pressed) g.ellipse(px, py, T * 0.5, T * 0.24).fill({ color: C.gold, alpha: 0.22 + Math.sin(now / 240) * 0.08 });
        g.ellipse(px, py, T * 0.46, T * 0.2).stroke({ width: Math.max(2, T * 0.05), color: C.gold, alpha: pressed ? 0.95 : 0.55 });
      }
      // reachable tiles for the selected crew member
      for (const p of m.reach) g.roundRect(ox + p.x * T + T * 0.1, oy + p.y * T + T * 0.1, T * 0.8, T * 0.8, T * 0.12).fill({ color: C.cream, alpha: 0.1 }).stroke({ width: 1, color: C.cream, alpha: 0.28 });
      // ping-mode affordance
      if (m.pingMode) g.rect(ox, oy, level.tiles[0]!.length * T, level.tiles.length * T).stroke({ width: 3, color: C.cream, alpha: 0.5 + Math.sin(now / 200) * 0.2 });
    }
    // selection / ownership rings under feet
    for (const c of st.crew) {
      const p = crewPos.get(c.id);
      if (!p) continue;
      const cx = ox + p.fx * T + T / 2, cy = oy + p.fy * T + T * 0.86;
      const look = this.crew.get(c.id)!.look;
      const own = m.ownerColor[c.id];
      if (m.selected === c.id) g.ellipse(cx, cy, T * 0.42, T * 0.16).fill({ color: CREW_COLOR[look], alpha: 0.35 }).stroke({ width: 2.5, color: C.cream, alpha: 0.95 });
      else if (m.controllable.has(c.id)) g.ellipse(cx, cy, T * 0.38, T * 0.14).stroke({ width: 2, color: CREW_COLOR[look], alpha: 0.9 });
      else if (own != null) g.ellipse(cx, cy, T * 0.38, T * 0.14).stroke({ width: 2, color: own, alpha: 0.6 });
      g.ellipse(cx, cy, T * 0.3, T * 0.1).fill({ color: 0x000000, alpha: 0.35 });
    }
    for (const gs of st.guards) {
      const s = this.guards.get(gs.id);
      if (s) g.ellipse(s.x, s.y - T * 0.06, T * 0.3, T * 0.1).fill({ color: 0x000000, alpha: 0.35 });
    }
    // noise rings on anything NOISY right now
    for (const o of level.objects) if (objectProps(st, o.id).includes("NOISY")) {
      const c = this.center(o);
      for (let i = 0; i < 3; i++) {
        const ph = ((now / 1100) + i / 3) % 1;
        g.circle(c.x, c.y, T * (0.4 + ph * 1.6)).stroke({ width: Math.max(1.5, T * 0.05) * (1 - ph), color: PROP_COLOR.NOISY, alpha: 0.9 * (1 - ph) });
      }
    }
  }

  private drawOver(m: BoardModel, st: HeistState, now: number, crewPos: Map<string, { fx: number; fy: number; facing: Dir }>, guardPos: Map<string, { fx: number; fy: number; facing: Dir }>) {
    const g = this.over, tg = this.topG;
    const { T, ox, oy } = this;
    const level = m.level;
    g.clear(); tg.clear();
    this.texts.begin();
    this.tagHits = [];
    const idle = this.anim === null && !st.outcome;

    // guard intent arrows (Into the Breach-style telegraph)
    if (idle && m.intents) {
      for (const it of m.intents) {
        const gs = st.guards.find((x) => x.id === it.guardId)!;
        const pts: Pos[] = [{ x: gs.x, y: gs.y }];
        for (const p of it.poses) { const last = pts[pts.length - 1]!; if (p.x !== last.x || p.y !== last.y) pts.push(p); }
        const fin = it.poses[it.poses.length - 1]!;
        if (pts.length > 1) arrowPath(g, pts.map((p) => this.center(p)), T, C.rust);
        else if (fin.facing !== gs.facing) {
          const c = this.center(gs);
          const [dx, dy] = DIRV[fin.facing];
          arrowHead(g, c.x + dx * T * 0.62, c.y + dy * T * 0.62, dx, dy, T * 0.2, C.rust);
          g.arc(c.x, c.y, T * 0.55, angleOf(gs.facing), angleOf(fin.facing), turnsCcw(gs.facing, fin.facing)).stroke({ width: Math.max(2, T * 0.06), color: C.rust });
        }
        if (it.mode === "investigate") this.bubble(tg, gs.x, gs.y, "?", C.gold, 1);
      }
    }

    // door telegraph: open→closed pulses rust, closed→open pulses gold
    if (idle && m.ghostState) {
      const gst = m.ghostState;
      for (const d of level.doors) {
        const openNow = st.doorsOpen[d.id] ?? false;
        const openNext = d.id in gst.doorsOpen ? (gst.doorsOpen[d.id] ?? false) : d.plates.some((p) => plateIsPressed(level, gst, p));
        if (openNow === openNext) continue;
        const col = openNow ? C.rust : C.gold;
        const a = 0.35 + Math.abs(Math.sin(now / 220)) * 0.45;
        const px = ox + d.x * T, py = oy + d.y * T;
        g.roundRect(px + T * 0.08, py + T * 0.3, T * 0.84, T * 0.4, T * 0.12).stroke({ width: Math.max(3, T * 0.07), color: col, alpha: a });
      }
    }

    // planned step numbers on top (the path lines are drawn under the crew)
    if (idle) {
      // tiles shared by more than one planned path get their discs fanned out
      const shared = new Map<string, string[]>();
      for (const c of st.crew) for (const p of m.plans[c.id]?.path ?? []) {
        const k = key(p);
        const arr = shared.get(k) ?? [];
        arr.push(c.id);
        shared.set(k, arr);
      }
      for (const c of st.crew) {
        const plan = m.plans[c.id];
        if (!plan || !plan.path.length) continue;
        const look = this.crew.get(c.id)!.look;
        const col = CREW_COLOR[look];
        plan.path.forEach((p, i) => {
          const q = this.center(p);
          const sharers = shared.get(key(p))!;
          const dx = sharers.length > 1 ? (sharers.indexOf(c.id) - (sharers.length - 1) / 2) * T * 0.3 : 0;
          const r = Math.max(8, T * 0.2);
          tg.circle(q.x + dx, q.y, r).fill(col).stroke({ width: 2, color: C.ink });
          const tx = this.texts.get(String(i + 1), r * 1.25, C.ink, { bold: true });
          tx.position.set(q.x + dx, q.y + 0.5);
        });
        // ghost of where they'll end up
        const end = plan.path[plan.path.length - 1]!;
        const q = this.center(end);
        tg.ellipse(q.x, q.y + T * 0.36, T * 0.32, T * 0.12).stroke({ width: 2, color: col, alpha: 0.85 });
      }
    }

    // seen warning from the forecast
    if (idle && m.seenAt) {
      const q = this.center(m.seenAt.pos);
      const pulse = 0.75 + Math.sin(now / 140) * 0.25;
      tg.circle(q.x, q.y, T * 0.42).stroke({ width: Math.max(3, T * 0.08), color: C.danger, alpha: pulse });
      eye(tg, q.x, q.y, T * 0.24, C.danger);
      this.pill(tg, q.x, q.y - T * 0.72, "Seen here", C.danger, C.cream);
    }

    // property tags — placed in a stable order (real tags first, then ghost
    // tags); any rect overlapping an already placed tag slides up until free
    const tagH = Math.max(18, Math.min(30, T * 0.4));
    const stackCount = new Map<string, number>();
    const tagPos = (objId: string) => {
      const o = level.objects.find((x) => x.id === objId)!;
      const e = this.objects.get(objId)!;
      const n = stackCount.get(objId) ?? 0;
      stackCount.set(objId, n + 1);
      return { x: ox + o.x * T + T / 2, y: oy + o.y * T + T * 0.9 - e.height - tagH * 0.7 - n * (tagH + 3) };
    };
    const tagW = (prop: Prop) => tagH * 0.9 + PROP_LABEL[prop].length * (tagH * 0.5) * 0.68 + tagH * 0.3 + 8;
    const placedTags: { x: number; y: number; w: number; h: number }[] = [];
    const placeTag = (cx: number, cy: number, prop: Prop) => {
      const w = tagW(prop), h = tagH + 8;
      let y = cy;
      const hits = (yy: number) => placedTags.some((r) => cx + w / 2 > r.x && cx - w / 2 < r.x + r.w && yy + h / 2 > r.y && yy - h / 2 < r.y + r.h);
      while (hits(y)) y -= tagH + 4;
      const rect = { x: cx - w / 2, y: y - h / 2, w, h };
      placedTags.push(rect);
      return { x: cx, y, rect };
    };
    const flying = new Set(this.flights.filter((f) => now - f.t0 < f.dur).map((f) => `${f.prop}:${f.to}`));
    for (const tok of level.tokens) {
      const ts = st.tokens.find((x) => x.id === tok.id)!;
      const atHome = ts.at === tok.home;
      const p = tagPos(ts.at);
      if (flying.has(`${tok.prop}:${ts.at}`)) continue;
      const spot = placeTag(p.x, p.y, tok.prop);
      if (!atHome) {
        const h = tagPos(tok.home);
        stackCount.set(tok.home, (stackCount.get(tok.home) ?? 1) - 1);
        thread(g, h.x, h.y + tagH * 0.5, spot.x, spot.y + tagH * 0.5, PROP_COLOR[tok.prop], false);
        // empty hook at home
        g.circle(h.x, h.y + tagH * 0.6, Math.max(3, T * 0.07)).stroke({ width: 2, color: PROP_COLOR[tok.prop], alpha: 0.8 });
      }
      const sel = m.lend?.tokenId === tok.id;
      this.tag(tg, spot.x, spot.y, tagH, tok.prop, 1, sel);
      if (atHome) this.tagHits.push({ tokenId: tok.id, ...spot.rect });
      if (!atHome && ts.dueTurn != null) {
        const left = ts.dueTurn - st.turn;
        const col = left <= 0 ? C.rust : PROP_COLOR[tok.prop];
        const py = spot.y + tagH * 0.5 + 7;
        pips(tg, spot.x, py, tok.duration, Math.max(0, left), col);
        if (left <= 0) {
          const pw = (tok.duration - 1) * 10 + 16;
          tg.roundRect(spot.x - pw / 2 - 2, py - 8, pw + 4, 16, 8).stroke({ width: 2, color: C.rust, alpha: 0.5 + Math.abs(Math.sin(now / 200)) * 0.45 });
        }
      }
    }
    // planned loans: ghost tag + dotted thread
    if (idle) for (const [crewId, plan] of Object.entries(m.plans)) {
      if (!plan.loan) continue;
      const tok = level.tokens.find((x) => x.id === plan.loan!.tokenId);
      if (!tok || !st.crew.some((c) => c.id === crewId)) continue;
      const home = level.objects.find((o) => o.id === tok.home)!;
      const tgt = level.objects.find((o) => o.id === plan.loan!.targetId);
      if (!tgt) continue;
      const h = this.center(home), q = tagPos(tgt.id);
      const spot = placeTag(q.x, q.y, tok.prop);
      thread(g, h.x, h.y - T * 0.5, spot.x, spot.y + tagH * 0.5, PROP_COLOR[tok.prop], true);
      this.tag(tg, spot.x, spot.y, tagH, tok.prop, 0.6, false);
      this.tagHits.push({ tokenId: `plan:${crewId}`, ...spot.rect });
      pips(tg, spot.x, spot.y + tagH * 0.5 + 7, tok.duration, tok.duration, PROP_COLOR[tok.prop]);
    }
    // in-flight tags (loan made / returned)
    this.flights = this.flights.filter((f) => now - f.t0 < f.dur + 50);
    for (const f of this.flights) {
      const k = ease(Math.min(1, (now - f.t0) / f.dur));
      const a = this.objects.get(f.from), b = this.objects.get(f.to);
      if (!a || !b) continue;
      const ax = a.node.x, ay = a.node.y - a.height - tagH, bx = b.node.x, by = b.node.y - b.height - tagH;
      const x = ax + (bx - ax) * k, y = ay + (by - ay) * k - Math.sin(k * Math.PI) * T * 1.2;
      this.tag(tg, x, y, tagH, f.prop, 1, true);
    }
    // lend mode: highlight valid targets
    if (m.lend) {
      const tok = level.tokens.find((x) => x.id === m.lend!.tokenId);
      for (const id of m.lend.targets) {
        const o = level.objects.find((x) => x.id === id)!;
        const q = this.center(o);
        g.roundRect(q.x - T * 0.48, q.y - T * 0.48, T * 0.96, T * 0.96, T * 0.16).stroke({ width: 2.5, color: tok ? PROP_COLOR[tok.prop] : C.cream, alpha: 0.6 + Math.sin(now / 160) * 0.35 });
      }
    }
    // dragged tag follows the pointer
    if (this.drag?.tokenId && this.drag.moved) {
      const tok = level.tokens.find((x) => x.id === this.drag!.tokenId);
      if (tok) this.tag(tg, this.drag.px, this.drag.py - tagH, tagH, tok.prop, 0.9, true);
    }

    // badges over heads: prize carrier and locked-in crew
    for (const c of st.crew) {
      const p = crewPos.get(c.id);
      if (!p) continue;
      const hx = ox + p.fx * T + T / 2, hy = oy + p.fy * T + T * 0.92 - T * 1.28;
      if (st.prizeHolder === c.id) drawBirdBadge(tg, hx, hy - T * 0.08, T);
      if (m.lockedCrew.has(c.id) && idle) drawLock(tg, hx + T * 0.32, hy + T * 0.1, Math.max(8, T * 0.15), C.cream);
    }

    // bubbles from the reveal
    this.bubbles = this.bubbles.filter((b) => now - b.t0 < b.dur);
    for (const b of this.bubbles) {
      const gp = [...guardPos.entries()].find(([id]) => { const gs = st.guards.find((x) => x.id === id); return gs && gs.x === b.x && gs.y === b.y; })?.[1];
      const bx = gp ? gp.fx : b.x, by = gp ? gp.fy : b.y;
      const a = Math.min(1, (b.dur - (now - b.t0)) / 300);
      if (b.text.length === 1) this.bubble(tg, bx, by, b.text, b.color, a);
      else { const q = this.center({ x: bx, y: by }); const tx = this.texts.get(b.text, Math.max(11, T * 0.22), b.color, { bold: true, stroke: true }); tx.position.set(q.x, q.y - T * 0.9 - (1 - a) * T * 0.3); tx.alpha = a; }
    }

    // pings
    for (const p of m.pings) {
      const t0 = this.pingStart.get(p.key) ?? now;
      const age = now - t0;
      if (age > 6000) continue;
      const q = this.center(p);
      const ph = (age % 900) / 900;
      g.circle(q.x, q.y, T * (0.25 + ph * 0.6)).stroke({ width: 3, color: p.color, alpha: 1 - ph });
      tg.moveTo(q.x, q.y).lineTo(q.x - T * 0.16, q.y - T * 0.36).arc(q.x, q.y - T * 0.42, T * 0.17, Math.PI * 0.8, Math.PI * 0.2).lineTo(q.x, q.y).fill(p.color).stroke({ width: 2, color: C.ink });
      tg.circle(q.x, q.y - T * 0.42, T * 0.06).fill(C.ink);
    }
    this.texts.end();
  }

  private tag(g: Graphics, x: number, y: number, h: number, prop: Prop, alpha: number, glow: boolean) {
    const label = PROP_LABEL[prop];
    const fs = h * 0.5;
    const w = h * 0.9 + label.length * fs * 0.68 + h * 0.3;
    const x0 = x - w / 2, y0 = y - h / 2;
    if (glow) g.roundRect(x0 - 3, y0 - 3, w + 6, h + 6, h * 0.3).fill({ color: PROP_COLOR[prop], alpha: 0.35 * alpha });
    g.roundRect(x0, y0, w, h, h * 0.22).fill({ color: C.cream, alpha }).stroke({ width: 1.5, color: 0x3b3022, alpha });
    g.roundRect(x0, y0, h * 0.82, h, h * 0.22).fill({ color: PROP_COLOR[prop], alpha });
    g.circle(x0 + h * 0.18, y, h * 0.08).fill({ color: C.ink, alpha });
    propIcon(g, x0 + h * 0.48, y, h * 0.3, prop, alpha);
    const tx = this.texts.get(label, fs, 0x2a2118, { bold: true });
    tx.position.set(x0 + h * 0.82 + (w - h * 0.82) / 2, y + 0.5);
    tx.alpha = alpha;
    return { x: x0 - 4, y: y0 - 4, w: w + 8, h: h + 8 };
  }

  private bubble(g: Graphics, tx: number, ty: number, text: string, color: number, alpha: number) {
    const q = this.center({ x: tx, y: ty });
    const r = Math.max(10, this.T * 0.22);
    const by = q.y - this.T * 1.25;
    g.circle(q.x + this.T * 0.2, by, r).fill({ color: C.cream, alpha }).stroke({ width: 2.5, color, alpha });
    g.poly([q.x + this.T * 0.1, by + r * 0.7, q.x + this.T * 0.2, by + r * 1.6, q.x + this.T * 0.26, by + r * 0.8]).fill({ color: C.cream, alpha });
    const t = this.texts.get(text, r * 1.4, color === C.gold ? 0x8a5f14 : color, { bold: true, serif: true });
    t.position.set(q.x + this.T * 0.2, by + 1);
    t.alpha = alpha;
  }

  private pill(g: Graphics, x: number, y: number, text: string, bgc: number, fg: number) {
    const fs = Math.max(11, Math.min(15, this.T * 0.26));
    const w = text.length * fs * 0.58 + fs * 1.4, h = fs * 1.7;
    g.roundRect(x - w / 2, y - h / 2, w, h, h / 2).fill(bgc).stroke({ width: 1.5, color: C.ink });
    const t = this.texts.get(text, fs, fg, { bold: true });
    t.position.set(x, y + 0.5);
  }

  // ---------------------------------------------------------------- input

  private tileAtPx(px: number, py: number): Pos | null {
    const m = this.model;
    if (!m) return null;
    const x = Math.floor((px - this.ox) / this.T), y = Math.floor((py - this.oy) / this.T);
    if (y < 0 || y >= m.level.tiles.length || x < 0 || x >= m.level.tiles[0]!.length) return null;
    return { x, y };
  }

  private local(e: PointerEvent) {
    const r = this.app.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private hitAt(px: number, py: number, pos: Pos | null): Hit {
    for (const h of this.tagHits) if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return { kind: "token", id: h.tokenId };
    const st = this.model!.state;
    if (pos) {
      const c = st.crew.find((x) => x.x === pos.x && x.y === pos.y);
      if (c) return { kind: "crew", id: c.id };
      // tall sprites: a tap on the upper body counts too
      const above = st.crew.find((x) => x.x === pos.x && x.y === pos.y + 1);
      if (above) return { kind: "crew", id: above.id };
      const o = this.model!.level.objects.find((x) => x.x === pos.x && x.y === pos.y);
      if (o) return { kind: "object", id: o.id };
    }
    return { kind: "tile" };
  }

  private onDown = (e: PointerEvent) => {
    if (!this.model || this.anim) return;
    const l = this.local(e);
    const pos = this.tileAtPx(l.x, l.y);
    const hit = this.hitAt(l.x, l.y, pos);
    this.app.canvas.setPointerCapture(e.pointerId);
    const crewId = hit.kind === "crew" && this.model.controllable.has(hit.id) && !this.model.pingMode && !this.model.lockedCrew.has(hit.id) ? hit.id : null;
    const tokenId = hit.kind === "token" && !hit.id.startsWith("plan:") && !this.model.pingMode ? hit.id : null;
    const c = crewId ? this.model.state.crew.find((x) => x.id === crewId)! : null;
    this.drag = { crewId, tokenId, start: c ? { x: c.x, y: c.y } : pos ?? { x: -1, y: -1 }, path: [], moved: false, sx: l.x, sy: l.y, px: l.x, py: l.y };
    (this.drag as { hit?: Hit; pos?: Pos | null }).hit = hit;
    (this.drag as { hit?: Hit; pos?: Pos | null }).pos = pos;
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || !this.model) return;
    const l = this.local(e);
    d.px = l.x; d.py = l.y;
    if (Math.hypot(l.x - d.sx, l.y - d.sy) > Math.max(10, this.T * 0.3)) d.moved = true;
    if (!d.crewId || !d.moved) return;
    const pos = this.tileAtPx(l.x, l.y);
    if (!pos) return;
    const last = d.path[d.path.length - 1] ?? d.start;
    if (pos.x === last.x && pos.y === last.y) return;
    const prev = d.path.length >= 2 ? d.path[d.path.length - 2]! : d.start;
    if (d.path.length && pos.x === prev.x && pos.y === prev.y) { d.path.pop(); this.handlers.onDragPath(d.crewId, [...d.path]); return; }
    if (pos.x === d.start.x && pos.y === d.start.y) { d.path = []; this.handlers.onDragPath(d.crewId, []); return; }
    const adj = Math.abs(pos.x - last.x) + Math.abs(pos.y - last.y) === 1;
    const blocked = (!isStaticPassable(this.model.level, pos) && tileAt(this.model.level, pos) !== "D") || this.model.level.objects.some((o) => o.x === pos.x && o.y === pos.y);
    if (adj && !blocked && d.path.length < 3) { d.path.push(pos); this.handlers.onDragPath(d.crewId, [...d.path]); }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag as (typeof this.drag & { hit?: Hit; pos?: Pos | null }) | null;
    this.drag = null;
    if (!d || !this.model) return;
    const l = this.local(e);
    if (d.tokenId && d.moved) {
      const pos = this.tileAtPx(l.x, l.y);
      const o = pos ? this.model.level.objects.find((x) => x.x === pos.x && x.y === pos.y) : null;
      this.handlers.onTokenDrop(d.tokenId, o?.id ?? null);
      return;
    }
    if (d.crewId && d.moved) return;
    if (d.moved) return; // a pan that started off anything tappable is not a tap
    if (d.pos && d.hit) this.handlers.onTap(d.pos, d.hit);
    else if (d.hit && d.hit.kind === "token") this.handlers.onTap({ x: -1, y: -1 }, d.hit);
  };
}

// ------------------------------------------------------------------ helpers

function wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
function fit(s: Sprite, w: number) { const r = s.texture.height / s.texture.width; s.width = w; s.height = w * r; }
function fitH(s: Sprite, h: number) { const r = s.texture.width / s.texture.height; s.height = h; s.width = h * r; }
function faceFrom(old: { x: number; y: number } | undefined, now: { x: number; y: number }): Dir {
  if (!old) return "E";
  if (now.x > old.x) return "E";
  if (now.x < old.x) return "W";
  if (now.y > old.y) return "S";
  if (now.y < old.y) return "N";
  return "E";
}
function angleOf(d: Dir) { return d === "E" ? 0 : d === "S" ? Math.PI / 2 : d === "W" ? Math.PI : -Math.PI / 2; }
function turnsCcw(a: Dir, b: Dir) { const o = ["N", "E", "S", "W"]; return (o.indexOf(b) - o.indexOf(a) + 4) % 4 === 3; }

function hatch(g: Graphics, px: number, py: number, T: number, color: number, alpha: number) {
  g.rect(px, py, T, T).fill({ color, alpha: alpha * 0.28 });
  const n = 4;
  for (let i = 1; i < n * 2; i++) {
    const c = (i * T) / n;
    if (c <= T) g.moveTo(px + c, py).lineTo(px, py + c);
    else g.moveTo(px + T, py + c - T).lineTo(px + c - T, py + T);
  }
  g.stroke({ width: Math.max(1, T * 0.025), color, alpha });
}

function arrowHead(g: Graphics, x: number, y: number, dx: number, dy: number, s: number, color: number) {
  const nx = -dy, ny = dx;
  g.poly([x + dx * s, y + dy * s, x - dx * s * 0.6 + nx * s * 0.8, y - dy * s * 0.6 + ny * s * 0.8, x - dx * s * 0.6 - nx * s * 0.8, y - dy * s * 0.6 - ny * s * 0.8]).fill(color).stroke({ width: 1.5, color: C.ink });
}

function arrowPath(g: Graphics, pts: { x: number; y: number }[], T: number, color: number) {
  const w = Math.max(3, T * 0.1);
  const last = pts[pts.length - 1]!, prev = pts[pts.length - 2]!;
  const len = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
  const dx = (last.x - prev.x) / len, dy = (last.y - prev.y) / len;
  const endX = last.x - dx * T * 0.22, endY = last.y - dy * T * 0.22;
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length - 1; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  g.lineTo(endX, endY);
  g.stroke({ width: w + 3, color: C.ink, alpha: 0.7, cap: "round", join: "round" });
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length - 1; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
  g.lineTo(endX, endY);
  g.stroke({ width: w, color, cap: "round", join: "round" });
  arrowHead(g, last.x - dx * T * 0.1, last.y - dy * T * 0.1, dx, dy, T * 0.22, color);
}

function thread(g: Graphics, ax: number, ay: number, bx: number, by: number, color: number, dotted: boolean) {
  const mx = (ax + bx) / 2, my = Math.min(ay, by) - Math.abs(bx - ax) * 0.25 - 20;
  if (!dotted) {
    g.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by).stroke({ width: 2.5, color, alpha: 0.85 });
    return;
  }
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * mx + t * t * bx;
    const y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * my + t * t * by;
    g.circle(x, y, 2).fill({ color, alpha: 0.9 });
  }
}

function pips(g: Graphics, x: number, y: number, total: number, left: number, color: number) {
  const r = 3.5, gap = 10;
  const x0 = x - ((total - 1) * gap) / 2;
  g.roundRect(x0 - 8, y - 6, (total - 1) * gap + 16, 12, 6).fill({ color: C.ink, alpha: 0.85 });
  for (let i = 0; i < total; i++) {
    const on = i < left;
    g.circle(x0 + i * gap, y, r).fill(on ? color : 0x3a4152).stroke({ width: 1, color: on ? C.cream : 0x596277 });
  }
}

function eye(g: Graphics, x: number, y: number, s: number, color: number) {
  g.moveTo(x - s, y).quadraticCurveTo(x, y - s * 0.9, x + s, y).quadraticCurveTo(x, y + s * 0.9, x - s, y).fill(C.cream).stroke({ width: 2, color });
  g.circle(x, y, s * 0.36).fill(color);
}

function propIcon(g: Graphics, x: number, y: number, s: number, prop: Prop, alpha: number) {
  const ink = 0x1c1a24;
  if (prop === "HEAVY") {
    g.poly([x - s * 0.8, y + s * 0.8, x + s * 0.8, y + s * 0.8, x + s * 0.5, y - s * 0.35, x - s * 0.5, y - s * 0.35]).fill({ color: C.cream, alpha });
    g.circle(x, y - s * 0.55, s * 0.3).stroke({ width: 1.5, color: C.cream, alpha });
    g.rect(x - s * 0.3, y + s * 0.1, s * 0.6, s * 0.18).fill({ color: ink, alpha: 0.5 * alpha });
  } else if (prop === "BRIGHT") {
    g.circle(x, y, s * 0.4).fill({ color: 0xfff7d6, alpha });
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.moveTo(x + Math.cos(a) * s * 0.58, y + Math.sin(a) * s * 0.58).lineTo(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.9); }
    g.stroke({ width: 1.5, color: 0xfff7d6, alpha });
  } else {
    g.poly([x - s * 0.8, y - s * 0.3, x - s * 0.4, y - s * 0.3, x, y - s * 0.75, x, y + s * 0.75, x - s * 0.4, y + s * 0.3, x - s * 0.8, y + s * 0.3]).fill({ color: C.cream, alpha });
    g.arc(x + s * 0.1, y, s * 0.4, -0.9, 0.9).stroke({ width: 1.5, color: C.cream, alpha });
    g.arc(x + s * 0.1, y, s * 0.75, -0.9, 0.9).stroke({ width: 1.5, color: C.cream, alpha });
  }
}
