import { chromium, type Page } from "playwright";
const BASE = "http://localhost:8787";
async function nav(page: Page, role: "host" | "join") {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-testid="play-solo"]');
  await page.click('[data-testid="level-rbm-01"]');
  await page.waitForSelector('[data-testid="scene"]');
  await page.click('button:has-text("Rooms")');
  await page.click('button.ghost:has-text("Back")');
  await page.click('[data-testid="play-coop"]');
  if (role === "host") await page.click('button:has-text("Host a room")');
}
async function main() {
  const browser = await chromium.launch({ headless: true });
  const p1 = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  p1.on("console", (m) => { if (m.type() === "error") console.log("P1 err:", m.text().slice(0, 200)); });
  await nav(p1, "host");
  const code = (await p1.locator(".badge").textContent({ timeout: 8000 }))?.match(/Crew\s+(\w+)/)?.[1];
  console.log("room", code);
  await nav(p2, "join");
  await p2.fill('input[placeholder="Room code"]', code!);
  await p2.click('button:has-text("Join")');
  await p2.waitForSelector('[data-testid="scene"]', { timeout: 8000 });
  // rbm-01 committed plan needs the row first: crate loan @1~3
  for (const [tid, val] of [["loan-token","TOKEN-H"],["loan-to","prop-crate"],["loan-start","1"],["loan-due","3"]] as const)
    await p1.selectOption(`[data-testid="${tid}"]`, val);
  await p1.click('[data-testid="commit-row"]');
  await p1.waitForTimeout(400);
  const s1 = p1.locator('[data-testid="cmd-2-crew-helper"]');
  const s2 = p2.locator('[data-testid="cmd-2-crew-helper"]');
  console.log("P1 options@2-helper:", (await s1.locator("option").allTextContents()).join("|"));
  const pmval = (await s1.locator("option").evaluateAll((els: any[]) => els.map((e) => e.value))).find((v: string) => v.startsWith("pm:"));
  console.log("choosing", pmval);
  await s1.selectOption(pmval!);
  await p1.waitForTimeout(1500);
  console.log(`P1 slot=${await s1.inputValue()} | P2 slot=${await s2.inputValue()}`);
  const toast = await p1.locator(".toast, [data-testid=toast]").textContent().catch(() => null);
  console.log("toast:", toast);
  await p1.screenshot({ path: "/tmp/rbm01-fold.png", fullPage: true });
  await browser.close();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
