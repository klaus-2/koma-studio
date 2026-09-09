import { expect, test, type Page } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — react-scan optimize-tab follow-up.
// Reproduces the exact user gesture: FIRST real click on a region box after
// boot (no prior selection, workspace history canUndo=false) vs a SECOND
// click. Captures react-scan render events + long tasks per window so we can
// see whether DashboardPage/chrome re-render on the first click.
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-click.spec.ts --project=chromium --workers=1

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
    "AioRightPanel",
    "DashboardManualDock",
    "RenderTextPreviewTypeDock",
    "RenderTextPreview",
  ];
  const targeted = targets
    .map((name) => {
      const slot = out.get(name);
      return slot ? `${name}(${slot.renders}r ${slot.time.toFixed(0)}ms)` : null;
    })
    .filter(Boolean)
    .join(" | ");
  const top = [...out.entries()]
    .filter(([name]) => !name.startsWith("Tooltip") && !name.startsWith("Primitive") && !name.startsWith("Popper") && name !== "Presence")
    .sort((a, b) => b[1].renders - a[1].renders || b[1].time - a[1].time)
    .slice(0, 12)
    .map(([name, agg]) => `${name}(${agg.renders}r ${agg.time.toFixed(0)}ms)`)
    .join(" | ");
  const tooltipRenders = [...out.entries()]
    .filter(([name]) => name.startsWith("Tooltip") || name.startsWith("Popper") || name.startsWith("Primitive") || name === "Presence")
    .reduce((sum, [, agg]) => sum + agg.renders, 0);
  return `TARGETED ${targeted} || TOP ${top} || radix-family ${tooltipRenders}r`;
};

const STORES =
  "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

// Subscribe to every domain store so the click1 window can be correlated
// with the writes that caused renders (zustand actions close over their own
// set(), so wrapping setState does not intercept them — subscribe does).
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
    ] as const;
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string }>;
    };
    win.__komaStoreWrites = [];
    for (const name of names) {
      try {
        const mod = (await import(`${stores}/${name}.ts`)) as {
          [key: string]: { subscribe: (cb: () => void) => () => void };
        };
        const storeHookKey = Object.keys(mod).find((key) =>
          key.startsWith("use"),
        );
        const storeModule = storeHookKey !== undefined ? mod[storeHookKey] : undefined;
        if (!storeModule) continue;
        storeModule.subscribe(() => {
          const log = window as unknown as {
            __komaStoreWrites?: Array<{ t: number; store: string }>;
          };
          log.__komaStoreWrites?.push({
            t: performance.now(),
            store: name,
          });
        });
      } catch {
        // store module unavailable in web e2e — skip
      }
    }
  }, { stores: STORES });
};

const dumpStoreWrites = async (page: Page): Promise<void> => {
  const writes = await page.evaluate(() => {
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string }>;
    };
    return win.__komaStoreWrites ?? [];
  });
  const byStore = new Map<string, number>();
  for (const write of writes) {
    byStore.set(write.store, (byStore.get(write.store) ?? 0) + 1);
  }
  console.log(
    `WRITES ${JSON.stringify([...byStore.entries()].sort((a, b) => b[1] - a[1]))}`,
  );
  await page.evaluate(() => {
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string }>;
    };
    if (win.__komaStoreWrites) win.__komaStoreWrites.length = 0;
  });
};

const dumpWriteTimeline = async (page: Page): Promise<string> => {
  const writes = await page.evaluate(() => {
    const win = window as unknown as {
      __komaStoreWrites?: Array<{ t: number; store: string }>;
    };
    return (win.__komaStoreWrites ?? []).map(
      (write) => `${write.store.replace("-store", "")}@${write.t.toFixed(0)}`,
    );
  });
  return writes.join(" ");
};

test.describe(() => {
  test.use({ viewport: { width: 1760, height: 1320 } });

  test("first region click after boot vs second click", async ({ page }) => {
    test.setTimeout(150_000);
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

    const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
    await expect(box).toBeVisible();
    const rect = await box.boundingBox();
    expect(rect).not.toBeNull();
    const cx = rect!.x + rect!.width / 2;
    const cy = rect!.y + rect!.height / 2;

    // Window A: FIRST click (selects region 1; first history commit).
    // Clear the mirror buffer right before the click so the window holds
    // ONLY the click's own cascade (setup writes settle beforehand).
    await page.evaluate(() => {
      const win = window as unknown as {
        __komaReactScan?: { clear: () => void };
      };
      win.__komaReactScan?.clear();
    });
    let mark = await markLongTasks(page);
    await page.evaluate(() => {
      const win = window as unknown as {
        __komaReactScan?: { mark: (label: string) => void };
      };
      win.__komaReactScan?.mark("click1:start");
    });
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1500);
    const click1Events = await snapshotAndClear(page);
    const click1Tasks = await collectLongTasksSince(page, mark);
    console.log(
      `CLICK1 renders: ${aggregate(click1Events)} tasks=${click1Tasks.length} worst=${Math.max(0, ...click1Tasks.map((t) => t.duration)).toFixed(0)}ms`,
    );
    console.log(`TIMELINE writes: ${await dumpWriteTimeline(page)}`);
    console.log(
      `TIMELINE tasks: ${click1Tasks.map((task) => `task@${task.startTime.toFixed(0)} ${task.duration.toFixed(0)}ms`).join(" ")}`,
    );
    await dumpStoreWrites(page);
    // Timeline: page renders vs store writes (t is per-frame in the mirror).
    const timeline = click1Events
      .filter((event) => event.name === "DashboardPage")
      .map((event) => `r@${event.t.toFixed(0)}`)
      .join(" ");
    console.log(`TIMELINE page-renders: ${timeline}`);
    // Window B: SECOND click on the OTHER region (selection switch, history
    // already committed once).
    const box2 = page.locator('.koma-render-box[data-region-id="probe-region-2"]');
    const rect2 = await box2.boundingBox();
    expect(rect2).not.toBeNull();
    mark = await markLongTasks(page);
    await page.mouse.click(rect2!.x + rect2!.width / 2, rect2!.y + rect2!.height / 2);
    await page.waitForTimeout(1200);
    const click2Events = await snapshotAndClear(page);
    const click2Tasks = await collectLongTasksSince(page, mark);
    console.log(
      `CLICK2 renders: ${aggregate(click2Events)} tasks=${click2Tasks.length} worst=${Math.max(0, ...click2Tasks.map((t) => t.duration)).toFixed(0)}ms`,
    );

    // Window C: re-click the SAME region (no drift).
    mark = await markLongTasks(page);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1000);
    const click3Events = await snapshotAndClear(page);
    const click3Tasks = await collectLongTasksSince(page, mark);
    console.log(
      `CLICK3 renders: ${aggregate(click3Events)} tasks=${click3Tasks.length} worst=${Math.max(0, ...click3Tasks.map((t) => t.duration)).toFixed(0)}ms`,
    );

    // Window D: the user's recipe — drag the selected box, click OUTSIDE on
    // the image (deselect), then click the box again (re-select + dock
    // remount).
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(cx + step * 8, cy + step * 4);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
    const dragEvents = await snapshotAndClear(page);
    console.log(`DRAG renders: ${aggregate(dragEvents)}`);

    await page.mouse.click(cx - 300, cy + 260);
    await page.waitForTimeout(900);
    const deselectEvents = await snapshotAndClear(page);
    console.log(`DESELECT renders: ${aggregate(deselectEvents)}`);

    mark = await markLongTasks(page);
    await page.mouse.click(cx - 96, cy - 48);
    await page.waitForTimeout(1100);
    const reselectEvents = await snapshotAndClear(page);
    const reselectTasks = await collectLongTasksSince(page, mark);
    console.log(
      `RESELECT renders: ${aggregate(reselectEvents)} tasks=${reselectTasks.length} worst=${Math.max(0, ...reselectTasks.map((t) => t.duration)).toFixed(0)}ms`,
    );

    expect(
      problems,
      "no pageerrors/app console errors during click probe",
    ).toEqual([]);
  });
});
