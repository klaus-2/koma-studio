// Runtime smoke for the perf pass 4 changes (commit c29eb8d):
//  1. Dashboard boots in dev (auth bypass).
//  2. Settings (T7): the webhook config is read at first render from
//     localStorage (lazy initializer) — the seeded botName is already in the
//     input — and a save round-trips back to localStorage.
//  3. Scanlation feed route (T5): page mounts and renders.
//  4. Typesetter mode (T1): typographer text queue (default multi-bubble
//     regions) mounts.
//  5. Blogger CDN mode (T4): workspace mounts.
//  6. Chapter Optimizer mode (T6): workspace mounts without the removed
//     directory-picker effect.
//  7. No page errors anywhere; console errors reported (env/network noise filtered).
// Usage: node scripts/smoke-perf-pass4.mjs [url]   (default http://localhost:5176/)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("C:/Github/koma-studio/apps/tauri/package.json");
const { chromium } = require("playwright");

// The dev server may bind IPv6 localhost only; prefer localhost over 127.0.0.1.
const URL_BASE = process.argv[2] ?? "http://localhost:5176/";
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
const openTopbarMenu = async (nameRegex) => {
  const opened = await page.evaluate((pattern) => {
    const re = new RegExp(pattern, "i");
    const trigger = [...document.querySelectorAll("button")].find(
      (b) =>
        re.test((b.getAttribute("aria-label") ?? "")) ||
        re.test((b.textContent ?? "").trim()),
    );
    if (!trigger) return false;
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  }, nameRegex.source);
  await page.waitForTimeout(900);
  return opened;
};

const clickMenuItem = async (itemRegex) => {
  const items = page.locator(
    "[role='menu'] [role='menuitem'], [role='menu'] button",
  );
  const count = await items.count();
  for (let i = 0; i < count; i += 1) {
    const text = (await items.nth(i).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    if (itemRegex.test(text)) {
      await items.nth(i).click();
      await page.waitForTimeout(2500);
      return true;
    }
  }
  return false;
};

const bodyText = () => page.evaluate(() => document.body.innerText);

const gotoFresh = async (hash = "") => {
  await page.goto(`${URL_BASE}${hash}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
};

const openModeFromFreshLoad = async (groupRegex, itemRegex, probeRe, shot, label) => {
  await gotoFresh();
  if (!(await openTopbarMenu(groupRegex))) {
    step(`mode mounts: ${label}`, false, "topbar group not found");
    return;
  }
  if (!(await clickMenuItem(itemRegex))) {
    step(`mode mounts: ${label}`, false, "menu item not found");
    return;
  }
  step(`mode mounts: ${label}`, probeRe.test(await bodyText()));
  await page.screenshot({ path: path.join(OUT_DIR, shot) });
};

// Seed BEFORE any navigation: goto with only a hash difference is a
// same-document navigation and would NOT re-run addInitScript, so the seed
// must be registered up front (it persists in localStorage).
await page.addInitScript(() => {
  window.localStorage.setItem(
    "koma-webhook",
    JSON.stringify({
      // enabled stays false: the save handler validates the URL only when
      // enabled or a non-empty URL — keep the round-trip backend-free.
      enabled: false,
      botName: "SMOKE4",
      url: "https://discord.com/api/webhooks/1234567890123456789/SMOKE4TOKEN",
      events: {},
    }),
  );
});

// ── 1. boot ──
await gotoFresh();
const bootHash = await page.evaluate(() => window.location.hash);
const bootBody = await bodyText();
const bootedToDashboard =
  bootHash !== "#/login" && /utilit|utils|produção|production/i.test(bootBody);
step("dashboard boots without login (e2e auth bypass)", bootedToDashboard, `hash=${bootHash}`);
await page.screenshot({ path: path.join(OUT_DIR, "p4-1-dashboard.png") });

// ── 2. settings: webhook lazy-init (T7) + save round-trip ──
await gotoFresh("#/settings");
const integrationsTab = page
  .locator("button", { hasText: /Integrações|Integrations/i })
  .first();
if (await integrationsTab.count()) {
  await integrationsTab.click();
  await page.waitForTimeout(2000);
}
// React sets input values via the DOM property, not the attribute — match on
// the property (CSS [value=] would look at the attribute and always miss).
const hasSeededInput = await page.evaluate(
  () => [...document.querySelectorAll("input")].some((i) => i.value === "SMOKE4"),
);
if (!hasSeededInput) {
  const diag = await page.evaluate(() => ({
    inputs: [...document.querySelectorAll("input")].map((i) => i.value.slice(0, 18)),
    activeTabText: document.querySelector("[aria-selected='true']")?.textContent ?? null,
  }));
  console.log("  webhook diag:", JSON.stringify(diag));
}
step("webhook config loads at first render (T7 lazy init)", hasSeededInput);
await page.screenshot({ path: path.join(OUT_DIR, "p4-2-settings-webhook.png") });

// Save round-trip: the lazy-initialized state stays live for the save handler.
if (hasSeededInput) {
  await page.evaluate(() => {
    const input = [...document.querySelectorAll("input")].find((i) => i.value === "SMOKE4");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    if (input && setter) {
      setter.call(input, "SMOKE4B");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.locator("button", { hasText: /save|salvar/i }).first().click();
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem("koma-webhook");
      return raw ? JSON.parse(raw).botName : null;
    } catch {
      return null;
    }
  });
  step("webhook save round-trips through lazy state (T7)", saved === "SMOKE4B", `botName=${saved}`);
}

// ── 3. scanlation feed (T5) ──
await gotoFresh("#/scanlation-feed");
const feedText = await bodyText();
step(
  "scanlation feed mounts (T5 ref conversion)",
  /feed|recrut|showcase|vaga|publicação/i.test(feedText),
);
await page.screenshot({ path: path.join(OUT_DIR, "p4-3-feed.png") });

// ── 4. modes ──
// Typesetter is a direct topbar TAB (not a menu item) in this theme family.
await gotoFresh();
const typesetterTab = page
  .locator("[role='tab']", { hasText: /Tipógrafo|Typesetter/i })
  .first();
let typesetterMounted = false;
if (await typesetterTab.count()) {
  await typesetterTab.click();
  await page.waitForTimeout(2500);
  typesetterMounted = /text queue|fila de texto/i.test(await bodyText());
}
step("typesetter mounts (T1 default regions)", typesetterMounted);
await page.screenshot({ path: path.join(OUT_DIR, "p4-4-typesetter.png") });
await openModeFromFreshLoad(
  /utilit|utils/i,
  /blogger/i,
  /blogger/i,
  "p4-5-blogger.png",
  "blogger CDN (T4 ref conversion)",
);
await openModeFromFreshLoad(
  /utilit|utils/i,
  /chapter optimizer|otimizador/i,
  /otimiz|optimiz/i,
  "p4-6-optimizer.png",
  "chapter optimizer (T6 lazy feature-detect)",
);

// ── 5. errors — page errors always fail; console errors filtered to env noise ──
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
