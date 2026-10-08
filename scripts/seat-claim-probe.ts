// Seat-claim probe (AUTOMATED): two clients in one room, both write DIFFERENT
// orders to the same (beat, crew) command slot. Documents the actual conflict
// rule — engine review says command.queue validates shape only and folds in
// revision order (last write wins); this proves it live on the real client.
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const LEVEL = "rbm-11";
const SLOT = 'cmd-3-crew-helper'; // same beat+crew on both boards
const OPT_A = "move:cell-west";
const OPT_B = "wait"; // always offered; a genuinely different order than OPT_A

async function pickLevelThenLobby(page: Page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-testid="play-solo"]');
  await page.click(`[data-testid="level-${LEVEL}"]`);
  await page.waitForSelector('[data-testid="scene"]');
  await page.click('button:has-text("Rooms")');
  await page.click('button.ghost:has-text("Back")');
  await page.click('[data-testid="play-coop"]');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const p1 = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  await Promise.all([pickLevelThenLobby(p1), pickLevelThenLobby(p2)]);
  await p1.click('button:has-text("Host a room")');
  const code = ((await p1.locator(".badge").textContent()) ?? "").match(/Crew (\w+)/)?.[1];
  console.log(`room ${code}`);
  await p2.fill('input[placeholder="Room code"]', code!);
  await p2.click('button:has-text("Join")');
  await p2.waitForSelector(`[data-testid="${SLOT}"]`, { timeout: 8000 });
  await p1.waitForSelector(`[data-testid="${SLOT}"]`, { timeout: 8000 });

  // P1 writes option A; let it fold, then P2 writes option B over the same slot.
  await p1.selectOption(`[data-testid="${SLOT}"]`, OPT_A);
  await p1.waitForTimeout(400);
  const p2SeesA = await p2.locator(`[data-testid="${SLOT}"]`).inputValue();
  console.log(`after P1 write ${OPT_A}: P2 board shows "${p2SeesA}"`);
  const opts = await p2.locator(`[data-testid="${SLOT}"] option`).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  console.log(`P2 slot options: ${JSON.stringify(opts)}`);
  const choice = opts.includes(OPT_B) ? OPT_B : opts.find((v) => v && v !== OPT_A);
  console.log(`P2 conflicting write: ${choice}`);
  await p2.selectOption(`[data-testid="${SLOT}"]`, choice!);
  await p2.waitForTimeout(400);
  const [v1, v2] = await Promise.all([
    p1.locator(`[data-testid="${SLOT}"]`).inputValue(),
    p2.locator(`[data-testid="${SLOT}"]`).inputValue(),
  ]);
  console.log(`after P2 write ${choice}: P1="${v1}" P2="${v2}"`);
  console.log(v1 === choice && v2 === choice
    ? "RULE: last-write-wins — both boards converge to the latest order; no seat claim or conflict reject"
    : `RULE: UNEXPECTED divergence/reject — P1=${v1} P2=${v2}`);
  await p1.screenshot({ path: "/tmp/seatclaim-p1.png", fullPage: true });
  await p2.screenshot({ path: "/tmp/seatclaim-p2.png", fullPage: true });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
