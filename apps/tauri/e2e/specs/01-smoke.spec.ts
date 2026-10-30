import { capture, expect, test } from "../support/fixtures.ts";

test("dashboard and model manager smoke", async ({
  app,
  problems,
  runRoot,
  summary,
}) => {
  await expect(app).not.toHaveURL(/#\/login/);
  await expect(app.locator(".auth-shell")).toHaveCount(0);
  await expect(
    app.getByRole("tab", { name: "AIO", exact: true }),
  ).toBeVisible();

  const modelsButton = app
    .getByRole("button", { name: "Models", exact: true })
    .first();
  await expect(modelsButton).toBeVisible();
  await modelsButton.click();

  await expect(app.getByText("Model Vault").first()).toBeVisible();

  const detector = app.locator('[data-model-id="font_rtdetr_v2"]');
  await expect(detector).toBeVisible();
  await expect(detector).toHaveAttribute("data-install-status", "not_installed");

  await capture(app, runRoot, "01-smoke-model-vault");
  expect(problems).toEqual([]);
  summary.record("smoke", { ok: true });
});
