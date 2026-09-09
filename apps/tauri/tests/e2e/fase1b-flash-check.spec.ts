import { expect, test } from "@playwright/test";

// THROWAWAY Fase-1b verification probe — deleted after the run.

const STORES = "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: {
    headless: false,
    channel: "chromium",
    args: ["--enable-gpu", "--disable-software-rasterizer", "--enable-zero-copy"],
  },
});

const MODES = [
  "aio", "cleaner", "typesetter", "translator", "stitch", "split",
  "watermark", "enhance", "optimizer", "organize",
] as const;

test("fallback flash count across mode switches", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(20000);
  });
  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator('[data-tour="dashboard-stage"]')).toBeVisible({
    timeout: 180_000,
  });
  await page.waitForTimeout(2500);

  const preloadTargets = [
    "AioRightPanel", "CleanerToolsPanel", "TypographerToolsPanel",
    "TranslatorToolsPanel", "EnhanceToolsPanel", "RenderTextPreview",
    "TextDetectionPreview", "TranslatorTextStage",
    "StitchWorkspace", "SplitterWorkspace", "WatermarkWorkspace",
    "ChapterOptimizerWorkspace", "BloggerWorkspace",
  ];
  const deadline = Date.now() + 120_000;
  let seen = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    seen = await page.evaluate((targets: string[]) => {
      const urls = performance.getEntriesByType("resource").map((e) => e.name);
      return targets.filter((t) => urls.some((u) => u.includes(t))).length;
    }, preloadTargets);
    if (seen === preloadTargets.length) break;
  }
  console.log(`PRELOAD_WARM seen=${seen}/${preloadTargets.length}`);

  const fallbackSeen: string[] = [];
  for (const mode of MODES) {
    await page.evaluate(
      async ({ stores, mode }) => {
        const shellModule = (await import(`${stores}/ui-shell-store.ts`)) as {
          useUiShellStore: {
            getState: () => {
              setMode: (next: string) => void;
              setSubMode: (next: string) => void;
            };
          };
        };
        shellModule.useUiShellStore.getState().setMode(mode);
        shellModule.useUiShellStore.getState().setSubMode("manual");
      },
      { stores: STORES, mode },
    );
    for (let i = 0; i < 6; i += 1) {
      const has = await page.locator("text=Loading workspace...").count();
      if (has > 0) fallbackSeen.push(`${mode}@${i * 150}ms`);
      await page.waitForTimeout(150);
    }
  }

  console.log(`FLASH_RESULT flashes=${fallbackSeen.length} ${JSON.stringify(fallbackSeen)}`);
});
