import { describe, expect, it, vi } from 'vitest';
import type { Driver } from 'driver.js';

import {
  isElementVisible,
  navigateResolvableTourStep,
  queryVisibleElement,
  stepToDriveElement,
  type ResolvableTourStep,
} from './tourNavigation';
import { buildModeCoachmarkSteps } from './useDashboardModeCoachmarks';

const noop = () => {};

const mockTranslator = (
  key: string,
  params?: Record<string, string | number | null | undefined>,
): string => {
  if (!params) {
    return key;
  }
  return `${key}:${JSON.stringify(params)}`;
};

const makeMockRect = (width: number, height: number): DOMRect => ({
  x: 0,
  y: 0,
  width,
  height,
  top: 0,
  left: 0,
  right: width,
  bottom: height,
  toJSON: () => ({}),
});

const createMockDriver = (initialActive = true): {
  driver: Driver;
  movedTo: number[];
  refreshes: number;
  destroyed: boolean;
} => {
  const state = {
    active: initialActive,
    activeIndex: 0,
    movedTo: [] as number[],
    refreshes: 0,
    destroyed: false,
  };

  const mockDriver: Driver = {
    isActive: () => state.active,
    refresh: () => {
      state.refreshes += 1;
    },
    drive: () => {},
    setConfig: () => {},
    setSteps: () => {},
    getConfig: () => ({}),
    getState: () => ({}),
    getActiveIndex: () => state.activeIndex,
    isFirstStep: () => state.activeIndex === 0,
    isLastStep: () => false,
    getActiveStep: () => undefined,
    getActiveElement: () => undefined,
    getPreviousElement: () => undefined,
    getPreviousStep: () => undefined,
    getNextStep: () => undefined,
    moveNext: () => {},
    movePrevious: () => {},
    moveTo: (index: number) => {
      state.activeIndex = index;
      state.movedTo.push(index);
    },
    hasNextStep: () => true,
    hasPreviousStep: () => state.activeIndex > 0,
    highlight: () => {},
    destroy: () => {
      state.destroyed = true;
      state.active = false;
    },
  };

  return {
    driver: mockDriver,
    movedTo: state.movedTo,
    get refreshes() {
      return state.refreshes;
    },
    get destroyed() {
      return state.destroyed;
    },
  };
};

describe('tourNavigation', () => {
  it('isElementVisible rejects detached, hidden, zero-opacity, and w-0 collapsed elements', () => {
    const detached = document.createElement('div');
    detached.getBoundingClientRect = () => makeMockRect(120, 40);
    expect(isElementVisible(detached)).toBe(false);

    const hiddenDisplay = document.createElement('div');
    hiddenDisplay.style.display = 'none';
    hiddenDisplay.getBoundingClientRect = () => makeMockRect(120, 40);
    document.body.appendChild(hiddenDisplay);
    expect(isElementVisible(hiddenDisplay)).toBe(false);

    const hiddenVisibility = document.createElement('div');
    hiddenVisibility.style.visibility = 'hidden';
    hiddenVisibility.getBoundingClientRect = () => makeMockRect(120, 40);
    document.body.appendChild(hiddenVisibility);
    expect(isElementVisible(hiddenVisibility)).toBe(false);

    const zeroOpacity = document.createElement('div');
    zeroOpacity.style.opacity = '0';
    zeroOpacity.getBoundingClientRect = () => makeMockRect(120, 40);
    document.body.appendChild(zeroOpacity);
    expect(isElementVisible(zeroOpacity)).toBe(false);

    const collapsedNoirSidebar = document.createElement('aside');
    collapsedNoirSidebar.getBoundingClientRect = () => makeMockRect(0, 600);
    document.body.appendChild(collapsedNoirSidebar);
    expect(isElementVisible(collapsedNoirSidebar)).toBe(false);

    const visible = document.createElement('div');
    visible.getBoundingClientRect = () => makeMockRect(160, 48);
    document.body.appendChild(visible);
    expect(isElementVisible(visible)).toBe(true);

    document.body.innerHTML = '';
  });

  it('queryVisibleElement resolves the first visible selector in a Noir/Classic fallback list', () => {
    const noirProductionGroup = document.createElement('div');
    noirProductionGroup.setAttribute('data-tour', 'topbar-production-group');
    noirProductionGroup.getBoundingClientRect = () => makeMockRect(240, 36);
    document.body.appendChild(noirProductionGroup);

    const resolved = queryVisibleElement([
      '[data-tour="topbar-production-panel"]',
      '[data-tour="topbar-production-group"]',
      '[data-tour="topbar-mode-pill"]',
    ]);
    expect(resolved).toBe(noirProductionGroup);

    const elResolver = stepToDriveElement(['[data-tour="missing"]', '[data-tour="topbar-production-group"]']);
    expect(typeof elResolver).toBe('function');
    if (typeof elResolver === 'function') {
      expect(elResolver()).toBe(noirProductionGroup);
    }

    document.body.innerHTML = '';
  });

  it('navigateResolvableTourStep skips missing intermediate step and calls onComplete past trailing missing steps', async () => {
    const visibleTarget = document.createElement('div');
    visibleTarget.setAttribute('data-tour', 'step-two');
    visibleTarget.getBoundingClientRect = () => makeMockRect(180, 44);
    document.body.appendChild(visibleTarget);

    const mock = createMockDriver(true);
    let token = 1;
    const onComplete = vi.fn();

    const steps: ResolvableTourStep[] = [
      { selectors: '[data-tour="step-zero"]' },
      { selectors: '[data-tour="missing-middle"]' },
      { selectors: '[data-tour="step-two"]' },
      { selectors: '[data-tour="missing-last"]' },
    ];

    await navigateResolvableTourStep({
      driver: mock.driver,
      steps,
      startIndex: 1,
      direction: 1,
      sequenceToken: token,
      getCurrentToken: () => token,
      onComplete,
      timeoutMs: 10,
    });

    expect(mock.movedTo).toEqual([2]);
    expect(onComplete).not.toHaveBeenCalled();

    token = 2;
    await navigateResolvableTourStep({
      driver: mock.driver,
      steps,
      startIndex: 3,
      direction: 1,
      sequenceToken: token,
      getCurrentToken: () => token,
      onComplete,
      timeoutMs: 10,
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    document.body.innerHTML = '';
  });

  it('navigateResolvableTourStep aborts stale async navigation when sequenceToken advances', async () => {
    const visibleTarget = document.createElement('div');
    visibleTarget.setAttribute('data-tour', 'step-one');
    visibleTarget.getBoundingClientRect = () => makeMockRect(180, 44);
    document.body.appendChild(visibleTarget);

    const mock = createMockDriver(true);
    let currentToken = 1;
    const onComplete = vi.fn();

    const steps: ResolvableTourStep[] = [
      {
        selectors: '[data-tour="step-one"]',
        prepare: async () => {
          currentToken = 2;
        },
      },
    ];

    await navigateResolvableTourStep({
      driver: mock.driver,
      steps,
      startIndex: 0,
      direction: 1,
      sequenceToken: 1,
      getCurrentToken: () => currentToken,
      onComplete,
      timeoutMs: 10,
    });

    expect(mock.movedTo).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('buildModeCoachmarkSteps emits zero duplicate selector sequences across modes and viewport configs', () => {
    const modes: Array<{
      mode: 'aio' | 'cleaner' | 'typesetter' | 'translator' | 'guides' | 'resources' | 'enhance';
      subMode: 'auto' | 'manual';
      hasImages: boolean;
      hasDownloadActions: boolean;
      isCompactViewport: boolean;
    }> = [
      { mode: 'aio', subMode: 'auto', hasImages: false, hasDownloadActions: false, isCompactViewport: false },
      { mode: 'aio', subMode: 'auto', hasImages: true, hasDownloadActions: true, isCompactViewport: false },
      { mode: 'aio', subMode: 'manual', hasImages: true, hasDownloadActions: false, isCompactViewport: true },
      { mode: 'aio', subMode: 'manual', hasImages: true, hasDownloadActions: true, isCompactViewport: false },
      { mode: 'cleaner', subMode: 'manual', hasImages: true, hasDownloadActions: false, isCompactViewport: false },
      { mode: 'typesetter', subMode: 'manual', hasImages: false, hasDownloadActions: false, isCompactViewport: false },
      { mode: 'translator', subMode: 'manual', hasImages: true, hasDownloadActions: false, isCompactViewport: false },
      { mode: 'guides', subMode: 'manual', hasImages: false, hasDownloadActions: false, isCompactViewport: false },
    ];

    for (const cfg of modes) {
      const steps = buildModeCoachmarkSteps(
        {
          ...cfg,
          setForcedDropdown: noop,
          setToolsPanelVisible: noop,
        },
        mockTranslator,
      );
      const titles = steps.map((step) => step.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});
