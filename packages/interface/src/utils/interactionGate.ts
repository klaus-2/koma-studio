/**
 * Document-level interaction gate for the autosave tick: passive pointer and
 * IME composition listeners feeding module flags, with no store, no React
 * state and no timers. The autosave interval consults isInteractionActive()
 * as its LAST guard and defers the save to the next tick while it returns
 * true — a skipped tick keeps the autosave dirty flag set, so the next tick
 * after release saves. Flush-on-hide, unmount-flush and manual save bypass
 * the gate entirely.
 */

let pointerDown = false;
let composing = false;
let lastReleaseAt = 0;
let listenersAttached = false;

function onPointerDown(): void {
  pointerDown = true;
}

function onPointerRelease(): void {
  pointerDown = false;
  lastReleaseAt = Date.now();
}

function onCompositionStart(): void {
  composing = true;
}

function onCompositionEnd(): void {
  composing = false;
  lastReleaseAt = Date.now();
}

function attachInteractionListeners(): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointerup', onPointerRelease, { passive: true });
  document.addEventListener('pointercancel', onPointerRelease, { passive: true });
  document.addEventListener('compositionstart', onCompositionStart, { passive: true });
  document.addEventListener('compositionend', onCompositionEnd, { passive: true });
  // Missing pointercancel safety: losing the window releases a held pointer.
  window.addEventListener('blur', onPointerRelease, { passive: true });
}

/** Pointer down, IME composing, or within graceMs after a release. */
export function isInteractionActive(graceMs = 1000): boolean {
  attachInteractionListeners();
  return pointerDown || composing || Date.now() - lastReleaseAt < graceMs;
}

/** Resets the tracked state (test-only); the listeners stay attached. */
export function resetForTests(): void {
  pointerDown = false;
  composing = false;
  lastReleaseAt = 0;
}
