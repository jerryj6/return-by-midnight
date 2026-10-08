# Design research — the audit trail as play space (Obra Dinn × RBM)

Source: *Return of the Obra Dinn* (Lucas Pope, 2018) design writeups — the
crew ledger as the game's *entire interface for truth* — read against RBM's
manifest (loan rows) / order (per-beat commands) split.

## A1. The ledger IS the game (not a menu over the game) [Conv]

Obra Dinn's book isn't a log of play — it's the deductive surface: every
fact the player knows lives in it, and entering a conclusion IS writing in
the book. RBM's split mirrors this more than it first appears: the
**manifest is the ledger** (the written record of obligations — who owes
what, due when) and the **orders are the marginalia** (the execution layer
that must satisfy the ledger). Design rule: the manifest should read like a
contract page — a player scanning it should be able to *audit* the plan
without watching a sim. RBM's rows already carry token→host→start→due; the
Obra lesson is that this document deserves the narrative weight — it IS
the hypothesis being tested.

## A2. Commitment before evidence (the guess-locking rule) [Conv]

Obra Dinn locks conclusions in threes — you can't verify one death at a
time, only trios. The effect: commitment is expensive, so players gather
*enough* evidence before writing. RBM's analogue is `manifest.commit` +
`test.run`: rows are free to draft but the verdict only comes from the
whole plan. Pope's trios suggest a costlier middle ground RBM already has
in spirit — **the manifest is the unit of verification, not the command**.
Authoring rule: don't add per-command verification hints; the player should
have to finish a ledger page before the engine speaks.

## A3. Show the fact, hide the inference (fates vs causes) [Conv]

Obra Dinn tells you WHAT happened to a sailor (the scene) but never WHY
(the inference is yours). RBM's verdict flow inverts this correctly: it
tells you the violated *predicate* (the fact) and leaves the *which command
caused it* to the player — the failure detail is a fact, the fix is an
inference. Keep it that way: verdict UI should name the broken contract
(door shut at 4, rattle heard at 6) and never the remedy.

## A4. Cheap things cluster: the manifest as constraint-satisfaction board [Rec]

Pope's crew list works because every row is the same shape — name, fate,
means — so the deduction surface is uniform. RBM's manifest rows are
uniform too (token→host→start→due), which is what made the enumeration
work. Extension: the **difficulty levers live in the ledger's shape** —
`legalDueBeats`, `maxRows`, `requiredTokens` — not in level geometry alone.
The rbm-12 split-posting discovery (4 families via maxRows slack) is the
audit-trail version of Obra's "several fates disambiguate each other":
manifest slack lets multiple *paper trails* describe the same truth.

## A5. The workspace survives the verdict (evidence stays pinned) [Rec]

In Obra Dinn you can re-open a scene after solving it — the memory stays
examinable. RBM equivalent: the post-accept board. The refine-13
superseded-banner fix enforces the honest version: the ledger stays open
for revision, but the verdict that no longer describes it gets marked.
Obra's rule generalizes: **an audit trail must distinguish "the record"
from "the current draft"** — RBM now does (accepted vs superseded).

## Applied checklist

- [ ] Manifest reads as a contract page: auditable without running the sim.
- [ ] Verification stays whole-plan; no per-command grading creep.
- [ ] Verdicts name the broken contract, never the fix.
- [ ] Difficulty dials sit in manifest shape (due bands, maxRows, required set).
- [ ] Post-verdict board distinguishes the record from the live draft (superseded marking — shipped).
