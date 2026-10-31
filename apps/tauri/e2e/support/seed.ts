import type { Page } from "@playwright/test";

/**
 * Seeds the localStorage profile the flows rely on (theme, locale, tooltips,
 * CPU-only AIO stages). Re-applying on later navigations is safe: the values
 * are constants, so reloads stay idempotent.
 */
export const seedE2eProfile = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "koma_theme",
      JSON.stringify({ state: { theme: "dark", family: "noir" }, version: 2 }),
    );
    localStorage.setItem("koma-studio.locale.v1", "en");
    // First-use tool tips overlay the canvas on a brand-new profile.
    localStorage.setItem("koma-studio.tool-tips.v1", JSON.stringify({ enabled: false }));
    localStorage.setItem(
      "koma-aio-gpu-stages",
      JSON.stringify({
        detectText: false,
        recognizeText: false,
        segmentText: false,
        cleanImage: false,
      }),
    );
  });
};
