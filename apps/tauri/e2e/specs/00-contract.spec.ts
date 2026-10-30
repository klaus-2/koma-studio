import { expect, test } from "../support/fixtures.ts";

test("boot bridge contract", async ({ app, problems, summary }) => {
  const channels = await app.evaluate(() => window.__e2eChannels ?? []);

  expect(channels.length).toBeGreaterThan(0);
  await expect(app.locator("html")).toHaveAttribute(
    "data-playwright-web-access",
    "enabled",
  );
  await expect(app.locator("html")).toHaveAttribute(
    "data-theme-family",
    "noir",
  );

  const failure = await app.evaluate(async () => {
    try {
      await window.__komaE2EHostCall?.("desktop:not-a-command", {});
      return "resolved";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(failure).toContain("E2E_UNMOCKED_COMMAND");
  expect(problems).toEqual([]);

  summary.record("contract", { channels });
});
