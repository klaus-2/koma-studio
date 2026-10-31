import fs from "node:fs";
import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";
import { unzipSync } from "fflate";

import { clickWithDomFallback } from "../support/dom.ts";
import { pollUntil } from "../support/wait.ts";

type Bundle = "zip" | "cbz" | "cb7" | "pdf";

interface ExportCase {
  name: string;
  format?: string;
  bundle?: Bundle;
  configure?: (panel: ReturnType<typeof panelLocator>) => Promise<void>;
  psd?: boolean;
}

const exportsDirectory = (): string => {
  const runRoot = process.env.E2E_RUN_ROOT;
  if (!runRoot) throw new Error("E2E_RUN_ROOT is required");
  return path.join(runRoot, "exports");
};

const panelLocator = (page: Page) =>
  page.locator('[data-tour="topbar-download-panel"]');

const waitForNewExport = (
  directory: string,
  before: Set<string>,
  timeoutMs = 180_000,
): Promise<string> =>
  pollUntil(
    () => {
      if (!fs.existsSync(directory)) return null;
      const [firstFresh] = fs
        .readdirSync(directory)
        .filter((file) => !before.has(file));
      return firstFresh ? path.join(directory, firstFresh) : null;
    },
    timeoutMs,
    `E2E_EXPORT_TIMEOUT: no new file in ${directory}`,
  );

const magics = {
  zip: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  pdf: Buffer.from("%PDF", "ascii"),
  psd: Buffer.from("8BPS", "ascii"),
};

const assertMagic = (filePath: string, expected: Buffer): void => {
  const bytes = fs.readFileSync(filePath);
  expect(
    bytes.subarray(0, expected.length).equals(expected),
    `${path.basename(filePath)} magic`,
  ).toBe(true);
  expect(bytes.byteLength).toBeGreaterThan(0);
};

const assertZipWithImage = (filePath: string, imagePattern: RegExp): void => {
  assertMagic(filePath, magics.zip);
  const entries = Object.keys(
    unzipSync(new Uint8Array(fs.readFileSync(filePath))),
  );
  expect(entries.some((entry) => imagePattern.test(entry))).toBe(true);
};

const assertZipWithPsdAndJson = (filePath: string): void => {
  assertMagic(filePath, magics.zip);
  const entries = Object.keys(
    unzipSync(new Uint8Array(fs.readFileSync(filePath))),
  );
  expect(entries.some((entry) => entry.endsWith(".psd"))).toBe(true);
  expect(entries.some((entry) => entry.endsWith(".json"))).toBe(true);
};

const openMenu = async (page: Page) => {
  const panel = panelLocator(page);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await panel.isVisible())) {
      await page.locator('[data-tour="topbar-download-trigger"]').click();
    }
    await expect(panel).toBeVisible();
    // The 200ms entrance animation moves the panel; early pointer clicks can
    // land on stale geometry and trip the menu's outside-close handler. The
    // settle also lets a previous close finish so we do not act on a menu
    // that is already animating out.
    await page.waitForTimeout(350);
    if (await panel.isVisible()) return panel;
  }
  throw new Error("E2E_EXPORT_PANEL_UNSTABLE");
};

const fieldSelect = (
  panel: ReturnType<typeof panelLocator>,
  label: string,
) => panel.locator("label").filter({ hasText: label }).locator("select").first();

const downloadButton = (panel: ReturnType<typeof panelLocator>) =>
  panel.getByRole("button", { name: /download/i }).first();

const psdButton = (panel: ReturnType<typeof panelLocator>) =>
  panel.getByRole("button", { name: /PSD/i }).first();

const ensurePlainPsd = async (
  panel: ReturnType<typeof panelLocator>,
): Promise<void> => {
  await setCheckbox(panel, "Metadata JSON", false);
};

const checkboxFor = (panel: Locator, name: string): Locator =>
  panel.getByRole("checkbox", { name, exact: true });

const setCheckbox = async (
  panel: Locator,
  name: string,
  desired: boolean,
): Promise<void> => {
  const checkbox = checkboxFor(panel, name);
  if ((await checkbox.count()) === 0) return;
  if ((await checkbox.isChecked()) === desired) return;
  // The input is sr-only; the wrapping label owns the hit target.
  await panel.getByText(name, { exact: true }).click();
  await expect.poll(async () => checkbox.isChecked()).toBe(desired);
};

const clickAndWait = async (
  page: Page,
  button: Locator,
  directory: string,
  before: Set<string>,
): Promise<string> => {
  await clickWithDomFallback(button);
  const filePath = await waitForNewExport(directory, before, 300_000);
  await page.waitForTimeout(1_200);
  return filePath;
};

const runExportCase = async (
  page: Page,
  testCase: ExportCase,
): Promise<string> => {
  console.log(`[flow] export ${testCase.name}`);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const panel = await openMenu(page);
    if (!testCase.psd) {
      if (testCase.format) {
        await fieldSelect(panel, "Format").selectOption(testCase.format);
      }
      if (testCase.bundle) {
        await fieldSelect(panel, "Package").selectOption(testCase.bundle);
      }
    }
    if (testCase.configure) {
      await testCase.configure(panel);
    }
    const directory = exportsDirectory();
    fs.mkdirSync(directory, { recursive: true });
    const before = new Set(fs.readdirSync(directory));
    const button = testCase.psd ? psdButton(panel) : downloadButton(panel);
    try {
      // A PSD request already running keeps the button disabled; a retry
      // must wait it out rather than fail the run.
      await expect(button).toBeEnabled({ timeout: 5 * 60_000 });
      const filePath = await clickAndWait(page, button, directory, before);
      await panel
        .waitFor({ state: "hidden", timeout: 10_000 })
        .catch(() => undefined);
      return filePath;
    } catch (error) {
      lastError = error;
      console.log(`[flow] export retry ${attempt} ${testCase.name}`);
    }
  }
  throw lastError ?? new Error(`E2E_EXPORT_FAILED: ${testCase.name}`);
};

const validateImageExport = (
  filePath: string,
  format: string,
  bundle: Bundle,
): void => {
  if (bundle === "pdf") {
    assertMagic(filePath, magics.pdf);
    return;
  }
  const pattern =
    format === "image/jpeg"
      ? /\.(jpg|jpeg)$/i
      : format === "image/webp"
        ? /\.webp$/i
        : /\.png$/i;
  assertZipWithImage(filePath, pattern);
};

export interface ExportResult {
  cases: number;
}

export const runExportOptions = async (page: Page): Promise<ExportResult> => {
  fs.mkdirSync(exportsDirectory(), { recursive: true });
  let cases = 0;

  for (const format of ["image/png", "image/jpeg", "image/webp"]) {
    const filePath = await runExportCase(page, {
      name: `format-${format}`,
      format,
      bundle: "zip",
    });
    validateImageExport(filePath, format, "zip");
    cases += 1;
  }

  for (const bundle of ["zip", "cbz", "cb7", "pdf"] as const) {
    const filePath = await runExportCase(page, {
      name: `bundle-${bundle}`,
      format: "image/png",
      bundle,
    });
    validateImageExport(filePath, "image/png", bundle);
    cases += 1;
  }

  for (const label of ["Raw Text", "Translated", "Inpainted"]) {
    const filePath = await runExportCase(page, {
      name: `flag-${label}-off`,
      format: "image/png",
      bundle: "zip",
      configure: async (panel) => {
        await setCheckbox(panel, label, false);
      },
    });
    validateImageExport(filePath, "image/png", "zip");
    cases += 1;
  }

  const pdfFlagsPanel = await openMenu(page);
  await fieldSelect(pdfFlagsPanel, "Package").selectOption("pdf");
  for (const label of ["Raw Text", "Translated", "Inpainted"]) {
    const checkbox = pdfFlagsPanel.getByRole("checkbox", {
      name: label,
      exact: true,
    });
    if ((await checkbox.count()) > 0) {
      await expect(checkbox).toBeDisabled();
    }
  }
  if (await panelLocator(page).isVisible()) {
    await page.locator('[data-tour="topbar-download-trigger"]').click();
  }

  const psdCases: ExportCase[] = [
    {
      name: "psd-metadata-default",
      psd: true,
    },
    {
      name: "psd-plain",
      psd: true,
      configure: async (panel) => {
        await ensurePlainPsd(panel);
      },
    },
    ...(["rle", "zip", "raw"] as const).map((compression) => ({
      name: `psd-compression-${compression}`,
      psd: true,
      configure: async (panel: ReturnType<typeof panelLocator>) => {
        await ensurePlainPsd(panel);
        await fieldSelect(panel, "Compression").selectOption(compression);
      },
    })),
    {
      name: "psd-dpi",
      psd: true,
      configure: async (panel) => {
        await ensurePlainPsd(panel);
        const dpi = panel
          .locator("label")
          .filter({ hasText: "DPI" })
          .locator('input[type="number"]')
          .first();
        await dpi.fill("150");
        await dpi.blur();
      },
    },
    ...(["OCR Overlay", "Crops", "Raw text layer", "Translated layer", "PS Text layers"] as const).map(
      (label) => ({
        name: `psd-toggle-${label}`,
        psd: true,
        configure: async (panel: ReturnType<typeof panelLocator>) => {
          await ensurePlainPsd(panel);
          const checkbox = checkboxFor(panel, label);
          await setCheckbox(panel, label, !(await checkbox.isChecked()));
        },
      }),
    ),
  ];

  for (const testCase of psdCases) {
    const filePath = await runExportCase(page, testCase);
    if (testCase.name === "psd-metadata-default") {
      assertZipWithPsdAndJson(filePath);
    } else {
      assertMagic(filePath, magics.psd);
    }
    cases += 1;
  }

  return { cases };
};
