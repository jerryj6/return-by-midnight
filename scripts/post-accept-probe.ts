// Post-validation overwrite probe (AUTOMATED): after an accepted verdict, can
// a late client write silently mutate the board? Runs the proven rbm-11 2P
// plan, accepts, then P2 overwrites a slot — records what each board shows.
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const LEVEL = "rbm-11";

const ROWS_P1 = [
  { token: "TOKEN-H", to: "prop-scale-w", start: 2, due: 5 },
  { token: "TOKEN-N", to: "prop-chime-e", start: 2, due: 5 },
];
const ROWS_P2 = [
  { token: "TOKEN-N", to: "prop-chime-w", start: 6, due: 8 },
  { token: "TOKEN-H", to: "prop-scale-e", start: 6, due: 8 },
];
const CMDS_P1 = [
  { beat: 3, crew: "crew-helper", slug: "move:cell-west" },
  { beat: 3, crew: "crew-runner", slug: "move:cell-east" },
  { beat: 4, crew: "crew-helper", slug: "pm:prop-idol-w:cell-westend" },
  { beat: 4, crew: "crew-runner", slug: "pm:prop-idol-e:cell-eastend" },
  { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
  { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
];
const CMDS_P2 = [
  { beat: 4, crew: "crew-scout", slug: "move:cell-west" },
  { beat: 4, crew: "crew-operator", slug: "move:cell-east" },
  { beat: 5, crew: "crew-scout", slug: "move:cell-westend" },
  { beat: 5, crew: "crew-operator", slug: "move:cell-eastend" },
  { beat: 7, crew: "crew-scout", slug: "pm:prop-scroll-w:pad-out" },
  { beat: 7, crew: "crew-operator", slug: "pm:prop-scroll-e:pad-out" },
];

async function pickLevelThenLobby(page: Page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-testid="play-solo"]');
  await page.click(`[data-testid="level-${LEVEL}"]`);
  await page.waitForSelector('[data-testid="scene"]');
  await page.click('button:has-text("Rooms")');
  await page.click('button.ghost:has-text("Back")');
  await page.click('[data-testid="play-coop"]');
}
async function commitRows(page: Page, rows: typeof ROWS_P1) {
  for (const r of rows) {
    await page.selectOption('[data-testid="loan-token"]', r.token);
    await page.selectOption('[data-testid="loan-to"]', r.to);
    await page.selectOption('[data-testid="loan-start"]', String(r.start));
    await page.selectOption('[data-testid="loan-due"]', String(r.due));
    await page.click('[data-testid="commit-row"]');
    await page.waitForTimeout(80);
  }
}
async function queueCmds(page: Page, cmds: typeof CMDS_P1) {
  for (const c of [...cmds].sort((a, b) => a.beat - b.beat)) {
    await page.selectOption(`[data-testid="cmd-${c.beat}-${c.crew}"]`, c.slug);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const p1 = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  await Promise.all([pickLevelThenLobby(p1), pickLevelThenLobby(p2)]);
  await p1.click('button:has-text("Host a room")');
  const code = ((await p1.locator(".badge").textContent()) ?? "").match(/Crew (\w+)/)?.[1];
  await p2.fill('input[placeholder="Room code"]', code!);
  await p2.click('button:has-text("Join")');
  await p2.waitForSelector('[data-testid="loan-token"]', { timeout: 8000 });

  await commitRows(p1, ROWS_P1);
  await commitRows(p2, ROWS_P2);
  await queueCmds(p1, CMDS_P1);
  await queueCmds(p2, CMDS_P2);
  await p1.click('[data-testid="test-run"]');
  await p1.waitForSelector('[data-testid="verdict"].success', { timeout: 15000 });
  await p1.click('[data-testid="accept-result"]');
  await p1.waitForSelector('[data-testid="accepted-banner"]', { timeout: 8000 });
  await p2.waitForSelector('[data-testid="accepted-banner"]', { timeout: 8000 });
  console.log("accepted banner on both boards");

  // P2 overwrites a command slot post-accept.
  const slot = "cmd-3-crew-helper";
  const opts = await p2.locator(`[data-testid="${slot}"] option`).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  const alt = opts.find((v) => v && v !== "move:cell-west" && v !== "auto" && v !== "clear");
  if (!alt) { console.log("no alternate order offered post-accept — slot locked"); await browser.close(); return; }
  await p2.selectOption(`[data-testid="${slot}"]`, alt);
  await p2.waitForTimeout(600);
  const [v1, v2] = await Promise.all([
    p1.locator(`[data-testid="${slot}"]`).inputValue(),
    p2.locator(`[data-testid="${slot}"]`).inputValue(),
  ]);
  const b1 = await p1.locator('[data-testid="accepted-banner"]').isVisible().catch(() => false);
  const b2 = await p2.locator('[data-testid="accepted-banner"]').isVisible().catch(() => false);
  console.log(`post-accept overwrite → P1 slot="${v1}" P2 slot="${v2}" | banner P1=${b1} P2=${b2}`);
  const s1 = await p1.locator('[data-testid="superseded-banner"]').isVisible().catch(() => false);
  const s2 = await p2.locator('[data-testid="superseded-banner"]').isVisible().catch(() => false);
  console.log(v1 === alt && v2 === alt
    ? `boards converge post-accept; superseded-banner P1=${s1} P2=${s2} — ${s1 && s2 ? "PASS (verdict flagged on all boards)" : "banner still claims stale verdict"}`
    : `unexpected: P1=${v1} P2=${v2}`);
  await p1.screenshot({ path: "/tmp/postaccept-p1.png", fullPage: true });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
