import { test, expect } from "@playwright/test";

// Visual baselines for the three entry surfaces. First run writes the
// snapshots; subsequent runs diff with a small anti-alias tolerance.
test.describe("visual baselines", () => {
  test("title screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("play-solo")).toBeVisible();
    await expect(page).toHaveScreenshot("title.png", { maxDiffPixelRatio: 0.02 });
  });

  test("level select", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("play-solo").click();
    await expect(page.getByTestId("level-rbm-01")).toBeVisible();
    await expect(page).toHaveScreenshot("level-select.png", { maxDiffPixelRatio: 0.02 });
  });

  test("RBM-01 scene", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("play-solo").click();
    await page.getByTestId("level-rbm-01").click();
    await expect(page.getByTestId("test-run")).toBeVisible();
    await expect(page).toHaveScreenshot("rbm-01-scene.png", { maxDiffPixelRatio: 0.03 });
  });
});
