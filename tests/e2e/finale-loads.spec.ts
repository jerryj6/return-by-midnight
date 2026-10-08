// Finale smoke: RBM-11 and RBM-12 load their boards in the live client —
// scene, entities, tokens all render, zero page errors.
import { expect, test } from "@playwright/test";

for (const id of ["rbm-11", "rbm-12"]) {
  test(`${id} board loads clean`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByTestId("play-solo").click();
    await page.getByTestId(`level-${id}`).click();
    await expect(page.getByTestId("scene")).toBeVisible();
    await expect(page.locator('[data-testid^="ent-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="token-"]').first()).toBeVisible();
    await expect(page.getByTestId("hint-1")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
