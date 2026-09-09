import { expect, test, type Page } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — FPS-agent-3 processingStats window.
// User's react-scan Optimize tab signature (FPS-drop window, react 180ms +
// other 249ms): DashboardLeftSidebar 1r with processingStats:1x;
// DashboardMainLayout 1r with processingStats+handleDownload+handleClean+
// processTranslatorVisual each 1x; DashboardPage 1r with own-state hooks
// 364:1x + 365:1x; KomaTopbar onDownload:1x.
//
// Windows per run:
//   PROC-FLIP     = ui-shell processing true→false (the start/end of every
//                   processing run) — isolates the syncDiscordForTab churn
//                   path (handleClean/processTranslatorVisual deps).
//   TICK-95S      = idle observation over the stats hook's 30s-aligned
//                   interval (≥3 ticks incl. ≥1 wall-clock minute boundary)
//                   — isolates the periodic processingStats recompute churn.
//   STATS-GENUINE = seed localStorage counts for a fresh userKey (auth
//                   store user set after seeding) → the stats hook's userKey
//                   effect ingests REAL new counts — the sidebar MUST update
//                   (zero-behavior-change witness for the guards).
//
// Store-write recorder with per-write key diff (first-selection pattern).
// Runs PROC_RERUNS times in-process (default 1) for medians.
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-processing.spec.ts --project=chromium --workers=1

import {
  collectLongTasksSince,
  collectProblems,
  injectProbeFixture,
  installLongTaskCollector,
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

const RERUNS = Number(process.env.PROC_RERUNS ?? 1);
const summaryStore: string[] = [];

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

const TARGETS = [
  "DashboardPage",
  "DashboardMainLayout",
  "KomaTopbar2",
  "DashboardFooter",
  "DashboardLeftSidebar",
  "ImageCollectionSidebar",
  "DashboardStageSection",
  "AioRightPanel",
];

const aggregate = (events: ScanEvent[]): string => {
  const out = new Map<string, { renders: number; time: number; changes: number }>();
  for (const event of events) {
    if (event.name === null || event.name.startsWith("MARK:")) continue;
    const slot =
      out.get(event.name) ?? { renders: 0, time: 0, changes: 0 };
    slot.renders += 1;
    slot.time += event.time;
    slot.changes += event.changes;
    out.set(event.name, slot);
  }
  return TARGETS.map((name) => {
    const slot = out.get(name);
    return slot
      ? `${name}(${slot.renders}r ${slot.time.toFixed(0)}ms ch=${slot.changes})`
      : `${name}(0r)`;
  }).join(" | ");
};

const STORES =
  "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

const installRecorder = async (page: Page): Promise<void> => {
  await page.evaluate(async ({ stores }) => {
    const names = [
      "ui-shell-store",
      "status-store",
      "aio-pipeline-store",
      "image-collection-store",
      "region-editor-store",
      "cleaner-store",
      "export-store",
      "translator-store",
      "auth-account-store",
    ] as const;
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string; keys: string }>;
    };
    win.__komaStoreWrites = [];
    for (const name of names) {
      try {
        const mod = (await import(`${stores}/${name}.ts`)) as {
          [key: string]: {
            subscribe: (cb: (s: unknown, p: unknown) => void) => () => void;
          };
        };
        const storeHookKey = Object.keys(mod).find((key) =>
          key.startsWith("use"),
        );
        const storeModule =
          storeHookKey !== undefined ? mod[storeHookKey] : undefined;
        if (!storeModule) continue;
        storeModule.subscribe((state: unknown, prevState: unknown) => {
          const log = window as unknown as {
            __komaStoreWrites?: Array<{
              t: number;
              store: string;
              keys: string;
            }>;
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
        // store module unavailable — skip
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
      __komaStoreWrites?: Array<{ t: number; store: string; keys: string }>;
    };
    if (win.__komaStoreWrites) win.__komaStoreWrites.length = 0;
  });
  return writes.join(" ");
};

const clearBufferAndWrites = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const win = window as unknown as {
      __komaReactScan?: { clear: () => void };
      __komaStoreWrites?: unknown[];
    };
    win.__komaReactScan?.clear();
    if (win.__komaStoreWrites) win.__komaStoreWrites.length = 0;
  });
};

for (let run = 1; run <= RERUNS; run += 1) {
  test(`processingStats attribution run ${run}`, async ({ page }) => {
    test.setTimeout(420_000);
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
    await installRecorder(page);

    // ── WINDOW A: processing start/end flip (every run's first + last write) ──
    await clearBufferAndWrites(page);
    const markA = await markLongTasks(page);
    await page.evaluate(async ({ stores }) => {
      const shellModule = (await import(`${stores}/ui-shell-store.ts`)) as {
        useUiShellStore: {
          getState: () => { setProcessing: (value: boolean) => void };
        };
      };
      shellModule.useUiShellStore.getState().setProcessing(true);
    }, { stores: STORES });
    await page.waitForTimeout(600);
    await page.evaluate(async ({ stores }) => {
      const shellModule = (await import(`${stores}/ui-shell-store.ts`)) as {
        useUiShellStore: {
          getState: () => { setProcessing: (value: boolean) => void };
        };
      };
      shellModule.useUiShellStore.getState().setProcessing(false);
    }, { stores: STORES });
    await page.waitForTimeout(1500);
    const procEvents = await snapshotAndClear(page);
    const procTasks = await collectLongTasksSince(page, markA);
    const procSummary = `PROC-FLIP ${aggregate(procEvents)} tasks=${procTasks.length} worst=${Math.max(0, ...procTasks.map((t) => t.duration)).toFixed(0)}ms`;
    console.log(procSummary);
    console.log(`PROC-FLIP writes: ${await dumpWriteTimeline(page)}`);
    const procLayout = procEvents
      .filter((e) => e.name === "DashboardMainLayout")
      .map((e) => `layout@${e.t.toFixed(0)} ${e.time.toFixed(0)}ms ch=${e.changes}`)
      .join(" | ");
    console.log(`PROC-FLIP layout: ${procLayout || "(none)"}`);

    // ── WINDOW B: idle 95s over the 30s-aligned stats tick (≥3 ticks,
    //    ≥1 minute boundary) ──
    const clockInfo = await page.evaluate(() => {
      const ms = Date.now();
      return {
        toMinuteBoundary: 60_000 - (ms % 60_000),
        toTick: 30_000 - (ms % 30_000 || 30_000),
      };
    });
    console.log(
      `TICK clock: toMinuteBoundary=${clockInfo.toMinuteBoundary}ms toTick=${clockInfo.toTick}ms`,
    );
    await clearBufferAndWrites(page);
    const markB = await markLongTasks(page);
    await page.waitForTimeout(95_000);
    const tickEvents = await snapshotAndClear(page);
    const tickTasks = await collectLongTasksSince(page, markB);
    const tickSummary = `TICK-95S ${aggregate(tickEvents)} tasks=${tickTasks.length} worst=${Math.max(0, ...tickTasks.map((t) => t.duration)).toFixed(0)}ms`;
    console.log(tickSummary);
    const tickPage = tickEvents
      .filter((e) => e.name === "DashboardPage")
      .map((e) => `page@${e.t.toFixed(0)} ${e.time.toFixed(0)}ms`)
      .join(" | ");
    console.log(`TICK page-renders: ${tickPage || "(none)"}`);
    console.log(`TICK writes: ${await dumpWriteTimeline(page)}`);

    // ── WINDOW C: GENUINE stats change (counts ingested via the userKey
    //    effect) — the sidebar MUST re-render; the callbacks must NOT churn ──
    await clearBufferAndWrites(page);
    const markC = await markLongTasks(page);
    await page.evaluate(async ({ stores }) => {
      // 1. Pre-seed the persisted counts for the userKey we are about to set.
      const now = new Date();
      const pad = (n: number): string => String(n).padStart(2, "0");
      const dayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      const daysFromMonday = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - daysFromMonday);
      const weekKey = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
      const monthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      const email = "probe-user@test.local";
      window.localStorage.setItem(
        `koma:dashboard-processing-stats:${email}`,
        JSON.stringify({
          dayKey,
          weekKey,
          monthKey,
          dayCount: 7,
          weekCount: 9,
          monthCount: 11,
        }),
      );
      // 2. Flip the userKey — the stats hook's userKey effect ingests the
      //    stored counts (the recordProcessedPages content path).
      const authModule = (await import(`${stores}/auth-account-store.ts`)) as {
        useAuthAccountStore: {
          getState: () => {
            setUser: (value: unknown) => void;
          };
        };
      };
      authModule.useAuthAccountStore.getState().setUser({
        name: "Probe User",
        email,
      });
    }, { stores: STORES });
    await page.waitForTimeout(1500);
    const genuineEvents = await snapshotAndClear(page);
    const genuineTasks = await collectLongTasksSince(page, markC);
    const genuineSummary = `STATS-GENUINE ${aggregate(genuineEvents)} tasks=${genuineTasks.length} worst=${Math.max(0, ...genuineTasks.map((t) => t.duration)).toFixed(0)}ms`;
    console.log(genuineSummary);
    console.log(`STATS-GENUINE writes: ${await dumpWriteTimeline(page)}`);
    const sidebarRenders = genuineEvents
      .filter((e) => e.name === "DashboardLeftSidebar")
      .length;
    console.log(`STATS-GENUINE sidebar-renders: ${sidebarRenders}`);

    summaryStore.push(
      `${procSummary}\n  ${tickSummary}\n  ${genuineSummary}`,
    );

    expect(
      problems,
      "no pageerrors/app console errors during processing probe",
    ).toEqual([]);
  });
}

test.afterAll(async () => {
  if (summaryStore.length > 0) {
    console.log("=== PROCESSING MEDIANS ===");
    for (const entry of summaryStore) {
      console.log(`SUMMARY ${entry}`);
    }
  }
});
