import type { Alignment, DriveStep, Driver, Side } from 'driver.js';

export type TourSelectorSpec = string | readonly string[];

export interface ResolvableTourStep {
  selectors?: TourSelectorSpec;
  optional?: boolean;
  side?: Side;
  align?: Alignment;
  prepare?: () => Promise<void> | void;
}

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export const waitForNextPaint = async (): Promise<void> => {
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
};

export const settleTourUi = async (delayMs = 36): Promise<void> => {
  await waitForNextPaint();
  await wait(delayMs);
};

export const normalizeSelectors = (
  selectors: TourSelectorSpec | undefined,
): readonly string[] => {
  if (!selectors) {
    return [];
  }
  return typeof selectors === 'string' ? [selectors] : selectors;
};

export const isElementVisible = (
  element: Element | null,
): element is HTMLElement => {
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    return false;
  }

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    const opacity = Number.parseFloat(style.opacity || '1');
    if (Number.isFinite(opacity) && opacity <= 0) {
      return false;
    }
  }

  const rect = element.getBoundingClientRect();
  const hasRectSize = rect.width > 1 && rect.height > 1;
  const hasOffsetSize = element.offsetWidth > 1 && element.offsetHeight > 1;
  return hasRectSize || hasOffsetSize;
};

export const queryVisibleElement = (
  selectors: TourSelectorSpec | undefined,
): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  for (const selector of normalizeSelectors(selectors)) {
    const element = document.querySelector(selector);
    if (isElementVisible(element)) {
      return element;
    }
  }

  return null;
};

export const resolveDomElementForStep = (
  selectors: TourSelectorSpec | undefined,
): Element | undefined => {
  const visible = queryVisibleElement(selectors);
  if (visible) {
    return visible;
  }
  if (typeof document === 'undefined') {
    return undefined;
  }
  for (const selector of normalizeSelectors(selectors)) {
    const match = document.querySelector(selector);
    if (match) {
      return match;
    }
  }
  return undefined;
};

export const waitForVisibleElement = async (
  selectors: TourSelectorSpec,
  timeoutMs = 1400,
  isCancelled?: () => boolean,
): Promise<HTMLElement | null> => {
  const immediate = queryVisibleElement(selectors);
  if (immediate) {
    return immediate;
  }

  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (isCancelled?.()) {
      return null;
    }
    await waitForNextPaint();
    if (isCancelled?.()) {
      return null;
    }
    const element = queryVisibleElement(selectors);
    if (element) {
      return element;
    }
  }

  return queryVisibleElement(selectors);
};

export interface NavigateTourOptions<T extends ResolvableTourStep> {
  driver: Driver;
  steps: readonly T[];
  startIndex: number;
  direction: 1 | -1;
  sequenceToken: number;
  getCurrentToken: () => number;
  onComplete: () => void;
  timeoutMs?: number;
}

export const navigateResolvableTourStep = async <T extends ResolvableTourStep>({
  driver,
  steps,
  startIndex,
  direction,
  sequenceToken,
  getCurrentToken,
  onComplete,
  timeoutMs = 1400,
}: NavigateTourOptions<T>): Promise<void> => {
  const isStale = (): boolean =>
    sequenceToken !== getCurrentToken() || !driver.isActive();

  if (steps.length === 0) {
    onComplete();
    return;
  }

  let candidateIndex = startIndex;

  if (candidateIndex < 0) {
    candidateIndex = 0;
  }

  if (candidateIndex >= steps.length) {
    onComplete();
    return;
  }

  while (candidateIndex >= 0 && candidateIndex < steps.length) {
    if (isStale()) {
      return;
    }

    const step = steps[candidateIndex];
    if (!step) {
      candidateIndex += direction;
      continue;
    }

    try {
      await step.prepare?.();
    } catch {
      candidateIndex += direction;
      continue;
    }

    if (isStale()) {
      return;
    }

    const selectors = normalizeSelectors(step.selectors);
    if (selectors.length === 0) {
      driver.moveTo(candidateIndex);
      await waitForNextPaint();
      if (!isStale()) {
        driver.refresh();
      }
      return;
    }

    const element = await waitForVisibleElement(selectors, timeoutMs, isStale);
    if (isStale()) {
      return;
    }

    if (element) {
      driver.moveTo(candidateIndex);
      await waitForNextPaint();
      if (!isStale()) {
        driver.refresh();
      }
      return;
    }

    candidateIndex += direction;
  }

  if (isStale()) {
    return;
  }

  if (direction > 0) {
    onComplete();
    return;
  }

  const current = driver.getActiveIndex() ?? 0;
  if (current >= 0 && current < steps.length) {
    driver.moveTo(current);
  }
};

export const stepToDriveElement = (
  selectors: TourSelectorSpec | undefined,
): DriveStep['element'] => {
  if (!selectors || normalizeSelectors(selectors).length === 0) {
    return undefined;
  }
  return () => resolveDomElementForStep(selectors) ?? document.body;
};
