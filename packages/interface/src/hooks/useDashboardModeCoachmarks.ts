import { useCallback, useEffect, useRef } from 'react';
import {
  driver,
  type DriveStep,
  type Driver,
  type DriverHook,
} from 'driver.js';
// Coachmark CSS rides the lazy driver.js chunk instead of the entry bundle.
import 'driver.js/dist/driver.css';

import { readOnboardingState } from '../components/onboarding/onboardingStorage';
import { getModeLabels } from '../constants/dashboard.constants';
import { useI18n } from '../i18n';
import type { SubMode, ToolMode } from '../types/dashboard.types';
import {
  navigateResolvableTourStep,
  settleTourUi,
  stepToDriveElement,
  waitForNextPaint,
  type ResolvableTourStep,
  type TourSelectorSpec,
} from './tourNavigation';
import {
  readDashboardTourState,
  type DashboardTourForcedDropdown,
} from './useDashboardTour';
import './DashboardTour.css';

type ModeGuideStatus = 'completed' | 'dismissed';

interface ModeGuideStateV1 {
  version: string;
  status: ModeGuideStatus;
  seenAt: string;
}

export interface ModeGuideStep extends ResolvableTourStep {
  selectors?: TourSelectorSpec;
  title: string;
  body: string;
  accent: string;
}

export interface UseDashboardModeCoachmarksOptions {
  userId?: string | null;
  isReady: boolean;
  suppressed?: boolean;
  mode: ToolMode;
  subMode: SubMode;
  hasImages: boolean;
  hasDownloadActions: boolean;
  isCompactViewport: boolean;
  setForcedDropdown: (dropdown: DashboardTourForcedDropdown) => void;
  setToolsPanelVisible: (visible: boolean) => void;
}

export type BuildModeCoachmarkStepsOptions = Pick<
  UseDashboardModeCoachmarksOptions,
  | 'mode'
  | 'subMode'
  | 'hasImages'
  | 'hasDownloadActions'
  | 'isCompactViewport'
  | 'setForcedDropdown'
  | 'setToolsPanelVisible'
>;

type TFunc = (
  key: string,
  params?: Record<string, string | number | null | undefined>,
) => string;

const MODE_GUIDE_STORAGE_PREFIX = 'koma-studio.dashboard-mode-guide.v1';
const MODE_GUIDE_VERSION = '2026-03-dashboard-context-guides';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const escapeHtml = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const buildStorageKey = (userId: string, guideKey: string): string =>
  `${MODE_GUIDE_STORAGE_PREFIX}:${encodeURIComponent(userId)}:${guideKey}`;

export const readModeGuideState = (
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

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }

    if (
      parsed.version !== MODE_GUIDE_VERSION ||
      (parsed.status !== 'completed' && parsed.status !== 'dismissed') ||
      typeof parsed.seenAt !== 'string'
    ) {
      return null;
    }

    return {
      version: parsed.version,
      status: parsed.status,
      seenAt: parsed.seenAt,
    };
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

const buildGuideKey = (mode: ToolMode, subMode: SubMode): string => {
  if (mode === 'aio' || mode === 'typesetter') {
    return `${mode}:${subMode}`;
  }

  return mode;
};

const buildStageSelectors = (hasImages: boolean): TourSelectorSpec =>
  hasImages
    ? ['[data-tour="dashboard-stage-grid"]', '[data-tour="dashboard-stage"]']
    : ['[data-tour="dashboard-stage-empty"]', '[data-tour="dashboard-stage"]'];

const buildCoachmarkDescription = (step: ModeGuideStep): string => `
  <div class="koma-tour-popover__body koma-tour-popover__body--coachmark">
    <div class="koma-tour-popover__copy">
      <span class="koma-tour-popover__eyebrow">${escapeHtml(step.accent)}</span>
      <p>${escapeHtml(step.body)}</p>
    </div>
  </div>
`;

const createCommonSteps = (
  {
    mode,
    hasImages,
    hasDownloadActions,
    setForcedDropdown,
    setToolsPanelVisible,
  }: Pick<
    BuildModeCoachmarkStepsOptions,
    'mode' | 'hasImages' | 'hasDownloadActions' | 'setForcedDropdown' | 'setToolsPanelVisible'
  >,
  t: TFunc,
): {
  stageStep: ModeGuideStep;
  toolsStep: ModeGuideStep;
  downloadStep?: ModeGuideStep;
} => {
  const modeLabel = getModeLabels(t)[mode];
  return {
    stageStep: {
      selectors: buildStageSelectors(hasImages),
      title: `${modeLabel}: ${t('dashboard.coachmark.stage.titleSuffix')}`,
      body: hasImages
        ? t('dashboard.coachmark.stage.bodyWithImages', { modeLabel })
        : t('dashboard.coachmark.stage.bodyWithoutImages', { modeLabel }),
      accent: t('dashboard.coachmark.stage.accent'),
      side: 'top',
      align: 'center',
      prepare: async () => {
        setForcedDropdown(null);
        await settleTourUi(32);
      },
    },
    toolsStep: {
      selectors: '[data-tour="dashboard-tools-panel"]',
      title: `${modeLabel}: ${t('dashboard.coachmark.tools.titleSuffix')}`,
      body: t('dashboard.coachmark.tools.body', { modeLabel }),
      accent: t('dashboard.coachmark.tools.accent'),
      side: 'left',
      align: 'center',
      prepare: async () => {
        setForcedDropdown(null);
        setToolsPanelVisible(true);
        await settleTourUi(32);
      },
    },
    downloadStep: hasDownloadActions
      ? {
          selectors: [
            '[data-tour="topbar-download-panel"]',
            '[data-tour="topbar-download-trigger"]',
          ],
          title: `${modeLabel}: ${t('dashboard.coachmark.download.titleSuffix')}`,
          body: t('dashboard.coachmark.download.body'),
          accent: t('dashboard.coachmark.download.accent'),
          side: 'bottom',
          align: 'end',
          optional: true,
          prepare: async () => {
            setForcedDropdown('download');
            await settleTourUi(32);
          },
        }
      : undefined,
  };
};

export const buildModeCoachmarkSteps = (
  options: BuildModeCoachmarkStepsOptions,
  t: TFunc,
): ModeGuideStep[] => {
  const {
    mode,
    subMode,
    hasImages,
    isCompactViewport,
    setForcedDropdown,
    setToolsPanelVisible,
  } = options;
  const common = createCommonSteps(options, t);

  if (mode === 'aio' && subMode === 'auto') {
    const steps: ModeGuideStep[] = [
      {
        selectors: '[data-tour="dashboard-aio-pipeline"]',
        title: t('dashboard.coachmark.aioAuto.stagesTitle'),
        body: t('dashboard.coachmark.aioAuto.stagesBody'),
        accent: t('dashboard.coachmark.aioAuto.stagesAccent'),
        side: 'left',
        align: 'center',
        prepare: async () => {
          setForcedDropdown(null);
          setToolsPanelVisible(true);
          await settleTourUi(32);
        },
      },
      {
        selectors: [
          '[data-tour="dashboard-aio-stage-config"]',
          '[data-tour="dashboard-tools-panel"]',
        ],
        title: t('dashboard.coachmark.aioAuto.configTitle'),
        body: t('dashboard.coachmark.aioAuto.configBody'),
        accent: t('dashboard.coachmark.aioAuto.configAccent'),
        side: 'left',
        align: 'center',
        prepare: async () => {
          setForcedDropdown(null);
          setToolsPanelVisible(true);
          await settleTourUi(32);
        },
      },
    ];
    if (common.downloadStep) {
      steps.push(common.downloadStep);
    } else {
      steps.push(common.stageStep);
    }
    return steps;
  }

  if (mode === 'aio' && subMode === 'manual') {
    const steps: ModeGuideStep[] = [common.stageStep];
    if (!isCompactViewport) {
      steps.push({
        selectors: '[data-tour="dashboard-manual-dock"]',
        title: t('dashboard.coachmark.aioManual.dockTitle'),
        body: t('dashboard.coachmark.aioManual.dockBody'),
        accent: t('dashboard.coachmark.aioManual.dockAccent'),
        side: 'left',
        align: 'center',
        optional: true,
        prepare: async () => {
          setForcedDropdown(null);
          await settleTourUi(32);
        },
      });
    }
    steps.push(common.toolsStep);
    if (common.downloadStep) {
      steps.push(common.downloadStep);
    }
    return steps;
  }

  if (mode === 'typesetter') {
    const steps: ModeGuideStep[] = [common.stageStep, common.toolsStep];
    if (common.downloadStep) {
      steps.push(common.downloadStep);
    }
    return steps;
  }

  if (mode === 'cleaner') {
    const steps: ModeGuideStep[] = [common.stageStep, common.toolsStep];
    if (!isCompactViewport && hasImages) {
      steps.push({
        selectors: '[data-tour="dashboard-manual-dock"]',
        title: t('dashboard.coachmark.cleaner.dockTitle'),
        body: t('dashboard.coachmark.cleaner.dockBody'),
        accent: t('dashboard.coachmark.cleaner.dockAccent'),
        side: 'left',
        align: 'center',
        optional: true,
        prepare: async () => {
          setForcedDropdown(null);
          await settleTourUi(32);
        },
      });
    }
    if (common.downloadStep) {
      steps.push(common.downloadStep);
    }
    return steps;
  }

  if (mode === 'translator') {
    const steps: ModeGuideStep[] = [common.toolsStep, common.stageStep];
    if (common.downloadStep) {
      steps.push(common.downloadStep);
    }
    return steps;
  }

  if (mode === 'guides' || mode === 'resources') {
    return [
      {
        selectors: '[data-tour="dashboard-stage"]',
        title: `${getModeLabels(t)[mode]}: ${t('dashboard.coachmark.content.titleSuffix')}`,
        body: t('dashboard.coachmark.content.body'),
        accent: t('dashboard.coachmark.content.accent'),
        side: 'top',
        align: 'center',
        prepare: async () => {
          setForcedDropdown(null);
          await settleTourUi(32);
        },
      },
    ];
  }

  const fallbackSteps: ModeGuideStep[] = [common.stageStep, common.toolsStep];
  if (common.downloadStep) {
    fallbackSteps.push(common.downloadStep);
  }
  return fallbackSteps;
};

export const useDashboardModeCoachmarks = ({
  userId,
  isReady,
  suppressed = false,
  mode,
  subMode,
  hasImages,
  hasDownloadActions,
  isCompactViewport,
  setForcedDropdown,
  setToolsPanelVisible,
}: UseDashboardModeCoachmarksOptions): void => {
  const { t } = useI18n();
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<ModeGuideStep[]>([]);
  const persistStatusRef = useRef<ModeGuideStatus | null>(null);
  const activeGuideKeyRef = useRef<string | null>(null);
  const navSeqRef = useRef(0);

  const completeGuide = useCallback((currentDriver: Driver) => {
    navSeqRef.current += 1;
    persistStatusRef.current = 'completed';
    currentDriver.destroy();
    driverRef.current = null;
  }, []);

  const navigateToStep = useCallback(
    async (currentDriver: Driver, nextIndex: number, direction: 1 | -1) => {
      const sequenceToken = (navSeqRef.current += 1);
      await navigateResolvableTourStep({
        driver: currentDriver,
        steps: stepsRef.current,
        startIndex: nextIndex,
        direction,
        sequenceToken,
        getCurrentToken: () => navSeqRef.current,
        onComplete: () => completeGuide(currentDriver),
      });
    },
    [completeGuide],
  );

  useEffect(() => {
    if (!suppressed) {
      return;
    }
    navSeqRef.current += 1;
    if (driverRef.current) {
      persistStatusRef.current = null;
      driverRef.current.destroy();
      driverRef.current = null;
      activeGuideKeyRef.current = null;
      setForcedDropdown(null);
    }
  }, [setForcedDropdown, suppressed]);

  const startGuide = useCallback(async () => {
    if (!userId || !isReady || suppressed || typeof window === 'undefined') {
      return;
    }

    const hasSeenMainFlow =
      readDashboardTourState(userId) !== null ||
      readOnboardingState(userId) !== null;
    if (!hasSeenMainFlow) {
      return;
    }

    const guideKey = buildGuideKey(mode, subMode);
    if (readModeGuideState(userId, guideKey)) {
      return;
    }

    if (activeGuideKeyRef.current === guideKey && driverRef.current?.isActive()) {
      return;
    }

    const steps = buildModeCoachmarkSteps(
      {
        mode,
        subMode,
        hasImages,
        hasDownloadActions,
        isCompactViewport,
        setForcedDropdown,
        setToolsPanelVisible,
      },
      t,
    );

    if (steps.length === 0) {
      return;
    }

    if (driverRef.current?.isActive()) {
      navSeqRef.current += 1;
      persistStatusRef.current = 'dismissed';
      driverRef.current.destroy();
      driverRef.current = null;
      await settleTourUi(32);
    }

    stepsRef.current = steps;
    persistStatusRef.current = null;
    activeGuideKeyRef.current = guideKey;

    const handleNextClick: DriverHook = (_element, _step, opts) => {
      void navigateToStep(
        opts.driver,
        (opts.driver.getActiveIndex() ?? 0) + 1,
        1,
      );
    };

    const handlePrevClick: DriverHook = (_element, _step, opts) => {
      void navigateToStep(
        opts.driver,
        (opts.driver.getActiveIndex() ?? 0) - 1,
        -1,
      );
    };

    const handleDoneClick: DriverHook = (_element, _step, opts) => {
      completeGuide(opts.driver);
    };

    const driverSteps: DriveStep[] = steps.map((step) => ({
      element: stepToDriveElement(step.selectors),
      popover: {
        title: escapeHtml(step.title),
        description: buildCoachmarkDescription(step),
        side: step.side,
        align: step.align,
        showButtons: ['previous', 'next', 'close'],
        showProgress: true,
        popoverClass: 'koma-tour-popover koma-tour-popover--coachmark',
        onNextClick: handleNextClick,
        onPrevClick: handlePrevClick,
        onDoneClick: handleDoneClick,
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
      onNextClick: handleNextClick,
      onPrevClick: handlePrevClick,
      onDoneClick: handleDoneClick,
      onCloseClick: (_element, _step, opts) => {
        navSeqRef.current += 1;
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
        navSeqRef.current += 1;
        const intent = persistStatusRef.current;
        if (intent === 'completed' || intent === 'dismissed') {
          persistModeGuideState(userId, guideKey, intent);
        }
        persistStatusRef.current = null;
        activeGuideKeyRef.current = null;
        driverRef.current = null;
        setForcedDropdown(null);
      },
    });

    driverRef.current = guideDriver;
    await steps[0]?.prepare?.();
    guideDriver.drive(0);
    await waitForNextPaint();
    if (driverRef.current === guideDriver && guideDriver.isActive()) {
      guideDriver.refresh();
    }
  }, [
    completeGuide,
    hasDownloadActions,
    hasImages,
    isCompactViewport,
    isReady,
    mode,
    navigateToStep,
    setForcedDropdown,
    setToolsPanelVisible,
    subMode,
    suppressed,
    t,
    userId,
  ]);

  useEffect(() => {
    void startGuide();
  }, [startGuide]);

  useEffect(() => {
    return () => {
      navSeqRef.current += 1;
      if (driverRef.current) {
        persistStatusRef.current = null;
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);
};
