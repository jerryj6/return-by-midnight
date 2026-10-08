import { chromium, type Page } from "playwright";
const BASE = "http://localhost:8787";
async function nav(page: Page, role: "host" | "join") {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-testid="play-solo"]');
  await page.click('[data-testid="level-rbm-12"]');
  await page.waitForSelector('[data-testid="scene"]');
  await page.click('button:has-text("Rooms")');
  await page.click('button.ghost:has-text("Back")');
  await page.click('[data-testid="play-coop"]');
  if (role === "host") await page.click('button:has-text("Host a room")');
}
async function snap(p: Page) {
  const rows = (await p.locator('[data-testid^="row-"]').allTextContents()).join(";");
  const orders: string[] = [];
  for (const s of await p.locator('select[data-testid^="cmd-"]').all())
    orders.push(`${await s.getAttribute("data-testid")}=${await s.inputValue()}`);
  return rows + "||" + orders.join(",");
}
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await (await browser.newContext()).newPage();
  await nav(p1, "host");
  const code = (await p1.locator(".badge").textContent({ timeout: 8000 }))?.match(/Crew\s+(\w+)/)?.[1];
  console.log("room", code);
  await nav(p2, "join");
  await p2.fill('input[placeholder="Room code"]', code!);
  await p2.click('button:has-text("Join")');
  await p2.waitForSelector('[data-testid="scene"]', { timeout: 8000 });
  // host commits a row + 2 orders (rbm-12 canonical opening)
  for (const [tid, val] of [["loan-token","TOKEN-H"],["loan-to","prop-scale-h"],["loan-start","1"],["loan-due","3"]] as const)
    await p1.selectOption(`[data-testid="${tid}"]`, val);
  await p1.click('[data-testid="commit-row"]');
  for (const tid of ["cmd-2-crew-helper", "cmd-3-crew-scout"]) {
    const vals: string[] = await p1.locator(`[data-testid="${tid}"] option`).evaluateAll((e: any[]) => e.map((o) => o.value));
    await p1.selectOption(`[data-testid="${tid}"]`, vals.find((v) => v.startsWith("move:"))!);
    await p1.waitForTimeout(200);
  }
  await p1.waitForTimeout(800);
  const before = await snap(p2);
  console.log("P2 rows/orders captured:", before.split("||")[0]?.length ?? 0, "rows-chars");
  // drop the HOST entirely
  await ctx1.close();
  await p2.waitForTimeout(1500);
  // fresh client rejoins same code
  const p3 = await (await browser.newContext()).newPage();
  p3.on("websocket", (ws) => ws.on("framereceived", (f) => console.log("P3<-", String(f.payload).slice(0, 2000))));
  await nav(p3, "join");
  await p3.fill('input[placeholder="Room code"]', code!);
  await p3.click('button:has-text("Join")');
  const ok = await p3.waitForSelector('[data-testid="scene"]', { timeout: 6000 }).then(() => true).catch(() => false);
  if (!ok) {
    const lobby = await p3.locator("body").textContent();
    console.log("REJOIN FAILED — room gone or join rejected. body:", lobby?.slice(0, 300));
    await p3.screenshot({ path: "/tmp/reconnect-fail.png" });
    await browser.close();
    return;
  }
  await p3.waitForTimeout(800);
  const after = await snap(p3);
  console.log(after === before ? "PASS — rejoin state byte-exact (rows+orders)" : `MISMATCH\nP2: ${before.slice(0, 400)}\nP3: ${after.slice(0, 400)}`);
  await p3.screenshot({ path: "/tmp/reconnect-p3.png", fullPage: true });
  await browser.close();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
