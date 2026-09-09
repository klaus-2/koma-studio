import { expect, test, type Page } from "@playwright/test";

// Throwaway diagnostic probe (untracked) — FPS-agent-4 auth-covers window.
// User's react-scan Optimize tab signature (FPS-drop window, react 76ms +
// other 731ms on the AUTH/LOGIN screen): AuthShell 4r with
// onSelectLogin:4x (changed every render — unstable closure), LoginPage
// 4r/13ms, ManhwaCovers 4r/10ms, PageTransition 5r. The dominant mass is the
// 731ms "other" bucket (non-React: effects, style recalc, image decode/paint,
// compositor) — classic image-wall cost.
//
// The e2e vite mode sets VITE_AUTH_DISABLED=true (isAuthenticated:true), so
// /#/login falls through to the Dashboard. This probe runs against the DEV
// server (--mode development + VITE_REACT_SCAN=1) where the login screen is
// the real unauthenticated route — same browser, same instrument.
//
// Windows per run:
//   BOOT        = page load → covers mounted → settle 6s. Captures the
//                 initial decode/paint storm (long tasks, LCP, decode state)
//                 AND the boot render census (AuthShell churn seen by
//                 react-scan).
//   IDLE-RUN    = 8s, fully loaded, no input: rAF frame deltas + long tasks —
//                 the sustained cost of the CSS animations
//                 (cover-shine/preview-bar animate `left`; preview-clip
//                 animates `clip-path`; cover-drift animates transform).
//   IDLE-PAUSED = same 8s with all auth-shell animations paused (probe-only
//                 counterfactual, removed right after) — the delta between
//                 IDLE-RUN and IDLE-PAUSED attributes the sustained cost to
//                 the CSS animations specifically.
//
// Run: cd /c/Github/koma/apps/tauri && bunx playwright test tests/e2e/react-scan-auth-covers.spec.ts --project=chromium --workers=1
// Default HEADED (real GPU); SWEEP_HEADLESS=1 falls back to headless.

import {
  collectLongTasksSince,
  collectProblems,
  installLongTaskCollector,
  logGpuMode,
  markLongTasks,
  probeLaunchOptions,
  worstOf,
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
  unnecessary: boolean | null;
  changes: number;
}

const RERUNS = Number(process.env.AUTH_RERUNS ?? 1);
const summaryStore: string[] = [];

const AUTH_TARGETS = [
  "AuthShell",
  "LoginPage",
  "ManhwaCovers",
  "BrandMark",
  "PageTransition",
  "AppShell",
];

const aggregate = (events: ScanEvent[]): string => {
  const out = new Map<string, { renders: number; time: number; changes: number }>();
  for (const event of events) {
    if (event.name === null || event.name.startsWith("MARK:")) continue;
    // react-scan names memo-wrapped components "<name><n>" (memo wrapper gets
    // its own cache slot) — fold ManhwaCovers2 back into ManhwaCovers.
    const name = event.name.replace(/^(ManhwaCovers)\d+$/, "$1");
    const slot = out.get(name) ?? { renders: 0, time: 0, changes: 0 };
    slot.renders += 1;
    slot.time += event.time;
    slot.changes += event.changes;
    out.set(name, slot);
  }
  return AUTH_TARGETS.map((name) => {
    const slot = out.get(name);
    return slot
      ? `${name}(${slot.renders}r ${slot.time.toFixed(0)}ms ch=${slot.changes})`
      : `${name}(0r)`;
  }).join(" | ");
};

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

interface FrameStats {
  frames: number;
  median: number;
  p95: number;
  worst: number;
  over32: number;
}

const sampleFrames = (page: Page, windowMs: number): Promise<FrameStats> =>
  page.evaluate(
    (duration) =>
      new Promise<FrameStats>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - start < duration) {
            requestAnimationFrame(tick);
          } else {
            if (deltas.length === 0) {
              resolve({
                frames: 0,
                median: 0,
                p95: 0,
                worst: 0,
                over32: 0,
              });
              return;
            }
            const sorted = [...deltas].sort((a, b) => a - b);
    const at = (fraction: number): number =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
    resolve({
      frames: deltas.length,
      median: at(0.5),
      p95: at(0.95),
      worst: sorted[sorted.length - 1] ?? 0,
      over32: deltas.filter((d) => d > 32).length,
    });
          }
        };
        requestAnimationFrame(tick);
      }),
    windowMs,
  );

interface ImgProbe {
  count: number;
  decoded: number;
  pendingDecode: number;
  broken: number;
  naturalMegapixels: string;
  lcpMs: number | null;
  clipAnims: number;
  barAnims: number;
  shineAnims: number;
  driftAnims: number;
  totalAnims: number;
}

const probeImages = async (page: Page): Promise<ImgProbe> =>
  page.evaluate(async () => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".manhwa-float img, .koma-neko img",
      ),
    );
    let pendingDecode = 0;
    for (const img of imgs) {
      // decode() resolves immediately for already-decoded images and only
      // waits while the decode is genuinely pending.
      await img.decode().catch(() => {
        pendingDecode += 1;
      });
    }
    const areas = imgs.map((img) => img.naturalWidth * img.naturalHeight);
    const lcpEntries = performance.getEntriesByType(
      "largest-contentful-paint",
    ) as Array<{ startTime: number }>;
    let clipAnims = 0;
    let barAnims = 0;
    let shineAnims = 0;
    let driftAnims = 0;
    for (const el of document.querySelectorAll<HTMLElement>(
      ".manhwa-float__before-wrap",
    )) {
      if (getComputedStyle(el).animationName === "preview-clip") clipAnims += 1;
    }
    for (const el of document.querySelectorAll<HTMLElement>(".manhwa-float__bar")) {
      if (getComputedStyle(el).animationName === "preview-bar") barAnims += 1;
    }
    for (const el of document.querySelectorAll<HTMLElement>(".manhwa-float")) {
      const name = getComputedStyle(el).animationName;
      if (name.startsWith("cover-drift")) driftAnims += 1;
    }
    // cover-shine runs on .manhwa-float::after — visible via document
    // animations, not getComputedStyle on the host element.
    const all = document.getAnimations();
    for (const anim of all) {
      const cssAnim = anim as { animationName?: string };
      if (cssAnim.animationName === "cover-shine") shineAnims += 1;
    }
    const lastLcp = lcpEntries[lcpEntries.length - 1];
    return {
      count: imgs.length,
      decoded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      pendingDecode,
      broken: imgs.filter((i) => i.naturalWidth === 0).length,
      naturalMegapixels: areas
        .map((a) => (a / 1_000_000).toFixed(2) + "MP")
        .join("+"),
      lcpMs: lastLcp ? lastLcp.startTime : null,
      clipAnims,
      barAnims,
      shineAnims,
      driftAnims,
      totalAnims: all.length,
    };
  });

for (let run = 1; run <= RERUNS; run += 1) {
  test(`auth-covers attribution run ${run}`, async ({ page }) => {
    test.setTimeout(300_000);
    const problems = collectProblems(page);
    await installLongTaskCollector(page);
    await logGpuMode(page, "auth-covers");

    // ── WINDOW BOOT: load → covers mounted → settle 6s ──
    const markBoot = await markLongTasks(page);
    await page.goto("/#/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".auth-shell")).toBeVisible();
    // DEV delay = 0 → the covers mount immediately with the shell.
    await expect(page.locator(".manhwa-float")).toHaveCount(5);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(6_000);

    const bootEvents = await snapshotAndClear(page);
    const bootTasks = await collectLongTasksSince(page, markBoot);
    const imgProbe = await probeImages(page);
    const bootSummary = `BOOT ${aggregate(bootEvents)} tasks=${bootTasks.length} worst=${worstOf(bootTasks).toFixed(0)}ms total=${bootTasks.reduce((a, t) => a + t.duration, 0).toFixed(0)}ms imgs=${imgProbe.count} decoded=${imgProbe.decoded} pendingDecode=${imgProbe.pendingDecode} broken=${imgProbe.broken} anims clip/shine/bar/drift/total=${imgProbe.clipAnims}/${imgProbe.shineAnims}/${imgProbe.barAnims}/${imgProbe.driftAnims}/${imgProbe.totalAnims} mp=${imgProbe.naturalMegapixels} lcp=${imgProbe.lcpMs?.toFixed(0) ?? "?"}ms`;
    console.log(bootSummary);
    console.log(
      `BOOT task-timeline=[${bootTasks
        .map((t) => `${t.startTime.toFixed(0)}:${t.duration.toFixed(0)}ms`)
        .join(", ")}]`,
    );
    summaryStore.push(bootSummary);

    // ── WINDOW IDLE-RUN: fully loaded, no input — sustained animation cost ──
    const markIdle = await markLongTasks(page);
    const framesRun = await sampleFrames(page, 8_000);
    const idleTasks = await collectLongTasksSince(page, markIdle);
    const idleEvents = await snapshotAndClear(page);
    const idleSummary = `IDLE-RUN frames=${framesRun.frames} median=${framesRun.median.toFixed(1)}ms p95=${framesRun.p95.toFixed(1)}ms worst=${framesRun.worst.toFixed(1)}ms over32=${framesRun.over32} tasks=${idleTasks.length} worst=${worstOf(idleTasks).toFixed(0)}ms renders=${idleEvents.length}`;
    console.log(idleSummary);
    summaryStore.push(idleSummary);

    // ── WINDOW IDLE-PAUSED: same 8s with auth animations paused (probe-only
    //    counterfactual) — delta vs IDLE-RUN attributes sustained cost ──
    const pauseStyle = await page.addStyleTag({
      content: ".auth-shell *, .auth-shell *::after, .auth-shell *::before { animation-play-state: paused !important; }",
    });
    const markPaused = await markLongTasks(page);
    const framesPaused = await sampleFrames(page, 8_000);
    const pausedTasks = await collectLongTasksSince(page, markPaused);
    await pauseStyle.evaluate((el) => {
      (el as unknown as { remove: () => void }).remove();
    });
    const pausedSummary = `IDLE-PAUSED frames=${framesPaused.frames} median=${framesPaused.median.toFixed(1)}ms p95=${framesPaused.p95.toFixed(1)}ms worst=${framesPaused.worst.toFixed(1)}ms over32=${framesPaused.over32} tasks=${pausedTasks.length} worst=${worstOf(pausedTasks).toFixed(0)}ms`;
    console.log(pausedSummary);
    summaryStore.push(pausedSummary);

    expect(
      problems,
      "no pageerrors/app console errors during auth probe",
    ).toEqual([]);
  });
}

test.afterAll(async () => {
  if (summaryStore.length > 0) {
    console.log("=== AUTH-COVERS SUMMARY ===");
    for (const entry of summaryStore) {
      console.log(`SUMMARY ${entry}`);
    }
  }
});
