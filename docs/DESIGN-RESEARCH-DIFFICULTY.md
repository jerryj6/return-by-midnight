# Design research — difficulty-curve calibration for planning games

Source literature: *Mark of the Ninja* (Klei, 2012 — stealth legibility postmortems), *Gunpoint* (Suspicious Developments, 2013 — Tom Francis's design write-ups), and Rob/Evan Kuqi's puzzle-difficulty writing (*A Theory of Fun*-adjacent heuristics, widely cited in indie puzzle postmortems). Each entry: the technique → the concrete RBM application.

## D1. Difficulty = information processed per decision, not puzzle size (Kuqi) [Conv]

Kuqi's framing: a puzzle is hard when the player must hold *N interacting
variables* in mind at once, not when the solution is long. RBM's difficulty
vector is exactly that count: (token windows × crew routes × sensor gates).
Calibration rule borrowed: score each level by its peak simultaneous-binding
count, not its raw schedule length. Measured on the enum data, RBM's peak is
mid-game (05–07: one family, forced windows, due forced to a point) — the
finale relaxes the manifest and adds breadth instead. Kuqi's model says this
is correct: 12's binding count is 3 rows × 4 crew × 2 live sensors, which is
higher than 05–07's count even though its manifest density is looser — the
finale IS harder, just on a different axis (coordination vs precision).

## D2. Legibility first, difficulty second (Mark of the Ninja) [Conv]

MotN's postmortem: every difficulty bump was built on top of a *readable*
signal — the player could always see the light cone, the noise ring, the dog's
nose. Difficulty that comes from illegibility is a bug, not a challenge.
RBM application: every constraint that can kill a run must be inspectable —
the scene's gate lit/shut, the sensor states, the patrol tracks — and every
failure must name its mechanism. That's why the describe.ts name coverage and
the expected-vs-actual verdict are hard checks now: a difficulty wall only
teaches if the player can read why they hit it. Kuqi sharpens it: "the player
should be frustrated by the puzzle, never by the interface."

## D3. The wall belongs mid-game; the finale rewards synthesis (Gunpoint) [Conv]

Gunpoint's curve deliberately spikes mid-game (the Vault levels) then relaxes
into breadth for the finale — the last levels give you *more* tools and
bigger rooms, not tighter windows. Tom Francis's stated reason: a climax that
gates harder tests patience; a climax that synthesizes tests mastery. RBM's
measured curve matches this shape almost exactly: the manifest-tightest
levels sit at 05–07, and 11–12 are the broadest (4 families, 18 orders,
two-sensor readings). The enum-driven finding (07 is 33× tighter than 09) is
not an inversion bug — it's the genre-correct shape, and the appendix now
says so explicitly so playtest reports don't read it as one.

## D4. Difficulty is authored on the *correction* path (all three) [Rec]

All three sources share one calibration lever: how much of the plan survives
a failed attempt. MotN respawns cost ~2 seconds; Gunpoint's quick-load is
instant; Kuqi's rule is "iterate cost scales with punishment". RBM's
equivalent is the undo-doesn't-clear-the-board loop — the plan persists
through a failed test.run and the player edits a beat, not the whole plan.
Calibration rule: tune difficulty by how *few* fields a failure forces the
player to re-decide — not by how tight the window is. The tightest
mid-game levels work because the correction is cheap (one due beat to
adjust), not because the window is fair in isolation.

## D5. Playtest difficulty ≠ authored difficulty (process) [Conv]

All three postmortems report the same calibration surprise: levels the
author called easy tested hard, and vice versa — because authors test the
solution, playtesters test the search space. RBM is unusually well-instrumented
for this: the enum gives the *search space* directly (winners/tried per
level), which is a defensible proxy for playtest-experienced difficulty before
any human touches it. The appendix now publishes per-level vectors so that
player reports can be compared to the objective curve — a report of "level X
feels impossible" on a 0.7-density level means the level is *perceived* hard
(legibility gap), while the same report on a 0.02-density level means the
wall is real. Two different bugs; the vector table disambiguates them.

## Applied checklist for future RBM content

- [ ] Score difficulty by peak simultaneous-binding count, not schedule length.
- [ ] Any constraint that can fail a run must be visible in the scene or the
      verdict text before the player commits.
- [ ] Put the tightest windows mid-game; grow breadth (rows/crew/sensors) for
      the finale instead of tightening further.
- [ ] Calibrate on the correction path — count fields re-decided per failure.
- [ ] Publish the objective curve; treat playtest complaints as signal about
      legibility when they conflict with the enum density.
