import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const ARTIFACTS_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  ".artifacts",
  "text-effects",
);

const hideReactScanOverlay = async (
  page: import("@playwright/test").Page,
): Promise<void> => {
  await page.evaluate(() => {
    for (const el of Array.from(document.body.children)) {
      if (el.id === "root" || el.hasAttribute("data-radix-popper-content-wrapper")) {
        continue;
      }
      if (el.querySelector('[role="dialog"]')) {
        continue;
      }
      if (
        el.tagName === "CANVAS"
        || el.id.includes("react-scan")
        || el.className.toString().includes("react-scan")
        || el.hasAttribute("data-react-scan")
        || getComputedStyle(el).position === "fixed"
      ) {
        (el as HTMLElement).style.setProperty("display", "none", "important");
      }
    }
    for (const el of document.querySelectorAll('[id*="react-scan"], [class*="react-scan"], [data-react-scan]')) {
      if (!el.closest("#root") && !el.closest('[data-radix-popper-content-wrapper]')) {
        (el as HTMLElement).style.setProperty("display", "none", "important");
      }
    }
  });
  await page.waitForTimeout(150);
};

const captureCanvasPng = async (
  page: import("@playwright/test").Page,
  testId: string,
): Promise<PNG> => {
  const dataUrl = await page.evaluate((id) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-testid="${id}"]`);
    return canvas ? canvas.toDataURL("image/png") : null;
  }, testId);
  expect(dataUrl, `canvas[data-testid="${testId}"] present`).not.toBeNull();
  const base64 = (dataUrl as string).split(",")[1] ?? "";
  return PNG.sync.read(Buffer.from(base64, "base64"));
};

const countNonWhitePixels = (png: PNG): number => {
  let count = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i] ?? 255;
    const g = png.data[i + 1] ?? 255;
    const b = png.data[i + 2] ?? 255;
    if (r < 248 || g < 248 || b < 248) count += 1;
  }
  return count;
};

test.use({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});

test("text effects visual parity, popover thumbs, and No effect roundtrip", async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  await page.goto("/#/dev-text-effects", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("live-render-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("sheet-image1")).toBeVisible();
  await expect(page.getByTestId("sheet-image3")).toBeVisible();
  await page.waitForTimeout(500);

  const sheet1 = await captureCanvasPng(page, "sheet-image1");
  const sheet3 = await captureCanvasPng(page, "sheet-image3");
  expect(countNonWhitePixels(sheet1)).toBeGreaterThan(10_000);
  expect(countNonWhitePixels(sheet3)).toBeGreaterThan(8_000);
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "sheet-image1.png"), PNG.sync.write(sheet1));
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "sheet-image3.png"), PNG.sync.write(sheet3));

  await expect(page.getByTestId("live-preset-id")).toHaveText("none");
  await expect(page.getByTestId("live-color")).toHaveText("#0d6efd");
  await expect(page.getByTestId("live-outline")).toHaveText("2px");
  const liveBefore = await captureCanvasPng(page, "live-render-canvas");

  await page.getByTestId("toggle-theme-classic").click();
  await page.getByTestId("text-effect-trigger").click();
  const blamOption = page.locator('button[data-effect-id="blam_impact"]');
  await expect(blamOption).toBeVisible();

  const thumbSrc = await blamOption.locator("img").getAttribute("src");
  expect(thumbSrc).toMatch(/^data:image\/png;base64,/);
  await hideReactScanOverlay(page);
  await page.locator('[role="dialog"]').screenshot({
    path: path.join(ARTIFACTS_DIR, "popover-classic.png"),
  });

  await blamOption.click();
  await expect(page.getByTestId("live-preset-id")).toHaveText("blam_impact");
  await expect(page.getByTestId("live-has-snapshot")).toHaveText("yes");
  const liveBlam = await captureCanvasPng(page, "live-render-canvas");
  const diffBlam = new PNG({ width: liveBefore.width, height: liveBefore.height });
  expect(
    pixelmatch(liveBefore.data, liveBlam.data, diffBlam.data, liveBefore.width, liveBefore.height, { threshold: 0.1 }),
  ).toBeGreaterThan(500);

  await page.locator('button[data-effect-id="balloon_smear"]').click();
  await expect(page.getByTestId("live-preset-id")).toHaveText("balloon_smear");
  const smearDefault = await captureCanvasPng(page, "live-render-canvas");

  const slider = page.locator('input[type="range"]');
  await slider.fill("1.75");
  await slider.dispatchEvent("change");
  await page.waitForTimeout(100);
  const smearStrong = await captureCanvasPng(page, "live-render-canvas");
  const diffSmear = new PNG({ width: smearDefault.width, height: smearDefault.height });
  expect(
    pixelmatch(smearDefault.data, smearStrong.data, diffSmear.data, smearDefault.width, smearDefault.height, { threshold: 0.05 }),
  ).toBeGreaterThan(200);

  await page.locator('button[data-effect-id="none"]').click();
  await expect(page.getByTestId("live-preset-id")).toHaveText("none");
  await expect(page.getByTestId("live-color")).toHaveText("#0d6efd");
  await expect(page.getByTestId("live-outline")).toHaveText("2px");
  await expect(page.getByTestId("live-has-snapshot")).toHaveText("no");
  const liveAfterNone = await captureCanvasPng(page, "live-render-canvas");
  const diffRestore = new PNG({ width: liveBefore.width, height: liveBefore.height });
  const restoredDiffPixels = pixelmatch(
    liveBefore.data,
    liveAfterNone.data,
    diffRestore.data,
    liveBefore.width,
    liveBefore.height,
    { threshold: 0 },
  );
  expect(restoredDiffPixels, "No effect must restore pre-effect render bit-for-bit").toBe(0);

  await page.getByTestId("toggle-theme-noir").click();
  await page.getByTestId("text-effect-trigger").click();
  await page.locator('button[data-effect-id="flinch_outline"]').click();
  await expect(page.getByTestId("live-preset-id")).toHaveText("flinch_outline");
  await hideReactScanOverlay(page);
  await page.locator('[role="dialog"]').screenshot({
    path: path.join(ARTIFACTS_DIR, "popover-noir.png"),
  });
  await page.getByTestId("text-effect-clear").click();
  await expect(page.getByTestId("live-preset-id")).toHaveText("none");
  const liveAfterClear = await captureCanvasPng(page, "live-render-canvas");
  const diffClear = new PNG({ width: liveBefore.width, height: liveBefore.height });
  expect(
    pixelmatch(liveBefore.data, liveAfterClear.data, diffClear.data, liveBefore.width, liveBefore.height, { threshold: 0 }),
  ).toBe(0);
});
