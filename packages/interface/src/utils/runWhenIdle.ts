/* ============================================================
   KŌMA STUDIO — runWhenIdle
   Post-boot idle trigger: mirrors the former main.tsx local helper
   exactly (requestIdleCallback with a 2s timeout, setTimeout
   fallback). Idempotent per call.
   ============================================================ */

export const runWhenIdle = (callback: () => void): void => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 2_000 });
    return;
  }

  (globalThis as { setTimeout: typeof setTimeout }).setTimeout(callback, 0);
};
