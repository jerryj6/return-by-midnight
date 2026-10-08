// Scripted 2-PLAYER CO-OP playtest against the live dist+ws server
// (AUTOMATED playtest): two independent chromium contexts join one room —
// host creates via "Host a room", guest joins by the rendered room code —
// commands are split ACROSS clients (host drives helper+runner, guest drives
// scout+operator) and manifest rows likewise, then host runs test.run and
// accepts. Asserts lockstep convergence (both boards show the same rows,
// the same per-beat orders, the same verdict) and 4-of-4 crew commanded.
//
//   npm run build && npm run dev:server   (dist + ws on :8787)
//   npx tsx scripts/browser-playtest-coop.ts
import { chromium, type Page, type BrowserContext } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const LEVEL = process.argv.find((a) => a.startsWith("--level="))?.split("=")[1] ?? "rbm-11";

// Committed winning plans, split across the two clients by crew ownership.
const PLANS: Record<string, {
  hostRows: { token: string; to: string; start: number; due: number | null }[];
  guestRows: { token: string; to: string; start: number; due: number | null }[];
  hostCmds: { beat: number; crew: string; slug: string }[];
  guestCmds: { beat: number; crew: string; slug: string }[];
}> = {
  "rbm-11": {
    hostRows: [
      { token: "TOKEN-H", to: "prop-scale-w", start: 2, due: 5 },
      { token: "TOKEN-N", to: "prop-chime-e", start: 2, due: 5 },
    ],
    guestRows: [
      { token: "TOKEN-N", to: "prop-chime-w", start: 6, due: 8 },
      { token: "TOKEN-H", to: "prop-scale-e", start: 6, due: 8 },
    ],
    hostCmds: [
      { beat: 3, crew: "crew-helper", slug: "move:cell-west" },
      { beat: 3, crew: "crew-runner", slug: "move:cell-east" },
      { beat: 4, crew: "crew-helper", slug: "pm:prop-idol-w:cell-westend" },
      { beat: 4, crew: "crew-runner", slug: "pm:prop-idol-e:cell-eastend" },
      { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
      { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
    ],
    guestCmds: [
      { beat: 4, crew: "crew-scout", slug: "move:cell-west" },
      { beat: 4, crew: "crew-operator", slug: "move:cell-east" },
      { beat: 5, crew: "crew-scout", slug: "move:cell-westend" },
      { beat: 5, crew: "crew-operator", slug: "move:cell-eastend" },
      { beat: 7, crew: "crew-scout", slug: "pm:prop-scroll-w:pad-out" },
      { beat: 7, crew: "crew-operator", slug: "pm:prop-scroll-e:pad-out" },
    ],
  },
  "rbm-12": {
    hostRows: [
      { token: "TOKEN-H", to: "prop-scale-h", start: 2, due: 4 },
    ],
    guestRows: [
      { token: "TOKEN-B", to: "prop-stand-v", start: 2, due: 5 },
      { token: "TOKEN-N", to: "prop-chime-ex", start: 5, due: 8 },
    ],
    hostCmds: [
      { beat: 3, crew: "crew-helper", slug: "move:cell-hall" },
      { beat: 3, crew: "crew-runner", slug: "move:cell-hall" },
      { beat: 4, crew: "crew-helper", slug: "pickup:prop-relic" },
      { beat: 4, crew: "crew-runner", slug: "pickup:prop-crown" },
      { beat: 5, crew: "crew-helper", slug: "move:cell-exit" },
      { beat: 5, crew: "crew-runner", slug: "move:cell-exit" },
      { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
      { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
    ],
    guestCmds: [
      { beat: 3, crew: "crew-scout", slug: "move:cell-hall" },
      { beat: 3, crew: "crew-operator", slug: "move:cell-hall" },
      { beat: 4, crew: "crew-scout", slug: "move:cell-vault" },
      { beat: 4, crew: "crew-operator", slug: "move:cell-vault" },
      { beat: 5, crew: "crew-scout", slug: "pm:prop-jewel:cell-hall" },
      { beat: 5, crew: "crew-operator", slug: "pm:prop-map:cell-hall" },
      { beat: 6, crew: "crew-scout", slug: "move:cell-exit" },
      { beat: 6, crew: "crew-operator", slug: "move:cell-exit" },
      { beat: 7, crew: "crew-scout", slug: "move:pad-out" },
      { beat: 7, crew: "crew-operator", slug: "move:pad-out" },
    ],
  },
};
const plan = PLANS[LEVEL];
if (!plan) throw new Error(`no coop plan table for ${LEVEL}`);
const HOST_ROWS = plan.hostRows;
const GUEST_ROWS = plan.guestRows;
const HOST_CMDS = plan.hostCmds;
const GUEST_CMDS = plan.guestCmds;
const ALL_CMDS = [...HOST_CMDS, ...GUEST_CMDS];
const ROW_TOTAL = HOST_ROWS.length + GUEST_ROWS.length;

async function pickLevelThenLobby(page: Page, role: "host" | "join") {
  // Set the app's level context to rbm-11 via the solo select screen, exit,
  // then enter the co-op lobby (the lobby hosts whatever level was picked).
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-testid="play-solo"]');
  await page.click(`[data-testid="level-${LEVEL}"]`);
  await page.waitForSelector('[data-testid="scene"]');
  // "Rooms" exits the session to the select screen; the ghost "Back" exits to
  // title (plain has-text("Back") would match level cards like "Lights Out, Lights Back").
  await page.click('button:has-text("Rooms")');
  await page.click('button.ghost:has-text("Back")');
  await page.click('[data-testid="play-coop"]');
  if (role === "host") {
    const btn = page.locator('button:has-text("Host a room")');
    const label = await btn.textContent();
    if (!label?.includes(LEVEL.toUpperCase())) throw new Error(`host would create wrong level: ${label}`);
    await btn.click();
  }
}

async function commitRows(page: Page, rows: { token: string; to: string; start: number; due: number | null }[]) {
  for (const r of rows) {
    await page.selectOption('[data-testid="loan-token"]', r.token);
    await page.selectOption('[data-testid="loan-to"]', r.to);
    await page.selectOption('[data-testid="loan-start"]', String(r.start));
    await page.selectOption('[data-testid="loan-due"]', r.due === null ? "never" : String(r.due));
    await page.click('[data-testid="commit-row"]');
    await page.waitForTimeout(80);
  }
}

async function queueCommands(page: Page, cmds: { beat: number; crew: string; slug: string }[]) {
  for (const c of [...cmds].sort((a, b) => a.beat - b.beat)) {
    await page.selectOption(`[data-testid="cmd-${c.beat}-${c.crew}"]`, c.slug);
    await page.waitForTimeout(60);
  }
}

async function boardSnapshot(page: Page) {
  // Everything another planner would observe: committed rows + each queued order.
  const rows = await page.locator('[data-testid^="row-"]').count();
  const orders: Record<string, string> = {};
  for (const c of ALL_CMDS) {
    orders[`${c.beat}-${c.crew}`] =
      (await page.locator(`[data-testid="cmd-${c.beat}-${c.crew}"]`).inputValue().catch(() => "MISSING"));
  }
  return { rows, orders };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctxA: BrowserContext = await browser.newContext();
  const ctxB: BrowserContext = await browser.newContext();
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();
  const results: string[] = [];

  // --- HOST creates a room for rbm-11; GUEST joins by the rendered code.
  await pickLevelThenLobby(host, "host");
  const badge = await host.locator(".badge").textContent({ timeout: 8000 }).catch(() => null);
  const code = badge?.match(/Crew\s+(\w+)/)?.[1];
  if (!code) throw new Error(`host room code not rendered (badge=${badge})`);
  results.push(`host created room ${code}`);

  await pickLevelThenLobby(guest, "join");
  await guest.fill('input[placeholder="Room code"]', code);
  await guest.click('button:has-text("Join")');
  await guest.waitForSelector('[data-testid="scene"]', { timeout: 8000 });
  const gBadge = await guest.locator(".badge").textContent().catch(() => null);
  results.push(`guest joined room ${gBadge}`);

  // --- Both planners act; rows split across clients.
  await commitRows(host, HOST_ROWS);
  await commitRows(guest, GUEST_ROWS);
  await host.waitForTimeout(400); // fold window
  const snapH1 = await boardSnapshot(host);
  const snapG1 = await boardSnapshot(guest);
  if (snapH1.rows !== ROW_TOTAL || snapG1.rows !== ROW_TOTAL)
    results.push(`row replication WRONG: host sees ${snapH1.rows}, guest sees ${snapG1.rows} (expect ${ROW_TOTAL}/${ROW_TOTAL})`);
  else results.push(`rows replicate: ${ROW_TOTAL} on both boards`);

  // --- Orders split by crew ownership across the two clients.
  await queueCommands(host, HOST_CMDS);
  await queueCommands(guest, GUEST_CMDS);
  await host.waitForTimeout(500);
  const snapH2 = await boardSnapshot(host);
  const snapG2 = await boardSnapshot(guest);
  const mismatch: string[] = [];
  for (const c of ALL_CMDS) {
    const k = `${c.beat}-${c.crew}`;
    if (snapH2.orders[k] !== c.slug) mismatch.push(`host ${k}=${snapH2.orders[k]} want ${c.slug}`);
    if (snapG2.orders[k] !== c.slug) mismatch.push(`guest ${k}=${snapG2.orders[k]} want ${c.slug}`);
  }
  results.push(mismatch.length ? `order convergence WRONG:\n  ${mismatch.join("\n  ")}` : `orders converge: ${ALL_CMDS.length} orders identical on both boards`);

  // --- 4-of-4 crew commanded check (coopNote promise, via the UI).
  const crewsCommanded = new Set(ALL_CMDS.filter((c) => snapG2.orders[`${c.beat}-${c.crew}`] === c.slug).map((c) => c.crew));
  results.push(`crew commanded: ${crewsCommanded.size}/4 (${[...crewsCommanded].join(",")})`);

  // --- Host runs test.run; BOTH must see the success verdict.
  await host.click('[data-testid="test-run"]');
  await host.waitForSelector('[data-testid="verdict"]', { timeout: 15000 });
  await guest.waitForSelector('[data-testid="verdict"]', { timeout: 15000 }).catch(() => null);
  const vH = await host.getAttribute('[data-testid="verdict"]', "class");
  const gHasVerdict = await guest.$('[data-testid="verdict"]');
  const vG = gHasVerdict ? await guest.getAttribute('[data-testid="verdict"]', "class") : "absent";
  results.push(`verdict: host=${vH} guest=${vG}`);
  await host.screenshot({ path: `/tmp/coop-${LEVEL}-host-verdict.png`, fullPage: true });
  await guest.screenshot({ path: `/tmp/coop-${LEVEL}-guest-verdict.png`, fullPage: true });

  // --- Host accepts; BOTH must see the accepted banner.
  if (vH?.includes("success")) {
    await host.click('[data-testid="accept-result"]');
    const bH = await host.waitForSelector('[data-testid="accepted-banner"]', { timeout: 8000 }).catch(() => null);
    const bG = await guest.waitForSelector('[data-testid="accepted-banner"]', { timeout: 8000 }).catch(() => null);
    results.push(`accept: host banner=${!!bH} guest banner=${!!bG}`);
    await host.screenshot({ path: `/tmp/coop-${LEVEL}-host-accepted.png`, fullPage: true });
    await guest.screenshot({ path: `/tmp/coop-${LEVEL}-guest-accepted.png`, fullPage: true });
  }

  await browser.close();
  console.log("\n" + results.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
