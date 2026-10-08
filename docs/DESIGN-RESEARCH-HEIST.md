# Design research — heist/planning games applied to RBM

Source literature: *Heat Signature* (Suspicious Developments, 2017), *Monaco:
What's Yours Is Mine* (Pocketwatch, 2013), *Quadrilateral Cowboy* (Blendo,
2016) — the three reference points for planning-driven stealth.
Each entry: what the reference does → the concrete RBM application.
[Conv] = convention, [Rec] = recommendation.

## H1. The plan is legible *because it fails* (Heat Signature's pause-plans) [Conv]

Heat Signature's genius: plans execute in real time, get interrupted mid-way,
and the player re-plans from the failure frame — the pause is where planning
happens. Its design lesson: a plan you can scrub *is* the tutorial, because a
failed step is inspectable at the exact beat it went wrong. RBM already
implements the deterministic version — pre-committed orders + verdict replay
+ event list — and the refine-3 name coverage makes the failing beat readable
in entity terms. Application carried forward: the verdict overlay's
expected-vs-actual line is RBM's "freeze at the failure frame". Any failure a
player can't scrub to and read concretely is a design bug, not just a UI bug
— `card-vs-engine` already treats illegible failures as card defects.

## H2. Role asymmetry from *information partitioning* (Monaco) [Conv]

Monaco's classes are not "better/worse" — each sees and does something others
can't (Locksmith opens, Cleaner sedates, Mole walls). The asymmetry produces
mandatory coordination without negotiation mechanics. RBM's 4-role design
applies the same principle through *physical partitioning*: on 11/12 each
crew member owns a wing/corridor the others can't reach in time, and the
manifest rows are split across planners in co-op (verified live: 3-seat
lockstep on rbm-12, refine-9). Checklist item it implies: a role that only
exists to carry out another planner's orders at a walk-up distance is a weak
role — the coopNote load-bearing check enforces this mechanically, but the
stronger authoring rule is "each role's last meaningful beat must be one only
that role could reach."

## H3. Typed interfaces as planning vocabulary (Quadrilateral Cowboy) [Rec]

Quad Cowboy's deck commands (`door.open(3)`, `cam.off(5)`) work because the
vocabulary is tiny, typed, and compositional — five verbs × numeric arguments
= the whole interaction space, and the puzzle is *which* commands, not *how
to express* them. RBM's command language is the same shape: `move`, `pickup`,
`drop`, `pickup-and-move`, `wait`, `command.queue` — plus the manifest row
triple. The applicable technique is QC's "parameter space is the difficulty
dial": QC tunes difficulty by how many arguments a command needs (3-second
door vs 10-second); RBM tunes by how many fields a row must satisfy
concurrently (start/due/host, all three binding on the hard levels). Borrowed
rule: never widen the verb list to add difficulty — widen the constraint
coupling between the existing fields.

## H4. Competence loops over fail loops (all three) [Conv]

All three references share one pacing trait: a failed run costs *seconds*,
not progress — restart is instant and the plan persists in the player's head.
RBM's equivalent loop: queued commands survive `test.run` (undo → adjust →
re-run without re-entering the manifest). The consequence worth keeping as a
rule: any friction in the iterate loop (re-typing a manifest, re-queuing
orders after a failed run) is a churn lever, so `history.undo` and
result-dismiss must never force full re-entry. Verified mechanically in
refine-2 (LIFO pops are bounded and selective; they never strand a contract).

## H5. The silent-success trap is the heist genre's endemic bug [Rec]

Monaco and Heat Signature both suffer "I succeeded but don't know why" —
proximity-based pickups and unclear alert timers produce wins the player
can't explain. RBM's answer is the one this whole audit line enforces: a
shortcut the plan completes silently MUST be carded TOLERATED with the reason
stated (rbm-02 `early-return` — succeeds because the tripwire never powered),
or gated by a predicate. Rule for future levels: simulate every carded
"failure" — if it wins, either card it tolerated or add the outcome predicate
that makes it fail; never leave silent successes unexplained.

## Applied checklist for future RBM content

- [ ] Every failure must be scrubbable to its failing beat and readable in
      entity names — illegible failure = card defect.
- [ ] Each co-op role needs a last meaningful beat only it can reach; pure
      "order-taker" roles are out.
- [ ] Difficulty lives in constraint coupling between fields (start × due ×
      host × row-count), never in new verbs.
- [ ] The iterate loop must stay sub-10-seconds: no forced re-entry of
      manifest or orders after a failed run.
- [ ] No silent successes: a completing plan the card calls a failure is
      either carded TOLERATED with reason or gets a predicate.

---

## Refine-15 — schedule legibility (Payday × Mark of the Ninja × layered planning)

Seed: how planning-forward stealth/heist games keep a *schedule* readable
under pressure, and what a post-release "inspector" surface needs to answer.

### H6. The plan is always one glance deep (Payday's pre-planning board)

Payday's planning phase renders the whole job as a single asset map —
every asset placed is a dot, every route a line; nothing lives in submenus.
RBM's manifest+order grid is already one-glance, EXCEPT one surface:
**the resolution order inside a beat**. Within a beat, crew acts then
plates settle then scans fire — the player must *predict* the order, but
only the timeline scrubber shows it, after a run. Inspector spec input:
a per-beat resolution sub-timeline (crew moves → returns → plate settles →
scan) rendered inline on the order row — the schedule's third dimension
made legible without simulating.

### H7. Predict before you commit (MotN's freeze-window contract)

Mark of the Ninja's planning freeze shows exactly which enemies will see
the move BEFORE you take it — prediction is a first-class affordance, not
an inference. RBM analogue: the inspector should answer "if I post X at
beat N, what opens/closes when?" — a hover-state projection over the
command select, sourced from the same legalDueBeats/plate-wiring tables the
cards use. Engine already computes everything needed; the inspector is a
read surface over `initialSimState` + the command's own projected effect.

### H8. Suspense is a countdown you can read (alarm-window design)

Both genres build tension the same way: a legible countdown the player
opted into. RBM's equivalent is the due column — the loan window IS the
suspense dial (verified: rbm-07's ocean of winners still feels tight
because the returns are visible). Inspector rule: every manifest row
should show its *pressure* — the beats where that row's return is
load-bearing (from the necessity probes), so the player reads which
deadlines are structural vs slack.

### H9. Post-release inspector — concrete spec inputs (for DEBT.md)

Priority-ordered, all pure reads over existing state:
1. **Per-beat resolution sub-timeline** — crew action → token returns →
   plate settles → scans, inline on each beat's order row. Source: the
   engine's per-beat ordering (documented in RBM-SYSTEMS-CARD).
2. **Pressure column on manifest rows** — flag rows whose removal fails
   the plan (the load-bearing data already computed by role-necessity
   probes; 30/30 streams required, so today every row shows "required" —
   the useful variant is *which beats* the row is load-bearing on).
3. **Command projection hover** — for each offered option in a cmd
   select, the predicted next-state diff (cell occupancy, plate states).
   Source: one `applyAction` dry-run — engine is pure, this is cheap.
4. **Verdict cross-links** — clicking a failed predicate scrolls the
   order grid to the causal beat (failure detail already carries it).
