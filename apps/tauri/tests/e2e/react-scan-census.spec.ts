import { expect, test, type Page } from "@playwright/test";

// T4.1 census probe (refactor-queue.md section 7) — temporary, untracked.
// Walks the ENTIRE dashboard like a real user while react-scan mirrors every
// render into window.__komaReactScan and a PerformanceObserver('longtask')
// collector measures blocking tasks. Each scenario = one window:
// snapshot+clear of the render buffer + long tasks since the window start.
// Measurement-only: asserts nothing about the numbers, only that the page
// never errors and every window is actually explored. Unreachable scenarios
// log "CENSUS <label> SKIPPED: <reason>" instead of faking the interaction.
//
// Real user interactions (mouse/keyboard) everywhere the UI is reachable;
// store-driven actions only where UI automation is impractical (mode switches
// via setShellMode for deterministic coverage; manual-stage jumps mirror the
// stage next/execute buttons; image add/remove via the store as sanctioned by
// T4.1; region selection mirrors the click path).
//
// Run (from apps/tauri): bunx playwright test tests/e2e/react-scan-census.spec.ts --project=chromium --workers=1
// Default runs HEADED (real GPU); SWEEP_HEADLESS=1 falls back to headless.

import {
  collectLongTasksSince,
  collectProblems,
  injectProbeFixture,
  installLongTaskCollector,
  logGpuMode,
  markLongTasks,
  selectProbeRegion,
  setProbeManualStageAtRender,
  setShellMode,
  worstOf,
} from "./probe-helpers";

const STORES = "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";

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

interface Agg {
  renders: number;
  count: number;
  timeMs: number;
}

type Census = Record<
  string,
  { renders: Record<string, Agg>; longTasks: number[]; worst: number }
>;

const census: Census = {};

const mark = async (page: Page, label: string): Promise<void> => {
  await page.evaluate((text) => {
    const win = window as unknown as { __komaReactScan?: ScanApi };
    win.__komaReactScan?.mark(text);
  }, label);
};

const aggregate = (events: ScanEvent[]): Record<string, Agg> => {
  const out: Record<string, Agg> = {};
  for (const event of events) {
    if (event.name === null || event.name.startsWith("MARK:")) continue;
    const slot = (out[event.name] ??= { renders: 0, count: 0, timeMs: 0 });
    slot.renders += 1;
    slot.count += event.count;
    slot.timeMs += event.time;
  }
  return out;
};

const endWindow = async (
  page: Page,
  label: string,
  taskMark: number,
): Promise<void> => {
  await mark(page, `${label}:end`);
  const events = await page.evaluate(() => {
    const win = window as unknown as { __komaReactScan?: ScanApi };
    if (!win.__komaReactScan) return [];
    const evts = win.__komaReactScan.events();
    win.__komaReactScan.clear();
    return evts;
  });
  const tasks = await collectLongTasksSince(page, taskMark);
  census[label] = {
    renders: aggregate(events),
    longTasks: tasks.map((t) => Math.round(t.duration)),
    worst: Math.round(worstOf(tasks)),
  };
  const topCounts = Object.entries(census[label]!.renders)
    .sort((a, b) => b[1].count - a[1].count || b[1].timeMs - a[1].timeMs)
    .slice(0, 10)
    .map(([name, agg]) => `${name}(${agg.count}r ${agg.timeMs.toFixed(0)}ms)`)
    .join(" | ");
  const topTime = Object.entries(census[label]!.renders)
    .sort((a, b) => b[1].timeMs - a[1].timeMs)
    .slice(0, 5)
    .map(([name, agg]) => `${name}(${agg.timeMs.toFixed(0)}ms)`)
    .join(" | ");
  console.log(`CENSUS ${label}: worst=${census[label]!.worst}ms tasks=${tasks.length}`);
  console.log(`CENSUS ${label} top-counts: ${topCounts}`);
  if (topTime) console.log(`CENSUS ${label} top-time: ${topTime}`);
};

// A window around one action + settle.
const actionWindow = async (
  page: Page,
  label: string,
  action: () => Promise<void>,
  settleMs: number,
): Promise<void> => {
  await mark(page, `${label}:start`);
  const taskMark = await markLongTasks(page);
  await action();
  await page.waitForTimeout(settleMs);
  await endWindow(page, label, taskMark);
};

// Real-user click: wait briefly for the element, then click its center with
// the raw mouse (no actionability dance — one flaky stability check must not
// stall the whole census). Returns false (and logs) when not clickable.
const clickIfEnabled = async (
  page: Page,
  selector: string,
  label: string,
): Promise<boolean> => {
  const locator = page.locator(selector).first();
  try {
    if ((await locator.count()) === 0) {
      console.log(`CENSUS ${label} SKIPPED: selector not found (${selector})`);
      return false;
    }
    if (!(await locator.isEnabled())) {
      console.log(`CENSUS ${label} SKIPPED: control disabled (${selector})`);
      return false;
    }
    await locator.waitFor({ state: "visible", timeout: 8000 });
    const rect = await locator.boundingBox();
    if (!rect) {
      console.log(`CENSUS ${label} SKIPPED: no bounding box (${selector})`);
      return false;
    }
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return true;
  } catch (error) {
    console.log(
      `CENSUS ${label} SKIPPED: click failed (${(error as Error).message.split("\n")[0]})`,
    );
    return false;
  }
};

// Jump the aio manual pipeline to an arbitrary stage index (0=detectText,
// 3=segmentText, 5=render) — mirrors the stage next/execute buttons.
const setProbeManualStageIndex = async (
  page: Page,
  index: number,
): Promise<void> => {
  await page.evaluate(async ({ stores, index }) => {
    const pipelineModule = (await import(
      `${stores}/aio-pipeline-store.ts`
    )) as {
      useAioPipelineStore: {
        getState: () => {
          setAioManualProgressByImage: (value: unknown) => void;
        };
      };
    };
    pipelineModule.useAioPipelineStore.getState().setAioManualProgressByImage({
      "probe-image-1": {
        currentIndex: index,
        unlockedMaxIndex: index,
        statusByStage: {},
      },
    });
  }, { stores: STORES, index });
};

// Inject cleaner detections for the probe image so the cleaner dock's
// segment tools ungate (activeStageAllowsSegmentTools requires detections).
const injectCleanerDetections = async (page: Page): Promise<void> => {
  await page.evaluate(async ({ stores }) => {
    const cleanerModule = (await import(`${stores}/cleaner-store.ts`)) as {
      useCleanerStore: {
        getState: () => {
          setCleanerDetectionsByImage: (value: unknown) => void;
        };
      };
    };
    cleanerModule.useCleanerStore.getState().setCleanerDetectionsByImage({
      "probe-image-1": [
        {
          id: "probe-cleaner-region-1",
          bbox: [300, 300, 700, 400],
          renderText: "CLEANER REGION TEXT",
          score: 1,
          source: "manual",
          modelKey: "probe",
        },
      ],
    });
  }, { stores: STORES });
};

test("react-scan census — full dashboard interactive walk", async ({ page }) => {
  test.setTimeout(600_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);
  const gpu = await logGpuMode(page, "react-scan-census");

  const scanApiActive = await page.evaluate(() => {
    const win = window as unknown as { __komaReactScan?: ScanApi };
    return typeof win.__komaReactScan?.mark === "function";
  });
  expect(scanApiActive, "react-scan init must be active").toBe(true);

  // Boot window: everything accumulated since page init (all long tasks).
  await mark(page, "boot:start");
  await endWindow(page, "boot", 0);

  // ═══════════ Fixture: image + 5 regions, aio manual render stage ═══════════
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
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(800);
  await expect(page.locator(".koma-stage")).toBeVisible();

  // ═══════════ 1. All 12 modes (store-driven for deterministic coverage) ═══════════
  const MODES = [
    "aio",
    "cleaner",
    "typesetter",
    "translator",
    "raw",
    "proofreader",
    "stitch",
    "split",
    "watermark",
    "enhance",
    "optimizer",
    "organize",
  ] as const;
  for (const mode of MODES) {
    await actionWindow(page, `mode:${mode}`, () => setShellMode(page, mode), 800);
  }
  // Cleaner has NO manual/auto sub-mode toggle (MODES_WITH_SUBMODE = aio,
  // typesetter only) — recorded here, not faked.
  console.log(
    "CENSUS submode:cleaner SKIPPED: cleaner has no sub-mode toggle (MODES_WITH_SUBMODE=[aio,typesetter])",
  );

  // ═══════════ 2. Sub-mode toggles (REAL clicks; aio + typesetter) ═══════════
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(600);
  await actionWindow(page, "submode:aio-auto", async () => {
    await clickIfEnabled(
      page,
      '.koma-submode-toggle__btn:has-text("AIO automatic")',
      "submode:aio-auto",
    );
  }, 700);
  await actionWindow(page, "submode:aio-manual", async () => {
    await clickIfEnabled(
      page,
      '.koma-submode-toggle__btn:has-text("AIO manual")',
      "submode:aio-manual",
    );
  }, 700);
  // Entering manual resets per-image manual progress — re-jump to render stage.
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(500);

  await actionWindow(page, "mode:typesetter-again", () => setShellMode(page, "typesetter"), 800);
  await actionWindow(page, "submode:typesetter-auto", async () => {
    await clickIfEnabled(
      page,
      '.koma-submode-toggle__btn:has-text("AIO automatic")',
      "submode:typesetter-auto",
    );
  }, 700);
  await actionWindow(page, "submode:typesetter-manual", async () => {
    await clickIfEnabled(
      page,
      '.koma-submode-toggle__btn:has-text("AIO manual")',
      "submode:typesetter-manual",
    );
  }, 700);

  // ═══════════ 3. Dock (aio render stage): config, paint slider, image tools ═══════════
  await setShellMode(page, "aio");
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(600);

  await actionWindow(page, "dock:config-open", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Open config"]',
      "dock:config-open",
    );
  }, 500);
  await actionWindow(page, "dock:tool-paint", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Paint brush"]',
      "dock:tool-paint",
    );
  }, 450);
  // Slider drag inside the open paint config (first .koma-range = Size).
  const slider = page.locator(".koma-tool-config .koma-range").first();
  const sRect = (await slider.count()) > 0 ? await slider.boundingBox() : null;
  if (sRect) {
    await actionWindow(page, "dock:slider-drag", async () => {
      await page.mouse.move(sRect.x + sRect.width / 2, sRect.y + sRect.height / 2);
      await page.mouse.down();
      await page.mouse.move(sRect.x + sRect.width * 0.8, sRect.y + sRect.height / 2, { steps: 8 });
      await page.mouse.up();
    }, 400);
  } else {
    console.log("CENSUS dock:slider-drag SKIPPED: no slider in config flyout");
  }
  const DOCK_TOOLS: Array<[string, string]> = [
    ["dock:tool-paint-eraser", 'button[aria-label="Paint eraser"]'],
    ["dock:tool-wand", 'button[aria-label="Magic wand"]'],
    ["dock:tool-healing", 'button[aria-label="Healing Brush"]'],
  ];
  for (const [label, selector] of DOCK_TOOLS) {
    await actionWindow(page, label, async () => {
      await clickIfEnabled(page, selector, label);
    }, 450);
  }
  await actionWindow(page, "dock:config-close", async () => {
    await clickIfEnabled(page, ".koma-tool-config__close", "dock:config-close");
  }, 450);

  // ═══════════ 3b. Segment tools (aio @ segmentText stage) ═══════════
  await actionWindow(page, "stage:segmentText", () => setProbeManualStageIndex(page, 3), 600);
  await actionWindow(page, "dock:tool-seg-brush", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Segmented area brush"]',
      "dock:tool-seg-brush",
    );
  }, 450);
  // The page auto-closes the config flyout when activeDockToolHasConfig
  // flips (Dashboard.tsx) — re-open it before dragging the segment slider.
  await clickIfEnabled(
    page,
    '.koma-tool-palette__btn[aria-label="Open config"]',
    "dock:seg-config-reopen",
  );
  await page.waitForTimeout(250);
  const segSlider = page.locator(".koma-tool-config .koma-range").first();
  const segRect =
    (await segSlider.count()) > 0 ? await segSlider.boundingBox() : null;
  if (segRect) {
    await actionWindow(page, "dock:seg-slider-drag", async () => {
      await page.mouse.move(segRect.x + segRect.width / 2, segRect.y + segRect.height / 2);
      await page.mouse.down();
      await page.mouse.move(segRect.x + segRect.width * 0.6, segRect.y + segRect.height / 2, { steps: 6 });
      await page.mouse.up();
    }, 400);
  } else {
    console.log(
      `CENSUS dock:seg-slider-drag SKIPPED: no segment slider in config (config=${await page.locator(".koma-tool-config").count()} ranges=${await page.locator(".koma-tool-config .koma-range").count()})`,
    );
  }
  await actionWindow(page, "dock:tool-seg-eraser", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Segmented area eraser"]',
      "dock:tool-seg-eraser",
    );
  }, 450);

  // ═══════════ 4. Region editor (aio render stage, area tool active) ═══════════
  await setProbeManualStageAtRender(page);
  await page.waitForTimeout(500);
  await actionWindow(page, "dock:tool-area-select", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Select area"]',
      "dock:tool-area-select",
    );
  }, 450);
  await actionWindow(page, "region:select", () => selectProbeRegion(page, "probe-region-1"), 500);
  const box = page.locator('.koma-render-box[data-region-id="probe-region-1"]');
  if ((await box.count()) > 0) {
    const bRect = await box.boundingBox();
    if (bRect) {
      await actionWindow(page, "region:dblclick-editor", async () => {
        await page.mouse.dblclick(bRect.x + bRect.width / 2, bRect.y + bRect.height / 2);
      }, 500);
      const editor = page.locator(".koma-render-inline-editor");
      if ((await editor.count()) > 0) {
        await actionWindow(page, "region:type-10-chars", async () => {
          await page.keyboard.type("PROBE TYPE", { delay: 30 });
        }, 500);
        await actionWindow(page, "region:escape-editor", async () => {
          await page.keyboard.press("Escape");
        }, 500);
      } else {
        console.log("CENSUS region:type SKIPPED: inline editor did not open");
      }
    }
  } else {
    console.log("CENSUS region:dblclick SKIPPED: render box not mounted");
  }
  // Delete a region via real click on the selected box close handle.
  await actionWindow(page, "region:select-5", () => selectProbeRegion(page, "probe-region-5"), 400);
  const close5 = page.locator(
    '.koma-render-box[data-region-id="probe-region-5"] .koma-render-box__close',
  );
  if ((await close5.count()) > 0) {
    await actionWindow(page, "region:delete", async () => {
      await close5.click({ force: true });
    }, 500);
  } else {
    console.log("CENSUS region:delete SKIPPED: close handle not rendered");
  }

  // ═══════════ 5. Cleaner dock: segment tools with real detections ═══════════
  await injectCleanerDetections(page);
  await actionWindow(page, "mode:cleaner-2", () => setShellMode(page, "cleaner"), 800);
  await actionWindow(page, "dock:cleaner-seg-brush", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Segmented area brush"]',
      "dock:cleaner-seg-brush",
    );
  }, 450);
  await actionWindow(page, "dock:cleaner-seg-eraser", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Segmented area eraser"]',
      "dock:cleaner-seg-eraser",
    );
  }, 450);
  await actionWindow(page, "dock:cleaner-paint", async () => {
    await clickIfEnabled(
      page,
      '.koma-tool-palette__btn[aria-label="Paint brush"]',
      "dock:cleaner-paint",
    );
  }, 450);

  // ═══════════ 6. Topbar: zoom, rotate, view mode, threads ═══════════
  await setShellMode(page, "aio");
  await page.waitForTimeout(600);
  await actionWindow(page, "topbar:zoom-in", async () => {
    await clickIfEnabled(
      page,
      '.koma-zoomctl__btn[aria-label="Zoom in"]',
      "topbar:zoom-in",
    );
  }, 400);
  await actionWindow(page, "topbar:zoom-out", async () => {
    await clickIfEnabled(
      page,
      '.koma-zoomctl__btn[aria-label="Zoom out"]',
      "topbar:zoom-out",
    );
  }, 400);
  await actionWindow(page, "topbar:rotate-90", async () => {
    await clickIfEnabled(page, '.koma-topbar__iconbtn[aria-label="Rotate 90°"]', "topbar:rotate-90");
  }, 500);
  await actionWindow(page, "topbar:rotate-90-again", async () => {
    await clickIfEnabled(page, '.koma-topbar__iconbtn[aria-label="Rotate 90°"]', "topbar:rotate-90-again");
  }, 500);
  await actionWindow(page, "topbar:viewmode-longstrip", async () => {
    await clickIfEnabled(page, 'button[aria-label="Long strip"]', "topbar:viewmode-longstrip");
  }, 600);
  await actionWindow(page, "topbar:viewmode-paginated", async () => {
    await clickIfEnabled(page, 'button[aria-label="Paginated"]', "topbar:viewmode-paginated");
  }, 600);
  await actionWindow(page, "topbar:threads-enable", async () => {
    await clickIfEnabled(page, ".koma-threadctl__toggle", "topbar:threads-enable");
  }, 450);
  await actionWindow(page, "topbar:threads-input", async () => {
    const input = page.locator(".koma-threadctl__input");
    if ((await input.count()) > 0) {
      await input.fill("2");
    } else {
      console.log("CENSUS topbar:threads-input SKIPPED: input not found");
    }
  }, 450);
  await actionWindow(page, "topbar:threads-disable", async () => {
    await clickIfEnabled(page, ".koma-threadctl__toggle", "topbar:threads-disable");
  }, 450);

  // ═══════════ 7. Sidebars: left collapse/expand, right hide/show ═══════════
  await actionWindow(page, "sidebar:left-collapse", async () => {
    await clickIfEnabled(page, ".koma-desktop-sidebar-toggle", "sidebar:left-collapse");
  }, 450);
  await actionWindow(page, "sidebar:left-expand", async () => {
    const reveal = page.locator(".koma-topbar__sidebar-reveal");
    if ((await reveal.count()) > 0) {
      await reveal.click();
    } else {
      console.log("CENSUS sidebar:left-expand SKIPPED: reveal button not rendered");
    }
  }, 450);
  await actionWindow(page, "sidebar:right-collapse", async () => {
    await clickIfEnabled(page, ".koma-desktop-tools-toggle", "sidebar:right-collapse");
  }, 450);
  await actionWindow(page, "sidebar:right-expand", async () => {
    const toolsReveal = page.locator(".koma-topbar__tools-reveal");
    if ((await toolsReveal.count()) > 0) {
      await toolsReveal.click();
    } else {
      console.log("CENSUS sidebar:right-expand SKIPPED: reveal button not rendered");
    }
  }, 450);

  // ═══════════ 8. Topbar menus: download (incl. PSD), user menu, shortcuts ═══════════
  await actionWindow(page, "topbar:download-open", async () => {
    await clickIfEnabled(
      page,
      '[data-tour="topbar-download-trigger"]',
      "topbar:download-open",
    );
  }, 500);
  await actionWindow(page, "topbar:download-psd", async () => {
    const panel = page.locator('[data-tour="topbar-download-panel"]');
    if ((await panel.count()) === 0) {
      // Menu not open yet — the download-open window opened it; only click
      // the trigger when the panel is actually missing (it toggles).
      await page.locator('[data-tour="topbar-download-trigger"]').click();
      await page.waitForTimeout(250);
    }
    const psdAction = page.locator(
      '[data-tour="topbar-download-panel"] button:has-text("PSD")',
    );
    if ((await psdAction.count()) > 0) {
      await psdAction.first().click({ force: true });
    } else {
      console.log(
        `CENSUS topbar:download-psd SKIPPED: no PSD section in menu (panel=${await panel.count()})`,
      );
    }
  }, 600);
  await actionWindow(page, "topbar:download-close", async () => {
    const trigger = page.locator('[data-tour="topbar-download-trigger"]');
    if ((await trigger.count()) > 0) await trigger.click();
  }, 400);
  await actionWindow(page, "topbar:user-menu", async () => {
    await clickIfEnabled(page, ".koma-topbar__userbtn", "topbar:user-menu");
  }, 500);
  await actionWindow(page, "topbar:user-menu-close", async () => {
    const btn = page.locator(".koma-topbar__userbtn");
    if ((await btn.count()) > 0) await btn.click();
  }, 400);
  await actionWindow(page, "topbar:shortcuts-open", async () => {
    await clickIfEnabled(
      page,
      '.koma-topbar__iconbtn[aria-label="Shortcuts"]',
      "topbar:shortcuts-open",
    );
  }, 500);
  await actionWindow(page, "topbar:shortcuts-close", async () => {
    await page.keyboard.press("Escape");
  }, 400);

  // ═══════════ 9. Second image: add via store, switch active, remove ═══════════
  const addSecondImage = (): Promise<void> =>
    page.evaluate(async () => {
      const stores = "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";
      const collectionModule = (await import(
        `${stores}/image-collection-store.ts`
      )) as {
        useImageCollectionStore: {
          getState: () => {
            addImages: (images: unknown[]) => void;
            removeImageById: (id: string) => void;
          };
        };
      };
      const paintBlob = await new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 700;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("probe: no 2d context"));
          return;
        }
        ctx.fillStyle = "#8899aa";
        ctx.fillRect(0, 0, 900, 700);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("probe: toBlob failed"));
        }, "image/png");
      });
      const file = new File([paintBlob], "probe-page-2.png", { type: "image/png" });
      collectionModule.useImageCollectionStore.getState().addImages([
        {
          id: "probe-image-2",
          file,
          url: URL.createObjectURL(file),
          width: 900,
          height: 700,
          rotation: 0,
          filters: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpen: 0,
            levels: { black: 0, white: 255, gamma: 1 },
            grayscale: false,
            inverted: false,
          },
        },
      ]);
    });
  await actionWindow(page, "images:add-second", addSecondImage, 700);
  await actionWindow(page, "images:switch-active", async () => {
    const li = page.locator(".koma-filelist li:nth-child(2)");
    if ((await li.count()) > 0) await li.click();
    else console.log("CENSUS images:switch-active SKIPPED: 2nd item missing");
  }, 600);
  await actionWindow(page, "images:switch-back", async () => {
    const li = page.locator(".koma-filelist li:nth-child(1)");
    if ((await li.count()) > 0) await li.click();
  }, 600);
  await actionWindow(page, "images:remove-second", async () => {
    await page.evaluate(async () => {
      const stores = "/@fs/C:/Github/koma/packages/interface/src/pages/dashboard/stores";
      const collectionModule = (await import(
        `${stores}/image-collection-store.ts`
      )) as {
        useImageCollectionStore: {
          getState: () => { removeImageById: (id: string) => void };
        };
      };
      collectionModule.useImageCollectionStore.getState().removeImageById("probe-image-2");
    });
  }, 600);

  // ═══════════ 10. Info modes (DashboardInfoModeStage) ═══════════
  for (const info of ["guides", "resources", "blogger", "imgur"] as const) {
    await actionWindow(page, `info:${info}`, () => setShellMode(page, info), 800);
  }

  // ═══════════ 11. Translator text stage typing ═══════════
  await actionWindow(page, "mode:translator-text", () => setShellMode(page, "translator"), 800);
  const textEditor = page.locator("#translator-text-editor");
  if ((await textEditor.count()) > 0) {
    await actionWindow(page, "translator:type", async () => {
      await textEditor.click();
      await page.keyboard.type("Census typing probe text. ", { delay: 25 });
    }, 600);
  } else {
    console.log("CENSUS translator:type SKIPPED: text editor not mounted");
  }

  // ═══════════ 12. Routes: settings, rankings, feed, back to dashboard ═══════════
  for (const route of ["settings", "model-rankings", "scanlation-feed"]) {
    await actionWindow(page, `route:${route}`, async () => {
      await page.goto(`/#/${route}`);
    }, 1200);
  }
  await actionWindow(page, "route:dashboard-return", async () => {
    await page.goto("/#/dashboard");
  }, 1200);

  // ═══════════ 13. Empty stage: clear all images via the real sidebar button ═══════════
  const clearBtn = page.locator(".koma-files__header .koma-iconbtn--danger");
  if ((await clearBtn.count()) > 0) {
    await actionWindow(page, "empty-stage", async () => {
      await clearBtn.click({ force: true });
    }, 800);
  } else {
    console.log("CENSUS empty-stage SKIPPED: clear button not found");
  }

  // ═══════════ ARTIFACT ═══════════
  const fs = await import("node:fs/promises");
  const outPath = new URL("./.artifacts/react-scan-census.json", import.meta.url);
  await fs.writeFile(
    outPath,
    JSON.stringify({ gpu: gpu.mode, windows: census }, null, 2),
  );
  console.log(`CENSUS_ARTIFACT ${outPath.href}`);

  expect(problems, "no pageerrors/app console errors during census").toEqual([]);
});

test("react-scan census — mobile drawer (runtime viewport shrink)", async ({ page }) => {
  test.setTimeout(180_000);
  const problems = collectProblems(page);
  await installLongTaskCollector(page);

  await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2000);
  const gpu = await logGpuMode(page, "react-scan-census-mobile");

  const navBtn = page.locator('.koma-topbar__iconbtn[aria-label="Navigation"]');
  if ((await navBtn.count()) === 0) {
    console.log("CENSUS mobile:drawer-open SKIPPED: nav trigger not rendered at 390px");
  } else {
    await actionWindow(page, "mobile:drawer-open", async () => {
      const navRect = await navBtn.boundingBox();
      if (navRect) {
        await page.mouse.click(navRect.x + navRect.width / 2, navRect.y + navRect.height / 2);
      }
      await page.waitForTimeout(400);
      if ((await page.locator(".koma-drawer").count()) === 0) {
        // First click may have been swallowed by the relayout after the
        // viewport change — the drawer is a toggle, so click once more.
        const retry = await navBtn.boundingBox();
        if (retry) {
          await page.mouse.click(retry.x + retry.width / 2, retry.y + retry.height / 2);
        }
        await page.waitForTimeout(400);
      }
    }, 700);
    const drawerItem = page.locator('.koma-drawer__item:has-text("Cleaner/RD")');
    let drawerReady = true;
    try {
      await drawerItem.first().waitFor({ state: "visible", timeout: 5000 });
    } catch {
      drawerReady = false;
    }
    if (drawerReady) {
      await actionWindow(page, "mobile:drawer-mode", async () => {
        await drawerItem.first().click();
      }, 700);
    } else {
      console.log(
        `CENSUS mobile:drawer-mode SKIPPED: drawer items not found (drawer=${await page.locator(".koma-drawer").count()} items=${await page.locator(".koma-drawer__item").count()})`,
      );
    }
  }

  const fs = await import("node:fs/promises");
  const outPath = new URL("./.artifacts/react-scan-census-mobile.json", import.meta.url);
  await fs.writeFile(
    outPath,
    JSON.stringify({ gpu: gpu.mode, windows: census }, null, 2),
  );
  console.log(`CENSUS_ARTIFACT ${outPath.href}`);

  expect(problems, "no pageerrors/app console errors in mobile census").toEqual([]);
});
