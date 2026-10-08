// Smoke: load → level select → play the level-01 winning input through the
// real UI → assert the success verdict is accepted.
import { expect, test } from "@playwright/test";

test("RBM-01 The Weight of Evidence — winning plan accepted", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("play-solo").click();
  await page.getByTestId("level-rbm-01").click();

  // Manifest: loan HEAVY from the safe to the crate, start 1, due end of beat 3.
  await page.getByTestId("loan-token").selectOption("TOKEN-H");
  await page.getByTestId("loan-to").selectOption("prop-crate");
  await page.getByTestId("loan-start").selectOption("1");
  await page.getByTestId("loan-due").selectOption("3");
  await page.getByTestId("commit-row").click();
  await expect(page.getByTestId("toast")).toHaveCount(0);

  // Beat orders: the carrier takes the safe out across the approach, then the pad.
  await page.getByTestId("cmd-2-crew-helper").selectOption("pm:prop-safe:cell-approach");
  await page.getByTestId("cmd-3-crew-helper").selectOption("move:pad-out");

  await page.getByTestId("test-run").click();
  await expect(page.getByTestId("verdict")).toContainText(/succeeds/i);

  await page.getByTestId("accept-result").click();
  await expect(page.getByTestId("accepted-banner")).toBeVisible();
});

test("a failing schedule is refused: permanent loan leaves the exit open", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("play-solo").click();
  await page.getByTestId("level-rbm-01").click();
  await page.getByTestId("loan-due").selectOption("never");
  await page.getByTestId("commit-row").click();
  await page.getByTestId("cmd-2-crew-helper").selectOption("pm:prop-safe:cell-approach");
  await page.getByTestId("cmd-3-crew-helper").selectOption("move:pad-out");
  await page.getByTestId("test-run").click();
  await expect(page.getByTestId("verdict")).toContainText(/fails/i);
  await expect(page.getByTestId("accept-result")).toBeDisabled();
});
