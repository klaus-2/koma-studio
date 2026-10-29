// Runtime smoke for the perf pass 7 changes:
//  1. Preset editor island (store-backed draft): open "New", type name and
//     description, create — the preset shows up in the language preset select.
//  2. LLM settings island: pick an LLM-capable translation model, type in the
//     extra-context textarea, flip a toggle and confirm the textarea keeps its
//     value across a tab round-trip (the panel unmounts; the store owns state).
//     SKIP when no LLM-capable option is selectable (needs a provider key).
//  3. No page errors anywhere; console errors filtered to env noise.
// Usage: node scripts/smoke-perf-pass7.mjs [url]   (default http://127.0.0.1:5173/)
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

const PRESET_NAME = "Smoke pass 7 preset";
const LLM_TEXT = "smoke perf pass 7";

await page.goto(URL_BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

// ── 1. boot ──
const loginVisible = await page.getByText(/Sign in to your account|Faça login/i).count();
step("dashboard boots without login", loginVisible === 0);

// ── 2. preset editor island (store-backed draft) ──
const presetRow = page.locator(".koma-aio-lang-preset-row").first();
const presetRowVisible = await presetRow
  .waitFor({ state: "visible", timeout: 20000 })
  .then(() => true)
  .catch(() => false);
step("aio panel shows the language preset row", presetRowVisible);

if (presetRowVisible) {
  // The two primary actions are "Save current" (0) and "New" (1).
  const newPresetBtn = presetRow
    .locator(".koma-aio-preset-bar__actions button.koma-aio-preset-action--primary")
    .nth(1);
  await newPresetBtn.click();
  await page.waitForTimeout(400);

  const editor = page.locator(".koma-aio-preset-editor");
  const editorOpen = (await editor.count()) === 1;
  step("preset editor opens from the New action", editorOpen);

  if (editorOpen) {
    const inputs = editor.locator("input.koma-input");
    await inputs.nth(0).fill(PRESET_NAME);
    await inputs.nth(1).fill("created by the perf pass 7 smoke");

    // Typing goes through the store slice; the value must be on screen.
    const typedName = await inputs.nth(0).inputValue();
    step("typing in the editor keeps the draft", typedName === PRESET_NAME, typedName);

    // Saving needs a selectable model for every stage; pick the first one where
    // the catalog has any (web mode has none for detect/segment/clean).
    const stageSelects = editor.locator("select");
    const stageSelectCount = await stageSelects.count();
    let stagesWithoutOptions = 0;
    for (let index = 0; index < stageSelectCount; index++) {
      const firstValue = await stageSelects.nth(index).evaluate((select) => {
        const option = [...select.options].find((entry) => !entry.disabled && entry.value);
        return option?.value ?? "";
      });
      if (!firstValue) {
        stagesWithoutOptions += 1;
        continue;
      }
      await stageSelects.nth(index).selectOption(firstValue);
    }

    await editor.locator("button.koma-btn--primary").click();
    await page.waitForTimeout(800);
    const editorClosed = (await page.locator(".koma-aio-preset-editor").count()) === 0;

    if (editorClosed) {
      step("editor closes after create", true);
      const presetOptions = await presetRow.locator("select option").allTextContents();
      step(
        "created preset appears in the language preset select",
        presetOptions.some((label) => label.includes(PRESET_NAME)),
        presetOptions.join(" | "),
      );
    } else if (stagesWithoutOptions > 0) {
      console.log(
        `SKIP preset creation — ${stagesWithoutOptions} stage(s) have no selectable model in web mode (needs the desktop model catalog)`,
      );
    } else {
      const statusLine = await page.evaluate(() => {
        const node =
          document.querySelector(".koma-footerbar__msg") ??
          document.querySelector("[role='status']");
        return node?.textContent?.trim() ?? "";
      });
      step("editor closes after create", false, statusLine);
      step("created preset appears in the language preset select", false);
    }

    // Reopening New must drop the previous draft (fresh store slice per open).
    await newPresetBtn.click();
    await page.waitForTimeout(300);
    const reopenedName = await page.locator(".koma-aio-preset-editor input.koma-input").nth(0).inputValue();
    step("reopening New starts from an empty draft", reopenedName === "", reopenedName);

    await page.locator(".koma-aio-preset-editor button.koma-btn--ghost").click();
    await page.waitForTimeout(300);
    step(
      "cancel closes the editor",
      (await page.locator(".koma-aio-preset-editor").count()) === 0,
    );
  }
  await page.screenshot({ path: path.join(OUT_DIR, "p7-preset.png") });
}

// ── 3. LLM settings island (leaf subscription) ──
// Stage tabs follow STAGE_TABS order: detect, ocr, translation, segment, clean, render.
const stageTabs = page.locator(".koma-aio-stage-tabs__bar [role='tab']");
const translationTab = stageTabs.nth(2);
let llmPanelSeen = false;

if ((await stageTabs.count()) > 2) {
  await translationTab.click();
  await page.waitForTimeout(500);

  const stageSelect = page.locator(".koma-stage-config select").first();
  const selectableValues = (await stageSelect.count())
    ? await stageSelect
        .locator("option")
        .evaluateAll((options) =>
          options
            .filter((option) => !option.disabled && option.value)
            .map((option) => option.value),
        )
    : [];

  // The panel only renders for models with LLM capabilities; probe the options.
  for (const value of selectableValues) {
    await stageSelect.selectOption(value);
    await page.waitForTimeout(500);
    if (await page.locator(".koma-aio-llm-panel textarea").count()) {
      llmPanelSeen = true;
      break;
    }
  }
}

if (llmPanelSeen) {
  const textarea = page.locator(".koma-aio-llm-panel textarea").first();
  await textarea.fill(LLM_TEXT);

  // The checkbox is visually covered by its label row; click the label itself.
  const toggleRow = page.locator(".koma-aio-llm-toggles label").first();
  const toggle = toggleRow.locator("input[type='checkbox']").first();
  const beforeToggle = await toggle.isChecked();
  await toggleRow.click();
  await page.waitForTimeout(300);
  const afterToggle = await toggle.isChecked();
  step("llm toggle flips", beforeToggle !== afterToggle, `${beforeToggle} -> ${afterToggle}`);

  // Leaving the tab unmounts the island; the value must return from the store.
  await stageTabs.nth(0).click();
  await page.waitForTimeout(300);
  await translationTab.click();
  await page.waitForTimeout(500);
  const roundTrip = await page.locator(".koma-aio-llm-panel textarea").first().inputValue();
  step("llm textarea survives a tab round-trip", roundTrip === LLM_TEXT, roundTrip);
  await page.screenshot({ path: path.join(OUT_DIR, "p7-llm.png") });
} else {
  console.log(
    "SKIP llm settings island — no LLM-capable translation option selectable without a provider key",
  );
}

// ── 4. AIO stage tab walk (stage-config island parity) ──
const stageContent = page.locator(".koma-aio-stage-content");
if ((await stageTabs.count()) >= 6) {
  for (let index = 0; index < 6; index += 1) {
    await stageTabs.nth(index).click();
    await page.waitForTimeout(400);
    const childCount = await stageContent.evaluate((node) => node.children.length);
    step(`aio stage tab ${index} renders its body`, childCount > 0, `children=${childCount}`);
  }

  // Clean tab (index 4): the mask-dilation slider value must survive a tab
  // round-trip (store-backed island) and the HD strategy select must swap
  // the crop sliders in and out.
  const cleanTab = stageTabs.nth(4);
  await cleanTab.click();
  await page.waitForTimeout(400);
  const sliders = stageContent.locator("input[type='range']");
  const sliderCount = await sliders.count();
  if (sliderCount > 0) {
    // KlSlider commits to the store on pointer-up (local draft while
    // dragging) — replicate the full user gesture.
    await sliders.first().evaluate((el) => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      el.value = "12";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    await page.waitForTimeout(200);
    await stageTabs.nth(0).click();
    await page.waitForTimeout(300);
    await cleanTab.click();
    await page.waitForTimeout(400);
    const valueAfterRoundTrip = await sliders.first().inputValue();
    step(
      "mask dilation value survives a tab round-trip",
      valueAfterRoundTrip === "12",
      valueAfterRoundTrip,
    );

    const selects = stageContent.locator("select");
    const selectCount = await selects.count();
    let hdSelect = null;
    for (let index = 0; index < selectCount; index += 1) {
      if (await selects.nth(index).locator("option[value='crop']").count()) {
        hdSelect = selects.nth(index);
        break;
      }
    }
    if (hdSelect) {
      await hdSelect.selectOption("crop");
      await page.waitForTimeout(300);
      const cropSliderCount = await sliders.count();
      step(
        "HD crop strategy shows the crop sliders",
        cropSliderCount > sliderCount,
        `${sliderCount} -> ${cropSliderCount}`,
      );
      await hdSelect.selectOption("resize");
      await page.waitForTimeout(300);
    } else {
      step("HD crop strategy shows the crop sliders", false, "select with crop option not found");
    }
  } else {
    console.log("SKIP mask dilation steps — no range slider on the clean tab");
  }

  await page.screenshot({ path: path.join(OUT_DIR, "p7-stage-tabs.png") });
} else {
  console.log("SKIP aio stage tab walk — fewer than 6 stage tabs available");
}

// ── 5. Glossary accordion (grid-template-rows transition) ──
const resourcesButton = page
  .getByRole("button", { name: /Resources & Materials|Recursos & Materiais/i })
  .first();
let glossaryReached = false;
if (await resourcesButton.count()) {
  await resourcesButton.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  if ((await page.locator(".koma-res-glossary-item").count()) === 0) {
    const glossaryTab = page
      .getByRole("button", { name: /Glossary|Glossário/i })
      .first();
    if (await glossaryTab.count()) {
      await glossaryTab.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  glossaryReached = (await page.locator(".koma-res-glossary-item").count()) > 0;
}

if (glossaryReached) {
  const item = page.locator(".koma-res-glossary-item").first();
  await item.locator("button").first().click();
  await page.waitForTimeout(500);
  const expanded = await item.evaluate((el) =>
    el.classList.contains("koma-res-glossary-item--expanded"),
  );
  step("glossary accordion expands", expanded);

  await item.locator("button").first().click();
  await page.waitForTimeout(500);
  const collapsed = await item.evaluate(
    (el) => !el.classList.contains("koma-res-glossary-item--expanded"),
  );
  step("glossary accordion collapses", collapsed);
  await page.screenshot({ path: path.join(OUT_DIR, "p7-glossary.png") });
} else {
  console.log("SKIP glossary accordion — resources mode not reachable in web e2e");
}

// ── 6. errors ──
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
