# Design research — micro-suspense in heist UX

AUTOMATED research synthesis. Sources: Invisible, Inc. (Klei, postmortems + Design Works interview), Heat Signature (Tom Francis devlogs), Mark of the Ninja legibility work (previously surveyed in DESIGN-RESEARCH-HEIST.md).

## The mechanism: suspense = visible resolution of a known gap

Suspense in a heist puzzle is not surprise. It is the interval between **a bet the player has committed to** and **the reveal of whether the bet was good**. Both reference games engineer that interval deliberately:

### Invisible, Inc.: the turn-pause reveal
- Each action commits the turn; consequences animate sequentially, one at a time, on a fixed cadence. A guard's patrol step, a camera sweep, a noise ping — each is its own beat-length reveal the player watches resolve.
- The suspense lives in *irreversibility made legible*: you already spent the action, now you get to find out. Klei leans on **showing the near-miss** — the guard's vision cone sweeps a tile adjacent to your agent — because a near-miss the player can *see* is worth more than a hidden success.
- Alarm counter as structural suspense: a global counter ticks on a fixed rhythm; the player always knows the worst case and watches it approach one increment at a time.

### Heat Signature: the one-second window made legible
- Francis's core trick: make the *gap itself* a rendered object. The window between two patrol arcs or two camera cones is drawn as navigable space — the player reads "I have ~1s" from the geometry before committing.
- Slow-mo/pause as a *legibility affordance*, not a cheat: time compression converts a twitch window into a puzzle, letting the player read the choreography they must execute at speed.
- Suspense = a *counted-down* window: you can see it closing while you are inside it.

## Mapping onto RBM

RBM's suspense substrate already exists — the **due band** (start~due loan windows), **guard patrol ticks**, **gate pressure plates**, and the **midnight capture horizon**. What the engine does not do is *stage* them. Three applied techniques:

1. **Beats as reveal cadence** (Inv. Inc.): the inspector's beat-by-beat replay should not just scrub — it should *resolve*, animating each action then its consequence with a hold on the moment a patrol's vision passes over or misses a token. The near-miss is the content.
2. **Windows as geometry** (Heat Signature): a due band and a patrol sweep should read as *visible spatial intervals* on the timeline — the inspector renders "this door is open beats 4–6" as a band the player can see closing, not a note in a log.
3. **The counter that ticks** (Inv. Inc. alarm): the due-9 midnight horizon is RBM's alarm counter. During replay it should be a persistent countdown so late extractions land as suspense, not surprises.

## Spec inputs for the inspector (DEBT.md)

- **Beat-resolve playback**: each action animates then holds ~300–400ms on its consequence frame (capture edge, gate toggle, patrol cross) before advancing. Optional "resolve all" fast path.
- **Closing-window overlays**: render each gate's open window and each posting's due band as bands on a beat ruler; visually shrink highlights on a token's remaining due beats while replaying.
- **Near-miss marker**: when a patrol's vision cell is adjacent to (but does not contain) a token/crew at a beat, flag it on the inspector timeline — "survived by one" is the suspense beat worth surfacing.
- **Midnight countdown**: persistent "due-9" horizon marker during replay; beats approaching it should escalate (UI treatment), not silently pass.
- **Precondition (from HEIST research)**: none of this adds state to the engine — it is read-side legibility over the already-recorded trace.
