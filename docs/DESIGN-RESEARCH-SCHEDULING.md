# Design research — scheduling/planning puzzles applied to RBM

Source literature: Zachtronics scheduling lineage (Opus Magnum, SpaceChem —
the two canonical "program-the-timeline" puzzle games), Factorio's puzzle
mode ("belt-block" / throughput-target scenarios), plus the Job-Shop-Problem
lens those games secretly teach. Each entry: what the reference does → the
concrete RBM application. [Conv] = industry convention, [Rec] = recommendation.

## T1. The scarce dimension is the *phase*, not the resource [Conv]

SpaceChem's difficulty is never "do you have enough atoms" — it is *where in
the cycle* each operation lands. Opus Magnum's cycle-score makes the same
point: solutions are graded on timing, not inventory. RBM already encodes
this — the enumeration proves the manifest space's real variable is loan
*timing* (start/due intervals on a fixed routing: 11/12 levels have exactly
one routing family). Application: keep difficulty weight on `startBeat`/
`dueBeat` tension (overlaps, home intervals, gate windows) and treat
token→host routing as read-once comprehension. A level whose lesson is a new
route would be fighting the genre — the route IS the manifest's tutorial
content, the *schedule* is the puzzle.

## T2. Return-as-event closes the loop (SpaceChem's cycle reset) [Rec]

SpaceChem reactors loop forever; a solution must survive its own periodicity.
RBM loans are one-shot, but the **return phase** is the loop-closure event:
the returning token lands on the host's *current* state (rbm-04's carried
safe, rbm-10's gallery doors, rbm-12's home plate). This is the same skill —
the schedule must be correct at t=0 and at every scheduled re-entry — just
executed once instead of cyclically. Level-authoring rule it implies: a
return should land in *changed state* (moved host, opened gate, second
posting queued) or it is dead time; every committed level already obeys this
(returns all do work: gate closes, beam douses, plate presses, sensor wakes).

## T3. Phased pipelining — intervals as arms [Rec]

Opus Magnum lets the player run many manipulator arms in one cycle; the
scheduling skill is *phasing* staggered arms around shared track space. RBM's
parallel loans on distinct tokens are the arms; crew members are the tracks.
The enumerator's rbm-12 discovery — a single posting decomposable into two
adjacent loans covering identical beats (`H@1~2 + H@3~3`) — is exactly OM's
"split the arm's job into segments" idiom, surfaced through `maxRows` slack.
Application: treat `maxRows − requiredRows` as the level's *pipelining
budget*. rbm-12 grants 1 (one free split — tolerated multiplicity); levels
granting 0 force atomic intervals. Choosing the budget is choosing whether
segment-scheduling is a legal expression of the solution.

## T4. Legibility of the schedule itself — the verdict is the Gantt chart [Conv]

Both Zachtronics games and Factorio replay the *entire execution* — the
player debugs by watching the timeline, not by reading an error string.
RBM's beat-scrub timeline + verdict overlay (expected-vs-actual per
predicate) is the same instrument; refine-3's name coverage ensures every
failed predicate reads in entity names, not slugs. Extension worth keeping:
the event list IS the schedule's debugger — a carded wrongApproach that
doesn't produce a readable failure event is an illegible failure (the
validator already enforces legibility by replaying the mechanism).

## T5. Optimization as an *ungraded* second pass [Conv→Rec]

Opus Magnum scores solutions on cycles/cost/area but never blocks progress on
them — the minimum solve always counts, and optimization is voluntary depth.
RBM applies this as designed multiplicity: the enumerated tolerance bands
(LEVELS.md appendix) are the acceptance space, and playtesters are told a
win inside the band is intended. RBM differs by shipping *no* score metric —
borrowed deliberately: a puzzle about moral clarity (the heist plan either
works or gets you caught) would be cheapened by a "fewest beats" leaderboard.
If a mastery-tier is ever added, the natural score is *fewest manifest rows*
or *earliest crew-out beat* — both already measurable from the plan.

## T6. The chokepoint discovery pattern [Conv]

Every strong scheduling puzzle has one resource contention the player must
*find*, not be told (SpaceChem's shared bonding sites, Factorio's single
mixed belt). In RBM this is the plate: every level's difficulty concentrates
on which token feeds which gate when — the "two jobs, one token" chokepoint
(rbm-01, 02, 05, 06, 09 single-token levels) is the purest form, and the
crossover (rbm-11) is the chokepoint applied twice. Authoring checklist it
implies: a level without a discoverable contention point (everything has a
free slot) is filler — audit by asking "which interval can't move, and why?"

## Applied checklist for future RBM content

- [ ] Difficulty must live in interval *placement* (overlaps, home gaps, gate
      windows), never in discovering a legal row — routes read as obvious.
- [ ] Every return must land into changed state (moved host, armed sensor,
      pending reloan). Dead returns = dead level seconds.
- [ ] `maxRows − requiredRows` is the pipelining budget — set it
      deliberately; 1 slack row = one legal split-posting family.
- [ ] Failures must be replayable on the timeline (a scrub back to the
      failing beat should show it); opaque failures are card defects.
- [ ] Keep multiplicity documented (LEVELS.md appendix) — a win inside the
      enumerated band is designed, not degenerate.
- [ ] Each level needs a named chokepoint. If you can't say "the X interval
      can't move because Y", the level isn't finished.
