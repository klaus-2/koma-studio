import { expect, test, type Page } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — FPS-agent-1 route-transition window.
// User's react-scan Optimize tab signature: DashboardPage 2r/518ms SELF during
// a route transition involving /#/model-rankings, with PageTransition overlay
// active (SpeedLines/Particles are PageTransition children) and
// DashboardMainLayout re-rendering with churned props (specialModeStageProps,
// processingStats, handleDownload, modelManagerState, fontCatalogLoading,
// handleClean, processTranslatorVisual, stitchBatchPlans).
//
// Windows: away (dashboard -> model-rankings), back (model-rankings ->
// dashboard, the remount), and a second away/back to check stability. The
// mirror buffer is CLEARED right before each measured gesture; a store-write
// recorder correlates renders with writes.
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-transition.spec.ts --project=chromium --workers=1

import {
  collectLongTasksSince,
  collectProblems,
  installLongTaskCollector,
  injectProbeFixture,
  markLongTasks,
  probeLaunchOptions,
  setProbeManualStageAtRender,
  setShellMode,
} from "./probe-helpers";

test.use({
  viewport: { width: 1760, height: 1320 },
  launchOptions: probeLaunchOptions(),
});

interface ScanEvent {
  t: number;
  name: string | null;
  count: number;
  time: number;
  changes: number;
}

const snapshotAndClear = async (page: Page): Promise<ScanEvent[]> =>
  page.evaluate(() => {
    const win = window as unknown as {
      __komaReactScan?: { events: () => ScanEvent[]; clear: () => void };
    };
    if (!win.__komaReactScan) return [];
    const events = win.__komaReactScan.events();
    win.__komaReactScan.clear();
    return events;
  });

const clearBuffer = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const win = window as unknown as {
      __komaReactScan?: { clear: () => void };
    };
    win.__komaReactScan?.clear();
  });
};

const aggregate = (events: ScanEvent[]): string => {
  const out = new Map<string, { renders: number; time: number }>();
  for (const event of events) {
    if (event.name === null || event.name.startsWith("MARK:")) continue;
    const slot = out.get(event.name) ?? { renders: 0, time: 0 };
    slot.renders += 1;
    slot.time += event.time;
    out.set(event.name, slot);
  }
  const targets = [
    "DashboardPage",
    "DashboardMainLayout",
    "DashboardStageSection",
    "KomaTopbar2",
    "DashboardLeftSidebar",
    "DashboardFooter",
    "AioRightPanel",
    "PageTransition",
    "SpeedLines",
    "Particles",
  ];
  const targeted = targets
    .map((name) => {
      const slot = out.get(name);
      return slot ? `${name}(${slot.renders}r ${slot.time.toFixed(0)}ms)` : null;
    })
    .filter(Boolean)
    .join(" | ");
  const top = [...out.entries()]
    .filter(
      ([name]) =>
        !name.startsWith("Tooltip") &&
        !name.startsWith("Primitive") &&
        !name.startsWith("Popper") &&
        name !== "Presence",
    )
    .sort((a, b) => b[1].time - a[1].time || b[1].renders - a[1].renders)
    .slice(0, 14)
    .map(
      ([name, agg]) => `${name}(${agg.renders}r ${agg.time.toFixed(0)}ms)`,
    )
    .join(" | ");
  return `TARGETED ${targeted} || TOP ${top}`;
};

const STORES =
  "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

const installStoreRecorder = async (page: Page): Promise<void> => {
  await page.evaluate(async ({ stores }) => {
    const names = [
      "image-collection-store",
      "region-editor-store",
      "aio-pipeline-store",
      "cleaner-store",
      "ui-shell-store",
      "manual-tools-store",
      "export-store",
      "translator-store",
      "utility-store",
      "workspace-persistence-store",
      "status-store",
      "auth-account-store",
      "llm-providers-store",
    ] as const;
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string; keys: string }>;
    };
    win.__komaStoreWrites = [];
    for (const name of names) {
      try {
        const mod = (await import(`${stores}/${name}.ts`)) as {
          [key: string]: { subscribe: (cb: (s: unknown, p: unknown) => void) => () => void };
        };
        const storeHookKey = Object.keys(mod).find((key) =>
          key.startsWith("use"),
        );
        const storeModule = storeHookKey !== undefined ? mod[storeHookKey] : undefined;
        if (!storeModule) continue;
        storeModule.subscribe((state: unknown, prevState: unknown) => {
          const log = window as unknown as {
            __komaStoreWrites?: Array<{ t: number; store: string; keys: string }>;
          };
          let keys = "?";
          try {
            const changed: string[] = [];
            const s = state as Record<string, unknown>;
            const p = (prevState ?? {}) as Record<string, unknown>;
            for (const key of Object.keys(s)) {
              if (s[key] !== p[key]) changed.push(key);
            }
            keys = changed.join(",") || "(none)";
          } catch {
            keys = "(diff-failed)";
          }
          log.__komaStoreWrites?.push({
            t: performance.now(),
            store: name,
            keys,
          });
        });
      } catch {
        // store module unavailable in web e2e — skip
      }
    }
  }, { stores: STORES });
};

const dumpWriteTimeline = async (page: Page): Promise<string> => {
  const writes = await page.evaluate(() => {
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string; keys: string }>;
    };
    return (win.__komaStoreWrites ?? []).map(
      (write) =>
        `${write.store.replace("-store", "")}@${write.t.toFixed(0)}[${write.keys}]`,
    );
  });
  await page.evaluate(() => {
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string }>;
    };
    if (win.__komaStoreWrites) win.__komaStoreWrites.length = 0;
  });
  return writes.join(" ");
};

test("route transition dashboard <-> model-rankings", async ({ page }) => {
  test.setTimeout(180_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);

  await injectProbeFixture(
    page,
    [1, 2].map((n) => ({
      id: `probe-region-${n}`,
      bbox: [300 + n * 40, 260, 800 + n * 40, 400] as [
        number,
        number,
        number,
        number,
      ],
      renderText: `REGION ${n} TEXT`,
    })),
  );
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(900);
  await installStoreRecorder(page);

  // ── W1: away (dashboard -> model-rankings) ──
  await clearBuffer(page);
  let mark = await markLongTasks(page);
  await page.evaluate(() => {
    window.__komaReactScan?.mark("away:start");
  });
  await page.goto("/#/model-rankings");
  await page.waitForTimeout(2600);
  const awayEvents = await snapshotAndClear(page);
  const awayTasks = await collectLongTasksSince(page, mark);
  console.log(
    `AWAY renders: ${aggregate(awayEvents)} tasks=${awayTasks.length} worst=${Math.max(0, ...awayTasks.map((task) => task.duration)).toFixed(0)}ms`,
  );
  console.log(`AWAY writes: ${await dumpWriteTimeline(page)}`);

  // ── W2: back (model-rankings -> dashboard, the remount) ──
  await clearBuffer(page);
  mark = await markLongTasks(page);
  await page.evaluate(() => {
    window.__komaReactScan?.mark("back:start");
  });
  await page.goto("/#/dashboard");
  await page.waitForTimeout(3500);
  const backEvents = await snapshotAndClear(page);
  const backTasks = await collectLongTasksSince(page, mark);
  console.log(
    `BACK renders: ${aggregate(backEvents)} tasks=${backTasks.length} worst=${Math.max(0, ...backTasks.map((task) => task.duration)).toFixed(0)}ms`,
  );
  const pageRenders = backEvents
    .filter((event) => event.name === "DashboardPage")
    .map((event) => `r@${event.t.toFixed(0)} ${event.time.toFixed(0)}ms ch=${event.changes}`)
    .join(" | ");
  console.log(`BACK page-renders: ${pageRenders}`);
  const layoutRenders = backEvents
    .filter((event) => event.name === "DashboardMainLayout")
    .map((event) => `r@${event.t.toFixed(0)} ch=${event.changes}`)
    .join(" | ");
  console.log(`BACK layout-renders: ${layoutRenders}`);
  console.log(`BACK writes: ${await dumpWriteTimeline(page)}`);
  console.log(
    `BACK tasks: ${backTasks.map((task) => `task@${task.startTime.toFixed(0)} ${task.duration.toFixed(0)}ms`).join(" ")}`,
  );

  // ── W3: second away (model-rankings page open, does it keep burning?) ──
  await clearBuffer(page);
  mark = await markLongTasks(page);
  await page.goto("/#/model-rankings");
  await page.waitForTimeout(2600);
  const away2Events = await snapshotAndClear(page);
  const away2Tasks = await collectLongTasksSince(page, mark);
  console.log(
    `AWAY2 renders: ${aggregate(away2Events)} tasks=${away2Tasks.length} worst=${Math.max(0, ...away2Tasks.map((task) => task.duration)).toFixed(0)}ms`,
  );

  // ── W4: idle on model-rankings (no navigation — sustained animation cost?) ──
  await clearBuffer(page);
  mark = await markLongTasks(page);
  await page.waitForTimeout(2000);
  const idleEvents = await snapshotAndClear(page);
  const idleTasks = await collectLongTasksSince(page, mark);
  console.log(
    `RANKINGS-IDLE renders: ${aggregate(idleEvents)} tasks=${idleTasks.length} worst=${Math.max(0, ...idleTasks.map((task) => task.duration)).toFixed(0)}ms`,
  );

  expect(
    problems,
    "no pageerrors/app console errors during transition probe",
  ).toEqual([]);
});
