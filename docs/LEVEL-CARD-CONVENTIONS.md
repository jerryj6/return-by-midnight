# Level-card & hint conventions (RBM)

Written down once, so the pattern stops looking accidental. All findings below are
AUTOMATED evidence (scripted engine playthrough, `scripts/card-vs-engine.ts` and
the audit sweep) — not human playtest.

## 1. Card coverage

| Convention | Rule |
|---|---|
| Tutorial exemption | **RBM-01 ships no `LevelCard`** — its beat-by-beat sequence is the tutorial itself; the teaching trace lives in `RBM_HINTS["rbm-01"].solution` instead. Every post-tutorial level (02–12) MUST export a card with ≥1 `winningTraceSummary` line and ≥1 `wrongApproaches` entry. Enforced by `scripts/validate-content.ts`. |
| Card id | `card.levelId` equals the lowercase index id (`"rbm-02"`), the `CARDS` map key is uppercase (`"RBM-02"`). |
| coopNote | Only on designated co-op levels (GME-007): RBM-08, RBM-10, RBM-11, RBM-12. Four entries = four distinct contribution types (two manifest owners + route operators + a warden). Other levels omit it — solo design is the default, not a gap. RBM-08/10 wire it inline on the card const; RBM-11/12 wire it via the `CARDS` index spread — `check:content` loads the merged cards so both shapes are truth-checked. |

## 2. `expectedFailure` honesty rules

- The field describes what the ENGINE does to the approach, not what the designer wishes.
- An approach that **succeeds anyway** is a tolerated shortcut: the text must start
  `TOLERATED SHORTCUT` and describe the teaching loss (precedent: RBM-02 `early-return`).
- A manifest-rejected approach's text must name the rejection reason the engine actually
  produces (`overlapping-loan`, `manifest-over-budget`, `incompatible-host`,
  `loan-to-own-home`, `start-beat-out-of-range`). Rejection precedence is
  overlap → due-legality → budget → host-compat, so the *first* failing check is the
  truth (precedent: RBM-05, where `manifest-over-budget` is unreachable because the
  token's window is fully booked).
- `scripts/card-vs-engine.ts` enforces both rules: a carded approach that produces a
  mechanism the carded text doesn't name fails the check.

## 3. Timing tolerances (measured, AUTOMATED)

The committed reference plans overstate precision in several places. These tolerances
are *verified* — mutation sweeps over due/start beats and ±1-beat command retimes.
Authors may either tighten the level or document the band; silent looseness is the bug.

| Level | Verified tolerance |
|---|---|
| RBM-01 | `startBeat` 1–2 both win (the second is the committed alternate); helper's beat-2 command also passes at beat 1. |
| RBM-02 | `dueBeat` 3,4,5 all complete — but only **5** powers `sensor-vault` (3/4 = TOLERATED shortcuts). `dueBeat` ≤2 fails (lit-hall capture). `startBeat` 2–5 all win. |
| RBM-03 | `dueBeat` 4,5,6 all win; `startBeat` 2–6 all win — only the *return* beat matters. |
| RBM-04 | `dueBeat` 4,5 win; helper's beat-6 command passes at 5. |
| RBM-05 | row 0 `startBeat` 2–4; row 1 `startBeat` up to 6; three ±1 command retimes pass. |
| RBM-06 | `startBeat` 2–4; three ±1 retimes pass. |
| RBM-07 | row 0 `dueBeat` 3–4; `TOKEN-N` rattle `dueBeat` 3–7 all win — due 1–2 fails the diversion, `null` fails `noisy-home` (the "all run long" framing is not binding); `TOKEN-H` vault row `startBeat` 2–3; four ±1 retimes. |
| RBM-08 | `TOKEN-B` `dueBeat` 5–7, `startBeat` 3–4 (start 1 fails: the beat-1 settle must register the weighted lamp first); `TOKEN-N` `dueBeat` 3 also wins but due 6 fails — early return required; `TOKEN-H` `dueBeat` 5–7, `startBeat` 1–5; six ±1 retimes. Widest in the set. |
| RBM-09 | `dueBeat` 4,5,7 win (ref 6); `startBeat` 2,3 win; four ±1 retimes. |
| RBM-10 | row 0 `dueBeat` 3–4, `startBeat` 2; row 1 `dueBeat` ≥6, `startBeat` 2–5; eight ±1 retimes. Still the loosest timing band in the set — designed multiplicity, kept deliberately (the finale's precision lives in the vestibule lurk, not the manifest). Trace was made minimal in refine-2 (see §5). |
| RBM-11 | Enumerated (1,296 manifests → 324 winners, exactly 1 family): corridor rows `dueBeat` 4–5, `startBeat` 1–3; window rows `dueBeat` 7–8, `startBeat` ≤6 — the crossover bound is per-token non-overlap (`late.start > early.due`), not a fixed beat: a late posting at start 5 wins when the early one ends at 4. |
| RBM-12 | Enumerated (92,160 manifests → 33,000 winners, **4 families**): canonical `TOKEN-H` `dueBeat` 3–4, `startBeat` 1–3; `TOKEN-B` `dueBeat` 5–9 all win, `startBeat` 1–4; `TOKEN-N` `dueBeat` 7–8, `startBeat` 1–6. Plus three **split-posting families**: any one posting can decompose into two shorter loans covering the same beats (e.g. `H@1~2 + H@3~3`, `B@1~2 + B@3~5`, `N@1~2 + N@3~7`) — `maxRows:4` buys exactly one split. Tolerated multiplicity; see §7. |

Policy: where a tolerance is *designed* multiplicity, add one "Tolerance note" line to the
card's trace summary. Where it undercuts the taught lesson (rbm-02's dark tripwire), the
card marks the shortcut `TOLERATED`.

## 5. Refine-2 engine-semantics findings (AUTOMATED)

- **RBM-10 committed traces made minimal.** The lookout's beat-3 foyer visit was dead
  time: `pad-out↔cell-vestibule` is a direct edge and her vestibule lurk only needs to
  be in place by beat 5. Removed from both `rbm10ReferencePlan` and
  `rbm10AlternatePlan`; card trace + `solutionPolicy` updated. Tightening was
  considered (cut the `pad↔vest` edge, forcing pad→foyer→vest): the reroute's
  feasibility depends on `gate-gallery` opening and the ungated `beam-foyer` window
  (guard-1 sits west at beats 6–7), and removing an edge changes the level's geometry
  and identity — a level-author call, not a card-side fix. Minimal trace chosen.
- **CoopNote roles verified non-degenerate (AUTOMATED).** Per-role command-removal
  probes on rbm-08/10: dropping any manifest row or any crew member's entire command
  set fails the run. rbm-10 is a clean 1:1 — helper=bell, runner=gallery,
  operator=attic, lookout=vestibule, each owning exactly one outcome.
- **`history.undo` across `manifest.commit` — RULING: sanctioned, not a loophole.**
  Checkpoints are LIFO full-state snapshots pushed on every non-undo action. Undoing
  past a committed row cleanly un-commits it — but only after popping every action
  queued since, so a player cannot surgically un-commit a loan while keeping its
  downstream effects (verified: commit → queue → undo pops the command, then the
  row). The spec *intends* this: RBM-002 ("Players may undo a committed beat through
  the ordinary history mechanism"), GME-010 (undo a mistake and retry quickly), and
  FLOW-05 (ordinary undo requires no confirmation) all treat the manifest as a plan
  under edit, not an irrevocable contract — a loan row is only binding once the run
  is tested and *accepted*. A mid-window undo is therefore a legal rewind of your
  own paperwork, and the listed edge case "undo across return" (MASTER-HANDOFF
  verification table) is expected to work. Engine behavior is correct; no change.
- **Degenerate-solve sweep rbm-06/07/09 clean.** Dropping any single crew member's
  commands or any manifest row from the committed plans fails the run; no
  single-crew or row-less shortcut exists.

## 6. Enrichment fields (optional, PFT-style)

Cards may carry `insight`, `naiveApproach`, and `solutionPolicy` — see the interface
comments in `src/content/levels/level-card.ts`. All are documentation-only; no engine or
client surface consumes them yet.

## 7. Refine-5 — RBM-11/12 probe coverage + coop wiring note (AUTOMATED)

- **All 14 carded `wrongApproaches` on rbm-11/12 now have probes** in
  `scripts/card-vs-engine.ts` (`unprobed=0`, 61 total). Every carded mechanism
  reproduces exactly as written — no drift on either level: the crossover's
  `overlapping-loan`/`incompatible-host` rows, `gate-closed` exits before the
  window posting, `guard.capture` at beat 9 (open-window stragglers on both
  levels) and at beat 2 on the opening sweeps, the vault-pair beat-6 rattle,
  and `plan.complete` on a missing required-token row.
- **CoopNote wiring inconsistency caught (AUTOMATED):** RBM-11/12 ship their
  `coopNote` via the `CARDS` index spread, not inline on the card const like
  08/10 — the validator's raw-const imports silently skipped their role checks.
  `check:content` now loads the merged `CARDS` entries for 11/12 (the same
  objects the client ships); both coopNotes verified load-bearing (rbm-11: 4
  roles / 4 rows / 4-of-4 crew commanded; rbm-12: 4 roles / 3 rows / 4-of-4).
- **Convention pinned:** home props carry `accepts: []` — a token's home is
  declared by `homeEntityId`, not by an accept list (the rbm-12 fix).
- §3 tolerance table extended to 11/12 — first by targeted mutation sweep,
  then superseded by full enumeration (`scripts/enumerate-manifests.ts`):
  rbm-11 → 324 winners, exactly 1 routing family; rbm-12 → 33,000 winners,
  **4 families** (see §8).

## 8. Refine-6 — enumeration of 11/12 + split-posting finding (AUTOMATED)

`scripts/enumerate-manifests.ts` now runs a gate-coverage prefilter for
rbm-11/12: a manifest that cannot press open a gate the committed commands
cross (or leaves a home-pressured plate's token out at the crossing beat) is
counted as statically eliminated — guaranteed `gate-closed` — and only
coverage-surviving manifests are simulated. The filter is audited by padded
spot-checks (rejected token-sets re-completed with committed rows: 0 misses).

- **RBM-11: exactly 1 routing family.** All 324 winning manifests are the
  crossover — four gates, four plate-feeding rows, `maxRows:4` leaves zero
  slack for split postings or spare rows. Timing is the only freedom.
- **RBM-12: 4 families — a genuinely new solve structure.** 33,000 winners:
  the canonical 3-row family (1,440) plus three **split-posting families**
  where one posting decomposes into two shorter loans covering the same
  beats. Choreography is identical; they differ only on the loan board —
  paperwork variants, not new routes. `maxRows:4` over 3 required rows buys
  exactly one split. A *fourth* kind of alternates (different routing or
  different choreography) does not exist: single-host tokens and the
  door-chain force both.
- **Convention — split postings are TOLERATED multiplicity, not cards.** A
  card need not enumerate them; the appendix documents them so playtesters
  don't report them as bugs. If a level's lesson requires a posting to be
  atomic, that is a level-author design change (maxRows or due options),
  not a card fix.
- **Minimality on 11/12 clean (AUTOMATED):** row-drop, crew-drop, and
  delete-one-command sweeps fail on all four committed plans (ref+alt) —
  no dead command, no freeloader row, no single-crew shortcut.

## §9 Refine-7 — scripted co-op playtest + full enumeration sweep

- **Scripted 2-player co-op playtest on rbm-11 (AUTOMATED, not a human test):**
  `scripts/browser-playtest-coop.ts` drives two independent browser contexts
  against the dist+ws server — host creates a room via the lobby, guest joins
  by the rendered room code. Manifest rows and orders were deliberately split
  across clients (host: helper+runner + 2 rows; guest: scout+operator + 2
  rows). Verified: 4/4 committed rows and all 12 orders replicate identically
  on both boards (lockstep), 4/4 crew commanded through the UI, `test.run` on
  the host yields the success verdict on BOTH clients, `result.accept` on the
  host lands the accepted banner on BOTH. This is the deepest automated co-op
  check on the set — combined with §6's role-load-bearing check it covers the
  coopNote claims end-to-end.
- **Full enumeration sweep complete — all 12 levels.** The enumerator gained
  a third plate polarity for rbm-08 (`whenPressed:"close"` on a home prop —
  "dark lamp" doors: the gate opens while the home token is AWAY on loan, the
  inverse of rbm-12's home-pressured plate). Result: every level except
  rbm-12 has exactly ONE token→host routing family — no undiscovered
  alternate routes exist anywhere in the set. rbm-12's 4 families (canonical
  + 3 split-posting variants) are the only multi-family level.
- **Enumerator audit fix:** padded spot-checks must test the rejected
  per-token row-SET intact — padding one row of a rejected pair fakes a
  "prefilter miss" on a correct rejection (found on rbm-10, fixed).
- **Bible-part sweep status:** Part 3 (puzzle structure) — applied in the
  audit pass; Part 4 (systems) — RBM-SYSTEMS-CARD.md; Part 8 (feel loop) —
  mapped onto the verdict UI; Part 9 (onboarding) — early-level audits;
  Part 10 (content pipeline) — these conventions + `check:content`;
  Part 5 (co-op) — role-load-bearing check + scripted 2-player lockstep
  playtest above. Remaining parts are process/portfolio-level (1, 2, 6, 7,
  11–14) — no further card-side sweep applicable to RBM content.

## §10 Refine-8 — hint-ladder concreteness + enum re-verification

- **Hint-ladder audit (all 12):** every tier must name the concrete entity it
  references (token/prop/crew/beat). Six vague tiers fixed on 06/09/11/12
  (e.g. "the far anchor" → `cell-junction`; abstract "two doors" →
  inner/outer with their plate mechanics + beats). Ladders on 01–08/10
  already cited beats, tokens, and doors — clean.
- **Enumeration re-verified:** second full 12-level sweep, family counts
  unchanged — rbm-12 exactly 4 (canonical + 3 split-posting), every other
  level exactly 1. The upstream joiner-levelId fix does not affect any
  content under this package's scope.

## 10. Refine-9 — co-op scale, a11y, fail-reason coverage

- **3-player co-op verified live (AUTOMATED).** rbm-12's manifest+orders sharded across three independent clients (P1: H row + helper; P2: B row + scout; P3: N row + runner+operator). All 3 boards showed identical 3 rows + 18 orders; success verdict + accepted banner on every seat. `scripts/browser-playtest-coop.ts` now takes `PLANS[level] = PlayerShare[]` — N seats from one table entry.
- **Keyboard/a11y pass + fix.** Scripted Tab/focus-visible walk (title → select → board → commit → verdict): native controls were already tabbable; the real gap was SVG scene entities — `<g>` click targets with no role/tabIndex/keys. `SceneView` entities + loan threads now carry `role="button" tabIndex={0}` + Enter/Space activation (`entKey` helper) and a `.scene g[role="button"]:focus` ring. `scripts/browser-a11y-probe.ts` re-verifies: all interactive elements semantic or role-annotated.
- **Fail-reason audit documented.** `docs/WRONG-APPROACH-AUDIT.md` — all 61 carded approaches resolve to asserted mechanisms; none inexpressible. Four manifest-shape rejection classes (start-out-of-range, due-not-offered, due-before-start, duplicate-row-id) remain uncarded — not defects, noted for parity.
- **Research entry.** `docs/DESIGN-RESEARCH-HEIST.md` — 5 techniques from Heat Signature/Monaco/Quadrilateral Cowboy (scrubbed-failure legibility, role asymmetry via physical partitioning, tiny typed vocab with coupling-based difficulty, sub-10s iterate loop, silent-success trap) + applied checklist.

## §12 — Refine-13: post-accept verdict marking + rejoin sync

- **Superseded verdicts are marked, not frozen** (coordinator decision): the
  board stays live post-accept, but any later fold flips the banner to
  `superseded-banner` / "Verdict superseded — board changed since accept".
  Client-side marker: revision at accept vs current revision. Probe:
  `scripts/post-accept-probe.ts` (PASS — flag raised on all boards).
- **Rejoin is byte-exact** after the App.tsx mount-remount fix;
  `scripts/reconnect-probe.ts` drops the host mid-plan and asserts the
  rejoined client's rows+orders match the surviving member's.
- **rbm-01 coop fold anomaly: probe-side, resolved.** `pm:` @2 folds back to
  the writer's board correctly (`scripts/rbm01-fold-probe.ts`); the earlier
  observation was navigation timing, not an engine/net defect.
