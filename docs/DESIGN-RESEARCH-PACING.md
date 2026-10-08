# Design research — heist-film pacing applied to puzzle campaigns

Source literature: the Ocean's films' three-act structure (assemble → execute
→ complication-reveal), *Monaco: What's Yours Is Mine* (its co-op pacing and
the "everything goes wrong at once" collapse rhythm), and puzzle-campaign
pacing write-ups (Stephen's Sausage Roll, Baba Is You world-map pacing).
Each entry: the technique → the concrete RBM application.

## P1. The complication reveal is a *new rule*, not a harder one (Ocean's) [Conv]

In a heist film, the mid-plan complication works because it reveals a system
the audience didn't know existed (the backup generator, the second vault
door). The satisfying version isn't "the same problem, harder" — it's "a rule
you hadn't seen operates here now." RBM already does this: the away-open
dark-lamp plate (rbm-08) and the home-pressured inner door (rbm-12) are both
unannounced polarity reveals mid-campaign — a player who learned
"posted-weight-presses" discovers the inverse exists. Rule for future content:
each level may introduce at most ONE previously-unseen mechanic or polarity,
and it should fire mid-plan, not at load — the reveal's value is the
re-derivation, not the surprise.

## P2. Third-act collapse is choreographed, not chaotic (Monaco) [Conv]

Monaco's co-op rhythm alternates quiet planning beats with everything-on-fire
beats — the collapse is on a timer the players can read, which makes it fair
and hilarious instead of frustrating. RBM's equivalent is the patrol/return
clock: the midnight sweep at beat 9, the walker rattle at 6. Application:
timed collapse beats must be (a) readable before they fire (patrol tracks,
sensor states — all inspectable), and (b) the collapse should strand *routes*,
not the run — the best Monaco moments recover. The rbm-12 walker's
beat-6 rattle strands only the *dawdler* — the level punishes the specific
over-stay, never the whole plan. Authoring rule: every timed hazard should
name what it removes, not end the run outright.

## P3. Crew beats interleave like film cross-cutting (Ocean's assemble) [Conv]

The assemble montage works because it cuts between specialists doing solo
beats that the audience can tell will matter later — the montage IS the
strategy tutorial. RBM's manifest board is the same structure literally:
each row is one specialist's arc (borrow → post → return), and the co-op
split-assignment playtest showed the rows compose like cross-cut scenes.
Application carried into the coopNote convention: each role's notes describe
a *scene* (what that player watches/decides alone) plus a *handoff* (the
beat where their work unlocks someone else's). A coopNote that only says
"player N owns crew X" is incomplete — it must name the handoff beat.

## P4. Beat gaps are texture, not dead time (pacing research) [Conv]

Puzzle-campaign pacing studies (and the Monaco/Gunpoint postmortems) agree:
the level where nothing is at stake for 2–3 beats is the one players remember
as tense, because they're holding a plan and waiting for it to prove out.
RBM's alcove holds (rbm-06 beats 1–2, rbm-01's crew cover) are this — the
idle beats are load-bearing tension, not filler. The enum data confirms it:
rbm-06's hold exists because the hall is swept through beat 2 — the wait IS
the move. Rule: a beat the player must spend on `wait` is a designed beat,
not a gap to optimize out — and the depth-proofs minimality sweep enforces
this (a removable wait that still wins would surface as WARN).

## P5. The payoff shot lands in the *verdict*, not the run (all three) [Rec]

Heist films end with the plan playing back cleanly — the montage of it
working. RBM's post-accept verdict/objectives list is that payoff shot:
expected-vs-actual detail, the accepted banner, the crew getting home. The
concrete application (from refine-3/9): the payoff only lands if every
predicate is *named* — "safe-vaulted" means something; "id: safe-vaulted"
raw-slugged does not. The UI-text coverage check exists because the payoff
beat is where the campaign's story actually resolves for the player.

## Applied checklist for future RBM content

- [ ] At most one previously-unseen mechanic per level, fired mid-plan.
- [ ] Timed hazards strand routes, not the run; they're readable before firing.
- [ ] coopNote roles name the handoff beat, not just the crew.
- [ ] `wait` beats are authored texture — depth-proofs keep them honest.
- [ ] The payoff lives in the verdict text; keep names human-readable.
