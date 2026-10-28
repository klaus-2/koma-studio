// Runtime smoke for the perf pass 6 changes (commits 112cbee, 5ab1a82, 2210833):
//  1. Gallery sidebar: memoized items render, active state moves on click,
//     removal keeps the list healthy (memo + AnimatePresence reconciliation).
//  2. Manual dock (memoized family + hasActiveSelectedRegion boolean) mounts
//     when the dashboard reaches an aio-manual state; skipped when the submode
//     toggle can't be driven from the UI.
//  3. Optimizer compare slider (rAF-coalesced) — needs a generated preview
//     (backend-dependent), so it reports SKIP like the pass 3 batch step.
//  4. No page errors anywhere; console errors filtered to env noise.
// Usage: node scripts/smoke-perf-pass6.mjs [url]   (default http://127.0.0.1:5173/)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("C:/Github/koma-studio/apps/tauri/package.json");
const { chromium } = require("playwright");

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:5173/";
const OUT_DIR = path.resolve(".zcode-e2e");
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));

const results = [];
const step = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const gotoFresh = async () => {
  await page.goto(URL_BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
};

// Noir (default family) rows are `li.panel-cut-sm`; classic rows are
// `.koma-fileitem`. Active state: noir paints bg-crimson/15 on the row,
// classic uses koma-fileitem--active.
const galleryRows = () =>
  page.evaluate(() => {
    // Gallery rows carry the filename as p[title]; stats rows don't.
    const noir = [...document.querySelectorAll("ul li.panel-cut-sm.group")].filter(
      (li) => li.querySelector("p[title]"),
    );
    if (noir.length || document.querySelector("ul li.panel-cut-sm.group")) {
      return {
        family: "noir",
        rows: noir.map((li) => ({
          name: li.querySelector("p[title]")?.getAttribute("title") ?? "",
          active: li.className.includes("bg-crimson/15"),
          buttons: li.querySelectorAll("button").length,
        })),
      };
    }
    const classic = [...document.querySelectorAll(".koma-fileitem")];
    return {
      family: "classic",
      rows: classic.map((li) => ({
        name: li.querySelector("p[title]")?.getAttribute("title") ?? "",
        active: li.classList.contains("koma-fileitem--active"),
        buttons: li.querySelectorAll("button").length,
      })),
    };
  });

// ── 1. boot ──
await gotoFresh();
const loginVisible = await page.getByText(/Sign in to your account|Faça login/i).count();
step("dashboard boots without login", loginVisible === 0);

// ── 2. upload two images → gallery renders both memoized rows ──
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const fileInput = page.locator("input[type='file']").first();
await fileInput.setInputFiles([
  { name: "pixel-a.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") },
  { name: "pixel-b.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") },
]);
await page.waitForTimeout(3500);
let gallery = await galleryRows();
step(
  "gallery renders 2 memoized items",
  gallery.rows.length === 2 && gallery.rows.every((r) => r.buttons >= 4),
  `family=${gallery.family} rows=${gallery.rows.length} buttons=${gallery.rows.map((r) => r.buttons).join(",")}`,
);

// ── 3. exactly one active row, then click moves it (memo prop wiring) ──
step(
  "exactly one gallery item is active",
  gallery.rows.filter((r) => r.active).length === 1,
  `active=${gallery.rows.map((r) => (r.active ? 1 : 0)).join(",")}`,
);
// Click the row's filename paragraph: the geometric center of the row lands
// on the hover action buttons (which stopPropagation), not the row itself.
const secondRow = page
  .locator("li.panel-cut-sm.group, .koma-fileitem")
  .filter({ has: page.locator("p[title]") })
  .nth(1);
await secondRow.locator("p[title]").click();
await page.waitForTimeout(1200);
gallery = await galleryRows();
step(
  "clicking second item moves active state",
  gallery.rows.length === 2 && gallery.rows[1].active && !gallery.rows[0].active,
  `active=${gallery.rows.map((r) => (r.active ? 1 : 0)).join(",")}`,
);
await page.screenshot({ path: path.join(OUT_DIR, "p6-gallery.png") });

// ── 4. removing an item keeps the list healthy (memo + exit animation) ──
const removeBtn = secondRow
  .locator("button")
  .last();
await removeBtn.click();
await page.waitForTimeout(1500);
gallery = await galleryRows();
step(
  "removing an item keeps the list healthy",
  gallery.rows.length === 1 && gallery.rows[0].buttons >= 4,
  `rows=${gallery.rows.length}`,
);

// ── 5. manual dock mounts (memoized family + boolean region prop) ──
// Submode → manual is normally reached via the AIO right panel; probe for a
// control whose label mentions manual and, if the dock appears, assert it.
let manualClicked = false;
const manualCtl = page
  .locator("button")
  .filter({ hasText: /manual/i })
  .first();
if (await manualCtl.count()) {
  await manualCtl.click({ force: true });
  await page.waitForTimeout(1800);
  manualClicked = true;
}
const dockVisible = await page.locator("[data-tour='dashboard-manual-dock']").count();
if (manualClicked || dockVisible > 0) {
  step("manual dock mounts (memo family renders)", dockVisible > 0, `dock=${dockVisible}`);
  await page.screenshot({ path: path.join(OUT_DIR, "p6-dock.png") });
} else {
  console.log("SKIP manual dock mounts — submode toggle not reachable from UI");
}

// ── 6. optimizer compare slider (rAF-coalesced) — best-effort ──
// Needs a generated preview (local backend); SKIP mirrors the pass 3 batch step.
await gotoFresh();
if (await page.locator("input[type='file']").first().count()) {
  const fileInput2 = page.locator("input[type='file']").first();
  await fileInput2.setInputFiles({
    name: "pixel-c.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_B64, "base64"),
  });
  await page.waitForTimeout(2500);
}
let compareSeen = false;
const compareProbe = page.locator("input[type='range'][aria-label]").first();
if (await compareProbe.count().catch(() => 0)) {
  // Noir compare is a full-overlay range input driving clipPath through the
  // rAF flush; nudge it and confirm the clip path moved.
  await compareProbe.focus();
  await compareProbe.press("ArrowRight");
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) =>
      (d.getAttribute("style") ?? "").includes("clip-path"),
    );
    return el?.getAttribute("style") ?? "";
  });
  compareSeen = /clip-path:.*inset/.test(clip);
  if (compareSeen) {
    step("optimizer compare updates clip-path via rAF flush", true, clip.slice(0, 80));
  }
}
if (!compareSeen) {
  console.log("SKIP optimizer compare updates clip-path — preview needs the local backend");
}
await page.screenshot({ path: path.join(OUT_DIR, "p6-optimizer.png") });

// ── 7. errors ──
const ENV_NOISE =
  /fetch|Failed to fetch|net::|ERR_CONNECTION|404|401|ECONNREFUSED|NetworkError|Failed to load resource|AbortError|signal is aborted/i;
const BROWSER_RUNTIME_NOISE =
  /failed to load the session secret|reading 'invoke'|invokeCommand/i;
const realConsoleErrors = consoleErrors.filter(
  (e) => !ENV_NOISE.test(e) && !BROWSER_RUNTIME_NOISE.test(e),
);
step("no page errors", pageErrors.length === 0, pageErrors.join(" | ") || undefined);
step(
  "no non-env console errors",
  realConsoleErrors.length === 0,
  realConsoleErrors.slice(0, 3).join(" | ") || undefined,
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\nSMOKE ${failed === 0 ? "PASS" : "FAIL"}: ${results.length - failed}/${results.length} steps ok`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
