// Visual/i18n test of the app in dev (auth bypass via VITE_AUTH_DISABLED).
// Usage: node scripts/e2e-i18n-sizes.mjs [url]   (default http://localhost:5176/)
//
// Verifies:
//  1. Dashboard loads without the login screen (bypass).
//  2. No raw i18n keys visible on the dashboard or in the Model Vault.
//  3. New catalog sizes appear in the cards (e.g. 593.75MB).
//  4. Saves screenshots to .zcode-e2e/ for inspection.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("C:/Github/koma/apps/tauri/package.json");
const { chromium } = require("playwright");

const URL_BASE = process.argv[2] ?? "http://localhost:5176/";
const OUT_DIR = path.resolve(".zcode-e2e");
await mkdir(OUT_DIR, { recursive: true });

// Keys that must NEVER appear as raw strings in the UI (suspected i18n prefixes).
const RAW_KEY_RE = /\b(?:aioStage|toolbar|modelManager|modelCard|modelTooltip|dashboard|shortcuts|settings|watermark|translator|detection)\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/g;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleIssues = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (/missing|i18n|raw key|not found.*key/i.test(text)) consoleIssues.push(text.slice(0, 200));
});

const report = { url: URL_BASE, steps: [] };
const step = (name, ok, detail) => {
  report.steps.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

await page.goto(URL_BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

// 1. auth bypass: direct dashboard (no login form)
const loginVisible = await page.getByText(/Sign in to your account/i).count();
step("auth bypass", loginVisible === 0, loginVisible ? "login screen appeared" : undefined);
await page.screenshot({ path: path.join(OUT_DIR, "01-dashboard.png"), fullPage: false });

const bodyText = await page.locator("body").innerText();
const rawOnDashboard = [...new Set(bodyText.match(RAW_KEY_RE) ?? [])];
step("no raw keys on dashboard", rawOnDashboard.length === 0, rawOnDashboard.join(", ") || undefined);

// 2. AIO tab → Models button → Model Vault
const aioTab = page.getByRole("tab", { name: /AIO/i }).first();
if (await aioTab.count()) {
  await aioTab.click();
  await page.waitForTimeout(2000);
}
const aioText0 = await page.locator("body").innerText();
const rawOnAio = [...new Set(aioText0.match(RAW_KEY_RE) ?? [])];
step("no raw keys on AIO tab", rawOnAio.length === 0, rawOnAio.join(", ") || undefined);

const manageButton = page.getByRole("button", { name: /^(Models|Modelos)$/ }).first();
if (await manageButton.count()) {
  await manageButton.click();
  await page.waitForTimeout(2500);
} else {
  console.log("warning: Models button not found; continuing with the current page text");
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: path.join(OUT_DIR, "02-model-vault.png"), fullPage: false });

const vaultText = await page.locator("body").innerText();
const rawOnVault = [...new Set(vaultText.match(RAW_KEY_RE) ?? [])];
step("no raw keys on Model Vault", rawOnVault.length === 0, rawOnVault.join(", ") || undefined);

// 3. new sizes visible
// The vault opens on the Detect Text stage (first Models button in AIO):
// RT-DETR v2 updated to 160.68MB; Comic/PP kept (multi-file).
const sizeChecks = ["160.68MB", "320MB", "400MB"];
const foundSizes = sizeChecks.filter((s) => vaultText.includes(s));
step("real catalog sizes", foundSizes.includes("160.68MB") && foundSizes.length >= 2, `found: ${foundSizes.join(", ") || "none"}`);

step("no i18n console errors", consoleIssues.length === 0, consoleIssues.slice(0, 3).join(" | ") || undefined);

await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
const failed = report.steps.filter((s) => !s.ok);
console.log(`\n${report.steps.length - failed.length}/${report.steps.length} checks ok`);
await browser.close();
process.exit(failed.length ? 1 : 0);
