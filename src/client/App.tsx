import { useCallback, useEffect, useRef, useState } from "react";
import { HEIST_LEVELS } from "../content/heist/levels";
import { GameScreen } from "./game/GameScreen";
import { RoomClient, type HeistView, type RoomMember } from "./net/roomClient";

type Screen = { kind: "title" } | { kind: "levels" } | { kind: "play"; index: number } | { kind: "coop" } | { kind: "room" };

const PROGRESS_KEY = "rbm.heist.progress.v1";
function loadProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, number>; } catch { return {}; }
}

export default function App() {
  const params = new URLSearchParams(location.search);
  const [screen, setScreen] = useState<Screen>(params.get("room") ? { kind: "coop" } : { kind: "title" });
  const [progress, setProgress] = useState(loadProgress);

  const won = useCallback((id: string, turn: number) => {
    setProgress((p) => {
      const n = { ...p, [id]: Math.min(p[id] ?? Infinity, turn) };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(n));
      return n;
    });
  }, []);

  // ---- co-op
  const clientRef = useRef<RoomClient | null>(null);
  const [view, setView] = useState<HeistView | null>(null);
  const [roster, setRoster] = useState<{ members: RoomMember[]; seat: number; code: string } | null>(null);
  const [roomError, setRoomError] = useState("");
  const [busy, setBusy] = useState(false);

  const leaveRoom = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
    setView(null); setRoster(null);
    history.replaceState(null, "", location.pathname);
  }, []);
  useEffect(() => () => clientRef.current?.close(), []);

  const openRoom = async (how: { create: string } | { join: string }, name: string) => {
    setBusy(true); setRoomError("");
    try {
      clientRef.current?.close();
      const c = new RoomClient({
        onView: (v) => setView(v),
        onRoster: (members, seat, code) => { setRoster({ members, seat, code }); history.replaceState(null, "", `?room=${code}`); },
        onError: (msg) => { setRoomError(msg); setBusy(false); },
        onClose: () => { setRoomError("Lost the connection to the room."); setScreen({ kind: "coop" }); setView(null); },
      });
      clientRef.current = c;
      await c.connect();
      if ("create" in how) c.create(how.create, name); else c.join(how.join, name);
    } catch (e) {
      setRoomError(e instanceof Error ? e.message : "Couldn't reach the room server.");
      setBusy(false);
    }
  };
  useEffect(() => { if (view && roster && screen.kind === "coop") { setBusy(false); setScreen({ kind: "room" }); } }, [view, roster, screen.kind]);

  if (screen.kind === "play") {
    const level = HEIST_LEVELS[screen.index]!;
    const next = screen.index + 1 < HEIST_LEVELS.length ? () => setScreen({ kind: "play", index: screen.index + 1 }) : undefined;
    return <GameScreen key={level.id} level={level} levelIndex={screen.index} onExit={() => setScreen({ kind: "levels" })} {...(next ? { onNext: next } : {})} onWon={won} />;
  }
  if (screen.kind === "room" && view && roster && clientRef.current) {
    const idx = Math.max(0, HEIST_LEVELS.findIndex((l) => l.id === view.levelId));
    const level = HEIST_LEVELS[idx]!;
    const c = clientRef.current;
    const nextId = HEIST_LEVELS[idx + 1]?.id;
    return (
      <GameScreen key={`${level.id}`} level={level} levelIndex={idx}
        room={{ client: c, view, seat: roster.seat, members: roster.members, code: roster.code }}
        onExit={() => { leaveRoom(); setScreen({ kind: "title" }); }}
        {...(nextId ? { onNext: () => c.command({ type: "level", levelId: nextId }) } : {})} />
    );
  }

  return (
    <div className="menu-screen" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/rbm-cover-2400.png)` }}>
      <div className="menu-shade" />
      {screen.kind === "title" && (
        <main className="title-block">
          <span className="eyebrow">A toy-museum heist</span>
          <h1>Return by Midnight</h1>
          <p className="lede">Plan in secret. Move all at once. Borrow a property, but have it home before the clock strikes twelve.</p>
          <div className="stack">
            <button className="btn primary big" autoFocus onClick={() => setScreen({ kind: "levels" })}>Play solo</button>
            <button className="btn ghost big" onClick={() => setScreen({ kind: "coop" })}>Play with friends</button>
          </div>
        </main>
      )}
      {screen.kind === "levels" && (
        <main className="levels-block">
          <button className="btn ghost small back" onClick={() => setScreen({ kind: "title" })}>Back</button>
          <h2>Choose a gallery</h2>
          <div className="level-cards">
            {HEIST_LEVELS.map((l, i) => {
              const open = i === 0 || progress[HEIST_LEVELS[i - 1]!.id] != null;
              const best = progress[l.id];
              return (
                <button key={l.id} className={`level-card ${open ? "" : "shut"}`} disabled={!open} onClick={() => setScreen({ kind: "play", index: i })}>
                  <span className="num">{i + 1}</span>
                  <span className="lc-text">
                    <span className="lc-title">{l.title}</span>
                    <span className="lc-sub">{open ? (best != null ? `Cleared on turn ${best} of ${l.midnight}` : l.intro) : "Clear the previous gallery to open this one."}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      )}
      {screen.kind === "coop" && <CoopLobby busy={busy} error={roomError} initialCode={params.get("room") ?? ""} onBack={() => { leaveRoom(); setScreen({ kind: "title" }); }} onOpen={openRoom} />}
    </div>
  );
}

function CoopLobby({ busy, error, initialCode, onBack, onOpen }: { busy: boolean; error: string; initialCode: string; onBack(): void; onOpen(how: { create: string } | { join: string }, name: string): void }) {
  const [name, setName] = useState(() => localStorage.getItem("rbm.name") ?? "");
  const [code, setCode] = useState(initialCode);
  const [lvl, setLvl] = useState(HEIST_LEVELS[0]!.id);
  const nm = name.trim() || "Guest";
  const remember = () => localStorage.setItem("rbm.name", name.trim());
  return (
    <main className="levels-block coop">
      <button className="btn ghost small back" onClick={onBack}>Back</button>
      <h2>Play with friends</h2>
      <p className="lede small">Each player plans their own crew in secret. Nothing moves until everyone locks in.</p>
      <label className="field"><span>Your name</span><input value={name} maxLength={16} placeholder="Guest" onChange={(e) => setName(e.target.value)} /></label>
      <section className="coop-box">
        <h3>Start a room</h3>
        <div className="seg" role="radiogroup" aria-label="Gallery">
          {HEIST_LEVELS.map((l, i) => <button key={l.id} role="radio" aria-checked={lvl === l.id} className={lvl === l.id ? "on" : ""} onClick={() => setLvl(l.id)}>{i + 1}. {l.title}</button>)}
        </div>
        <button className="btn primary wide" disabled={busy} onClick={() => { remember(); onOpen({ create: lvl }, nm); }}>Create room</button>
      </section>
      <section className="coop-box">
        <h3>Join a room</h3>
        <div className="row">
          <input className="code-input" aria-label="Room code" value={code} maxLength={8} placeholder="CODE" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn primary" disabled={busy || code.trim().length < 4} onClick={() => { remember(); onOpen({ join: code }, nm); }}>Join</button>
        </div>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
