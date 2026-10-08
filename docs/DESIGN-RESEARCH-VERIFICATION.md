# Design research — document-verification puzzle design (Papers Please)

Source literature: Lucas Pope's *Papers, Please* (2013) postmortems and GDC
talks — tempo design, error surfacing, and the "citation" feedback loop —
applied to RBM's verdict flow. Each entry: the technique → the concrete RBM
application.

## V1. The discrepancy is found, not told (Pope's citation design) [Conv]

Papers, Please's core trick: the game rarely tells you what you missed — it
shows the document and the rule *side by side* and lets you locate the
discrepancy. Pope's design notes call this "the player performing the check",
and it's why the game feels like work rather than grading. RBM's verdict
already has the substrate: per-predicate expected-vs-actual detail. The
transferred rule: a failed verdict should let the player *see the two
documents* — the failed predicate's name AND the beat/event evidence — not
just a red "fail". RBM-0x's verdict block does this when names are complete
(refine-3 closed the slug gap); anything still rendering raw ids leaks the
grade without the evidence.

## V2. Tempo is a resource, not a difficulty knob (workday pacing) [Conv]

Papers, Please's day-clock doesn't exist to be hard — it exists to force
triage: you can't check everything, so you choose what to check. The
difficulty comes from *allocation under time*, not precision. RBM's
equivalent resource is the beat horizon: a plan competes on how many beats
its schedule spends. Application: don't extend horizons to add difficulty —
tighten what's *due inside* the existing window (the rbm-05/07 mid-wall is
exactly this: same horizon, denser binding). Levels that need "more time"
almost always need "more coupling" instead.

## V3. Errors should surface at the moment of commission (the stamp beat) [Conv]

In Papers, Please, the buzzer sounds the instant your stamp lands wrong —
feedback is event-synchronous, not end-of-day. RBM's analogue: command
rejections inside `test.run` report *at the failing beat with the reason*
(gate-closed at 4, capture at 6) — already the strongest match in the set.
The remaining gap Pope's rule identifies: **manifest rejections** (the
loan-row commit toast) are the only pre-run feedback and they're terse — a
player who commits an overlapping row sees the rejection but not the
*conflicting row's window*. Authoring rule: rejection text should name the
colliding entity ("overlaps TOKEN-N @2~5"), which is a content/wording fix,
not an engine change.

## V4. Let the player build the inspection habit (upgrade of sightlines) [Rec]

Pope described the game as "teaching players where to look" — each new
document element trains an inspection habit that later levels exploit. RBM
already does this with sensor states (rbm-10/12's telltales) and lit-cell
cones: the finale levels' entire trick is *knowing which plate-state to
watch*. Extension for future content: every new checkable object (a sensor,
a telltale, a clock) should be introduced as a *visible prop* one level
before it becomes load-bearing — the habit must exist before the stakes do.

## V5. The day ends — post-mortem access is generous (review after close) [Rec]

At day end the papers stay on the desk; the player reviews freely. RBM's
post-verdict board works the same way — the plan stays up, commands stay
visible, undo rewinds the history. The seat-claim/post-accept finding
(refine-11/12) shows why this needs a rule: the review surface is shared and
mutable — a post-accept write can silently diverge from the accepted verdict.
Pope's parallel suggests the fix isn't freezing the board (review must stay
alive) but **marking it**: a "verdict superseded — board changed since
accept" state preserves the review while keeping the accepted artifact
honest. Design proposal; coordinator call.

## Applied checklist for future RBM content

- [ ] Failed verdicts show predicate name + the beat/event evidence together.
- [ ] Grow density inside the horizon; don't extend the horizon.
- [ ] Every rejection message names the colliding row/window.
- [ ] New checkable props appear one level before they're load-bearing.
- [ ] Post-accept board mutations must flag the verdict as superseded.
