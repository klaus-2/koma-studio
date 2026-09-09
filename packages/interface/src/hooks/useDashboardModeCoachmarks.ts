import { useCallback, useEffect, useRef } from 'react';
import {
  driver,
  type Alignment,
  type DriveStep,
  type Driver,
  type Side,
} from 'driver.js';

import { useI18n } from '../i18n';
import { MODE_LABELS } from '../constants/dashboard.constants';
import type { SubMode, ToolMode } from '../types/dashboard.types';
import { readDashboardTourState } from './useDashboardTour';
import './DashboardTour.css';

type ModeGuideStatus = 'completed' | 'dismissed';

interface ModeGuideStateV1 {
  version: string;
  status: ModeGuideStatus;
  seenAt: string;
}

interface ModeGuideStep {
  selector?: string;
  title: string;
  body: string;
  accent: string;
  side?: Side;
  align?: Alignment;
  optional?: boolean;
  prepare?: () => Promise<void> | void;
}

interface UseDashboardModeCoachmarksOptions {
  userId?: string | null;
  isReady: boolean;
  mode: ToolMode;
  subMode: SubMode;
  hasImages: boolean;
  hasDownloadActions: boolean;
  isCompactViewport: boolean;
}

type TFunc = (key: string, params?: Record<string, string | number>) => string;

const MODE_GUIDE_STORAGE_PREFIX = 'koma-studio.dashboard-mode-guide.v1';
const MODE_GUIDE_VERSION = '2026-03-dashboard-context-guides';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForNextPaint = async (): Promise<void> => {
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
};

const settleUi = async (): Promise<void> => {
  await waitForNextPaint();
  await wait(32);
};

const buildStorageKey = (userId: string, guideKey: string): string =>
  `${MODE_GUIDE_STORAGE_PREFIX}:${encodeURIComponent(userId)}:${guideKey}`;

const readModeGuideState = (
  userId: string,
  guideKey: string,
): ModeGuideStateV1 | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId, guideKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ModeGuideStateV1> | null;
    if (
      !parsed ||
      parsed.version !== MODE_GUIDE_VERSION ||
      (parsed.status !== 'completed' && parsed.status !== 'dismissed') ||
      typeof parsed.seenAt !== 'string'
    ) {
      return null;
    }

    return parsed as ModeGuideStateV1;
  } catch {
    return null;
  }
};

const persistModeGuideState = (
  userId: string,
  guideKey: string,
  status: ModeGuideStatus,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: ModeGuideStateV1 = {
    version: MODE_GUIDE_VERSION,
    status,
    seenAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    buildStorageKey(userId, guideKey),
    JSON.stringify(payload),
  );
};

const isElementVisible = (element: Element | null): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length,
  );
};

const queryVisibleElement = (selector: string): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const element = document.querySelector(selector);
  return isElementVisible(element) ? element : null;
};

const waitForVisibleElement = async (
  selector: string,
  timeoutMs = 1400,
): Promise<HTMLElement | null> => {
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    const element = queryVisibleElement(selector);
    if (element) {
      return element;
    }
    await waitForNextPaint();
  }

  return null;
};

const buildGuideKey = (mode: ToolMode, subMode: SubMode): string => {
  if (mode === 'aio' || mode === 'typesetter') {
    return `${mode}:${subMode}`;
  }

  return mode;
};

const buildStageSelector = (hasImages: boolean): string =>
  hasImages
    ? '[data-tour="dashboard-stage-grid"]'
    : '[data-tour="dashboard-stage-empty"]';

const buildCoachmarkDescription = (step: ModeGuideStep): string => `
  <div class="koma-tour-popover__body koma-tour-popover__body--coachmark">
    <div class="koma-tour-popover__copy">
      <span class="koma-tour-popover__eyebrow">${step.accent}</span>
      <p>${step.body}</p>
    </div>
  </div>
`;

const createCommonSteps = (
  mode: ToolMode,
  hasImages: boolean,
  hasDownloadActions: boolean,
  t: TFunc,
): { stageStep: ModeGuideStep; toolsStep: ModeGuideStep; downloadStep?: ModeGuideStep } => {
  const modeLabel = MODE_LABELS[mode];
  return {
    stageStep: {
      selector: buildStageSelector(hasImages),
      title: `${modeLabel}: ${t('dashboard.coachmark.stage.titleSuffix')}`,
      body: hasImages
        ? t('dashboard.coachmark.stage.bodyWithImages', { modeLabel })
        : t('dashboard.coachmark.stage.bodyWithoutImages', { modeLabel }),
      accent: t('dashboard.coachmark.stage.accent'),
      side: 'top',
      align: 'center',
    },
    toolsStep: {
      selector: '[data-tour="dashboard-tools-panel"]',
      title: `${modeLabel}: ${t('dashboard.coachmark.tools.titleSuffix')}`,
      body: t('dashboard.coachmark.tools.body', { modeLabel }),
      accent: t('dashboard.coachmark.tools.accent'),
      side: 'left',
      align: 'center',
    },
    downloadStep: hasDownloadActions
      ? {
          selector: '[data-tour="topbar-download-panel"]',
          title: `${modeLabel}: ${t('dashboard.coachmark.download.titleSuffix')}`,
          body: t('dashboard.coachmark.download.body'),
          accent: t('dashboard.coachmark.download.accent'),
          side: 'bottom',
          align: 'end',
        }
      : undefined,
  };
};

const buildStepsForCurrentMode = (
  {
    mode,
    subMode,
    hasImages,
    hasDownloadActions,
    isCompactViewport,
  }: Omit<UseDashboardModeCoachmarksOptions, 'userId' | 'isReady'>,
  t: TFunc,
): ModeGuideStep[] => {
  const common = createCommonSteps(mode, hasImages, hasDownloadActions, t);

  if (mode === 'organize') {
    return [
      {
        selector: '[data-tour="dashboard-dropzone"]',
        title: t('dashboard.coachmark.organize.uploadTitle'),
        body: t('dashboard.coachmark.organize.uploadBody'),
        accent: t('dashboard.coachmark.organize.uploadAccent'),
        side: 'right',
        align: 'center',
      },
      {
        selector: '[data-tour="dashboard-sidebar"]',
        title: t('dashboard.coachmark.organize.orderTitle'),
        body: t('dashboard.coachmark.organize.orderBody'),
        accent: t('dashboard.coachmark.organize.orderAccent'),
        side: 'right',
        align: 'start',
      },
      common.stageStep,
    ];
  }

  if (mode === 'aio' && subMode === 'auto') {
    return [
      {
        selector: '[data-tour="dashboard-submode-toggle"]',
        title: t('dashboard.coachmark.aioAuto.pipelineTitle'),
        body: t('dashboard.coachmark.aioAuto.pipelineBody'),
        accent: t('dashboard.coachmark.aioAuto.pipelineAccent'),
        side: 'left',
        align: 'center',
      },
      {
        selector: '[data-tour="dashboard-aio-pipeline"]',
        title: t('dashboard.coachmark.aioAuto.stagesTitle'),
        body: t('dashboard.coachmark.aioAuto.stagesBody'),
        accent: t('dashboard.coachmark.aioAuto.stagesAccent'),
        side: 'left',
        align: 'center',
      },
      {
        selector: '[data-tour="dashboard-aio-stage-config"]',
        title: t('dashboard.coachmark.aioAuto.configTitle'),
        body: t('dashboard.coachmark.aioAuto.configBody'),
        accent: t('dashboard.coachmark.aioAuto.configAccent'),
        side: 'left',
        align: 'center',
      },
      common.downloadStep ?? common.stageStep,
    ];
  }

  if (mode === 'aio' && subMode === 'manual') {
    return [
      {
        selector: '[data-tour="dashboard-submode-toggle"]',
        title: t('dashboard.coachmark.aioManual.title'),
        body: t('dashboard.coachmark.aioManual.body'),
        accent: t('dashboard.coachmark.aioManual.accent'),
        side: 'left',
        align: 'center',
      },
      common.stageStep,
      !isCompactViewport
        ? {
            selector: '[data-tour="dashboard-manual-dock"]',
            title: t('dashboard.coachmark.aioManual.dockTitle'),
            body: t('dashboard.coachmark.aioManual.dockBody'),
            accent: t('dashboard.coachmark.aioManual.dockAccent'),
            side: 'left',
            align: 'center',
            optional: true,
          }
        : common.toolsStep,
      common.toolsStep,
    ];
  }

  if (mode === 'typesetter') {
    return [
      {
        selector: '[data-tour="dashboard-submode-toggle"]',
        title: subMode === 'manual' ? t('dashboard.coachmark.typesetter.titleManual') : t('dashboard.coachmark.typesetter.titleAuto'),
        body: subMode === 'manual'
          ? t('dashboard.coachmark.typesetter.bodyManual')
          : t('dashboard.coachmark.typesetter.bodyAuto'),
        accent: subMode === 'manual' ? t('dashboard.coachmark.typesetter.accentManual') : t('dashboard.coachmark.typesetter.accentAuto'),
        side: 'left',
        align: 'center',
      },
      common.stageStep,
      common.toolsStep,
      common.downloadStep ?? common.stageStep,
    ];
  }

  if (mode === 'cleaner') {
    return [
      common.stageStep,
      common.toolsStep,
      !isCompactViewport && hasImages
        ? {
            selector: '[data-tour="dashboard-manual-dock"]',
            title: t('dashboard.coachmark.cleaner.dockTitle'),
            body: t('dashboard.coachmark.cleaner.dockBody'),
            accent: t('dashboard.coachmark.cleaner.dockAccent'),
            side: 'left',
            align: 'center',
            optional: true,
          }
        : common.downloadStep ?? common.stageStep,
    ];
  }

  if (mode === 'translator') {
    return [
      common.toolsStep,
      common.stageStep,
      common.downloadStep ?? common.stageStep,
    ];
  }

  if (mode === 'guides' || mode === 'resources') {
    return [
      {
        selector: '[data-tour="dashboard-stage"]',
        title: `${MODE_LABELS[mode]}: ${t('dashboard.coachmark.content.titleSuffix')}`,
        body: t('dashboard.coachmark.content.body'),
        accent: t('dashboard.coachmark.content.accent'),
        side: 'top',
        align: 'center',
      },
    ];
  }

  return [
    common.stageStep,
    common.toolsStep,
    common.downloadStep ?? common.stageStep,
  ];
};

export const useDashboardModeCoachmarks = ({
  userId,
  isReady,
  mode,
  subMode,
  hasImages,
  hasDownloadActions,
  isCompactViewport,
}: UseDashboardModeCoachmarksOptions): void => {
  const { t } = useI18n();
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<ModeGuideStep[]>([]);
  const persistStatusRef = useRef<ModeGuideStatus | null>(null);
  const activeGuideKeyRef = useRef<string | null>(null);

  const navigateToStep = useCallback(
    async (currentDriver: Driver, nextIndex: number, direction: 1 | -1) => {
      const steps = stepsRef.current;

      if (nextIndex < 0) {
        return;
      }

      if (nextIndex >= steps.length) {
        persistStatusRef.current = 'completed';
        currentDriver.destroy();
        driverRef.current = null;
        return;
      }

      const nextStep = steps[nextIndex];
      if (!nextStep) return;
      await nextStep.prepare?.();

      if (nextStep.selector) {
        const element = await waitForVisibleElement(nextStep.selector);
        if (!element) {
          if (nextStep.optional) {
            await navigateToStep(currentDriver, nextIndex + direction, direction);
          }
          return;
        }
      }

      if (!currentDriver.isActive()) {
        return;
      }

      currentDriver.moveTo(nextIndex);
      await waitForNextPaint();
      currentDriver.refresh();
    },
    [],
  );

  const startGuide = useCallback(async () => {
    if (!userId || !isReady || typeof window === 'undefined') {
      return;
    }

    if (!readDashboardTourState(userId)) {
      return;
    }

    const guideKey = buildGuideKey(mode, subMode);
    if (readModeGuideState(userId, guideKey)) {
      return;
    }

    if (activeGuideKeyRef.current === guideKey && driverRef.current?.isActive()) {
      return;
    }

    const steps = buildStepsForCurrentMode({
      mode,
      subMode,
      hasImages,
      hasDownloadActions,
      isCompactViewport,
    }, t);

    if (steps.length === 0) {
      return;
    }

    if (driverRef.current?.isActive()) {
      persistStatusRef.current = 'dismissed';
      driverRef.current.destroy();
      driverRef.current = null;
      await settleUi();
    }

    stepsRef.current = steps;
    persistStatusRef.current = null;
    activeGuideKeyRef.current = guideKey;

    const driverSteps: DriveStep[] = steps.map((step) => ({
      element: step.selector
        ? () => document.querySelector(step.selector!) as Element
        : undefined,
      popover: {
        title: step.title,
        description: buildCoachmarkDescription(step),
        side: step.side,
        align: step.align,
        showButtons: ['previous', 'next', 'close'],
        showProgress: true,
        popoverClass: 'koma-tour-popover koma-tour-popover--coachmark',
        onNextClick: (_element, _step, opts) => {
          void navigateToStep(
            opts.driver,
            (opts.driver.getActiveIndex() ?? 0) + 1,
            1,
          );
        },
        onPrevClick: (_element, _step, opts) => {
          void navigateToStep(
            opts.driver,
            (opts.driver.getActiveIndex() ?? 0) - 1,
            -1,
          );
        },
      },
    }));

    const guideDriver = driver({
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      allowClose: true,
      allowKeyboardControl: true,
      disableActiveInteraction: false,
      overlayClickBehavior: 'close',
      overlayColor: '#050814',
      overlayOpacity: 0.52,
      popoverOffset: 14,
      showButtons: ['previous', 'next', 'close'],
      showProgress: true,
      progressText: t('dashboard.coachmark.progress'),
      nextBtnText: t('dashboard.coachmark.next'),
      prevBtnText: t('dashboard.coachmark.prev'),
      doneBtnText: t('dashboard.coachmark.done'),
      stagePadding: 12,
      stageRadius: 18,
      smoothScroll: true,
      steps: driverSteps,
      onCloseClick: (_element, _step, opts) => {
        persistStatusRef.current = 'dismissed';
        opts.driver.destroy();
        driverRef.current = null;
      },
      onDestroyStarted: () => {
        if (!persistStatusRef.current) {
          persistStatusRef.current = 'dismissed';
        }
      },
      onDestroyed: () => {
        if (persistStatusRef.current) {
          persistModeGuideState(userId, guideKey, persistStatusRef.current);
        }
        persistStatusRef.current = null;
        activeGuideKeyRef.current = null;
        driverRef.current = null;
      },
    });

    driverRef.current = guideDriver;
    await steps[0]?.prepare?.();
    guideDriver.drive(0);
    await waitForNextPaint();
    guideDriver.refresh();
  }, [
    hasDownloadActions,
    hasImages,
    isCompactViewport,
    isReady,
    mode,
    navigateToStep,
    subMode,
    t,
    userId,
  ]);

  useEffect(() => {
    void startGuide();
  }, [startGuide]);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        persistStatusRef.current = 'dismissed';
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);
};
