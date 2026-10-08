import { LEVELS, CARDS } from "../src/content/levels/index.js";
import type { LevelCard } from "../src/content/levels/level-card.js";

// Structural content check for RBM manifests + level cards.
// Deep card-vs-engine consistency (wrongApproach replays) lives in
// scripts/card-vs-engine.ts — this file is the fast schema pass.

let fail = false;
const ids = new Set<string>();
const need = ["levelId", "rulesVersion", "title", "cells", "edges", "props",
  "crew", "guards", "tokens", "devices", "loans", "outcomes", "verification"];

for (const l of LEVELS) {
  const d = l.def as unknown as Record<string, unknown>;
  const tag = `${l.id}`;
  for (const k of need) if (!(k in d)) { console.error(`${tag}: missing ${k}`); fail = true; }
  if (ids.has(l.id)) { console.error(`duplicate level id ${l.id}`); fail = true; }
  ids.add(l.id);
  if (d["levelId"] !== undefined && d["levelId"] !== l.id.toLowerCase())
    console.error(`${tag}: manifest.levelId (${d["levelId"]}) != index id — check casing`);
  const outcomes = d["outcomes"] as unknown[];
  if (!Array.isArray(outcomes) || outcomes.length < 1) { console.error(`${tag}: no outcomes`); fail = true; }
  const loans = d["loans"] as Record<string, unknown> | undefined;
  if (loans && typeof loans["maxRows"] === "number" && (loans["maxRows"] as number) < 1) {
    console.error(`${tag}: loans.maxRows < 1`); fail = true;
  }
}

// Cards: every level past the tutorial (RBM-01 is convention-exempt, see
// docs/LEVEL-CARD-CONVENTIONS.md) must ship a card with a trace and at least
// one designed counterexample.
for (const l of LEVELS) {
  const card = CARDS[l.id] as LevelCard | undefined;
  if (l.id === "RBM-01") continue;
  if (!card) { console.error(`${l.id}: no LevelCard (post-tutorial levels require one)`); fail = true; continue; }
  if (card.levelId !== l.id.toLowerCase()) { console.error(`${l.id}: card.levelId mismatch (${card.levelId})`); fail = true; }
  if (!Array.isArray(card.winningTraceSummary) || card.winningTraceSummary.length < 1) {
    console.error(`${l.id}: card has no winningTraceSummary`); fail = true;
  }
  if (!Array.isArray(card.wrongApproaches) || card.wrongApproaches.length < 1) {
    console.error(`${l.id}: card has no wrongApproaches`); fail = true;
  }
  for (const wa of card.wrongApproaches ?? []) {
    if (!wa.name || !wa.summary || !wa.expectedFailure) {
      console.error(`${l.id}/${wa.name ?? "?"}: wrongApproach missing name/summary/expectedFailure`); fail = true;
    }
  }
}

const n = (LEVELS as readonly { id: string }[]).length;
console.log(`content: ${n}/12 main levels authored, ${Object.keys(CARDS).length} cards`);
if (n > 12) { console.error("more than 12 main levels — mastery must be separate"); fail = true; }
process.exit(fail ? 1 : 0);
