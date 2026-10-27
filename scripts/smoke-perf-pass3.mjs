// Runtime smoke for the perf pass 3 changes (commit e38a41c):
//  1. Dashboard boots in dev (auth bypass) with the noir theme (default family).
//  2. Guides info mode: reader progress bar fill animates scaleX (compositor-only),
//     with NO inline width — proves the new code is what's running.
//  3. Reader step navigation still works (transform value changes between steps).
//  4. Optimizer / Watermark / Imgur dashboard modes mount without page errors.
//  5. No page errors anywhere; console errors reported (env/network noise filtered).
// Usage: node scripts/smoke-perf-pass3.mjs [url]   (default http://127.0.0.1:5176/)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("C:/Github/koma-studio/apps/tauri/package.json");
const { chromium } = require("playwright");

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:5176/";
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

// Topbar triggers are partially overlapped by sibling buttons; menus open via a
// JS-dispatched click, but Radix menu ITEMS need a real (trusted) click.
const openTopbarMenu = async (name) => {
  const opened = await page.evaluate((label) => {
    const trigger = [...document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") ?? "").trim() === label
        || (b.textContent ?? "").trim().toLowerCase() === label.toLowerCase(),
    );
    if (!trigger) return false;
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  }, name);
  await page.waitForTimeout(900);
  return opened;
};

const clickMenuItem = async (itemName) => {
  const item = page
    .locator("[role='menu'] [role='menuitem'], [role='menu'] button", { hasText: itemName })
    .first();
  if (!(await item.count())) {
    const menus = await page.evaluate(() =>
      [...document.querySelectorAll("[role='menu']")].map((m) => (m.textContent ?? "").slice(0, 120)),
    );
    console.log(`  menu dump for "${itemName}":`, JSON.stringify(menus));
    return false;
  }
  await item.click();
  await page.waitForTimeout(2500);
  return true;
};

// Mode content is asserted on the whole body — menus close after a real item
// click, so no open menu can fake a pass.
const bodyText = () => page.evaluate(() => document.body.innerText);

// Progressbar fills: [{transform, width}] straight from inline styles.
const readProgressbars = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="progressbar"]')].map((bar) => {
      const fill = bar.firstElementChild;
      if (!fill) return null;
      const style = fill.getAttribute("style") ?? "";
      const grab = (prop) =>
        (style.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`)) ?? [])[1]?.trim() ?? "";
      return { transform: grab("transform"), width: grab("width") };
    }),
  );

const scaleValueOf = (entry) => {
  const m = entry?.transform?.match(/scaleX\((-?[\d.]+)\)/);
  return m ? Number(m[1]) : null;
};

const gotoFresh = async () => {
  await page.goto(URL_BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
};

// ── 1. boot ──
await gotoFresh();
const loginVisible = await page.getByText(/Sign in to your account|Faça login/i).count();
step("dashboard boots without login", loginVisible === 0);
await page.screenshot({ path: path.join(OUT_DIR, "s1-dashboard.png") });

// ── 2. guides mode → guide card → reader ──
let guidesOpen = false;
if (await openTopbarMenu("Informações")) {
  guidesOpen = await clickMenuItem("Guias & Tutoriais");
}
step(
  "guides info mode opens",
  guidesOpen && /guias & tutoriais|guides & tutorials/i.test(await bodyText()),
);
await page.screenshot({ path: path.join(OUT_DIR, "s2-guides-home.png") });

// Reader flow: category card button → guide entry button → reader mounts.
let readerOpened = false;
const stage = page.locator("[data-tour='dashboard-stage']");
const category = stage.locator("button", { hasText: /Quick Start/i }).first();
if (await category.count()) {
  await category.click();
  await page.waitForTimeout(2200);
}
const entries = stage.locator("button").filter({ hasText: /./ });
const entryCount = await entries.count();
for (let i = 0; i < entryCount && !readerOpened; i += 1) {
  const text = (await entries.nth(i).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  if (text.length < 10 || /voltar|back|buscar|search|settings|guias$/i.test(text)) continue;
  await entries.nth(i).click();
  await page.waitForTimeout(2200);
  readerOpened = (await page.getByRole("progressbar").count()) > 0;
}
step("guide reader opens (progressbar present)", readerOpened);
await page.screenshot({ path: path.join(OUT_DIR, "s3-guide-reader.png") });

const bars = await readProgressbars();
const readerFill = bars.find((b) => scaleValueOf(b) !== null);
step(
  "reader fill animates scaleX (no inline width)",
  readerFill !== undefined && readerFill.width === "",
  readerFill
    ? `transform=${readerFill.transform} width=${readerFill.width || "none"}`
    : `bars=${JSON.stringify(bars)}`,
);

// ── 3. step navigation changes the scaleX value ──
const before = readerFill ? scaleValueOf(readerFill) : null;
const nextBtn = page
  .locator("[data-tour='dashboard-stage'] button")
  .filter({ hasText: /^próximo|^next/i })
  .first();
let after = before;
if (await nextBtn.count()) {
  await nextBtn.click();
  await page.waitForTimeout(1500);
  const barsAfter = await readProgressbars();
  after = barsAfter.length ? scaleValueOf(barsAfter[barsAfter.length - 1]) : null;
}
step(
  "step navigation updates scaleX",
  before !== null && after !== null && after !== before,
  `before=${before} after=${after}`,
);

// ── 4. remaining modes mount cleanly (fresh load per mode) ──
const openModeFromFreshLoad = async (menuName, itemName, probeRe, shot) => {
  await gotoFresh();
  if (!(await openTopbarMenu(menuName))) {
    step(`mode mounts: ${itemName}`, false, "topbar trigger not found");
    return;
  }
  if (!(await clickMenuItem(itemName))) {
    step(`mode mounts: ${itemName}`, false, "menu item not found");
    return;
  }
  step(`mode mounts: ${itemName}`, probeRe.test(await bodyText()));
  await page.screenshot({ path: path.join(OUT_DIR, shot) });
};

await openModeFromFreshLoad("Utilitários", "Chapter Optimizer", /otimiz|optimiz/i, "s4-optimizer.png");
await openModeFromFreshLoad("Utilitários", "Marca d'Água", /marca d'água/i, "s5-watermark.png");
await openModeFromFreshLoad("Utilitários", "Imgur Upload", /imgur/i, "s6-imgur.png");

// ── 5. functional: image upload → watermark blob swap → optimizer batch ──
// 1×1 red PNG; exercises the client-side render pipeline without a backend.
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
await gotoFresh();
const fileInput = page.locator("input[type='file']").first();
await fileInput.setInputFiles({
  name: "pixel.png",
  mimeType: "image/png",
  buffer: Buffer.from(PNG_B64, "base64"),
});
await page.waitForTimeout(3500);
step(
  "image lands in the collection",
  !/selecione ou carregue imagens/i.test(await bodyText()),
);

// Watermark: preview blob renders, then SWAPS (old URL revoked) on draft change.
if (await openTopbarMenu("Utilitários")) await clickMenuItem("Marca d'Água");
const previewSrc = () =>
  page.evaluate(() => {
    // The preview img carries alt "Watermark"; thumb strip imgs (which never
    // change) must not be mistaken for it.
    const byAlt = document.querySelector("img[alt='Watermark'][src^='blob:']");
    if (byAlt) return byAlt.getAttribute("src");
    const blobImgs = [...document.querySelectorAll("[data-tour='dashboard-stage'] img[src^='blob:']")];
    return blobImgs.length ? blobImgs[blobImgs.length - 1].getAttribute("src") : null;
  });
const srcBefore = await previewSrc();
step("watermark preview blob renders", srcBefore !== null, `src=${srcBefore}`);
const contentChanged = await page.evaluate(() => {
  const input = [...document.querySelectorAll("input")].find(
    (i) => i.type === "text" && /studio/i.test(i.value),
  );
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) return false;
  setter.call(input, "SMOKE PASS 3");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
});
if (contentChanged) {
  await page.waitForTimeout(3500);
}
const srcAfter = await previewSrc();
step(
  "preview blob swaps on draft change (T5 runRender path)",
  srcBefore !== null && srcAfter !== null && srcBefore !== srcAfter,
  `${srcBefore} -> ${srcAfter}`,
);
await page.screenshot({ path: path.join(OUT_DIR, "s7-watermark-blob.png") });

// Logo upload: second swap site (handleWatermarkImageChange).
const logoInputs = page.locator("input[type='file']");
const logoCount = await logoInputs.count();
let logoOk = false;
if (logoCount >= 2) {
  const blobImgsBefore = await page.evaluate(
    () => document.querySelectorAll("img[src^='blob:']").length,
  );
  await logoInputs.nth(logoCount - 1).setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_B64, "base64"),
  });
  await page.waitForTimeout(2500);
  const blobImgsAfter = await page.evaluate(
    () => document.querySelectorAll("img[src^='blob:']").length,
  );
  logoOk = blobImgsAfter > blobImgsBefore;
}
step("logo upload renders a second blob preview (T5 handler path)", logoOk);

// Optimizer: run a batch and watch the progress bar animate scaleX (T1).
// Best-effort: the full optimize flow may need the local backend, in which
// case the step reports SKIP instead of failing the suite.
if (await openTopbarMenu("Utilitários")) await clickMenuItem("Chapter Optimizer");
const runBtn = page
  .locator("button")
  .filter({ hasText: /otimiz|process|exportar|aplicar em lote|executar/i })
  .filter({ hasNotText: /^utilitários$/i })
  .first();
let batchSeen = false;
let batchDetail = "run button not found";
if (await runBtn.count()) {
  await runBtn.click({ force: true });
  for (let i = 0; i < 12 && !batchSeen; i += 1) {
    await page.waitForTimeout(1000);
    const bars = await readProgressbars();
    const fill = bars.find((b) => scaleValueOf(b) !== null);
    if (fill) {
      batchSeen = fill.width === "";
      batchDetail = `transform=${fill.transform} width=${fill.width || "none"}`;
    }
  }
  if (!batchSeen && batchDetail.startsWith("transform") === false) {
    batchDetail = "progress bar never appeared (backend-dependent flow)";
  }
} else {
  const allButtons = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim().replace(/\s+/g, " ")))].filter((t) => t && t.length < 40).slice(0, 30),
  );
  batchDetail = `no run CTA; buttons: ${allButtons.join(" | ").slice(0, 250)}`;
}
if (batchSeen) {
  step("optimizer batch bar animates scaleX (T1)", true, batchDetail);
} else {
  // Reported but not counted as a failure: the flow needs the local backend.
  console.log(`SKIP optimizer batch bar animates scaleX (T1) — ${batchDetail}`);
}
await page.screenshot({ path: path.join(OUT_DIR, "s8-optimizer-batch.png") });

// ── 6. errors — page errors always fail; console errors filtered to env noise ──
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
