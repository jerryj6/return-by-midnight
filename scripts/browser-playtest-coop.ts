// Scripted N-PLAYER CO-OP playtest against the live dist+ws server
// (AUTOMATED playtest): N independent chromium contexts join one room —
// host creates via "Host a room", each guest joins by the rendered room
// code — manifest rows and orders are split ACROSS clients, then the host
// runs test.run and accepts. Asserts lockstep convergence on EVERY board
// (same rows, same per-beat orders, same verdict) and 4-of-4 crew commanded.
//
//   npm run build && npm run dev:server   (dist + ws on :8787)
//   npx tsx scripts/browser-playtest-coop.ts [--level=rbm-12]
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const LEVEL = process.argv.find((a) => a.startsWith("--level="))?.split("=")[1] ?? "rbm-11";

type Row = { token: string; to: string; start: number; due: number | null };
type Cmd = { beat: number; crew: string; slug: string };
interface PlayerShare { rows: Row[]; cmds: Cmd[] }

// Committed winning plans, sharded across players (player 0 = host).
const PLANS: Record<string, PlayerShare[]> = {
  "rbm-11": [
    {
      rows: [
        { token: "TOKEN-H", to: "prop-scale-w", start: 2, due: 5 },
        { token: "TOKEN-N", to: "prop-chime-e", start: 2, due: 5 },
      ],
      cmds: [
        { beat: 3, crew: "crew-helper", slug: "move:cell-west" },
        { beat: 3, crew: "crew-runner", slug: "move:cell-east" },
        { beat: 4, crew: "crew-helper", slug: "pm:prop-idol-w:cell-westend" },
        { beat: 4, crew: "crew-runner", slug: "pm:prop-idol-e:cell-eastend" },
        { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
        { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
      ],
    },
    {
      rows: [
        { token: "TOKEN-N", to: "prop-chime-w", start: 6, due: 8 },
        { token: "TOKEN-H", to: "prop-scale-e", start: 6, due: 8 },
      ],
      cmds: [
        { beat: 4, crew: "crew-scout", slug: "move:cell-west" },
        { beat: 4, crew: "crew-operator", slug: "move:cell-east" },
        { beat: 5, crew: "crew-scout", slug: "move:cell-westend" },
        { beat: 5, crew: "crew-operator", slug: "move:cell-eastend" },
        { beat: 7, crew: "crew-scout", slug: "pm:prop-scroll-w:pad-out" },
        { beat: 7, crew: "crew-operator", slug: "pm:prop-scroll-e:pad-out" },
      ],
    },
  ],
  // rbm-12 is the 4-role-meaningful claim — played here at THREE live seats:
  // manifest shard 1/1/1, command shards helper / scout / runner+operator.
  "rbm-12": [
    {
      rows: [{ token: "TOKEN-H", to: "prop-scale-h", start: 2, due: 4 }],
      cmds: [
        { beat: 3, crew: "crew-helper", slug: "move:cell-hall" },
        { beat: 4, crew: "crew-helper", slug: "pickup:prop-relic" },
        { beat: 5, crew: "crew-helper", slug: "move:cell-exit" },
        { beat: 6, crew: "crew-helper", slug: "move:pad-out" },
      ],
    },
    {
      rows: [{ token: "TOKEN-B", to: "prop-stand-v", start: 2, due: 5 }],
      cmds: [
        { beat: 3, crew: "crew-scout", slug: "move:cell-hall" },
        { beat: 4, crew: "crew-scout", slug: "move:cell-vault" },
        { beat: 5, crew: "crew-scout", slug: "pm:prop-jewel:cell-hall" },
        { beat: 6, crew: "crew-scout", slug: "move:cell-exit" },
        { beat: 7, crew: "crew-scout", slug: "move:pad-out" },
      ],
    },
    {
      rows: [{ token: "TOKEN-N", to: "prop-chime-ex", start: 5, due: 8 }],
      cmds: [
        { beat: 3, crew: "crew-runner", slug: "move:cell-hall" },
        { beat: 3, crew: "crew-operator", slug: "move:cell-hall" },
        { beat: 4, crew: "crew-runner", slug: "pickup:prop-crown" },
        { beat: 4, crew: "crew-operator", slug: "move:cell-vault" },
        { beat: 5, crew: "crew-runner", slug: "move:cell-exit" },
        { beat: 5, crew: "crew-operator", slug: "pm:prop-map:cell-hall" },
        { beat: 6, crew: "crew-runner", slug: "move:pad-out" },
        { beat: 6, crew: "crew-operator", slug: "move:cell-exit" },
        { beat: 7, crew: "crew-operator", slug: "move:pad-out" },
      ],
    },
  ],
};

// `!` + explicit check: readable error for unknown --level values; TS can't
// carry narrowing into main() otherwise.
const shares: PlayerShare[] = PLANS[LEVEL]!;
if (!shares) throw new Error(`no coop plan table for ${LEVEL}`);
const ALL_CMDS = shares.flatMap((s) => s.cmds);
const ROW_TOTAL = shares.reduce((n, s) => n + s.rows.length, 0);

async function pickLevelThenLobby(page: Page, role: "host" | "join") {
  // Set the app's level context via the solo select screen, exit, then lobby.
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-testid="play-solo"]');
  await page.click(`[data-testid="level-${LEVEL}"]`);
  await page.waitForSelector('[data-testid="scene"]');
  // "Rooms" exits to select; the ghost "Back" exits to title (plain
  // has-text("Back") matches level cards like "Lights Out, Lights Back").
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

async function commitRows(page: Page, rows: Row[]) {
  for (const r of rows) {
    await page.selectOption('[data-testid="loan-token"]', r.token);
    await page.selectOption('[data-testid="loan-to"]', r.to);
    await page.selectOption('[data-testid="loan-start"]', String(r.start));
    await page.selectOption('[data-testid="loan-due"]', r.due === null ? "never" : String(r.due));
    await page.click('[data-testid="commit-row"]');
    await page.waitForTimeout(80);
  }
}

async function queueCommands(page: Page, cmds: Cmd[]) {
  for (const c of [...cmds].sort((a, b) => a.beat - b.beat)) {
    await page.selectOption(`[data-testid="cmd-${c.beat}-${c.crew}"]`, c.slug);
    await page.waitForTimeout(60);
  }
}

async function boardSnapshot(page: Page) {
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
  const pages: Page[] = [];
  for (let i = 0; i < shares.length; i++) pages.push(await (await browser.newContext()).newPage());
  const results: string[] = [];
  const tag = (i: number) => `P${i + 1}`;

  // --- P1 hosts; P2..PN join by the rendered room code.
  await pickLevelThenLobby(pages[0]!, "host");
  const badge = await pages[0]!.locator(".badge").textContent({ timeout: 8000 }).catch(() => null);
  const code = badge?.match(/Crew\s+(\w+)/)?.[1];
  if (!code) throw new Error(`host room code not rendered (badge=${badge})`);
  results.push(`P1 hosted room ${code} (${LEVEL}, ${shares.length} seats)`);

  for (let i = 1; i < pages.length; i++) {
    await pickLevelThenLobby(pages[i]!, "join");
    await pages[i]!.fill('input[placeholder="Room code"]', code);
    await pages[i]!.click('button:has-text("Join")');
    await pages[i]!.waitForSelector('[data-testid="scene"]', { timeout: 8000 });
    results.push(`${tag(i)} joined ${await pages[i]!.locator(".badge").textContent().catch(() => "?")}`);
  }

  // --- Each seat commits its own manifest shard.
  for (let i = 0; i < pages.length; i++) await commitRows(pages[i]!, shares[i]!.rows);
  await pages[0]!.waitForTimeout(400);
  const rowCounts = await Promise.all(pages.map((p) => boardSnapshot(p)));
  const badRows = rowCounts.map((s, i) => (s.rows === ROW_TOTAL ? null : `${tag(i)}=${s.rows}`)).filter(Boolean);
  results.push(badRows.length ? `row replication WRONG: ${badRows.join(", ")} (expect ${ROW_TOTAL})` : `rows replicate: ${ROW_TOTAL} on all ${pages.length} boards`);

  // --- Each seat queues its own order shard.
  for (let i = 0; i < pages.length; i++) await queueCommands(pages[i]!, shares[i]!.cmds);
  await pages[0]!.waitForTimeout(600);
  const snaps = await Promise.all(pages.map((p) => boardSnapshot(p)));
  const mismatch: string[] = [];
  for (const c of ALL_CMDS) {
    const k = `${c.beat}-${c.crew}`;
    snaps.forEach((s, i) => { if (s.orders[k] !== c.slug) mismatch.push(`${tag(i)} ${k}=${s.orders[k]} want ${c.slug}`); });
  }
  results.push(mismatch.length ? `order convergence WRONG:\n  ${mismatch.join("\n  ")}` : `orders converge: ${ALL_CMDS.length} orders identical on all ${pages.length} boards`);

  const crewsCommanded = new Set(ALL_CMDS.filter((c) => snaps.every((s) => s.orders[`${c.beat}-${c.crew}`] === c.slug)).map((c) => c.crew));
  results.push(`crew commanded: ${crewsCommanded.size}/4 (${[...crewsCommanded].join(",")})`);

  // --- P1 runs test.run; EVERY board must see the success verdict.
  await pages[0]!.click('[data-testid="test-run"]');
  await pages[0]!.waitForSelector('[data-testid="verdict"]', { timeout: 15000 });
  const verdicts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    await pages[i]!.waitForSelector('[data-testid="verdict"]', { timeout: 15000 }).catch(() => null);
    verdicts.push(`${tag(i)}=${(await pages[i]!.getAttribute('[data-testid="verdict"]', "class").catch(() => "absent")) ?? "absent"}`);
  }
  results.push(`verdict: ${verdicts.join(" ")}`);
  for (let i = 0; i < pages.length; i++) await pages[i]!.screenshot({ path: `/tmp/coop-${LEVEL}-p${i + 1}-verdict.png`, fullPage: true });

  // --- P1 accepts; EVERY board must see the accepted banner.
  if (verdicts[0]?.includes("success")) {
    await pages[0]!.click('[data-testid="accept-result"]');
    const banners: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const b = await pages[i]!.waitForSelector('[data-testid="accepted-banner"]', { timeout: 8000 }).catch(() => null);
      banners.push(`${tag(i)}=${!!b}`);
    }
    results.push(`accept: ${banners.join(" ")}`);
    for (let i = 0; i < pages.length; i++) await pages[i]!.screenshot({ path: `/tmp/coop-${LEVEL}-p${i + 1}-accepted.png`, fullPage: true });
  }

  await browser.close();
  console.log("\n" + results.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
