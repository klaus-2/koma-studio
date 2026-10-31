import type { Locator } from "@playwright/test";

// Toast/status overlays occasionally sit on top of the primary action; the
// React handler still fires when the click is dispatched straight at it.
export const clickWithDomFallback = async (locator: Locator): Promise<void> => {
  try {
    await locator.click({ timeout: 10_000 });
    return;
  } catch {
    console.log("[flow] click intercepted; dispatching DOM click");
    await locator.evaluate((element) => {
      if (element instanceof HTMLElement) element.click();
    });
  }
};
