# Decision log — Return by Midnight
Format: date · class (detail/elaboration/deviation) · requirements · proposer · reviewer · evidence · owner approval when required.
Master SHA-256: 9eafb3af47415a2015a9d0842271a6524f6aca2536ab714721c79438b135eea7

----
## 2026-10-08 · deviation · owner concept-rework decision 2026-10-08

Owner rejected the delivered property-loan scheduling game and reworked the concept.
This entry supersedes the master handoff's locked-identity clauses for RBM
(twelve RBM-01…RBM-12 levels, cell/edge model, LevelCards, wrongApproach
verification) until the handoff is re-cut.

New concept: simultaneous-turn heist tactics in a toy museum. Each turn every
crew member plans a path of up to 3 tiles plus an optional property loan
(HEAVY/BRIGHT/NOISY lent from its home object to another object). Guards
telegraph their next move; everything resolves at once; loans snap home after
N turns. The heist fails if a crew member is seen, if midnight arrives, or if
a loan is not home when the heist ends.

Rules of record: docs/HEIST-RULES.md · types: src/engine/heist/types.ts ·
levels: src/content/heist/levels.ts (L1–L3, 2 crew, authored SOLUTIONS).

Retired (kept in git history): src/engine/rbm, src/content/levels +
level-cards, src/server/rbm-adapter, all rbm/property/campaign/depth/lib/
performance/e2e tests, and the old tooling (card-vs-engine, enumerate-manifests,
browser-playtest probes, undo-soak, hints). Server keeps gameType "rbm" with
rulesVersion "heist-1" and adds adapter hooks redactPayload/publicSnapshot so
locked plan contents are never leaked to other seats.
