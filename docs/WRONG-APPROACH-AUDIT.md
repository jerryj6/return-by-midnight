# Wrong-approach fail-reason audit — all 12 levels (AUTOMATED, refine-9)

Every carded `wrongApproach` was executed through `validateRows`/`simulate`
and the carded `expectedFailure` text was checked against the *observed*
mechanism (REQUIRED keyword map in `scripts/card-vs-engine.ts`). Result:
**61/61 approaches produce a concrete mechanism matching the asserted
reason — 0 inexpressible, 0 drift.**

## Mechanism distribution per level

| Level | Probed approaches → observed mechanisms |
|---|---|
| RBM-01 | (no card — see conventions §1 exemption) |
| RBM-02 | fails:capture ×1, fails:plan-complete ×1, fails:tokenHome ×1, rejects:overlapping-loan ×1, **succeeds ×1** (early-return — TOLERATED, carded as such) |
| RBM-03 | fails:capture ×1, fails:gate-closed ×1, fails:outcome ×1, fails:tokenHome ×1, rejects:overlapping-loan ×1 |
| RBM-04 | fails:outcome ×3, fails:tokenHome ×1, rejects:manifest-over-budget ×1, rejects:overlapping-loan ×1 |
| RBM-05 | fails:capture ×1, fails:gate-closed ×1, fails:outcome ×1, rejects:overlapping-loan ×2 |
| RBM-06 | fails:capture ×1, fails:gate-closed ×1, fails:outcome ×1, rejects:loan-to-own-home ×1, rejects:manifest-over-budget ×1 |
| RBM-07 | fails:capture ×1, fails:gate-closed ×2, fails:plan-complete ×1, rejects:manifest-over-budget ×1, rejects:overlapping-loan ×1 |
| RBM-08 | fails:capture ×1, fails:gate-closed ×3, rejects:manifest-over-budget ×1 |
| RBM-09 | fails:capture ×1, fails:gate-closed ×1, fails:outcome ×1, fails:tokenHome ×1, rejects:overlapping-loan ×1 |
| RBM-10 | fails:capture ×1, fails:gate-closed ×2, rejects:incompatible-host ×1, rejects:manifest-over-budget ×1 |
| RBM-11 | fails:capture ×2, fails:gate-closed ×2, rejects:incompatible-host ×1, rejects:manifest-over-budget ×1, rejects:overlapping-loan ×1 |
| RBM-12 | fails:capture ×3, fails:gate-closed ×2, fails:plan-complete ×1, rejects:manifest-over-budget ×1 |

(Totals: fails:capture 13, fails:gate-closed 15, fails:outcome 7,
fails:plan-complete 3, fails:tokenHome 4, rejects:overlapping-loan 8,
rejects:manifest-over-budget 7, rejects:incompatible-host 2,
rejects:loan-to-own-home 1, succeeds 1 = **61**.)

## Inexpressibility check

- No probe returned `inconclusive` or `rejects:committed-all` — every carded
  approach resolves to one of the eleven mechanism slugs above.
- The two mechanism classes not yet exercised by any carded approach:
  `rejects:start-beat-out-of-range` and `rejects:due-beat-not-offered` /
  `rejects:due-before-start` / `rejects:duplicate-row-id` — manifest-shape
  rejections no card teaches. Not defects; noted for coverage parity.
- Coverage rule (refine-3+) stands: a probe that can't produce a mechanism
  surfaces as a NOTE line, and `succeeds` is only legal when the card says
  TOLERATED — both are hard checks in `check:content`.
