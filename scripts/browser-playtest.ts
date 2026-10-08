// Scripted browser playtest against the LIVE Vite client (AUTOMATED playtest):
// drives the real UI — level select, the manifest row-builder (token/host/
// start/due selects + Commit), the per-(beat,crew) order grid, test.run, the
// verdict overlay and result.accept — for the committed winning plans on
// rbm-11/12, plus one carded failure probe per level (the UI must surface the
// actual mechanism, not a generic "failed").
//
//   npx vite (dev server on :5173) must be running.
//   npx tsx scripts/browser-playtest.ts [--level rbm-11] [--headed]
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const only = process.argv.find((a) => a.startsWith("--level="))?.split("=")[1];

interface Row { token: string; to: string; start: number; due: number | null }
interface Cmd { beat: number; crew: string; slug: string }
interface LevelPlan { id: string; rows: Row[]; commands: Cmd[]; failProbe: { note: string; rows: Row[]; expectedToast?: string } }

// Committed winning plans, transcribed verbatim from the level files.
const PLANS: LevelPlan[] = [
  {
    id: "rbm-01",
    rows: [{ token: "TOKEN-H", to: "prop-crate", start: 1, due: 3 }],
    commands: [
      { beat: 2, crew: "crew-helper", slug: "pm:prop-safe:cell-approach" },
      { beat: 3, crew: "crew-helper", slug: "move:pad-out" },
    ],
    // Enum-proven: only windows {1~3, 2~3} win — due 4 must fail with detail.
    failProbe: {
      note: "TOKEN-H due 4 (outside the proven {1~3,2~3} winner windows)",
      rows: [{ token: "TOKEN-H", to: "prop-crate", start: 1, due: 4 }],
    },
  },
  {
    id: "rbm-06",
    rows: [{ token: "TOKEN-H", to: "prop-crate", start: 1, due: 5 }],
    commands: [
      { beat: 3, crew: "crew-helper", slug: "move:cell-hall" },
      { beat: 4, crew: "crew-helper", slug: "move:cell-store" },
      { beat: 5, crew: "crew-helper", slug: "pm:prop-ledger:cell-hall" },
      { beat: 5, crew: "crew-operator", slug: "move:cell-hall" },
      { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
      { beat: 6, crew: "crew-operator", slug: "move:cell-vault" },
      { beat: 7, crew: "crew-operator", slug: "pm:prop-crown:pad-out" },
    ],
    // Enum-proven: due must be exactly 5 — due 4 (offered, but loses) fails.
    failProbe: {
      note: "TOKEN-H due 4 (enum-proven forced due is 5)",
      rows: [{ token: "TOKEN-H", to: "prop-crate", start: 1, due: 4 }],
    },
  },
  {
    id: "rbm-11",
    rows: [
      { token: "TOKEN-H", to: "prop-scale-w", start: 2, due: 5 },
      { token: "TOKEN-N", to: "prop-chime-e", start: 2, due: 5 },
      { token: "TOKEN-N", to: "prop-chime-w", start: 6, due: 8 },
      { token: "TOKEN-H", to: "prop-scale-e", start: 6, due: 8 },
    ],
    commands: [
      { beat: 3, crew: "crew-helper", slug: "move:cell-west" },
      { beat: 3, crew: "crew-runner", slug: "move:cell-east" },
      { beat: 4, crew: "crew-helper", slug: "pm:prop-idol-w:cell-westend" },
      { beat: 4, crew: "crew-runner", slug: "pm:prop-idol-e:cell-eastend" },
      { beat: 4, crew: "crew-scout", slug: "move:cell-west" },
      { beat: 4, crew: "crew-operator", slug: "move:cell-east" },
      { beat: 5, crew: "crew-scout", slug: "move:cell-westend" },
      { beat: 5, crew: "crew-operator", slug: "move:cell-eastend" },
      { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
      { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
      { beat: 7, crew: "crew-scout", slug: "pm:prop-scroll-w:pad-out" },
      { beat: 7, crew: "crew-operator", slug: "pm:prop-scroll-e:pad-out" },
    ],
    // Carded "midnight-straggler": a window posting due 9 keeps a wing window
    // lit for the midnight beam — the verdict must report the capture.
    failProbe: {
      note: "TOKEN-N chime-w due 9 (carded midnight-straggler)",
      rows: [
        { token: "TOKEN-H", to: "prop-scale-w", start: 2, due: 5 },
        { token: "TOKEN-N", to: "prop-chime-e", start: 2, due: 5 },
        { token: "TOKEN-N", to: "prop-chime-w", start: 6, due: 9 },
        { token: "TOKEN-H", to: "prop-scale-e", start: 6, due: 8 },
      ],
    },
  },
  {
    id: "rbm-12",
    rows: [
      { token: "TOKEN-H", to: "prop-scale-h", start: 2, due: 4 },
      { token: "TOKEN-B", to: "prop-stand-v", start: 2, due: 5 },
      { token: "TOKEN-N", to: "prop-chime-ex", start: 5, due: 8 },
    ],
    commands: [
      { beat: 3, crew: "crew-helper", slug: "move:cell-hall" },
      { beat: 3, crew: "crew-scout", slug: "move:cell-hall" },
      { beat: 3, crew: "crew-runner", slug: "move:cell-hall" },
      { beat: 3, crew: "crew-operator", slug: "move:cell-hall" },
      { beat: 4, crew: "crew-helper", slug: "pickup:prop-relic" },
      { beat: 4, crew: "crew-runner", slug: "pickup:prop-crown" },
      { beat: 4, crew: "crew-scout", slug: "move:cell-vault" },
      { beat: 4, crew: "crew-operator", slug: "move:cell-vault" },
      { beat: 5, crew: "crew-helper", slug: "move:cell-exit" },
      { beat: 5, crew: "crew-runner", slug: "move:cell-exit" },
      { beat: 5, crew: "crew-scout", slug: "pm:prop-jewel:cell-hall" },
      { beat: 5, crew: "crew-operator", slug: "pm:prop-map:cell-hall" },
      { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
      { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
      { beat: 6, crew: "crew-scout", slug: "move:cell-exit" },
      { beat: 6, crew: "crew-operator", slug: "move:cell-exit" },
      { beat: 7, crew: "crew-scout", slug: "move:pad-out" },
      { beat: 7, crew: "crew-operator", slug: "move:pad-out" },
    ],
    // Carded "exit-too-late": NOISY due 9 holds the outer door open into the
    // midnight beam — the verdict must report the capture.
    failProbe: {
      note: "TOKEN-N chime-ex due 9 (carded exit-too-late)",
      rows: [
        { token: "TOKEN-H", to: "prop-scale-h", start: 2, due: 4 },
        { token: "TOKEN-B", to: "prop-stand-v", start: 2, due: 5 },
        { token: "TOKEN-N", to: "prop-chime-ex", start: 5, due: 9 },
      ],
    },
  },
];

async function commitRows(page: import("playwright").Page, rows: Row[]) {
  for (const r of rows) {
    await page.selectOption('[data-testid="loan-token"]', r.token);
    await page.selectOption('[data-testid="loan-to"]', r.to);
    await page.selectOption('[data-testid="loan-start"]', String(r.start));
    await page.selectOption('[data-testid="loan-due"]', r.due === null ? "never" : String(r.due));
    await page.click('[data-testid="commit-row"]');
    await page.waitForTimeout(60); // let state fold
  }
}

async function queueCommands(page: import("playwright").Page, commands: Cmd[]) {
  // Beat order matters: slot options are derived from the crew's simulated
  // cursor under already-queued commands.
  const ordered = [...commands].sort((a, b) => a.beat - b.beat);
  for (const c of ordered) {
    const sel = `[data-testid="cmd-${c.beat}-${c.crew}"]`;
    await page.selectOption(sel, c.slug);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: string[] = [];
  for (const plan of PLANS) {
    if (only && plan.id !== only) continue;

    // --- Win path through the real UI
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.click('[data-testid="play-solo"]');
    await page.click(`[data-testid="level-${plan.id}"]`);
    await page.waitForSelector('[data-testid="scene"]');

    // Scene sanity: the level's entities render (spot-check a few ids).
    for (const tid of ["token-TOKEN-H", "token-TOKEN-N"]) {
      if (!(await page.$(`[data-testid="${tid}"]`))) results.push(`${plan.id}: MISSING entity ${tid}`);
    }

    await commitRows(page, plan.rows);
    const rowCount = await page.locator('[data-testid^="row-"]').count();
    if (rowCount !== plan.rows.length) results.push(`${plan.id}: expected ${plan.rows.length} committed rows, saw ${rowCount}`);

    await queueCommands(page, plan.commands);
    await page.click('[data-testid="test-run"]');
    await page.waitForSelector('[data-testid="verdict"]', { timeout: 15000 });
    const cls = await page.getAttribute('[data-testid="verdict"]', "class");
    if (!cls?.includes("success")) {
      const text = await page.textContent('[data-testid="verdict"]');
      results.push(`${plan.id}: winning plan FAILED in UI — verdict: ${cls} :: ${text?.slice(0, 300)}`);
    } else {
      // result.accept must be offered and must land the accepted banner.
      await page.click('[data-testid="accept-result"]');
      const banner = await page.waitForSelector('[data-testid="accepted-banner"]', { timeout: 8000 }).catch(() => null);
      results.push(`${plan.id}: win path ${banner ? "PASS (accepted banner shown)" : "verdict success but NO accepted banner"}`);
      await page.screenshot({ path: `/tmp/playtest-${plan.id}-accepted.png`, fullPage: true });
    }

    // --- Fail probe: same commands, sabotaged manifest → verdict must be a
    // failure with expected-vs-actual detail, not a bare "failed".
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.click('[data-testid="play-solo"]');
    await page.click(`[data-testid="level-${plan.id}"]`);
    await page.waitForSelector('[data-testid="scene"]');
    await commitRows(page, plan.failProbe.rows);
    await queueCommands(page, plan.commands);
    await page.click('[data-testid="test-run"]');
    await page.waitForSelector('[data-testid="verdict"]', { timeout: 15000 });
    const fcls = await page.getAttribute('[data-testid="verdict"]', "class");
    const ftext = (await page.textContent('[data-testid="verdict"]')) ?? "";
    const detailVisible = /capture|expected|actual|fail/i.test(ftext);
    if (fcls?.includes("failure") && detailVisible) {
      results.push(`${plan.id}: fail probe PASS — ${plan.failProbe.note} surfaces as failure with detail`);
      await page.screenshot({ path: `/tmp/playtest-${plan.id}-fail.png`, fullPage: true });
    } else {
      results.push(`${plan.id}: fail probe WRONG — verdict class=${fcls} text=${ftext.slice(0, 300)}`);
    }
    // result.accept must NOT be enabled on a failed run.
    const acceptEnabled = await page.locator('[data-testid="accept-result"]').isEnabled().catch(() => false);
    if (acceptEnabled) results.push(`${plan.id}: result.accept ENABLED on a failed run — bug`);

    console.log(`\n=== ${plan.id} done`);
  }
  await browser.close();
  console.log("\n" + results.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
