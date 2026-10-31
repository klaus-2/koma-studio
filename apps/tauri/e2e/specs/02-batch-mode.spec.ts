import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { zipSync } from "fflate";

import { expect, test } from "../support/fixtures.ts";

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/pages",
);

const buildArchive = (entryName: string): Buffer =>
  Buffer.from(
    zipSync({
      [entryName]: new Uint8Array(
        readFileSync(path.join(fixtureDir, entryName)),
      ),
    }),
  );

const openAutomaticPanel = async (app: Page): Promise<void> => {
  const aioTab = app.getByRole("tab", { name: "AIO", exact: true });
  if ((await aioTab.getAttribute("aria-selected")) !== "true") {
    await aioTab.click();
  }
  const automaticTab = app.getByRole("tab", {
    name: "AIO automatic",
    exact: true,
  });
  if ((await automaticTab.getAttribute("aria-selected")) !== "true") {
    await automaticTab.click();
  }
};

test("batch mode toggle lives in the AIO controls and persists", async ({
  app,
}) => {
  await expect(app).not.toHaveURL(/#\/login/);
  await openAutomaticPanel(app);

  const toggle = app.getByLabel("Batch Mode");
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();

  await app.getByText("Batch Mode", { exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(app.getByText(/needs at least two chapters/i)).toBeVisible();

  await app.reload({ waitUntil: "domcontentloaded" });
  await openAutomaticPanel(app);

  const restored = app.getByLabel("Batch Mode");
  await expect(restored).toBeVisible();
  await expect(restored).toBeChecked();

  await app.getByText("Batch Mode", { exact: true }).click();
  await expect(restored).not.toBeChecked();
});

test("chapter archives become batch chapters with a preset picker", async ({
  app,
}) => {
  await expect(app).not.toHaveURL(/#\/login/);
  await openAutomaticPanel(app);

  await app
    .locator('[data-tour="dashboard-dropzone"] input[type="file"]')
    .setInputFiles([
      {
        name: "chapter-a.cbz",
        mimeType: "application/zip",
        buffer: buildArchive("page-2.png"),
      },
      {
        name: "chapter-b.cbz",
        mimeType: "application/zip",
        buffer: buildArchive("page-3.png"),
      },
    ]);

  await expect
    .poll(() => app.evaluate(() => window.__komaE2E?.imageCount() ?? 0), {
      timeout: 300_000,
    })
    .toBe(2);

  await app.getByText("Batch Mode", { exact: true }).click();

  await expect(app.getByText("Chapters", { exact: true })).toBeVisible();
  await expect(app.getByLabel("Preset for chapter-a.cbz")).toBeVisible();
  await expect(app.getByLabel("Preset for chapter-b.cbz")).toBeVisible();
});

test("selected images can be grouped into a manual chapter", async ({
  app,
}) => {
  await expect(app).not.toHaveURL(/#\/login/);
  await openAutomaticPanel(app);

  await app
    .locator('[data-tour="dashboard-dropzone"] input[type="file"]')
    .setInputFiles([
      path.join(fixtureDir, "page-2.png"),
      path.join(fixtureDir, "page-3.png"),
    ]);

  await expect
    .poll(() => app.evaluate(() => window.__komaE2E?.imageCount() ?? 0), {
      timeout: 300_000,
    })
    .toBe(2);

  await app.getByRole("button", { name: "Select images" }).click();
  await app.getByText("page-2.png", { exact: true }).click();

  app.once("dialog", (dialog) => dialog.accept("Test chapter"));
  await app.getByRole("button", { name: "Create chapter" }).click();

  await app.getByText("Batch Mode", { exact: true }).click();

  await expect(app.getByText("1. Test chapter (1)")).toBeVisible();
  await expect(app.getByText("2. Images (1)")).toBeVisible();

  await expect(
    app.getByRole("button", { name: "Rename chapter" }),
  ).toBeVisible();
  app.once("dialog", (dialog) => dialog.accept("Renamed chapter"));
  await app.getByRole("button", { name: "Rename chapter" }).click();
  await expect(app.getByLabel("Preset for Renamed chapter")).toBeVisible();

  app.once("dialog", (dialog) => dialog.accept());
  await app.getByRole("button", { name: "Remove chapter" }).click();
  await expect(
    app.getByRole("button", { name: "Rename chapter" }),
  ).toHaveCount(0);
  await expect(app.getByText(/needs at least two chapters/i)).toBeVisible();
});
