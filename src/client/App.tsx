// Return by Midnight — client shell.
//
// Same shell architecture as the reference (title → level select → board +
// plan panel + run-scrub timeline + hints + verdict), driven by the RBM
// engine's actual verbs: manifest.commit / manifest.retract / command.queue /
// command.clear / test.run / history.undo / result.accept / plan.reset.
// Planning never consumes in-world time (RBM-010); test.run replays the
// committed plan; result.accept is legal only after a successful run.

import { useMemo, useRef, useState } from "react";
import { RbmEngine } from "../engine/rbm/engine.js";
import type { RbmAction, RbmActionPayload, RbmPlayState } from "../engine/rbm/engine.js";
import { initialSimState } from "../engine/rbm/sim.js";
import type {
  LoanManifestRow,
  PropertyType,
  RbmManifest,
  RbmSimState,
} from "../engine/rbm/types.js";
import { LEVELS as LEVEL_DEFS } from "../content/levels/index.js";
import SceneView from "./SceneView";
import TimelineView from "./TimelineView";
import HintLadder from "./HintLadder";
import { RBM_HINTS } from "./hints";
import {
  cmdSlug,
  describeCommand,
  describePredicate,
  nameOf,
  slugCmd,
  tokenStatusLabel,
} from "./describe";
import { RoomClient } from "./net/roomClient.js";
import { rbmAudio } from "./audio.js";

const BLURBS: Record<string, { chapter: string; blurb: string }> = {
  "RBM-01": {
    chapter: "Chapter I — Discovery",
    blurb: "A safe too heavy to carry, a crate too light to hold the exit. Borrow weight; let the return close the door behind you.",
  },
  "RBM-02": {
    chapter: "Chapter I — Discovery",
    blurb: "Darkness hides the crossing; the same light must wake the vault. One lamp, two jobs, one due beat.",
  },
  "RBM-03": {
    chapter: "Chapter I — Discovery",
    blurb: "A toy holds a plate and holds a rattle. Borrow the noise, move the weight, let the rattle come home on cue.",
  },
  "RBM-04": {
    chapter: "Chapter II — Composition",
    blurb: "The owner rides while its weight is away. Schedule the return for where the owner will be — not where it sat.",
  },
};

const LEVELS: { level: RbmManifest; chapter: string; blurb: string }[] = LEVEL_DEFS.map(
  ({ id, def }) => ({
    level: def,
    chapter: BLURBS[id]?.chapter ?? `Contract ${id}`,
    blurb: BLURBS[id]?.blurb ?? def.title,
  }),
);

const TOKEN_LETTER: Record<PropertyType, string> = { HEAVY: "H", BRIGHT: "B", NOISY: "N" };

export default function App() {
  const [screen, setScreen] = useState<"title" | "select" | "play" | "lobby">("title");
  const [level, setLevel] = useState<RbmManifest>(LEVEL_DEFS[0].def);
  const net = useRef<RoomClient | null>(null);
  const netState = useRef<{ setGs?: (s: RbmPlayState) => void; levelId?: string }>({});
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [netErr, setNetErr] = useState<string | null>(null);
  const foldRef = useRef<(p: unknown) => void>(() => {});

  const goOnline = async (mode: "create" | "join", code?: string) => {
    try {
      const client = new RoomClient({
        onJoin: (_a, rc) => setRoomCode(rc),
        onState: (rs) => {
          const r = rs as { levelId: string; state: RbmPlayState };
          netState.current.levelId = r.levelId;
          netState.current.setGs?.(r.state);
        },
        onCommand: (p) => foldRef.current(p),
        onError: (_c, msg) => setNetErr(msg),
      });
      await client.connect();
      net.current = client;
      if (mode === "create") client.createRoom("rbm", level.levelId.toUpperCase());
      else client.joinRoom(code ?? "");
      setScreen("play");
    } catch { setNetErr("Could not reach the room server."); }
  };

  if (screen === "title") {
    return (
      <main className="title-screen">
        <div className="title-card">
          <p className="overline">A toy-museum heist</p>
          <img className="title-art" src="/assets/rbm-cover.png" alt="Toy-museum cutaway at midnight" />
          <h1>Return by Midnight</h1>
          <p className="pitch">Borrow the world's properties. Use their return to finish the job.</p>
          <button type="button" className="primary" data-testid="play-solo" onClick={() => setScreen("select")}>
            Play solo
          </button>
          <button type="button" className="ghost" data-testid="play-coop" onClick={() => setScreen("lobby")}>
            Crew up
          </button>
          {netErr && <p className="fail">{netErr}</p>}
        </div>
      </main>
    );
  }

  if (screen === "lobby") {
    let codeInput = "";
    return (
      <main className="select-screen">
        <h1>Assemble the crew</h1>
        <p>Share a room code; every order lands on every planner's board.</p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => void goOnline("create")}>
            Host a room ({level.levelId.toUpperCase()})
          </button>
          <input placeholder="Room code" onChange={(e) => (codeInput = e.target.value)} />
          <button type="button" onClick={() => void goOnline("join", codeInput)}>Join</button>
        </div>
        {netErr && <p className="fail">{netErr}</p>}
        <button type="button" className="ghost" onClick={() => setScreen("title")}>Back</button>
      </main>
    );
  }

  if (screen === "select") {
    return (
      <main className="select-screen">
        <h1>Choose tonight's room</h1>
        <div className="level-list">
          {LEVELS.map(({ level: l, chapter, blurb }) => (
            <button
              key={l.levelId}
              type="button"
              className="level-card"
              data-testid={`level-${l.levelId}`}
              onClick={() => {
                setLevel(l);
                setScreen("play");
              }}
            >
              <span className="level-id">{l.levelId.toUpperCase()}</span>
              <span className="level-title">{l.title}</span>
              <span className="level-chapter">{chapter}</span>
              <span className="level-blurb">{blurb}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ghost" onClick={() => setScreen("title")}>
          Back
        </button>
      </main>
    );
  }

  return (
    <PlayScreen
      key={`${level.levelId}-${roomCode ?? "solo"}`}
      level={level}
      onExit={() => setScreen("select")}
      net={net}
      netState={netState}
      foldRef={foldRef}
      roomCode={roomCode}
    />
  );
}

// ---------------------------------------------------------------------------

function PlayScreen({
  level,
  onExit,
  net,
  netState,
  foldRef,
  roomCode,
}: {
  level: RbmManifest;
  onExit: () => void;
  net: React.MutableRefObject<RoomClient | null>;
  netState: React.MutableRefObject<{ setGs?: (s: RbmPlayState) => void; levelId?: string }>;
  foldRef: React.MutableRefObject<(p: unknown) => void>;
  roomCode: string | null;
}) {
  const engine = useMemo(() => new RbmEngine(), []);
  const [gs, setGs] = useState<RbmPlayState>(() => engine.createInitialState(level));
  const [muted, setMuted] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const seq = useRef(0);

  const horizon = level.verification.horizonBeat;
  const lastRun = gs.lastRun;
  const timeline = lastRun?.timeline ?? null;

  // The board renders a committed snapshot: the scrubbed beat, else the run's
  // final state, else (before any test) the plan's projected initial state so
  // committed rows already show as staged loans.
  const liveSim: RbmSimState = useMemo(
    () => initialSimState(level, { rows: gs.manifestRows, commands: gs.commands }),
    [level, gs.manifestRows, gs.commands],
  );
  const displayedSim: RbmSimState =
    scrub !== null && timeline?.[scrub]
      ? timeline[scrub]!.state
      : timeline
        ? timeline[timeline.length - 1]!.state
        : liveSim;
  const viewingPast = scrub !== null && timeline !== null && scrub < timeline.length - 1;

  function act(payload: RbmActionPayload): boolean {
    if (net.current) {
      net.current.command(payload);
      return true;
    }
    const action: RbmAction = {
      actorId: "solo",
      commandId: `ui-${++seq.current}`,
      baseRevision: gs.revision,
      payload,
    };
    const check = engine.validateAction(level, gs, action);
    if (!check.ok) {
      setToast(check.reason ?? "rejected");
      return false;
    }
    const res = engine.applyAction(level, gs, action);
    const rej = res.events.find((e) => e.type === "action.rejected");
    if (rej) {
      rbmAudio.play("command.deny");
      setToast(String((rej.data as Record<string, unknown> | undefined)?.reason ?? "rejected"));
      return false;
    }
    setToast(null);
    setGs(res.state);
    for (const e of res.events) {
      if (e.type === "manifest.row.commit") rbmAudio.play("loan.tag");
      else if (e.type === "manifest.row.retract") rbmAudio.play("loan.retract");
      else if (e.type === "command.queued") rbmAudio.play("ui.tick");
      else if (e.type === "result.accepted") rbmAudio.play("midnight.strike");
    }
    if (payload.type === "test.run") {
      const tr = res.events.find((e) => e.type === "test.run");
      const ok = (tr?.data as Record<string, unknown> | undefined)?.success === true;
      rbmAudio.play(ok ? "plan.verify" : "plan.contradict");
    }
    if (payload.type === "test.run") {
      setScrub(null); // follow the run's final beat
    } else if (payload.type === "manifest.commit" || payload.type === "manifest.retract" || payload.type === "command.queue" || payload.type === "command.clear" || payload.type === "plan.reset") {
      setScrub(null); // plan changed: leave the old replay for the record, show live plan
    }
    return true;
  }

  // Co-op: server broadcasts accepted command payloads; fold them through the
  // engine locally (deterministic ⇒ identical state on every client).
  netState.current.setGs = setGs;
  foldRef.current = (p: unknown) => {
    const res = engine.applyAction(level, gs, {
      actorId: "coop",
      commandId: `net-${++seq.current}`,
      baseRevision: gs.revision,
      payload: p as RbmActionPayload,
    });
    setGs(res.state);
    setScrub(null);
  };

  return (
    <main className="play-screen">
      <header className="topbar">
        <div>
          <span className="level-id">{level.levelId.toUpperCase()}</span>
          <h1>{level.title}</h1>
          {roomCode && <span className="badge">Crew {roomCode}</span>}
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost" data-testid="undo" onClick={() => act({ type: "history.undo" })}>
            Undo
          </button>
          <button type="button" className="ghost" data-testid="reset-plan" onClick={() => act({ type: "plan.reset" })}>
            Reset plan
          </button>
          <button type="button" className="ghost" onClick={() => { const m = !muted; rbmAudio.setMuted(m); setMuted(m); }}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button type="button" className="ghost" onClick={onExit}>
            Rooms
          </button>
        </div>
      </header>

      {toast ? (
        <p className="toast" data-testid="toast" role="alert">
          The ledger refuses: {toast}
        </p>
      ) : null}
      {viewingPast ? (
        <p className="toast info" role="status">
          Viewing the replay at end of beat {scrub}. Planning edits start a fresh simulation — scrubbing never rewrites the record.
        </p>
      ) : null}
      {lastRun ? (
        <p className="toast info" role="status">
          Last run tested this plan — {lastRun.success ? "it held" : "it failed"}. Edit the manifest or orders and run again to update.
        </p>
      ) : null}

      <div className="play-layout">
        <section className="board-pane" aria-label="Scene">
          <SceneView
            level={level}
            sim={displayedSim}
            rows={gs.manifestRows}
            selectedId={selectedId}
            focusedRow={focusedRow}
            onSelect={setSelectedId}
            onFocusRow={setFocusedRow}
          />
          <TimelineView
            timeline={timeline}
            events={lastRun?.events ?? null}
            scrub={scrub}
            onScrub={setScrub}
            horizon={horizon}
          />
        </section>

        <aside className="side-pane">
          <Objectives level={level} gs={gs} />
          <ManifestPanel
            level={level}
            gs={gs}
            engine={engine}
            focusedRow={focusedRow}
            onFocusRow={setFocusedRow}
            act={act}
          />
          <CommandEditor level={level} gs={gs} engine={engine} act={act} />
          <Inspection sim={displayedSim} selectedId={selectedId} />
          <RunControls gs={gs} act={act} />
          {RBM_HINTS[level.levelId] ? <HintLadder content={RBM_HINTS[level.levelId]!} /> : null}
        </aside>
      </div>

      {gs.phase === "accepted" ? (
        <div className="verdict-overlay" data-testid="accepted-banner">
          <div className="verdict-card">
            <p className="overline">The record stands — returned</p>
            <h2>Everything home by midnight</h2>
            <p>
              The safe is out, the custodian saw nothing, and HEAVY rests where it belongs. Final hash{" "}
              <code>{gs.lastRun?.finalHash.slice(0, 12)}…</code>
            </p>
            <div className="row">
              <button type="button" className="ghost" onClick={() => act({ type: "plan.reset" })}>
                Plan another run
              </button>
              <button type="button" className="ghost" onClick={onExit}>
                Back to rooms
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

// ---------------------------------------------------------------------------

function Objectives({ level, gs }: { level: RbmManifest; gs: RbmPlayState }) {
  const evaln = gs.lastRun?.evaluation;
  return (
    <section className="objectives" aria-label="Objectives">
      <h3>The operation must end with</h3>
      <ul>
        {level.outcomes.map((o) => {
          const res = evaln?.outcomes.find((r) => r.predicateId === o.id);
          return (
            <li key={o.id} className={res ? (res.passed ? "pass" : "fail") : "pending"}>
              <span className="mark">{res ? (res.passed ? "✓" : "✗") : "○"}</span>
              <span className="pred">{describePredicate(o.id)}</span>
              {res && !res.passed && res.detail ? <span className="detail">{res.detail}</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="dim small">
        Observations · manifest completeness {evaln ? (evaln.allObservationsPass ? "✓" : "✗") : "untested"} · verification at end of beat{" "}
        {level.verification.horizonBeat}
      </p>
    </section>
  );
}

function ManifestPanel({
  level,
  gs,
  engine,
  focusedRow,
  onFocusRow,
  act,
}: {
  level: RbmManifest;
  gs: RbmPlayState;
  engine: RbmEngine;
  focusedRow: string | null;
  onFocusRow: (id: string | null) => void;
  act: (p: RbmActionPayload) => boolean;
}) {
  const defaultToken = level.tokens[0]?.id ?? "";
  const [tokenId, setTokenId] = useState(defaultToken);
  const token = level.tokens.find((t) => t.id === tokenId);
  const borrowers = token
    ? [
        ...level.props.filter((p) => p.accepts.includes(token.property)),
        ...level.crew.filter((c) => (c.accepts ?? []).includes(token.property)),
      ].filter((h) => h.id !== token.homeEntityId)
    : [];
  const [toHostId, setToHostId] = useState(borrowers[0]?.id ?? "");
  const [startBeat, setStartBeat] = useState(1);
  const [dueBeat, setDueBeat] = useState<number | null>(level.loans.legalDueBeats[0] ?? null);

  const draft: LoanManifestRow = {
    rowId: `${tokenId}->${toHostId}@${startBeat}~${dueBeat === null ? "never" : dueBeat}`,
    tokenId,
    fromHostId: token?.homeEntityId ?? "",
    toHostId,
    startBeat,
    dueBeat,
  };
  const preview: { ok: boolean; reason?: string } = token
    ? engine.validateAction(level, gs, {
        actorId: "solo",
        commandId: "preview",
        baseRevision: gs.revision,
        payload: { type: "manifest.commit", row: draft },
      })
    : { ok: false, reason: "no-token" };

  return (
    <section className="manifest" aria-label="Loan manifest">
      <h3>
        Loan manifest <span className="dim">{gs.manifestRows.length}/{level.loans.maxRows} rows</span>
      </h3>

      <ul className="rows">
        {gs.manifestRows.map((r) => {
          const tok = level.tokens.find((t) => t.id === r.tokenId);
          return (
            <li key={r.rowId} className={focusedRow === r.rowId ? "row focused" : "row"} data-testid={`row-${r.rowId}`}>
              <button type="button" className="row-link" onClick={() => onFocusRow(focusedRow === r.rowId ? null : r.rowId)}>
                <strong>{tok?.property ?? r.tokenId}</strong> {nameOf(r.fromHostId)} → {nameOf(r.toHostId)} · starts beat {r.startBeat} · due{" "}
                {r.dueBeat === null ? "never" : `end of beat ${r.dueBeat}`}
              </button>
              <button type="button" className="retract" data-testid={`retract-${r.rowId}`} onClick={() => act({ type: "manifest.retract", rowId: r.rowId })}>
                ✕
              </button>
            </li>
          );
        })}
        {gs.manifestRows.length === 0 ? <li className="dim">No loans committed. The night's ledger is blank.</li> : null}
      </ul>

      <div className="row-builder">
        <label>
          Token
          <select
            data-testid="loan-token"
            value={tokenId}
            onChange={(e) => {
              const id = e.target.value;
              setTokenId(id);
              const t = level.tokens.find((x) => x.id === id);
              const hosts = t
                ? [
                    ...level.props.filter((p) => p.accepts.includes(t.property)),
                    ...level.crew.filter((c) => (c.accepts ?? []).includes(t.property)),
                  ].filter((h) => h.id !== t.homeEntityId)
                : [];
              setToHostId(hosts[0]?.id ?? "");
            }}
          >
            {level.tokens.map((t) => (
              <option key={t.id} value={t.id}>
                {TOKEN_LETTER[t.property]} — {t.property} (home: {nameOf(t.homeEntityId)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Lend to
          <select data-testid="loan-to" value={toHostId} onChange={(e) => setToHostId(e.target.value)}>
            {borrowers.map((h) => (
              <option key={h.id} value={h.id}>
                {nameOf(h.id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          From beat
          <select data-testid="loan-start" value={String(startBeat)} onChange={(e) => setStartBeat(Number(e.target.value))}>
            {Array.from({ length: level.verification.horizonBeat }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due
          <select
            data-testid="loan-due"
            value={dueBeat === null ? "never" : String(dueBeat)}
            onChange={(e) => setDueBeat(e.target.value === "never" ? null : Number(e.target.value))}
          >
            {level.loans.legalDueBeats.map((d) => (
              <option key={d === null ? "never" : d} value={d === null ? "never" : String(d)}>
                {d === null ? "keep it (never returns)" : `end of beat ${d}`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="primary"
          data-testid="commit-row"
          disabled={!preview.ok}
          onClick={() => act({ type: "manifest.commit", row: { ...draft, rowId: `${draft.rowId}#${gs.revision}` } })}
        >
          Commit row
        </button>
        {!preview.ok && preview.reason ? <p className="warn">Cannot commit: {preview.reason}</p> : null}
      </div>
      <p className="dim small">Required: {level.loans.requiredTokens.map(nameOf).join(", ") || "none"}.</p>
    </section>
  );
}

function CommandEditor({
  level,
  gs,
  engine,
  act,
}: {
  level: RbmManifest;
  gs: RbmPlayState;
  engine: RbmEngine;
  act: (p: RbmActionPayload) => boolean;
}) {
  const legal = useMemo(() => engine.getLegalActions(level, gs), [engine, level, gs]);

  // Static cursor fold (same convention as the engine's getLegalActions): the
  // cell a crew member would occupy at `beat` if queued moves already ran.
  function cursorAt(beat: number, crewId: string): string {
    let cursor = level.crew.find((c) => c.id === crewId)?.cellId ?? "";
    for (let b = 1; b < beat; b++) {
      const c = gs.commands[b]?.[crewId];
      if (c && (c.type === "move" || c.type === "pickup-and-move")) cursor = c.to;
    }
    return cursor;
  }

  function slotOptions(beat: number, crewId: string): { slug: string; label: string }[] {
    const seen = new Set<string>();
    const out: { slug: string; label: string }[] = [];
    for (const a of legal) {
      const p = a.payload;
      if (p.type !== "command.queue" || p.beat !== beat || p.crewId !== crewId) continue;
      const slug = cmdSlug(p.command);
      if (!seen.has(slug)) {
        seen.add(slug);
        out.push({ slug, label: describeCommand(p.command) });
      }
    }
    // pickup/drop are real verbs the editor offers even though the auto-driver
    // folds them into pickup-and-move.
    const cursor = cursorAt(beat, crewId);
    for (const prop of level.props.filter((pr) => pr.cellId === cursor)) {
      const slug = `pickup:${prop.id}`;
      if (!seen.has(slug)) {
        seen.add(slug);
        out.push({ slug, label: `Pick up ${nameOf(prop.id)}` });
      }
    }
    out.push({ slug: "drop", label: "Set cargo down" });
    return out;
  }

  return (
    <section className="commands" aria-label="Beat orders">
      <h3>Orders by beat</h3>
      <table className="command-grid">
        <thead>
          <tr>
            <th></th>
            {Array.from({ length: level.verification.horizonBeat }, (_, i) => i + 1).map((b) => (
              <th key={b}>Beat {b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {level.crew.map((c) => (
            <tr key={c.id}>
              <th scope="row">{nameOf(c.id)}</th>
              {Array.from({ length: level.verification.horizonBeat }, (_, i) => i + 1).map((b) => {
                const queued = gs.commands[b]?.[c.id];
                const options = slotOptions(b, c.id);
                return (
                  <td key={b}>
                    <select
                      data-testid={`cmd-${b}-${c.id}`}
                      aria-label={`Beat ${b} order for crew ${c.id}`}
                      value={queued ? cmdSlug(queued) : "auto"}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "auto" || v === "clear") {
                          act({ type: "command.clear", beat: b, crewId: c.id });
                          return;
                        }
                        const cmd = slugCmd(v);
                        if (cmd) act({ type: "command.queue", beat: b, crewId: c.id, command: cmd });
                      }}
                    >
                      <option value="auto">— auto wait —</option>
                      {queued ? <option value="clear">✕ clear</option> : null}
                      {options.map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.label}
                        </option>
                      ))}
                      {queued && !options.some((o) => o.slug === cmdSlug(queued)) ? (
                        <option value={cmdSlug(queued)}>{describeCommand(queued)}</option>
                      ) : null}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim small">Empty cells wait automatically. Orders are checked when you run the plan — a blocked move fails there, not here.</p>
    </section>
  );
}

function Inspection({ sim, selectedId }: { sim: RbmSimState; selectedId: string | null }) {
  if (!selectedId) return null;
  const ent = sim.entities[selectedId];
  const tok = sim.tokens[selectedId];
  const dev = sim.devices[selectedId];
  return (
    <section className="inspect" aria-label="Inspection">
      <h3>Inspection</h3>
      {ent ? (
        <p>
          <strong>{nameOf(selectedId)}</strong> — {ent.kind} at {nameOf(ent.cellId)}
          {ent.cargoId ? `, carrying ${nameOf(ent.cargoId)}` : ""}
          {ent.captured ? " — caught" : ""}.
        </p>
      ) : null}
      {tok ? (
        <p>
          <strong>{nameOf(selectedId)}</strong> is {tokenStatusLabel(tok.status)}, hosted by {nameOf(tok.hostEntityId)}
          {tok.loan ? ` — due ${tok.loan.dueBeat === null ? "never" : `end of beat ${tok.loan.dueBeat}`}` : ""}, {tok.completedLoans} completed loan
          {tok.completedLoans === 1 ? "" : "s"}.
        </p>
      ) : null}
      {dev ? (
        <p>
          <strong>{nameOf(selectedId)}</strong> — {dev.kind}
          {dev.pressed !== undefined ? `, ${dev.pressed ? "pressed" : "released"}` : ""}
          {dev.open !== undefined ? `, ${dev.open ? "open" : "shut"}` : ""}
          {dev.powered !== undefined ? `, ${dev.powered ? "powered" : "dark"}` : ""}.
        </p>
      ) : null}
      {!ent && !tok && !dev ? <p>{nameOf(selectedId)}</p> : null}
      <p className="dim small">Patrols, plates and gates are the engine's truth; this panel only reports.</p>
    </section>
  );
}

function RunControls({ gs, act }: { gs: RbmPlayState; act: (p: RbmActionPayload) => boolean }) {
  const evaln = gs.lastRun?.evaluation;
  return (
    <section className="run-controls" aria-label="Run controls">
      <div className="row">
        <button type="button" className="primary" data-testid="test-run" onClick={() => act({ type: "test.run", seed: "solo" })}>
          Run the plan
        </button>
        <button
          type="button"
          className="primary"
          data-testid="accept-result"
          disabled={gs.lastRun?.success !== true}
          onClick={() => act({ type: "result.accept" })}
          title={gs.lastRun?.success ? "Accept this run as the night's result" : "Only a successful test run can be accepted"}
        >
          Accept the operation
        </button>
      </div>
      {evaln ? (
        <div className={`verdict ${evaln.success ? "success" : "failure"}`} data-testid="verdict">
          <strong>{evaln.success ? "The plan succeeds at the verification horizon." : "The plan fails."}</strong>
          <ul>
            {[...evaln.observations, ...evaln.outcomes]
              .filter((r) => !r.passed)
              .map((r) => (
                <li key={r.predicateId}>
                  {describePredicate(r.predicateId)}
                  {r.detail ? <span className="detail"> — {r.detail}</span> : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
