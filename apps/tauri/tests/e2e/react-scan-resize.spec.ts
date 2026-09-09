import { expect, test, type Page } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — sidebar resize drag measurement.
// Drags the LEFT sidebar resize handle over ~30 mousemove steps while
// capturing long tasks + DashboardPage render count (react-scan mirror).
// The resize is the gesture from the user's optimize-tab dataset.
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-resize.spec.ts --project=chromium --workers=1

import {
  collectLongTasksSince,
  collectProblems,
  installLongTaskCollector,
  markLongTasks,
  probeLaunchOptions,
  setProbeManualStageAtRender,
  setShellMode,
} from "./probe-helpers";
import { injectProbeFixture } from "./probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

const snapshotAndClear = async (page: Page): Promise<number> =>
  page.evaluate(() => {
    const win = window as unknown as {
      __komaReactScan?: {
        events: () => Array<{ name: string | null }>;
        clear: () => void;
      };
    };
    if (!win.__komaReactScan) return 0;
    const events = win.__komaReactScan.events();
    win.__komaReactScan.clear();
    return events.filter((event) => event.name === "DashboardPage").length;
  });

test("sidebar resize drag — long tasks + page renders", async ({ page }) => {
  test.setTimeout(150_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);

  await injectProbeFixture(page, [
    { id: "probe-region-1", bbox: [300, 260, 800, 400], renderText: "REGION 1 TEXT" },
  ]);
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(900);

  const handle = page.locator(".koma-sidebar-resize-handle--right").first();
  await expect(handle).toBeVisible();
  const rect = await handle.boundingBox();
  expect(rect).not.toBeNull();
  const startX = rect!.x + rect!.width / 2;
  const startY = rect!.y + rect!.height / 2;

  // Drag the handle left by 120px in 30 steps (4px each) — a realistic resize.
  // Clear the mirror first so the window holds only the drag's own renders.
  await page.evaluate(() => {
    const win = window as unknown as {
      __komaReactScan?: { clear: () => void };
    };
    win.__komaReactScan?.clear();
  });
  const mark = await markLongTasks(page);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 30; step += 1) {
    await page.mouse.move(startX - step * 4, startY);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);

  const tasks = await collectLongTasksSince(page, mark);
  const pageRenders = await snapshotAndClear(page);
  const worst = Math.max(0, ...tasks.map((task) => task.duration));
  console.log(
    `RESIZE drag: tasks=${tasks.length} worst=${worst.toFixed(1)}ms pageRenders=${pageRenders}`,
  );

  // Sanity: the sidebar actually changed width (state committed on mouseup).
  const width = await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>(".koma-dash__sidebar");
    return aside ? aside.getBoundingClientRect().width : -1;
  });
  console.log(`RESIZE final-width: ${width.toFixed(0)}px`);
  expect(width).toBeGreaterThan(100);

  expect(
    problems,
    "no pageerrors/app console errors during resize probe",
  ).toEqual([]);
});
