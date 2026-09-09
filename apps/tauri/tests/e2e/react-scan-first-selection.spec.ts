import { expect, test, type Page } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — FPS-agent-2 first-selection window.
// User's react-scan Optimize tab signature (FPS-drop window, react 457ms +
// other 694ms): RenderTextPreviewTypeDock 1r/54ms mount with ALL 21 props new
// (first selection after boot), RenderTextPreview 4r/39ms, DashboardMainLayout
// state churn, DashboardPage 1r/8ms, DashboardFooter miniBackendRuntimeState
// churn x3, KomaTopbar workspace callbacks churn 1x.
//
// Windows: CLICK1 = FIRST region selection (dock mounts + first history
// commit), CLICK2 = second region (selection switch), CLICK3 = re-click same
// region (no drift). Store-write recorder diffs changed keys per write so
// page-level one-shot state flips can be attributed. Runs 3 times in-process
// (RERUNS) for medians.
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-first-selection.spec.ts --project=chromium --workers=1

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

const RERUNS = Number(process.env.FIRSTSELECT_RERUNS ?? 1);
const summaryStore: Array<{
  click1: string;
  click1Tasks: string;
  click2: string;
  click3: string;
}> = [];

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
    "KomaTopbar2",
    "DashboardFooter",
    "DashboardLeftSidebar",
    "DashboardManualDock",
    "AioRightPanel",
    "RenderTextPreview",
    "RenderTextPreviewTypeDock",
    "DashboardStageSection",
    "DashboardStageGrid",
  ];
  const targeted = targets
    .map((name) => {
      const slot = out.get(name);
      return slot ? `${name}(${slot.renders}r ${slot.time.toFixed(0)}ms)` : null;
    })
    .filter(Boolean)
    .join(" | ");
  return `TARGETED ${targeted}`;
};

const STORES =
  "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

// Store-write recorder WITH per-write key diff (transition-probe pattern) plus
// pre/post state sampling for the one-shot page-level state candidates.
const installRecorder = async (page: Page): Promise<void> => {
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
      "typographer-store",
    ] as const;
    const win = window as unknown as {
      __komaStoreWrites?: Array<{
        t: number;
        store: string;
        keys: string;
      }>;
      __komaStateSamples?: Array<{ t: number; tag: string; state: string }>;
    };
    win.__komaStoreWrites = [];
    win.__komaStateSamples = [];
    const sampleState = (tag: string): void => {
      const log = window as unknown as {
        __komaStateSamples?: Array<{ t: number; tag: string; state: string }>;
      };
      const parts: string[] = [];
      try {
        const statusMod = (window as unknown as Record<string, unknown>);
        void statusMod;
      } catch {
        // ignore
      }
      log.__komaStateSamples?.push({
        t: performance.now(),
        tag,
        state: parts.join("|") || "(empty)",
      });
    };
    void sampleState;
    for (const name of names) {
      try {
        const mod = (await import(`${stores}/${name}.ts`)) as {
          [key: string]: {
            subscribe: (cb: (s: unknown, p: unknown) => void) => () => void;
            getState: () => unknown;
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
  test(`first selection attribution run ${run}`, async ({ page }) => {
    test.setTimeout(240_000);
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

    const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
    await expect(box).toBeVisible();
    const rect = await box.boundingBox();
    expect(rect).not.toBeNull();
    const cx = rect!.x + rect!.width / 2;
    const cy = rect!.y + rect!.height / 2;

    // ── CLICK1: first selection (dock mount + first history commit) ──
    await clearBufferAndWrites(page);
    const mark1 = await markLongTasks(page);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1800);
    const click1Events = await snapshotAndClear(page);
    const click1Tasks = await collectLongTasksSince(page, mark1);
    const click1Summary = `CLICK1 ${aggregate(click1Events)} tasks=${click1Tasks.length} worst=${Math.max(0, ...click1Tasks.map((t) => t.duration)).toFixed(0)}ms`;
    console.log(click1Summary);
    console.log(
      `CLICK1 tasks: ${click1Tasks.map((t) => `task@${t.startTime.toFixed(0)} ${t.duration.toFixed(0)}ms`).join(" ")}`,
    );
    console.log(`CLICK1 writes: ${await dumpWriteTimeline(page)}`);
    const dockRenders = click1Events
      .filter((e) => e.name === "RenderTextPreviewTypeDock")
      .map((e) => `dock@${e.t.toFixed(0)} ${e.time.toFixed(0)}ms ch=${e.changes}`)
      .join(" | ");
    console.log(`CLICK1 dock-renders: ${dockRenders || "(none)"}`);
    const pageRenders = click1Events
      .filter((e) => e.name === "DashboardPage")
      .map((e) => `page@${e.t.toFixed(0)} ${e.time.toFixed(0)}ms`)
      .join(" | ");
    console.log(`CLICK1 page-renders: ${pageRenders || "(none)"}`);

    // ── CLICK2: second region (dock re-render, not mount) ──
    const box2 = page.locator(
      '.koma-render-box[data-region-id="probe-region-2"]',
    );
    const rect2 = await box2.boundingBox();
    expect(rect2).not.toBeNull();
    await clearBufferAndWrites(page);
    const mark2 = await markLongTasks(page);
    await page.mouse.click(
      rect2!.x + rect2!.width / 2,
      rect2!.y + rect2!.height / 2,
    );
    await page.waitForTimeout(1200);
    const click2Events = await snapshotAndClear(page);
    const click2Tasks = await collectLongTasksSince(page, mark2);
    const click2Summary = `CLICK2 ${aggregate(click2Events)} tasks=${click2Tasks.length} worst=${Math.max(0, ...click2Tasks.map((t) => t.duration)).toFixed(0)}ms`;
    console.log(click2Summary);
    console.log(`CLICK2 writes: ${await dumpWriteTimeline(page)}`);

    // ── CLICK3: re-click same region (no drift) ──
    await clearBufferAndWrites(page);
    const mark3 = await markLongTasks(page);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1000);
    const click3Events = await snapshotAndClear(page);
    const click3Tasks = await collectLongTasksSince(page, mark3);
    const click3Summary = `CLICK3 ${aggregate(click3Events)} tasks=${click3Tasks.length} worst=${Math.max(0, ...click3Tasks.map((t) => t.duration)).toFixed(0)}ms`;
    console.log(click3Summary);
    console.log(`CLICK3 writes: ${await dumpWriteTimeline(page)}`);

    summaryStore.push({
      click1: click1Summary,
      click1Tasks: click1Tasks.map((t) => t.duration.toFixed(0)).join("/"),
      click2: click2Summary,
      click3: click3Summary,
    });

    expect(
      problems,
      "no pageerrors/app console errors during first-selection probe",
    ).toEqual([]);
  });
}

test.afterAll(async () => {
  if (summaryStore.length > 0) {
    console.log("=== FIRST-SELECT MEDIANS ===");
    for (const entry of summaryStore) {
      console.log(
        `SUMMARY ${entry.click1} | click1Tasks=${entry.click1Tasks} | ${entry.click2} | ${entry.click3}`,
      );
    }
  }
});
