import { expect, test, type Page } from "@playwright/test";

// FPS-agent-5 LoAF probe (untracked) — non-React attribution via
// PerformanceObserver `long-animation-frame` (LoAF) + `longtask`.
//
// The user's react-scan Optimize tab shows windows with react≈0ms and a large
// "other" bucket (effects/observers, canvas raster, CSS animation, layout,
// paint). react-scan cannot attribute those — LoAF can: each entry carries
// duration, blockingDuration, styleDuration, layoutDuration, paintDuration,
// scriptDuration and attributedScripts (sourceURL/charPosition).
//
// Windows (dashboard interactions from the census):
//   SWITCH-AIO: organize -> aio mode switch (mount of the aio stage)
//   SWITCH-TYPES: typesetter mode switch
//   SELECT-1: first region selection (click on .koma-render-box)
//   DRAG-20: pointerdown + 20 moves with 40ms pauses + pointerup
//   RETURN: /#/model-rankings -> /#/dashboard remount (Fase-2a class)
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-loaf.spec.ts --project=chromium --workers=1

import {
  collectProblems,
  injectProbeFixture,
  installLongTaskCollector,
  markLongTasks,
  collectLongTasksSince,
  probeLaunchOptions,
  setProbeManualStageAtRender,
  setShellMode,
} from "./probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

// Installs the LoAF observer in the page. Captures the aggregate durations +
// the top attributed scripts (by name) per entry. Long tasks come from the
// probe-helpers collector.
const installLoafCollector = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __komaLoaf?: Array<{
        startTime: number;
        duration: number;
        blocking: number;
        script: number;
        style: number;
        layout: number;
        paint: number;
        scripts: string[];
      }>;
      __komaLoafShape?: string;
    };
    win.__komaLoaf = [];
    win.__komaLoafShape = "not-yet";
    try {
      const observer = new PerformanceObserver((list) => {
        const target = window as unknown as {
          __komaLoaf?: Array<{
            startTime: number;
            duration: number;
            blocking: number;
            script: number;
            style: number;
            layout: number;
            paint: number;
            scripts: string[];
          }>;
          __komaLoafShape?: string;
        };
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & {
            blockingDuration?: number;
            styleDuration?: number;
            layoutDuration?: number;
            paintDuration?: number;
            scriptDuration?: number;
            scripts?: Array<{
              name?: string;
              duration?: number;
              invoker?: string;
              invokerType?: string;
              sourceURL?: string;
              sourceFunctionName?: string;
              sourceCharPosition?: number;
            }>;
          };
          const scripts = (e.scripts ?? [])
            .map((script) => {
              const url = script.sourceURL ?? script.name ?? "";
              const file = url.split("/").pop() ?? url;
              const fn = script.invoker ?? script.sourceFunctionName ?? "";
              const invokerType = script.invokerType ?? "";
              return `${file}${
                script.sourceCharPosition !== undefined
                  ? `@${script.sourceCharPosition}`
                  : ""
              }${fn ? `:${fn}` : ""}${invokerType ? `(${invokerType})` : ""}=${script.duration ?? 0}ms`;
            })
            .slice(0, 12);
          if (target.__komaLoafShape === "not-yet") {
            const protoNames = Object.getOwnPropertyNames(
              Object.getPrototypeOf(entry) ?? {},
            );
            const values = [
              "duration",
              "startTime",
              "blockingDuration",
              "styleDuration",
              "layoutDuration",
              "paintDuration",
              "scriptDuration",
            ]
              .map((k) => {
                try {
                  return `${k}=${(entry as unknown as Record<string, number>)[k]}`;
                } catch {
                  return `${k}=?`;
                }
              })
              .join(" ");
            target.__komaLoafShape = `${entry.constructor?.name ?? "?"} proto=[${protoNames.join(",")}] ${values}`;
          }
          target.__komaLoaf?.push({
            startTime: entry.startTime,
            duration: entry.duration,
            blocking: e.blockingDuration ?? 0,
            script: e.scriptDuration ?? 0,
            style: e.styleDuration ?? 0,
            layout: e.layoutDuration ?? 0,
            paint: e.paintDuration ?? 0,
            scripts,
          });
        }
      });
      observer.observe({ entryTypes: ["long-animation-frame"] });
    } catch {
      // LoAF unsupported — collector stays empty (longtask still works).
    }
  });
};

interface LoafEntry {
  startTime: number;
  duration: number;
  blocking: number;
  script: number;
  style: number;
  layout: number;
  paint: number;
  scripts: string[];
}

const collectLoafSince = async (
  page: Page,
  mark: number,
): Promise<LoafEntry[]> => {
  const all = await page.evaluate(() => {
    const win = window as unknown as {
      __komaLoaf?: LoafEntry[];
    };
    return win.__komaLoaf ?? [];
  });
  return all.slice(mark);
};

const loafMark = async (page: Page): Promise<number> =>
  page.evaluate(() => {
    const win = window as unknown as { __komaLoaf?: LoafEntry[] };
    return win.__komaLoaf?.length ?? 0;
  });

// Summary line per window: count, worst, medians of durations, and a ranked
// attribution of where the time went (script/style/layout/paint buckets +
// top attributed scripts aggregated by source file).
const summarizeLoaf = (entries: LoafEntry[], label: string): string => {
  if (entries.length === 0) return `${label}: 0 LoAF`;
  const durations = entries.map((e) => e.duration).sort((a, b) => a - b);
  const worst = durations[durations.length - 1] ?? 0;
  const median = durations[Math.floor(durations.length / 2)] ?? 0;
  const totals = entries.reduce(
    (acc, e) => ({
      script: acc.script + e.script,
      style: acc.style + e.style,
      layout: acc.layout + e.layout,
      paint: acc.paint + e.paint,
      blocking: acc.blocking + e.blocking,
    }),
    { script: 0, style: 0, layout: 0, paint: 0, blocking: 0 },
  );
  const scriptFiles = new Map<string, number>();
  for (const entry of entries) {
    for (const line of entry.scripts) {
      const match = /^(.*)=([\d.]+)ms$/.exec(line);
      if (!match) continue;
      const file = match[1]?.split("@")[0] ?? "unknown";
      scriptFiles.set(
        file,
        (scriptFiles.get(file) ?? 0) + Number.parseFloat(match[2] ?? "0"),
      );
    }
  }
  const topScripts = [...scriptFiles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([file, ms]) => `${file}=${ms.toFixed(0)}ms`)
    .join(" ");
  return (
    `${label}: n=${entries.length} worst=${worst.toFixed(0)}ms med=${median.toFixed(0)}ms ` +
    `buckets script=${totals.script.toFixed(0)} style=${totals.style.toFixed(0)} ` +
    `layout=${totals.layout.toFixed(0)} paint=${totals.paint.toFixed(0)} ` +
    `blocking=${totals.blocking.toFixed(0)} || scripts ${topScripts || "(none)"}`
  );
};

const taskSummary = (
  tasks: Array<{ duration: number; startTime: number }>,
  label: string,
): string =>
  `${label}: n=${tasks.length} worst=${Math.max(0, ...tasks.map((t) => t.duration)).toFixed(0)}ms ` +
  `[${tasks.map((t) => `${t.duration.toFixed(0)}@${t.startTime.toFixed(0)}`).join(" ")}]`;

test("loaf attribution over dashboard interactions", async ({ page }) => {
  test.setTimeout(300_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);
  await installLoafCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);

  await injectProbeFixture(page, [
    {
      id: "probe-region-1",
      bbox: [400, 300, 900, 420],
      renderText: "KOMA LOAF TEST TEXT",
    },
    {
      id: "probe-region-2",
      bbox: [1000, 300, 1400, 420],
      renderText: "REGION TWO",
    },
  ]);
  await page.waitForTimeout(700);

  // ── W1: SWITCH-AIO (organize -> aio) ──
  const shape = await page.evaluate(() => {
    const win = window as unknown as { __komaLoafShape?: string };
    return win.__komaLoafShape ?? "none";
  });
  console.log(`LOAF-SHAPE: ${shape}`);
  const w1Task = await markLongTasks(page);
  const w1Loaf = await loafMark(page);
  await setShellMode(page, "aio");
  await page.waitForTimeout(1200);
  const w1Tasks = await collectLongTasksSince(page, w1Task);
  const w1L = await collectLoafSince(page, w1Loaf);
  console.log(taskSummary(w1Tasks, "SWITCH-AIO tasks"));
  console.log(summarizeLoaf(w1L, "SWITCH-AIO loaf"));
  console.log(
    "SWITCH-AIO top-entries:",
    w1L
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map(
        (e) =>
          `d=${e.duration.toFixed(0)} scr=${e.script.toFixed(0)} st=${e.style.toFixed(0)} lay=${e.layout.toFixed(0)} pnt=${e.paint.toFixed(0)} [${e.scripts.join(" ; ")}]`,
      )
      .join(" || "),
  );

  // ── W2: stage at render ──
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(900);

  // ── W3: SWITCH-TYPES (aio -> typesetter) ──
  const w3Task = await markLongTasks(page);
  const w3Loaf = await loafMark(page);
  await setShellMode(page, "typesetter");
  await page.waitForTimeout(1200);
  const w3Tasks = await collectLongTasksSince(page, w3Task);
  const w3L = await collectLoafSince(page, w3Loaf);
  console.log(taskSummary(w3Tasks, "SWITCH-TYPES tasks"));
  console.log(summarizeLoaf(w3L, "SWITCH-TYPES loaf"));
  console.log(
    "SWITCH-TYPES top-entries:",
    w3L
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map(
        (e) =>
          `d=${e.duration.toFixed(0)} scr=${e.script.toFixed(0)} st=${e.style.toFixed(0)} lay=${e.layout.toFixed(0)} pnt=${e.paint.toFixed(0)} [${e.scripts.join(" ; ")}]`,
      )
      .join(" || "),
  );
  // back to aio render stage for the select/drag windows
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(900);

  // ── W4: SELECT-1 (first region selection click) ──
  const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
  await expect(box).toBeVisible();
  const w4Task = await markLongTasks(page);
  const w4Loaf = await loafMark(page);
  await box.click();
  await page.waitForTimeout(900);
  const w4Tasks = await collectLongTasksSince(page, w4Task);
  const w4L = await collectLoafSince(page, w4Loaf);
  console.log(taskSummary(w4Tasks, "SELECT-1 tasks"));
  console.log(summarizeLoaf(w4L, "SELECT-1 loaf"));

  // ── W5: DRAG-20 (pointerdown + 20 moves @40ms + pointerup) ──
  const rect = await box.boundingBox();
  expect(rect, "region box rect for drag").not.toBeNull();
  if (!rect) throw new Error("probe: no box rect");
  const w5Task = await markLongTasks(page);
  const w5Loaf = await loafMark(page);
  await page.mouse.down();
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(
      rect.x + rect.width / 2 + step * 15,
      rect.y + rect.height / 2 + step * 10,
    );
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  const w5Tasks = await collectLongTasksSince(page, w5Task);
  const w5L = await collectLoafSince(page, w5Loaf);
  console.log(taskSummary(w5Tasks, "DRAG-20 tasks"));
  console.log(summarizeLoaf(w5L, "DRAG-20 loaf"));
  console.log(
    "DRAG-20 top-entries:",
    w5L
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map(
        (e) =>
          `d=${e.duration.toFixed(0)} scr=${e.script.toFixed(0)} st=${e.style.toFixed(0)} lay=${e.layout.toFixed(0)} pnt=${e.paint.toFixed(0)} [${e.scripts.join(" ; ")}]`,
      )
      .join(" || "),
  );

  // deselect for a clean RETURN
  await page.locator(".koma-stage, #root").click({ position: { x: 10, y: 400 } }).catch(() => undefined);
  await page.waitForTimeout(400);

  // ── W6: RETURN (dashboard -> rankings -> dashboard) ──
  await page.evaluate(() => {
    (window as unknown as { __komaProbeAlive?: boolean }).__komaProbeAlive =
      true;
    (window as unknown as { __komaLoafStart?: number }).__komaLoafStart =
      performance.now();
  });
  await page.goto("/#/model-rankings");
  await page.waitForTimeout(2200);
  const w6Task = await markLongTasks(page);
  const w6Loaf = await loafMark(page);
  await page.goto("/#/dashboard");
  await page.waitForTimeout(3200);
  const w6Tasks = await collectLongTasksSince(page, w6Task);
  const w6L = await collectLoafSince(page, w6Loaf);
  const w6Alive = await page.evaluate(() => {
    const win = window as unknown as { __komaProbeAlive?: boolean };
    return win.__komaProbeAlive === true;
  });
  const w6Resources = await page.evaluate(() => {
    const win = window as unknown as { __komaLoafStart?: number };
    const start = win.__komaLoafStart ?? 0;
    return performance
      .getEntriesByType("resource")
      .filter((r) => r.startTime >= start)
      .map((r) => `${(r as PerformanceResourceTiming).name.split("/").pop()}=${(r as PerformanceResourceTiming).duration.toFixed(0)}ms`)
      .slice(-15)
      .join(" ");
  });
  console.log(`RETURN same-doc=${w6Alive}`);
  console.log(`RETURN resources-during-window: ${w6Resources || "(none)"}`);
  console.log(taskSummary(w6Tasks, "RETURN tasks"));
  console.log(summarizeLoaf(w6L, "RETURN loaf"));
  console.log(
    "RETURN top-entries:",
    w6L
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 4)
      .map(
        (e) =>
          `d=${e.duration.toFixed(0)} scr=${e.script.toFixed(0)} st=${e.style.toFixed(0)} lay=${e.layout.toFixed(0)} pnt=${e.paint.toFixed(0)} [${e.scripts.join(" ; ")}]`,
      )
      .join(" || "),
  );
  console.log(
    "SWITCH-AIO full-scripts:",
    w1L
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 2)
      .map((e) => `[${e.scripts.join(" ; ")}]`)
      .join(" || "),
  );

  // ── W7: IDLE (dashboard idle 5s — sustained non-React cost?) ──
  const w7Task = await markLongTasks(page);
  const w7Loaf = await loafMark(page);
  await page.waitForTimeout(5000);
  const w7Tasks = await collectLongTasksSince(page, w7Task);
  const w7L = await collectLoafSince(page, w7Loaf);
  console.log(taskSummary(w7Tasks, "IDLE-5S tasks"));
  console.log(summarizeLoaf(w7L, "IDLE-5S loaf"));

  expect(
    problems,
    "no pageerrors/app console errors during LoAF probe",
  ).toEqual([]);
});
