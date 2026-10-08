import { test, expect, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

const PORT = 8932;
let srv: ChildProcess;

test.beforeAll(async () => {
  srv = spawn("node", ["dist-server/src/server/main.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("room server did not start");
});

test.afterAll(() => srv.kill());

test("two planners share one authoritative manifest", async ({ browser }: { browser: Browser }) => {
  const host = await browser.newPage();
  const guest = await browser.newPage();

  await host.goto(`http://localhost:${PORT}/`);
  await host.getByTestId("play-coop").click();
  await host.getByText(/Host a room/).click();
  await expect(host.getByText(/Crew [A-Z0-9]+/)).toBeVisible();
  const code = (await host.locator(".badge", { hasText: "Crew" }).innerText()).replace("Crew ", "");

  await guest.goto(`http://localhost:${PORT}/`);
  await guest.getByTestId("play-coop").click();
  await guest.getByPlaceholder("Room code").fill(code);
  await guest.getByText("Join", { exact: true }).click();
  await expect(guest.getByText(new RegExp(`Crew ${code}`))).toBeVisible();

  // Host commits a manifest row; guest's row table shows it.
  await host.getByTestId("loan-token").selectOption("TOKEN-H");
  await host.getByTestId("loan-to").selectOption("prop-crate");
  await host.getByTestId("loan-start").selectOption("1");
  await host.getByTestId("loan-due").selectOption("3");
  await host.getByTestId("commit-row").click();
  await expect(guest.getByText(/HEAVY.*safe/i).first()).toBeVisible({ timeout: 5000 });

  // Guest queues a crew command; host sees it.
  await guest.getByTestId("cmd-2-crew-helper").selectOption("pm:prop-safe:cell-approach");
  await expect(host.locator('[data-testid="cmd-2-crew-helper"]')).toHaveValue("pm:prop-safe:cell-approach", { timeout: 5000 });

  await host.close(); await guest.close();
});

test("finale co-op: joiner renders the room's level (RBM-12)", async ({ browser }: { browser: Browser }) => {
  const host = await browser.newPage();
  const guest = await browser.newPage();

  // Pre-select the finale via pure SPA navigation — level is React state.
  await host.goto(`http://localhost:${PORT}/`);
  await host.getByTestId("play-solo").click();
  await host.getByTestId("level-rbm-12").click();
  await expect(host.getByTestId("scene")).toBeVisible();
  await host.getByRole("button", { name: "Rooms" }).click();
  await host.getByRole("button", { name: "Back", exact: true }).click();
  await host.getByTestId("play-coop").click();
  await host.getByText(/Host a room \(RBM-12\)/).click();
  await expect(host.getByText(/Crew [A-Z0-9]+/)).toBeVisible();
  const code = (await host.locator(".badge", { hasText: "Crew" }).innerText()).replace("Crew ", "");

  await guest.goto(`http://localhost:${PORT}/`);
  await guest.getByTestId("play-coop").click();
  await guest.getByPlaceholder("Room code").fill(code);
  await guest.getByText("Join", { exact: true }).click();
  await expect(guest.getByText(new RegExp(`Crew ${code}`))).toBeVisible();

  // The joiner never visited the select screen — the room's levelId must
  // drive the rendered manifest, not the default RBM-01.
  await expect(guest.getByText("RBM-12").first()).toBeVisible();
  await expect(guest.getByText(/Midnight Returns/)).toBeVisible();

  await host.close(); await guest.close();
});
