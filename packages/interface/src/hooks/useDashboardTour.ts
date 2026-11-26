import { useCallback, useEffect, useRef, useState } from 'react';
import {
  driver,
  type DriveStep,
  type Driver,
  type DriverHook,
} from 'driver.js';
import 'driver.js/dist/driver.css';

import { useI18n } from '../i18n';
import type { SubMode, ToolMode } from '../types/dashboard.types';
import { useLatestRef } from '../utils/shallowStable';
import {
  navigateResolvableTourStep,
  settleTourUi,
  stepToDriveElement,
  waitForNextPaint,
  type ResolvableTourStep,
  type TourSelectorSpec,
} from './tourNavigation';
import './DashboardTour.css';

type TFunc = ReturnType<typeof useI18n>['t'];
type DashboardTourToolMode = ToolMode;
type DashboardTourSubMode = SubMode;

export type DashboardTourForcedDropdown =
  | 'production'
  | 'utils'
  | 'info'
  | 'download'
  | 'user'
  | null;

type DashboardTourStatus = 'completed' | 'dismissed';

export interface DashboardTourStateV1 {
  tourVersion: string;
  status: DashboardTourStatus;
  seenAt: string;
}

export type DashboardTourStepId =
  | 'welcome'
  | 'sidebar'
  | 'upload'
  | 'modes'
  | 'production'
  | 'utils'
  | 'pipeline'
  | 'stage-config'
  | 'stage'
  | 'manual-dock'
  | 'download'
  | 'replay';

export type DashboardTourPreviewKind =
  | 'welcome'
  | 'sidebar'
  | 'upload'
  | 'modes'
  | 'production'
  | 'utils'
  | 'pipeline'
  | 'config'
  | 'stage-empty'
  | 'stage-preview'
  | 'manual-dock'
  | 'download'
  | 'replay';

interface DashboardTourSnapshot {
  mode: DashboardTourToolMode;
  subMode: DashboardTourSubMode;
  activeId: string | null;
  toolsPanelVisible: boolean;
}

interface DashboardTourInternalStep extends ResolvableTourStep {
  id: DashboardTourStepId;
  selectors?: TourSelectorSpec;
  title: string;
  body: string;
  previewKind: DashboardTourPreviewKind;
}

export interface UseDashboardTourOptions {
  userId?: string | null;
  isReady: boolean;
  suppressAutoStart?: boolean;
  mode: DashboardTourToolMode;
  subMode: DashboardTourSubMode;
  activeId: string | null;
  firstImageId: string | null;
  hasImages: boolean;
  hasDownloadActions: boolean;
  isCompactViewport: boolean;
  toolsPanelVisible: boolean;
  setMode: (mode: DashboardTourToolMode) => void;
  setSubMode: (mode: DashboardTourSubMode) => void;
  setActiveId: (id: string | null) => void;
  setToolsPanelVisible: (visible: boolean) => void;
  setForcedDropdown: (dropdown: DashboardTourForcedDropdown) => void;
}

const DASHBOARD_TOUR_STORAGE_PREFIX = 'koma-studio.dashboard-tour.v1';
export const DASHBOARD_TOUR_CONTENT_VERSION = '2026-03-dashboard-main-flow';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const buildStorageKey = (userId: string): string =>
  `${DASHBOARD_TOUR_STORAGE_PREFIX}:${encodeURIComponent(userId)}`;

export const readDashboardTourState = (
  userId: string,
): DashboardTourStateV1 | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }

    if (
      parsed.tourVersion !== DASHBOARD_TOUR_CONTENT_VERSION ||
      (parsed.status !== 'completed' && parsed.status !== 'dismissed') ||
      typeof parsed.seenAt !== 'string'
    ) {
      return null;
    }

    return {
      tourVersion: parsed.tourVersion,
      status: parsed.status,
      seenAt: parsed.seenAt,
    };
  } catch {
    return null;
  }
};

const persistDashboardTourState = (
  userId: string,
  status: DashboardTourStatus,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: DashboardTourStateV1 = {
    tourVersion: DASHBOARD_TOUR_CONTENT_VERSION,
    status,
    seenAt: new Date().toISOString(),
  };
  window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(payload));
};

const escapeHtml = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const renderPreviewMarkup = (
  kind: DashboardTourPreviewKind,
  t: TFunc,
): string => {
  switch (kind) {
    case 'welcome':
      return `
        <div class="koma-tour-preview koma-tour-preview--welcome" aria-hidden="true">
          <div class="koma-tour-preview__hero">${escapeHtml(t('brand.name'))}</div>
          <div class="koma-tour-preview__chips">
            <span class="koma-tour-preview__chip">${escapeHtml(t('dashboard.tour.preview.welcome.upload'))}</span>
            <span class="koma-tour-preview__chip">AIO</span>
            <span class="koma-tour-preview__chip">${escapeHtml(t('dashboard.tour.preview.welcome.export'))}</span>
          </div>
        </div>
      `;
    case 'sidebar':
      return `
        <div class="koma-tour-preview koma-tour-preview--sidebar" aria-hidden="true">
          <div class="koma-tour-preview__panel">
            <div class="koma-tour-preview__bar koma-tour-preview__bar--gradient"></div>
            <div class="koma-tour-preview__list">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      `;
    case 'upload':
      return `
        <div class="koma-tour-preview koma-tour-preview--upload" aria-hidden="true">
          <div class="koma-tour-preview__drop">${escapeHtml(t('dashboard.tour.preview.upload.formats'))}</div>
        </div>
      `;
    case 'modes':
      return `
        <div class="koma-tour-preview koma-tour-preview--modes" aria-hidden="true">
          <span class="koma-tour-preview__tab koma-tour-preview__tab--active">${escapeHtml(t('dashboard.nav.short.aio'))}</span>
          <span class="koma-tour-preview__tab">${escapeHtml(t('dashboard.nav.short.cleaner'))}</span>
        </div>
      `;
    case 'production':
      return `
        <div class="koma-tour-preview koma-tour-preview--grid" aria-hidden="true">
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.cleaner'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.typesetter'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.translator'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.raw'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.proofreader'))}</span>
        </div>
      `;
    case 'utils':
      return `
        <div class="koma-tour-preview koma-tour-preview--grid" aria-hidden="true">
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.stitch'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.split'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.watermark'))}</span>
          <span class="koma-tour-preview__miniCard">${escapeHtml(t('dashboard.mode.enhance'))}</span>
        </div>
      `;
    case 'pipeline':
      return `
        <div class="koma-tour-preview koma-tour-preview--pipeline" aria-hidden="true">
          <span>${escapeHtml(t('aio.stage.detectText'))}</span>
          <i></i>
          <span>${escapeHtml(t('aio.stage.recognizeText'))}</span>
          <i></i>
          <span>${escapeHtml(t('aio.stage.getTranslations'))}</span>
          <i></i>
          <span>${escapeHtml(t('aio.stage.segmentText'))}</span>
          <i></i>
          <span>${escapeHtml(t('aio.stage.cleanImage'))}</span>
          <i></i>
          <span>${escapeHtml(t('aio.stage.render'))}</span>
        </div>
      `;
    case 'config':
      return `
        <div class="koma-tour-preview koma-tour-preview--config" aria-hidden="true">
          <div class="koma-tour-preview__field"></div>
          <div class="koma-tour-preview__field"></div>
          <div class="koma-tour-preview__field"></div>
          <div class="koma-tour-preview__field"></div>
        </div>
      `;
    case 'stage-empty':
      return `
        <div class="koma-tour-preview koma-tour-preview--stage" aria-hidden="true">
          <div class="koma-tour-preview__canvas koma-tour-preview__canvas--empty">${escapeHtml(t('dashboard.tour.preview.stageEmpty'))}</div>
        </div>
      `;
    case 'stage-preview':
      return `
        <div class="koma-tour-preview koma-tour-preview--stage" aria-hidden="true">
          <div class="koma-tour-preview__canvas">
            <span class="koma-tour-preview__bubble"></span>
            <span class="koma-tour-preview__bubble koma-tour-preview__bubble--secondary"></span>
          </div>
        </div>
      `;
    case 'manual-dock':
      return `
        <div class="koma-tour-preview koma-tour-preview--manual" aria-hidden="true">
          <span class="koma-tour-preview__tool"></span>
          <span class="koma-tour-preview__tool"></span>
          <span class="koma-tour-preview__tool"></span>
          <span class="koma-tour-preview__tool"></span>
        </div>
      `;
    case 'download':
      return `
        <div class="koma-tour-preview koma-tour-preview--download" aria-hidden="true">
          <div class="koma-tour-preview__row">
            <span class="koma-tour-preview__pill">${escapeHtml(t('settings.downloadFormat.png'))}</span>
            <span class="koma-tour-preview__pill">ZIP</span>
            <span class="koma-tour-preview__pill">PSD</span>
          </div>
          <div class="koma-tour-preview__bar"></div>
        </div>
      `;
    case 'replay':
      return `
        <div class="koma-tour-preview koma-tour-preview--replay" aria-hidden="true">
          <div class="koma-tour-preview__menuItem">${escapeHtml(t('dashboard.topbar.profile'))}</div>
          <div class="koma-tour-preview__menuItem koma-tour-preview__menuItem--active">${escapeHtml(t('dashboard.topbar.replayTour'))}</div>
        </div>
      `;
  }
};

const buildPopoverDescription = (
  description: string,
  previewKind: DashboardTourPreviewKind,
  t: TFunc,
): string => `
  <div class="koma-tour-popover__body">
    ${renderPreviewMarkup(previewKind, t)}
    <div class="koma-tour-popover__copy">
      <p>${escapeHtml(description)}</p>
    </div>
  </div>
`;

export const useDashboardTour = ({
  userId,
  isReady,
  suppressAutoStart = false,
  mode,
  subMode,
  activeId,
  firstImageId,
  hasImages,
  hasDownloadActions,
  isCompactViewport,
  toolsPanelVisible,
  setMode,
  setSubMode,
  setActiveId,
  setToolsPanelVisible,
  setForcedDropdown,
}: UseDashboardTourOptions) => {
  const { t } = useI18n();
  const [isTourActive, setIsTourActive] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<DashboardTourInternalStep[]>([]);
  const autoStartedUserRef = useRef<string | null>(null);
  const persistIntentRef = useRef<DashboardTourStatus | 'restart' | null>(null);
  const snapshotRef = useRef<DashboardTourSnapshot | null>(null);
  const mountedRef = useRef(true);
  const navSeqRef = useRef(0);
  const latestStateRef = useLatestRef<DashboardTourSnapshot>({
    mode,
    subMode,
    activeId,
    toolsPanelVisible,
  });

  const restoreSnapshot = useCallback(() => {
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (!mountedRef.current) {
      return;
    }
    setForcedDropdown(null);

    if (!snapshot) {
      return;
    }

    setMode(snapshot.mode);
    setSubMode(snapshot.subMode);
    setActiveId(snapshot.activeId);
    setToolsPanelVisible(snapshot.toolsPanelVisible);
  }, [
    setActiveId,
    setForcedDropdown,
    setMode,
    setSubMode,
    setToolsPanelVisible,
  ]);

  const stopActiveTour = useCallback(
    (intent: DashboardTourStatus | 'restart' | null) => {
      navSeqRef.current += 1;
      const activeDriver = driverRef.current;
      if (!activeDriver) {
        setForcedDropdown(null);
        return;
      }

      persistIntentRef.current = intent;
      activeDriver.destroy();
      driverRef.current = null;
    },
    [setForcedDropdown],
  );

  const buildSteps = useCallback((): DashboardTourInternalStep[] => {
    const settleWorkspace = async () => {
      setForcedDropdown(null);
      await settleTourUi();
    };

    const ensureAio = async (nextSubMode: DashboardTourSubMode) => {
      setForcedDropdown(null);
      setMode('aio');
      setSubMode(nextSubMode);
      if (firstImageId && !latestStateRef.current.activeId) {
        setActiveId(firstImageId);
      }
      setToolsPanelVisible(true);
      await settleTourUi();
    };

    const ensureDropdown = async (
      dropdown: Exclude<DashboardTourForcedDropdown, null>,
    ) => {
      setForcedDropdown(dropdown);
      await settleTourUi();
    };

    const stageSelectors: TourSelectorSpec = hasImages
      ? ['[data-tour="dashboard-stage-grid"]', '[data-tour="dashboard-stage"]']
      : ['[data-tour="dashboard-stage-empty"]', '[data-tour="dashboard-stage"]'];

    const steps: DashboardTourInternalStep[] = [
      {
        id: 'welcome',
        title: t('dashboard.tour.welcome.title'),
        body: t('dashboard.tour.welcome.body'),
        previewKind: 'welcome',
        align: 'center',
        prepare: settleWorkspace,
      },
      {
        id: 'sidebar',
        selectors: '[data-tour="dashboard-sidebar"]',
        title: t('dashboard.tour.sidebar.title'),
        body: t('dashboard.tour.sidebar.body'),
        previewKind: 'sidebar',
        side: 'right',
        align: 'start',
        prepare: settleWorkspace,
      },
      {
        id: 'upload',
        selectors: '[data-tour="dashboard-dropzone"]',
        title: t('dashboard.tour.upload.title'),
        body: t('dashboard.tour.upload.body'),
        previewKind: 'upload',
        side: 'right',
        align: 'center',
        prepare: settleWorkspace,
      },
      {
        id: 'modes',
        selectors: isCompactViewport
          ? ['[data-tour="topbar-mode-pill"]', '[data-tour="topbar-main-nav"]']
          : ['[data-tour="topbar-main-nav"]', '[data-tour="topbar-mode-pill"]'],
        title: t('dashboard.tour.modes.title'),
        body: t('dashboard.tour.modes.body'),
        previewKind: 'modes',
        side: 'bottom',
        align: 'center',
        prepare: settleWorkspace,
      },
      {
        id: 'production',
        selectors: [
          '[data-tour="topbar-production-panel"]',
          '[data-tour="topbar-production-group"]',
          '[data-tour="topbar-mode-pill"]',
        ],
        title: t('dashboard.tour.production.title'),
        body: t('dashboard.tour.production.body'),
        previewKind: 'production',
        side: 'bottom',
        align: 'center',
        prepare: async () => {
          if (
            typeof document !== 'undefined' &&
            document.querySelector('[data-tour="topbar-production-trigger"]')
          ) {
            await ensureDropdown('production');
          } else {
            await settleWorkspace();
          }
        },
      },
      {
        id: 'utils',
        selectors: [
          '[data-tour="topbar-utils-panel"]',
          '[data-tour="topbar-utils-trigger"]',
        ],
        title: t('dashboard.tour.utils.title'),
        body: t('dashboard.tour.utils.body'),
        previewKind: 'utils',
        side: 'bottom',
        align: 'center',
        prepare: async () => {
          await ensureDropdown('utils');
        },
      },
      {
        id: 'pipeline',
        selectors: '[data-tour="dashboard-aio-pipeline"]',
        title: t('dashboard.tour.pipeline.title'),
        body: t('dashboard.tour.pipeline.body'),
        previewKind: 'pipeline',
        side: 'left',
        align: 'center',
        prepare: async () => {
          await ensureAio('auto');
        },
      },
      {
        id: 'stage-config',
        selectors: [
          '[data-tour="dashboard-aio-stage-config"]',
          '[data-tour="dashboard-tools-panel"]',
        ],
        title: t('dashboard.tour.stageConfig.title'),
        body: t('dashboard.tour.stageConfig.body'),
        previewKind: 'config',
        side: 'left',
        align: 'center',
        prepare: async () => {
          await ensureAio('auto');
        },
      },
      {
        id: 'stage',
        selectors: stageSelectors,
        title: hasImages
          ? t('dashboard.tour.stage.withImagesTitle')
          : t('dashboard.tour.stage.emptyTitle'),
        body: hasImages
          ? t('dashboard.tour.stage.withImagesBody')
          : t('dashboard.tour.stage.emptyBody'),
        previewKind: hasImages ? 'stage-preview' : 'stage-empty',
        side: 'top',
        align: 'center',
        prepare: async () => {
          await ensureAio('auto');
        },
      },
    ];

    if (hasImages && !isCompactViewport) {
      steps.push({
        id: 'manual-dock',
        selectors: '[data-tour="dashboard-manual-dock"]',
        title: t('dashboard.tour.manualDock.title'),
        body: t('dashboard.tour.manualDock.body'),
        previewKind: 'manual-dock',
        side: 'left',
        align: 'center',
        prepare: async () => {
          await ensureAio('manual');
        },
      });
    }

    if (hasDownloadActions) {
      steps.push({
        id: 'download',
        selectors: [
          '[data-tour="topbar-download-panel"]',
          '[data-tour="topbar-download-trigger"]',
        ],
        title: t('dashboard.tour.download.title'),
        body: t('dashboard.tour.download.body'),
        previewKind: 'download',
        side: 'bottom',
        align: 'end',
        prepare: async () => {
          await ensureDropdown('download');
        },
      });
    }

    steps.push({
      id: 'replay',
      selectors: [
        '[data-tour="topbar-user-replay-tour"]',
        '[data-tour="topbar-user-onboarding"]',
        '[data-tour="topbar-user-panel"]',
      ],
      title: t('dashboard.tour.replay.title'),
      body: t('dashboard.tour.replay.body'),
      previewKind: 'replay',
      side: 'left',
      align: 'start',
      prepare: async () => {
        await ensureDropdown('user');
      },
    });

    return steps;
  }, [
    firstImageId,
    hasDownloadActions,
    hasImages,
    isCompactViewport,
    latestStateRef,
    setActiveId,
    setForcedDropdown,
    setMode,
    setSubMode,
    setToolsPanelVisible,
    t,
  ]);

  const completeTour = useCallback((currentDriver: Driver) => {
    navSeqRef.current += 1;
    persistIntentRef.current = 'completed';
    currentDriver.destroy();
    driverRef.current = null;
  }, []);

  const navigateToStep = useCallback(
    async (currentDriver: Driver, targetIndex: number, direction: 1 | -1) => {
      const sequenceToken = (navSeqRef.current += 1);
      await navigateResolvableTourStep({
        driver: currentDriver,
        steps: stepsRef.current,
        startIndex: targetIndex,
        direction,
        sequenceToken,
        getCurrentToken: () => navSeqRef.current,
        onComplete: () => completeTour(currentDriver),
      });
    },
    [completeTour],
  );

  const startTour = useCallback(
    async (force = false) => {
      if (!userId || !isReady || typeof window === 'undefined') {
        return;
      }

      if (!force && readDashboardTourState(userId)) {
        return;
      }

      if (driverRef.current?.isActive()) {
        stopActiveTour('restart');
        await settleTourUi();
      }

      const steps = buildSteps();
      stepsRef.current = steps;
      snapshotRef.current = {
        mode,
        subMode,
        activeId,
        toolsPanelVisible,
      };
      persistIntentRef.current = null;

      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches;

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
        completeTour(opts.driver);
      };

      const driverSteps: DriveStep[] = steps.map((step) => ({
        element: stepToDriveElement(step.selectors),
        popover: {
          title: escapeHtml(step.title),
          description: buildPopoverDescription(step.body, step.previewKind, t),
          side: step.side,
          align: step.align,
          showButtons: ['previous', 'next', 'close'],
          showProgress: true,
          popoverClass: `koma-tour-popover koma-tour-popover--${step.previewKind}`,
          onNextClick: handleNextClick,
          onPrevClick: handlePrevClick,
          onDoneClick: handleDoneClick,
        },
      }));

      const driverObj = driver({
        animate,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        overlayClickBehavior: 'close',
        overlayColor: '#060810',
        overlayOpacity: 0.72,
        popoverOffset: 18,
        showButtons: ['previous', 'next', 'close'],
        showProgress: true,
        progressText: t('dashboard.tour.progressText'),
        nextBtnText: t('dashboard.tour.next'),
        prevBtnText: t('dashboard.tour.prev'),
        doneBtnText: t('dashboard.tour.done'),
        stagePadding: 18,
        stageRadius: 20,
        smoothScroll: true,
        steps: driverSteps,
        onNextClick: handleNextClick,
        onPrevClick: handlePrevClick,
        onDoneClick: handleDoneClick,
        onPopoverRender: (popover, opts) => {
          const activeStep =
            stepsRef.current[opts.driver.getActiveIndex() ?? 0];
          popover.wrapper.setAttribute('role', 'dialog');
          popover.wrapper.setAttribute('aria-modal', 'true');
          popover.wrapper.setAttribute(
            'aria-label',
            activeStep?.title ?? t('dashboard.tour.dialogLabel'),
          );
          popover.closeButton.setAttribute('aria-label', t('dashboard.tour.close'));
          popover.nextButton.setAttribute(
            'aria-label',
            opts.driver.isLastStep()
              ? t('dashboard.tour.done')
              : t('dashboard.tour.nextAria'),
          );
          popover.previousButton.setAttribute(
            'aria-label',
            t('dashboard.tour.prevAria'),
          );
        },
        onCloseClick: (_element, _step, opts) => {
          navSeqRef.current += 1;
          persistIntentRef.current = 'dismissed';
          opts.driver.destroy();
          driverRef.current = null;
        },
        onDestroyStarted: () => {
          if (!persistIntentRef.current) {
            persistIntentRef.current = 'dismissed';
          }
        },
        onDestroyed: () => {
          navSeqRef.current += 1;
          const intent = persistIntentRef.current;
          if (userId && (intent === 'completed' || intent === 'dismissed')) {
            persistDashboardTourState(userId, intent);
          }
          persistIntentRef.current = null;
          driverRef.current = null;
          if (mountedRef.current) {
            setIsTourActive(false);
          }
          restoreSnapshot();
        },
      });

      driverRef.current = driverObj;
      if (mountedRef.current) {
        setIsTourActive(true);
      }
      await steps[0]?.prepare?.();
      driverObj.drive(0);
      await waitForNextPaint();
      if (driverRef.current === driverObj && driverObj.isActive()) {
        driverObj.refresh();
      }
    },
    [
      activeId,
      buildSteps,
      completeTour,
      isReady,
      mode,
      navigateToStep,
      restoreSnapshot,
      stopActiveTour,
      subMode,
      t,
      toolsPanelVisible,
      userId,
    ],
  );

  useEffect(() => {
    if (!userId) {
      autoStartedUserRef.current = null;
      return;
    }

    if (!isReady || suppressAutoStart || autoStartedUserRef.current === userId) {
      return;
    }

    autoStartedUserRef.current = userId;
    void startTour(false);
  }, [isReady, startTour, suppressAutoStart, userId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      navSeqRef.current += 1;
      if (driverRef.current) {
        persistIntentRef.current = 'restart';
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  const replayTour = useCallback(() => {
    void startTour(true);
  }, [startTour]);

  return { replayTour, isTourActive };
};
