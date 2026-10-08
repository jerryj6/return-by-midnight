// LIVE production smoke test (AUTOMATED) against the Render deploy.
// Stages: title → select → level → credits (if present) → back → host a
// live room over wss + join from a second isolated context → queue a
// command on host → assert guest board folds it.
//   npx tsx scripts/prod-smoke.ts
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "https://return-by-midnight.onrender.com";
const SHOT = "/tmp/prod";
const results: string[] = [];
const shot = async (p: Page, name: string) =>
  p.screenshot({ path: `${SHOT}-${name}.png`, fullPage: true }).then(() => results.push(`shot ${name}`));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const p1 = await (await browser.newContext()).newPage();

  // --- title (free-tier cold start can take ~30s)
  await p1.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p1.waitForSelector('[data-testid="play-solo"]', { timeout: 60000 });
  await shot(p1, "01-title");
  results.push("title: OK");

  // --- select
  await p1.click('[data-testid="play-solo"]');
  await p1.waitForSelector('[data-testid="level-rbm-01"]', { timeout: 15000 });
  await shot(p1, "02-select");
  results.push("select: OK");

  // --- level
  await p1.click('[data-testid="level-rbm-01"]');
  await p1.waitForSelector('[data-testid="scene"]', { timeout: 15000 });
  await shot(p1, "03-level");
  results.push("level rbm-01: OK");

  // --- credits (present upstream post-pass-15; probe what's actually live)
  const creditsBtn = p1.locator('button:has-text("Credits"), a:has-text("Credits"), [data-testid="credits"]').first();
  if (await creditsBtn.isVisible().catch(() => false)) {
    await creditsBtn.click();
    await p1.waitForTimeout(500);
    await shot(p1, "04-credits");
    results.push("credits: OK");
    const back = p1.locator('button:has-text("Back")').first();
    if (await back.isVisible().catch(() => false)) await back.click();
  } else {
    results.push("credits: not present in this deploy — skipped");
  }
  // back to title if needed
  const backBtn = p1.locator('button.ghost:has-text("Back")').first();
  if (await backBtn.isVisible().catch(() => false)) await backBtn.click().catch(() => {});

  // --- live room: host + second-context join + fold check
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  // both navigate: solo-pick rbm-01 → Rooms → Back → lobby (sets level ctx)
  for (const p of [p1, p2]) {
    if (!(await p.locator('[data-testid="level-rbm-01"]').isVisible().catch(() => false))) {
      await p.click('[data-testid="play-solo"]').catch(() => {});
    }
    await p.click('[data-testid="level-rbm-01"]').catch(() => {});
    await p.waitForSelector('[data-testid="scene"]', { timeout: 15000 });
    await p.click('button:has-text("Rooms")');
    await p.click('button.ghost:has-text("Back")');
    await p.click('[data-testid="play-coop"]');
    await p.waitForSelector('button:has-text("Host a room"), input[placeholder="Room code"]', { timeout: 15000 });
  }
  await p1.click('button:has-text("Host a room")');
  const badge = await p1.locator(".badge").textContent({ timeout: 20000 });
  const code = badge?.match(/Crew\s+(\w+)/)?.[1];
  results.push(`live room hosted: ${badge}`);
  await shot(p1, "05-hosted");
  if (!code) throw new Error("no room code");

  await p2.fill('input[placeholder="Room code"]', code);
  await p2.click('button:has-text("Join")');
  await p2.waitForSelector('[data-testid="scene"]', { timeout: 20000 });
  results.push("guest joined live room");
  await shot(p2, "06-joined");

  // host queues a command; guest board must fold it
  const sel = "cmd-2-crew-helper";
  const opts: string[] = await p1.locator(`[data-testid="${sel}"] option`).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  const pick = opts.find((v) => v.startsWith("move:")) ?? opts.find((v) => v !== "auto" && v !== "clear");
  if (!pick) throw new Error(`no writable option on ${sel}: ${opts.join("|")}`);
  await p1.selectOption(`[data-testid="${sel}"]`, pick);
  await p1.waitForTimeout(2000); // wss round-trip + fold
  const g = await p2.locator(`[data-testid="${sel}"]`).inputValue();
  results.push(g === pick ? `fold: PASS — guest sees ${pick}` : `fold: FAIL — guest=${g} host=${pick}`);
  await shot(p2, "07-fold");

  console.log(results.map((r) => `  ${r}`).join("\n"));
  await browser.close();
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
