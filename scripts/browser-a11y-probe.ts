// Scripted keyboard/a11y probe (AUTOMATED): Tab-order + focus-visibility +
// keyboard activation across the main flow — title → select → manifest
// board → commit → test.run → verdict. Every interactive element must be
// tabbable, visibly focused (outline/box-shadow), and Enter/Space-activable.
//   npx vite (dev server :5173) or dist on :8787 — BASE_URL selects.
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const LEVEL = process.env.LEVEL ?? "rbm-11";

const results: string[] = [];

async function focusedInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { tag: "body", testid: "", style: "" };
    const cs = getComputedStyle(el);
    const style = `${cs.outlineStyle}:${cs.outlineWidth}:${cs.outlineColor}|shadow:${cs.boxShadow}`;
    return { tag: el.tagName.toLowerCase(), testid: el.dataset.testid ?? el.textContent?.trim().slice(0, 40) ?? "", style };
  });
}

async function tabTrail(page: Page, steps: number, label: string) {
  const seen: string[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    const f = await focusedInfo(page);
    const vis = /solid|dashed|dotted/.test(f.style.split("|")[0] ?? "") || /rgb|px/.test(f.style.split("shadow:")[1] ?? "") && !/none/.test(f.style);
    seen.push(`${f.tag}[${f.testid}]${vis ? "*" : "?"}`);
  }
  results.push(`${label} tab-order: ${seen.join(" → ")}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });

  // Title: both CTA buttons tabbable + Enter activates Play solo.
  await tabTrail(page, 3, "title");
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator('[data-testid="play-solo"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid^="level-"]', { timeout: 5000 })
    .then(() => results.push("title: Enter on play-solo navigates to select"))
    .catch(() => results.push("title: Enter on play-solo FAILED to navigate"));

  // Select: level cards are real buttons — Tab lands on them, Enter picks.
  const cardFocused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return el?.dataset?.testid?.startsWith("level-") ? el.dataset.testid : null;
  });
  let tabsToLevel = 0;
  while (!cardFocused && tabsToLevel < 15) {
    await page.keyboard.press("Tab");
    tabsToLevel++;
    const f = await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset?.testid ?? "");
    if (f === `level-${LEVEL}`) break;
  }
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="scene"]', { timeout: 5000 })
    .then(() => results.push(`select: Tab+Enter reaches + opens level-${LEVEL}`))
    .catch(() => results.push(`select: keyboard level pick FAILED`));

  // Board: loan form controls reachable by Tab; commit-row keyboard-clickable.
  for (const id of ["loan-token", "loan-to", "loan-start", "loan-due", "commit-row"]) {
    const reachable = await page.locator(`[data-testid="${id}"]`).evaluate((el) => (el as HTMLElement).tabIndex >= 0);
    results.push(`board: [${id}] ${reachable ? "tabbable" : "NOT tabbable (tabIndex<0)"}`);
  }
  // Drive the row builder by keyboard: focus each select, set value via page API
  // (native select keyboard input varies); commit via Enter on the button.
  await page.selectOption('[data-testid="loan-token"]', "TOKEN-H");
  await page.selectOption('[data-testid="loan-to"]', "prop-scale-w");
  await page.selectOption('[data-testid="loan-start"]', "2");
  await page.selectOption('[data-testid="loan-due"]', "5");
  await page.locator('[data-testid="commit-row"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid^="row-"]', { timeout: 4000 })
    .then(() => results.push("board: Enter on commit-row commits a loan row"))
    .catch(() => results.push("board: commit-row Enter FAILED"));

  // test-run: focus + Enter → verdict.
  await page.locator('[data-testid="test-run"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="verdict"]', { timeout: 15000 });
  const verdictBtnVisible = await page.locator('[data-testid="accept-result"]').isVisible().catch(() => false);
  results.push(`run: verdict renders; accept-result ${verdictBtnVisible ? "present" : "MISSING"}`);

  // Focus-visible check on the verdict's primary button.
  await page.locator('[data-testid="accept-result"]').focus();
  const fstyle = await focusedInfo(page);
  const hasRing = /solid|dashed|dotted/.test(fstyle.style) || !/none/.test(fstyle.style.split("shadow:")[1] ?? "");
  results.push(`verdict: accept-result focus ring ${hasRing ? "VISIBLE" : `MISSING (${fstyle.style})`}`);
  await page.screenshot({ path: `/tmp/a11y-verdict-focus.png`, fullPage: true });

  // aria/role smell-test: buttons are <button> or have role=button?
  const nonNative = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll("[data-testid]"))) {
      const he = el as HTMLElement;
      if (/btn|button|commit|run|accept|undo|level-|hint|toast-close/.test(he.dataset.testid ?? "") && he.tagName !== "BUTTON" && he.tagName !== "SELECT" && he.tagName !== "INPUT" && !he.getAttribute("role"))
        bad.push(`${he.tagName.toLowerCase()}#${he.dataset.testid}`);
    }
    return bad;
  });
  results.push(`roles: ${nonNative.length ? `non-semantic interactive els: ${nonNative.join(", ")}` : "all interactive els use native button/select"}`);

  await browser.close();
  console.log(results.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
