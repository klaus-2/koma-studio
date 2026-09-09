import { expect, test, type Browser, type TestInfo } from "@playwright/test";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

interface E2eScenario {
  id: string;
  area: string;
  title: string;
  route: string;
  success: string;
  visual: boolean;
}

const scenariosJson = JSON.parse(
  fsSync.readFileSync(new URL("./e2e-scenarios.json", import.meta.url), "utf8"),
) as E2eScenario[];
const scenarios = scenariosJson.filter(
  (scenario) => scenario.visual,
);
const visualCompareEnabled = process.env.PLAYWRIGHT_VISUAL_COMPARE === "1";
const v1Port = process.env.PLAYWRIGHT_V1_PORT ?? "5174";
const v1BaseUrl =
  process.env.PLAYWRIGHT_V1_BASE_URL ?? `http://127.0.0.1:${v1Port}`;
const v2BaseUrl =
  process.env.PLAYWRIGHT_V2_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:5173";
const maxDiffRatio = Number(process.env.PLAYWRIGHT_VISUAL_MAX_DIFF ?? "0.02");
const visualStabilityCss = `
  .auth-shell__video {
    visibility: hidden !important;
  }

  .manhwa-float,
  .manhwa-float::after,
  .manhwa-float__before-wrap,
  .manhwa-float__bar,
  .koma-neko img,
  .auth-brand__icon::before,
  .auth-brand__mark {
    animation: none !important;
    transition: none !important;
  }

  .manhwa-float__before-wrap {
    clip-path: inset(0 70% 0 0) !important;
  }

  .manhwa-float__bar {
    left: 30% !important;
  }

  .koma-neko img:not(:first-child) {
    opacity: 0 !important;
  }
`;

test.describe("v1/v2 visual regression", () => {
  test.skip(
    !visualCompareEnabled,
    "Set PLAYWRIGHT_VISUAL_COMPARE=1 to run v1/v2 screenshot diffs.",
  );

  for (const scenario of scenarios) {
    test(`${scenario.id}: ${scenario.title}`, async ({ browser }, testInfo) => {
      const v1Screenshot = await captureScenario(
        browser,
        v1BaseUrl,
        scenario,
        "v1",
        testInfo,
      );
      const v2Screenshot = await captureScenario(
        browser,
        v2BaseUrl,
        scenario,
        "v2",
        testInfo,
      );
      const result = await compareScreenshots(v1Screenshot, v2Screenshot, testInfo);

      expect(
        result.diffRatio,
        `${scenario.id} visual diff ${(result.diffRatio * 100).toFixed(2)}% exceeded ${(maxDiffRatio * 100).toFixed(2)}%; diff=${result.diffPath}`,
      ).toBeLessThanOrEqual(maxDiffRatio);
    });
  }
});

async function captureScenario(
  browser: Browser,
  baseUrl: string,
  scenario: E2eScenario,
  label: "v1" | "v2",
  testInfo: TestInfo,
): Promise<string> {
  const page = await browser.newPage({
    viewport: { width: 1365, height: 768 },
    deviceScaleFactor: 1,
  });
  const screenshotPath = testInfo.outputPath(`${scenario.id}-${label}.png`);

  try {
    await page.goto(toScenarioUrl(baseUrl, scenario.route), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await page.addStyleTag({ content: visualStabilityCss });
    await page
      .evaluate(() => document.fonts?.ready ?? Promise.resolve())
      .catch(() => undefined);
    await expect(page.locator(".koma-transition")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator(".koma-route-shell__fallback")).toHaveCount(0, {
      timeout: 15_000,
    });
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
      null,
      { timeout: 15_000 },
    );
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    });
  } finally {
    await page.close();
  }

  return screenshotPath;
}

async function compareScreenshots(
  v1Screenshot: string,
  v2Screenshot: string,
  testInfo: TestInfo,
): Promise<{ diffPath: string; diffRatio: number }> {
  const v1 = PNG.sync.read(await fs.readFile(v1Screenshot));
  const v2 = PNG.sync.read(await fs.readFile(v2Screenshot));

  expect(v2.width).toBe(v1.width);
  expect(v2.height).toBe(v1.height);

  const diff = new PNG({ width: v1.width, height: v1.height });
  const diffPixels = pixelmatch(
    v1.data,
    v2.data,
    diff.data,
    v1.width,
    v1.height,
    { threshold: 0.2 },
  );
  const diffPath = testInfo.outputPath(
    `${path.basename(v1Screenshot, ".png")}-diff.png`,
  );
  await fs.writeFile(diffPath, PNG.sync.write(diff));

  return {
    diffPath,
    diffRatio: diffPixels / (v1.width * v1.height),
  };
}

function toScenarioUrl(baseUrl: string, route: string): string {
  return new URL(route, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}
