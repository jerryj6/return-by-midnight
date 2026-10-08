import type { GameEvent } from "../engine/contracts.js";
import type { RbmBeatSnapshot } from "../engine/rbm/types.js";
import { describeEvent } from "./describe";

const PHASE_LABEL: Record<string, string> = {
  loans: "loans",
  crew: "crew",
  guards: "guards",
  returns: "returns",
  settle: "settle",
  evaluate: "verdict",
  planning: "plan",
};

interface Props {
  timeline: RbmBeatSnapshot[] | null;
  events: GameEvent[] | null;
  scrub: number | null;
  onScrub: (beat: number | null) => void;
  horizon: number;
}

/**
 * Run-scrub timeline (read-only inspection, TRS-009 analogue): scrubbing only
 * changes which committed snapshot the board renders — it never edits the
 * plan. Clicking a beat or an event jumps the scene to that beat's end state.
 */
export default function TimelineView({ timeline, events, scrub, onScrub, horizon }: Props) {
  if (!timeline || !events) {
    return (
      <section className="timeline empty" aria-label="Run timeline">
        <p className="dim">No test run yet — commit a manifest and orders, then run the plan to scrub its beats.</p>
      </section>
    );
  }
  const lastIdx = timeline.length - 1;
  const viewIdx = scrub ?? lastIdx;
  const shown = events.filter((e) => e.beat === viewIdx);
  return (
    <section className="timeline" aria-label="Run timeline">
      <div className="beat-strip" role="group" aria-label="Beat scrubber">
        {timeline.map((snap) => (
          <button
            key={snap.beat}
            type="button"
            data-testid={`beat-${snap.beat}`}
            className={snap.beat === viewIdx ? "beat-chip active" : "beat-chip"}
            onClick={() => onScrub(snap.beat === lastIdx ? null : snap.beat)}
            title={snap.beat === 0 ? "before the first beat" : `end of beat ${snap.beat}`}
          >
            {snap.beat === 0 ? "Start" : `Beat ${snap.beat}`}
          </button>
        ))}
        <span className="beat-horizon dim">verification at end of beat {horizon}</span>
      </div>
      <ol className="event-list" data-testid="event-list">
        {shown.length === 0 ? <li className="dim">Nothing stirs.</li> : null}
        {shown.map((e, i) => (
          <li key={i} className={`event phase-${e.phase} type-${e.type}`}>
            <span className="phase-chip">{PHASE_LABEL[e.phase] ?? e.phase}</span>
            <span className="event-text">{describeEvent(e)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
