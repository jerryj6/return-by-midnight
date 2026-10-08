import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrewPlan, HeistState, LevelDef, Plans, Pos, TurnEvent } from "../../engine/heist/types";
import { createInitialState, reachableTiles, resolveTurn, validatePlan } from "../../engine/heist/engine";
import { Board, type Hit } from "./Board";
import { CREW_CSS, PROP_CSS, SEAT_COLOR, SEAT_CSS } from "./palette";
import { PROP_WORD, nameOf, outcomeCopy } from "./copy";
import { rbmAudio } from "../audio";
import type { HeistView, RoomClient, RoomMember } from "../net/roomClient";

export interface RoomCtx { client: RoomClient; view: HeistView; seat: number; members: RoomMember[]; code: string }

interface Props {
  level: LevelDef;
  levelIndex: number;
  room?: RoomCtx;
  onExit(): void;
  onNext?: () => void;
  onWon?: (levelId: string, turn: number) => void;
}

const cheb = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function playCue(e: TurnEvent) {
  switch (e.type) {
    case "loan.made": rbmAudio.play("loan.tag"); break;
    case "loan.returned": rbmAudio.play("loan.retract"); break;
    case "door.opened": rbmAudio.play("gate.lift"); break;
    case "door.closed": rbmAudio.play("gate.slam"); break;
    case "guard.heard": rbmAudio.play("toy.windup"); break;
    case "crew.seen": case "crew.shutIn": rbmAudio.play("guard.alert"); break;
    case "prize.taken": rbmAudio.play("plan.verify"); break;
    case "crew.blocked": rbmAudio.play("command.deny"); break;
    default: break;
  }
}

export function GameScreen({ level, levelIndex, room, onExit, onNext, onWon }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const botRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [ready, setReady] = useState(false);

  const [game, setGame] = useState<HeistState>(() => room ? room.view.game : createInitialState(level));
  const [history, setHistory] = useState<HeistState[]>([]);
  const [plans, setPlans] = useState<Plans>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [lend, setLend] = useState<{ tokenId: string; crewId: string } | null>(null);
  const [animating, setAnimating] = useState(false);
  const [pingMode, setPingMode] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [intro, setIntro] = useState(true);
  const [tip, setTip] = useState(-1);
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(rbmAudio.isMuted);
  const resolvedRef = useRef(room?.view.resolvedTurns ?? 0);
  const resolvingRef = useRef(false);
  const frozenInsets = useRef<{ top: number; bottom: number; left: number; right: number } | null>(null);

  const say = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);

  const crewSeats = room?.view.crewSeats;
  const controllable = useMemo(() => new Set(level.crew.filter((c) => !room || crewSeats?.[c.id] === room.seat).map((c) => c.id)), [level, room, crewSeats]);
  const lockedSeats = room?.view.lockedSeats ?? [];
  const iLocked = !!room && lockedSeats.includes(room.seat);
  const lockedCrew = useMemo(() => new Set(level.crew.filter((c) => room && crewSeats && lockedSeats.includes(crewSeats[c.id] ?? -1)).map((c) => c.id)), [level, room, crewSeats, lockedSeats]);
  const myPlans = useMemo(() => Object.fromEntries(Object.entries(plans).filter(([id]) => controllable.has(id))), [plans, controllable]);

  // ---- board lifecycle
  useEffect(() => {
    let b: Board | null = null;
    let dead = false;
    void Board.create(host.current!, {
      onTap: (p, h) => tapRef.current(p, h),
      onDragPath: (id, path) => dragRef.current(id, path),
      onTokenDrop: (tok, target) => dropRef.current(tok, target),
    }).then((board) => { if (dead) { board.destroy(); return; } b = board; boardRef.current = board; setReady(true); });
    return () => { dead = true; b?.destroy(); boardRef.current = null; };
  }, []);

  useEffect(() => {
    const measure = () => {
      // While the intro/outcome overlays are up the HUD changes height; freeze
      // the insets so the board doesn't relayout under the overlay.
      if ((intro || game.outcome) && frozenInsets.current) { boardRef.current?.setInsets(frozenInsets.current); return; }
      const t = topRef.current?.getBoundingClientRect().bottom ?? 60;
      const btm = botRef.current ? window.innerHeight - botRef.current.getBoundingClientRect().top : 120;
      const i = { top: Math.ceil(t), bottom: Math.ceil(btm), left: 0, right: 0 };
      frozenInsets.current = i;
      boardRef.current?.setInsets(i);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current);
    if (botRef.current) ro.observe(botRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [ready, intro, game.outcome]);

  // ---- forecast
  const forecast = useMemo(() => {
    if (animating || game.outcome) return null;
    return resolveTurn(level, game, myPlans);
  }, [level, game, myPlans, animating]);
  const seenAt = useMemo(() => {
    const o = forecast?.timeline.outcome;
    if (!forecast || !o || o.result !== "failed" || (o.reason !== "seen" && o.reason !== "shutIn") || !o.crewId) return null;
    const last = forecast.timeline.steps[forecast.timeline.steps.length - 1];
    const c = last?.crew.find((x) => x.id === o.crewId);
    return c ? { pos: { x: c.x, y: c.y }, guardId: o.guardId ?? "" } : null;
  }, [forecast]);

  const reach = useMemo(() => {
    if (!selected || animating || game.outcome || lend || iLocked) return [];
    const c = game.crew.find((x) => x.id === selected);
    if (!c) return [];
    return reachableTiles(level, game, { x: c.x, y: c.y }, 3);
  }, [selected, game, level, animating, lend, iLocked]);

  const lendTargets = useMemo(() => {
    if (!lend) return [];
    const tok = level.tokens.find((t) => t.id === lend.tokenId);
    return level.objects.filter((o) => o.id !== tok?.home).map((o) => o.id);
  }, [lend, level]);

  const pings = useMemo(() => Object.entries(room?.view.pings ?? {}).map(([seat, p]) => ({ x: p.x, y: p.y, color: SEAT_COLOR[Number(seat) % 4]!, key: `${seat}:${p.seq}` })), [room?.view.pings]);
  const ownerColor = useMemo(() => Object.fromEntries(level.crew.map((c) => [c.id, room && crewSeats ? SEAT_COLOR[(crewSeats[c.id] ?? 0) % 4]! : null])), [level, room, crewSeats]);

  useEffect(() => {
    boardRef.current?.setModel({
      level, state: game, plans: myPlans, controllable, selected,
      reach: reach.map((r) => r.pos),
      intents: forecast?.timeline.intents ?? null,
      ghostState: forecast ? { ...game, tokens: forecast.state.tokens, doorsOpen: forecast.state.doorsOpen } : null,
      seenAt, lend: lend ? { tokenId: lend.tokenId, targets: lendTargets } : null,
      pings, ownerColor, lockedCrew, pingMode,
    });
  }, [ready, level, game, myPlans, controllable, selected, reach, forecast, seenAt, lend, lendTargets, pings, ownerColor, lockedCrew, pingMode]);

  // ---- plan editing
  const setPlan = useCallback((crewId: string, next: CrewPlan) => {
    const v = validatePlan(level, game, crewId, next);
    if (!v.ok) { say(v.reason); rbmAudio.play("command.deny"); return false; }
    setPlans((p) => ({ ...p, [crewId]: next }));
    return true;
  }, [level, game, say]);
  const planOf = (id: string): CrewPlan => plans[id] ?? { path: [] };

  const startLend = (tokenId: string) => {
    const tok = level.tokens.find((t) => t.id === tokenId)!;
    const home = level.objects.find((o) => o.id === tok.home)!;
    const near = game.crew.filter((c) => controllable.has(c.id) && cheb(c, home) <= 1);
    if (!near.length) { say(`Someone has to start the turn right next to the ${home.name.toLowerCase()} to borrow its ${PROP_WORD[tok.prop]}.`); rbmAudio.play("command.deny"); return null; }
    const crew = near.find((c) => c.id === selected) ?? near.find((c) => !plans[c.id]?.loan) ?? near[0]!;
    setSelected(crew.id);
    setLend({ tokenId, crewId: crew.id });
    rbmAudio.play("ui.tick");
    return crew.id;
  };
  const finishLend = (tokenId: string, crewId: string, targetId: string) => {
    if (setPlan(crewId, { ...planOf(crewId), loan: { tokenId, targetId } })) rbmAudio.play("loan.tag");
    setLend(null);
  };

  const onTap = (p: Pos, h: Hit) => {
    if (animating || game.outcome || intro) return;
    if (pingMode && room) {
      if (p.x >= 0) room.client.command({ type: "ping", x: p.x, y: p.y });
      setPingMode(false);
      return;
    }
    if (iLocked) { say("You're locked in. Unlock to change your plan."); return; }
    if (h.kind === "token") {
      if (h.id.startsWith("plan:")) {
        const cid = h.id.slice(5);
        const { loan: _drop, ...rest } = planOf(cid);
        void _drop;
        setPlans((ps) => ({ ...ps, [cid]: rest }));
        say("Loan cancelled.");
        return;
      }
      if (lend?.tokenId === h.id) { setLend(null); return; }
      startLend(h.id);
      return;
    }
    if (lend) {
      if (h.kind === "object" && lendTargets.includes(h.id)) finishLend(lend.tokenId, lend.crewId, h.id);
      else setLend(null);
      return;
    }
    if (h.kind === "crew") {
      if (!controllable.has(h.id)) { say(`${nameOf(level, h.id)} is your partner's to plan.`); return; }
      setSelected((s) => (s === h.id ? null : h.id));
      rbmAudio.play("ui.tick");
      return;
    }
    if (h.kind === "object") {
      const o = level.objects.find((x) => x.id === h.id)!;
      const props = game.tokens.filter((t) => t.at === o.id).map((t) => level.tokens.find((x) => x.id === t.id)!.prop);
      say(props.length ? `${o.name}: ${props.join(" + ")}` : `${o.name}. Nothing to borrow here, but it can hold a loan.`);
      return;
    }
    if (selected) {
      const c = game.crew.find((x) => x.id === selected)!;
      if (c.x === p.x && c.y === p.y) { setPlan(selected, { ...planOf(selected), path: [] }); return; }
      const r = reach.find((x) => x.pos.x === p.x && x.pos.y === p.y);
      if (r) { if (setPlan(selected, { ...planOf(selected), path: r.path })) rbmAudio.play("ui.tick"); }
      else say("Too far. Each crew member moves up to 3 tiles a turn.");
    } else say("Tap a crew member first.");
  };
  const onDragPath = (crewId: string, path: Pos[]) => {
    if (animating || game.outcome || intro || iLocked) return;
    setSelected(crewId);
    setLend(null);
    setPlans((ps) => ({ ...ps, [crewId]: { ...(ps[crewId] ?? { path: [] }), path } }));
  };
  const onTokenDrop = (tokenId: string, targetId: string | null) => {
    if (animating || game.outcome || intro || iLocked) return;
    const crewId = startLend(tokenId);
    if (!crewId) return;
    const tok = level.tokens.find((t) => t.id === tokenId)!;
    if (targetId && targetId !== tok.home) finishLend(tokenId, crewId, targetId);
  };
  const tapRef = useRef(onTap); tapRef.current = onTap;
  const dragRef = useRef(onDragPath); dragRef.current = onDragPath;
  const dropRef = useRef(onTokenDrop); dropRef.current = onTokenDrop;

  // ---- turn resolution
  const reveal = useCallback(async (prev: HeistState, next: HeistState, tl: Parameters<Board["playTimeline"]>[1]) => {
    setAnimating(true);
    setLend(null);
    await boardRef.current?.playTimeline(prev, tl, next, (e) => playCue(e));
    setGame(next);
    setPlans({});
    setAnimating(false);
    resolvingRef.current = false;
    if (next.outcome?.result === "won") { rbmAudio.play("plan.verify"); onWon?.(level.id, next.outcome.turn); }
    else if (next.outcome?.reason === "midnight" || next.outcome?.reason === "loanNotHome") rbmAudio.play("midnight.strike");
  }, [level.id, onWon]);

  const lockIn = () => {
    if (animating || game.outcome || resolvingRef.current) return;
    rbmAudio.play("manifest.commit");
    if (room) {
      if (iLocked) { room.client.command({ type: "unlock" }); return; }
      room.client.command({ type: "lock", plans: myPlans });
      return;
    }
    resolvingRef.current = true;
    const res = resolveTurn(level, game, plans);
    setHistory((h) => [...h, game]);
    void reveal(game, res.state, res.timeline);
  };

  // online: animate whenever the server resolves a turn
  useEffect(() => {
    if (!room) return;
    const v = room.view;
    if (v.resolvedTurns > resolvedRef.current && v.lastTimeline) {
      resolvedRef.current = v.resolvedTurns;
      void reveal(game, v.game, v.lastTimeline);
    } else if (!animating) {
      if (v.resolvedTurns < resolvedRef.current || v.game.turn !== game.turn || JSON.stringify(v.game) !== JSON.stringify(game)) { setGame(v.game); setPlans({}); }
      resolvedRef.current = v.resolvedTurns;
    }
  }, [room?.view]);

  const rewind = () => {
    if (room || animating || !history.length) return;
    setGame(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
    setPlans({});
  };
  const restart = () => {
    setMenu(false);
    if (room) { room.client.command({ type: "restart" }); return; }
    setGame(createInitialState(level)); setHistory([]); setPlans({}); setSelected(null);
  };

  // keyboard shortcuts for laptop play
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Enter" || e.key === " ") { if (!intro) { e.preventDefault(); lockIn(); } }
      else if (e.key === "Escape") { setLend(null); setSelected(null); setPingMode(false); }
      else if (e.key === "z" && (e.metaKey || e.ctrlKey)) rewind();
      else if (/^[1-4]$/.test(e.key)) { const c = level.crew[Number(e.key) - 1]; if (c && controllable.has(c.id)) setSelected(c.id); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // ---- HUD text
  const turnsLeft = level.midnight - game.turn + 1;
  const hint = (() => {
    if (animating) return "Everyone moves at once…";
    if (game.outcome) return "";
    if (iLocked) return lockedSeats.length < new Set(Object.values(crewSeats ?? {})).size ? "Locked in. Waiting for your partner…" : "Revealing…";
    if (pingMode) return "Tap a tile to mark it for your partner.";
    if (lend) { const tok = level.tokens.find((t) => t.id === lend.tokenId)!; return `Tap where ${nameOf(level, lend.crewId)} should put the ${PROP_WORD[tok.prop]}. It comes back in ${tok.duration} turns.`; }
    if (seenAt) return "Careful: on this plan a guard sees you.";
    if (!selected) return "Tap or drag a crew member to plan their moves.";
    if (!planOf(selected).path.length) return "Tap a tile within 3 steps, or drag out a route.";
    return room ? "Lock in when you're happy. Plans reveal together." : "Plan the rest of the crew, then lock in.";
  })();
  const partnersLocked = room ? lockedSeats.filter((s) => s !== room.seat).length : 0;
  const partnerCount = room ? new Set(Object.values(crewSeats ?? {})).size - 1 : 0;
  const result = game.outcome && !animating ? outcomeCopy(level, game.outcome, game) : null;

  return (
    <div className="game">
      <div ref={host} className="board-host" />
      <header ref={topRef} className="hud-top">
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menu"><span className="burger" /></button>
        <div className="level-name">
          <span className="eyebrow">Gallery {levelIndex + 1}</span>
          <span className="title">{level.title}</span>
        </div>
        <div className="clock" aria-label={`Turn ${game.turn} of ${level.midnight}`}>
          <svg viewBox="0 0 40 40" className="dial" aria-hidden>
            <circle cx="20" cy="20" r="18" className="face" />
            {Array.from({ length: level.midnight }, (_, i) => {
              const a = (i / level.midnight) * Math.PI * 2 - Math.PI / 2;
              const done = i < game.turn - 1;
              return <circle key={i} cx={20 + Math.cos(a) * 14} cy={20 + Math.sin(a) * 14} r={2.2} className={done ? "tick done" : i === game.turn - 1 ? "tick now" : "tick"} />;
            })}
            <line x1="20" y1="20" x2={20 + Math.cos(((game.turn - 1) / level.midnight) * Math.PI * 2 - Math.PI / 2) * 10} y2={20 + Math.sin(((game.turn - 1) / level.midnight) * Math.PI * 2 - Math.PI / 2) * 10} className="hand" />
          </svg>
          <div className="clock-text">
            <span className="big">Turn {Math.min(game.turn, level.midnight)}<small>/{level.midnight}</small></span>
            <span className={turnsLeft <= 2 ? "eyebrow warn" : "eyebrow"}>{turnsLeft <= 1 ? "Last turn before midnight" : `${turnsLeft} turns to midnight`}</span>
          </div>
        </div>
        {room && (
          <div className="room-chip" title="Room code">
            <span className="eyebrow">Room</span>
            <span className="code">{room.code}</span>
          </div>
        )}
        <button className="icon-btn" onClick={() => { setTip((t) => (t + 1) % level.tips.length); }} aria-label="Tip">?</button>
      </header>

      {toast && <div key={toast.key} className="toast" role="status">{toast.text}</div>}
      {tip >= 0 && !intro && (
        <div className="tip-card" role="note">
          <span className="eyebrow">Tip {tip + 1} of {level.tips.length}</span>
          <p>{level.tips[tip]}</p>
          <div className="row">
            {tip + 1 < level.tips.length && <button className="btn ghost small" onClick={() => setTip(tip + 1)}>Another tip</button>}
            <button className="btn ghost small" onClick={() => setTip(-1)}>Got it</button>
          </div>
        </div>
      )}

      <footer ref={botRef} className="hud-bottom">
        {hint && <div className={seenAt && !animating ? "hint danger" : "hint"}>{hint}</div>}
        <div className="bar">
          <div className="crew-chips">
            {level.crew.map((c, i) => {
              const plan = plans[c.id];
              const mine = controllable.has(c.id);
              const tok = plan?.loan ? level.tokens.find((t) => t.id === plan.loan!.tokenId) : null;
              const seat = crewSeats?.[c.id];
              return (
                <button key={c.id} className={`chip ${selected === c.id ? "on" : ""} ${mine ? "" : "theirs"}`} style={{ ["--crew" as string]: CREW_CSS[c.look], ["--seat" as string]: seat != null ? SEAT_CSS[seat % 4] : "transparent" }}
                  onClick={() => { if (mine && !iLocked) setSelected(selected === c.id ? null : c.id); else if (!mine) say(`${c.name} is your partner's to plan.`); }} aria-pressed={selected === c.id}>
                  <span className="avatar" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/sprites/crew/rbm-crew-sheet-0${({ blue: 0, red: 1, teal: 2, yellow: 3 } as const)[c.look]}.png)` }} />
                  <span className="chip-text">
                    <span className="name">{c.name}{room ? "" : <kbd>{i + 1}</kbd>}</span>
                    <span className="status">
                      {!mine ? (lockedCrew.has(c.id) ? "Partner locked in" : "Partner planning") :
                        plan?.path.length ? `${plan.path.length} step${plan.path.length > 1 ? "s" : ""}` : "Staying put"}
                      {tok && <em style={{ color: PROP_CSS[tok.prop] }}> · lends {tok.prop}</em>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="actions">
            {!room && <button className="btn ghost" onClick={rewind} disabled={!history.length || animating} aria-label="Rewind">Rewind</button>}
            {room && <button className={`btn ghost ${pingMode ? "active" : ""}`} onClick={() => setPingMode((v) => !v)} disabled={animating}>Ping</button>}
            <button className={`btn primary lock ${iLocked ? "locked" : ""}`} onClick={lockIn} disabled={animating || !!game.outcome}>
              {iLocked ? "Unlock" : "Lock in"}
              {room && partnerCount > 0 && <span className="sub">{partnersLocked}/{partnerCount} partner{partnerCount > 1 ? "s" : ""} ready</span>}
            </button>
          </div>
        </div>
      </footer>

      {intro && (
        <div className="overlay">
          <div className="card intro">
            <span className="eyebrow">Gallery {levelIndex + 1}</span>
            <h2>{level.title}</h2>
            <p>{level.intro}</p>
            {levelIndex === 0 && (
              <ul className="legend">
                <li><span className="sw cone" />Warm light is what a guard sees right now.</li>
                <li><span className="sw ghost" />Rust arrows and hatching show where they'll look next turn.</li>
                <li><span className="sw path" />Drag your crew up to 3 tiles, then lock in. Everyone moves at once.</li>
              </ul>
            )}
            {room && <p className="dim small">Room {room.code} · {room.members.filter((m) => m.connected).length} in the crew. You plan the crew members with your colour ring.</p>}
            <button className="btn primary" autoFocus onClick={() => { setIntro(false); setSelected([...controllable][0] ?? null); }}>Start planning</button>
          </div>
        </div>
      )}

      {result && (
        <div className="overlay">
          <div className={`card result ${game.outcome!.result}`}>
            <span className="eyebrow">{game.outcome!.result === "won" ? "Gallery cleared" : "The heist is off"}</span>
            <h2>{result.title}</h2>
            <p>{result.body}</p>
            <div className="row center">
              {game.outcome!.result === "failed" && !room && history.length > 0 && <button className="btn primary" autoFocus onClick={rewind}>Rewind one turn</button>}
              {game.outcome!.result === "won" && onNext && <button className="btn primary" autoFocus onClick={onNext}>Next gallery</button>}
              <button className="btn ghost" onClick={restart}>{game.outcome!.result === "won" ? "Play again" : "Restart gallery"}</button>
              <button className="btn ghost" onClick={onExit}>Galleries</button>
            </div>
          </div>
        </div>
      )}

      {menu && (
        <div className="overlay" onClick={() => setMenu(false)}>
          <div className="card menu" onClick={(e) => e.stopPropagation()}>
            <h2>Paused</h2>
            <button className="btn ghost wide" onClick={() => setMenu(false)}>Resume</button>
            <button className="btn ghost wide" onClick={() => { setMenu(false); setIntro(true); }}>Show briefing</button>
            <button className="btn ghost wide" onClick={restart}>Restart gallery</button>
            <button className="btn ghost wide" onClick={() => { const m = !muted; rbmAudio.setMuted(m); setMuted(m); }}>{muted ? "Sound on" : "Sound off"}</button>
            <button className="btn ghost wide" onClick={onExit}>{room ? "Leave room" : "Galleries"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
