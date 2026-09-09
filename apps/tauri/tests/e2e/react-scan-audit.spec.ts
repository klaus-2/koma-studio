import { expect, test, type Page } from "@playwright/test";

// react-scan audit probe — temporary, untracked. Walks the dashboard through
// the same interactions as the interaction sweep while the react-scan init
// (packages/interface/src/react-scan-init.ts) mirrors every render into
// window.__komaReactScan. Each scenario snapshots + clears the buffer so the
// in-page cap never binds; aggregates per-interaction render windows
// (count/time/unnecessary per component) and dumps them for analysis.
// Measurement-only: asserts nothing about the numbers, only that the page
// never errors and react-scan actually collected events.
//
// Run (from apps/tauri): bunx playwright test tests/e2e/react-scan-audit.spec.ts --project=chromium --workers=1

import {
  collectProblems,
  injectProbeFixture,
  logGpuMode,
  probeLaunchOptions,
  selectProbeRegion,
  setProbeManualStageAtRender,
  setShellMode,
} from "./probe-helpers";

const MODES = ["aio", "typesetter", "cleaner", "watermark", "aio"] as const;

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

interface ScanEvent {
  t: number;
  name: string | null;
  count: number;
  time: number;
  unnecessary: boolean | null;
  changes: number;
}

interface ScanApi {
  mark: (label: string) => void;
  events: () => ScanEvent[];
  clear: () => void;
}

const mark = async (page: Page, label: string): Promise<void> => {
  await page.evaluate((text) => {
    const win = window as unknown as { __komaReactScan?: ScanApi };
    win.__komaReactScan?.mark(text);
  }, label);
};

// Snapshot everything since the last snapshot and clear the in-page buffer.
const snapshotAndClear = async (page: Page): Promise<ScanEvent[]> =>
  page.evaluate(() => {
    const win = window as unknown as { __komaReactScan?: ScanApi };
    if (!win.__komaReactScan) return [];
    return win.__komaReactScan.events();
  }).then(async (events) => {
    await page.evaluate(() => {
      const win = window as unknown as { __komaReactScan?: ScanApi };
      win.__komaReactScan?.clear();
    });
    return events;
  });

interface Agg {
  renders: number;
  count: number;
  timeMs: number;
  unnecessaryRenders: number;
  unnecessaryTimeMs: number;
  changes: number;
}

const aggregate = (events: ScanEvent[]): Record<string, Agg> => {
  const out: Record<string, Agg> = {};
  for (const event of events) {
    if (event.name === null || event.name.startsWith("MARK:")) continue;
    const slot = (out[event.name] ??= {
      renders: 0,
      count: 0,
      timeMs: 0,
      unnecessaryRenders: 0,
      unnecessaryTimeMs: 0,
      changes: 0,
    });
    slot.renders += 1;
    slot.count += event.count;
    slot.timeMs += event.time;
    slot.changes += event.changes;
    if (event.unnecessary === true) {
      slot.unnecessaryRenders += event.count;
      slot.unnecessaryTimeMs += event.time;
    }
  }
  return out;
};

const report: Record<string, Record<string, Agg>> = {};

const snapshotWindow = async (
  page: Page,
  label: string,
): Promise<void> => {
  await mark(page, `${label}:end`);
  const events = await snapshotAndClear(page);
  if (events.length === 0) {
    console.log(`SCAN ${label}: (no events)`);
    return;
  }
  report[label] = aggregate(events);
  const top = Object.entries(report[label]!)
    .sort(
      (a, b) =>
        b[1].unnecessaryRenders - a[1].unnecessaryRenders ||
        b[1].timeMs - a[1].timeMs,
    )
    .slice(0, 8)
    .map(
      ([name, agg]) =>
        `${name}(${agg.renders}r ${agg.timeMs.toFixed(0)}ms ${agg.unnecessaryRenders}unnec)`,
    );
  console.log(`SCAN ${label}: ${top.join(" | ")}`);
};

test("react-scan audit — per-interaction render windows", async ({ page }) => {
  test.setTimeout(150_000);
  const problems = collectProblems(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);
  const gpu = await logGpuMode(page, "react-scan-audit");

  const scanApiActive = await page.evaluate(() => {
    const win = window as unknown as { __komaReactScan?: ScanApi };
    return typeof win.__komaReactScan?.mark === "function";
  });
  expect(scanApiActive, "react-scan init must be active on the dev server").toBe(true);

  // Boot = everything accumulated before this snapshot.
  await snapshotWindow(page, "boot");

  await mark(page, "fixture:start");
  await injectProbeFixture(
    page,
    [1, 2, 3, 4, 5].map((n) => ({
      id: `probe-region-${n}`,
      bbox: [200 + n * 20, 200, 500 + n * 20, 320] as [
        number,
        number,
        number,
        number,
      ],
      renderText: `REGION ${n} TEXT`,
    })),
  );
  // Mode FIRST, then the manual-stage jump: entering aio resets the per-image
  // manual progress, so the render-stage jump only sticks afterwards.
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(700);
  await snapshotWindow(page, "fixture");

  await setShellMode(page, "aio");
  await page.waitForTimeout(900);

  // Drag window: select (first click), then pointerdown + 20 moves at 40ms +
  // pointerup — the gesture the rAF commit machinery protects. Runs before
  // any store-driven region selection: after a selection the stage DOM
  // changes and .koma-render-box is no longer present.
  const box = page.locator('.koma-render-box[data-region-id="probe-region-2"]');
  await expect(box).toBeVisible();
  const rect = await box.boundingBox();
  expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.waitForTimeout(300);
  await mark(page, "drag:start");
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(
      rect!.x + rect!.width / 2 + step * 6,
      rect!.y + rect!.height / 2 + step * 3,
    );
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
  await snapshotWindow(page, "drag");

  for (const mode of MODES.slice(1)) {
    await mark(page, `mode:${mode}:start`);
    await setShellMode(page, mode);
    await page.waitForTimeout(800);
    await snapshotWindow(page, `mode:${mode}`);
  }

  for (let n = 1; n <= 5; n += 1) {
    await mark(page, `region-select:${n}:start`);
    await selectProbeRegion(page, `probe-region-${n}`);
    await page.waitForTimeout(400);
    await snapshotWindow(page, `region-select:${n}`);
  }

  for (const route of ["settings", "model-rankings", "dashboard"]) {
    await mark(page, `route:${route}:start`);
    await page.goto(`/#/${route}`);
    await page.waitForTimeout(1200);
    await snapshotWindow(page, `route:${route}`);
  }

  const fs = await import("node:fs/promises");
  const outPath = new URL("./.artifacts/react-scan-audit.json", import.meta.url);
  await fs.writeFile(outPath, JSON.stringify({ gpu: gpu.mode, windows: report }, null, 2));
  console.log(`SCAN_ARTIFACT ${outPath.href}`);

  expect(problems, "no pageerrors/app console errors during audit").toEqual([]);
});
