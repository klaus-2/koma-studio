'use client';

import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Languages,
  Eraser,
  Eye,
  ScanText,
  Replace,
  Paintbrush,
} from 'lucide-react';
import type { StageTabKey, StageTabDef } from './AioStageTabBar';
import { getApiConfig } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { useDashboardTour } from '../hooks/useDashboardTour';
import { useDashboardModeCoachmarks } from '../hooks/useDashboardModeCoachmarks';

import { useModelManager } from '../hooks/useModelManager';
import {
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
} from '../utils/dashboard.utils';
import {
  createAioManualProgressForIndex,
  createAioManualProgressFromAutoIndex,
  parseApiError,
  resolveSnapshotSelectionForImage,
} from './dashboard/helpers';
import { useI18n } from '../i18n';
import { importOnnxModelFromStorage } from '../models/model-storage';
import {
  isCustomModelSelectionKey,
  toCustomModelSelectionKey,
  OLLAMA_LOCAL_API_BASE,
} from '../utils/customLlm';
import {
  BATCH_THREADS_COUNT_STORAGE_KEY,
  BATCH_THREADS_ENABLED_STORAGE_KEY,
  clampBatchThreads,
} from '../utils/concurrentBatch';
import { loadWorkspaceAutosaveSettings } from '../utils/workspaceAutosaveSettings';
import type {
  AioStageKey,
} from '../types/aioModelPresets';
import type {
  AioManualImageProgress,
  AioPipelineSnapshotKey,
  AioTextRegion,
  DashboardPageProps,
  DownloadItem,
  LoadedImage,
  ToolMode,
  WebhookMetrics,
} from '../types/dashboard.types';

import {
  capitalizeStageLabel,
  type AioExecutionScope,
} from '../utils/dashboardRenderUtils';

import {
  AIO_MANUAL_STAGE_ORDER,
  EMPTY_PREVIEW_TIP_ROTATION_MS,
  INFO_MODES,
  getAioPipelineStageLabels,
  getAioPipelineStageProgressLabels,
  getAioStageLabels,
  getEmptyPreviewTips,
  getModeLabels,
  isModeUnderDevelopment,
  MIN_REGION_SIZE,
  UNDER_DEVELOPMENT_TOOLTIP_KEY,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '../constants/dashboard.constants';
import { useDashboardAccountSync } from '../hooks/useDashboardAccountSync';
import {
  useDashboardDownloadActions,
  useDashboardDownloadBundle,
  useDashboardPsdDownload,
  triggerBlobDownload,
  useExportDownloadAvailability,
  useExportDownloadLifecycle,
} from './dashboard/hooks/export-download';
import { useDashboardExternalActions } from '../hooks/useDashboardExternalActions';
import { useDashboardMenus } from '../hooks/useDashboardMenus';
import { useDashboardModelManager } from '../hooks/useDashboardModelManager';
import { useDashboardLocalStageValidation } from '../hooks/useDashboardLocalStageValidation';
import { useRenderFontCatalog } from '../hooks/useRenderFontCatalog';
import { useDashboardShellLayout } from '../hooks/useDashboardShellLayout';
import { useDashboardUsageAndPresence } from '../hooks/useDashboardUsageAndPresence';
import { useCleanerActions } from './dashboard/hooks/cleaner';
import {
  useActiveCleanerRegionState,
  useCleanerAiStageOptions,
  useCleanerAiDraftProfileActions,
  useCleanerManualEdits,
  useCleanerModelSelection,
  useCleanerRegionEditing,
  useCleanerWandHealing,
} from './dashboard/hooks/cleaner';
import {
  useActiveTranslatorRegionState,
  useTranslatorExecutionResolvers,
  useTranslatorSfxOptions,
  useTranslatorImports,
  useTranslatorRegionEditing,
  useTranslatorRetranslate,
  useTranslatorTextActions,
  useTranslatorVisualActions,
} from './dashboard/hooks/translator';
import {
  useTypographerActiveState,
  useTypographerControls,
  useTypographerWorkspace,
} from './dashboard/hooks/typographer';
import {
  useActiveManualEditState,
  useAioManualEdits,
  useAioWandHealing,
  useManualToolToggles,
} from './dashboard/hooks/manual-tools';
import {
  useDashboardEnhanceActions,
  useEnhanceInstallAction,
  useEnhanceModelSelection,
} from './dashboard/hooks/enhance';
import {
  type KeyboardShortcutConfigV2,
} from '../shortcuts/keyboardShortcuts';
import type {
  TypographyShapeKind,
} from '../typography/types';
import './AioToolsPanel.css';
import './DockTools.css';

import { desktopBridge } from "@/lib/desktop-bridge";
import { useStatusStore } from './dashboard/stores/status-store';
import { useUiShellStore } from './dashboard/stores/ui-shell-store';
import { useImageCollectionStore } from './dashboard/stores/image-collection-store';
import { useLlmProvidersStore } from './dashboard/stores/llm-providers-store';
import { useAioPipelineStore } from './dashboard/stores/aio-pipeline-store';
import { useRegionEditorStore } from './dashboard/stores/region-editor-store';
import { useTypographerStore } from './dashboard/stores/typographer-store';
import { useCleanerStore } from './dashboard/stores/cleaner-store';
import { useManualToolsStore } from './dashboard/stores/manual-tools-store';
import { useTranslatorStore } from './dashboard/stores/translator-store';
import { useExportStore } from './dashboard/stores/export-store';
import { useAuthAccountStore } from './dashboard/stores/auth-account-store';
import { useWorkspacePersistenceStore } from './dashboard/stores/workspace-persistence-store';
import {
  useActiveAioRegionState,
  useAioRegionEditing,
  useAioRegionRenderToBlob,
  useAioRegionSnapshotSync,
} from './dashboard/hooks/region-editor';
import {
  useAioDeviceInfoSync,
  useAioManualExecution,
  useAioSelectedStageModels,
  useAioStageAvailability,
  useEffectiveBatchConcurrency,
  useAioMiniBackendRuntimeSync,
  useAioModelSelection,
  useAioPipelineExecution,
  useAioPresetEditor,
  useAioStageCatalogBuild,
  useAioStageSelectionFallbacks,
} from './dashboard/hooks/aio-pipeline';
import { useAioPipelineSnapshotState } from './dashboard/hooks/aio-snapshot-state';
import { useDashboardUploads, useDashboardImageCollection } from './dashboard/hooks/image-collection';
import {
  useCustomLlmDrafts,
  useCustomLlmProfilesSync,
  useFreeProviderProfiles,
  useLlmProviderTest,
  useLlmSettingsPersistence,
  useLlmStageProfileOptions,
} from './dashboard/hooks/llm-providers';
// Lazy-loaded workspace components — only loaded when their mode is active
import {
  CleanerAiCustomProfilesManagerSection,
  CleanerAiFreeProviderManagerSection,
  OcrCustomProfilesManagerSection,
  OcrFreeProviderManagerSection,
  TranslationCustomProfilesManagerSection,
  TranslationFreeProviderManagerSection,
} from './dashboard/sections/LlmManagerSections';
import {
  useCurrentUtilityWorkspaceStates,
  useSpecialModeStageProps,
  useStitchWorkspace,
  useUtilitySplitterController,
} from './dashboard/hooks/utility-workspaces';
import {
  useAuthAccountProcessingStats,
  useDiscordPresence,
} from './dashboard/hooks/auth-account';
import { useWorkspacePersistence } from './dashboard/hooks/workspace-persistence';
import { useDashboardKeyboard } from './dashboard/hooks/use-dashboard-keyboard';
import DashboardMainLayout from './dashboard/sections/DashboardMainLayout';

// ── UI Sub-components ──
// ── Main Component ──
export const DashboardPage = ({
  onOpenSettings,
  onOpenModelRankings,
  onOpenScanlationFeed,
}: DashboardPageProps) => {
  const { t } = useI18n();
  const {
    user: authUser,
    getAuthToken,
    refreshSession,
    isLoading: authLoading,
    logout,
    sendVerificationEmail,
  } = useAuth();
  const aioPipelineStageLabels = useMemo(() => getAioPipelineStageLabels(t), [t]);
  const aioPipelineStageProgressLabels = useMemo(
    () => getAioPipelineStageProgressLabels(t),
    [t],
  );
  const aioStageLabels = useMemo(() => getAioStageLabels(t), [t]);
  const emptyPreviewTips = useMemo(() => getEmptyPreviewTips(t), [t]);
  const modeLabels = useMemo(() => getModeLabels(t), [t]);
  const underDevelopmentTooltip = t(UNDER_DEVELOPMENT_TOOLTIP_KEY);
  // ── Core State ──
  const mode = useUiShellStore((s) => s.mode);
  const setMode = useUiShellStore((s) => s.setMode);
  const subMode = useUiShellStore((s) => s.subMode);
  const setSubMode = useUiShellStore((s) => s.setSubMode);
  const cleanerMode = useCleanerStore((s) => s.cleanerMode);
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const rotateImage = useImageCollectionStore((s) => s.rotateImage);
  const processing = useUiShellStore((s) => s.processing);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setZoom = useUiShellStore((s) => s.setZoom);

  // ── Mobile State ──
  const setForcedTourDropdown = useUiShellStore((s) => s.setForcedTourDropdown);
  const setModeTabsScroll = useUiShellStore((s) => s.setModeTabsScroll);
  const desktopSidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const topbarSidebarRevealRef = useRef<HTMLButtonElement | null>(null);
  const desktopToolsToggleRef = useRef<HTMLButtonElement | null>(null);
  const topbarToolsRevealRef = useRef<HTMLButtonElement | null>(null);

  const animateSidebarToggleSharedElement = useCallback(
    (fromEl: HTMLElement | null, toEl: HTMLElement | null) => {
      if (typeof window === 'undefined' || !fromEl || !toEl) {
        return;
      }

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      if (
        fromRect.width === 0 ||
        fromRect.height === 0 ||
        toRect.width === 0 ||
        toRect.height === 0
      ) {
        return;
      }

      const ghost = document.createElement('div');
      ghost.className = 'koma-sidebar-toggle-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.innerHTML = fromEl.innerHTML;
      ghost.style.width = `${fromRect.width}px`;
      ghost.style.height = `${fromRect.height}px`;
      ghost.style.left = `${fromRect.left}px`;
      ghost.style.top = `${fromRect.top}px`;
      // Ghost is pinned at the FROM rect; translate+scale with top-left origin
      // maps it exactly onto the TO rect without animating layout properties.
      ghost.style.transformOrigin = 'top left';

      document.body.appendChild(ghost);
      const previousFromVisibility = fromEl.style.visibility;
      const previousToVisibility = toEl.style.visibility;
      fromEl.style.visibility = 'hidden';
      toEl.style.visibility = 'hidden';

      const dx = toRect.left - fromRect.left;
      const dy = toRect.top - fromRect.top;
      const sx = toRect.width / fromRect.width;
      const sy = toRect.height / fromRect.height;

      const animation = ghost.animate(
        [
          {
            opacity: 0.96,
            transform: 'translate(0px, 0px) translateZ(0) scale(1, 1)',
            borderRadius: '10px',
          },
          {
            opacity: 0.9,
            transform: `translate(${dx}px, ${dy}px) translateZ(0) scale(${sx * 0.98}, ${sy * 0.98})`,
            borderRadius: '10px',
          },
        ],
        {
          duration: 250,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
        },
      );

      animation.onfinish = () => {
        fromEl.style.visibility = previousFromVisibility;
        toEl.style.visibility = previousToVisibility;
        ghost.remove();
      };

      animation.oncancel = () => {
        fromEl.style.visibility = previousFromVisibility;
        toEl.style.visibility = previousToVisibility;
        ghost.remove();
      };
    },
    [],
  );
  const {
    mobileNavOpen,
    setMobileNavOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileToolsOpen,
    setMobileToolsOpen,
    desktopSidebarCollapsed,
    toolsPanelCollapsed,
    setToolsPanelCollapsed,
    leftSidebarWidth,
    rightSidebarWidth,
    isCompactViewport,
    toolsPanelVisible,
    toggleDesktopSidebar,
    toggleDesktopToolsPanel,
    startSidebarResize,
    resizeLeftSidebarBy,
    resizeRightSidebarBy,
    resetLeftSidebarWidth,
    resetRightSidebarWidth,
    handleToolsToggle,
    setToolsPanelVisible,
  } = useDashboardShellLayout({
    desktopSidebarToggleRef,
    topbarSidebarRevealRef,
    desktopToolsToggleRef,
    topbarToolsRevealRef,
    animateSidebarToggle: animateSidebarToggleSharedElement,
  });

  // ── Tool Settings ──
  const outFormat = useExportStore((s) => s.outFormat);
  const outQuality = useExportStore((s) => s.outQuality);
  const batchThreadsEnabled = useAioPipelineStore((s) => s.batchThreadsEnabled);
  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const setProgress = useUiShellStore((s) => s.setProgress);

  // Enhance

  // AIO Pipeline
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore((s) => s.setAioStageSelection);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore((s) => s.aioHdCropTriggerSize);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const setKeyboardShortcutConfig = useUiShellStore(
    (s) => s.setKeyboardShortcutConfig,
  );
  const typographerQueueSelectedId = useTypographerStore(
    (s) => s.typographerQueueSelectedId,
  );
  const setTypographerQueueSelectedId = useTypographerStore(
    (s) => s.setTypographerQueueSelectedId,
  );
  const typographerSelectedSnapshotId = useTypographerStore(
    (s) => s.typographerSelectedSnapshotId,
  );
  const setTypographerSelectedSnapshotId = useTypographerStore(
    (s) => s.setTypographerSelectedSnapshotId,
  );
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const setAioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshotIndex,
  );
  const aioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.aioImageSnapshotIndexById,
  );
  const setAioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.setAioImageSnapshotIndexById,
  );
  const aioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.aioAutoHistoryAvailable,
  );
  const setAioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.setAioAutoProcessedImageById,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const segmentEditTool = useManualToolsStore((s) => s.segmentEditTool);
  const setSegmentEditTool = useManualToolsStore((s) => s.setSegmentEditTool);
  const areaSelectionCreateMode = useManualToolsStore(
    (s) => s.areaSelectionCreateMode,
  );
  const manualImageTool = useManualToolsStore((s) => s.manualImageTool);
  const setManualImageTool = useManualToolsStore((s) => s.setManualImageTool);
  const manualToolsConfigOpen = useManualToolsStore(
    (s) => s.manualToolsConfigOpen,
  );
  const setManualToolsConfigOpen = useManualToolsStore(
    (s) => s.setManualToolsConfigOpen,
  );
  const manualImageWandTolerance = useManualToolsStore(
    (s) => s.manualImageWandTolerance,
  );
  const aioManualImageEditsByImage = useManualToolsStore(
    (s) => s.aioManualImageEditsByImage,
  );
  const setAioManualImageEditsByImage = useManualToolsStore(
    (s) => s.setAioManualImageEditsByImage,
  );
  const setAioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.setAioManualHealingBusyByImage,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const customLlmProfilesLoading = useLlmProvidersStore(
    (s) => s.customLlmProfilesLoading,
  );
  const customLlmProfilesMode = useLlmProvidersStore(
    (s) => s.customLlmProfilesMode,
  );
  const customLlmProfilesHydrated = useLlmProvidersStore(
    (s) => s.customLlmProfilesHydrated,
  );
  const pendingCustomSelections = useLlmProvidersStore(
    (s) => s.pendingCustomSelections,
  );
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  // Translator
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const setTranslatorDetectionsByImage = useTranslatorStore(
    (s) => s.setTranslatorDetectionsByImage,
  );
  const setTranslatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.setTranslatorSelectedRegionByImage,
  );
  const setTranslatorRunMetaByImage = useTranslatorStore(
    (s) => s.setTranslatorRunMetaByImage,
  );
  const translatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.translatorProcessedBaseByImage,
  );
  const setTranslatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.setTranslatorProcessedBaseByImage,
  );
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => s.cleanerDetectionsByImage,
  );
  const setCleanerDetectionsByImage = useCleanerStore(
    (s) => s.setCleanerDetectionsByImage,
  );
  const setCleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.setCleanerSelectedRegionByImage,
  );
  const cleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.cleanerProcessedBaseByImage,
  );
  const setCleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.setCleanerProcessedBaseByImage,
  );
  const setCleanerRunMetaByImage = useCleanerStore(
    (s) => s.setCleanerRunMetaByImage,
  );
  const cleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.cleanerManualImageEditsByImage,
  );
  const setCleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.setCleanerManualImageEditsByImage,
  );
  const setCleanerHealingBusyByImage = useCleanerStore(
    (s) => s.setCleanerHealingBusyByImage,
  );
  const setCleanerShowOverlays = useCleanerStore(
    (s) => s.setCleanerShowOverlays,
  );
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const setCleanerAiModelKey = useCleanerStore((s) => s.setCleanerAiModelKey);
  const cleanerAiAdditionalInstructions = useCleanerStore(
    (s) => s.cleanerAiAdditionalInstructions,
  );
  const translatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.translatorSfxCleanModelKey,
  );
  const setTranslatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.setTranslatorSfxCleanModelKey,
  );

  // Typesetter
  // Downloads & Status
  const downloadItems = useExportStore((s) => s.downloadItems);
  const setDownloadItems = useExportStore((s) => s.setDownloadItems);
  const setLastActionScope = useExportStore((s) => s.setLastActionScope);
  const statusMessage = useStatusStore((s) => s.statusMessage);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  useEffect(() => {
    const statusState = useStatusStore.getState();
    if (!statusState.statusToneExplicit) {
      statusState.setStatusMessageTone('info');
    }
    statusState.clearStatusToneExplicit();
  }, [statusMessage]);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setRuntimeExecutionNotice = useStatusStore(
    (s) => s.setRuntimeExecutionNotice,
  );
  const workspaceRestoreToken = useWorkspacePersistenceStore(
    (s) => s.workspaceRestoreToken,
  );
  const setWorkspaceAutosaveSettings = useWorkspacePersistenceStore(
    (s) => s.setWorkspaceAutosaveSettings,
  );
  const emptyPreviewTipIndex = useUiShellStore((s) => s.emptyPreviewTipIndex);
  const setEmptyPreviewTipIndex = useUiShellStore(
    (s) => s.setEmptyPreviewTipIndex,
  );
  const {
    shortcutCenterOpen,
    bugReportModalOpen,
    setBugReportModalOpen,
    openSettingsOnPresetsTab,
    projectWebsiteUrl,
    projectDiscordUrl,
    openProjectExternalLink,
    openBugReportModal,
    openShortcutCenter,
    closeShortcutCenter,
  } = useDashboardExternalActions({ onOpenSettings });
  const handleKeyboardShortcutConfigChange = useCallback(
    (nextConfig: KeyboardShortcutConfigV2) => {
      setKeyboardShortcutConfig(nextConfig);
    },
    [setKeyboardShortcutConfig],
  );
  // Download settings
  const user = useAuthAccountStore((s) => s.user);
  const setUser = useAuthAccountStore((s) => s.setUser);
  const { processingStats, recordProcessedPages } =
    useAuthAccountProcessingStats({
      authUser,
    });

  const {
    state: modelManagerState,
    summary: modelSummary,
    installAllSummary,
    compatibleModelIds: compatibleTranslationModelIds,
    openManager: openModelManager,
    closeManager: closeModelManager,
    setModalLanguageFilter: setModelModalLanguageFilter,
    refreshModelState,
    installModel: installTranslationModel,
    updateModel: updateTranslationModel,
    uninstallModel: uninstallTranslationModel,
    retryModel: retryTranslationModel,
    cancelModel: cancelTranslationModel,
    refreshRemoteModelUpdates: checkModelUpdatesNow,
    installAll: installAllTranslationModels,
    cancelAll: cancelAllTranslationModels,
  } = useModelManager({
    sourceLanguage: aioSrcLang,
    targetLanguage: aioTgtLang,
  });

  const {
    activeModelManagerStage,
    enhanceModelManagerOpen,
    setEnhanceModelManagerOpen,
    openModelManagerForStage,
    closeModelManagerForStage,
  } = useDashboardModelManager({
    sourceLanguage: aioSrcLang,
    openModelManager,
    closeModelManager,
  });

  const { filteredEnhanceModels, selectedEnhanceModel, selectedEnhanceInstallState } =
    useEnhanceModelSelection({ modelManagerState });

  // Refs
  const { setUtilsMenuOpen, setDownloadMenuOpen } = useDashboardMenus();
  const modeTabsRef = useRef<HTMLElement | null>(null);
  const fontCatalogInputRef = useRef<HTMLInputElement | null>(null);
  const translatorTextImportRef = useRef<HTMLInputElement>(null);
  const translatorImageImportRef = useRef<HTMLInputElement>(null);
  const apiConfig = getApiConfig();
  const isDesktopRuntime = desktopBridge.isDesktopRuntime();
  const typographerWorkspaceImages = useMemo(
    () =>
      images.map((image) => ({
        id: image.id,
        file: image.file,
        width: image.width,
        height: image.height,
      })),
    [images],
  );
  const typographerWorkspace = useTypographerWorkspace({
    images: typographerWorkspaceImages,
    activeImageId: activeId,
    regionsByImage: aioDetectionsByImage,
  });

  // The execution state operations live on the aio-pipeline store. The page
  // keeps same-name bindings: the two pure state ops are the store actions and
  // the label-producing helpers pass the `t`-computed strings through (the
  // `t`/label closures below reproduce the baseline callbacks' deps exactly).
  const clearAioExecutionState = useAioPipelineStore(
    (s) => s.clearAioExecutionState,
  );

  const beginAioExecution = useCallback(
    (scope: AioExecutionScope, totalImages: number, stageKeys: AioPipelineSnapshotKey[]) => {
      return useAioPipelineStore.getState().beginAioExecution(
        scope,
        totalImages,
        stageKeys,
        scope === 'manual'
          ? t('dashboard.aio.preparingManual')
          : t('dashboard.aio.preparingAuto'),
      );
    },
    [],
  );

  const updateAioExecutionStage = useCallback(
    (
      scope: AioExecutionScope,
      stageKey: AioPipelineSnapshotKey,
      image: LoadedImage,
      index: number,
      totalImages: number,
    ) => {
      useAioPipelineStore.getState().updateAioExecutionStage(
        scope,
        stageKey,
        image,
        index,
        totalImages,
        capitalizeStageLabel(aioPipelineStageProgressLabels[stageKey]),
      );
    },
    [],
  );

  const stopAioExecution = useCallback(() => {
    useAioPipelineStore.getState().stopAioExecution({
      stopping: t('dashboard.aio.stopping'),
      abortedByUser: t('dashboard.aio.abortedByUser'),
      restartSucceeded: t('dashboard.aio.abortedMiniBackendRestarted'),
      restartFailed: t('dashboard.aio.abortedMiniBackendRestartFailed'),
      totalImages: images.length,
      isDesktopRuntime,
    });
  }, [images.length, isDesktopRuntime]);

  useEffect(() => {
    if (!processing) {
      clearAioExecutionState();
    }
  }, [clearAioExecutionState, processing]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      BATCH_THREADS_ENABLED_STORAGE_KEY,
      String(batchThreadsEnabled),
    );
  }, [batchThreadsEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      BATCH_THREADS_COUNT_STORAGE_KEY,
      String(clampBatchThreads(batchThreads)),
    );
  }, [batchThreads]);

  useEffect(() => {
    const syncWorkspaceAutosaveSettings = () => {
      setWorkspaceAutosaveSettings(loadWorkspaceAutosaveSettings());
    };

    window.addEventListener(
      'koma:workspace-autosave-settings-changed',
      syncWorkspaceAutosaveSettings,
    );
    window.addEventListener('focus', syncWorkspaceAutosaveSettings);
    return () => {
      window.removeEventListener(
        'koma:workspace-autosave-settings-changed',
        syncWorkspaceAutosaveSettings,
      );
      window.removeEventListener('focus', syncWorkspaceAutosaveSettings);
    };
  }, [setWorkspaceAutosaveSettings]);

  useEffect(() => {
    if (images.length > 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setEmptyPreviewTipIndex((prev) => (prev + 1) % emptyPreviewTips.length);
    }, EMPTY_PREVIEW_TIP_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [images.length, setEmptyPreviewTipIndex]);

  const { discord, setDiscordPreset, setDiscordTranslating } =
    useDiscordPresence({
      authUser,
    });

  const activeImage = useMemo(
    () =>
      images.find((img) => img.id === activeId) ??
      images[0] ??
      null,
    [images, activeId],
  );
  const resolvedActiveId = activeImage?.id ?? null;
  useEffect(() => {
    if (images.length === 0) {
      if (activeId !== null) {
        setActiveId(null);
      }
      return;
    }

    const hasActiveImage = activeId
      ? images.some((img) => img.id === activeId)
      : false;
    if (hasActiveImage) {
      return;
    }

    setActiveId(images[0]?.id ?? null);
  }, [activeId, images, setActiveId]);
  const {
    textFillSwatches,
    typographyPresetList,
    typographyFolderList,
    defaultBubbleTypographyPreset,
    activeImageDetections,
    activeSelectedRegionId,
    activeSelectedRegion,
    activeSelectedRenderStyle,
    activeSelectedRenderMode,
    activeSelectedResolvedRenderMode,
    activeSelectedTranslationNotes,
  } = useActiveAioRegionState({ resolvedActiveId });
  const {
    activeTranslatorImageDetections,
    activeTranslatorSelectedRegionId,
    activeTranslatorSelectedRegion,
    activeTranslatorSelectedTranslationNotes,
  } = useActiveTranslatorRegionState({ resolvedActiveId });
  const {
    activeCleanerDetections,
    activeCleanerSelectedRegionId,
    activeCleanerSelectedRegion,
    activeCleanerRunMeta,
  } = useActiveCleanerRegionState({ resolvedActiveId });
  const {
    activeTypographerSession,
    activeTypographerPreset,
    activeTypographerQueueItem,
    activeTypographerMultiSelectedIds,
    handleTypographerMultiSelectReorder,
  } = useTypographerActiveState({
    typographerWorkspace,
    resolvedActiveId,
    activeSelectedResolvedRenderMode,
  });

  const currentManualSelectedRegionId = useMemo(() => {
    if (subMode !== 'manual') {
      return null;
    }
    if (mode === 'translator') {
      return activeTranslatorSelectedRegionId;
    }
    if (mode === 'cleaner') {
      return activeCleanerSelectedRegionId;
    }
    if (mode === 'aio' || mode === 'typesetter') {
      return activeSelectedRegionId;
    }
    return null;
  }, [
    activeCleanerSelectedRegionId,
    activeSelectedRegionId,
    activeTranslatorSelectedRegionId,
    mode,
    subMode,
  ]);

  const {
    buildAioImageSnapshotIndexMap,
    getAioImageSnapshotIndex,
    getAioImageSnapshotMeta,
    getAioFallbackStageKey,
    resolveAioStageKeyForImage,
    normalizeAioPipelineSnapshotsForManualMode,
    initializeManualProgressFromSnapshots,
    handleAioSubModeChange,
    applyAioPipelineSnapshotToImage,
    rewindAioPipeline,
    forwardAioPipeline,
    rewindAioPipelineForImage,
    forwardAioPipelineForImage,
    patchAioSnapshotStageForImage,
    syncManualStagePreviewToNextStage,
    activeAioStageKey,
    activeManualProgress,
    activeManualStageStatus,
    aioFooterProcessingLabel,
    aioExecuteButtonProcessingLabel,
    activeImageRenderStageActive,
  } = useAioPipelineSnapshotState({
    resolvedActiveId,
    aioPipelineStageLabels,
    aioPipelineStageProgressLabels,
  });

  const getAioDownloadItemForImage = useCallback(
    (imageId: string): DownloadItem | null =>
      downloadItems.find(
        (item) => item.scope === 'aio' && item.sourceImageId === imageId,
      ) ?? null,
    [downloadItems],
  );

  const getCleanerDownloadItemForImage = useCallback(
    (imageId: string): DownloadItem | null =>
      downloadItems.find(
        (item) => item.scope === 'cleaner' && item.sourceImageId === imageId,
      ) ?? null,
    [downloadItems],
  );

  const { updateCleanerRegionsForImage, selectCleanerRegionForImage } =
    useCleanerRegionEditing();

  const {
    getCleanerManualImageEditState,
    hasCleanerManualImageEdits,
    patchCleanerManualImageEditState,
    resolveCleanerEditableBaseSourceForImage,
    composeCleanerEditableCanvas,
    clearCleanerManualPaintForImage,
    resetCleanerManualImageEditsForImage,
  } = useCleanerManualEdits({ getCleanerDownloadItemForImage });

  const {
    getAioManualImageEditState,
    hasAioManualImageEdits,
    patchAioManualImageEditState,
    resolveAioEditableBaseSourceForImage,
    composeAioEditableCanvas,
    clearAioManualPaintForImage,
    resetAioManualImageEditsForImage,
  } = useAioManualEdits({ getAioDownloadItemForImage });

  const {
    activeManualHealingBusy,
    activeHasManualPaintLayer,
    activeHasManualBaseOverride,
    activeHasManualWandSelection,
  } = useActiveManualEditState({
    resolvedActiveId,
    getAioManualImageEditState,
    getCleanerManualImageEditState,
  });

  const clearManualWandSelection = useCallback(
    (imageId: string) => {
      if (mode === 'cleaner') {
        patchCleanerManualImageEditState(imageId, { wandMaskDataUrl: null });
      } else {
        patchAioManualImageEditState(imageId, { wandMaskDataUrl: null });
      }
    },
    [mode, patchAioManualImageEditState, patchCleanerManualImageEditState],
  );

  useEffect(() => {
    const imageIds = new Set(images.map((item) => item.id));
    setAioManualImageEditsByImage((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
    setAioManualHealingBusyByImage((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
    setAioManualProgressByImage((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
    setAioAutoProcessedImageById((prev) => {
      const nextEntries = Object.entries(prev).filter(([imageId]) =>
        imageIds.has(imageId),
      );
      if (nextEntries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(nextEntries);
    });
  }, [images, setAioManualImageEditsByImage, setAioManualHealingBusyByImage, setAioManualProgressByImage, setAioAutoProcessedImageById]);

  const invalidateAioPipelineHistory = useAioPipelineStore(
    (s) => s.invalidateAioPipelineHistory,
  );

  const setAioDownloadItems = useExportStore((s) => s.setAioDownloadItems);
  const setAioDownloadItemForImage = useExportStore(
    (s) => s.setAioDownloadItemForImage,
  );


  useEffect(() => {
    if (mode !== 'aio' || subMode !== 'manual') return;
    if (images.length === 0) return;

    const snapshotsNeedNormalization =
      aioPipelineSnapshots.length === 0 ||
      aioPipelineSnapshots.length !== AIO_MANUAL_STAGE_ORDER.length ||
      AIO_MANUAL_STAGE_ORDER.some(
        (stageKey, index) => aioPipelineSnapshots[index]?.key !== stageKey,
      );

    if (snapshotsNeedNormalization) {
      const normalizedSnapshots =
        normalizeAioPipelineSnapshotsForManualMode(aioPipelineSnapshots);
      const normalizedImageIndexById: Record<string, number> = {};
      images.forEach((image) => {
        const explicitIndex = aioAutoHistoryAvailable
          ? aioImageSnapshotIndexById[image.id]
          : undefined;
        normalizedImageIndexById[image.id] =
          typeof explicitIndex === 'number' && explicitIndex >= 0
            ? clamp(
                explicitIndex,
                0,
                Math.max(0, normalizedSnapshots.length - 1),
              )
            : 0;
      });
      const manualProgress = initializeManualProgressFromSnapshots(
        normalizedSnapshots,
        normalizedImageIndexById,
      );
      setAioPipelineSnapshots(normalizedSnapshots);
      setAioImageSnapshotIndexById(normalizedImageIndexById);
      setAioManualProgressByImage(manualProgress);
      const activeManualIndex = activeId
        ? (manualProgress[activeId]?.currentIndex ?? 0)
        : 0;
      setAioPipelineSnapshotIndex(activeManualIndex);

      if (activeId) {
        const snapshot = normalizedSnapshots[activeManualIndex] ?? null;
        if (snapshot) {
          const activeRegions = cloneAioRegions(
            snapshot.detectionsByImage[activeId] ?? [],
            cloneRenderStyle,
          );
          const activeSelected = resolveSnapshotSelectionForImage(
            snapshot,
            activeId,
            activeRegions,
            aioSelectedRegionByImage[activeId] ?? null,
          );
          setAioDetectionsByImage((prev) => ({
            ...prev,
            [activeId]: activeRegions,
          }));
          setAioSelectedRegionByImage((prev) => ({
            ...prev,
            [activeId]: activeSelected,
          }));
          const activeDownload =
            snapshot.aioDownloads.find(
              (entry) => entry.sourceImageId === activeId,
            ) ?? null;
          setAioDownloadItemForImage(activeId, activeDownload);
        }
      }
      return;
    }

    setAioManualProgressByImage((prev) => {
      const imageIds = new Set(images.map((item) => item.id));
      let changed = false;
      const next: Record<string, AioManualImageProgress> = {};
      Object.entries(prev).forEach(([imageId, progress]) => {
        if (!imageIds.has(imageId)) {
          changed = true;
          return;
        }
        next[imageId] = progress;
      });
      images.forEach((image) => {
        if (next[image.id]) return;
        changed = true;
        const explicitIndex = aioAutoHistoryAvailable
          ? aioImageSnapshotIndexById[image.id]
          : undefined;
        if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
          next[image.id] = createAioManualProgressFromAutoIndex(
            clamp(explicitIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1),
          );
          return;
        }
        next[image.id] = createAioManualProgressForIndex(0);
      });
      return changed ? next : prev;
    });
  }, [
    activeId,
    aioAutoHistoryAvailable,
    aioImageSnapshotIndexById,
    aioPipelineSnapshots,
    images,
    initializeManualProgressFromSnapshots,
    mode,
    normalizeAioPipelineSnapshotsForManualMode,
    setAioDetectionsByImage,
    setAioDownloadItemForImage,
    setAioImageSnapshotIndexById,
    setAioManualProgressByImage,
    setAioPipelineSnapshotIndex,
    setAioPipelineSnapshots,
    setAioSelectedRegionByImage,
    subMode,
  ]);

  const {
    selectedDetectModel,
    filteredOcrStageOptions,
    selectedOcrModel,
    selectedLegacyTranslationOption,
    selectedSegmentModel,
    selectedCleanModel,
  } = useAioSelectedStageModels();
  const {
    ocrCustomProfiles,
    cleanCustomProfiles,
    translationStandaloneCustomProfiles,
    ocrStandaloneCustomProfiles,
    cleanStandaloneCustomProfiles,
    customTranslationStageOptions,
    customOcrStageOptions,
    selectedCustomTranslationProfile,
    selectedCustomOcrProfile,
    translationStageOptionsForSelect,
    ocrStageOptionsForSelect,
    selectedOcrCloudOption,
    showLlmSettingsPanel,
    llmSettingsSupportSummary,
    applyCustomProfileSelection,
  } = useLlmStageProfileOptions({ filteredOcrStageOptions });
  const {
    filteredCleanerOcrStageOptions,
    cleanerAiOptionsForSelect,
    selectedCleanerAiDisplayOption,
    selectedCleanerCustomProfile,
    cleanerAiCustomProviderNotice,
  } = useCleanerAiStageOptions({ cleanCustomProfiles });
  const { effectiveBatchConcurrency } = useEffectiveBatchConcurrency();
  const markPendingCustomSelection = useLlmProvidersStore(
    (s) => s.markPendingCustomSelection,
  );

  useEffect(() => {
    const selectedKey = aioStageSelection.getTranslations;
    const pendingSelection = pendingCustomSelections.translation;
    if (!isCustomModelSelectionKey(selectedKey)) {
      if (pendingSelection) {
        markPendingCustomSelection('translation', null);
      }
      return;
    }
    if (!customLlmProfilesHydrated || customLlmProfilesLoading) {
      return;
    }
    const optionStillPresent = aioStageOptions.getTranslations.some(
      (option) => option.key === selectedKey,
    );
    if (
      pendingSelection === selectedKey ||
      selectedCustomTranslationProfile ||
      optionStillPresent
    ) {
      return;
    }

    const fallbackTranslationOption = aioStageOptions.getTranslations.find(
      (option) => option.available && option.implemented,
    );
    setAioStageSelection((prev) => ({
      ...prev,
      getTranslations: fallbackTranslationOption?.key ?? '',
    }));
  }, [
    aioStageSelection.getTranslations,
    aioStageOptions.getTranslations,
    customLlmProfilesHydrated,
    customLlmProfilesLoading,
    markPendingCustomSelection,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const pendingSelection = pendingCustomSelections.ocr;
    if (!isCustomModelSelectionKey(selectedKey)) {
      if (pendingSelection) {
        markPendingCustomSelection('ocr', null);
      }
      return;
    }
    if (!customLlmProfilesHydrated || customLlmProfilesLoading) {
      return;
    }
    const optionStillPresent = aioStageOptions.recognizeText.some(
      (option) => option.key === selectedKey,
    );
    if (
      pendingSelection === selectedKey ||
      selectedCustomOcrProfile ||
      optionStillPresent
    ) {
      return;
    }

    const fallbackOcrOption = aioStageOptions.recognizeText.find(
      (option) => option.available && option.implemented,
    );
    setAioStageSelection((prev) => ({
      ...prev,
      recognizeText: fallbackOcrOption?.key ?? '',
    }));
  }, [
    aioStageSelection.recognizeText,
    aioStageOptions.recognizeText,
    customLlmProfilesHydrated,
    customLlmProfilesLoading,
    markPendingCustomSelection,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    const pendingSelection = pendingCustomSelections.translation;
    if (!pendingSelection) {
      return;
    }
    if (pendingSelection !== aioStageSelection.getTranslations) {
      markPendingCustomSelection('translation', null);
      return;
    }
    if (
      selectedCustomTranslationProfile &&
      toCustomModelSelectionKey(selectedCustomTranslationProfile) ===
        pendingSelection
    ) {
      markPendingCustomSelection('translation', null);
    }
  }, [
    aioStageSelection.getTranslations,
    markPendingCustomSelection,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
  ]);

  useEffect(() => {
    const pendingSelection = pendingCustomSelections.ocr;
    if (!pendingSelection) {
      return;
    }
    if (pendingSelection !== aioStageSelection.recognizeText) {
      markPendingCustomSelection('ocr', null);
      return;
    }
    if (
      selectedCustomOcrProfile &&
      toCustomModelSelectionKey(selectedCustomOcrProfile) === pendingSelection
    ) {
      markPendingCustomSelection('ocr', null);
    }
  }, [
    aioStageSelection.recognizeText,
    markPendingCustomSelection,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
  ]);

  const {
    isInstalledLocalAioEntry,
    isStageOptionSelectable,
    availableDetectStageOptions,
    availableSegmentStageOptions,
    availableCleanStageOptions,
    availableTranslationStageOptions,
    availableOcrStageOptions,
    cleanerAvailableOcrStageOptions,
  } = useAioStageAvailability({
    modelManagerState,
    translationStageOptionsForSelect,
    ocrStageOptionsForSelect,
    filteredCleanerOcrStageOptions,
  });
  const {
    selectedTranslationModelState,
    translatorSelectedLocalTranslationCompatible,
    translatorOcrStageOptionsForSelect,
    selectedTranslatorOcrCloudOption,
    selectedTranslatorSfxCleanCustomProfile,
    selectedTranslatorSfxCleanDisplayOption,
    translatorAvailableOcrStageOptions,
    selectTranslatorSfxCleanModel,
  } = useTranslatorSfxOptions({
    modelManagerState,
    selectedCustomOcrProfile,
    customOcrStageOptions,
    ocrCustomProfiles,
    cleanerAiOptionsForSelect,
    isStageOptionSelectable,
  });

  const cleanerAvailableSegmentStageOptions = availableSegmentStageOptions;
  const cleanerAvailableCleanStageOptions = availableCleanStageOptions;
  const {
    normalizedAioSourceLanguage,
    presetsForCurrentLanguage,
    activePresetForCurrentLanguage,
    presetEditorStageOptions,
    aioPresetEditorOpen,
    aioPresetEditorDraft,
    setAioPresetEditorDraft,
    handlePresetSelectionChange,
    openCreatePresetEditor,
    openEditPresetEditor,
    closePresetEditor,
    handleDeleteActivePreset,
    handleSaveCurrentSelectionAsPreset,
    handleSavePresetEditor,
  } = useAioPresetEditor({
    availableDetectStageOptions,
    availableOcrStageOptions,
    availableTranslationStageOptions,
    availableSegmentStageOptions,
    availableCleanStageOptions,
    setStatusMessage,
  });

  const {
    getAioStageOption,
    formatAioStageOptionLabel,
    resolveLocalModelFocusForStage,
    selectAioLocalStageModel,
    selectAioRecognizeTextModel,
    selectedDetectStatusText,
    selectedOcrStatusText,
    selectedSegmentStatusText,
    selectedCleanStatusText,
  } = useAioModelSelection({
    ocrStageOptionsForSelect,
    filteredOcrStageOptions,
    modelEntries: modelManagerState.entries,
    openModelManagerForStage,
    setStatusMessage,
  });
  const {
    validateManualLocalStageModel,
  } = useDashboardLocalStageValidation({
    modelEntries: modelManagerState.entries,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    setStatusMessage,
  });
  const {
    freeProviderDrafts,
    setFreeProviderDrafts,
    getFreeProviderDraft,
    updateFreeProviderDraft,
    getSelectedFreeProviderProfileLabel,
    saveFreeProviderProfile,
    useFreeProviderProfile,
    syncFreeProviderDraftsFromProfiles,
  } = useFreeProviderProfiles({
    userId: authUser?.id ?? null,
    applyCustomProfileSelection,
    setStatusMessage,
  });
  const {
    updateCustomLlmDraft,
    applyOllamaPresetToTranslationDraft,
    loadCustomLlmDraftFromProfile,
    useExistingCustomProfile,
    useCustomProfileById,
    saveCustomProfileInline,
    resetCustomLlmDraft,
    translationCustomProviderNotice,
    ocrCustomProviderNotice,
    saveCustomLlmDraftProfile,
    removeCustomLlmProfileById,
    removeCustomLlmDraftProfile,
  } = useCustomLlmDrafts({
    userId: authUser?.id ?? null,
    aioStageSelection,
    setAioStageSelection,
    applyCustomProfileSelection,
    syncFreeProviderDraftsFromProfiles,
    setStatusMessage,
    ollamaLocalApiBase: OLLAMA_LOCAL_API_BASE,
  });

  const { saveCleanerCustomDraftProfile, removeCleanerCustomDraftProfile } =
    useCleanerAiDraftProfileActions({
      cleanerAiOptionsForSelect,
      saveCustomProfileInline,
      removeCustomLlmProfileById,
    });
  useLlmSettingsPersistence();
  useCustomLlmProfilesSync({
    userId: authUser?.id ?? null,
    syncFreeProviderDraftsFromProfiles,
  });
  const { testFreeProviderConfig, testCustomProfileConfig } = useLlmProviderTest();

  const llmProfilesPersistenceHint = useMemo(() => {
    if (customLlmProfilesMode === 'desktop_secure') {
      return t('dashboard.status.profilesPersistedDesktopSecure');
    }
    if (customLlmProfilesMode === 'desktop_local') {
      return t('dashboard.status.profilesPersistedDesktopLocal');
    }
    return t('dashboard.status.profilesPersistedBrowser');
  }, [customLlmProfilesMode, t]);
  const translationFreeProviderManagerSection = (
    <TranslationFreeProviderManagerSection
      translationStandaloneCustomProfiles={translationStandaloneCustomProfiles}
      getFreeProviderDraft={getFreeProviderDraft}
      getSelectedFreeProviderProfileLabel={getSelectedFreeProviderProfileLabel}
      updateFreeProviderDraft={updateFreeProviderDraft}
      saveFreeProviderProfile={saveFreeProviderProfile}
      useFreeProviderProfile={useFreeProviderProfile}
      testFreeProviderConfig={testFreeProviderConfig}
      useCustomProfileById={useCustomProfileById}
      testCustomProfileConfig={testCustomProfileConfig}
      saveCustomProfileInline={saveCustomProfileInline}
      removeCustomLlmProfileById={removeCustomLlmProfileById}
    />
  );
  const ocrFreeProviderManagerSection = (
    <OcrFreeProviderManagerSection
      ocrStandaloneCustomProfiles={ocrStandaloneCustomProfiles}
      getFreeProviderDraft={getFreeProviderDraft}
      getSelectedFreeProviderProfileLabel={getSelectedFreeProviderProfileLabel}
      updateFreeProviderDraft={updateFreeProviderDraft}
      saveFreeProviderProfile={saveFreeProviderProfile}
      useFreeProviderProfile={useFreeProviderProfile}
      testFreeProviderConfig={testFreeProviderConfig}
      useCustomProfileById={useCustomProfileById}
      testCustomProfileConfig={testCustomProfileConfig}
      saveCustomProfileInline={saveCustomProfileInline}
      removeCustomLlmProfileById={removeCustomLlmProfileById}
    />
  );
  const translationCustomProfilesManagerSection = (
    <TranslationCustomProfilesManagerSection
      translationStandaloneCustomProfiles={translationStandaloneCustomProfiles}
      translationCustomProviderNotice={translationCustomProviderNotice}
      llmProfilesPersistenceHint={llmProfilesPersistenceHint}
      loadCustomLlmDraftFromProfile={loadCustomLlmDraftFromProfile}
      updateCustomLlmDraft={updateCustomLlmDraft}
      useExistingCustomProfile={useExistingCustomProfile}
      resetCustomLlmDraft={resetCustomLlmDraft}
      removeCustomLlmDraftProfile={removeCustomLlmDraftProfile}
      saveCustomLlmDraftProfile={saveCustomLlmDraftProfile}
      applyOllamaPresetToTranslationDraft={applyOllamaPresetToTranslationDraft}
    />
  );
  const ocrCustomProfilesManagerSection = (
    <OcrCustomProfilesManagerSection
      ocrStandaloneCustomProfiles={ocrStandaloneCustomProfiles}
      ocrCustomProviderNotice={ocrCustomProviderNotice}
      llmProfilesPersistenceHint={llmProfilesPersistenceHint}
      loadCustomLlmDraftFromProfile={loadCustomLlmDraftFromProfile}
      updateCustomLlmDraft={updateCustomLlmDraft}
      useExistingCustomProfile={useExistingCustomProfile}
      resetCustomLlmDraft={resetCustomLlmDraft}
      removeCustomLlmDraftProfile={removeCustomLlmDraftProfile}
      saveCustomLlmDraftProfile={saveCustomLlmDraftProfile}
    />
  );


  const {
    availableRenderFonts,
    fontCatalogLoading,
    fontCatalogImporting,
    fontCatalogError,
    renderFontRefreshToken,
    loadRenderFontCatalog,
    handleRenderFontImport,
  } = useRenderFontCatalog({
    onImportSuccess: setStatusMessage,
  });
  const resolvedAioAreaSelectionShapeKind = useMemo<TypographyShapeKind>(() => {
    if (
      areaSelectionCreateMode === 'square' ||
      areaSelectionCreateMode === 'rounded'
    ) {
      return areaSelectionCreateMode;
    }
    return defaultBubbleTypographyPreset?.defaultShapeKind ?? 'rounded';
  }, [
    areaSelectionCreateMode,
    defaultBubbleTypographyPreset?.defaultShapeKind,
  ]);
  useEffect(() => {
    if (mode !== 'typesetter') return;
    if (!activeId || !activeTypographerSession) return;
    if (activeTypographerSession.activePresetId) return;
    if (!activeTypographerPreset?.id) return;
    typographerWorkspace.setActivePreset(activeId, activeTypographerPreset.id);
  }, [
    activeId,
    activeTypographerPreset?.id,
    activeTypographerSession,
    mode,
    typographerWorkspace,
  ]);
  useEffect(() => {
    if (!activeTypographerSession) {
      setTypographerQueueSelectedId(null);
      setTypographerSelectedSnapshotId(null);
      return;
    }
    if (
      !typographerQueueSelectedId ||
      !activeTypographerSession.queue.some(
        (item) => item.id === typographerQueueSelectedId,
      )
    ) {
      setTypographerQueueSelectedId(
        activeTypographerSession.queue[0]?.id ?? null,
      );
    }
    if (
      !typographerSelectedSnapshotId ||
      !activeTypographerSession.snapshots.some(
        (item) => item.id === typographerSelectedSnapshotId,
      )
    ) {
      setTypographerSelectedSnapshotId(
        activeTypographerSession.snapshots[0]?.id ?? null,
      );
    }
  }, [
    activeTypographerSession,
    setTypographerQueueSelectedId,
    setTypographerSelectedSnapshotId,
    typographerQueueSelectedId,
    typographerSelectedSnapshotId,
  ]);
  const areaSelectionToolActive =
    segmentEditTool === 'select' && manualImageTool === 'none';
  const isCleanerToolMode = mode === 'cleaner';
  const { selectCleanerAiModel, useExistingCleanerCustomProfile } =
    useCleanerModelSelection({
      cleanerAiOptionsForSelect,
      cleanStandaloneCustomProfiles,
    });

  const cleanerAiCustomProfilesManagerSection = (
    <CleanerAiCustomProfilesManagerSection
      cleanStandaloneCustomProfiles={cleanStandaloneCustomProfiles}
      cleanerAiCustomProviderNotice={cleanerAiCustomProviderNotice}
      llmProfilesPersistenceHint={llmProfilesPersistenceHint}
      loadCustomLlmDraftFromProfile={loadCustomLlmDraftFromProfile}
      updateCustomLlmDraft={updateCustomLlmDraft}
      useExistingCleanerCustomProfile={useExistingCleanerCustomProfile}
      resetCustomLlmDraft={resetCustomLlmDraft}
      removeCleanerCustomDraftProfile={removeCleanerCustomDraftProfile}
      saveCleanerCustomDraftProfile={saveCleanerCustomDraftProfile}
    />
  );
  const cleanerAiFreeProviderManagerSection = (
    <CleanerAiFreeProviderManagerSection
      cleanStandaloneCustomProfiles={cleanStandaloneCustomProfiles}
      getFreeProviderDraft={getFreeProviderDraft}
      getSelectedFreeProviderProfileLabel={getSelectedFreeProviderProfileLabel}
      updateFreeProviderDraft={updateFreeProviderDraft}
      saveFreeProviderProfile={saveFreeProviderProfile}
      testFreeProviderConfig={testFreeProviderConfig}
      testCustomProfileConfig={testCustomProfileConfig}
      saveCustomProfileInline={saveCustomProfileInline}
      removeCustomLlmProfileById={removeCustomLlmProfileById}
    />
  );

  // ── Tab definitions ──────────────────────────────────────────────
  const STAGE_TABS: StageTabDef[] = [
    {
      key: 'detectText',
      icon: ScanText,
      label: t('dashboard.stage.detectText.label'),
      shortLabel: t('dashboard.stage.detectText.short'),
    },
    {
      key: 'recognizeText',
      icon: Eye,
      label: t('dashboard.stage.recognizeText.label'),
      shortLabel: t('dashboard.stage.recognizeText.short'),
    },
    {
      key: 'getTranslations',
      icon: Languages,
      label: t('dashboard.stage.getTranslations.label'),
      shortLabel: t('dashboard.stage.getTranslations.short'),
    },
    {
      key: 'segmentText',
      icon: Replace,
      label: t('dashboard.stage.segmentText.label'),
      shortLabel: t('dashboard.stage.segmentText.short'),
    },
    {
      key: 'cleanImage',
      icon: Eraser,
      label: t('dashboard.stage.cleanImage.label'),
      shortLabel: t('dashboard.stage.cleanImage.short'),
    },
    {
      key: 'render',
      icon: Paintbrush,
      label: t('dashboard.stage.render.label'),
      shortLabel: t('dashboard.stage.render.short'),
    },
  ];

  const setActiveStageTab = useUiShellStore((s) => s.setActiveStageTab);

  useEffect(() => {
    if (subMode === 'manual' && activeManualProgress) {
      const currentStageKey =
        AIO_MANUAL_STAGE_ORDER[activeManualProgress.currentIndex];
      if (currentStageKey) {
        setActiveStageTab(currentStageKey as StageTabKey);
      }
    }
  }, [subMode, activeManualProgress?.currentIndex, setActiveStageTab]);

  const modeLabel = useMemo(() => modeLabels[mode], [mode, modeLabels]);
  const {
    userDisplayName,
    userDisplayEmail,
    emailVerificationRequired,
    ensureVerifiedEmailOrNotify,
    emitProcessStartWebhook,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    syncDiscordForTab,
  } = useDashboardUsageAndPresence({
    authUser,
    authLoading,
    user,
    mode,
    processing,
    activeImageFileName: activeImage?.file.name,
    imagesLength: images.length,
    translatorWorkspaceMode,
    srcLang,
    tgtLang,
    setStatusMessage,
    setDiscordPreset,
  });
  const {
    verifyEmailSending,
    handleSendVerificationEmail,
  } = useDashboardAccountSync({
    authUser,
    sendVerificationEmail,
    setStatusMessage,
    setUser,
  });

  const currentEmptyPreviewTip =
    emptyPreviewTips[emptyPreviewTipIndex % emptyPreviewTips.length];

  const updateModeTabsScroll = useCallback(() => {
    const node = modeTabsRef.current;
    if (!node) return;
    const maxLeft = node.scrollWidth - node.clientWidth;
    if (maxLeft <= 4) {
      setModeTabsScroll({ left: false, right: false, hasOverflow: false });
      return;
    }
    setModeTabsScroll({
      hasOverflow: true,
      left: node.scrollLeft > 4,
      right: node.scrollLeft < maxLeft - 4,
    });
  }, [setModeTabsScroll]);

  const handleStageWheelZoom = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      if (!event.ctrlKey) return;

      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const steps = Math.max(
        1,
        Math.min(6, Math.round(Math.abs(event.deltaY) / 100)),
      );
      setZoom((prev) =>
        clamp(prev + direction * ZOOM_STEP * steps, ZOOM_MIN, ZOOM_MAX),
      );
    },
    [setZoom],
  );

  useEffect(() => {
    void syncDiscordForTab();
  }, [syncDiscordForTab]);

  // AIO stage catalog / runtime / device / selection fallbacks (domain hooks)
  useAioStageCatalogBuild({
    customOcrStageOptions,
    customTranslationStageOptions,
    modelEntries: modelManagerState.entries,
  });
  useAioMiniBackendRuntimeSync();
  useAioDeviceInfoSync(apiConfig.localUrl);
  useAioStageSelectionFallbacks({
    availableDetectStageOptions,
    availableOcrStageOptions,
    availableTranslationStageOptions,
    availableSegmentStageOptions,
    availableCleanStageOptions,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    isInstalledLocalAioEntry,
  });

  useEffect(() => {
    if (
      cleanerAiOptionsForSelect.some(
        (option) => option.key === cleanerAiModelKey,
      )
    ) {
      return;
    }
    const fallback = cleanerAiOptionsForSelect[0]?.key ?? '';
    if (!fallback || fallback === cleanerAiModelKey) {
      return;
    }
    setCleanerAiModelKey(fallback);
  }, [cleanerAiModelKey, cleanerAiOptionsForSelect, setCleanerAiModelKey]);

  useEffect(() => {
    if (
      cleanerAiOptionsForSelect.some(
        (option) => option.key === translatorSfxCleanModelKey,
      )
    ) {
      return;
    }
    const fallback = cleanerAiOptionsForSelect[0]?.key ?? '';
    if (!fallback || fallback === translatorSfxCleanModelKey) {
      return;
    }
    setTranslatorSfxCleanModelKey(fallback);
  }, [cleanerAiOptionsForSelect, setTranslatorSfxCleanModelKey, translatorSfxCleanModelKey]);

  // ── Image Handlers ──
  const { getRootProps, getInputProps, isDragActive, onDrop } =
    useDashboardUploads({
      localApiUrl: apiConfig.localUrl,
      setStatusMessage,
      invalidateAioPipelineHistory,
    });

  const { handleTranslatorTextImport, handleTranslatorImageUpload } =
    useTranslatorImports({
      onDrop,
    });

  const { stitchAutoBatchIndexes, stitchBatchPlans, stitchSafeFileStem } =
    useStitchWorkspace();

  const {
    removeImage,
    registerDownloads,
    getPreviewSrc,
    optimizerSourceVariants,
  } = useDashboardImageCollection({
    downloadItems,
    setDownloadItems,
    setLastActionScope,
    invalidateAioPipelineHistory,
    setAioDetectionsByImage,
    setAioSelectedRegionByImage,
    setCleanerDetectionsByImage,
    setCleanerSelectedRegionByImage,
    setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage,
    setCleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage,
    setTranslatorDetectionsByImage,
    setTranslatorSelectedRegionByImage,
    setTranslatorRunMetaByImage,
    setTranslatorProcessedBaseByImage,
    aioManualImageEditsByImage,
    cleanerManualImageEditsByImage,
    cleanerProcessedBaseByImage,
    translatorProcessedBaseByImage,
  });

  useExportDownloadLifecycle();

  useEffect(() => {
    setMobileNavOpen(false);
    setUtilsMenuOpen(false);
  }, [mode]);

  useEffect(() => {
    updateModeTabsScroll();
    const node = modeTabsRef.current;
    if (!node) return undefined;

    const onScroll = () => updateModeTabsScroll();
    node.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      node.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [updateModeTabsScroll]);

  // ── Processing helpers ──

  const { updateTranslatorRegionsForImage, selectTranslatorRegionForImage } =
    useTranslatorRegionEditing();

  const {
    applyAioRegionsEditForImage,
    selectAioRegionForImage,
    updateAioRegionsForImage,
  } = useAioRegionSnapshotSync({
    getAioImageSnapshotIndex,
    syncManualStagePreviewToNextStage,
    typographerWorkspace,
  });

  const {
    applyActiveTypographyPresetToImage,
    applyActiveTypographyPresetToSelection,
    applyActiveRenderStyleToAllRegions,
    applyAutoDetectedShapeToActiveRegion,
    applyAutoDetectedShapeToRegionById,
    applyLegacyTypographyPresetToSelection,
    applyTypographyPresetToRegionById,
    clearAioRegionsForActiveImage,
    convertActiveTypographerShape,
    convertRegionShapeById,
    duplicateSelectedTypographerRegion,
    handleUpdateTypographyPreset,
    navigateActiveTypographerRegion,
    normalizeActiveTypographerShape,
    removeSelectedAioRegion,
    updateActiveRenderMode,
    updateActiveRenderRegion,
  } = useAioRegionEditing({
    activeId,
    activeSelectedRegionId,
    activeSelectedRegion,
    activeImage,
    activeSelectedRenderStyle,
    activeTypographerPreset,
    typographyPresetList,
    typographerWorkspace,
    applyAioRegionsEditForImage,
    selectAioRegionForImage,
    updateTranslatorRegionsForImage,
    updateCleanerRegionsForImage,
    translatorDetectionsByImage,
    cleanerDetectionsByImage,
    activeTranslatorSelectedRegionId,
    activeCleanerSelectedRegionId,
  });

  const {
    refineActiveTypographerShape,
    applySelectedTypographerQueueItem,
    applyNextTypographerQueueItem,
    handleTypographerDraftChange,
    handleTypographerBuildQueue,
    handleTypographerClearQueue,
    handleTypographerImportQueueText,
    handleTypographerToggleMultiBubble,
    handleTypographerPresetChange,
    handleTypographerSaveSnapshot,
    handleTypographerRestoreSnapshot,
  } = useTypographerControls({
    activeId,
    activeSelectedRegion,
    activeSelectedRegionId,
    activeTypographerSession,
    activeTypographerQueueItem,
    typographerWorkspace: {
      markQueueItem: typographerWorkspace.markQueueItem,
      setDraftText: typographerWorkspace.setDraftText,
      queueFromDraft: typographerWorkspace.queueFromDraft,
      clearQueue: typographerWorkspace.clearQueue,
      importQueueText: typographerWorkspace.importQueueText,
      toggleMultiBubble: typographerWorkspace.toggleMultiBubble,
      setActivePreset: typographerWorkspace.setActivePreset,
      saveSnapshot: typographerWorkspace.saveSnapshot,
      restoreSnapshot: typographerWorkspace.restoreSnapshot as (
        imageId: string,
        snapshotId: string,
      ) => { name: string; regions: AioTextRegion[]; selectedRegionId: string | null } | null,
    },
    normalizeActiveTypographerShape,
    updateActiveRenderRegion,
    applyAioRegionsEditForImage,
    multiSelectedRegionIds: activeTypographerMultiSelectedIds,
    activeRegions: activeId ? aioDetectionsByImage[activeId] ?? [] : [],
  });

  const { runCleanerMagicWandForImage, applyCleanerHealingMaskForImage } =
    useCleanerWandHealing({
      images,
      manualImageWandTolerance,
      localApiUrl: apiConfig.localUrl,
      setDownloadItems,
      setLastActionScope,
      patchCleanerManualImageEditState,
      resolveCleanerEditableBaseSourceForImage,
      composeCleanerEditableCanvas,
    });

  const {
    runAioMagicWandForImage,
    applyAioHealingMaskForImage,
    applyHealingFromActiveWandSelection,
  } = useAioWandHealing({
    images,
    manualImageWandTolerance,
    localApiUrl: apiConfig.localUrl,
    getAioManualImageEditState,
    patchAioManualImageEditState,
    resolveAioEditableBaseSourceForImage,
    composeAioEditableCanvas,
    getCleanerManualImageEditState,
    applyCleanerHealingMaskForImage,
  });

  const {
    isAioManualMode,
    activeStageAllowsAreaTools,
    activeStageAllowsSegmentTools,
    activeStageAllowsManualImageTools,
    tryShowHealingHint,
    manualImageToolHasConfig,
    toggleManualImageTool,
    toggleManualToolsConfig,
  } = useManualToolToggles({
    activeAioStageKey,
    activeCleanerDetections,
    resolvedActiveId,
  });

  const { renderAioImageToBlob } = useAioRegionRenderToBlob({
    composeAioEditableCanvas,
    downloadItems,
    outFormat,
    outQuality,
  });

  const { splitterController } = useUtilitySplitterController({
    workspaceRestoreToken,
    isDesktopRuntime,
    localApiBase: apiConfig.localUrl,
    registerDownloads,
    ensureVerifiedEmailOrNotify,
    recordProcessedPages,
  });
  const {
    currentSplitterWorkspaceState,
    currentWatermarkWorkspaceState,
    currentOptimizerWorkspaceState,
  } = useCurrentUtilityWorkspaceStates();

  const { prepareDownloadEntries, buildDownloadBundleBlob } =
    useDashboardDownloadBundle({
      typographerSessionsByImage: typographerWorkspace.sessionsByImage,
      renderAioImageToBlob: (img, regions) =>
        (renderAioImageToBlob as unknown as (
          img: LoadedImage,
          regions: AioTextRegion[],
        ) => Promise<Blob>)(img as unknown as LoadedImage, regions),
      composeCleanerEditableCanvas: (img, fallback) =>
        (composeCleanerEditableCanvas as unknown as (
          img: LoadedImage,
          fallback?: string,
        ) => Promise<HTMLCanvasElement>)(img as unknown as LoadedImage, fallback),
      composeAioEditableCanvas: (img, fallback) =>
        (composeAioEditableCanvas as unknown as (
          img: LoadedImage,
          fallback?: string,
        ) => Promise<HTMLCanvasElement>)(img as unknown as LoadedImage, fallback),
      hasCleanerManualImageEdits,
      hasAioManualImageEdits,
      getAioDownloadItemForImage,
      resolveAioStageKeyForImage,
    });

  const { handleDownload } = useDashboardDownloadActions({
    prepareDownloadEntries,
    buildDownloadBundleBlob,
    triggerBlobDownload,
    setDownloadMenuOpen,
  });

  const handleDownloadPsd = useDashboardPsdDownload({
    activeImage,
    localApiUrl: apiConfig.localUrl,
    setDownloadMenuOpen,
    triggerBlobDownload,
    resolveAioStageKeyForImage,
    getAioDownloadItemForImage,
    hasAioManualImageEdits,
    composeAioEditableCanvas,
    setTypographerSessionSourceType: typographerWorkspace.setSessionSourceType,
  });

  // ── Processing Functions ──

  const handleClean = useCleanerActions({
    images,
    activeImage,
    localApiUrl: apiConfig.localUrl,
    detectSelectionKey: aioStageSelection.detectText,
    ocrSelectionKey: aioStageSelection.recognizeText,
    segmentSelectionKey: aioStageSelection.segmentText,
    cleanSelectionKey: aioStageSelection.cleanImage,
    cleanerMode,
    cleanerAiModelKey,
    selectedCleanerCustomProfile,
    cleanerAiAdditionalInstructions,
    sourceLanguage: aioSrcLang,
    llmSettings,
    maskDilation: aioMaskDilation,
    hdStrategy: aioHdStrategy,
    hdResizeLimit: aioHdResizeLimit,
    hdCropMargin: aioHdCropMargin,
    hdCropTriggerSize: aioHdCropTriggerSize,
    effectiveBatchConcurrency,
    minRegionSize: MIN_REGION_SIZE,
    modelEntries: modelManagerState.entries,
    selectedCustomOcrProfile,
    discord,
    ensureVerifiedEmailOrNotify,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
    getAioStageOption,
    parseApiError,
    registerDownloads: (items) => registerDownloads(items, 'cleaner'),
    recordProcessedPages,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessCompleteWebhook: (name, pages, context) =>
      emitProcessCompleteWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessErrorWebhook: (name, pages, error, context) =>
      emitProcessErrorWebhook(name, pages, error, (context as WebhookMetrics) ?? {}),
    syncDiscordForTab,
    setCleanerDetectionsByImage,
    setCleanerSelectedRegionByImage,
    setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage,
    setCleanerManualImageEditsByImage,
    cleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    setRuntimeExecutionNotice,
    onRunComplete: () => setCleanerShowOverlays(false),
  });

  const installSelectedEnhanceModel = useEnhanceInstallAction({
    selectedEnhanceModel,
    installTranslationModel,
    refreshModelState,
  });

  const { importSelectedEnhanceModel, processEnhance } =
    useDashboardEnhanceActions({
      isDesktopRuntime,
      localApiUrl: apiConfig.localUrl,
      selectedEnhanceModel,
      selectedEnhanceInstallState,
      ensureVerifiedEmailOrNotify,
      emitProcessStartWebhook,
      emitProcessCompleteWebhook,
      emitProcessErrorWebhook,
      registerDownloads,
      recordProcessedPages,
      syncDiscordForTab,
      discord,
      effectiveBatchConcurrency,
      importOnnxModelFromStorage,
      refreshModelState,
    });

  const {
    setManualStageForActiveImage,
    executeManualStageForActiveImage,
    skipManualStageForActiveImage,
    handleExecuteManualAioStage,
  } = useAioManualExecution({
    aioDetectionsByImage,
    aioSelectedRegionByImage,
    renderDefaultStyle,
    getAioManualImageEditState,
    applyAioPipelineSnapshotToImage,
    syncManualStagePreviewToNextStage,
    patchAioSnapshotStageForImage,
    validateManualLocalStageModel,
    getAioStageOption,
    recordProcessedPages,
    syncDiscordForTab,
    beginAioExecution,
    updateAioExecutionStage,
    localApiUrl: apiConfig.localUrl,
    modelEntries: modelManagerState.entries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    activeManualProgress,
    resolvedActiveId,
  });

  const { processAIO } = useAioPipelineExecution({
    renderDefaultStyle,
    isDesktopRuntime,
    localApiUrl: apiConfig.localUrl,
    effectiveBatchConcurrency,
    modelEntries: modelManagerState.entries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    aioPipelineStageProgressLabels,
    setAioDetectionsByImage,
    setAioSelectedRegionByImage,
    setAioDownloadItems,
    setAioManualImageEditsByImage,
    setAioManualHealingBusyByImage,
    getAioStageOption,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    refreshSession,
    getAuthToken,
    buildAioImageSnapshotIndexMap,
    emitProcessStartWebhook,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    ensureVerifiedEmailOrNotify,
    recordProcessedPages,
    syncDiscordForTab,
    tryShowHealingHint,
    beginAioExecution,
    updateAioExecutionStage,
  });

  const {
    resolveTranslatorTranslationExecution,
    resolveTranslatorOcrExecution,
  } = useTranslatorExecutionResolvers({
    modelEntries: modelManagerState.entries,
    translationStageOptionsForSelect,
    translatorOcrStageOptionsForSelect,
    selectedCustomTranslationProfile,
    selectedCustomOcrProfile,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
  });

  const runTranslatorText = useTranslatorTextActions({
    localApiUrl: apiConfig.localUrl,
    selectedCustomTranslationProfile,
    ensureVerifiedEmailOrNotify,
    resolveTranslatorTranslationExecution,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessCompleteWebhook: (name, pages, context) =>
      emitProcessCompleteWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessErrorWebhook: (name, pages, error, context) =>
      emitProcessErrorWebhook(name, pages, error, (context as WebhookMetrics) ?? {}),
    setDiscordTranslating,
    syncDiscordForTab,
    recordProcessedPages,
    setLastActionScope,
  });

  const processTranslatorVisual = useTranslatorVisualActions({
    images,
    activeTranslatorSelectedRegionId,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    selectedTranslatorSfxCleanCustomProfile,
    ensureVerifiedEmailOrNotify,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
    resolveTranslatorOcrExecution,
    resolveTranslatorTranslationExecution,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessCompleteWebhook: (name, pages, context) =>
      emitProcessCompleteWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessErrorWebhook: (name, pages, error, context) =>
      emitProcessErrorWebhook(name, pages, error, (context as WebhookMetrics) ?? {}),
    setDiscordTranslating,
    syncDiscordForTab,
    recordProcessedPages,
    setLastActionScope,
    localApiUrl: apiConfig.localUrl,
  });

  const retranslateTranslatorRegions = useTranslatorRetranslate({
    images,
    activeTranslatorSelectedRegionId,
    localApiUrl: apiConfig.localUrl,
    selectedCustomTranslationProfile,
    ensureVerifiedEmailOrNotify,
    resolveTranslatorTranslationExecution,
    setDiscordTranslating,
    syncDiscordForTab,
    recordProcessedPages,
    updateTranslatorRegionsForImage,
    setLastActionScope,
  });

  const {
    workspaceHistory,
    exportCurrentWorkspace,
    importWorkspaceFile,
    closeWorkspace,
    handleWorkspaceUndo,
    handleWorkspaceRedo,
    handleWorkspaceManualSave,
  } = useWorkspacePersistence({
    authUser,
    typographerWorkspace,
    currentSplitterWorkspaceState,
    currentWatermarkWorkspaceState,
    currentOptimizerWorkspaceState,
    freeProviderDrafts,
    setFreeProviderDrafts,
  });

  const handleModeChange = useCallback(
    (newMode: ToolMode) => {
      if (isModeUnderDevelopment(newMode)) {
        setTonedStatus(
          t('dashboard.status.underDevelopment', {
            mode: modeLabels[newMode],
            tooltip: underDevelopmentTooltip,
          }),
          'error',
        );
        return;
      }
      setMode(newMode);
      if (newMode === 'typesetter') {
        setSubMode('manual');
      }
      setMobileNavOpen(false);
      setMobileToolsOpen(false);
      setUtilsMenuOpen(false);
      setDownloadMenuOpen(false);
      if (!INFO_MODES.includes(newMode)) {
        setStatusMessage(
          t('dashboard.status.modeChanged', {
            mode: modeLabels[newMode],
          }),
        );
      }
    },
    [
      modeLabels,
      setMode,
      setStatusMessage,
      setSubMode,
      setTonedStatus,
      t,
      underDevelopmentTooltip,
    ],
  );

  useDashboardKeyboard({
    activeId,
    activeSelectedRegion,
    aioSteps,
    currentManualSelectedRegionId,
    shortcutCenterOpen,
    translatorWorkspaceMode,
    handleModeChange,
    handleToolsToggle,
    openShortcutCenter,
    handleWorkspaceManualSave,
    handleWorkspaceRedo,
    handleWorkspaceUndo,
    clearAioRegionsForActiveImage,
    removeSelectedAioRegion,
    applyActiveTypographyPresetToSelection,
    applyAutoDetectedShapeToActiveRegion,
    applyLegacyTypographyPresetToSelection,
    applySelectedTypographerQueueItem,
    convertActiveTypographerShape,
    duplicateSelectedTypographerRegion,
    handleTypographerSaveSnapshot,
    handleTypographerToggleMultiBubble,
    navigateActiveTypographerRegion,
    refineActiveTypographerShape,
    clearAioManualPaintForImage,
    resetAioManualImageEditsForImage,
    toggleManualImageTool,
    toggleManualToolsConfig,
    setSegmentEditTool,
    setManualImageTool,
    setManualToolsConfigOpen,
    clearCleanerManualPaintForImage,
    resetCleanerManualImageEditsForImage,
    rotateImage,
  });

  const { specialModeStageProps } = useSpecialModeStageProps({
    stitchBatchPlans,
    stitchSafeFileStem,
    splitterController,
    ensureVerifiedEmailOrNotify,
    registerDownloads,
    recordProcessedPages,
    optimizerSourceVariants,
    translatorImageImportRef,
    isDesktopRuntime,
    currentWatermarkWorkspaceState,
    currentOptimizerWorkspaceState,
  });

  // ── Render Helpers ──
  const {
    hasDownloadActions,
    hasDownloads,
    activeDownloadScope,
    canExportAioMetadata,
    hasInpaintedOutputs,
    canExportPsd,
    hasAioRenderRegionsForPsd,
  } = useExportDownloadAvailability({ activeImage });

  const { replayTour } = useDashboardTour({
    userId: authUser?.id ?? null,
    isReady: !authLoading,
    mode,
    subMode,
    activeId,
    firstImageId: images[0]?.id ?? null,
    hasImages: images.length > 0,
    hasDownloadActions,
    isCompactViewport,
    toolsPanelVisible,
    setMode,
    setSubMode,
    setActiveId,
    setToolsPanelVisible,
    setForcedDropdown: setForcedTourDropdown,
  });
  useDashboardModeCoachmarks({
    userId: authUser?.id ?? null,
    isReady: !authLoading,
    mode,
    subMode,
    hasImages: images.length > 0,
    hasDownloadActions,
    isCompactViewport,
  });
  const canEditActiveRenderStage =
    activeImageRenderStageActive &&
    subMode === 'manual' &&
    Boolean(activeSelectedRegion);
  const areaSelectionToolHasConfig =
    activeStageAllowsAreaTools && areaSelectionToolActive;
  const segmentToolHasConfig =
    activeStageAllowsSegmentTools &&
    (segmentEditTool === 'brush' || segmentEditTool === 'eraser');
  const manualToolHasConfigActiveStage =
    activeStageAllowsManualImageTools && manualImageToolHasConfig;
  const activeDockToolHasConfig =
    areaSelectionToolHasConfig ||
    segmentToolHasConfig ||
    manualToolHasConfigActiveStage;
  const manualDockVisible =
    (isAioManualMode || isCleanerToolMode) &&
    Boolean(resolvedActiveId) &&
    !isCompactViewport;
  const manualDockRightOffset =
    !isCompactViewport && !toolsPanelCollapsed ? 326 : 16;
  const manualToolsConfigVisible =
    manualDockVisible && manualToolsConfigOpen && activeDockToolHasConfig;
  const activeHasManualEdits =
    activeHasManualPaintLayer ||
    activeHasManualBaseOverride ||
    activeHasManualWandSelection;
  const activeDockRegionsCount =
    mode === 'cleaner'
      ? activeCleanerDetections.length
      : activeImageDetections.length;
  const manualToolsConfigTitle = areaSelectionToolHasConfig
    ? t('dashboard.status.toolSelectArea')
    : segmentToolHasConfig
      ? segmentEditTool === 'brush'
        ? t('dashboard.status.toolSegmentBrush')
        : t('dashboard.status.toolSegmentEraser')
      : manualToolHasConfigActiveStage
        ? manualImageTool === 'paint'
          ? 'Pincel'
          : manualImageTool === 'paint_eraser'
            ? 'Borracha'
            : manualImageTool === 'magic_wand'
              ? 'Varinha'
              : 'Healing'
        : 'Ferramenta';
  useEffect(() => {
    if (!activeDockToolHasConfig && manualToolsConfigOpen) {
      setManualToolsConfigOpen(false);
    }
  }, [activeDockToolHasConfig, manualToolsConfigOpen, setManualToolsConfigOpen]);

  const translationNotesEnabled = llmSettings.translation_notes_enabled;
  // ══════════════ RENDER ══════════════
  return (
    <DashboardMainLayout
      // ── Stage section (page-derived values forwarded to StageGrid) ──
      resolvedActiveId={resolvedActiveId}
      resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
      areaSelectionToolActive={areaSelectionToolActive}
      textFillSwatches={textFillSwatches}
      typographyPresetList={typographyPresetList}
      typographyFolderList={typographyFolderList}
      translationNotesEnabled={translationNotesEnabled}
      currentEmptyPreviewTip={currentEmptyPreviewTip}
      handleStageWheelZoom={handleStageWheelZoom}
      specialModeStageProps={specialModeStageProps}
      onOpenSettings={onOpenSettings}
      onOpenModelRankings={onOpenModelRankings}
      onOpenScanlationFeed={onOpenScanlationFeed}
      translatorTextImportRef={translatorTextImportRef}
      translatorImageImportRef={translatorImageImportRef}
      fontCatalogInputRef={fontCatalogInputRef}
      desktopSidebarToggleRef={desktopSidebarToggleRef}
      topbarSidebarRevealRef={topbarSidebarRevealRef}
      desktopToolsToggleRef={desktopToolsToggleRef}
      topbarToolsRevealRef={topbarToolsRevealRef}
      runTranslatorText={runTranslatorText}
      handleTranslatorTextImport={handleTranslatorTextImport}
      handleTranslatorImageUpload={handleTranslatorImageUpload}
      getPreviewSrc={getPreviewSrc}
      typographerWorkspace={typographerWorkspace}
      getAioImageSnapshotMeta={getAioImageSnapshotMeta}
      getAioFallbackStageKey={getAioFallbackStageKey}
      getAioDownloadItemForImage={getAioDownloadItemForImage}
      rewindAioPipelineForImage={rewindAioPipelineForImage}
      forwardAioPipelineForImage={forwardAioPipelineForImage}
      selectAioRegionForImage={selectAioRegionForImage}
      updateAioRegionsForImage={updateAioRegionsForImage}
      selectCleanerRegionForImage={selectCleanerRegionForImage}
      updateCleanerRegionsForImage={updateCleanerRegionsForImage}
      selectTranslatorRegionForImage={selectTranslatorRegionForImage}
      updateTranslatorRegionsForImage={updateTranslatorRegionsForImage}
      getAioManualImageEditState={getAioManualImageEditState}
      patchAioManualImageEditState={patchAioManualImageEditState}
      getCleanerManualImageEditState={getCleanerManualImageEditState}
      patchCleanerManualImageEditState={patchCleanerManualImageEditState}
      runAioMagicWandForImage={runAioMagicWandForImage}
      applyAioHealingMaskForImage={applyAioHealingMaskForImage}
      runCleanerMagicWandForImage={runCleanerMagicWandForImage}
      applyCleanerHealingMaskForImage={applyCleanerHealingMaskForImage}
      refineActiveTypographerShape={refineActiveTypographerShape}
      applyAutoDetectedShapeToActiveRegion={applyAutoDetectedShapeToActiveRegion}
      applyAutoDetectedShapeToRegionById={applyAutoDetectedShapeToRegionById}
      applyTypographyPresetToRegionById={applyTypographyPresetToRegionById}
      convertRegionShapeById={convertRegionShapeById}
      handleModeChange={handleModeChange}
      handleKeyboardShortcutConfigChange={handleKeyboardShortcutConfigChange}
      isDesktopRuntime={isDesktopRuntime}
      // ── Shell layout (hook-local state) ──
      mobileNavOpen={mobileNavOpen}
      setMobileNavOpen={setMobileNavOpen}
      mobileSidebarOpen={mobileSidebarOpen}
      setMobileSidebarOpen={setMobileSidebarOpen}
      mobileToolsOpen={mobileToolsOpen}
      setMobileToolsOpen={setMobileToolsOpen}
      desktopSidebarCollapsed={desktopSidebarCollapsed}
      toolsPanelCollapsed={toolsPanelCollapsed}
      setToolsPanelCollapsed={setToolsPanelCollapsed}
      leftSidebarWidth={leftSidebarWidth}
      rightSidebarWidth={rightSidebarWidth}
      isCompactViewport={isCompactViewport}
      toolsPanelVisible={toolsPanelVisible}
      toggleDesktopSidebar={toggleDesktopSidebar}
      toggleDesktopToolsPanel={toggleDesktopToolsPanel}
      startSidebarResize={startSidebarResize}
      resizeLeftSidebarBy={resizeLeftSidebarBy}
      resizeRightSidebarBy={resizeRightSidebarBy}
      resetLeftSidebarWidth={resetLeftSidebarWidth}
      resetRightSidebarWidth={resetRightSidebarWidth}
      handleToolsToggle={handleToolsToggle}
      // ── Sidebar / uploads / collection hooks ──
      processingStats={processingStats}
      getRootProps={getRootProps}
      getInputProps={getInputProps}
      isDragActive={isDragActive}
      removeImage={removeImage}
      activeImage={activeImage}
      activeTypographerSession={activeTypographerSession}
      activeTypographerPreset={activeTypographerPreset}
      activeTypographerMultiSelectedIds={activeTypographerMultiSelectedIds}
      modeLabel={modeLabel}
      handleTypographerMultiSelectReorder={handleTypographerMultiSelectReorder}
      // ── Workspace persistence ──
      workspaceHistory={workspaceHistory}
      handleWorkspaceUndo={handleWorkspaceUndo}
      handleWorkspaceRedo={handleWorkspaceRedo}
      exportCurrentWorkspace={exportCurrentWorkspace}
      importWorkspaceFile={importWorkspaceFile}
      closeWorkspace={closeWorkspace}
      // ── Export / download ──
      hasDownloadActions={hasDownloadActions}
      hasDownloads={hasDownloads}
      activeDownloadScope={activeDownloadScope}
      canExportAioMetadata={canExportAioMetadata}
      hasInpaintedOutputs={hasInpaintedOutputs}
      canExportPsd={canExportPsd}
      hasAioRenderRegionsForPsd={hasAioRenderRegionsForPsd}
      handleDownload={handleDownload}
      handleDownloadPsd={handleDownloadPsd}
      // ── Auth / account ──
      authUser={authUser}
      logout={logout}
      userDisplayName={userDisplayName}
      userDisplayEmail={userDisplayEmail}
      emailVerificationRequired={emailVerificationRequired}
      verifyEmailSending={verifyEmailSending}
      handleSendVerificationEmail={handleSendVerificationEmail}
      replayTour={replayTour}
      // ── External actions ──
      openShortcutCenter={openShortcutCenter}
      shortcutCenterOpen={shortcutCenterOpen}
      closeShortcutCenter={closeShortcutCenter}
      bugReportModalOpen={bugReportModalOpen}
      setBugReportModalOpen={setBugReportModalOpen}
      openBugReportModal={openBugReportModal}
      openProjectExternalLink={openProjectExternalLink}
      projectDiscordUrl={projectDiscordUrl}
      projectWebsiteUrl={projectWebsiteUrl}
      openSettingsOnPresetsTab={openSettingsOnPresetsTab}
      // ── Footer / dock derivations ──
      aioFooterProcessingLabel={aioFooterProcessingLabel}
      manualDockVisible={manualDockVisible}
      manualDockRightOffset={manualDockRightOffset}
      manualToolsConfigVisible={manualToolsConfigVisible}
      manualToolsConfigTitle={manualToolsConfigTitle}
      areaSelectionToolHasConfig={areaSelectionToolHasConfig}
      activeDockToolHasConfig={activeDockToolHasConfig}
      activeDockRegionsCount={activeDockRegionsCount}
      isAioManualMode={isAioManualMode}
      activeStageAllowsAreaTools={activeStageAllowsAreaTools}
      activeStageAllowsSegmentTools={activeStageAllowsSegmentTools}
      activeStageAllowsManualImageTools={activeStageAllowsManualImageTools}
      activeSelectedRegion={activeSelectedRegion}
      duplicateSelectedTypographerRegion={duplicateSelectedTypographerRegion}
      convertActiveTypographerShape={convertActiveTypographerShape}
      clearAioRegionsForActiveImage={clearAioRegionsForActiveImage}
      applyHealingFromActiveWandSelection={applyHealingFromActiveWandSelection}
      clearManualWandSelection={clearManualWandSelection}
      toggleManualToolsConfig={toggleManualToolsConfig}
      toggleManualImageTool={toggleManualImageTool}
      clearCleanerManualPaintForImage={clearCleanerManualPaintForImage}
      clearAioManualPaintForImage={clearAioManualPaintForImage}
      resetCleanerManualImageEditsForImage={resetCleanerManualImageEditsForImage}
      resetAioManualImageEditsForImage={resetAioManualImageEditsForImage}
      activeHasManualWandSelection={activeHasManualWandSelection}
      activeManualHealingBusy={activeManualHealingBusy}
      activeHasManualPaintLayer={activeHasManualPaintLayer}
      activeHasManualEdits={activeHasManualEdits}
      handleAioSubModeChange={handleAioSubModeChange}
      // ── AIO right panel ──
      rewindAioPipeline={rewindAioPipeline}
      forwardAioPipeline={forwardAioPipeline}
      setManualStageForActiveImage={setManualStageForActiveImage}
      executeManualStageForActiveImage={executeManualStageForActiveImage}
      skipManualStageForActiveImage={skipManualStageForActiveImage}
      handleExecuteManualAioStage={handleExecuteManualAioStage}
      activeManualStageStatus={activeManualStageStatus}
      aioPipelineStageLabels={aioPipelineStageLabels}
      stopAioExecution={stopAioExecution}
      processAIO={processAIO}
      aioExecuteButtonProcessingLabel={aioExecuteButtonProcessingLabel}
      normalizedAioSourceLanguage={normalizedAioSourceLanguage}
      presetsForCurrentLanguage={presetsForCurrentLanguage}
      activePresetForCurrentLanguage={activePresetForCurrentLanguage}
      presetEditorStageOptions={presetEditorStageOptions}
      aioPresetEditorOpen={aioPresetEditorOpen}
      aioPresetEditorDraft={aioPresetEditorDraft}
      setAioPresetEditorDraft={setAioPresetEditorDraft}
      handlePresetSelectionChange={handlePresetSelectionChange}
      openCreatePresetEditor={openCreatePresetEditor}
      openEditPresetEditor={openEditPresetEditor}
      closePresetEditor={closePresetEditor}
      handleDeleteActivePreset={handleDeleteActivePreset}
      handleSaveCurrentSelectionAsPreset={handleSaveCurrentSelectionAsPreset}
      handleSavePresetEditor={handleSavePresetEditor}
      availableDetectStageOptions={availableDetectStageOptions}
      availableOcrStageOptions={availableOcrStageOptions}
      availableTranslationStageOptions={availableTranslationStageOptions}
      availableSegmentStageOptions={availableSegmentStageOptions}
      availableCleanStageOptions={availableCleanStageOptions}
      selectedDetectModel={selectedDetectModel}
      selectedOcrModel={selectedOcrModel}
      selectedSegmentModel={selectedSegmentModel}
      selectedCleanModel={selectedCleanModel}
      formatAioStageOptionLabel={formatAioStageOptionLabel}
      resolveLocalModelFocusForStage={resolveLocalModelFocusForStage}
      selectAioLocalStageModel={selectAioLocalStageModel}
      selectAioRecognizeTextModel={selectAioRecognizeTextModel}
      selectedDetectStatusText={selectedDetectStatusText}
      selectedOcrStatusText={selectedOcrStatusText}
      selectedSegmentStatusText={selectedSegmentStatusText}
      selectedCleanStatusText={selectedCleanStatusText}
      openModelManagerForStage={openModelManagerForStage}
      modelManagerState={modelManagerState}
      modelSummary={modelSummary}
      selectedTranslationModelState={selectedTranslationModelState}
      selectedCustomTranslationProfile={selectedCustomTranslationProfile}
      selectedLegacyTranslationOption={selectedLegacyTranslationOption}
      aioStageLabels={aioStageLabels}
      STAGE_TABS={STAGE_TABS}
      showLlmSettingsPanel={showLlmSettingsPanel}
      llmSettingsSupportSummary={llmSettingsSupportSummary}
      activeImageDetections={activeImageDetections}
      activeSelectedTranslationNotes={activeSelectedTranslationNotes}
      activeSelectedRenderMode={activeSelectedRenderMode}
      activeSelectedResolvedRenderMode={activeSelectedResolvedRenderMode}
      updateActiveRenderMode={updateActiveRenderMode}
      removeSelectedAioRegion={removeSelectedAioRegion}
      canEditActiveRenderStage={canEditActiveRenderStage}
      applyActiveRenderStyleToAllRegions={applyActiveRenderStyleToAllRegions}
      activeImageRenderStageActive={activeImageRenderStageActive}
      loadRenderFontCatalog={loadRenderFontCatalog}
      fontCatalogLoading={fontCatalogLoading}
      fontCatalogImporting={fontCatalogImporting}
      fontCatalogError={fontCatalogError}
      handleRenderFontImport={handleRenderFontImport}
      renderFontRefreshToken={renderFontRefreshToken}
      availableRenderFonts={availableRenderFonts}
      // ── Cleaner / translator / typographer panels ──
      cleanerAiOptionsForSelect={cleanerAiOptionsForSelect}
      cleanerAvailableOcrStageOptions={cleanerAvailableOcrStageOptions}
      cleanerAvailableSegmentStageOptions={cleanerAvailableSegmentStageOptions}
      cleanerAvailableCleanStageOptions={cleanerAvailableCleanStageOptions}
      selectedOcrCloudOption={selectedOcrCloudOption}
      selectedCleanerAiDisplayOption={selectedCleanerAiDisplayOption}
      selectCleanerAiModel={selectCleanerAiModel}
      handleClean={handleClean}
      activeCleanerRunMeta={activeCleanerRunMeta}
      activeCleanerSelectedRegion={activeCleanerSelectedRegion}
      translatorAvailableOcrStageOptions={translatorAvailableOcrStageOptions}
      selectedTranslatorOcrCloudOption={selectedTranslatorOcrCloudOption}
      translatorSelectedLocalTranslationCompatible={translatorSelectedLocalTranslationCompatible}
      selectedTranslatorSfxCleanDisplayOption={selectedTranslatorSfxCleanDisplayOption}
      selectTranslatorSfxCleanModel={selectTranslatorSfxCleanModel}
      processTranslatorVisual={processTranslatorVisual}
      retranslateTranslatorRegions={retranslateTranslatorRegions}
      activeTranslatorImageDetections={activeTranslatorImageDetections}
      activeTranslatorSelectedRegion={activeTranslatorSelectedRegion}
      activeTranslatorSelectedTranslationNotes={activeTranslatorSelectedTranslationNotes}
      applyActiveTypographyPresetToSelection={applyActiveTypographyPresetToSelection}
      applyActiveTypographyPresetToImage={applyActiveTypographyPresetToImage}
      handleTypographerPresetChange={handleTypographerPresetChange}
      handleTypographerSaveSnapshot={handleTypographerSaveSnapshot}
      handleTypographerRestoreSnapshot={handleTypographerRestoreSnapshot}
      handleTypographerDraftChange={handleTypographerDraftChange}
      handleTypographerBuildQueue={handleTypographerBuildQueue}
      handleTypographerClearQueue={handleTypographerClearQueue}
      applySelectedTypographerQueueItem={applySelectedTypographerQueueItem}
      applyNextTypographerQueueItem={applyNextTypographerQueueItem}
      handleTypographerToggleMultiBubble={handleTypographerToggleMultiBubble}
      handleTypographerImportQueueText={handleTypographerImportQueueText}
      handleUpdateTypographyPreset={handleUpdateTypographyPreset}
      // ── Utility / enhance panels ──
      stitchBatchPlans={stitchBatchPlans}
      stitchAutoBatchIndexes={stitchAutoBatchIndexes}
      splitterController={splitterController}
      selectedEnhanceModel={selectedEnhanceModel}
      selectedEnhanceInstallState={selectedEnhanceInstallState}
      filteredEnhanceModels={filteredEnhanceModels}
      setEnhanceModelManagerOpen={setEnhanceModelManagerOpen}
      importSelectedEnhanceModel={importSelectedEnhanceModel}
      installSelectedEnhanceModel={installSelectedEnhanceModel}
      processEnhance={processEnhance}
      // ── Model managers modal ──
      activeModelManagerStage={activeModelManagerStage}
      ocrStageOptionsForSelect={ocrStageOptionsForSelect}
      installAllSummary={installAllSummary}
      translationFreeProviderManagerSection={translationFreeProviderManagerSection}
      ocrFreeProviderManagerSection={ocrFreeProviderManagerSection}
      translationCustomProfilesManagerSection={translationCustomProfilesManagerSection}
      ocrCustomProfilesManagerSection={ocrCustomProfilesManagerSection}
      cleanerAiFreeProviderManagerSection={cleanerAiFreeProviderManagerSection}
      cleanerAiCustomProfilesManagerSection={cleanerAiCustomProfilesManagerSection}
      setModelModalLanguageFilter={setModelModalLanguageFilter}
      installTranslationModel={installTranslationModel}
      updateTranslationModel={updateTranslationModel}
      uninstallTranslationModel={uninstallTranslationModel}
      retryTranslationModel={retryTranslationModel}
      cancelTranslationModel={cancelTranslationModel}
      installAllTranslationModels={installAllTranslationModels}
      cancelAllTranslationModels={cancelAllTranslationModels}
      checkModelUpdatesNow={checkModelUpdatesNow}
      closeModelManagerForStage={closeModelManagerForStage}
      enhanceModelManagerOpen={enhanceModelManagerOpen}
      refreshModelState={refreshModelState}
    />
  );
};

export default DashboardPage;
