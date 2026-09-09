'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Languages,
  Bookmark,
  Box,
  Plus,
  Pencil,
  Save,
  ExternalLink,
  ArrowRight,
  X,
  Settings,
  Trash2,
  AlertTriangle,
  SkipBack,
  SkipForward,
  Zap,
  Eraser,
  Eye,
  ScanText,
  Replace,
  Paintbrush,
  Info,
} from 'lucide-react';
import { AioSection } from './AioSection';
import { AioPipelineChip } from './AioPipelineChip';
import { AioTimelineStep } from './AioTimelineStep';
import {
  AioStageTabBar,
  type StageTabKey,
  type StageTabDef,
} from './AioStageTabBar';
import { v4 as uuidv4 } from 'uuid';
import { getApiConfig } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import {
  useDashboardTour,
  type DashboardTourForcedDropdown,
} from '../hooks/useDashboardTour';
import { useDashboardModeCoachmarks } from '../hooks/useDashboardModeCoachmarks';
import { useDiscordRPC } from '../hooks/useDiscordRPC';
import { useModelManager } from '../hooks/useModelManager';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import {
  listTextFillSwatches,
  loadTextFillSwatchState,
} from '../utils/textFillPicker';
import {
  buildMagicWandMaskDataUrl,
  blobToDataUrl,
  buildDefaultRegionRenderText,
  buildTranslationNoteOverlayRegions,
  clamp,
  buildAioSelectionMapFromDetections,
  cloneAioDownloadEntries,
  cloneAioDetectionsMap,
  cloneAioRegion,
  cloneAioRegions,
  cn,
  dataUrlToBlob,
  getRotatedDims,
  loadImageFromSource,
  areAioRegionsEqual,
  applyRenderDefaultsToRegion,
  canvasToBlob,
  cloneRenderStyle,
  applyDetectedGradientToStyle,
  toFreeProviderDraftKey,
  ensureCanvasFontLoaded,
  copyTextToClipboardSafe,
  normalizeRegion,
  normalizePresetLanguage,
  parseResponseErrorMessage,
  getRegionTranslationNotesForDisplay,
  rebuildRegionShapeForAutoMode,
  rebuildRegionShapeForKind,
  rebuildRegionShapeForRefinement,
  resolveSelectedRegionForRegions,
  resolveRegionShapeKind,
  scaleTypographyShapeForBounds,
} from '../utils/dashboard.utils';
import {
  buildAioStageCatalog,
  buildCustomStageOption,
  DEFAULT_AIO_STAGE_OPTIONS,
  ocrStageOptionSupportsLanguage,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  type AioLanguageOption,
  type AioStageOption,
  type AioStageOptionMap,
  type AioDeviceInfo,
} from '../models/aioStageCatalog';
import type { DesktopMiniBackendRuntimeState } from '../types';
import { useI18n } from '../i18n';
import {
  ENHANCE_IMAGE_MODELS_REGISTRY,
  TRANSLATION_MODELS_BY_ID,
  modelSupportsLanguage,
} from '../models/translation-models-registry';
import { importOnnxModelFromStorage } from '../models/model-storage';
import {
  clampLlmRequestSettings,
  createEmptyCustomLlmDraft,
  findCustomProfileForSelection,
  FULL_LLM_CAPABILITIES,
  getCustomLlmProviderNotice,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  inferCustomLlmTransport,
  isCustomModelSelectionKey,
  loadCustomLlmProfiles,
  loadPersistedLlmSettings,
  parseFreeProviderProfileId,
  persistLlmSettings,
  toCustomModelSelectionKey,
  toFreeProviderProfileId,
  OLLAMA_LOCAL_API_BASE,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
  type LlmRequestSettings,
} from '../utils/customLlm';
import {
  BATCH_THREADS_COUNT_STORAGE_KEY,
  BATCH_THREADS_ENABLED_STORAGE_KEY,
  clampBatchThreads,
  DEFAULT_BATCH_THREADS,
  normalizeBatchConcurrency,
  parseStoredBatchThreads,
  parseStoredBatchThreadsEnabled,
  runConcurrentBatch,
} from '../utils/concurrentBatch';
import {
  loadWorkspaceAutosaveSettings,
  type WorkspaceAutosaveSettings,
} from '../utils/workspaceAutosaveSettings';
import type {
  AioModelPresetStateV2,
  AioStageKey,
  AioStageSelection,
} from '../types/aioModelPresets';
import type {
  AioDownloadEntry,
  AioManualImageEditState,
  AioManualImageProgress,
  AioManualStageStatus,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
  AreaSelectionCreateMode,
  CleanerMode,
  CleanerRunMeta,
  DashboardPageProps,
  DashboardUser,
  DownloadItem,
  EnhanceProfile,
  EnhanceScale,
  FreeProviderDraftMap,
  LoadedImage,
  ManualImageEditTool,
  ProcessableMode,
  RuntimeExecutionNotice,
  StatusMessageTone,
  SegmentEditTool,
  SubMode,
  ToolMode,
  TranslatorVisualRunMeta,
  TranslatorVisualProcessingMode,
  TranslatorWorkspaceMode,
  ViewMode,
  WebhookMetrics,
} from '../types/dashboard.types';

import {
  resolveCurrentFreeProviderModel,
  isAbortError,
  isTimeoutError,
  capitalizeStageLabel,
  EMPTY_REGIONS,
  EMPTY_SELECTED_REGION_IDS,
  type AioExecutionScope,
  type AioExecutionStatus,
} from '../utils/dashboardRenderUtils';

import { loadPresetState } from '../utils/aioModelPresets';
import {
  AIO_PRESET_STAGE_KEYS,
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_ICONS,
  AIO_STAGE_BADGE_LABELS,
  DEFAULT_RENDER_STYLE,
  ENHANCE_OUTPUT_FORMATS,
  EMPTY_PREVIEW_TIP_ROTATION_MS,
  INFO_MODES,
  getAioPipelineStageLabels,
  getAioPipelineStageProgressLabels,
  getAioStageLabels,
  getEnhanceProfileLabels,
  getEmptyPreviewTips,
  getModeLabels,
  isModeUnderDevelopment,
  MODES_WITH_SUBMODE,
  MIN_REGION_SIZE,
  SIDEBAR_RESIZE_STEP,
  TRANSLATION_NOTE_REGION_PREFIX,
  UNDER_DEVELOPMENT_TOOLTIP_KEY,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  EMPTY_AIO_MANUAL_EDIT_STATE,
} from '../constants/dashboard.constants';
import {
  extractProviderParamsFromApiBase,
  type FreeAiProviderCatalogEntry,
  type FreeProviderDraftValue,
  type FreeProviderStage,
  FREE_AI_PROVIDER_CATALOG_ENTRIES,
  getDefaultFreeProviderDraft,
  getFreeProvidersForStage,
  resolveProviderApiBase,
} from '../models/freeAiProviderCatalog';
import { PreviewStageItem } from '../components/dashboard/PreviewStageItem';
import { TranslatorVisualStageItem } from '../components/dashboard/TranslatorVisualStageItem';
import { CleanerStageItem } from '../components/dashboard/CleanerStageItem';
import { TypesetterStageItem } from '../components/dashboard/TypesetterStageItem';
import { useAioPresetEditor } from '../hooks/useAioPresetEditor';
import { useCustomLlmDrafts } from '../hooks/useCustomLlmDrafts';
import { useDashboardAccountSync } from '../hooks/useDashboardAccountSync';
import { useDashboardDownloadSettings } from '../hooks/useDashboardDownloadSettings';
import { useDashboardDownloadActions } from '../hooks/useDashboardDownloadActions';
import { useDashboardDownloadBundle } from '../hooks/useDashboardDownloadBundle';
import { useDashboardPsdDownload } from '../hooks/useDashboardPsdDownload';
import { useDashboardEnhanceActions } from '../hooks/useDashboardEnhanceActions';
import { useEnhanceInstallAction } from '../hooks/useEnhanceInstallAction';
import { useDashboardExternalActions } from '../hooks/useDashboardExternalActions';
import { useDashboardImageCollection } from '../hooks/useDashboardImageCollection';
import { useDashboardMenus } from '../hooks/useDashboardMenus';
import { useDashboardModelManager } from '../hooks/useDashboardModelManager';
import { useDashboardLocalStageValidation } from '../hooks/useDashboardLocalStageValidation';
import { useFreeProviderProfiles } from '../hooks/useFreeProviderProfiles';
import { useRenderFontCatalog } from '../hooks/useRenderFontCatalog';
import { useDashboardShellLayout } from '../hooks/useDashboardShellLayout';
import { useDashboardUploads } from '../hooks/useDashboardUploads';
import { useDashboardUsageAndPresence } from '../hooks/useDashboardUsageAndPresence';
import { useDashboardProcessingStats } from '../hooks/useDashboardProcessingStats';
import { useCleanerActions } from '../hooks/useCleanerActions';
import { useAioManualProgressControls } from '../hooks/useAioManualProgressControls';
import { useAioManualStageExecutor } from '../hooks/useAioManualStageExecutor';
import { useAioManualStageSkip } from '../hooks/useAioManualStageSkip';
import { useAioExecutionPreparation } from '../hooks/useAioExecutionPreparation';
import { useAioSingleImageProcessor, type GpuStagePreferences } from '../hooks/useAioSingleImageProcessor';
import { useAioResultConsolidation } from '../hooks/useAioResultConsolidation';
import { useTranslatorImports } from '../hooks/useTranslatorImports';
import { useTranslatorExecutionResolvers } from '../hooks/useTranslatorExecutionResolvers';
import { useTranslatorRetranslate } from '../hooks/useTranslatorRetranslate';
import { useTranslatorTextActions } from '../hooks/useTranslatorTextActions';
import { useTranslatorVisualActions } from '../hooks/useTranslatorVisualActions';
import { useTypographerWorkspace } from '../hooks/useTypographerWorkspace';
import { useTypographerControls } from '../hooks/useTypographerControls';
import { useWorkspaceHistory } from '../hooks/useWorkspaceHistory';
import {
  buildShapeFromPreset,
  createTypographyStyleFromPreset,
  loadTypographyPresetState,
  resolveLegacyTypographyPresetForMode,
  resolveTypographyPresetForMode,
  updateTypographyPreset,
} from '../typography/presets';
import {
  collectShortcutStateFromKeyboardEvent,
  findMatchingShortcutAction,
  isEditableShortcutTarget,
  loadKeyboardShortcutConfig,
  type KeyboardShortcutConfigV2,
  type ShortcutActionId,
} from '../shortcuts/keyboardShortcuts';
import type {
  TypographyShape,
  TypographyShapeKind,
  TypographyStylePreset,
} from '../typography/types';
import {
  type RenderTextStyle,
  computeRenderTextLayout,
  drawRenderedTextInRegion,
} from '../utils/renderText';
import {
  loadRenderModePresetState,
  type RenderModePresetStateV1,
} from '../utils/renderModePresets';
import {
  type RenderTextMode,
  RENDER_TEXT_MODE_LABELS,
  getRenderModePresetStyle,
  normalizeDetectedRenderMode,
  resolveRenderTextMode,
} from '../utils/renderModes';
import KomaTopbar from './KomaTopbar.tsx';
import './AioToolsPanel.css';
import './DockTools.css';

import { desktopBridge } from "@/lib/desktop-bridge";
// Lazy-loaded workspace components — only loaded when their mode is active
import type { WatermarkWorkspaceState } from '../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import CustomLlmProfilesManagerSection from '../components/dashboard/CustomLlmProfilesManagerSection';
import DashboardLeftSidebar from '../components/dashboard/DashboardLeftSidebar';
import DashboardMobileBackdrop from '../components/dashboard/DashboardMobileBackdrop';
import DashboardModelManagers from '../components/dashboard/DashboardModelManagers';
import DashboardOverlays from '../components/dashboard/DashboardOverlays';
import DashboardInfoModeStage from '../components/dashboard/DashboardInfoModeStage';
import DashboardRightSidebar from '../components/dashboard/DashboardRightSidebar';
import DashboardSpecialModeStage from '../components/dashboard/DashboardSpecialModeStage';
import DashboardStageGrid from '../components/dashboard/DashboardStageGrid';
import CleanerToolsPanel from '../components/dashboard/CleanerToolsPanel';
import EnhanceToolsPanel from '../components/dashboard/EnhanceToolsPanel';
import FieldInfoTooltip from '../components/dashboard/FieldInfoTooltip';
import FreeProviderManagerSection from '../components/dashboard/FreeProviderManagerSection';
import InfoModesToolsPanel from '../components/dashboard/InfoModesToolsPanel';
import KlSlider from '../components/dashboard/KlSlider';
import OrganizeToolsHint from '../components/dashboard/OrganizeToolsHint';
import ReviewRawToolsPanel from '../components/dashboard/ReviewRawToolsPanel';
import SubModeToggle from '../components/dashboard/SubModeToggle';
import TypesetterToolsPanel from '../components/dashboard/TypesetterToolsPanel';
import TranslatorToolsPanel from '../components/dashboard/TranslatorToolsPanel';
import TranslatorTextStage from '../components/dashboard/TranslatorTextStage';
import WorkflowSidebarPanels from '../components/dashboard/WorkflowSidebarPanels';
import type {
  StitchAlignMode,
  StitchBatchStrategy,
  StitchImageInput,
  StitchLayoutMode,
} from '../components/dashboard/stitch/types';
import type { SplitterWorkspaceState } from '../components/dashboard/splitter/types';
import {
  buildAutoBatchIndexes,
  buildBatchPlanFromIndexes,
  moveLastImageToNextBatch,
  pullFirstImageFromNextBatch,
  sanitizeFileStem,
} from '../components/dashboard/stitch/stitchUtils';
import { createDefaultSplitterRecipe } from '../components/dashboard/splitter/splitterUtils';
import { useSplitterController } from '../components/dashboard/splitter/useSplitterController';
import { createDefaultWatermarkDraft } from '../components/dashboard/watermark/watermark-core.js';
import {
  buildWorkspaceExportPayload,
  buildWorkspaceAutosaveSignature,
  buildWorkspaceHistorySignature,
  captureWorkspaceDocument,
  captureWorkspaceHistorySnapshot,
  releaseWorkspaceHistorySnapshot,
  restoreWorkspaceDocument,
  restoreWorkspaceHistorySnapshot,
  type DashboardWorkspaceCaptureState,
  type DashboardWorkspaceHistorySnapshot,
  type DashboardWorkspaceRestoreState,
} from '../workspace/dashboardWorkspace';
import TextDetectionPreview from '../components/dashboard/TextDetectionPreview';
import RenderTextPreview from '../components/dashboard/RenderTextPreview';
import DashboardFooter from '../components/dashboard/DashboardFooter';
import DashboardEmptyStage from '../components/dashboard/DashboardEmptyStage';
import { DashboardManualDock } from '../features/dashboard/components/DashboardManualDock';
import { HealingToolHint } from '../components/dashboard/HealingToolHint';
import { useAioModelSelection } from '../hooks/useAioModelSelection';
import DetectTextModelControl from '../components/AioStageModelControls/DetectTextModelControl.tsx';
import RecognizeTextModelControl from '../components/AioStageModelControls/RecognizeTextModelControl.tsx';
import TranslationModelControl from '../components/AioStageModelControls/TranslationModelControl.tsx';
import SegmentTextModelControl from '../components/AioStageModelControls/SegmentTextModelControl.tsx';
import CleanImageModelControl from '../components/AioStageModelControls/CleanImageModelControl.tsx';
import CleanerAiRecognizeTextModelManagerModal from '../components/ModelManagerModal/CleanerAiRecognizeTextModelManagerModal';

const ocrModelSupportsLanguage = ocrStageOptionSupportsLanguage;

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
  const enhanceProfileLabels = useMemo(() => getEnhanceProfileLabels(t), [t]);
  const emptyPreviewTips = useMemo(() => getEmptyPreviewTips(t), [t]);
  const modeLabels = useMemo(() => getModeLabels(t), [t]);
  // The catalog stores i18n keys (e.g. "aioStage.lang.en") as `label` to keep
  // the data file locale-agnostic. Without resolving them through `t` here the
  // raw key leaks into the UI (and into preset names saved by the user).
  const translatedSourceLanguageOptions = useMemo(
    () => SOURCE_LANGUAGE_OPTIONS.map((option) => ({ ...option, label: t(option.label) })),
    [t],
  );
  const translatedTargetLanguageOptions = useMemo(
    () => TARGET_LANGUAGE_OPTIONS.map((option) => ({ ...option, label: t(option.label) })),
    [t],
  );
  const underDevelopmentTooltip = t(UNDER_DEVELOPMENT_TOOLTIP_KEY);
  // ── Core State ──
  const [mode, setMode] = useState<ToolMode>('organize');
  const [subMode, setSubMode] = useState<SubMode>('auto');
  const [cleanerMode, setCleanerMode] = useState<CleanerMode>('assisted');
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [aioExecutionStatus, setAioExecutionStatus] =
    useState<AioExecutionStatus | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('long_strip');

  // ── Mobile State ──
  const [forcedTourDropdown, setForcedTourDropdown] =
    useState<DashboardTourForcedDropdown>(null);
  const [, setModeTabsScroll] = useState({
    left: false,
    right: false,
    hasOverflow: false,
  });
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

      document.body.appendChild(ghost);
      const previousFromVisibility = fromEl.style.visibility;
      const previousToVisibility = toEl.style.visibility;
      fromEl.style.visibility = 'hidden';
      toEl.style.visibility = 'hidden';

      const animation = ghost.animate(
        [
          {
            left: `${fromRect.left}px`,
            top: `${fromRect.top}px`,
            width: `${fromRect.width}px`,
            height: `${fromRect.height}px`,
            opacity: 0.96,
            transform: 'translateZ(0) scale(1)',
            borderRadius: '10px',
          },
          {
            left: `${toRect.left}px`,
            top: `${toRect.top}px`,
            width: `${toRect.width}px`,
            height: `${toRect.height}px`,
            opacity: 0.9,
            transform: 'translateZ(0) scale(0.98)',
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
  const [stitchLayoutMode, setStitchLayoutMode] =
    useState<StitchLayoutMode>('webtoon');
  const [stitchBatchStrategy, setStitchBatchStrategy] =
    useState<StitchBatchStrategy>('fixed-count');
  const [stitchBatchSize, setStitchBatchSize] = useState(3);
  const [stitchTargetPrimaryAxis, setStitchTargetPrimaryAxis] = useState(12000);
  const [stitchGap, setStitchGap] = useState(0);
  const [stitchAlignMode, setStitchAlignMode] =
    useState<StitchAlignMode>('center');
  const [stitchBackground, setStitchBackground] = useState('#ffffff');
  const [stitchSingleExportFormat, setStitchSingleExportFormat] = useState<
    'png' | 'jpeg' | 'webp'
  >('png');
  const [stitchFileBaseName, setStitchFileBaseName] = useState('koma-stitch');
  const [stitchSelectedBatchIndex, setStitchSelectedBatchIndex] = useState(0);
  const [stitchBatchIndexes, setStitchBatchIndexes] = useState<number[][]>([]);
  const [outFormat, setOutFormat] = useState('image/png');
  const [outQuality, setOutQuality] = useState(0.9);
  const [batchThreadsEnabled, setBatchThreadsEnabled] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? true
      : parseStoredBatchThreadsEnabled(
          localStorage.getItem(BATCH_THREADS_ENABLED_STORAGE_KEY),
        ),
  );
  const [batchThreads, setBatchThreads] = useState<number>(() =>
    typeof window === 'undefined'
      ? DEFAULT_BATCH_THREADS
      : parseStoredBatchThreads(
          localStorage.getItem(BATCH_THREADS_COUNT_STORAGE_KEY),
        ),
  );
  const [progress, setProgress] = useState(0);
  const aioAbortControllerRef = useRef<AbortController | null>(null);
  const aioExecutionProgressRef = useRef<{
    totalUnits: number;
    completedUnits: Set<string>;
  }>({
    totalUnits: 1,
    completedUnits: new Set<string>(),
  });
  const processingRef = useRef(false);

  // Enhance
  const [enhanceScale, setEnhanceScale] = useState<EnhanceScale>(2);
  const [enhanceProfile, setEnhanceProfile] =
    useState<EnhanceProfile>('manga_scan');
  const [enhanceModelId, setEnhanceModelId] = useState<string>(
    'waifu2x_swin_unet_art_scan_2x',
  );
  const [enhanceOutputFormat, setEnhanceOutputFormat] = useState<
    'png' | 'webp'
  >('png');
  const [enhanceActionBusy, setEnhanceActionBusy] = useState(false);

  // AIO Pipeline
  const [aioSteps, setAioSteps] = useState({
    detectText: true,
    recognizeText: true,
    getTranslations: true,
    segmentText: true,
    cleanImage: true,
    render: true,
  });
  const [aioStageOptions, setAioStageOptions] = useState<
    Record<AioStageKey, AioStageOption[]>
  >(DEFAULT_AIO_STAGE_OPTIONS);
  const [aioStageSelection, setAioStageSelection] = useState<AioStageSelection>(
    {
      detectText: 'font_rtdetr_v2',
      recognizeText: 'manga_ocr',
      getTranslations: 'google_translate',
      segmentText: 'baka_content_cc',
      cleanImage: 'aot',
    },
  );
  const [aioPresetState, setAioPresetState] = useState<AioModelPresetStateV2>(
    () => loadPresetState(),
  );
  const [aioLanguageOptions, setAioLanguageOptions] = useState<{
    source: AioLanguageOption[];
    target: AioLanguageOption[];
  }>({
    source: translatedSourceLanguageOptions,
    target: translatedTargetLanguageOptions,
  });
  const [aioMaskDilation, setAioMaskDilation] = useState(10);
  const [aioHdStrategy, setAioHdStrategy] = useState<
    'original' | 'resize' | 'crop'
  >('original');
  const [aioHdResizeLimit, setAioHdResizeLimit] = useState(960);
  const [aioHdCropMargin, setAioHdCropMargin] = useState(512);
  const [aioHdCropTriggerSize, setAioHdCropTriggerSize] = useState(512);
  const [aioDeviceInfo, setAioDeviceInfo] = useState<AioDeviceInfo | null>(
    null,
  );
  const [aioGpuStages, setAioGpuStages] = useState<GpuStagePreferences>(() => {
    try {
      const saved = window.localStorage.getItem('koma-aio-gpu-stages');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<GpuStagePreferences>;
        return {
          detectText: parsed.detectText !== false,
          recognizeText: parsed.recognizeText !== false,
          segmentText: parsed.segmentText !== false,
          cleanImage: parsed.cleanImage !== false,
        };
      }
    } catch { /* ignore */ }
    return { detectText: true, recognizeText: true, segmentText: true, cleanImage: true };
  });
  const updateAioGpuStage = useCallback((stage: keyof GpuStagePreferences, value: boolean) => {
    setAioGpuStages((prev) => {
      const next = { ...prev, [stage]: value };
      try { window.localStorage.setItem('koma-aio-gpu-stages', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [aioMiniBackendRuntimeState, setAioMiniBackendRuntimeState] =
    useState<DesktopMiniBackendRuntimeState | null>(null);
  const aioHasGpuExecutionProfile = Boolean(
    aioDeviceInfo?.has_gpu
      || aioMiniBackendRuntimeState?.gpuName
      || (aioMiniBackendRuntimeState?.activeProfile
        && aioMiniBackendRuntimeState.activeProfile !== 'cpu')
      || (aioMiniBackendRuntimeState?.requestedProfile
        && aioMiniBackendRuntimeState.requestedProfile !== 'cpu'),
  );
  const [aioOptionsLoading, setAioOptionsLoading] = useState(false);
  const [aioDetectionsByImage, setAioDetectionsByImage] = useState<
    Record<string, AioTextRegion[]>
  >({});
  const [aioSelectedRegionByImage, setAioSelectedRegionByImage] = useState<
    Record<string, string | null>
  >({});
  const [typographyPresetState, setTypographyPresetState] = useState(() => loadTypographyPresetState());
  const [keyboardShortcutConfig, setKeyboardShortcutConfig] =
    useState<KeyboardShortcutConfigV2>(() => loadKeyboardShortcutConfig());
  const [typographerSelectionTool, setTypographerSelectionTool] = useState<
    'select' | 'draw-square' | 'draw-rounded'
  >('select');
  const [typographerQueueSelectedId, setTypographerQueueSelectedId] = useState<
    string | null
  >(null);
  const [typographerMultiSelectedByImage, setTypographerMultiSelectedByImage] =
    useState<Record<string, string[]>>({});
  const [typographerSnapshotName, setTypographerSnapshotName] = useState('');
  const [typographerSelectedSnapshotId, setTypographerSelectedSnapshotId] =
    useState<string | null>(null);
  const [aioPipelineSnapshots, setAioPipelineSnapshots] = useState<
    AioPipelineSnapshot[]
  >([]);
  const [aioPipelineSnapshotIndex, setAioPipelineSnapshotIndex] = useState(-1);
  const [aioImageSnapshotIndexById, setAioImageSnapshotIndexById] = useState<
    Record<string, number>
  >({});
  const [aioAutoHistoryAvailable, setAioAutoHistoryAvailable] = useState(false);
  const [aioAutoProcessedImageById, setAioAutoProcessedImageById] = useState<
    Record<string, boolean>
  >({});
  const [aioManualProgressByImage, setAioManualProgressByImage] = useState<
    Record<string, AioManualImageProgress>
  >({});
  const [segmentEditTool, setSegmentEditTool] =
    useState<SegmentEditTool>('select');
  const [areaSelectionCreateMode, setAreaSelectionCreateMode] =
    useState<AreaSelectionCreateMode>('auto');
  const [segmentBrushSize, setSegmentBrushSize] = useState(28);
  const [manualImageTool, setManualImageTool] =
    useState<ManualImageEditTool>('none');
  const [manualToolsConfigOpen, setManualToolsConfigOpen] = useState(true);
  const [manualImageBrushSize, setManualImageBrushSize] = useState(26);
  const [manualImagePaintColor, setManualImagePaintColor] = useState('#ffffff');
  const [manualImageBrushOpacity, setManualImageBrushOpacity] = useState(1);
  const [manualImageBrushBlur, setManualImageBrushBlur] = useState(0);
  const [manualImageWandTolerance, setManualImageWandTolerance] = useState(34);
  const [aioManualImageEditsByImage, setAioManualImageEditsByImage] = useState<
    Record<string, AioManualImageEditState>
  >({});
  const [aioManualHealingBusyByImage, setAioManualHealingBusyByImage] =
    useState<Record<string, boolean>>({});
  const [llmSettings, setLlmSettings] = useState<LlmRequestSettings>(() =>
    loadPersistedLlmSettings(),
  );
  const [customLlmProfiles, setCustomLlmProfiles] = useState<
    CustomLlmProfile[]
  >([]);
  const [customLlmProfilesLoading, setCustomLlmProfilesLoading] =
    useState(false);
  const [customLlmProfilesError, setCustomLlmProfilesError] = useState<
    string | null
  >(null);
  const [customLlmProfilesMode, setCustomLlmProfilesMode] =
    useState<LlmProfilesPersistenceMode>('browser_local');
  const [customLlmProfilesHydrated, setCustomLlmProfilesHydrated] =
    useState(false);
  const [pendingCustomSelections, setPendingCustomSelections] = useState<
    Record<CustomLlmStage, string | null>
  >({
    translation: null,
    ocr: null,
    clean: null,
  });
  const [customLlmDrafts, setCustomLlmDrafts] = useState<
    Record<CustomLlmStage, CustomLlmProfileDraft>
  >({
    translation: createEmptyCustomLlmDraft(),
    ocr: createEmptyCustomLlmDraft(),
    clean: createEmptyCustomLlmDraft(),
  });
  const [renderDefaultStyle] = useState<RenderTextStyle>(
    cloneRenderStyle(DEFAULT_RENDER_STYLE),
  );
  const [renderModePresetState] = useState<RenderModePresetStateV1>(() =>
    loadRenderModePresetState(),
  );
  const [textFillSwatchState] = useState(() => loadTextFillSwatchState());
  const textFillSwatches = useMemo(
    () => listTextFillSwatches(textFillSwatchState),
    [textFillSwatchState],
  );

  // Healing tool hint trigger (increment to attempt showing)
  const [healingHintTrigger, setHealingHintTrigger] = useState(0);
  const tryShowHealingHint = useCallback(() => {
    setHealingHintTrigger((v) => v + 1);
  }, []);

  // Translator
  const [srcLang, setSrcLang] = useState('ja');
  const [tgtLang, setTgtLang] = useState('pt-br');
  const [translatorWorkspaceMode, setTranslatorWorkspaceMode] =
    useState<TranslatorWorkspaceMode>('text');
  const [translatorVisualProcessingMode, setTranslatorVisualProcessingMode] =
    useState<TranslatorVisualProcessingMode>('standard');
  const [translatorDraftText, setTranslatorDraftText] = useState('');
  const [translatorTranslatedText, setTranslatorTranslatedText] = useState('');
  const [translatorLastTextModelUsed, setTranslatorLastTextModelUsed] =
    useState<string | null>(null);
  const [translatorTextDirty, setTranslatorTextDirty] = useState(false);
  const [translatorTextRunning, setTranslatorTextRunning] = useState(false);
  const [translatorDetectionsByImage, setTranslatorDetectionsByImage] =
    useState<Record<string, AioTextRegion[]>>({});
  const [translatorSelectedRegionByImage, setTranslatorSelectedRegionByImage] =
    useState<Record<string, string | null>>({});
  const [translatorRunMetaByImage, setTranslatorRunMetaByImage] = useState<
    Record<string, TranslatorVisualRunMeta>
  >({});
  const [translatorProcessedBaseByImage, setTranslatorProcessedBaseByImage] =
    useState<Record<string, string>>({});
  const [, setTranslatorVisualRunning] = useState(false);
  const [cleanerDetectionsByImage, setCleanerDetectionsByImage] = useState<
    Record<string, AioTextRegion[]>
  >({});
  const [cleanerSelectedRegionByImage, setCleanerSelectedRegionByImage] =
    useState<Record<string, string | null>>({});
  const [cleanerProcessedBaseByImage, setCleanerProcessedBaseByImage] =
    useState<Record<string, string>>({});
  const [cleanerRunMetaByImage, setCleanerRunMetaByImage] = useState<
    Record<string, CleanerRunMeta>
  >({});
  const [cleanerManualImageEditsByImage, setCleanerManualImageEditsByImage] =
    useState<Record<string, AioManualImageEditState>>({});
  const [cleanerHealingBusyByImage, setCleanerHealingBusyByImage] = useState<
    Record<string, boolean>
  >({});
  const [cleanerShowOverlays, setCleanerShowOverlays] = useState(true);
  const [cleanerAiModelKey, setCleanerAiModelKey] = useState(
    'gemini_2_0_flash_ocr',
  );
  const [cleanerAiModelManagerOpen, setCleanerAiModelManagerOpen] =
    useState(false);
  const [cleanerAiAdditionalInstructions, setCleanerAiAdditionalInstructions] =
    useState('');
  const [translatorSfxCleanModelKey, setTranslatorSfxCleanModelKey] = useState(
    'gemini_2_0_flash_ocr',
  );
  const [translatorSfxAdditionalInstructions, setTranslatorSfxAdditionalInstructions] =
    useState('');
  const [aioSrcLang, setAioSrcLang] = useState('ja');
  const [aioTgtLang, setAioTgtLang] = useState('pt-br');
  const [cleanerSrcLang, setCleanerSrcLang] = useState('ja');

  // Typesetter
  // Downloads & Status
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([]);
  const [lastActionScope, setLastActionScope] =
    useState<ProcessableMode | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    t('dashboard.status.ready'),
  );
  const [statusMessageTone, setStatusMessageTone] = useState<StatusMessageTone>('info');
  const statusToneExplicitRef = useRef(false);
  useEffect(() => {
    if (!statusToneExplicitRef.current) {
      setStatusMessageTone('info');
    }
    statusToneExplicitRef.current = false;
  }, [statusMessage]);
  const setTonedStatus = useCallback((msg: string, tone: StatusMessageTone) => {
    statusToneExplicitRef.current = true;
    setStatusMessageTone(tone);
    setStatusMessage(msg);
  }, []);
  const [runtimeExecutionNotice, setRuntimeExecutionNotice] =
    useState<RuntimeExecutionNotice | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [workspaceStatusDetail, setWorkspaceStatusDetail] = useState(
    t('dashboard.workspace.pendingChanges'),
  );
  const [workspaceLastSavedAt, setWorkspaceLastSavedAt] = useState<number | null>(
    null,
  );
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [workspaceAutosaveSettings, setWorkspaceAutosaveSettings] =
    useState<WorkspaceAutosaveSettings>(() =>
      loadWorkspaceAutosaveSettings(),
    );
  const [workspaceRestoreToken, setWorkspaceRestoreToken] = useState(0);
  const [splitterWorkspaceState, setSplitterWorkspaceState] =
    useState<SplitterWorkspaceState | null>(null);
  const [watermarkWorkspaceState, setWatermarkWorkspaceState] =
    useState<WatermarkWorkspaceState | null>(null);
  const [optimizerWorkspaceState, setOptimizerWorkspaceState] =
    useState<ChapterOptimizerWorkspaceState | null>(null);
  const workspaceHistoryReadyRef = useRef(false);
  const workspaceHistorySignatureRef = useRef<string | null>(null);
  const workspaceAutosaveSignatureRef = useRef<string | null>(null);
  const workspaceAutosaveIntervalRef = useRef<number | null>(null);
  const workspaceAutosaveDirtyRef = useRef(false);
  const workspaceAutosaveSavingRef = useRef(false);
  const latestWorkspaceCaptureStateRef =
    useRef<DashboardWorkspaceCaptureState | null>(null);
  const saveWorkspaceAutosaveRef = useRef<
    (...args: Parameters<typeof saveWorkspaceAutosave>) => Promise<boolean>
  >(async () => false);
  const [emptyPreviewTipIndex, setEmptyPreviewTipIndex] = useState(0);
  const [inlineEditorShortcutRequestKey, setInlineEditorShortcutRequestKey] =
    useState<string | null>(null);
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
    [],
  );
  const [isExtractingUploads, setIsExtractingUploads] = useState(false);
  const {
    downloadBundleFormat,
    setDownloadBundleFormat,
    downloadIncludeRawText,
    setDownloadIncludeRawText,
    downloadIncludeTranslatedText,
    setDownloadIncludeTranslatedText,
    downloadIncludeInpaintedImage,
    setDownloadIncludeInpaintedImage,
    downloadPsdCompression,
    setDownloadPsdCompression,
    downloadPsdDpi,
    setDownloadPsdDpi,
    downloadPsdIncludeOcrOverlay,
    setDownloadPsdIncludeOcrOverlay,
    downloadPsdIncludeIndividualCrops,
    setDownloadPsdIncludeIndividualCrops,
    downloadPsdIncludeRawTextLayer,
    setDownloadPsdIncludeRawTextLayer,
    downloadPsdIncludeTranslatedTextLayer,
    setDownloadPsdIncludeTranslatedTextLayer,
    downloadPsdUsePhotoshopTextLayers,
    setDownloadPsdUsePhotoshopTextLayers,
    downloadPsdIncludeMetadataJson,
    setDownloadPsdIncludeMetadataJson,
    downloadPsdLoading,
    setDownloadPsdLoading,
  } = useDashboardDownloadSettings();
  const [user, setUser] = useState<DashboardUser>({
    name: '',
    email: '',
  });
  const { processingStats, recordProcessedPages } = useDashboardProcessingStats(
    authUser?.id ?? authUser?.email ?? user.email ?? null,
  );

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

  const enhanceModels = useMemo(() => ENHANCE_IMAGE_MODELS_REGISTRY, []);

  const filteredEnhanceModels = useMemo(() => {
    return enhanceModels.filter((model) => {
      const scaleMatches = model.id.includes('4x')
        ? enhanceScale === 4
        : enhanceScale === 2;
      if (!scaleMatches) return false;

      if (enhanceProfile === 'manga_scan') {
        return model.id.includes('art_scan');
      }
      if (enhanceProfile === 'anime_art') {
        return model.id.includes('art_2x') || model.id.includes('anifilm');
      }
      if (enhanceProfile === 'general') {
        return (
          model.id.includes('spankendata') || model.id.includes('realesrgan')
        );
      }
      return (
        model.id.includes('nomos2') ||
        model.id.includes('hfa2k') ||
        model.id.includes('swinir')
      );
    });
  }, [enhanceModels, enhanceProfile, enhanceScale]);

  const selectedEnhanceModel = useMemo(
    () =>
      filteredEnhanceModels.find((model) => model.id === enhanceModelId) ??
      filteredEnhanceModels[0] ??
      null,
    [enhanceModelId, filteredEnhanceModels],
  );

  const selectedEnhanceInstallState = useMemo(
    () =>
      selectedEnhanceModel
        ? (modelManagerState.entries[selectedEnhanceModel.id] ?? null)
        : null,
    [modelManagerState.entries, selectedEnhanceModel],
  );

  useEffect(() => {
    if (!selectedEnhanceModel) {
      return;
    }
    if (selectedEnhanceModel.id !== enhanceModelId) {
      setEnhanceModelId(selectedEnhanceModel.id);
    }
  }, [enhanceModelId, selectedEnhanceModel]);

  // Refs
  const { setUtilsMenuOpen, setDownloadMenuOpen } = useDashboardMenus();
  const modeTabsRef = useRef<HTMLElement | null>(null);
  const renderFontInputRef = useRef<HTMLInputElement | null>(null);
  const translatorTextImportRef = useRef<HTMLInputElement>(null);
  const translatorImageImportRef = useRef<HTMLInputElement>(null);
  const downloadItemsRef = useRef<DownloadItem[]>([]);
  const aioStageSelectionRef = useRef<AioStageSelection>(aioStageSelection);
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

  function parseApiError(response: Response): Promise<string> {
    return parseResponseErrorMessage(response);
  }

  const clearAioExecutionState = useCallback(() => {
    aioAbortControllerRef.current = null;
    aioExecutionProgressRef.current = {
      totalUnits: 1,
      completedUnits: new Set<string>(),
    };
    setAioExecutionStatus(null);
  }, []);

  const getActiveAioAbortSignal = useCallback(
    () => aioAbortControllerRef.current?.signal ?? null,
    [],
  );

  const beginAioExecution = useCallback(
    (scope: AioExecutionScope, totalImages: number, stageKeys: AioPipelineSnapshotKey[]) => {
      const controller = new AbortController();
      aioAbortControllerRef.current = controller;
      aioExecutionProgressRef.current = {
        totalUnits: Math.max(1, totalImages * Math.max(1, stageKeys.length)),
        completedUnits: new Set<string>(),
      };
      setAioExecutionStatus({
        scope,
        stageKey: null,
        imageName: null,
        imageIndex: null,
        totalImages,
        label:
          scope === 'manual'
            ? t('dashboard.aio.preparingManual')
            : t('dashboard.aio.preparingAuto'),
      });
      return controller;
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
      const stageProgressLabel = capitalizeStageLabel(
        aioPipelineStageProgressLabels[stageKey],
      );
      const imageOrdinal = Math.max(1, index + 1);
      const unitKey = `${image.id}:${stageKey}`;
      const tracker = aioExecutionProgressRef.current;
      if (scope === 'auto' && !tracker.completedUnits.has(unitKey)) {
        tracker.completedUnits.add(unitKey);
        const percent = Math.min(
          99,
          (tracker.completedUnits.size / tracker.totalUnits) * 100,
        );
        setProgress(percent);
      }

      const suffix =
        totalImages > 1
          ? ` ${imageOrdinal}/${totalImages} · ${image.file.name}`
          : ` · ${image.file.name}`;

      setAioExecutionStatus({
        scope,
        stageKey,
        imageName: image.file.name,
        imageIndex: imageOrdinal,
        totalImages,
        label: `${stageProgressLabel}${suffix}`,
      });
    },
    [],
  );

  const stopAioExecution = useCallback(() => {
    const controller = aioAbortControllerRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }

    setAioExecutionStatus((current) =>
      current
        ? {
            ...current,
            label: t('dashboard.aio.stopping'),
          }
        : {
            scope: 'auto',
            stageKey: null,
            imageName: null,
            imageIndex: null,
            totalImages: images.length,
            label: t('dashboard.aio.stopping'),
          },
    );
    setTonedStatus(t('dashboard.aio.stopping'), 'warning');
    controller.abort(
      new DOMException(
        t('dashboard.aio.abortedByUser'),
        'AbortError',
      ),
    );

    if (isDesktopRuntime && desktopBridge.desktop?.restartLocalBackend) {
      void desktopBridge.desktop.restartLocalBackend().then((restarted) => {
        setTonedStatus(
          restarted
            ? t('dashboard.aio.abortedMiniBackendRestarted')
            : t('dashboard.aio.abortedMiniBackendRestartFailed'),
          'warning',
        );
      });
    }
  }, [images.length, isDesktopRuntime]);

  const syncFreeProviderDraftsFromProfiles = useCallback(
    (profiles: CustomLlmProfile[]) => {
      setFreeProviderDrafts(() => {
        const next: FreeProviderDraftMap = {};
        FREE_AI_PROVIDER_CATALOG_ENTRIES.forEach((provider) => {
          (['translation', 'ocr', 'clean'] as const).forEach((stage) => {
            const definition = provider.stages[stage];
            if (!definition) {
              return;
            }
            const profileId = toFreeProviderProfileId(provider.id, stage);
            const profile = profiles.find((item) => item.id === profileId);
            const params = profile
              ? extractProviderParamsFromApiBase(definition, profile.apiBase)
              : getDefaultFreeProviderDraft(provider.id, stage).params;
            const allowedModels = definition.models.map((model) => model.apiModel);
            const resolvedApiBase = resolveProviderApiBase(
              definition.apiBaseTemplate,
              params,
            );
            next[toFreeProviderDraftKey(stage, provider.id)] = {
              model: resolveCurrentFreeProviderModel(
                profile?.model ?? definition.defaultModel,
                allowedModels,
                definition.defaultModel,
              ),
              apiBase: resolvedApiBase,
              apiKey: profile?.apiKey ?? '',
              params,
            };
          });
        });
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

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
  }, []);

  useEffect(() => {
    aioStageSelectionRef.current = aioStageSelection;
  }, [aioStageSelection]);

  useEffect(() => {
    if (images.length > 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setEmptyPreviewTipIndex((prev) => (prev + 1) % emptyPreviewTips.length);
    }, EMPTY_PREVIEW_TIP_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [images.length]);

  useEffect(() => {
    persistLlmSettings(llmSettings);
  }, [llmSettings]);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      setCustomLlmProfilesLoading(true);
      setCustomLlmProfilesHydrated(false);
      setCustomLlmProfilesError(null);
      try {
        const payload = await loadCustomLlmProfiles(authUser?.id ?? null);
        if (cancelled) {
          return;
        }
        const normalizedProfiles = payload.profiles.map((profile) => {
          const freeMetadata = parseFreeProviderProfileId(profile.id);
          if (!freeMetadata || freeMetadata.stage !== profile.stage) {
            return profile;
          }
          const provider = FREE_AI_PROVIDER_CATALOG_ENTRIES.find(
            (item) => item.id === freeMetadata.providerId,
          );
          const stageDefinition = provider?.stages[freeMetadata.stage];
          if (!stageDefinition) {
            return profile;
          }
          const allowedModels = stageDefinition.models.map((model) => model.apiModel);
          const params = extractProviderParamsFromApiBase(
            stageDefinition,
            profile.apiBase,
          );
          return {
            ...profile,
            model: resolveCurrentFreeProviderModel(
              profile.model,
              allowedModels,
              stageDefinition.defaultModel,
            ),
            apiBase: resolveProviderApiBase(
              stageDefinition.apiBaseTemplate,
              params,
            ),
          };
        });
        setCustomLlmProfiles(normalizedProfiles);
        setCustomLlmProfilesMode(payload.mode);
        syncFreeProviderDraftsFromProfiles(normalizedProfiles);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setCustomLlmProfiles([]);
        syncFreeProviderDraftsFromProfiles([]);
        setCustomLlmProfilesError(
          error instanceof Error
            ? error.message
            : t('dashboard.llm.customProfilesLoadFailed'),
        );
      } finally {
        if (!cancelled) {
          setCustomLlmProfilesLoading(false);
          setCustomLlmProfilesHydrated(true);
        }
      }
    };

    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, syncFreeProviderDraftsFromProfiles]);

  const discordUser = useMemo(
    () =>
      authUser
        ? {
            name: authUser.name,
            email: authUser.email,
          }
        : null,
    [authUser?.email, authUser?.name],
  );
  const discord = useDiscordRPC(discordUser);
  const {
    setPreset: setDiscordPreset,
    setTranslating: setDiscordTranslating,
  } = discord;

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
  }, [activeId, images]);
  const activeTypographerSession = typographerWorkspace.activeSession;
  const typographyPresetList = useMemo(
    () =>
      [...typographyPresetState.presets].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [typographyPresetState.presets],
  );
  const typographyFolderList = useMemo(
    () => [...typographyPresetState.folders].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'pt-BR')),
    [typographyPresetState.folders],
  );
  const activeTypographerMultiSelectedIds = useMemo(
    () =>
      resolvedActiveId
        ? typographerMultiSelectedByImage[resolvedActiveId] ?? EMPTY_SELECTED_REGION_IDS
        : EMPTY_SELECTED_REGION_IDS,
    [resolvedActiveId, typographerMultiSelectedByImage],
  );

  const handleTypographerMultiSelectReorder = useCallback(
    (nextOrder: string[]) => {
      if (!resolvedActiveId) return;
      setTypographerMultiSelectedByImage((prev) => ({
        ...prev,
        [resolvedActiveId]: nextOrder,
      }));
    },
    [resolvedActiveId],
  );

  const effectiveBatchConcurrency = useMemo(
    () =>
      normalizeBatchConcurrency(
        batchThreadsEnabled,
        batchThreads,
        images.length,
      ),
    [batchThreads, batchThreadsEnabled, images.length],
  );
  const activeImageDetections = useMemo(
    () =>
      resolvedActiveId ? (aioDetectionsByImage[resolvedActiveId] ?? []) : [],
    [aioDetectionsByImage, resolvedActiveId],
  );
  const activeSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (aioSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [aioSelectedRegionByImage, resolvedActiveId],
  );
  const activeSelectedRegion = useMemo(
    () =>
      activeImageDetections.find(
        (region) => region.id === activeSelectedRegionId,
      ) ?? null,
    [activeImageDetections, activeSelectedRegionId],
  );
  const activeTranslatorImageDetections = useMemo(
    () =>
      resolvedActiveId
        ? (translatorDetectionsByImage[resolvedActiveId] ?? [])
        : [],
    [resolvedActiveId, translatorDetectionsByImage],
  );
  const activeTranslatorSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (translatorSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [resolvedActiveId, translatorSelectedRegionByImage],
  );
  const activeTranslatorSelectedRegion = useMemo(
    () =>
      activeTranslatorImageDetections.find(
        (region) => region.id === activeTranslatorSelectedRegionId,
      ) ?? null,
    [activeTranslatorImageDetections, activeTranslatorSelectedRegionId],
  );
  const activeCleanerDetections = useMemo(
    () =>
      resolvedActiveId
        ? (cleanerDetectionsByImage[resolvedActiveId] ?? [])
        : [],
    [cleanerDetectionsByImage, resolvedActiveId],
  );
  const activeCleanerSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (cleanerSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [cleanerSelectedRegionByImage, resolvedActiveId],
  );
  const activeCleanerSelectedRegion = useMemo(
    () =>
      activeCleanerDetections.find(
        (region) => region.id === activeCleanerSelectedRegionId,
      ) ?? null,
    [activeCleanerDetections, activeCleanerSelectedRegionId],
  );
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
  const activeAioPipelineSnapshot = useMemo(
    () =>
      aioPipelineSnapshotIndex >= 0 &&
      aioPipelineSnapshotIndex < aioPipelineSnapshots.length
        ? (aioPipelineSnapshots[aioPipelineSnapshotIndex] ?? null)
        : null,
    [aioPipelineSnapshotIndex, aioPipelineSnapshots],
  );
  const canAioRewind = aioPipelineSnapshotIndex > 0;
  const canAioForward =
    aioPipelineSnapshotIndex >= 0 &&
    aioPipelineSnapshotIndex < aioPipelineSnapshots.length - 1;
  const currentAioDownloadEntries = useMemo<AioDownloadEntry[]>(
    () =>
      downloadItems
        .filter((item) => item.scope === 'aio')
        .map((item) => ({
          fileName: item.name,
          blob: item.blob,
          sourceImageId: item.sourceImageId,
        })),
    [downloadItems],
  );

  const buildAioImageSnapshotIndexMap = useCallback(
    (index: number): Record<string, number> => {
      if (index < 0) return {};
      const next: Record<string, number> = {};
      images.forEach((img) => {
        next[img.id] = index;
      });
      return next;
    },
    [images],
  );

  const getAioImageSnapshotIndex = useCallback(
    (imageId: string): number => {
      if (mode === 'aio' && subMode === 'manual') {
        const manualProgress = aioManualProgressByImage[imageId];
        if (manualProgress) return manualProgress.currentIndex;
      }
      const explicitIndex = aioImageSnapshotIndexById[imageId];
      if (typeof explicitIndex === 'number') return explicitIndex;
      if (aioPipelineSnapshotIndex >= 0) return aioPipelineSnapshotIndex;
      if (aioPipelineSnapshots.length > 0)
        return aioPipelineSnapshots.length - 1;
      return -1;
    },
    [
      aioImageSnapshotIndexById,
      aioManualProgressByImage,
      aioPipelineSnapshotIndex,
      aioPipelineSnapshots.length,
      mode,
      subMode,
    ],
  );

  const getAioImageSnapshotMeta = useCallback(
    (imageId: string) => {
      if (mode === 'aio' && subMode === 'manual') {
        const manualProgress = aioManualProgressByImage[imageId];
        const index =
          manualProgress?.currentIndex ?? getAioImageSnapshotIndex(imageId);
        const snapshot =
          index >= 0 ? (aioPipelineSnapshots[index] ?? null) : null;
        const canRewind = index > 0;
        const manualForwardCap = manualProgress?.unlockedMaxIndex ?? index;
        const canForward = index >= 0 && index < manualForwardCap;
        const label = snapshot?.label ?? null;
        const key = snapshot?.key ?? null;
        return { index, canRewind, canForward, label, key };
      }
      const index = getAioImageSnapshotIndex(imageId);
      const snapshot =
        index >= 0 ? (aioPipelineSnapshots[index] ?? null) : null;
      const canRewind = index > 0;
      const canForward = index >= 0 && index < aioPipelineSnapshots.length - 1;
      const label = snapshot?.label ?? null;
      const key = snapshot?.key ?? null;
      return { index, canRewind, canForward, label, key };
    },
    [
      aioManualProgressByImage,
      aioPipelineSnapshots,
      getAioImageSnapshotIndex,
      mode,
      subMode,
    ],
  );

  const getAioFallbackStageKey = useCallback((): AioPipelineSnapshotKey => {
    if (aioSteps.render) return 'render';
    if (aioSteps.cleanImage) return 'cleanImage';
    if (aioSteps.segmentText) return 'segmentText';
    if (aioSteps.getTranslations) return 'getTranslations';
    if (aioSteps.recognizeText) return 'recognizeText';
    return 'detectText';
  }, [
    aioSteps.cleanImage,
    aioSteps.getTranslations,
    aioSteps.recognizeText,
    aioSteps.render,
    aioSteps.segmentText,
  ]);

  const resolveAioStageKeyForImage = useCallback(
    (imageId: string): AioPipelineSnapshotKey => {
      if (mode === 'aio' && subMode === 'manual') {
        const manualProgress = aioManualProgressByImage[imageId];
        if (manualProgress) {
          const normalizedIndex = clamp(
            manualProgress.currentIndex,
            0,
            AIO_MANUAL_STAGE_ORDER.length - 1,
          );
          return AIO_MANUAL_STAGE_ORDER[normalizedIndex] ?? getAioFallbackStageKey();
        }
      }
      const { key } = getAioImageSnapshotMeta(imageId);
      return key ?? getAioFallbackStageKey();
    },
    [
      aioManualProgressByImage,
      getAioFallbackStageKey,
      getAioImageSnapshotMeta,
      mode,
      subMode,
    ],
  );

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

  const updateCleanerRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      setCleanerDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setCleanerSelectedRegionByImage((prev) => {
        const currentSelected = prev[imageId] ?? null;
        const resolvedSelected =
          selectedRegionIdOverride === undefined
            ? resolveSelectedRegionForRegions(clonedRegions, currentSelected)
            : resolveSelectedRegionForRegions(
                clonedRegions,
                selectedRegionIdOverride,
              );
        return {
          ...prev,
          [imageId]: resolvedSelected,
        };
      });
    },
    [resolveSelectedRegionForRegions],
  );

  const selectCleanerRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const regions = cleanerDetectionsByImage[imageId] ?? [];
      const resolvedSelected = resolveSelectedRegionForRegions(
        regions,
        regionId,
      );
      setCleanerSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
    },
    [cleanerDetectionsByImage, resolveSelectedRegionForRegions],
  );

  const getCleanerManualImageEditState = useCallback(
    (imageId: string): AioManualImageEditState =>
      cleanerManualImageEditsByImage[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE,
    [cleanerManualImageEditsByImage],
  );

  const hasCleanerManualImageEdits = useCallback(
    (imageId: string): boolean => {
      const state = cleanerManualImageEditsByImage[imageId];
      return Boolean(state?.baseImageDataUrl || state?.paintLayerDataUrl);
    },
    [cleanerManualImageEditsByImage],
  );

  const patchCleanerManualImageEditState = useCallback(
    (imageId: string, patch: Partial<AioManualImageEditState>) => {
      setCleanerManualImageEditsByImage((prev) => {
        const current = prev[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE;
        const nextValue: AioManualImageEditState = {
          ...current,
          ...patch,
        };
        const shouldDelete =
          !nextValue.paintLayerDataUrl &&
          !nextValue.baseImageDataUrl &&
          !nextValue.wandMaskDataUrl;
        if (shouldDelete) {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        }
        if (
          current.paintLayerDataUrl === nextValue.paintLayerDataUrl &&
          current.baseImageDataUrl === nextValue.baseImageDataUrl &&
          current.wandMaskDataUrl === nextValue.wandMaskDataUrl
        ) {
          return prev;
        }
        return { ...prev, [imageId]: nextValue };
      });
    },
    [],
  );

  const getAioManualImageEditState = useCallback(
    (imageId: string): AioManualImageEditState =>
      aioManualImageEditsByImage[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE,
    [aioManualImageEditsByImage],
  );

  const hasAioManualImageEdits = useCallback(
    (imageId: string): boolean => {
      const state = aioManualImageEditsByImage[imageId];
      return Boolean(state?.baseImageDataUrl || state?.paintLayerDataUrl);
    },
    [aioManualImageEditsByImage],
  );

  const patchAioManualImageEditState = useCallback(
    (imageId: string, patch: Partial<AioManualImageEditState>) => {
      setAioManualImageEditsByImage((prev) => {
        const current = prev[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE;
        const nextValue: AioManualImageEditState = {
          ...current,
          ...patch,
        };
        const shouldDelete =
          !nextValue.paintLayerDataUrl &&
          !nextValue.baseImageDataUrl &&
          !nextValue.wandMaskDataUrl &&
          !nextValue.segmentBrushDataUrl;
        if (shouldDelete) {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        }
        if (
          current.paintLayerDataUrl === nextValue.paintLayerDataUrl &&
          current.baseImageDataUrl === nextValue.baseImageDataUrl &&
          current.wandMaskDataUrl === nextValue.wandMaskDataUrl &&
          current.segmentBrushDataUrl === nextValue.segmentBrushDataUrl
        ) {
          return prev;
        }
        return { ...prev, [imageId]: nextValue };
      });
    },
    [],
  );

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

  const resolveAioEditableBaseSourceForImage = useCallback(
    (imgData: LoadedImage): string => {
      const manualState = aioManualImageEditsByImage[imgData.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
      const baseItem = getAioDownloadItemForImage(imgData.id);
      return baseItem?.previewUrl ?? imgData.url;
    },
    [aioManualImageEditsByImage, getAioDownloadItemForImage],
  );

  const resolveCleanerEditableBaseSourceForImage = useCallback(
    (imgData: LoadedImage): string => {
      const manualState = cleanerManualImageEditsByImage[imgData.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
      if (cleanerProcessedBaseByImage[imgData.id])
        return cleanerProcessedBaseByImage[imgData.id]!;
      const baseItem = getCleanerDownloadItemForImage(imgData.id);
      return baseItem?.previewUrl ?? imgData.url;
    },
    [
      cleanerManualImageEditsByImage,
      cleanerProcessedBaseByImage,
      getCleanerDownloadItemForImage,
    ],
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
  }, [images]);

  const invalidateAioPipelineHistory = useCallback(() => {
    setAioPipelineSnapshots((prev) => (prev.length > 0 ? [] : prev));
    setAioPipelineSnapshotIndex((prev) => (prev !== -1 ? -1 : prev));
    setAioImageSnapshotIndexById((prev) =>
      Object.keys(prev).length > 0 ? {} : prev,
    );
    setAioAutoHistoryAvailable(false);
    setAioManualProgressByImage((prev) =>
      Object.keys(prev).length > 0 ? {} : prev,
    );
  }, []);

  const createAioManualProgressForIndex = useCallback(
    (startIndex: number): AioManualImageProgress => {
      const boundedStartIndex = clamp(
        startIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      const statusByStage = AIO_MANUAL_STAGE_ORDER.reduce<
        Record<AioPipelineSnapshotKey, AioManualStageStatus>
      >(
        (acc, stageKey, index) => {
          if (index < boundedStartIndex) {
            acc[stageKey] = 'done';
          } else if (index === boundedStartIndex) {
            acc[stageKey] = 'pending';
          } else {
            acc[stageKey] = 'locked';
          }
          return acc;
        },
        {} as Record<AioPipelineSnapshotKey, AioManualStageStatus>,
      );
      return {
        currentIndex: boundedStartIndex,
        unlockedMaxIndex: boundedStartIndex,
        statusByStage,
      };
    },
    [],
  );

  const createAioManualProgressFromAutoIndex = useCallback(
    (completedIndex: number): AioManualImageProgress => {
      const boundedCompletedIndex = clamp(
        completedIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      const lastStageIndex = AIO_MANUAL_STAGE_ORDER.length - 1;
      const nextPendingIndex = Math.min(
        boundedCompletedIndex + 1,
        lastStageIndex,
      );
      const statusByStage = AIO_MANUAL_STAGE_ORDER.reduce<
        Record<AioPipelineSnapshotKey, AioManualStageStatus>
      >(
        (acc, stageKey, index) => {
          if (index <= boundedCompletedIndex) {
            acc[stageKey] = 'done';
          } else if (index === nextPendingIndex) {
            acc[stageKey] = 'pending';
          } else {
            acc[stageKey] = 'locked';
          }
          return acc;
        },
        {} as Record<AioPipelineSnapshotKey, AioManualStageStatus>,
      );

      return {
        currentIndex: boundedCompletedIndex,
        unlockedMaxIndex: nextPendingIndex,
        statusByStage,
      };
    },
    [],
  );

  const normalizeAioPipelineSnapshotsForManualMode = useCallback(
    (snapshots: AioPipelineSnapshot[]): AioPipelineSnapshot[] => {
      const fallbackDetections = cloneAioDetectionsMap(
        aioDetectionsByImage,
        cloneRenderStyle,
      );
      images.forEach((image) => {
        if (!fallbackDetections[image.id]) {
          fallbackDetections[image.id] = [];
        }
      });
      const fallbackSelection = {
        ...buildAioSelectionMapFromDetections(fallbackDetections),
        ...aioSelectedRegionByImage,
      };
      const snapshotsByKey = new Map<
        AioPipelineSnapshotKey,
        AioPipelineSnapshot
      >();
      snapshots.forEach((snapshot) => {
        snapshotsByKey.set(snapshot.key, snapshot);
      });

      let lastDetections = fallbackDetections;
      let lastSelection = fallbackSelection;
      let lastDownloads = cloneAioDownloadEntries(currentAioDownloadEntries);

      return AIO_MANUAL_STAGE_ORDER.map((stageKey) => {
        const existing = snapshotsByKey.get(stageKey);
        if (existing) {
          lastDetections = cloneAioDetectionsMap(
            existing.detectionsByImage,
            cloneRenderStyle,
          );
          images.forEach((image) => {
            if (!lastDetections[image.id]) {
              lastDetections[image.id] = [];
            }
          });
          lastSelection = { ...existing.selectedRegionByImage };
          lastDownloads = cloneAioDownloadEntries(existing.aioDownloads);
          return {
            key: stageKey,
            label: aioPipelineStageLabels[stageKey],
            detectionsByImage: cloneAioDetectionsMap(
              lastDetections,
              cloneRenderStyle,
            ),
            selectedRegionByImage: { ...lastSelection },
            aioDownloads: cloneAioDownloadEntries(lastDownloads),
          };
        }

        const generatedDownloads =
          stageKey === 'cleanImage' || stageKey === 'render'
            ? cloneAioDownloadEntries(lastDownloads)
            : [];
        return {
          key: stageKey,
          label: aioPipelineStageLabels[stageKey],
          detectionsByImage: cloneAioDetectionsMap(
            lastDetections,
            cloneRenderStyle,
          ),
          selectedRegionByImage: { ...lastSelection },
          aioDownloads: generatedDownloads,
        };
      });
    },
    [
      aioDetectionsByImage,
      aioSelectedRegionByImage,
      currentAioDownloadEntries,
      images,
    ],
  );

  const initializeManualProgressFromSnapshots = useCallback(
    (
      snapshots: AioPipelineSnapshot[],
      snapshotIndexByImage: Record<string, number>,
    ): Record<string, AioManualImageProgress> => {
      if (snapshots.length === 0) return {};
      const next: Record<string, AioManualImageProgress> = {};
      images.forEach((image) => {
        const explicitIndex = aioAutoHistoryAvailable
          ? snapshotIndexByImage[image.id]
          : undefined;
        if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
          next[image.id] = createAioManualProgressFromAutoIndex(
            clamp(explicitIndex, 0, snapshots.length - 1),
          );
          return;
        }
        next[image.id] = createAioManualProgressForIndex(0);
      });
      return next;
    },
    [
      aioAutoHistoryAvailable,
      createAioManualProgressForIndex,
      createAioManualProgressFromAutoIndex,
      images,
    ],
  );

  const setAioDownloadItems = useCallback((entries: AioDownloadEntry[]) => {
    setDownloadItems((prev) => {
      const keep = prev.filter((item) => item.scope !== 'aio');
      prev
        .filter((item) => item.scope === 'aio')
        .forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (entries.length === 0) return keep;
      const aioItems: DownloadItem[] = entries.map((entry) => ({
        name: entry.fileName,
        blob: entry.blob,
        scope: 'aio',
        sourceImageId: entry.sourceImageId,
        previewUrl: URL.createObjectURL(entry.blob),
      }));
      return [...keep, ...aioItems];
    });
    if (entries.length > 0) {
      setLastActionScope('aio');
    }
  }, []);

  const setAioDownloadItemForImage = useCallback(
    (imageId: string, entry: AioDownloadEntry | null) => {
      setDownloadItems((prev) => {
        const next: DownloadItem[] = [];
        prev.forEach((item) => {
          if (item.scope === 'aio' && item.sourceImageId === imageId) {
            URL.revokeObjectURL(item.previewUrl);
            return;
          }
          next.push(item);
        });
        if (entry) {
          next.push({
            name: entry.fileName,
            blob: entry.blob,
            scope: 'aio',
            sourceImageId: entry.sourceImageId,
            previewUrl: URL.createObjectURL(entry.blob),
          });
        }
        return next;
      });
      if (entry) {
        setLastActionScope('aio');
      }
    },
    [],
  );

  const handleAioSubModeChange = useCallback(
    (nextMode: SubMode) => {
      if (nextMode === subMode) return;

      if (nextMode === 'manual') {
        const normalizedSnapshots =
          normalizeAioPipelineSnapshotsForManualMode(aioPipelineSnapshots);
        const fallbackIndex =
          normalizedSnapshots.length > 0
            ? activeId
              ? (aioImageSnapshotIndexById[activeId] ?? 0)
              : 0
            : -1;
        const normalizedImageIndexById: Record<string, number> = {};
        const autoHistoryImageIds: Record<string, boolean> = {};
        images.forEach((image) => {
          const explicitIndex = aioAutoHistoryAvailable
            ? aioImageSnapshotIndexById[image.id]
            : undefined;
          if (typeof explicitIndex === 'number' && explicitIndex >= 0) {
            normalizedImageIndexById[image.id] = clamp(
              explicitIndex,
              0,
              Math.max(0, normalizedSnapshots.length - 1),
            );
            if (aioAutoHistoryAvailable) {
              autoHistoryImageIds[image.id] = true;
            }
            return;
          }
          normalizedImageIndexById[image.id] = 0;
        });

        const manualProgress = initializeManualProgressFromSnapshots(
          normalizedSnapshots,
          normalizedImageIndexById,
        );
        setAioPipelineSnapshots(normalizedSnapshots);
        setAioImageSnapshotIndexById(normalizedImageIndexById);
        setAioManualProgressByImage(manualProgress);
        if (Object.keys(autoHistoryImageIds).length > 0) {
          setAioAutoProcessedImageById((prev) => ({
            ...prev,
            ...autoHistoryImageIds,
          }));
        }
        setAioPipelineSnapshotIndex(fallbackIndex);

        if (activeId) {
          const activeProgress = manualProgress[activeId];
          if (activeProgress) {
            const snapshot =
              normalizedSnapshots[activeProgress.currentIndex] ?? null;
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
        }
      }

      setSubMode(nextMode);
    },
    [
      activeId,
      aioAutoHistoryAvailable,
      aioImageSnapshotIndexById,
      aioPipelineSnapshots,
      images,
      initializeManualProgressFromSnapshots,
      normalizeAioPipelineSnapshotsForManualMode,
      setAioDownloadItemForImage,
      subMode,
    ],
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
    createAioManualProgressForIndex,
    createAioManualProgressFromAutoIndex,
    images,
    initializeManualProgressFromSnapshots,
    mode,
    normalizeAioPipelineSnapshotsForManualMode,
    setAioDownloadItemForImage,
    subMode,
  ]);

  const applyAioPipelineSnapshot = useCallback(
    (snapshot: AioPipelineSnapshot) => {
      setAioDetectionsByImage(
        cloneAioDetectionsMap(snapshot.detectionsByImage, cloneRenderStyle),
      );
      setAioSelectedRegionByImage({ ...snapshot.selectedRegionByImage });
      setAioDownloadItems(snapshot.aioDownloads);
    },
    [setAioDownloadItems],
  );

  const resolveSnapshotSelectionForImage = useCallback(
    (
      snapshot: AioPipelineSnapshot,
      imageId: string,
      regions: AioTextRegion[],
      fallbackSelectedRegionId: string | null,
    ) => {
      const hasExplicitSelection = Object.prototype.hasOwnProperty.call(
        snapshot.selectedRegionByImage,
        imageId,
      );
      const preferredSelection = hasExplicitSelection
        ? (snapshot.selectedRegionByImage[imageId] ?? null)
        : fallbackSelectedRegionId;
      return resolveSelectedRegionForRegions(regions, preferredSelection);
    },
    [resolveSelectedRegionForRegions],
  );

  const applyAioPipelineSnapshotToImage = useCallback(
    (imageId: string, index: number): AioPipelineSnapshot | null => {
      if (index < 0 || index >= aioPipelineSnapshots.length) return null;
      const snapshot = aioPipelineSnapshots[index] ?? null;
      if (!snapshot) return null;

      const regions = cloneAioRegions(
        snapshot.detectionsByImage[imageId] ?? [],
        cloneRenderStyle,
      );
      const selectedRegionId = resolveSnapshotSelectionForImage(
        snapshot,
        imageId,
        regions,
        aioSelectedRegionByImage[imageId] ?? null,
      );
      setAioDetectionsByImage((prev) => ({ ...prev, [imageId]: regions }));
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: selectedRegionId,
      }));
      const imageDownloadEntry =
        snapshot.aioDownloads.find((item) => item.sourceImageId === imageId) ??
        null;
      setAioDownloadItemForImage(imageId, imageDownloadEntry);
      setAioImageSnapshotIndexById((prev) => ({ ...prev, [imageId]: index }));
      return snapshot;
    },
    [
      aioPipelineSnapshots,
      aioSelectedRegionByImage,
      resolveSnapshotSelectionForImage,
      setAioDownloadItemForImage,
    ],
  );

  const setManualCurrentStageForImage = useCallback(
    (imageId: string, nextIndex: number): AioPipelineSnapshot | null => {
      const manualProgress = aioManualProgressByImage[imageId];
      if (!manualProgress) return null;
      const boundedIndex = clamp(
        nextIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      if (boundedIndex > manualProgress.unlockedMaxIndex) return null;
      const snapshot = applyAioPipelineSnapshotToImage(imageId, boundedIndex);
      if (!snapshot) return null;
      setAioManualProgressByImage((prev) => {
        const current = prev[imageId];
        if (!current || current.currentIndex === boundedIndex) return prev;
        return {
          ...prev,
          [imageId]: {
            ...current,
            currentIndex: boundedIndex,
          },
        };
      });
      return snapshot;
    },
    [aioManualProgressByImage, applyAioPipelineSnapshotToImage],
  );

  const rewindAioPipeline = useCallback(() => {
    if (mode === 'aio' && subMode === 'manual') return;
    if (!canAioRewind) return;
    const nextIndex = aioPipelineSnapshotIndex - 1;
    const snapshot = aioPipelineSnapshots[nextIndex];
    if (!snapshot) return;
    applyAioPipelineSnapshot(snapshot);
    setAioPipelineSnapshotIndex(nextIndex);
    setAioImageSnapshotIndexById(buildAioImageSnapshotIndexMap(nextIndex));
    setStatusMessage(
      t('dashboard.aio.rewind', {
        label: snapshot.label,
        current: nextIndex + 1,
        total: aioPipelineSnapshots.length,
      }),
    );
  }, [
    aioPipelineSnapshotIndex,
    aioPipelineSnapshots,
    applyAioPipelineSnapshot,
    buildAioImageSnapshotIndexMap,
    canAioRewind,
    mode,
    subMode,
  ]);

  const forwardAioPipeline = useCallback(() => {
    if (mode === 'aio' && subMode === 'manual') return;
    if (!canAioForward) return;
    const nextIndex = aioPipelineSnapshotIndex + 1;
    const snapshot = aioPipelineSnapshots[nextIndex];
    if (!snapshot) return;
    applyAioPipelineSnapshot(snapshot);
    setAioPipelineSnapshotIndex(nextIndex);
    setAioImageSnapshotIndexById(buildAioImageSnapshotIndexMap(nextIndex));
    setStatusMessage(
      t('dashboard.aio.forward', {
        label: snapshot.label,
        current: nextIndex + 1,
        total: aioPipelineSnapshots.length,
      }),
    );
  }, [
    aioPipelineSnapshotIndex,
    aioPipelineSnapshots,
    applyAioPipelineSnapshot,
    buildAioImageSnapshotIndexMap,
    canAioForward,
    mode,
    subMode,
  ]);

  const rewindAioPipelineForImage = useCallback(
    (imageId: string) => {
      const currentIndex = getAioImageSnapshotIndex(imageId);
      if (currentIndex <= 0) return;
      const nextIndex = currentIndex - 1;
      const snapshot =
        mode === 'aio' && subMode === 'manual'
          ? setManualCurrentStageForImage(imageId, nextIndex)
          : applyAioPipelineSnapshotToImage(imageId, nextIndex);
      if (!snapshot) return;
      const imageName =
        images.find((img) => img.id === imageId)?.file.name ?? 'image';
      setStatusMessage(
        t('dashboard.aio.rewindImage', {
          imageName,
          label: snapshot.label,
          current: nextIndex + 1,
          total: aioPipelineSnapshots.length,
        }),
      );
    },
    [
      aioPipelineSnapshots.length,
      applyAioPipelineSnapshotToImage,
      getAioImageSnapshotIndex,
      images,
      mode,
      setManualCurrentStageForImage,
      subMode,
    ],
  );

  const forwardAioPipelineForImage = useCallback(
    (imageId: string) => {
      const currentIndex = getAioImageSnapshotIndex(imageId);
      if (currentIndex < 0) return;
      if (mode !== 'aio' || subMode !== 'manual') {
        if (currentIndex >= aioPipelineSnapshots.length - 1) return;
      } else {
        const manualProgress = aioManualProgressByImage[imageId];
        if (!manualProgress || currentIndex >= manualProgress.unlockedMaxIndex)
          return;
      }
      const nextIndex = currentIndex + 1;
      const snapshot =
        mode === 'aio' && subMode === 'manual'
          ? setManualCurrentStageForImage(imageId, nextIndex)
          : applyAioPipelineSnapshotToImage(imageId, nextIndex);
      if (!snapshot) return;
      const imageName =
        images.find((img) => img.id === imageId)?.file.name ?? 'image';
      setStatusMessage(
        t('dashboard.aio.forwardImage', {
          imageName,
          label: snapshot.label,
          current: nextIndex + 1,
          total: aioPipelineSnapshots.length,
        }),
      );    },
    [
      aioManualProgressByImage,
      aioPipelineSnapshots.length,
      applyAioPipelineSnapshotToImage,
      getAioImageSnapshotIndex,
      images,
      mode,
      setManualCurrentStageForImage,
      subMode,
    ],
  );

  const selectedDetectModel = useMemo(
    () =>
      aioStageOptions.detectText.find(
        (option) => option.key === aioStageSelection.detectText,
      ) ?? null,
    [aioStageOptions.detectText, aioStageSelection.detectText],
  );
  const filteredOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, aioSrcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [aioSrcLang, aioStageOptions.recognizeText]);
  const filteredCleanerOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, cleanerSrcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [cleanerSrcLang, aioStageOptions.recognizeText]);
  const selectedOcrModel = useMemo(
    () =>
      filteredOcrStageOptions.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ??
      aioStageOptions.recognizeText.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ??
      null,
    [
      aioStageOptions.recognizeText,
      aioStageSelection.recognizeText,
      filteredOcrStageOptions,
    ],
  );
  const selectedTranslationModelState = useMemo(
    () => modelManagerState.entries[aioStageSelection.getTranslations] ?? null,
    [aioStageSelection.getTranslations, modelManagerState.entries],
  );
  const translatorSelectedLocalTranslationCompatible = useMemo(() => {
    if (!selectedTranslationModelState) return true;
    const modelDefinition =
      TRANSLATION_MODELS_BY_ID[selectedTranslationModelState.model.id] ?? null;
    if (!modelDefinition) return true;
    return modelSupportsLanguage(modelDefinition, srcLang, tgtLang);
  }, [selectedTranslationModelState, srcLang, tgtLang]);
  const selectedLegacyTranslationOption = useMemo(
    () =>
      aioStageOptions.getTranslations.find(
        (option) => option.key === aioStageSelection.getTranslations,
      ) ?? null,
    [aioStageOptions.getTranslations, aioStageSelection.getTranslations],
  );
  const selectedSegmentModel = useMemo(
    () =>
      aioStageOptions.segmentText.find(
        (option) => option.key === aioStageSelection.segmentText,
      ) ?? null,
    [aioStageOptions.segmentText, aioStageSelection.segmentText],
  );
  const selectedCleanModel = useMemo(
    () =>
      aioStageOptions.cleanImage.find(
        (option) => option.key === aioStageSelection.cleanImage,
      ) ?? null,
    [aioStageOptions.cleanImage, aioStageSelection.cleanImage],
  );
  const translationCustomProfiles = useMemo(
    () =>
      customLlmProfiles.filter((profile) => profile.stage === 'translation'),
    [customLlmProfiles],
  );
  const ocrCustomProfiles = useMemo(
    () => customLlmProfiles.filter((profile) => profile.stage === 'ocr'),
    [customLlmProfiles],
  );
  const cleanCustomProfiles = useMemo(
    () => customLlmProfiles.filter((profile) => profile.stage === 'clean'),
    [customLlmProfiles],
  );
  const translationStandaloneCustomProfiles = useMemo(
    () =>
      translationCustomProfiles.filter(
        (profile) => !parseFreeProviderProfileId(profile.id),
      ),
    [translationCustomProfiles],
  );
  const ocrStandaloneCustomProfiles = useMemo(
    () =>
      ocrCustomProfiles.filter(
        (profile) => !parseFreeProviderProfileId(profile.id),
      ),
    [ocrCustomProfiles],
  );
  const cleanStandaloneCustomProfiles = useMemo(
    () =>
      cleanCustomProfiles.filter(
        (profile) => !parseFreeProviderProfileId(profile.id),
      ),
    [cleanCustomProfiles],
  );
  const translationFreeProviders = useMemo(
    () => getFreeProvidersForStage('translation'),
    [],
  );
  const ocrFreeProviders = useMemo(() => getFreeProvidersForStage('ocr'), []);
  const cleanFreeProviders = useMemo(() => getFreeProvidersForStage('clean'), []);
  const customTranslationStageOptions = useMemo(
    () =>
      translationCustomProfiles.map((profile) =>
        buildCustomStageOption(profile),
      ),
    [buildCustomStageOption, translationCustomProfiles],
  );
  const customOcrStageOptions = useMemo(
    () => ocrCustomProfiles.map((profile) => buildCustomStageOption(profile)),
    [buildCustomStageOption, ocrCustomProfiles],
  );
  const selectedCustomTranslationProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        aioStageSelection.getTranslations,
        translationCustomProfiles,
      ),
    [aioStageSelection.getTranslations, translationCustomProfiles],
  );
  const selectedCustomOcrProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        aioStageSelection.recognizeText,
        ocrCustomProfiles,
      ),
    [aioStageSelection.recognizeText, ocrCustomProfiles],
  );
  const selectedCleanerCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(cleanerAiModelKey, cleanCustomProfiles),
    [cleanerAiModelKey, cleanCustomProfiles],
  );
  const selectedTranslatorSfxCleanCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        translatorSfxCleanModelKey,
        ocrCustomProfiles,
      ),
    [ocrCustomProfiles, translatorSfxCleanModelKey],
  );
  const cleanerAiCustomProviderNotice = useMemo(
    () =>
      getCustomLlmProviderNotice(selectedCleanerCustomProfile?.apiBase ?? customLlmDrafts.ocr.apiBase),
    [customLlmDrafts.ocr.apiBase, selectedCleanerCustomProfile?.apiBase],
  );
  const translationStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.getTranslations;
    const selectedOption = selectedCustomTranslationProfile
      ? buildCustomStageOption(selectedCustomTranslationProfile)
      : (customTranslationStageOptions.find(
          (option) => option.key === selectedKey,
        ) ?? null);
    if (!selectedOption) {
      return aioStageOptions.getTranslations;
    }
    if (
      aioStageOptions.getTranslations.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return aioStageOptions.getTranslations;
    }
    return [...aioStageOptions.getTranslations, selectedOption];
  }, [
    aioStageOptions.getTranslations,
    aioStageSelection.getTranslations,
    buildCustomStageOption,
    customTranslationStageOptions,
    selectedCustomTranslationProfile,
  ]);
  const ocrStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const selectedOption = selectedCustomOcrProfile
      ? buildCustomStageOption(selectedCustomOcrProfile)
      : (customOcrStageOptions.find((option) => option.key === selectedKey) ??
        null);
    if (!selectedOption) {
      return filteredOcrStageOptions;
    }
    if (
      filteredOcrStageOptions.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return filteredOcrStageOptions;
    }
    return [...filteredOcrStageOptions, selectedOption];
  }, [
    aioStageSelection.recognizeText,
    buildCustomStageOption,
    customOcrStageOptions,
    filteredOcrStageOptions,
    selectedCustomOcrProfile,
  ]);
  const filteredTranslatorOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, srcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [aioStageOptions.recognizeText, srcLang]);
  const translatorOcrStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const selectedOption = selectedCustomOcrProfile
      ? buildCustomStageOption(selectedCustomOcrProfile)
      : (customOcrStageOptions.find((option) => option.key === selectedKey) ??
        null);
    if (!selectedOption) {
      return filteredTranslatorOcrStageOptions;
    }
    if (
      filteredTranslatorOcrStageOptions.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return filteredTranslatorOcrStageOptions;
    }
    return [...filteredTranslatorOcrStageOptions, selectedOption];
  }, [
    aioStageSelection.recognizeText,
    buildCustomStageOption,
    customOcrStageOptions,
    filteredTranslatorOcrStageOptions,
    selectedCustomOcrProfile,
  ]);
  const selectedTranslationCloudOption = useMemo(
    () =>
      translationStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.getTranslations,
      ) ?? null,
    [aioStageSelection.getTranslations, translationStageOptionsForSelect],
  );
  const selectedOcrCloudOption = useMemo(
    () =>
      ocrStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ?? null,
    [aioStageSelection.recognizeText, ocrStageOptionsForSelect],
  );
  const selectedTranslatorOcrCloudOption = useMemo(
    () =>
      translatorOcrStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ?? null,
    [aioStageSelection.recognizeText, translatorOcrStageOptionsForSelect],
  );
  const cleanerAiCustomOptionsForSelect = useMemo(
    () =>
      cleanCustomProfiles.map((profile) => ({
        ...buildCustomStageOption(profile),
        key: `custom_clean:${profile.id}`,
      })),
    [buildCustomStageOption, cleanCustomProfiles],
  );
  const cleanerAiOptionsForSelect = useMemo(() => {
    const customSelectedOption = cleanerAiCustomOptionsForSelect.find(
      (option) => option.key === cleanerAiModelKey,
    );
    if (customSelectedOption) {
      return [customSelectedOption];
    }
    return [...cleanerAiCustomOptionsForSelect];
  }, [
    cleanerAiCustomOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedCleanerAiDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find((option) => option.key === cleanerAiModelKey)
      ?? null
    );
  }, [
    cleanerAiOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedTranslatorSfxCleanDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find(
        (option) => option.key === translatorSfxCleanModelKey,
      ) ?? null
    );
  }, [cleanerAiOptionsForSelect, translatorSfxCleanModelKey]);
  const selectedTranslationLlmCapabilities = useMemo(
    () =>
      selectedTranslationCloudOption?.llm_capabilities ??
      inferLlmCapabilitiesForModelSelection(
        'translation',
        aioStageSelection.getTranslations,
      ),
    [
      aioStageSelection.getTranslations,
      selectedTranslationCloudOption?.llm_capabilities,
    ],
  );
  const selectedOcrLlmCapabilities = useMemo(
    () =>
      selectedOcrCloudOption?.llm_capabilities ??
      inferLlmCapabilitiesForModelSelection(
        'ocr',
        aioStageSelection.recognizeText,
      ),
    [aioStageSelection.recognizeText, selectedOcrCloudOption?.llm_capabilities],
  );
  const translationSelectionUsesLlmSettings = useMemo(
    () =>
      Boolean(
        aioSteps.getTranslations &&
        hasAnyLlmCapability(selectedTranslationLlmCapabilities),
      ),
    [aioSteps.getTranslations, selectedTranslationLlmCapabilities],
  );
  const ocrSelectionUsesLlmSettings = useMemo(
    () =>
      Boolean(
        aioSteps.recognizeText &&
        hasAnyLlmCapability(selectedOcrLlmCapabilities),
      ),
    [aioSteps.recognizeText, selectedOcrLlmCapabilities],
  );
  const showLlmSettingsPanel =
    translationSelectionUsesLlmSettings || ocrSelectionUsesLlmSettings;
  const llmSettingsSupportSummary = useMemo(() => {
    const enabledStages: string[] = [];
    if (translationSelectionUsesLlmSettings) {
      enabledStages.push(t('dashboard.status.stageLabelTranslation'));
    }
    if (ocrSelectionUsesLlmSettings) {
      enabledStages.push('OCR');
    }
    return enabledStages.join(' + ');
  }, [ocrSelectionUsesLlmSettings, translationSelectionUsesLlmSettings]);
  const markPendingCustomSelection = useCallback(
    (stage: CustomLlmStage, selectionKey: string | null) => {
      setPendingCustomSelections((prev) => ({
        ...prev,
        [stage]: selectionKey,
      }));
    },
    [],
  );
  const applyCustomProfileSelection = useCallback(
    (stage: CustomLlmStage, profile: CustomLlmProfile) => {
      const selectionKey = toCustomModelSelectionKey(profile);
      const customOption = buildCustomStageOption(profile);
      markPendingCustomSelection(stage, selectionKey);
      setAioStageOptions((prev) => {
        if (stage === 'translation') {
          const exists = prev.getTranslations.some(
            (item) => item.key === customOption.key,
          );
          return exists
            ? prev
            : {
                ...prev,
                getTranslations: [...prev.getTranslations, customOption],
              };
        }
        const exists = prev.recognizeText.some(
          (item) => item.key === customOption.key,
        );
        return exists
          ? prev
          : { ...prev, recognizeText: [...prev.recognizeText, customOption] };
      });
      setAioStageSelection((prev) =>
        stage === 'translation'
          ? { ...prev, getTranslations: selectionKey }
          : { ...prev, recognizeText: selectionKey },
      );
    },
    [buildCustomStageOption, markPendingCustomSelection],
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

  const isInstalledLocalAioEntry = useCallback(
    (modelKey: string): boolean => {
      const entry = modelManagerState.entries[modelKey];
      if (!entry) {
        return false;
      }
      return (
        entry.status === 'installed' || entry.status === 'update_available'
      );
    },
    [modelManagerState.entries],
  );

  const isStageOptionSelectable = useCallback(
    (option: AioStageOption | null | undefined): boolean => {
      if (!option) {
        return false;
      }
      if (option.key === 'custom' || option.key === 'custom_ocr') {
        return false;
      }
      if (modelManagerState.entries[option.key]) {
        return isInstalledLocalAioEntry(option.key);
      }
      return option.implemented && option.available;
    },
    [
      isInstalledLocalAioEntry,
      modelManagerState.entries,
    ],
  );

  const availableDetectStageOptions = useMemo(
    () =>
      aioStageOptions.detectText.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [aioStageOptions.detectText, isStageOptionSelectable],
  );
  const availableSegmentStageOptions = useMemo(
    () =>
      aioStageOptions.segmentText.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [aioStageOptions.segmentText, isStageOptionSelectable],
  );
  const availableCleanStageOptions = useMemo(
    () =>
      aioStageOptions.cleanImage.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [aioStageOptions.cleanImage, isStageOptionSelectable],
  );
  const availableTranslationStageOptions = useMemo(
    () =>
      translationStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, translationStageOptionsForSelect],
  );
  const availableOcrStageOptions = useMemo(
    () =>
      ocrStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, ocrStageOptionsForSelect],
  );
  const translatorAvailableOcrStageOptions = useMemo(
    () =>
      translatorOcrStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, translatorOcrStageOptionsForSelect],
  );
  const cleanerAvailableOcrStageOptions = useMemo(
    () =>
      filteredCleanerOcrStageOptions.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, filteredCleanerOcrStageOptions],
  );
  const cleanerAvailableSegmentStageOptions = availableSegmentStageOptions;
  const cleanerAvailableCleanStageOptions = availableCleanStageOptions;
  const normalizedAioSourceLanguage = useMemo(
    () => normalizePresetLanguage(aioSrcLang),
    [aioSrcLang],
  );
  const {
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
    aioSrcLang,
    aioLanguageSourceOptions: aioLanguageOptions.source,
    aioPresetState,
    setAioPresetState,
    aioStageSelectionRef,
    setAioStageSelection,
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
    aioStageOptions,
    ocrStageOptionsForSelect,
    filteredOcrStageOptions,
    modelEntries: modelManagerState.entries,
    aioStageSelection,
    setAioStageSelection,
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
  } = useFreeProviderProfiles({
    userId: authUser?.id ?? null,
    customLlmProfiles,
    setCustomLlmProfiles,
    setCustomLlmProfilesMode,
    setCustomLlmProfilesError,
    syncFreeProviderDraftsFromProfiles,
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
    customLlmProfiles,
    setCustomLlmProfiles,
    setCustomLlmProfilesMode,
    setCustomLlmProfilesError,
    customLlmDrafts,
    setCustomLlmDrafts,
    aioStageSelection,
    setAioStageSelection,
    applyCustomProfileSelection,
    syncFreeProviderDraftsFromProfiles,
    markPendingCustomSelection,
    setStatusMessage,
    ollamaLocalApiBase: OLLAMA_LOCAL_API_BASE,
  });

  const llmProfilesPersistenceHint = useMemo(() => {
    if (customLlmProfilesMode === 'desktop_secure') {
      return t('dashboard.status.profilesPersistedDesktopSecure');
    }
    if (customLlmProfilesMode === 'desktop_local') {
      return t('dashboard.status.profilesPersistedDesktopLocal');
    }
    return t('dashboard.status.profilesPersistedBrowser');
  }, [customLlmProfilesMode]);
  const testFreeProviderConfig = useCallback(async (
    stage: FreeProviderStage,
    provider: FreeAiProviderCatalogEntry,
    draft: FreeProviderDraftValue,
  ): Promise<{ ok: boolean; message: string }> => {
    const definition = provider.stages[stage];
    if (!definition) {
      return { ok: false, message: 'Provider/stage configuration not found.' };
    }

    const response = await fetch(`${apiConfig.localUrl.replace(/\/+$/, '')}/provider/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transport: definition.transport,
        stage,
        apiBase: draft.apiBase,
        apiKey: draft.apiKey,
        model: draft.model,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      detail?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        message: payload?.detail || payload?.message || `Backend returned ${response.status}`,
      };
    }

    return {
      ok: Boolean(payload?.ok),
      message: payload?.message || (payload?.ok ? 'Provider test succeeded.' : 'Provider test failed.'),
    };
  }, [apiConfig.localUrl]);
  const testCustomProfileConfig = useCallback(async (
    stage: FreeProviderStage,
    profile: CustomLlmProfile,
  ): Promise<{ ok: boolean; message: string }> => (
    testFreeProviderConfig(
      stage,
      {
        id: `custom-${profile.id}`,
        name: profile.label,
        status: 'integrated',
        lastVerifiedAt: '',
        docsUrl: '',
        setupUrl: '',
        limitsUrl: '',
        rateLimitsUrl: '',
        setupSummary: '',
        limitsSummary: '',
        rateLimitSummary: '',
        stages: {
          [stage]: {
            stage,
            requiresUserApiKey: true,
            transport: inferCustomLlmTransport(profile.apiBase, stage),
            apiBaseTemplate: profile.apiBase,
            defaultApiBase: profile.apiBase,
            defaultModel: profile.model,
            configFields: [],
            models: [],
            allowCustomModelInput: true,
            modelInputPlaceholder: profile.model,
          },
        },
      },
      {
        apiBase: profile.apiBase,
        apiKey: profile.apiKey,
        model: profile.model,
        params: {},
      },
    )
  ), [testFreeProviderConfig]);
  const translationFreeProviderManagerSection = useMemo(
    () => (
      <FreeProviderManagerSection
        stage="translation"
        providers={translationFreeProviders}
        standaloneProfiles={translationStandaloneCustomProfiles}
        selectedModelKey={aioStageSelection.getTranslations}
        getDraft={getFreeProviderDraft}
        getSelectedProfileLabel={getSelectedFreeProviderProfileLabel}
        onDraftChange={updateFreeProviderDraft}
        onSaveProvider={saveFreeProviderProfile}
        onUseProvider={useFreeProviderProfile}
        onTestProvider={testFreeProviderConfig}
        onUseCustomProfile={(profileId) =>
          useCustomProfileById('translation', profileId)
        }
        onTestCustomProfile={(profile) => testCustomProfileConfig('translation', profile)}
        onSaveCustomProfile={(draft) => {
          void saveCustomProfileInline('translation', draft);
        }}
        onDeleteCustomProfile={(profileId) => {
          void removeCustomLlmProfileById('translation', profileId);
        }}
        toSelectionKey={toCustomModelSelectionKey}
      />
    ),
    [
      aioStageSelection.getTranslations,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      removeCustomLlmProfileById,
      saveCustomProfileInline,
      saveFreeProviderProfile,
      testCustomProfileConfig,
      testFreeProviderConfig,
      translationStandaloneCustomProfiles,
      translationFreeProviders,
      useCustomProfileById,
      useFreeProviderProfile,
      updateFreeProviderDraft,
    ],
  );
  const ocrFreeProviderManagerSection = useMemo(
    () => (
      <FreeProviderManagerSection
        stage="ocr"
        providers={ocrFreeProviders}
        standaloneProfiles={ocrStandaloneCustomProfiles}
        selectedModelKey={aioStageSelection.recognizeText}
        getDraft={getFreeProviderDraft}
        getSelectedProfileLabel={getSelectedFreeProviderProfileLabel}
        onDraftChange={updateFreeProviderDraft}
        onSaveProvider={saveFreeProviderProfile}
        onUseProvider={useFreeProviderProfile}
        onTestProvider={testFreeProviderConfig}
        onUseCustomProfile={(profileId) =>
          useCustomProfileById('ocr', profileId)
        }
        onTestCustomProfile={(profile) => testCustomProfileConfig('ocr', profile)}
        onSaveCustomProfile={(draft) => {
          void saveCustomProfileInline('ocr', draft);
        }}
        onDeleteCustomProfile={(profileId) => {
          void removeCustomLlmProfileById('ocr', profileId);
        }}
        toSelectionKey={toCustomModelSelectionKey}
      />
    ),
    [
      aioStageSelection.recognizeText,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      ocrStandaloneCustomProfiles,
      ocrFreeProviders,
      removeCustomLlmProfileById,
      saveCustomProfileInline,
      saveFreeProviderProfile,
      testCustomProfileConfig,
      testFreeProviderConfig,
      useCustomProfileById,
      useFreeProviderProfile,
      updateFreeProviderDraft,
    ],
  );
  const translationCustomProfilesManagerSection = useMemo(
    () => (
      <CustomLlmProfilesManagerSection
        stage="translation"
        profiles={translationStandaloneCustomProfiles}
        draft={customLlmDrafts.translation}
        loading={customLlmProfilesLoading}
        error={customLlmProfilesError}
        persistenceHint={llmProfilesPersistenceHint}
        providerNotice={translationCustomProviderNotice}
        onLoadProfile={(profileId) =>
          loadCustomLlmDraftFromProfile('translation', profileId)
        }
        onUpdateDraft={(patch) => updateCustomLlmDraft('translation', patch)}
        onUseExisting={() => useExistingCustomProfile('translation')}
        onResetDraft={() => resetCustomLlmDraft('translation')}
        onRemoveDraft={() => removeCustomLlmDraftProfile('translation')}
        onSaveDraft={() => saveCustomLlmDraftProfile('translation')}
        onApplyOllamaPreset={applyOllamaPresetToTranslationDraft}
      />
    ),
    [
      applyOllamaPresetToTranslationDraft,
      customLlmDrafts.translation,
      customLlmProfilesError,
      customLlmProfilesLoading,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      removeCustomLlmDraftProfile,
      resetCustomLlmDraft,
      saveCustomLlmDraftProfile,
      translationCustomProviderNotice,
      translationStandaloneCustomProfiles,
      updateCustomLlmDraft,
      useExistingCustomProfile,
    ],
  );
  const ocrCustomProfilesManagerSection = useMemo(
    () => (
      <CustomLlmProfilesManagerSection
        stage="ocr"
        profiles={ocrStandaloneCustomProfiles}
        draft={customLlmDrafts.ocr}
        loading={customLlmProfilesLoading}
        error={customLlmProfilesError}
        persistenceHint={llmProfilesPersistenceHint}
        providerNotice={ocrCustomProviderNotice}
        onLoadProfile={(profileId) =>
          loadCustomLlmDraftFromProfile('ocr', profileId)
        }
        onUpdateDraft={(patch) => updateCustomLlmDraft('ocr', patch)}
        onUseExisting={() => useExistingCustomProfile('ocr')}
        onResetDraft={() => resetCustomLlmDraft('ocr')}
        onRemoveDraft={() => removeCustomLlmDraftProfile('ocr')}
        onSaveDraft={() => saveCustomLlmDraftProfile('ocr')}
      />
    ),
    [
      customLlmDrafts.ocr,
      customLlmProfilesError,
      customLlmProfilesLoading,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      ocrCustomProviderNotice,
      ocrStandaloneCustomProfiles,
      removeCustomLlmDraftProfile,
      resetCustomLlmDraft,
      saveCustomLlmDraftProfile,
      updateCustomLlmDraft,
      useExistingCustomProfile,
    ],
  );
  const {
    availableRenderFonts,
    renderFontsLoading,
    renderFontsImporting,
    renderFontsError,
    renderFontRefreshToken,
    loadRenderFontCatalog,
    handleRenderFontImport,
  } = useRenderFontCatalog({
    onImportSuccess: setStatusMessage,
  });
  const activeSelectedRenderStyle = useMemo(
    () =>
      cloneRenderStyle(activeSelectedRegion?.renderStyle ?? renderDefaultStyle),
    [activeSelectedRegion?.renderStyle, renderDefaultStyle],
  );
  const activeSelectedRenderMode = useMemo<RenderTextMode>(
    () => activeSelectedRegion?.renderMode ?? 'auto',
    [activeSelectedRegion?.renderMode],
  );
  const activeSelectedDetectedRenderMode = useMemo(
    () => activeSelectedRegion?.detectedRenderMode ?? 'text_bubble',
    [activeSelectedRegion?.detectedRenderMode],
  );
  const activeSelectedResolvedRenderMode = useMemo(
    () =>
      resolveRenderTextMode({
        renderMode: activeSelectedRenderMode,
        detectedRenderMode: activeSelectedDetectedRenderMode,
      }),
    [activeSelectedDetectedRenderMode, activeSelectedRenderMode],
  );
  const activeTypographerPreset = useMemo(() => {
    const sessionPreset = activeTypographerSession?.activePresetId
      ? (typographyPresetState.presets.find(
          (preset) => preset.id === activeTypographerSession.activePresetId,
        ) ?? null)
      : null;
    if (sessionPreset) return sessionPreset;
    return resolveTypographyPresetForMode(
      activeSelectedResolvedRenderMode,
      typographyPresetState,
    );
  }, [
    activeSelectedResolvedRenderMode,
    activeTypographerSession?.activePresetId,
    typographyPresetState,
  ]);
  const activeTypographerQueueItem = useMemo(
    () =>
      activeTypographerSession?.queue.find(
        (item) => item.id === typographerQueueSelectedId,
      ) ?? null,
    [activeTypographerSession?.queue, typographerQueueSelectedId],
  );
  const defaultBubbleTypographyPreset = useMemo(
    () => resolveTypographyPresetForMode('text_bubble', typographyPresetState),
    [typographyPresetState],
  );
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
    typographerQueueSelectedId,
    typographerSelectedSnapshotId,
  ]);
  const activeImageSnapshotMeta = useMemo(
    () =>
      resolvedActiveId ? getAioImageSnapshotMeta(resolvedActiveId) : null,
    [getAioImageSnapshotMeta, resolvedActiveId],
  );
  const activeAioStageKey = useMemo<AioPipelineSnapshotKey>(
    () => activeImageSnapshotMeta?.key ?? getAioFallbackStageKey(),
    [activeImageSnapshotMeta?.key, getAioFallbackStageKey],
  );
  const activeManualProgress = useMemo(
    () =>
      resolvedActiveId
        ? (aioManualProgressByImage[resolvedActiveId] ?? null)
        : null,
    [aioManualProgressByImage, resolvedActiveId],
  );
  const activeManualStageStatus = useMemo<AioManualStageStatus | null>(() => {
    if (!activeManualProgress) return null;
    return activeManualProgress.statusByStage[activeAioStageKey] ?? null;
  }, [activeAioStageKey, activeManualProgress]);
  const aioFooterProcessingLabel = useMemo(() => {
    if (mode !== 'aio' || !processing || !aioExecutionStatus) {
      return null;
    }

    const scopeLabel =
      aioExecutionStatus.scope === 'manual' ? t('dashboard.status.aioScopeManual') : t('dashboard.status.aioScopeAuto');
    return `${scopeLabel}: ${aioExecutionStatus.label}`;
  }, [aioExecutionStatus, mode, processing]);
  const aioExecuteButtonProcessingLabel = useMemo(() => {
    if (mode !== 'aio' || !processing || !aioExecutionStatus) {
      return `Executando ${Math.round(progress)}%`;
    }

    const stageLabel = aioExecutionStatus.stageKey
      ? capitalizeStageLabel(
          aioPipelineStageProgressLabels[
            aioExecutionStatus.stageKey as AioPipelineSnapshotKey
          ],
        )
      : 'Executando';
    return `${stageLabel} ${Math.round(progress)}%`;
  }, [aioExecutionStatus, mode, processing, progress]);
  const activeImageRenderStageActive = useMemo(() => {
    if (mode !== 'aio') return true;
    if (subMode === 'manual') return activeAioStageKey === 'render';
    if (!aioSteps.render) return true;
    if (!activeImageSnapshotMeta) return true;
    return (
      activeImageSnapshotMeta.key === 'render' ||
      activeImageSnapshotMeta.key === null
    );
  }, [
    activeAioStageKey,
    activeImageSnapshotMeta,
    aioSteps.render,
    mode,
    subMode,
  ]);
  const isAioManualMode = useMemo(
    () => mode === 'aio' && subMode === 'manual',
    [mode, subMode],
  );
  const isCleanerToolMode = mode === 'cleaner';
  const activeStageAllowsAreaTools = useMemo(
    () =>
      isAioManualMode &&
      (activeAioStageKey === 'detectText' || activeAioStageKey === 'render'),
    [activeAioStageKey, isAioManualMode],
  );
  const activeStageAllowsSegmentTools = useMemo(
    () =>
      (isAioManualMode && activeAioStageKey === 'segmentText') ||
      (isCleanerToolMode && activeCleanerDetections.length > 0),
    [
      activeAioStageKey,
      activeCleanerDetections.length,
      isAioManualMode,
      isCleanerToolMode,
    ],
  );
  const activeStageAllowsManualImageTools = useMemo(
    () =>
      (isAioManualMode && activeAioStageKey === 'render') ||
      (isCleanerToolMode && Boolean(resolvedActiveId)),
    [
      activeAioStageKey,
      isAioManualMode,
      isCleanerToolMode,
      resolvedActiveId,
    ],
  );
  const areaSelectionToolActive =
    segmentEditTool === 'select' && manualImageTool === 'none';
  useEffect(() => {
    if (!activeStageAllowsSegmentTools && segmentEditTool !== 'select') {
      setSegmentEditTool('select');
    }
  }, [activeStageAllowsSegmentTools, segmentEditTool]);
  useEffect(() => {
    if (!activeStageAllowsManualImageTools && manualImageTool !== 'none') {
      setManualImageTool('none');
      return;
    }
    if (!activeStageAllowsManualImageTools || manualImageTool === 'none') {
      const areaSelectionHasConfig =
        activeStageAllowsAreaTools &&
        segmentEditTool === 'select' &&
        manualImageTool === 'none';
      if (!areaSelectionHasConfig) {
        setManualToolsConfigOpen(false);
      }
    }
  }, [activeStageAllowsAreaTools, activeStageAllowsManualImageTools, manualImageTool, segmentEditTool]);
  const activeManualImageEditState = useMemo(() => {
    if (!resolvedActiveId) return EMPTY_AIO_MANUAL_EDIT_STATE;
    if (mode === 'cleaner')
      return getCleanerManualImageEditState(resolvedActiveId);
    return getAioManualImageEditState(resolvedActiveId);
  }, [
    getAioManualImageEditState,
    getCleanerManualImageEditState,
    mode,
    resolvedActiveId,
  ]);
  const activeManualHealingBusy = useMemo(
    () =>
      Boolean(
        resolvedActiveId &&
        (mode === 'cleaner'
          ? cleanerHealingBusyByImage[resolvedActiveId]
          : aioManualHealingBusyByImage[resolvedActiveId]),
      ),
    [
      aioManualHealingBusyByImage,
      cleanerHealingBusyByImage,
      mode,
      resolvedActiveId,
    ],
  );
  const activeHasManualPaintLayer = useMemo(
    () => Boolean(activeManualImageEditState.paintLayerDataUrl),
    [activeManualImageEditState.paintLayerDataUrl],
  );
  const activeHasManualBaseOverride = useMemo(
    () => Boolean(activeManualImageEditState.baseImageDataUrl),
    [activeManualImageEditState.baseImageDataUrl],
  );
  const activeHasManualWandSelection = useMemo(
    () => Boolean(activeManualImageEditState.wandMaskDataUrl),
    [activeManualImageEditState.wandMaskDataUrl],
  );
  const activeSelectedTranslationNotes = useMemo(
    () =>
      activeSelectedRegion
        ? getRegionTranslationNotesForDisplay(
            activeSelectedRegion,
            llmSettings.translation_notes_enabled,
          )
        : [],
    [activeSelectedRegion, llmSettings.translation_notes_enabled],
  );
  const activeCleanerRunMeta = useMemo(
    () => (activeId ? (cleanerRunMetaByImage[activeId] ?? null) : null),
    [activeId, cleanerRunMetaByImage],
  );
  const useExistingCleanerCustomProfile = useCallback(() => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileFirst'), 'error');
      return;
    }
    const profile =
      cleanStandaloneCustomProfiles.find((item) => item.id === profileId) ?? null;
    if (!profile) {
      setTonedStatus(t('dashboard.status.cleanerProfileNotFound'), 'error');
      return;
    }
    setCleanerAiModelKey(`custom_clean:${profile.id}`);
    setStatusMessage(t('dashboard.status.cleanerProfileInUse', { label: profile.label }));
  }, [customLlmDrafts.clean?.id, cleanStandaloneCustomProfiles, setStatusMessage]);
  const selectCleanerAiModel = useCallback(
    (modelKey: string) => {
      const option = cleanerAiOptionsForSelect.find(
        (item) => item.key === modelKey,
      );
      if (!option) {
        setTonedStatus(t('dashboard.status.cleanerSelectValidModel'), 'error');
        return;
      }
      if (!option.implemented) {
        setTonedStatus(t('dashboard.status.modelInRoadmap', { name: option.name }), 'error');
        return;
      }
      if (!option.available) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setCleanerAiModelKey(modelKey);
    },
    [cleanerAiOptionsForSelect, setStatusMessage],
  );
  const selectTranslatorSfxCleanModel = useCallback(
    (modelKey: string) => {
      const option = cleanerAiOptionsForSelect.find(
        (item) => item.key === modelKey,
      );
      if (!option) {
        setTonedStatus(t('dashboard.status.translatorSfxSelectValidModel'), 'error');
        return;
      }
      if (!option.implemented) {
        setTonedStatus(t('dashboard.status.modelInRoadmap', { name: option.name }), 'error');
        return;
      }
      if (!option.available) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setTranslatorSfxCleanModelKey(modelKey);
    },
    [cleanerAiOptionsForSelect, setStatusMessage],
  );
  const saveCleanerCustomDraftProfile = useCallback(async () => {
    try {
      const profile = await saveCustomProfileInline('clean', customLlmDrafts.clean);
      setCleanerAiModelKey(`custom_clean:${profile.id}`);
      setTonedStatus(t('dashboard.status.cleanerProfileSaved', { label: profile.label }), 'success');
    } catch {
      // saveCustomProfileInline already updates the error message
    }
  }, [customLlmDrafts.clean, saveCustomProfileInline, setStatusMessage]);
  const removeCleanerCustomDraftProfile = useCallback(async () => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileToRemove'), 'error');
      return;
    }
    await removeCustomLlmProfileById('clean', profileId);
    if (cleanerAiModelKey === `custom_clean:${profileId}`) {
      const fallbackManagedKey = cleanerAiOptionsForSelect[0]?.key ?? '';
      if (fallbackManagedKey) {
        setCleanerAiModelKey(fallbackManagedKey);
      }
    }
  }, [
    cleanerAiModelKey,
    cleanerAiOptionsForSelect,
    customLlmDrafts.clean?.id,
    removeCustomLlmProfileById,
    setStatusMessage,
  ]);
  const cleanerAiCustomProfilesManagerSection = useMemo(
    () => (
      <CustomLlmProfilesManagerSection
        stage="clean"
        profiles={cleanStandaloneCustomProfiles}
        draft={customLlmDrafts.clean}
        loading={customLlmProfilesLoading}
        error={customLlmProfilesError}
        persistenceHint={llmProfilesPersistenceHint}
        providerNotice={cleanerAiCustomProviderNotice}
        titleOverride="AI Custom (Automatic AI Clean)"
        emptyLabelOverride="Novo perfil visual"
        namePlaceholderOverride="Ex.: Gemini Image Clean"
        modelPlaceholderOverride="gemini-2.5-flash-image"
        useLabelOverride="Usar no Cleaner"
        onLoadProfile={(profileId) =>
          loadCustomLlmDraftFromProfile('clean', profileId)
        }
        onUpdateDraft={(patch) => updateCustomLlmDraft('clean', patch)}
        onUseExisting={useExistingCleanerCustomProfile}
        onResetDraft={() => resetCustomLlmDraft('clean')}
        onRemoveDraft={() => removeCleanerCustomDraftProfile()}
        onSaveDraft={() => saveCleanerCustomDraftProfile()}
      />
    ),
    [
      cleanerAiCustomProviderNotice,
      customLlmDrafts.clean,
      customLlmProfilesError,
      customLlmProfilesLoading,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      cleanStandaloneCustomProfiles,
      removeCleanerCustomDraftProfile,
      resetCustomLlmDraft,
      saveCleanerCustomDraftProfile,
      updateCustomLlmDraft,
      useExistingCleanerCustomProfile,
    ],
  );
  const cleanerAiFreeProviderManagerSection = useMemo(
    () => (
      <FreeProviderManagerSection
        stage="clean"
        providers={cleanFreeProviders}
        standaloneProfiles={cleanStandaloneCustomProfiles}
        selectedModelKey={cleanerAiModelKey}
        getDraft={getFreeProviderDraft}
        getSelectedProfileLabel={getSelectedFreeProviderProfileLabel}
        onDraftChange={updateFreeProviderDraft}
        onSaveProvider={saveFreeProviderProfile}
        onTestProvider={testFreeProviderConfig}
        onUseProvider={async (_stage, provider) => {
          const payload = await saveFreeProviderProfile('clean', provider);
          if (!payload) return;
          setCleanerAiModelKey(`custom_clean:${payload.profile.id}`);
          setStatusMessage(`Provider ${provider.name} em uso no Automatic AI Clean.`);
        }}
        onUseCustomProfile={(profileId) =>
          setCleanerAiModelKey(`custom_clean:${profileId}`)
        }
        onTestCustomProfile={(profile) => testCustomProfileConfig('clean', profile)}
        onSaveCustomProfile={async (draft) => {
          const profile = await saveCustomProfileInline('clean', draft);
          setCleanerAiModelKey(`custom_clean:${profile.id}`);
        }}
        onDeleteCustomProfile={(profileId) =>
          removeCustomLlmProfileById('clean', profileId)
        }
        toSelectionKey={(profile) => `custom_clean:${profile.id}`}
      />
    ),
    [
      cleanerAiModelKey,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      cleanFreeProviders,
      cleanStandaloneCustomProfiles,
      removeCustomLlmProfileById,
      saveCustomProfileInline,
      saveFreeProviderProfile,
      setStatusMessage,
      testCustomProfileConfig,
      testFreeProviderConfig,
      updateFreeProviderDraft,
    ],
  );
  const activeTranslatorSelectedTranslationNotes = useMemo(
    () =>
      activeTranslatorSelectedRegion
        ? getRegionTranslationNotesForDisplay(
            activeTranslatorSelectedRegion,
            llmSettings.translation_notes_enabled,
          )
        : [],
    [activeTranslatorSelectedRegion, llmSettings.translation_notes_enabled],
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

  const [activeStageTab, setActiveStageTab] =
    useState<StageTabKey>('detectText');

  useEffect(() => {
    if (subMode === 'manual' && activeManualProgress) {
      const currentStageKey =
        AIO_MANUAL_STAGE_ORDER[activeManualProgress.currentIndex];
      if (currentStageKey) {
        setActiveStageTab(currentStageKey as StageTabKey);
      }
    }
  }, [subMode, activeManualProgress?.currentIndex]);

  const enabledStepCount = [
    aioSteps.detectText,
    aioSteps.recognizeText,
    aioSteps.getTranslations,
    aioSteps.segmentText,
    aioSteps.cleanImage,
    aioSteps.render,
  ].filter(Boolean).length;

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
  }, []);

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
    [],
  );

  useEffect(() => {
    void syncDiscordForTab();
  }, [syncDiscordForTab]);

  useEffect(() => {
    if (mode !== 'aio') return;
    setAioOptionsLoading(true);

    const pendingTranslationOption = pendingCustomSelections.translation
      ? {
          key: pendingCustomSelections.translation,
          name: t('dashboard.status.pendingCustomTranslationName'),
          device: 'cloud',
          use_case: t('dashboard.status.customProfilePendingSync'),
          languages: ['multi'],
          available: true,
          implemented: true,
          llm_capabilities: FULL_LLM_CAPABILITIES,
        }
      : null;
    const pendingOcrOption = pendingCustomSelections.ocr
      ? {
          key: pendingCustomSelections.ocr,
          name: t('dashboard.status.pendingCustomOcrName'),
          device: 'cloud',
          use_case: t('dashboard.status.customProfileOcrPendingSync'),
          languages: ['multi'],
          available: true,
          implemented: true,
          llm_capabilities: FULL_LLM_CAPABILITIES,
        }
      : null;

    const builtOptions = buildAioStageCatalog({
      sourceLanguage: aioSrcLang,
      localModelEntries: modelManagerState.entries,
      customProfiles: customLlmProfiles,
    });

    const nextOptions: AioStageOptionMap = {
      ...builtOptions,
      recognizeText:
        pendingOcrOption &&
        !builtOptions.recognizeText.some(
          (option) => option.key === pendingOcrOption.key,
        )
          ? [...builtOptions.recognizeText, pendingOcrOption]
          : builtOptions.recognizeText,
      getTranslations:
        pendingTranslationOption &&
        !builtOptions.getTranslations.some(
          (option) => option.key === pendingTranslationOption.key,
        )
          ? [...builtOptions.getTranslations, pendingTranslationOption]
          : builtOptions.getTranslations,
    };

    setAioStageOptions(nextOptions);
    setAioLanguageOptions({
      source: translatedSourceLanguageOptions,
      target: translatedTargetLanguageOptions,
    });
    setAioSrcLang((prev) =>
      SOURCE_LANGUAGE_OPTIONS.some((option) => option.value === prev)
        ? prev
        : (SOURCE_LANGUAGE_OPTIONS[0]?.value ?? 'ja'),
    );
    setAioTgtLang((prev) =>
      TARGET_LANGUAGE_OPTIONS.some((option) => option.value === prev)
        ? prev
        : (TARGET_LANGUAGE_OPTIONS[0]?.value ?? 'en'),
    );
    setAioStageSelection((prev) => {
      const detectDefault =
        nextOptions.detectText.find((item) => item.available)?.key ??
        nextOptions.detectText[0]?.key ??
        prev.detectText;
      const ocrDefault =
        nextOptions.recognizeText.find((item) => item.available)?.key ??
        nextOptions.recognizeText[0]?.key ??
        prev.recognizeText;
      const translationDefault =
        nextOptions.getTranslations.find((item) => item.available)?.key ??
        nextOptions.getTranslations[0]?.key ??
        prev.getTranslations;
      const segmentDefault =
        nextOptions.segmentText.find((item) => item.available)?.key ??
        nextOptions.segmentText[0]?.key ??
        prev.segmentText;
      const cleanDefault =
        nextOptions.cleanImage.find((item) => item.available)?.key ??
        nextOptions.cleanImage[0]?.key ??
        prev.cleanImage;
      const keepCustomOcrSelection =
        isCustomModelSelectionKey(prev.recognizeText) &&
        (customOcrStageOptions.some(
          (item) => item.key === prev.recognizeText,
        ) ||
          pendingCustomSelections.ocr === prev.recognizeText);
      const keepCustomTranslationSelection =
        isCustomModelSelectionKey(prev.getTranslations) &&
        (customTranslationStageOptions.some(
          (item) => item.key === prev.getTranslations,
        ) ||
          pendingCustomSelections.translation === prev.getTranslations);
      return {
        detectText:
          prev.detectText &&
          nextOptions.detectText.some((item) => item.key === prev.detectText)
            ? prev.detectText
            : detectDefault,
        recognizeText: keepCustomOcrSelection
          ? prev.recognizeText
          : prev.recognizeText &&
              nextOptions.recognizeText.some(
                (item) => item.key === prev.recognizeText,
              )
            ? prev.recognizeText
            : ocrDefault,
        getTranslations:
          prev.getTranslations &&
          nextOptions.getTranslations.some(
            (item) => item.key === prev.getTranslations,
          )
            ? prev.getTranslations
            : keepCustomTranslationSelection
              ? prev.getTranslations
              : translationDefault,
        segmentText:
          prev.segmentText &&
          nextOptions.segmentText.some((item) => item.key === prev.segmentText)
            ? prev.segmentText
            : segmentDefault,
        cleanImage:
          prev.cleanImage &&
          nextOptions.cleanImage.some((item) => item.key === prev.cleanImage)
            ? prev.cleanImage
            : cleanDefault,
      };
    });
    setAioOptionsLoading(false);
  }, [
    aioSrcLang,
    customOcrStageOptions,
    customLlmProfiles,
    customTranslationStageOptions,
    modelManagerState.entries,
    mode,
    pendingCustomSelections.ocr,
    pendingCustomSelections.translation,
  ]);

  useEffect(() => {
    let cancelled = false;
    const runtimeListener = (payload: DesktopMiniBackendRuntimeState) => {
      if (!cancelled) {
        setAioMiniBackendRuntimeState(payload);
      }
    };

    const loadMiniBackendRuntimeState = async () => {
      try {
        const payload = await desktopBridge.desktop?.getMiniBackendRuntimeState?.();
        if (!cancelled) {
          setAioMiniBackendRuntimeState(
            (payload ?? null) as DesktopMiniBackendRuntimeState | null,
          );
        }
      } catch {
        if (!cancelled) {
          setAioMiniBackendRuntimeState(null);
        }
      }
    };

    void loadMiniBackendRuntimeState();
    desktopBridge.desktop?.onMiniBackendRuntimeState?.(runtimeListener);
    return () => {
      cancelled = true;
      desktopBridge.desktop?.offMiniBackendRuntimeState?.(runtimeListener);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'aio') return;
    let cancelled = false;

    const loadAioDeviceInfo = async () => {
      try {
        const response = await fetchWithTimeoutAndRetry(
          `${apiConfig.localUrl}/device/info`,
          { method: 'GET' },
          { timeoutMs: 10_000, retryCount: 1 },
        );
        if (!response.ok) {
          throw new Error(t('dashboard.error.loadHardwareFailed'));
        }
        const payload = (await response.json()) as AioDeviceInfo;
        if (!cancelled) {
          setAioDeviceInfo(payload);
        }
      } catch {
        // Preserve the previous device snapshot on transient failures so
        // the UI does not randomly hide GPU-related controls.
      }
    };

    void loadAioDeviceInfo();
    return () => {
      cancelled = true;
    };
  }, [apiConfig.localUrl, mode]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableDetectStageOptions.some(
          (option) => option.key === prev.detectText,
        )
      ) {
        return prev;
      }
      const fallback = availableDetectStageOptions[0]?.key;
      if (!fallback || fallback === prev.detectText) {
        return prev;
      }
      return { ...prev, detectText: fallback };
    });
  }, [availableDetectStageOptions]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (isCustomModelSelectionKey(prev.recognizeText)) {
        if (
          pendingCustomSelections.ocr === prev.recognizeText ||
          selectedCustomOcrProfile
        ) {
          return prev;
        }
      }
      if (
        availableOcrStageOptions.some(
          (option) => option.key === prev.recognizeText,
        )
      ) {
        return prev;
      }
      const fallback = availableOcrStageOptions[0]?.key;
      if (!fallback || fallback === prev.recognizeText) {
        return prev;
      }
      return { ...prev, recognizeText: fallback };
    });
  }, [
    availableOcrStageOptions,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
  ]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (isInstalledLocalAioEntry(prev.getTranslations)) {
        return prev;
      }
      if (isCustomModelSelectionKey(prev.getTranslations)) {
        if (
          pendingCustomSelections.translation === prev.getTranslations ||
          selectedCustomTranslationProfile
        ) {
          return prev;
        }
      }
      if (
        availableTranslationStageOptions.some(
          (option) => option.key === prev.getTranslations,
        )
      ) {
        return prev;
      }
      const fallback = availableTranslationStageOptions[0]?.key;
      if (!fallback || fallback === prev.getTranslations) {
        return prev;
      }
      return {
        ...prev,
        getTranslations: fallback,
      };
    });
  }, [
    availableTranslationStageOptions,
    isInstalledLocalAioEntry,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
  ]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableSegmentStageOptions.some(
          (option) => option.key === prev.segmentText,
        )
      ) {
        return prev;
      }
      const fallback = availableSegmentStageOptions[0]?.key;
      if (!fallback || fallback === prev.segmentText) {
        return prev;
      }
      return { ...prev, segmentText: fallback };
    });
  }, [availableSegmentStageOptions]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableCleanStageOptions.some(
          (option) => option.key === prev.cleanImage,
        )
      ) {
        return prev;
      }
      const fallback = availableCleanStageOptions[0]?.key;
      if (!fallback || fallback === prev.cleanImage) {
        return prev;
      }
      return { ...prev, cleanImage: fallback };
    });
  }, [availableCleanStageOptions]);

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
  }, [cleanerAiModelKey, cleanerAiOptionsForSelect]);

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
  }, [cleanerAiOptionsForSelect, translatorSfxCleanModelKey]);

  // ── Image Handlers ──
  const { getRootProps, getInputProps, isDragActive, onDrop } =
    useDashboardUploads({
      localApiUrl: apiConfig.localUrl,
      activeId,
      isExtractingUploads,
      setImages,
      setActiveId,
      setIsExtractingUploads,
      setStatusMessage,
      invalidateAioPipelineHistory,
    });

  const { handleTranslatorTextImport, handleTranslatorImageUpload } =
    useTranslatorImports({
      onDrop,
      setTranslatorDraftText,
      setTranslatorTextDirty,
      setTranslatorWorkspaceMode,
      setStatusMessage,
    });

  const stitchImages = images as StitchImageInput[];
  const stitchAutoBatchIndexes = useMemo(
    () =>
      buildAutoBatchIndexes(
        stitchImages,
        stitchBatchStrategy,
        stitchBatchSize,
        stitchTargetPrimaryAxis,
        stitchLayoutMode,
        stitchGap,
      ),
    [
      stitchBatchSize,
      stitchBatchStrategy,
      stitchGap,
      stitchImages,
      stitchLayoutMode,
      stitchTargetPrimaryAxis,
    ],
  );
  useEffect(() => {
    setStitchBatchIndexes(stitchAutoBatchIndexes);
  }, [stitchAutoBatchIndexes]);
  const stitchBatchPlans = useMemo(
    () =>
      buildBatchPlanFromIndexes(
        stitchBatchIndexes,
        stitchImages,
        stitchLayoutMode,
        stitchGap,
      ),
    [stitchBatchIndexes, stitchGap, stitchImages, stitchLayoutMode],
  );
  useEffect(() => {
    setStitchSelectedBatchIndex((current) => {
      if (stitchBatchPlans.length === 0) return 0;
      return Math.min(current, stitchBatchPlans.length - 1);
    });
  }, [stitchBatchPlans.length]);
  const stitchTargetAxisLabel =
    stitchLayoutMode === 'webtoon'
      ? 'Altura alvo por lote'
      : 'Comprimento alvo por lote';
  const stitchSafeFileStem = useMemo(
    () => sanitizeFileStem(stitchFileBaseName),
    [stitchFileBaseName],
  );

  const {
    removeImage,
    moveImage,
    rotateImage,
    registerDownloads,
    getPreviewSrc,
    optimizerSourceVariants,
  } = useDashboardImageCollection({
    mode,
    activeId,
    images,
    downloadItems,
    setImages,
    setDownloadItems,
    setLastActionScope,
    setActiveId,
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

  useEffect(() => {
    downloadItemsRef.current = downloadItems;
  }, [downloadItems]);

  useEffect(() => {
    return () => {
      downloadItemsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
    };
  }, []);

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

  const updateTranslatorRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      setTranslatorDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setTranslatorSelectedRegionByImage((prev) => {
        const currentSelected = prev[imageId] ?? null;
        const resolvedSelected =
          selectedRegionIdOverride === undefined
            ? resolveSelectedRegionForRegions(clonedRegions, currentSelected)
            : resolveSelectedRegionForRegions(
                clonedRegions,
                selectedRegionIdOverride,
              );
        return {
          ...prev,
          [imageId]: resolvedSelected,
        };
      });
    },
    [resolveSelectedRegionForRegions],
  );

  const selectTranslatorRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const regions = translatorDetectionsByImage[imageId] ?? [];
      const resolvedSelected = resolveSelectedRegionForRegions(
        regions,
        regionId,
      );
      setTranslatorSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
    },
    [resolveSelectedRegionForRegions, translatorDetectionsByImage],
  );

  const patchAioSnapshotsForImageEdit = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionId: string | null,
    ) => {
      const snapshotIndex = getAioImageSnapshotIndex(imageId);
      if (snapshotIndex < 0) return;
      setAioPipelineSnapshots((prev) => {
        if (prev.length === 0 || snapshotIndex >= prev.length) return prev;
        let changed = false;
        const nextSnapshots = prev.map((snapshot, index) => {
          if (index < snapshotIndex) return snapshot;
          const snapshotRegions = snapshot.detectionsByImage[imageId] ?? [];
          const snapshotSelected =
            snapshot.selectedRegionByImage[imageId] ?? null;
          const snapshotById = new Map(
            snapshotRegions.map((region) => [region.id, region]),
          );
          const mergedSnapshotRegions = nextRegions.map((region) => {
            const existing = snapshotById.get(region.id);
            if (!existing) return cloneAioRegion(region, cloneRenderStyle);
            return {
              ...existing,
              ...region,
              bbox: [...region.bbox] as [number, number, number, number],
              segmentBoxes:
                region.segmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ) ??
                existing.segmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ),
              mergedSegmentBoxes:
                region.mergedSegmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ) ??
                existing.mergedSegmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ),
              renderStyle: region.renderStyle
                ? cloneRenderStyle(region.renderStyle)
                : existing.renderStyle
                  ? cloneRenderStyle(existing.renderStyle)
                  : undefined,
            };
          });
          const resolvedSelected =
            selectedRegionId === null ? null : selectedRegionId;
          const regionsChanged = !areAioRegionsEqual(
            snapshotRegions,
            mergedSnapshotRegions,
            cloneRenderStyle,
          );
          const selectedChanged = snapshotSelected !== resolvedSelected;
          if (!regionsChanged && !selectedChanged) return snapshot;
          changed = true;
          return {
            ...snapshot,
            detectionsByImage: regionsChanged
              ? {
                  ...snapshot.detectionsByImage,
                  [imageId]: mergedSnapshotRegions,
                }
              : snapshot.detectionsByImage,
            selectedRegionByImage: selectedChanged
              ? {
                  ...snapshot.selectedRegionByImage,
                  [imageId]: resolvedSelected,
                }
              : snapshot.selectedRegionByImage,
          };
        });
        return changed ? nextSnapshots : prev;
      });
    },
    [getAioImageSnapshotIndex, resolveSelectedRegionForRegions],
  );

  const patchAioSnapshotSelectionForImage = useCallback(
    (imageId: string, selectedRegionId: string | null) => {
      const snapshotIndex = getAioImageSnapshotIndex(imageId);
      if (snapshotIndex < 0) return;
      setAioPipelineSnapshots((prev) => {
        if (prev.length === 0 || snapshotIndex >= prev.length) return prev;
        let changed = false;
        const nextSnapshots = prev.map((snapshot, index) => {
          if (index < snapshotIndex) return snapshot;
          const snapshotSelected =
            snapshot.selectedRegionByImage[imageId] ?? null;
          const resolvedSelected = selectedRegionId;
          if (snapshotSelected === resolvedSelected) return snapshot;
          changed = true;
          return {
            ...snapshot,
            selectedRegionByImage: {
              ...snapshot.selectedRegionByImage,
              [imageId]: resolvedSelected,
            },
          };
        });
        return changed ? nextSnapshots : prev;
      });
    },
    [getAioImageSnapshotIndex],
  );

  const patchAioSnapshotStageForImage = useCallback(
    (
      imageId: string,
      stageIndex: number,
      nextRegions: AioTextRegion[],
      downloadEntry?: AioDownloadEntry | null,
    ) => {
      if (stageIndex < 0) return;
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      const resolvedSelected = resolveSelectedRegionForRegions(
        clonedRegions,
        clonedRegions[0]?.id ?? null,
      );

      setAioPipelineSnapshots((prev) => {
        if (stageIndex >= prev.length) return prev;
        const stageSnapshot = prev[stageIndex];
        if (!stageSnapshot) return prev;

        let nextDownloads = stageSnapshot.aioDownloads;
        if (downloadEntry !== undefined) {
          nextDownloads = stageSnapshot.aioDownloads.filter(
            (entry) => entry.sourceImageId !== imageId,
          );
          if (downloadEntry) {
            nextDownloads = [...nextDownloads, downloadEntry];
          }
        }

        const nextSnapshot: AioPipelineSnapshot = {
          ...stageSnapshot,
          detectionsByImage: {
            ...stageSnapshot.detectionsByImage,
            [imageId]: clonedRegions,
          },
          selectedRegionByImage: {
            ...stageSnapshot.selectedRegionByImage,
            [imageId]: resolvedSelected,
          },
          aioDownloads: nextDownloads,
        };

        const nextState = [...prev];
        nextState[stageIndex] = nextSnapshot;
        return nextState;
      });

      const currentIndex = getAioImageSnapshotIndex(imageId);
      if (currentIndex === stageIndex) {
        setAioDetectionsByImage((prev) => ({
          ...prev,
          [imageId]: clonedRegions,
        }));
        setAioSelectedRegionByImage((prev) => ({
          ...prev,
          [imageId]: resolvedSelected,
        }));
        if (downloadEntry !== undefined) {
          setAioDownloadItemForImage(imageId, downloadEntry ?? null);
        }
      }
    },
    [
      getAioImageSnapshotIndex,
      resolveSelectedRegionForRegions,
      setAioDownloadItemForImage,
    ],
  );

  const syncManualStagePreviewToNextStage = useCallback(
    (imageId: string, fromStageIndex: number, toStageIndex: number) => {
      if (fromStageIndex === toStageIndex) return;
      setAioPipelineSnapshots((prev) => {
        if (fromStageIndex < 0 || toStageIndex < 0) return prev;
        if (fromStageIndex >= prev.length || toStageIndex >= prev.length)
          return prev;
        const sourceSnapshot = prev[fromStageIndex];
        const targetSnapshot = prev[toStageIndex];
        if (!sourceSnapshot || !targetSnapshot) return prev;

        const sourceRegions = cloneAioRegions(
          sourceSnapshot.detectionsByImage[imageId] ?? [],
          cloneRenderStyle,
        );
        const targetRegions = targetSnapshot.detectionsByImage[imageId] ?? [];
        const sourceHasSelection = Object.prototype.hasOwnProperty.call(
          sourceSnapshot.selectedRegionByImage,
          imageId,
        );
        const targetHasSelection = Object.prototype.hasOwnProperty.call(
          targetSnapshot.selectedRegionByImage,
          imageId,
        );
        const sourceSelected = sourceHasSelection
          ? (sourceSnapshot.selectedRegionByImage[imageId] ?? null)
          : (sourceRegions[0]?.id ?? null);
        const targetSelected = targetHasSelection
          ? (targetSnapshot.selectedRegionByImage[imageId] ?? null)
          : (targetRegions[0]?.id ?? null);
        const sourceDownload =
          sourceSnapshot.aioDownloads.find(
            (entry) => entry.sourceImageId === imageId,
          ) ?? null;
        const targetDownload =
          targetSnapshot.aioDownloads.find(
            (entry) => entry.sourceImageId === imageId,
          ) ?? null;

        const regionsChanged = !areAioRegionsEqual(
          targetRegions,
          sourceRegions,
          cloneRenderStyle,
        );
        const selectedChanged = targetSelected !== sourceSelected;
        const downloadChanged = Boolean(
          sourceDownload &&
          (!targetDownload ||
            targetDownload.fileName !== sourceDownload.fileName ||
            targetDownload.blob !== sourceDownload.blob),
        );

        if (!regionsChanged && !selectedChanged && !downloadChanged) {
          return prev;
        }

        const nextTargetSnapshot: AioPipelineSnapshot = {
          ...targetSnapshot,
          detectionsByImage: regionsChanged
            ? { ...targetSnapshot.detectionsByImage, [imageId]: sourceRegions }
            : targetSnapshot.detectionsByImage,
          selectedRegionByImage: selectedChanged
            ? {
                ...targetSnapshot.selectedRegionByImage,
                [imageId]: sourceSelected,
              }
            : targetSnapshot.selectedRegionByImage,
          aioDownloads:
            downloadChanged && sourceDownload
              ? [
                  ...targetSnapshot.aioDownloads.filter(
                    (entry) => entry.sourceImageId !== imageId,
                  ),
                  sourceDownload,
                ]
              : targetSnapshot.aioDownloads,
        };

        const nextState = [...prev];
        nextState[toStageIndex] = nextTargetSnapshot;
        return nextState;
      });
    },
    [],
  );

  const applyAioRegionsEditForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      const currentRegions = aioDetectionsByImage[imageId] ?? [];
      const currentSelected = aioSelectedRegionByImage[imageId] ?? null;
      const hasSelectedOverride = selectedRegionIdOverride !== undefined;
      const resolvedSelected = hasSelectedOverride
        ? selectedRegionIdOverride === null
          ? null
          : resolveSelectedRegionForRegions(
              clonedRegions,
              selectedRegionIdOverride,
            )
        : currentSelected === null
          ? null
          : resolveSelectedRegionForRegions(clonedRegions, currentSelected);

      const regionsChanged = !areAioRegionsEqual(
        currentRegions,
        clonedRegions,
        cloneRenderStyle,
      );
      const selectedChanged = currentSelected !== resolvedSelected;
      if (!regionsChanged && !selectedChanged) return;

      setAioDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
      patchAioSnapshotsForImageEdit(imageId, clonedRegions, resolvedSelected);
    },
    [
      aioDetectionsByImage,
      aioSelectedRegionByImage,
      patchAioSnapshotsForImageEdit,
      resolveSelectedRegionForRegions,
    ],
  );

  const unlockManualDetectStageIfReady = useCallback(
    (imageId: string, nextRegions: AioTextRegion[]) => {
      if (mode !== 'aio' || subMode !== 'manual') return;
      if (nextRegions.length === 0) return;

      const detectStageIndex = AIO_MANUAL_STAGE_ORDER.indexOf('detectText');
      if (detectStageIndex < 0) return;
      const nextStageIndex = Math.min(
        detectStageIndex + 1,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      if (nextStageIndex === detectStageIndex) return;

      const currentProgress = aioManualProgressByImage[imageId];
      if (!currentProgress || currentProgress.currentIndex !== detectStageIndex)
        return;

      syncManualStagePreviewToNextStage(
        imageId,
        detectStageIndex,
        nextStageIndex,
      );

      setAioManualProgressByImage((prev) => {
        const progress = prev[imageId];
        if (!progress || progress.currentIndex !== detectStageIndex)
          return prev;

        const detectStageKey = AIO_MANUAL_STAGE_ORDER[detectStageIndex];
        const nextStageKey = AIO_MANUAL_STAGE_ORDER[nextStageIndex];
        if (!detectStageKey || !nextStageKey) return prev;
        const nextUnlockedIndex = Math.max(
          progress.unlockedMaxIndex,
          nextStageIndex,
        );
        const nextStatusByStage = { ...progress.statusByStage };
        let changed = false;

        if (nextStatusByStage[detectStageKey] !== 'done') {
          nextStatusByStage[detectStageKey] = 'done';
          changed = true;
        }
        if (nextStatusByStage[nextStageKey] === 'locked') {
          nextStatusByStage[nextStageKey] = 'pending';
          changed = true;
        }
        if (nextUnlockedIndex !== progress.unlockedMaxIndex) {
          changed = true;
        }
        if (!changed) return prev;

        return {
          ...prev,
          [imageId]: {
            ...progress,
            unlockedMaxIndex: nextUnlockedIndex,
            statusByStage: nextStatusByStage,
          },
        };
      });
    },
    [
      aioManualProgressByImage,
      mode,
      subMode,
      syncManualStagePreviewToNextStage,
    ],
  );

  const updateAioRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      applyAioRegionsEditForImage(
        imageId,
        nextRegions,
        selectedRegionIdOverride,
      );
      unlockManualDetectStageIfReady(imageId, nextRegions);
    },
    [applyAioRegionsEditForImage, unlockManualDetectStageIfReady],
  );

  const selectAioRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const resolvedSelected = regionId;
      setAioSelectedRegionByImage((prev) => {
        if ((prev[imageId] ?? null) === resolvedSelected) return prev;
        return { ...prev, [imageId]: resolvedSelected };
      });
      typographerWorkspace.setSelectedRegionId(imageId, resolvedSelected);
      patchAioSnapshotSelectionForImage(imageId, resolvedSelected);
    },
    [patchAioSnapshotSelectionForImage, typographerWorkspace],
  );

  const updateActiveRenderRegion = useCallback(
    (updater: (region: AioTextRegion) => AioTextRegion) => {
      if (!activeId || !activeSelectedRegionId) return;
      const currentRegions = aioDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.map((region) =>
        region.id === activeSelectedRegionId
          ? updater(
              applyRenderDefaultsToRegion(
                region,
                renderDefaultStyle,
                applyDetectedGradientToStyle,
                undefined,
                aioTgtLang,
              ),
            )
          : region,
      );
      applyAioRegionsEditForImage(
        activeId,
        nextRegions,
        activeSelectedRegionId,
      );
    },
    [
      activeId,
      activeSelectedRegionId,
      aioDetectionsByImage,
      aioTgtLang,
      applyAioRegionsEditForImage,
      renderDefaultStyle,
    ],
  );

  const updateRenderRegionById = useCallback(
    (
      imageId: string,
      regionId: string,
      updater: (region: AioTextRegion) => AioTextRegion,
    ) => {
      const currentRegions = aioDetectionsByImage[imageId] ?? [];
      const nextRegions = currentRegions.map((region) =>
        region.id === regionId
          ? updater(
              applyRenderDefaultsToRegion(
                region,
                renderDefaultStyle,
                applyDetectedGradientToStyle,
                undefined,
                aioTgtLang,
              ),
            )
          : region,
      );
      applyAioRegionsEditForImage(imageId, nextRegions, regionId);
    },
    [
      aioDetectionsByImage,
      aioTgtLang,
      applyAioRegionsEditForImage,
      renderDefaultStyle,
    ],
  );

  const applyTypographyPresetToRegion = useCallback(
    (
      region: AioTextRegion,
      preset: TypographyStylePreset | null,
    ): AioTextRegion => {
      if (!preset) return region;
      const [x1, y1, x2, y2] = region.bbox;
      const width = Math.max(1, x2 - x1);
      const height = Math.max(1, y2 - y1);
      return {
        ...region,
        stylePresetId: preset.id,
        renderStyle: applyDetectedGradientToStyle(
          region,
          createTypographyStyleFromPreset(
            preset,
            cloneRenderStyle(region.renderStyle ?? renderDefaultStyle),
          ),
        ),
        shape: buildShapeFromPreset(preset, width, height),
      };
    },
    [renderDefaultStyle],
  );

  const applyActiveTypographyPresetToSelection = useCallback(() => {
    if (!activeTypographerPreset || !activeId || !activeSelectedRegionId)
      return;
    updateActiveRenderRegion((region) =>
      applyTypographyPresetToRegion(region, activeTypographerPreset),
    );
    setTonedStatus(
      t('dashboard.status.presetAppliedToSelection', { name: activeTypographerPreset.name }),
      'success',
    );
  }, [
    activeId,
    activeSelectedRegionId,
    activeTypographerPreset,
    applyTypographyPresetToRegion,
    updateActiveRenderRegion,
  ]);

  const applyTypographyPresetToRegionById = useCallback(
    (imageId: string, regionId: string, presetId: string) => {
      const preset =
        typographyPresetList.find((entry) => entry.id === presetId) ?? null;
      if (!preset) return;
      updateRenderRegionById(imageId, regionId, (region) =>
        applyTypographyPresetToRegion(region, preset),
      );
      setTonedStatus(t('dashboard.status.presetAppliedToSelection', { name: preset.name }), 'success');
    },
    [
      applyTypographyPresetToRegion,
      typographyPresetList,
      updateRenderRegionById,
    ],
  );

  const applyLegacyTypographyPresetToSelection = useCallback(
    (
      modeKey:
        | 'text_bubble'
        | 'text_free'
        | 'text_sfx'
        | 'text_narration'
        | 'text_inside_black_bubble',
    ) => {
      if (!activeSelectedRegion || !activeId) return false;
      const preset = resolveLegacyTypographyPresetForMode(
        modeKey,
        typographyPresetState,
      );
      if (!preset) {
        setTonedStatus(
          t('dashboard.status.legacyPresetNotFound', { modeKey }),
          'error',
        );
        return false;
      }
      updateActiveRenderRegion((region) =>
        applyTypographyPresetToRegion(region, preset),
      );
      typographerWorkspace.setActivePreset(activeId, preset.id);
      setTonedStatus(t('dashboard.status.presetAppliedShort', { name: preset.name }), 'success');
      return true;
    },
    [
      activeId,
      activeSelectedRegion,
      applyTypographyPresetToRegion,
      setStatusMessage,
      typographyPresetState,
      typographerWorkspace,
      updateActiveRenderRegion,
    ],
  );

  const applyActiveTypographyPresetToImage = useCallback(() => {
    if (!activeTypographerPreset || !activeId) return;
    const currentRegions = aioDetectionsByImage[activeId] ?? [];
    const nextRegions = currentRegions.map((region) =>
      applyTypographyPresetToRegion(region, activeTypographerPreset),
    );
    applyAioRegionsEditForImage(activeId, nextRegions, activeSelectedRegionId);
    setTonedStatus(
      t('dashboard.status.presetAppliedToImage', { name: activeTypographerPreset.name }),
      'success',
    );
  }, [
    activeId,
    activeSelectedRegionId,
    activeTypographerPreset,
    aioDetectionsByImage,
    applyAioRegionsEditForImage,
    applyTypographyPresetToRegion,
  ]);

  const duplicateSelectedTypographerRegion = useCallback(() => {
    if (!activeId || !activeSelectedRegion) return;
    const [x1, y1, x2, y2] = activeSelectedRegion.bbox;
    const offsetX = 18;
    const offsetY = 18;
    const nextRegion: AioTextRegion = {
      ...cloneAioRegion(activeSelectedRegion, cloneRenderStyle),
      id: `manual-${uuidv4()}`,
      bbox: normalizeRegion(
        x1 + offsetX,
        y1 + offsetY,
        x2 + offsetX,
        y2 + offsetY,
        activeImage?.width ?? x2,
        activeImage?.height ?? y2,
      ),
      source: 'manual',
    };
    applyAioRegionsEditForImage(
      activeId,
      [...(aioDetectionsByImage[activeId] ?? []), nextRegion],
      nextRegion.id,
    );
    setTonedStatus(t('dashboard.status.typographerSelectionDuplicated'), 'success');
  }, [
    activeId,
    activeImage?.height,
    activeImage?.width,
    activeSelectedRegion,
    aioDetectionsByImage,
    applyAioRegionsEditForImage,
  ]);

  const normalizeActiveTypographerShape = useCallback(
    (
      options: {
        kind?: TypographyShapeKind;
        centerText?: boolean;
        source?: TypographyShape['source'];
        statusMessage?: string;
      } = {},
    ) => {
      if (!activeSelectedRegion) return;
      const shapeKind =
        options.kind ?? resolveRegionShapeKind(activeSelectedRegion);
      const nextSource = options.source ?? 'converted';
      const shouldApplyRefinementShape =
        nextSource === 'refined' &&
        options.centerText === true;
      updateActiveRenderRegion((region) => {
        const nextRegion = shouldApplyRefinementShape
          ? rebuildRegionShapeForRefinement(region, shapeKind, nextSource)
          : rebuildRegionShapeForKind(region, shapeKind, nextSource);
        if (options.centerText) {
          return {
            ...nextRegion,
            renderStyle: {
              ...cloneRenderStyle(nextRegion.renderStyle ?? renderDefaultStyle),
              alignment: 'center',
              ...(shouldApplyRefinementShape ? { autoFontSize: true } : {}),
            },
          };
        }
        return nextRegion;
      });
      if (options.statusMessage) {
        setStatusMessage(options.statusMessage);
      }
    },
    [activeSelectedRegion, updateActiveRenderRegion],
  );

  const convertActiveTypographerShape = useCallback(
    (kind: TypographyShapeKind) => {
      normalizeActiveTypographerShape({
        kind,
        source: 'converted',
        statusMessage: `Shape convertido para ${kind === 'rounded' ? 'elliptic' : 'rectangular'}.`,
      });
    },
    [normalizeActiveTypographerShape],
  );

  const applyAutoDetectedShapeToActiveRegion = useCallback(() => {
    if (!activeSelectedRegion) return;
    updateActiveRenderRegion((region) =>
      rebuildRegionShapeForAutoMode(region, 'detected'),
    );
    const nextKind =
      normalizeDetectedRenderMode(activeSelectedRegion.detectedRenderMode) ===
        'text_bubble' ||
      normalizeDetectedRenderMode(activeSelectedRegion.detectedRenderMode) ===
        'text_inside_black_bubble'
        ? 'rounded'
        : 'square';
    setStatusMessage(
      t('dashboard.status.autoShapeApplied', { shape: nextKind === 'rounded' ? 'elliptic' : 'rectangular' }),
    );
  }, [activeSelectedRegion, updateActiveRenderRegion]);

  const applyAutoDetectedShapeToRegionById = useCallback(
    (imageId: string, regionId: string) => {
      const region = (aioDetectionsByImage[imageId] ?? []).find(
        (entry) => entry.id === regionId,
      );
      if (!region) return;
      updateRenderRegionById(imageId, regionId, (current) =>
        rebuildRegionShapeForAutoMode(current, 'detected'),
      );
      const detectedMode = normalizeDetectedRenderMode(
        region.detectedRenderMode,
      );
      const nextKind =
        detectedMode === 'text_bubble' ||
        detectedMode === 'text_inside_black_bubble'
          ? 'rounded'
          : 'square';
      setStatusMessage(
        t('dashboard.status.autoShapeApplied', { shape: nextKind === 'rounded' ? 'elliptic' : 'rectangular' }),
      );
    },
    [aioDetectionsByImage, updateRenderRegionById],
  );

  const convertRegionShapeById = useCallback(
    (imageId: string, regionId: string, kind: TypographyShapeKind) => {
      updateRenderRegionById(imageId, regionId, (region) =>
        rebuildRegionShapeForKind(region, kind, 'converted'),
      );
      setStatusMessage(
        `Shape convertido para ${kind === 'rounded' ? 'elliptic' : 'rectangular'}.`,
      );
    },
    [updateRenderRegionById],
  );

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
    typographerSnapshotName,
    typographerSelectedSnapshotId,
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
    setTypographerQueueSelectedId,
    setTypographerSnapshotName,
    setStatusMessage,
    normalizeActiveTypographerShape,
    updateActiveRenderRegion,
    applyAioRegionsEditForImage,
    multiSelectedRegionIds: activeTypographerMultiSelectedIds,
    activeRegions: activeId ? aioDetectionsByImage[activeId] ?? [] : [],
  });

  const handleUpdateTypographyPreset = useCallback(
    (presetId: string, patch: Partial<TypographyStylePreset>) => {
      const result = updateTypographyPreset(presetId, patch, typographyPresetState);
      setTypographyPresetState(result.state);
    },
    [typographyPresetState],
  );

  const navigateActiveTypographerRegion = useCallback(
    (delta: number) => {
      if (!activeId) return;
      const regions = aioDetectionsByImage[activeId] ?? [];
      if (regions.length === 0) return;
      const currentIndex = regions.findIndex(
        (region) => region.id === activeSelectedRegionId,
      );
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = clamp(safeIndex + delta, 0, regions.length - 1);
      const nextRegion = regions[nextIndex];
      if (!nextRegion) return;
      selectAioRegionForImage(activeId, nextRegion.id);
    },
    [
      activeId,
      activeSelectedRegionId,
      aioDetectionsByImage,
      selectAioRegionForImage,
    ],
  );

  const removeSelectedAioRegion = useCallback(() => {
    if (!activeId) return;

    if (mode === 'translator') {
      if (!activeTranslatorSelectedRegionId) return;
      const currentRegions = translatorDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.filter(
        (region) => region.id !== activeTranslatorSelectedRegionId,
      );
      updateTranslatorRegionsForImage(activeId, nextRegions, null);
      return;
    }

    if (mode === 'cleaner') {
      if (!activeCleanerSelectedRegionId) return;
      const currentRegions = cleanerDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.filter(
        (region) => region.id !== activeCleanerSelectedRegionId,
      );
      updateCleanerRegionsForImage(activeId, nextRegions, null);
      return;
    }

    if (!activeSelectedRegionId) return;

    if (activeSelectedRegionId.startsWith(TRANSLATION_NOTE_REGION_PREFIX)) {
      const parentId = activeSelectedRegionId.slice(
        TRANSLATION_NOTE_REGION_PREFIX.length,
      );
      const currentRegions = aioDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.map((region) =>
        region.id === parentId
          ? {
              ...region,
              translationNotes: undefined,
              translationNoteOverlay: undefined,
            }
          : region,
      );
      applyAioRegionsEditForImage(activeId, nextRegions, parentId);
      return;
    }

    const currentRegions = aioDetectionsByImage[activeId] ?? [];
    const nextRegions = currentRegions.filter(
      (region) => region.id !== activeSelectedRegionId,
    );
    applyAioRegionsEditForImage(activeId, nextRegions, null);
  }, [
    activeCleanerSelectedRegionId,
    activeId,
    activeSelectedRegionId,
    activeTranslatorSelectedRegionId,
    aioDetectionsByImage,
    applyAioRegionsEditForImage,
    cleanerDetectionsByImage,
    mode,
    translatorDetectionsByImage,
    updateCleanerRegionsForImage,
    updateTranslatorRegionsForImage,
  ]);

  const clearAioRegionsForActiveImage = useCallback(() => {
    if (!activeId) return;
    applyAioRegionsEditForImage(activeId, [], null);
  }, [activeId, applyAioRegionsEditForImage]);

  const updateActiveRenderMode = useCallback(
    (nextMode: RenderTextMode) => {
      updateActiveRenderRegion((region) => {
        const currentStyle = cloneRenderStyle(
          region.renderStyle ?? renderDefaultStyle,
        );
        const detectedRenderMode = region.detectedRenderMode ?? 'text_bubble';
        const resolvedMode =
          nextMode === 'auto' ? detectedRenderMode : nextMode;
        const typographyPreset = resolveTypographyPresetForMode(
          resolvedMode,
          typographyPresetState,
        );
        const presetStyle = typographyPreset
          ? createTypographyStyleFromPreset(
              typographyPreset,
              renderDefaultStyle,
            )
          : getRenderModePresetStyle(
              nextMode,
              renderDefaultStyle,
              detectedRenderMode,
              renderModePresetState.presets,
            );
        const [x1, y1, x2, y2] = region.bbox;
        return {
          ...region,
          renderMode: nextMode,
          stylePresetId: typographyPreset?.id ?? region.stylePresetId ?? null,
          renderStyle: applyDetectedGradientToStyle(region, {
            ...presetStyle,
            hyphenationEnabled: currentStyle.hyphenationEnabled,
            rotation: currentStyle.rotation,
          }),
          shape: typographyPreset
            ? buildShapeFromPreset(typographyPreset, x2 - x1, y2 - y1)
            : region.shape,
        };
      });
    },
    [
      renderDefaultStyle,
      renderModePresetState.presets,
      typographyPresetState,
      updateActiveRenderRegion,
    ],
  );

  const applyActiveRenderStyleToAllRegions = useCallback(() => {
    if (!activeSelectedRegion) return;
    const styleSnapshot = cloneRenderStyle(activeSelectedRenderStyle);
    Object.entries(aioDetectionsByImage).forEach(([imageId, regions]) => {
      const nextRegions = regions.map((region) => {
        const withDefaults = applyRenderDefaultsToRegion(
          region,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
          undefined,
          aioTgtLang,
        );
        return {
          ...withDefaults,
          renderStyle: cloneRenderStyle(styleSnapshot),
        };
      });
      applyAioRegionsEditForImage(
        imageId,
        nextRegions,
        aioSelectedRegionByImage[imageId] ?? null,
      );
    });
    setTonedStatus(
      t('dashboard.status.renderStyleAppliedAll'),
      'success',
    );
  }, [
    activeSelectedRegion,
    activeSelectedRenderStyle,
    aioDetectionsByImage,
    aioSelectedRegionByImage,
    aioTgtLang,
    applyAioRegionsEditForImage,
    renderDefaultStyle,
  ]);

  const ensureRenderDefaultsInAllRegions = useCallback(() => {
    setAioDetectionsByImage((prev) => {
      let changed = false;
      const next: Record<string, AioTextRegion[]> = {};
      for (const [imageId, regions] of Object.entries(prev)) {
        const needsDefaults = regions.some(
          (region) =>
            region.renderText === undefined ||
            !region.renderStyle ||
            !region.renderMode ||
            !region.detectedRenderMode,
        );
        if (!needsDefaults) {
          next[imageId] = regions;
          continue;
        }
        changed = true;
        next[imageId] = regions.map((region) =>
          applyRenderDefaultsToRegion(
            region,
            renderDefaultStyle,
            applyDetectedGradientToStyle,
            undefined,
            aioTgtLang,
          ),
        );
      }
      return changed ? next : prev;
    });
  }, [aioTgtLang, renderDefaultStyle]);

  useEffect(() => {
    if (!aioSteps.render) return;
    ensureRenderDefaultsInAllRegions();
  }, [aioSteps.render, ensureRenderDefaultsInAllRegions]);

  const composeAioEditableCanvas = useCallback(
    async (
      imgData: LoadedImage,
      fallbackBaseSource?: string,
      options?: { includePaintLayer?: boolean },
    ): Promise<HTMLCanvasElement> => {
      const includePaintLayer = options?.includePaintLayer ?? true;
      const manualState = getAioManualImageEditState(imgData.id);
      const source =
        manualState.baseImageDataUrl ??
        fallbackBaseSource ??
        getAioDownloadItemForImage(imgData.id)?.previewUrl ??
        imgData.url;
      const sourceImage = await loadImageFromSource(source);
      const width =
        sourceImage.naturalWidth || sourceImage.width || imgData.width;
      const height =
        sourceImage.naturalHeight || sourceImage.height || imgData.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(t('dashboard.status.canvasInitFailed'));
      }
      ctx.drawImage(sourceImage, 0, 0, width, height);
      if (includePaintLayer && manualState.paintLayerDataUrl) {
        const paintLayer = await loadImageFromSource(
          manualState.paintLayerDataUrl,
        );
        ctx.drawImage(paintLayer, 0, 0, width, height);
      }
      return canvas;
    },
    [getAioDownloadItemForImage, getAioManualImageEditState],
  );

  const composeCleanerEditableCanvas = useCallback(
    async (
      imgData: LoadedImage,
      fallbackBaseSource?: string,
      options?: { includePaintLayer?: boolean },
    ): Promise<HTMLCanvasElement> => {
      const includePaintLayer = options?.includePaintLayer ?? true;
      const manualState = getCleanerManualImageEditState(imgData.id);
      const source =
        manualState.baseImageDataUrl ??
        fallbackBaseSource ??
        getCleanerDownloadItemForImage(imgData.id)?.previewUrl ??
        cleanerProcessedBaseByImage[imgData.id] ??
        imgData.url;
      const sourceImage = await loadImageFromSource(source);
      const width =
        sourceImage.naturalWidth || sourceImage.width || imgData.width;
      const height =
        sourceImage.naturalHeight || sourceImage.height || imgData.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(
          t('dashboard.status.cleanerCanvasInitFailed'),
        );
      }
      ctx.drawImage(sourceImage, 0, 0, width, height);
      if (includePaintLayer && manualState.paintLayerDataUrl) {
        const paintLayer = await loadImageFromSource(
          manualState.paintLayerDataUrl,
        );
        ctx.drawImage(paintLayer, 0, 0, width, height);
      }
      return canvas;
    },
    [
      cleanerProcessedBaseByImage,
      getCleanerDownloadItemForImage,
      getCleanerManualImageEditState,
    ],
  );

  const runAioMagicWandForImage = useCallback(
    async (imageId: string, pointX: number, pointY: number) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      try {
        const source = resolveAioEditableBaseSourceForImage(imgData);
        const sourceImage = await loadImageFromSource(source);
        const canvas = document.createElement('canvas');
        canvas.width =
          sourceImage.naturalWidth || sourceImage.width || imgData.width;
        canvas.height =
          sourceImage.naturalHeight || sourceImage.height || imgData.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error(t('dashboard.status.wandPrepFailed'));
        ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / Math.max(1, imgData.width);
        const scaleY = canvas.height / Math.max(1, imgData.height);
        const seedX = pointX * scaleX;
        const seedY = pointY * scaleY;
        const nextMaskDataUrl = buildMagicWandMaskDataUrl(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
          seedX,
          seedY,
          manualImageWandTolerance,
        );
        patchAioManualImageEditState(imageId, {
          wandMaskDataUrl: nextMaskDataUrl,
        });
        if (nextMaskDataUrl) {
          setTonedStatus(
            t('dashboard.status.wandSelectionUpdated'),
            'success',
          );
        } else {
          setTonedStatus(
            t('dashboard.status.wandNoArea'),
            'warning',
          );
        }
      } catch (error) {
        setTonedStatus(
          error instanceof Error
            ? error.message
            : t('dashboard.status.wandExecFailed'),
          'error',
        );
      }
    },
    [
      images,
      manualImageWandTolerance,
      patchAioManualImageEditState,
      resolveAioEditableBaseSourceForImage,
    ],
  );

  const runCleanerMagicWandForImage = useCallback(
    async (imageId: string, pointX: number, pointY: number) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      try {
        const source = resolveCleanerEditableBaseSourceForImage(imgData);
        const sourceImage = await loadImageFromSource(source);
        const canvas = document.createElement('canvas');
        canvas.width =
          sourceImage.naturalWidth || sourceImage.width || imgData.width;
        canvas.height =
          sourceImage.naturalHeight || sourceImage.height || imgData.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx)
          throw new Error(t('dashboard.status.cleanerWandPrepFailed'));
        ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / Math.max(1, imgData.width);
        const scaleY = canvas.height / Math.max(1, imgData.height);
        const seedX = pointX * scaleX;
        const seedY = pointY * scaleY;
        const nextMaskDataUrl = buildMagicWandMaskDataUrl(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
          seedX,
          seedY,
          manualImageWandTolerance,
        );
        patchCleanerManualImageEditState(imageId, {
          wandMaskDataUrl: nextMaskDataUrl,
        });
        if (nextMaskDataUrl) {
          setTonedStatus(
            t('dashboard.status.cleanerWandSelectionUpdated'),
            'success',
          );
        } else {
          setTonedStatus(
            t('dashboard.status.cleanerWandNoArea'),
            'warning',
          );
        }
      } catch (error) {
        setTonedStatus(
          error instanceof Error
            ? error.message
            : t('dashboard.status.cleanerWandExecFailed'),
          'error',
        );
      }
    },
    [
      images,
      manualImageWandTolerance,
      patchCleanerManualImageEditState,
      resolveCleanerEditableBaseSourceForImage,
    ],
  );

  const applyAioHealingMaskForImage = useCallback(
    async (imageId: string, maskDataUrl: string) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      setAioManualHealingBusyByImage((prev) => ({ ...prev, [imageId]: true }));
      try {
        const sourceCanvas = await composeAioEditableCanvas(
          imgData,
          resolveAioEditableBaseSourceForImage(imgData),
          { includePaintLayer: false },
        );
        const sourceBlob = await canvasToBlob(sourceCanvas, 'image/png', 1);
        const maskBlob = await dataUrlToBlob(maskDataUrl);
        const sourceFile = new File(
          [sourceBlob],
          `manual-${imgData.file.name}.png`,
          { type: 'image/png' },
        );
        const maskFile = new File([maskBlob], `mask-${imgData.file.name}.png`, {
          type: 'image/png',
        });

        const formData = new FormData();
        formData.append('file', sourceFile);
        formData.append('mask', maskFile);
        formData.append('model_key', aioStageSelection.cleanImage);
        formData.append('mask_dilation', String(aioMaskDilation));
        formData.append('hd_strategy', aioHdStrategy);
        formData.append('hd_strategy_resize_limit', String(aioHdResizeLimit));
        formData.append('hd_strategy_crop_margin', String(aioHdCropMargin));
        formData.append(
          'hd_strategy_crop_trigger_size',
          String(aioHdCropTriggerSize),
        );

        const response = await fetchWithTimeoutAndRetry(
          `${apiConfig.localUrl}/inpaint-mask`,
          { method: 'POST', body: formData },
          { timeoutMs: 180_000, retryCount: 0 },
        );
        if (!response.ok) {
          const apiMessage = await parseApiError(response);
          throw new Error(t('dashboard.error.healingBrushFailed', { message: apiMessage }));
        }
        const outputBlob = await response.blob();
        if (!outputBlob.type.startsWith('image/')) {
          throw new Error(t('dashboard.status.healingInvalidResponse'));
        }
        const nextBaseDataUrl = await blobToDataUrl(outputBlob);
        patchAioManualImageEditState(imageId, {
          baseImageDataUrl: nextBaseDataUrl,
          wandMaskDataUrl: null,
        });
        setTonedStatus(`Healing aplicado em "${imgData.file.name}".`,
          'success',
        );
      } catch (error) {
        if (
          error instanceof TypeError &&
          /failed to fetch/i.test(error.message)
        ) {
          setTonedStatus(
            `Healing failed to reach the backend (${apiConfig.localUrl}). Check that the mini-backend is running.`,
            'error',
          );
        } else {
          setTonedStatus(
            error instanceof Error
              ? error.message
              : t('dashboard.status.healingBrushApplyFailed'),
            'error',
          );
        }
      } finally {
        setAioManualHealingBusyByImage((prev) => {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        });
      }
    },
    [
      aioHdCropMargin,
      aioHdCropTriggerSize,
      aioHdResizeLimit,
      aioHdStrategy,
      aioMaskDilation,
      aioStageSelection.cleanImage,
      apiConfig.localUrl,
      composeAioEditableCanvas,
      images,
      parseApiError,
      patchAioManualImageEditState,
      resolveAioEditableBaseSourceForImage,
    ],
  );

  const applyCleanerHealingMaskForImage = useCallback(
    async (imageId: string, maskDataUrl: string) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      setCleanerHealingBusyByImage((prev) => ({ ...prev, [imageId]: true }));
      try {
        const sourceCanvas = await composeCleanerEditableCanvas(
          imgData,
          resolveCleanerEditableBaseSourceForImage(imgData),
          { includePaintLayer: false },
        );
        const sourceBlob = await canvasToBlob(sourceCanvas, 'image/png', 1);
        const maskBlob = await dataUrlToBlob(maskDataUrl);
        const sourceFile = new File(
          [sourceBlob],
          `cleaner-${imgData.file.name}.png`,
          { type: 'image/png' },
        );
        const maskFile = new File(
          [maskBlob],
          `cleaner-mask-${imgData.file.name}.png`,
          { type: 'image/png' },
        );

        const formData = new FormData();
        formData.append('file', sourceFile);
        formData.append('mask', maskFile);
        formData.append('model_key', aioStageSelection.cleanImage);
        formData.append('mask_dilation', String(aioMaskDilation));
        formData.append('hd_strategy', aioHdStrategy);
        formData.append('hd_strategy_resize_limit', String(aioHdResizeLimit));
        formData.append('hd_strategy_crop_margin', String(aioHdCropMargin));
        formData.append(
          'hd_strategy_crop_trigger_size',
          String(aioHdCropTriggerSize),
        );

        const response = await fetchWithTimeoutAndRetry(
          `${apiConfig.localUrl}/inpaint-mask`,
          { method: 'POST', body: formData },
          { timeoutMs: 180_000, retryCount: 0 },
        );
        if (!response.ok) {
          const apiMessage = await parseApiError(response);
          throw new Error(t('dashboard.error.cleanerHealingBrushFailed', { message: apiMessage }));
        }
        const outputBlob = await response.blob();
        if (!outputBlob.type.startsWith('image/')) {
          throw new Error(
            t('dashboard.status.cleanerHealingInvalidResponse'),
          );
        }

        const nextBaseDataUrl = await blobToDataUrl(outputBlob);
        const previewUrl = URL.createObjectURL(outputBlob);
        setCleanerProcessedBaseByImage((prev) => ({
          ...prev,
          [imageId]: nextBaseDataUrl,
        }));
        patchCleanerManualImageEditState(imageId, {
          baseImageDataUrl: nextBaseDataUrl,
          wandMaskDataUrl: null,
        });
        setDownloadItems((prev) => {
          const next: DownloadItem[] = [];
          prev.forEach((item) => {
            if (item.scope === 'cleaner' && item.sourceImageId === imageId) {
              URL.revokeObjectURL(item.previewUrl);
              return;
            }
            next.push(item);
          });
          next.push({
            name: `koma-studio-cleaner-clean-${imgData.file.name.replace(/\s+/g, '-')}.png`,
            blob: outputBlob,
            scope: 'cleaner',
            sourceImageId: imageId,
            previewUrl,
          });
          return next;
        });
        setLastActionScope('cleaner');
        setTonedStatus(`Healing applied in the Cleaner for "${imgData.file.name}".`,
          'success',
        );
      } catch (error) {
        if (
          error instanceof TypeError &&
          /failed to fetch/i.test(error.message)
        ) {
          setTonedStatus(
            t('dashboard.status.cleanerHealingConnectFailed', { url: apiConfig.localUrl }),
            'error',
          );
        } else {
          setTonedStatus(
            error instanceof Error
              ? error.message
              : t('dashboard.status.cleanerHealingFailed'),
            'error',
          );
        }
      } finally {
        setCleanerHealingBusyByImage((prev) => {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        });
      }
    },
    [
      aioHdCropMargin,
      aioHdCropTriggerSize,
      aioHdResizeLimit,
      aioHdStrategy,
      aioMaskDilation,
      aioStageSelection.cleanImage,
      apiConfig.localUrl,
      composeCleanerEditableCanvas,
      images,
      parseApiError,
      patchCleanerManualImageEditState,
      resolveCleanerEditableBaseSourceForImage,
    ],
  );

  const clearAioManualPaintForImage = useCallback(
    (imageId: string) => {
      patchAioManualImageEditState(imageId, { paintLayerDataUrl: null });
    },
    [patchAioManualImageEditState],
  );

  const clearCleanerManualPaintForImage = useCallback(
    (imageId: string) => {
      patchCleanerManualImageEditState(imageId, { paintLayerDataUrl: null });
    },
    [patchCleanerManualImageEditState],
  );

  const resetAioManualImageEditsForImage = useCallback(
    (imageId: string) => {
      patchAioManualImageEditState(imageId, {
        paintLayerDataUrl: null,
        baseImageDataUrl: null,
        wandMaskDataUrl: null,
      });
    },
    [patchAioManualImageEditState],
  );

  const resetCleanerManualImageEditsForImage = useCallback(
    (imageId: string) => {
      patchCleanerManualImageEditState(imageId, {
        paintLayerDataUrl: null,
        baseImageDataUrl: null,
        wandMaskDataUrl: null,
      });
    },
    [patchCleanerManualImageEditState],
  );

  const applyHealingFromActiveWandSelection = useCallback(async () => {
    if (!activeId) return;
    const maskDataUrl =
      mode === 'cleaner'
        ? getCleanerManualImageEditState(activeId).wandMaskDataUrl
        : getAioManualImageEditState(activeId).wandMaskDataUrl;
    if (!maskDataUrl) {
      setTonedStatus(t('dashboard.status.wandNoSelectionForHealing'), 'error');
      return;
    }
    if (mode === 'cleaner') {
      await applyCleanerHealingMaskForImage(activeId, maskDataUrl);
      return;
    }
    await applyAioHealingMaskForImage(activeId, maskDataUrl);
  }, [
    activeId,
    applyAioHealingMaskForImage,
    applyCleanerHealingMaskForImage,
    getAioManualImageEditState,
    getCleanerManualImageEditState,
    mode,
  ]);

  const toggleManualImageTool = useCallback(
    (tool: Exclude<ManualImageEditTool, 'none'>) => {
      if (!activeStageAllowsManualImageTools) return;
      const sameTool = manualImageTool === tool;
      setSegmentEditTool('select');
      setManualImageTool(sameTool ? 'none' : tool);
      setManualToolsConfigOpen(!sameTool);
      if (!sameTool && tool === 'healing_brush') {
        tryShowHealingHint();
      }
    },
    [activeStageAllowsManualImageTools, manualImageTool, tryShowHealingHint],
  );

  const manualImageToolHasConfig = useMemo(
    () =>
      manualImageTool === 'paint' ||
      manualImageTool === 'paint_eraser' ||
      manualImageTool === 'healing_brush' ||
      manualImageTool === 'magic_wand',
    [manualImageTool],
  );

  const toggleManualToolsConfig = useCallback(() => {
    const hasAreaSelectionConfig =
      activeStageAllowsAreaTools &&
      segmentEditTool === 'select' &&
      manualImageTool === 'none';
    const hasSegmentConfig =
      activeStageAllowsSegmentTools &&
      (segmentEditTool === 'brush' || segmentEditTool === 'eraser');
    const hasManualConfig =
      activeStageAllowsManualImageTools && manualImageToolHasConfig;
    if (!hasAreaSelectionConfig && !hasSegmentConfig && !hasManualConfig) return;
    setManualToolsConfigOpen((current) => !current);
  }, [
    activeStageAllowsAreaTools,
    activeStageAllowsManualImageTools,
    activeStageAllowsSegmentTools,
    manualImageTool,
    manualImageToolHasConfig,
    segmentEditTool,
  ]);

  const renderAioImageToBlob = useCallback(
    async (imgData: LoadedImage, regions: AioTextRegion[]): Promise<Blob> => {
      const baseItem = downloadItems.find(
        (item) => item.scope === 'aio' && item.sourceImageId === imgData.id,
      );
      const canvas = await composeAioEditableCanvas(
        imgData,
        baseItem?.previewUrl ?? imgData.url,
      );
      const renderWidth = canvas.width;
      const renderHeight = canvas.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('dashboard.status.renderCanvasInitFailed'));
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const baseRenderRegions = regions.map((item) =>
        applyRenderDefaultsToRegion(
          item,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
          undefined,
          aioTgtLang,
        ),
      );
      const renderRegions = [
        ...baseRenderRegions,
        ...buildTranslationNoteOverlayRegions(
          baseRenderRegions,
          imgData.width,
          imgData.height,
          renderDefaultStyle,
          llmSettings.translation_notes_enabled,
        ),
      ];
      await Promise.all(
        renderRegions.map(async (region) => {
          const style = cloneRenderStyle(
            region.renderStyle ?? renderDefaultStyle,
          );
          await ensureCanvasFontLoaded(style, region.renderTextStyleRanges);
        }),
      );

      const scaleX = renderWidth / Math.max(1, imgData.width);
      const scaleY = renderHeight / Math.max(1, imgData.height);
      for (const region of renderRegions) {
        const text = buildDefaultRegionRenderText(region);
        if (!text.trim()) continue;
        const style = cloneRenderStyle(
          region.renderStyle ?? renderDefaultStyle,
        );
        const [x1, y1, x2, y2] = region.bbox;
        const scaledBbox: [number, number, number, number] = [
          Math.round(x1 * scaleX),
          Math.round(y1 * scaleY),
          Math.round(x2 * scaleX),
          Math.round(y2 * scaleY),
        ];
        const scaledShape = scaleTypographyShapeForBounds(
          region.shape,
          region.bbox,
          scaledBbox,
        );
        const width = Math.max(1, scaledBbox[2] - scaledBbox[0]);
        const height = Math.max(1, scaledBbox[3] - scaledBbox[1]);
        const layout = computeRenderTextLayout(
          ctx,
          text,
          width,
          height,
          style,
          scaledShape,
          region.renderTextStyleRanges,
        );
        drawRenderedTextInRegion(ctx, scaledBbox, layout, style, scaledShape);
      }

      return canvasToBlob(canvas, outFormat, outQuality);
    },
    [
      aioTgtLang,
      composeAioEditableCanvas,
      downloadItems,
      llmSettings.translation_notes_enabled,
      outFormat,
      outQuality,
      renderDefaultStyle,
    ],
  );

  const triggerBlobDownload = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);
  const splitterController = useSplitterController({
    images,
    activeImageId: activeId,
    setActiveImageId: setActiveId,
    initialWorkspaceState: splitterWorkspaceState,
    restoreToken: workspaceRestoreToken,
    onWorkspaceStateChange: setSplitterWorkspaceState,
    isDesktopRuntime,
    localApiBase: apiConfig.localUrl,
    registerDownloads,
    triggerBlobDownload,
    setProcessing,
    setProgress,
    setStatusMessage,
    ensureVerifiedEmailOrNotify,
    recordProcessedPages,
  });
  const currentSplitterWorkspaceState = useMemo<SplitterWorkspaceState>(
    () =>
      splitterWorkspaceState ?? {
        recipe: createDefaultSplitterRecipe(),
        imageStates: {},
        activeImageId: activeId,
      },
    [activeId, splitterWorkspaceState],
  );
  const currentWatermarkWorkspaceState = useMemo<WatermarkWorkspaceState>(
    () =>
      watermarkWorkspaceState ?? {
        draft: createDefaultWatermarkDraft(),
        activeImageId: activeId,
        compareMode: 'split',
        compareValue: 58,
        selectedPresetId: '',
        autoSuggestion: 'Use Smart Placement para sugerir posicionamento.',
        userPresets: [],
        watermarkImageFile: null,
        results: [],
        textZoneCache: {},
      },
    [activeId, watermarkWorkspaceState],
  );
  const currentOptimizerWorkspaceState =
    useMemo<ChapterOptimizerWorkspaceState>(
      () =>
        optimizerWorkspaceState ?? {
          recipe: {
            preset: 'web-light',
            outputFormat: 'webp',
            quality: 0.78,
            resizeEnabled: true,
            maxWidth: 1600,
            maxHeight: 2400,
            trimBorders: true,
            trimTolerance: 18,
          },
          selectedPreset: 'web-light',
          activeImageId: activeId,
          results: [],
        },
      [activeId, optimizerWorkspaceState],
    );

  const { prepareDownloadEntries, buildDownloadBundleBlob } =
    useDashboardDownloadBundle({
      outFormat,
      outQuality,
      images,
      aioDetectionsByImage,
      downloadItems,
      cleanerProcessedBaseByImage,
      downloadBundleFormat,
      downloadIncludeRawText,
      downloadIncludeTranslatedText,
      downloadIncludeInpaintedImage,
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
    lastActionScope,
    downloadBundleFormat,
    translatorWorkspaceMode,
    translatorTranslatedText,
    images,
    translatorDetectionsByImage,
    prepareDownloadEntries,
    buildDownloadBundleBlob,
    triggerBlobDownload,
    setDownloadMenuOpen,
    setStatusMessage,
  });

  const handleDownloadPsd = useDashboardPsdDownload({
    activeImage,
    images,
    mode,
    aioSrcLang,
    srcLang,
    tgtLang,
    aioTgtLang,
    localApiUrl: apiConfig.localUrl,
    aioDetectionsByImage,
    translatorDetectionsByImage,
    translatorProcessedBaseByImage,
    downloadPsdCompression,
    downloadPsdDpi,
    downloadPsdIncludeIndividualCrops,
    downloadPsdIncludeMetadataJson,
    downloadPsdIncludeOcrOverlay,
    downloadPsdIncludeRawTextLayer,
    downloadPsdIncludeTranslatedTextLayer,
    downloadPsdUsePhotoshopTextLayers,
    renderDefaultStyle,
    setDownloadPsdLoading,
    setDownloadMenuOpen,
    setStatusMessage,
    triggerBlobDownload,
    parseApiError,
    resolveAioStageKeyForImage,
    getAioDownloadItemForImage,
    hasAioManualImageEdits,
    composeAioEditableCanvas,
    setTypographerSessionSourceType: typographerWorkspace.setSessionSourceType,
    translationNotesEnabled: llmSettings.translation_notes_enabled,
    applyDetectedGradientToStyle,
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
    setEnhanceActionBusy,
    setStatusMessage,
  });

  const { importSelectedEnhanceModel, processEnhance } =
    useDashboardEnhanceActions({
      isDesktopRuntime,
      localApiUrl: apiConfig.localUrl,
      selectedEnhanceModel,
      selectedEnhanceInstallState,
      images,
      enhanceScale,
      enhanceProfile,
      enhanceOutputFormat,
      ensureVerifiedEmailOrNotify,
        emitProcessStartWebhook,
      emitProcessCompleteWebhook,
      emitProcessErrorWebhook,
      registerDownloads,
      recordProcessedPages,
      syncDiscordForTab,
      discord,
      effectiveBatchConcurrency,
      setProcessing,
      setProgress,
      setStatusMessage,
      setEnhanceActionBusy,
      importOnnxModelFromStorage,
      refreshModelState,
    });

  const {
    getAioRegionsFromSnapshot,
    setManualStageForActiveImage,
    completeManualStageForImage,
    syncActiveManualStageSnapshot,
  } = useAioManualProgressControls({
    activeId,
    aioPipelineSnapshots,
    aioManualProgressByImage,
    aioImageSnapshotIndexById,
    aioDetectionsByImage,
    aioSelectedRegionByImage,
    applyAioPipelineSnapshotToImage,
    syncManualStagePreviewToNextStage,
    setAioManualProgressByImage,
    setStatusMessage,
  });

  useEffect(() => {
    if (mode !== 'aio' || subMode !== 'manual') return;
    syncActiveManualStageSnapshot();
  }, [mode, subMode, syncActiveManualStageSnapshot]);

  const executeManualStageForActiveImage = useAioManualStageExecutor({
    activeId,
    processing,
    images,
    aioManualProgressByImage,
    aioAutoProcessedImageById,
    aioDetectionsByImage,
    aioStageOptions: {
      detectText: aioStageOptions.detectText,
      recognizeText: aioStageOptions.recognizeText,
      segmentText: aioStageOptions.segmentText,
      cleanImage: aioStageOptions.cleanImage,
    },
    aioStageSelection: {
      detectText: aioStageSelection.detectText,
      recognizeText: aioStageSelection.recognizeText,
      getTranslations: aioStageSelection.getTranslations,
      segmentText: aioStageSelection.segmentText,
      cleanImage: aioStageSelection.cleanImage,
    },
    aioSrcLang,
    aioTgtLang,
    aioMaskDilation,
    aioHdStrategy,
    aioHdResizeLimit,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    gpuStages: aioGpuStages,
    minRegionSize: MIN_REGION_SIZE,
    llmSettings,
    renderDefaultStyle,
    localApiUrl: apiConfig.localUrl,
    modelEntries: modelManagerState.entries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
    getAioStageOption,
    parseApiError,
    getAioRegionsFromSnapshot,
    getAioManualImageEditState,
    patchAioSnapshotStageForImage,
    completeManualStageForImage,
    recordProcessedPages,
    syncDiscordForTab,
    setProcessing,
    setProgress,
    setStatusMessage,
    applyDetectedGradientToStyle,
    getAbortSignal: getActiveAioAbortSignal,
    onStageStart: (stageKey, image, index) =>
      updateAioExecutionStage('manual', stageKey, image, index, 1),
    setRuntimeExecutionNotice,
  });

  const skipManualStageForActiveImage = useAioManualStageSkip({
    activeId,
    aioManualProgressByImage,
    completeManualStageForImage,
    setStatusMessage,
  });

  const handleExecuteManualAioStage = useCallback(async () => {
    if (processing) {
      return;
    }
    setRuntimeExecutionNotice(null);

    if (resolvedActiveId && activeManualProgress) {
      const currentStageIndex = clamp(
        activeManualProgress.currentIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      beginAioExecution('manual', 1, [
        AIO_MANUAL_STAGE_ORDER[currentStageIndex]!,
      ]);
    }

    await executeManualStageForActiveImage();
    setTimeout(() => {
      if (!processingRef.current) {
        clearAioExecutionState();
      }
    }, 0);
  }, [
    activeManualProgress,
    beginAioExecution,
    clearAioExecutionState,
    executeManualStageForActiveImage,
    processing,
    resolvedActiveId,
  ]);

  const prepareAioExecution = useAioExecutionPreparation({
    imagesCount: images.length,
    aioSteps,
    aioSrcLang,
    detectSelectionKey: aioStageSelection.detectText,
    ocrSelectionKey: aioStageSelection.recognizeText,
    translationSelectionKey: aioStageSelection.getTranslations,
    segmentSelectionKey: aioStageSelection.segmentText,
    cleanSelectionKey: aioStageSelection.cleanImage,
    effectiveBatchConcurrency,
    modelEntries: modelManagerState.entries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    getAioStageOption,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    refreshSession,
    getAuthToken,
    invalidateAioPipelineHistory,
    setAioManualImageEditsByImage,
    setAioManualHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
  });

  const processSingleAioImageWithHook = useAioSingleImageProcessor({
    localApiUrl: apiConfig.localUrl,
    minRegionSize: MIN_REGION_SIZE,
    renderDefaultStyle,
    applyDetectedGradientToStyle,
    isDesktopRuntime,
    refreshSession,
    parseApiError,
    getAbortSignal: getActiveAioAbortSignal,
    onStageStart: (stageKey, image, index) =>
      updateAioExecutionStage('auto', stageKey, image, index, images.length),
    setRuntimeExecutionNotice,
  });

  const consolidateAioResults = useAioResultConsolidation({
    aioSteps,
    buildAioImageSnapshotIndexMap,
    setAioAutoProcessedImageById,
    setAioDetectionsByImage,
    setAioSelectedRegionByImage,
    setAioPipelineSnapshots,
    setAioPipelineSnapshotIndex,
    setAioImageSnapshotIndexById,
    setAioAutoHistoryAvailable,
    setAioDownloadItems,
  });

  // processAIO uses a ref pattern to avoid stale closures from ~30+ state deps.
  // The ref is updated on every render so the async function always reads current values.
  const processAIORef = useRef<(() => Promise<void>) | null>(null);
  const aioStateRef = useRef({
    ensureVerifiedEmailOrNotify,
    setRuntimeExecutionNotice,
    AIO_MANUAL_STAGE_ORDER,
    aioSteps,
    beginAioExecution,
    images,
    prepareAioExecution,
    clearAioExecutionState,
    processSingleAioImageWithHook,
    user,
    aioSrcLang,
    aioTgtLang,
    aioMaskDilation,
    aioHdStrategy,
    aioHdResizeLimit,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    aioGpuStages,
    llmSettings,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    effectiveBatchConcurrency,
    runConcurrentBatch,
    getActiveAioAbortSignal,
    setProgress,
    consolidateAioResults,
    recordProcessedPages,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    setTonedStatus,
    t,
    aioPipelineStageProgressLabels,
    isAbortError,
    isTimeoutError,
    aioExecutionStatus,
    syncDiscordForTab,
    setProcessing,
    tryShowHealingHint,
  });

  aioStateRef.current = {
    ensureVerifiedEmailOrNotify,
    setRuntimeExecutionNotice,
    AIO_MANUAL_STAGE_ORDER,
    aioSteps,
    beginAioExecution,
    images,
    prepareAioExecution,
    clearAioExecutionState,
    processSingleAioImageWithHook,
    user,
    aioSrcLang,
    aioTgtLang,
    aioMaskDilation,
    aioHdStrategy,
    aioHdResizeLimit,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    aioGpuStages,
    llmSettings,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    effectiveBatchConcurrency,
    runConcurrentBatch,
    getActiveAioAbortSignal,
    setProgress,
    consolidateAioResults,
    recordProcessedPages,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    setTonedStatus,
    t,
    aioPipelineStageProgressLabels,
    isAbortError,
    isTimeoutError,
    aioExecutionStatus,
    syncDiscordForTab,
    setProcessing,
    tryShowHealingHint,
  };

  processAIORef.current = async () => {
    const s = aioStateRef.current;
    if (!s.ensureVerifiedEmailOrNotify()) return;
    s.setRuntimeExecutionNotice(null);
    const enabledStageKeys = s.AIO_MANUAL_STAGE_ORDER.filter((stageKey) =>
      stageKey === 'detectText'
        ? true
        : stageKey === 'recognizeText'
          ? s.aioSteps.recognizeText
          : stageKey === 'getTranslations'
            ? s.aioSteps.getTranslations
            : stageKey === 'segmentText'
              ? s.aioSteps.segmentText
              : stageKey === 'cleanImage'
                ? s.aioSteps.cleanImage
                : s.aioSteps.render,
    );
    s.beginAioExecution('auto', s.images.length, enabledStageKeys);
    const preparedAioExecution = await s.prepareAioExecution();
    if (!preparedAioExecution) {
      s.clearAioExecutionState();
      return;
    }

    const {
      selectedDetectorKey,
      selectedOcrKey,
      selectedTranslationKey,
      selectedSegmentKey,
      selectedCleanKey,
      useCloudOcr,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
    } = preparedAioExecution;

    const logAioBatchDebug = (...args: unknown[]) => {
      if (
        !import.meta.env.DEV ||
        typeof console === 'undefined' ||
        typeof console.info !== 'function'
      ) {
        return;
      }
      console.info('[AIO batch]', ...args);
    };
    const executionStrategy = 'per-image-concurrent';

    try {
      const processSingleAioImage = (imgData: LoadedImage, index: number) =>
        s.processSingleAioImageWithHook(
          imgData,
          index,
          {
            sourceLanguage: s.aioSrcLang,
            targetLanguage: s.aioTgtLang,
            detectSelectionKey: selectedDetectorKey,
            ocrSelectionKey: selectedOcrKey,
            translationSelectionKey: selectedTranslationKey,
            segmentSelectionKey: selectedSegmentKey,
            cleanSelectionKey: selectedCleanKey,
            aioSteps: {
              recognizeText: s.aioSteps.recognizeText,
              getTranslations: s.aioSteps.getTranslations,
              segmentText: s.aioSteps.segmentText,
              cleanImage: s.aioSteps.cleanImage,
              render: s.aioSteps.render,
            },
            useCloudOcr: useCloudOcr ?? false,
            useLlmSettingsForOcr: useLlmSettingsForOcr ?? false,
            useLlmSettingsForTranslation: useLlmSettingsForTranslation ?? false,
            llmSettings: s.llmSettings,
            selectedCustomOcrProfile: s.selectedCustomOcrProfile,
            selectedCustomTranslationProfile: s.selectedCustomTranslationProfile,
            maskDilation: s.aioMaskDilation,
            hdStrategy: s.aioHdStrategy,
            hdResizeLimit: s.aioHdResizeLimit,
            hdCropMargin: s.aioHdCropMargin,
            hdCropTriggerSize: s.aioHdCropTriggerSize,
            gpuStages: s.aioGpuStages,
          },
        );

      logAioBatchDebug('strategy', {
        type: executionStrategy,
        concurrency: s.effectiveBatchConcurrency,
        stages: {
          detect: Boolean(s.aioSteps.detectText),
          ocr: Boolean(s.aioSteps.recognizeText),
          translation: Boolean(s.aioSteps.getTranslations),
          segment: Boolean(s.aioSteps.segmentText),
          clean: Boolean(s.aioSteps.cleanImage),
        },
      });

      const imageResults = await s.runConcurrentBatch({
        items: s.images,
        concurrency: s.effectiveBatchConcurrency,
        signal: s.getActiveAioAbortSignal(),
        worker: async ({ item: imgData, index }) =>
          processSingleAioImage(imgData, index),
        onProgress: ({ completed }) => {
          if (completed >= s.images.length) {
            s.setProgress(100);
          }
        },
      });

      const {
        processedPagesCount,
        totalDetections,
        totalRecognized,
        totalTranslated,
        totalSegmented,
        totalCleaned,
        totalRendered,
        finalMessage,
      } = s.consolidateAioResults(imageResults);

      if (processedPagesCount > 0) {
        s.recordProcessedPages(processedPagesCount);
      }
      logAioBatchDebug('final-summary', {
        strategy: executionStrategy,
        total_detected: totalDetections,
        total_recognized: totalRecognized,
        total_translated: totalTranslated,
        total_segmented: totalSegmented,
        total_cleaned_images: totalCleaned,
        processed_pages: processedPagesCount,
      });
      s.emitProcessCompleteWebhook('AIO', s.images.length, {
        regioes_detectadas: totalDetections,
        textos_reconhecidos: totalRecognized,
        traducoes_geradas: totalTranslated,
        regioes_segmentadas: totalSegmented,
        imagens_limpas: totalCleaned,
        blocos_render_prontos: totalRendered,
        paginas_processadas: processedPagesCount,
        estrategia: executionStrategy,
      });
      s.setTonedStatus(s.t('dashboard.status.aioCompleteAdjust', { message: finalMessage }), 'success');
      s.tryShowHealingHint();
      if (finalMessage.includes('caiu para CPU por falta de VRAM')) {
        window.setTimeout(() => {
          s.setRuntimeExecutionNotice(null);
        }, 4500);
      } else {
        s.setRuntimeExecutionNotice(null);
      }
    } catch (error) {
      if (s.isAbortError(error)) {
        s.setTonedStatus(s.t('dashboard.status.aioAborted'), 'warning');
      } else if (s.isTimeoutError(error)) {
        const stageLabel = s.aioExecutionStatus?.stageKey
          ? s.aioPipelineStageProgressLabels[
              s.aioExecutionStatus.stageKey as AioPipelineSnapshotKey
            ]
          : 'OCR';
        s.setTonedStatus(
          `Timed out during the "${stageLabel}" stage. The mini-backend may have crashed, restarted, or taken too long to respond.`,
          'error',
        );
      } else {
        s.emitProcessErrorWebhook('AIO', s.images.length, error, {
          estrategia: executionStrategy,
        });
        s.setTonedStatus(
          error instanceof Error ? error.message : s.t('dashboard.status.aioExecutionFailed'),
          'error',
        );
      }
    } finally {
      s.setProcessing(false);
      s.setProgress(0);
      s.clearAioExecutionState();
      void s.syncDiscordForTab();
    }
  };

  const processAIO = () => processAIORef.current?.();

  const {
    resolveTranslatorTranslationExecution,
    resolveTranslatorOcrExecution,
  } = useTranslatorExecutionResolvers({
    translationSelectionKey: aioStageSelection.getTranslations,
    ocrSelectionKey: aioStageSelection.recognizeText,
    srcLang,
    tgtLang,
    modelEntries: modelManagerState.entries,
    translationStageOptionsForSelect,
    translatorOcrStageOptionsForSelect,
    selectedCustomTranslationProfile,
    selectedCustomOcrProfile,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
  });

  const runTranslatorText = useTranslatorTextActions({
    translatorDraftText,
    srcLang,
    tgtLang,
    llmSettings,
    localApiUrl: apiConfig.localUrl,
    selectedCustomTranslationProfile,
    ensureVerifiedEmailOrNotify,
    parseApiError,
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
    setProcessing,
    setTranslatorTextRunning,
    setProgress,
    setTranslatorTranslatedText,
    setTranslatorLastTextModelUsed,
    setTranslatorTextDirty,
    setLastActionScope,
    setStatusMessage,
  });

  const processTranslatorVisual = useTranslatorVisualActions({
    images,
    activeId,
    activeTranslatorSelectedRegionId,
    translatorVisualProcessingMode,
    translatorSfxCleanModelKey,
    translatorSfxAdditionalInstructions,
    detectSelectionKey: aioStageSelection.detectText,
    srcLang,
    tgtLang,
    llmSettings,
    localApiUrl: apiConfig.localUrl,
    minRegionSize: MIN_REGION_SIZE,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    selectedTranslatorSfxCleanCustomProfile,
    ensureVerifiedEmailOrNotify,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
    parseApiError,
    resolveTranslatorOcrExecution,
    resolveTranslatorTranslationExecution,
    setDiscordTranslating,
    syncDiscordForTab,
    recordProcessedPages,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessCompleteWebhook: (name, pages, context) =>
      emitProcessCompleteWebhook(name, pages, (context as WebhookMetrics) ?? {}),
    emitProcessErrorWebhook: (name, pages, error, context) =>
      emitProcessErrorWebhook(name, pages, error, (context as WebhookMetrics) ?? {}),
    setTranslatorWorkspaceMode,
    setProcessing,
    setTranslatorVisualRunning,
    setProgress,
    setTranslatorDetectionsByImage,
    setTranslatorSelectedRegionByImage,
    setTranslatorRunMetaByImage,
    setTranslatorProcessedBaseByImage,
    setLastActionScope,
    setStatusMessage,
  });

  const retranslateTranslatorRegions = useTranslatorRetranslate({
    images,
    translatorDetectionsByImage,
    activeTranslatorSelectedRegionId,
    translatorVisualProcessingMode,
    translatorSfxAdditionalInstructions,
    detectSelectionKey: aioStageSelection.detectText,
    ocrSelectionKey: aioStageSelection.recognizeText,
    srcLang,
    tgtLang,
    llmSettings,
    localApiUrl: apiConfig.localUrl,
    selectedCustomTranslationProfile,
    ensureVerifiedEmailOrNotify,
    parseApiError,
    resolveTranslatorTranslationExecution,
    setDiscordTranslating,
    syncDiscordForTab,
    recordProcessedPages,
    updateTranslatorRegionsForImage,
    setTranslatorRunMetaByImage,
    setLastActionScope,
    setProcessing,
    setTranslatorVisualRunning,
    setProgress,
    setStatusMessage,
  });

  const releaseWorkspaceObjectUrls = useCallback(() => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url);
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    downloadItems.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    currentWatermarkWorkspaceState.results.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
  }, [currentWatermarkWorkspaceState.results, downloadItems, images]);

  const buildCurrentWorkspaceCaptureState =
    useCallback((): DashboardWorkspaceCaptureState => ({
      autosaveScope: authUser?.id ? 'user' : 'guest',
      autosaveUserId: authUser?.id ?? null,
      mode,
      subMode,
      activeImageId: activeId,
      viewMode,
      translatorWorkspaceMode,
      translatorVisualProcessingMode,
      statusMessage,
      lastActionScope,
      images,
      downloadItems,
      batchThreadsEnabled,
      batchThreads,
      aio: {
        steps: aioSteps,
        stageSelection: aioStageSelection,
        presetState: aioPresetState,
        maskDilation: aioMaskDilation,
        hdStrategy: aioHdStrategy,
        hdResizeLimit: aioHdResizeLimit,
        hdCropMargin: aioHdCropMargin,
        hdCropTriggerSize: aioHdCropTriggerSize,
        detectionsByImage: aioDetectionsByImage,
        selectedRegionByImage: aioSelectedRegionByImage,
        pipelineSnapshots: aioPipelineSnapshots as unknown as DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'],
        pipelineSnapshotIndex: aioPipelineSnapshotIndex,
        imageSnapshotIndexById: aioImageSnapshotIndexById,
        autoHistoryAvailable: aioAutoHistoryAvailable,
        autoProcessedImageById: aioAutoProcessedImageById,
        // v2 does not charge manual quota (unified-contract field used by v1)
        manualQuotaChargedByImage: {},
        manualProgressByImage: aioManualProgressByImage,
        manualImageEditsByImage: aioManualImageEditsByImage as unknown as DashboardWorkspaceCaptureState['aio']['manualImageEditsByImage'],
      },
      cleaner: {
        detectionsByImage: cleanerDetectionsByImage,
        selectedRegionByImage: cleanerSelectedRegionByImage,
        processedBaseByImage: cleanerProcessedBaseByImage,
        runMetaByImage: cleanerRunMetaByImage,
        manualImageEditsByImage: cleanerManualImageEditsByImage,
      },
      translator: {
        srcLang,
        tgtLang,
        aioSrcLang,
        aioTgtLang,
        translatorDraftText,
        translatorTranslatedText,
        translatorLastTextModelUsed,
        translatorTextDirty,
        translatorDetectionsByImage,
        translatorSelectedRegionByImage,
        translatorRunMetaByImage,
        translatorProcessedBaseByImage,
      },
      typesetter: {
        selectionTool: typographerSelectionTool,
        queueSelectedId: typographerQueueSelectedId,
        snapshotName: typographerSnapshotName,
        selectedSnapshotId: typographerSelectedSnapshotId,
        sessionsByImage: typographerWorkspace.sessionsByImage,
      },
      enhance: {
        scale: enhanceScale,
        profile: enhanceProfile,
        modelId: enhanceModelId,
        outputFormat: enhanceOutputFormat,
      },
      utility: {
        stitch: {
          stitchLayoutMode,
          stitchBatchStrategy,
          stitchBatchSize,
          stitchTargetPrimaryAxis,
          stitchGap,
          stitchAlignMode,
          stitchBackground,
          stitchSingleExportFormat,
          stitchFileBaseName,
          stitchSelectedBatchIndex,
          stitchBatchIndexes,
        },
        splitter: currentSplitterWorkspaceState,
        watermark: currentWatermarkWorkspaceState,
        optimizer: currentOptimizerWorkspaceState,
      },
      llm: {
        llmSettings,
        customLlmProfiles,
        customLlmProfilesMode,
        pendingCustomSelections,
        customLlmDrafts,
        freeProviderDrafts,
      },
    }), [
      activeId,
      aioAutoHistoryAvailable,
      aioAutoProcessedImageById,
      aioDetectionsByImage,
      aioHdCropMargin,
      aioHdCropTriggerSize,
      aioHdResizeLimit,
      aioHdStrategy,
      aioImageSnapshotIndexById,
      aioManualImageEditsByImage,
      aioManualProgressByImage,
      aioMaskDilation,
      aioPipelineSnapshotIndex,
      aioPipelineSnapshots,
      aioPresetState,
      aioSelectedRegionByImage,
      aioSrcLang,
      aioStageSelection,
      aioSteps,
      aioTgtLang,
      authUser?.id,
      batchThreads,
      batchThreadsEnabled,
      cleanerDetectionsByImage,
      cleanerManualImageEditsByImage,
      cleanerProcessedBaseByImage,
      cleanerRunMetaByImage,
      cleanerSelectedRegionByImage,
      currentOptimizerWorkspaceState,
      currentSplitterWorkspaceState,
      currentWatermarkWorkspaceState,
      customLlmDrafts,
      customLlmProfiles,
      customLlmProfilesMode,
      downloadItems,
      enhanceModelId,
      enhanceOutputFormat,
      enhanceProfile,
      enhanceScale,
      freeProviderDrafts,
      images,
      lastActionScope,
      llmSettings,
      mode,
      pendingCustomSelections,
      srcLang,
      statusMessage,
      stitchAlignMode,
      stitchBackground,
      stitchBatchIndexes,
      stitchBatchSize,
      stitchBatchStrategy,
      stitchFileBaseName,
      stitchGap,
      stitchLayoutMode,
      stitchSelectedBatchIndex,
      stitchSingleExportFormat,
      stitchTargetPrimaryAxis,
      subMode,
      tgtLang,
      translatorDetectionsByImage,
      translatorDraftText,
      translatorLastTextModelUsed,
      translatorProcessedBaseByImage,
      translatorRunMetaByImage,
      translatorSelectedRegionByImage,
      translatorTextDirty,
      translatorTranslatedText,
      translatorVisualProcessingMode,
      translatorWorkspaceMode,
      typographerQueueSelectedId,
      typographerSelectedSnapshotId,
      typographerSelectionTool,
      typographerSnapshotName,
      typographerWorkspace.sessionsByImage,
      viewMode,
    ]);

  useEffect(() => {
    if (!workspaceAutosaveSettings.enabled) {
      latestWorkspaceCaptureStateRef.current = null;
      return;
    }

    latestWorkspaceCaptureStateRef.current = buildCurrentWorkspaceCaptureState();
  }, [buildCurrentWorkspaceCaptureState, workspaceAutosaveSettings.enabled]);

  const applyRestoredWorkspaceState = useCallback(
    async (
      restored: DashboardWorkspaceRestoreState,
      options?: { statusDetail?: string },
    ) => {
      releaseWorkspaceObjectUrls();
      setMode(restored.document.view.mode as ToolMode);
      setSubMode(restored.document.view.subMode as SubMode);
      setActiveId(restored.document.view.activeImageId);
      setViewMode(restored.document.view.viewMode as ViewMode);
      setTranslatorWorkspaceMode(
        restored.document.view.translatorWorkspaceMode as TranslatorWorkspaceMode,
      );
      setTranslatorVisualProcessingMode(
        (restored.document.view.translatorVisualProcessingMode as TranslatorVisualProcessingMode | undefined) ?? 'standard',
      );
      setStatusMessage(
        restored.document.footer.statusMessage || t('dashboard.status.workspaceRestored'),
      );
      setLastActionScope(
        restored.document.footer.lastActionScope as ProcessableMode | null,
      );
      setImages(restored.images);
      setDownloadItems(restored.downloadItems);
      setBatchThreadsEnabled(restored.document.batchThreadsEnabled);
      setBatchThreads(restored.document.batchThreads);

      setAioSteps(restored.document.aio.steps as typeof aioSteps);
      setAioStageSelection(
        restored.document.aio.stageSelection as AioStageSelection,
      );
      setAioPresetState(
        restored.document.aio.presetState as AioModelPresetStateV2,
      );
      setAioMaskDilation(restored.document.aio.maskDilation);
      setAioHdStrategy(
        restored.document.aio.hdStrategy as typeof aioHdStrategy,
      );
      setAioHdResizeLimit(restored.document.aio.hdResizeLimit);
      setAioHdCropMargin(restored.document.aio.hdCropMargin);
      setAioHdCropTriggerSize(restored.document.aio.hdCropTriggerSize);
      setAioDetectionsByImage(
        restored.document.aio.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      setAioSelectedRegionByImage(
        restored.document.aio.selectedRegionByImage,
      );
      setAioPipelineSnapshots(
        restored.aio.pipelineSnapshots as unknown as AioPipelineSnapshot[],
      );
      setAioPipelineSnapshotIndex(restored.document.aio.pipelineSnapshotIndex);
      setAioImageSnapshotIndexById(
        restored.document.aio.imageSnapshotIndexById,
      );
      setAioAutoHistoryAvailable(restored.document.aio.autoHistoryAvailable);
      setAioAutoProcessedImageById(
        restored.document.aio.autoProcessedImageById,
      );
      setAioManualProgressByImage(
        restored.document.aio.manualProgressByImage as Record<
          string,
          AioManualImageProgress
        >,
      );
      setAioManualImageEditsByImage(
        restored.aio.manualImageEditsByImage as Record<
          string,
          AioManualImageEditState
        >,
      );
      setAioManualHealingBusyByImage({});

      setCleanerDetectionsByImage(
        restored.cleaner.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      setCleanerSelectedRegionByImage(
        restored.cleaner.selectedRegionByImage,
      );
      setCleanerProcessedBaseByImage(restored.cleaner.processedBaseByImage);
      setCleanerRunMetaByImage(
        restored.document.cleaner.runMetaByImage as Record<
          string,
          CleanerRunMeta
        >,
      );
      setCleanerManualImageEditsByImage(
        restored.cleaner.manualImageEditsByImage,
      );
      setCleanerHealingBusyByImage({});

      setSrcLang(restored.document.translator.srcLang);
      setTgtLang(restored.document.translator.tgtLang);
      setAioSrcLang(restored.document.translator.aioSrcLang);
      setAioTgtLang(restored.document.translator.aioTgtLang);
      setTranslatorDraftText(restored.document.translator.translatorDraftText);
      setTranslatorTranslatedText(
        restored.document.translator.translatorTranslatedText,
      );
      setTranslatorLastTextModelUsed(
        restored.document.translator.translatorLastTextModelUsed,
      );
      setTranslatorTextDirty(restored.document.translator.translatorTextDirty);
      setTranslatorDetectionsByImage(
        restored.document.translator
          .translatorDetectionsByImage as Record<string, AioTextRegion[]>,
      );
      setTranslatorSelectedRegionByImage(
        restored.document.translator.translatorSelectedRegionByImage,
      );
      setTranslatorRunMetaByImage(
        restored.document.translator
          .translatorRunMetaByImage as Record<string, TranslatorVisualRunMeta>,
      );
      setTranslatorProcessedBaseByImage(
        restored.translator.translatorProcessedBaseByImage,
      );
      setTranslatorVisualRunning(false);
      setTranslatorTextRunning(false);

      setTypographerSelectionTool(
        restored.typesetter.selectionTool as typeof typographerSelectionTool,
      );
      setTypographerQueueSelectedId(restored.typesetter.queueSelectedId);
      setTypographerSnapshotName(restored.typesetter.snapshotName);
      setTypographerSelectedSnapshotId(restored.typesetter.selectedSnapshotId);
      typographerWorkspace.replaceSessionsByImage(
        restored.typesetter.sessionsByImage,
      );

      setEnhanceScale(restored.document.enhance.scale as EnhanceScale);
      setEnhanceProfile(
        restored.document.enhance.profile as EnhanceProfile,
      );
      setEnhanceModelId(restored.document.enhance.modelId);
      setEnhanceOutputFormat(
        restored.document.enhance.outputFormat as 'png' | 'webp',
      );

      setStitchLayoutMode(
        restored.document.utility.stitch
          .stitchLayoutMode as StitchLayoutMode,
      );
      setStitchBatchStrategy(
        restored.document.utility.stitch
          .stitchBatchStrategy as StitchBatchStrategy,
      );
      setStitchBatchSize(restored.document.utility.stitch.stitchBatchSize);
      setStitchTargetPrimaryAxis(
        restored.document.utility.stitch.stitchTargetPrimaryAxis,
      );
      setStitchGap(restored.document.utility.stitch.stitchGap);
      setStitchAlignMode(
        restored.document.utility.stitch.stitchAlignMode as StitchAlignMode,
      );
      setStitchBackground(restored.document.utility.stitch.stitchBackground);
      setStitchSingleExportFormat(
        restored.document.utility.stitch
          .stitchSingleExportFormat as 'png' | 'jpeg' | 'webp',
      );
      setStitchFileBaseName(restored.document.utility.stitch.stitchFileBaseName);
      setStitchSelectedBatchIndex(
        restored.document.utility.stitch.stitchSelectedBatchIndex,
      );
      setStitchBatchIndexes(
        restored.document.utility.stitch.stitchBatchIndexes,
      );
      setSplitterWorkspaceState(
        restored.utility.splitter as SplitterWorkspaceState | null,
      );
      setWatermarkWorkspaceState(
        restored.utility.watermark as WatermarkWorkspaceState | null,
      );
      setOptimizerWorkspaceState(
        restored.utility.optimizer as ChapterOptimizerWorkspaceState | null,
      );

      setLlmSettings(
        restored.document.llm.llmSettings as LlmRequestSettings,
      );
      setCustomLlmProfiles((prev) => {
        const restoredProfiles =
          (restored.document.llm.customLlmProfiles as CustomLlmProfile[]) ?? [];
        const byId = new Map<string, CustomLlmProfile>();
        for (const profile of [...prev, ...restoredProfiles]) {
          if (!profile?.id) {
            continue;
          }
          const current = byId.get(profile.id);
          if (!current) {
            byId.set(profile.id, profile);
            continue;
          }
          const currentTime = Date.parse(current.updatedAt || current.createdAt || '');
          const nextTime = Date.parse(profile.updatedAt || profile.createdAt || '');
          if (Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime)) {
            byId.set(profile.id, profile);
          }
        }
        return Array.from(byId.values()).sort((left, right) =>
          left.label.localeCompare(right.label, 'pt-BR'),
        );
      });
      setCustomLlmProfilesMode((prev) => {
        if (prev === 'desktop_secure' || prev === 'desktop_local') {
          return prev;
        }
        return restored.document.llm.customLlmProfilesMode as LlmProfilesPersistenceMode;
      });
      setPendingCustomSelections(
        restored.document.llm.pendingCustomSelections as Record<
          CustomLlmStage,
          string | null
        >,
      );
      setCustomLlmDrafts(
        (() => {
          const restoredDrafts = restored.document.llm.customLlmDrafts as Record<CustomLlmStage, CustomLlmProfileDraft> | undefined;
          return {
            translation: restoredDrafts?.translation ?? createEmptyCustomLlmDraft(),
            ocr: restoredDrafts?.ocr ?? createEmptyCustomLlmDraft(),
            clean: restoredDrafts?.clean ?? createEmptyCustomLlmDraft(),
          };
        })(),
      );
      setFreeProviderDrafts(
        restored.document.llm.freeProviderDrafts as FreeProviderDraftMap,
      );
      setWorkspaceRestoreToken((prev) => prev + 1);
      setWorkspaceStatus('idle');
      setWorkspaceStatusDetail(
        options?.statusDetail ?? 'Workspace local restaurado.',
      );
      setProcessing(false);
      setProgress(0);
    },
    [
      aioHdStrategy,
      aioSteps,
      releaseWorkspaceObjectUrls,
      setFreeProviderDrafts,
      typographerSelectionTool,
      typographerWorkspace,
    ],
  );

  const workspaceHistory = useWorkspaceHistory<DashboardWorkspaceHistorySnapshot>(
    {
      disposeSnapshot: releaseWorkspaceHistorySnapshot,
      onRestore: async (snapshot) => {
        workspaceHistoryReadyRef.current = false;
        const restored = await restoreWorkspaceHistorySnapshot(snapshot);
        const restoredCaptureState = buildCaptureStateFromRestored(restored);
        workspaceHistorySignatureRef.current =
          buildWorkspaceHistorySignature(restoredCaptureState);
        workspaceAutosaveSignatureRef.current =
          buildWorkspaceAutosaveSignature(restoredCaptureState);
        await applyRestoredWorkspaceState(restored, {
          statusDetail: t('dashboard.status.historyRestored'),
        });
      },
    },
  );

  const buildCaptureStateFromRestored = useCallback(
    (restored: DashboardWorkspaceRestoreState): DashboardWorkspaceCaptureState => ({
      autosaveScope: restored.document.autosaveScope,
      autosaveUserId: restored.document.autosaveUserId,
      mode: restored.document.view.mode,
      subMode: restored.document.view.subMode,
      activeImageId: restored.document.view.activeImageId,
      viewMode: restored.document.view.viewMode,
      translatorWorkspaceMode: restored.document.view.translatorWorkspaceMode,
      translatorVisualProcessingMode:
        (restored.document.view.translatorVisualProcessingMode ??
          'sequential') as DashboardWorkspaceCaptureState['translatorVisualProcessingMode'],
      statusMessage: restored.document.footer.statusMessage,
      lastActionScope: restored.document.footer.lastActionScope,
      images: restored.images,
      downloadItems: restored.downloadItems,
      batchThreadsEnabled: restored.document.batchThreadsEnabled,
      batchThreads: restored.document.batchThreads,
      aio: restored.aio,
      cleaner: {
        detectionsByImage: restored.cleaner.detectionsByImage,
        selectedRegionByImage: restored.cleaner.selectedRegionByImage,
        processedBaseByImage: restored.cleaner.processedBaseByImage,
        runMetaByImage: restored.document.cleaner.runMetaByImage as Record<string, CleanerRunMeta>,
        manualImageEditsByImage: restored.cleaner.manualImageEditsByImage,
      },
      translator: {
        ...restored.document.translator,
        translatorProcessedBaseByImage:
          (restored.document.translator as unknown as {
            translatorProcessedBaseByImage?: Record<string, string>;
            translatorProcessedBaseAssetByImage?: Record<string, string>;
          }).translatorProcessedBaseByImage ??
          (restored.document.translator as unknown as {
            translatorProcessedBaseAssetByImage?: Record<string, string>;
          }).translatorProcessedBaseAssetByImage ??
          {},
      },
      typesetter: restored.typesetter,
      enhance: restored.document.enhance,
      utility: {
        stitch: restored.document.utility.stitch,
        splitter: restored.utility.splitter,
        watermark: restored.utility.watermark,
        optimizer: restored.utility.optimizer,
      },
      llm: restored.document.llm,
    }),
    [],
  );

  const seedWorkspaceHistory = useCallback((
    snapshot?: DashboardWorkspaceHistorySnapshot,
    captureStateOverride?: DashboardWorkspaceCaptureState,
  ) => {
    workspaceHistoryReadyRef.current = false;
    workspaceAutosaveDirtyRef.current = false;
    const captureState = captureStateOverride ?? buildCurrentWorkspaceCaptureState();
    workspaceHistorySignatureRef.current =
      buildWorkspaceHistorySignature(captureState);
    workspaceAutosaveSignatureRef.current =
      buildWorkspaceAutosaveSignature(captureState);
    workspaceHistory.setBaseline(
      snapshot ??
        captureWorkspaceHistorySnapshot(captureState),
    );
  }, [buildCurrentWorkspaceCaptureState, workspaceHistory]);

  const commitWorkspaceHistory = useCallback(
    (delayMs?: number) => {
      if (delayMs && delayMs > 0) {
        workspaceHistory.queueCommit(
          () =>
            captureWorkspaceHistorySnapshot(
              buildCurrentWorkspaceCaptureState(),
            ),
          delayMs,
        );
        return;
      }

      workspaceHistory.commit(
        captureWorkspaceHistorySnapshot(buildCurrentWorkspaceCaptureState()),
      );
    },
    [buildCurrentWorkspaceCaptureState, workspaceHistory],
  );

  const saveWorkspaceAutosave = useCallback(async (
    captureStateOverride?: DashboardWorkspaceCaptureState | null,
  ): Promise<boolean> => {
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) return false;
    if (workspaceHistory.isRestoringRef.current) return false;
    if (workspaceAutosaveSavingRef.current) return false;
    workspaceAutosaveSavingRef.current = true;
    try {
      const captureState =
        captureStateOverride ??
        latestWorkspaceCaptureStateRef.current ??
        buildCurrentWorkspaceCaptureState();
      setWorkspaceStatus('saving');
      setWorkspaceStatusDetail('Saving local workspace...');
      const payload = await captureWorkspaceDocument(captureState);
      await desktopWorkspace.saveAutosave({
        userId: authUser?.id ?? null,
        payload,
      });
      workspaceAutosaveSignatureRef.current =
        buildWorkspaceAutosaveSignature(captureState);
      setWorkspaceStatus('saved');
      setWorkspaceStatusDetail('Workspace saved locally.');
      setWorkspaceLastSavedAt(
        Date.parse(payload.manifest.document.savedAt) || Date.now(),
      );
      return true;
    } catch (error) {
      setWorkspaceStatus('error');
      setWorkspaceStatusDetail(
        error instanceof Error
          ? error.message
          : t('dashboard.status.autosaveSaveFailed'),
      );
      return false;
    } finally {
      workspaceAutosaveSavingRef.current = false;
    }
  }, [authUser?.id, buildCurrentWorkspaceCaptureState, workspaceHistory]);

  useEffect(() => {
    saveWorkspaceAutosaveRef.current = saveWorkspaceAutosave;
  }, [saveWorkspaceAutosave]);

  useEffect(() => {
    return () => {
      if (
        desktopBridge.desktop?.workspace &&
        workspaceAutosaveSettings.enabled &&
        workspaceAutosaveDirtyRef.current &&
        !workspaceAutosaveSavingRef.current &&
        latestWorkspaceCaptureStateRef.current
      ) {
        void saveWorkspaceAutosaveRef.current(
          latestWorkspaceCaptureStateRef.current,
        );
      }
    };
  }, [workspaceAutosaveSettings.enabled]);

  const exportCurrentWorkspace = useCallback(async () => {
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) return;
    try {
      const payload = await buildWorkspaceExportPayload(
        buildCurrentWorkspaceCaptureState(),
      );
      const result = await desktopWorkspace.exportCurrent(payload);
      if (result.cancelled) {
        setTonedStatus(t('dashboard.status.exportCancelled'), 'warning');
        return;
      }
      setTonedStatus('Workspace exported successfully.', 'success');
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.workspaceExportFailed'),
        'error',
      );
    }
  }, [buildCurrentWorkspaceCaptureState]);

  const importWorkspaceFile = useCallback(async () => {
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) return;
    if (images.length > 0) {
      const confirmed = window.confirm(
        t('dashboard.alert.importWorkspaceConfirm'),
      );
      if (!confirmed) return;
    }
    try {
      const result = await desktopWorkspace.importFile();
      if (result.cancelled || !result.payload) {
        setTonedStatus(t('dashboard.status.importCancelled'), 'warning');
        return;
      }
      const restored = await restoreWorkspaceDocument(result.payload);
      const restoredCaptureState = buildCaptureStateFromRestored(restored);
      await applyRestoredWorkspaceState(restored, {
        statusDetail: 'Workspace importado.',
      });
      seedWorkspaceHistory(
        captureWorkspaceHistorySnapshot(
          restoredCaptureState,
        ),
        restoredCaptureState,
      );
      setTonedStatus('Workspace imported successfully.', 'success');
      if (workspaceAutosaveSettings.enabled) {
        await desktopWorkspace.saveAutosave({
          userId: authUser?.id ?? null,
          payload: result.payload,
        });
        setWorkspaceLastSavedAt(
          Date.parse(result.payload.manifest.document.savedAt) || Date.now(),
        );
        setWorkspaceStatus('saved');
        setWorkspaceStatusDetail('Workspace imported and saved locally.');
      } else {
        setWorkspaceLastSavedAt(null);
        setWorkspaceStatus('idle');
        setWorkspaceStatusDetail(
          t('dashboard.status.importNoAutosave'),
        );
      }
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.workspaceImportFailed'),
        'error',
      );
    }
  }, [
    applyRestoredWorkspaceState,
    authUser?.id,
    buildCaptureStateFromRestored,
    images.length,
    seedWorkspaceHistory,
    workspaceAutosaveSettings.enabled,
  ]);

  const closeWorkspace = useCallback(async () => {
    const confirmed = window.confirm(
      t('dashboard.alert.closeWorkspaceConfirm'),
    );
    if (!confirmed) return;
    try {
      const desktopWorkspace = desktopBridge.desktop?.workspace;
      if (desktopWorkspace) {
        await desktopWorkspace.clearAutosave({
          userId: authUser?.id ?? null,
        });
      }
      setImages([]);
      setActiveId('');
      setMode('organize');
      setWorkspaceStatus('idle');
      setWorkspaceStatusDetail('');
      setWorkspaceLastSavedAt(null);
      seedWorkspaceHistory();
    } catch (error) {
      setTonedStatus(
        error instanceof Error
          ? error.message
          : t('dashboard.status.autosaveClearFailed'),
        'error',
      );
    }
  }, [authUser?.id, seedWorkspaceHistory, t]);

  useEffect(() => {
    setWorkspaceHydrated(false);
    const desktopWorkspace = desktopBridge.desktop?.workspace;
    if (!desktopWorkspace) {
      seedWorkspaceHistory();
      setWorkspaceLastSavedAt(null);
      setWorkspaceHydrated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const result = await desktopWorkspace.loadAutosave(
          authUser?.id ?? null,
        );
        if (cancelled) return;
        if (!result.found || !result.payload) {
          seedWorkspaceHistory();
          setWorkspaceLastSavedAt(null);
          setWorkspaceHydrated(true);
          return;
        }
        const restored = await restoreWorkspaceDocument(result.payload);
        if (cancelled) return;
        const restoredCaptureState = buildCaptureStateFromRestored(restored);
        await applyRestoredWorkspaceState(restored, {
          statusDetail: t('dashboard.status.workspaceRestoredFromAutosave'),
        });
        seedWorkspaceHistory(
          captureWorkspaceHistorySnapshot(
            restoredCaptureState,
          ),
          restoredCaptureState,
        );
        setWorkspaceLastSavedAt(
          Date.parse(result.payload.manifest.document.savedAt) || Date.now(),
        );
        setWorkspaceHydrated(true);
      } catch {
        seedWorkspaceHistory();
        setWorkspaceLastSavedAt(null);
        setWorkspaceHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    if (workspaceHistory.isRestoringRef.current) return;
    const captureState =
      latestWorkspaceCaptureStateRef.current ??
      buildCurrentWorkspaceCaptureState();
    const historySignature = buildWorkspaceHistorySignature(captureState);

    if (!workspaceHistoryReadyRef.current) {
      workspaceHistoryReadyRef.current = true;
      workspaceHistorySignatureRef.current = historySignature;
      workspaceAutosaveSignatureRef.current = processing
        ? null
        : buildWorkspaceAutosaveSignature(captureState);
      return;
    }

    if (historySignature !== workspaceHistorySignatureRef.current) {
      workspaceHistorySignatureRef.current = historySignature;
      commitWorkspaceHistory(250);
    }

    if (!desktopBridge.desktop?.workspace) {
      return;
    }

    if (!workspaceAutosaveSettings.enabled) {
      workspaceAutosaveSignatureRef.current = null;
      workspaceAutosaveDirtyRef.current = false;
      return;
    }

    if (processing) {
      workspaceAutosaveDirtyRef.current = true;
      return;
    }

    const autosaveSignature = buildWorkspaceAutosaveSignature(captureState);
    if (autosaveSignature !== workspaceAutosaveSignatureRef.current) {
      workspaceAutosaveSignatureRef.current = autosaveSignature;
      workspaceAutosaveDirtyRef.current = true;
      setWorkspaceStatus('idle');
      setWorkspaceStatusDetail(t('dashboard.status.workspacePendingChanges'));
    }
  }, [
    activeId,
    aioAutoHistoryAvailable,
    aioAutoProcessedImageById,
    aioDetectionsByImage,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    aioHdResizeLimit,
    aioHdStrategy,
    aioImageSnapshotIndexById,
    aioManualImageEditsByImage,
    aioManualProgressByImage,
    aioMaskDilation,
    aioPipelineSnapshotIndex,
    aioPipelineSnapshots,
    aioPresetState,
    aioSelectedRegionByImage,
    aioSrcLang,
    aioStageSelection,
    aioSteps,
    aioTgtLang,
    batchThreads,
    batchThreadsEnabled,
    cleanerDetectionsByImage,
    cleanerManualImageEditsByImage,
    cleanerProcessedBaseByImage,
    cleanerRunMetaByImage,
    cleanerSelectedRegionByImage,
    currentOptimizerWorkspaceState,
    currentSplitterWorkspaceState,
    currentWatermarkWorkspaceState,
    customLlmDrafts,
    customLlmProfiles,
    customLlmProfilesMode,
    downloadItems,
    enhanceModelId,
    enhanceOutputFormat,
    enhanceProfile,
    enhanceScale,
    freeProviderDrafts,
    images,
    lastActionScope,
    llmSettings,
    mode,
    pendingCustomSelections,
    srcLang,
    stitchAlignMode,
    stitchBackground,
    stitchBatchIndexes,
    stitchBatchSize,
    stitchBatchStrategy,
    stitchFileBaseName,
    stitchGap,
    stitchLayoutMode,
    stitchSelectedBatchIndex,
    stitchSingleExportFormat,
    stitchTargetPrimaryAxis,
    subMode,
    tgtLang,
    translatorDetectionsByImage,
    translatorDraftText,
    translatorLastTextModelUsed,
    translatorRunMetaByImage,
    translatorSelectedRegionByImage,
    translatorTextDirty,
    translatorTranslatedText,
    translatorWorkspaceMode,
    typographerQueueSelectedId,
    typographerSelectedSnapshotId,
    typographerSelectionTool,
    typographerSnapshotName,
    typographerWorkspace.sessionsByImage,
    viewMode,
    workspaceHydrated,
    workspaceAutosaveSettings.enabled,
    buildCurrentWorkspaceCaptureState,
    commitWorkspaceHistory,
    workspaceHistory,
  ]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    if (!desktopBridge.desktop?.workspace) return;
    if (!workspaceAutosaveSettings.enabled) return;

    if (workspaceAutosaveIntervalRef.current !== null) {
      window.clearInterval(workspaceAutosaveIntervalRef.current);
    }

    workspaceAutosaveIntervalRef.current = window.setInterval(() => {
      if (!workspaceAutosaveDirtyRef.current) return;
      if (processing) return;
      if (workspaceHistory.isRestoringRef.current) return;
      if (workspaceAutosaveSavingRef.current) return;

      void saveWorkspaceAutosaveRef.current().then((saved) => {
        if (saved) {
          workspaceAutosaveDirtyRef.current = false;
        }
      });
    }, workspaceAutosaveSettings.intervalSeconds * 1000);

    return () => {
      if (workspaceAutosaveIntervalRef.current !== null) {
        window.clearInterval(workspaceAutosaveIntervalRef.current);
        workspaceAutosaveIntervalRef.current = null;
      }
    };
  }, [
    processing,
    workspaceAutosaveSettings.enabled,
    workspaceAutosaveSettings.intervalSeconds,
    workspaceHydrated,
  ]);

  const handleWorkspaceUndo = useCallback(async () => {
    const handled = await workspaceHistory.undo();
    if (!handled) {
      setTonedStatus(t('dashboard.status.nothingToUndo'), 'warning');
      return false;
    }
    setStatusMessage(t('dashboard.status.undo'));
    return true;
  }, [workspaceHistory, t]);

  const handleWorkspaceRedo = useCallback(async () => {
    const handled = await workspaceHistory.redo();
    if (!handled) {
      setTonedStatus(t('dashboard.status.nothingToRedo'), 'warning');
      return false;
    }
    setStatusMessage(t('dashboard.status.redo'));
    return true;
  }, [workspaceHistory, t]);

  const handleWorkspaceManualSave = useCallback(async () => {
    const saved = await saveWorkspaceAutosave();
    if (saved) {
      workspaceAutosaveDirtyRef.current = false;
      setTonedStatus(t('dashboard.status.saved'), 'success');
      return true;
    }
    return false;
  }, [saveWorkspaceAutosave, t]);

  const resolveTooltipText = useCallback(
    (key: string, fallback: string) => {
      const value = t(key as any) as string;
      return value === key ? fallback : value;
    },
    [t],
  );

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
    [modeLabels, underDevelopmentTooltip, t],
  );

  const dispatchKeyboardShortcutAction = useCallback(
    (actionId: ShortcutActionId) => {
      switch (actionId) {
        case 'openShortcutModal':
          openShortcutCenter();
          return true;
        case 'toggleToolsPanel':
          handleToolsToggle();
          return true;
        case 'rotateActiveImage':
          if (!activeId || processing) return false;
          rotateImage(activeId);
          return true;
        case 'workspaceUndo':
          void handleWorkspaceUndo();
          return true;
        case 'workspaceRedo':
          void handleWorkspaceRedo();
          return true;
        case 'workspaceSave':
          void handleWorkspaceManualSave();
          return true;
        case 'zoomIn':
          setZoom((prev) => clamp(prev + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
          return true;
        case 'zoomOut':
          setZoom((prev) => clamp(prev - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
          return true;
        case 'setViewPaginated':
          setViewMode('paginated');
          return true;
        case 'setViewLongStrip':
          setViewMode('long_strip');
          return true;
        case 'setModeOrganize':
          handleModeChange('organize');
          return true;
        case 'setModeAio':
          handleModeChange('aio');
          return true;
        case 'setModeCleaner':
          handleModeChange('cleaner');
          return true;
        case 'setModeTypesetter':
          handleModeChange('typesetter');
          return true;
        case 'setModeTranslator':
          handleModeChange('translator');
          return true;
        case 'setModeRaw':
          handleModeChange('raw');
          return true;
        case 'setModeProofreader':
          handleModeChange('proofreader');
          return true;
        case 'setModeStitch':
          handleModeChange('stitch');
          return true;
        case 'setModeSplit':
          handleModeChange('split');
          return true;
        case 'setModeWatermark':
          handleModeChange('watermark');
          return true;
        case 'setModeEnhance':
          handleModeChange('enhance');
          return true;
        case 'setModeGuides':
          handleModeChange('guides');
          return true;
        case 'setModeResources':
          handleModeChange('resources');
          return true;
        case 'applyText':
          applySelectedTypographerQueueItem();
          return true;
        case 'nextRegion':
          navigateActiveTypographerRegion(1);
          return true;
        case 'previousRegion':
          navigateActiveTypographerRegion(-1);
          return true;
        case 'toggleMultiBubble':
          handleTypographerToggleMultiBubble();
          return true;
        case 'saveSnapshot':
          handleTypographerSaveSnapshot();
          return true;
        case 'detectShapes':
          if (!activeSelectedRegion) return false;
          void refineActiveTypographerShape();
          return true;
        case 'applyActivePreset':
          if (!activeSelectedRegion) return false;
          applyActiveTypographyPresetToSelection();
          return true;
        case 'applyLegacyPresetTextBubble':
          return applyLegacyTypographyPresetToSelection('text_bubble');
        case 'applyLegacyPresetTextFree':
          return applyLegacyTypographyPresetToSelection('text_free');
        case 'applyLegacyPresetTextSfx':
          return applyLegacyTypographyPresetToSelection('text_sfx');
        case 'applyLegacyPresetTextNarration':
          return applyLegacyTypographyPresetToSelection('text_narration');
        case 'applyLegacyPresetTextInsideBlackBubble':
          return applyLegacyTypographyPresetToSelection(
            'text_inside_black_bubble',
          );
        case 'applyAutoShape':
          if (!activeSelectedRegion) return false;
          applyAutoDetectedShapeToActiveRegion();
          return true;
        case 'convertShapeSquare':
          if (!activeSelectedRegion) return false;
          convertActiveTypographerShape('square');
          return true;
        case 'convertShapeRounded':
          if (!activeSelectedRegion) return false;
          convertActiveTypographerShape('rounded');
          return true;
        case 'deleteRegion':
          removeSelectedAioRegion();
          return true;
        case 'editInline':
          if (!activeSelectedRegion) return false;
          setInlineEditorShortcutRequestKey(
            `${activeSelectedRegion.id}::${Date.now()}`,
          );
          return true;
        // ── Tool Palette ───────────────────────────────────────────────────
        case 'duplicateRegion':
          if (!activeSelectedRegion) return false;
          duplicateSelectedTypographerRegion();
          return true;
        case 'toolConfigToggle':
          toggleManualToolsConfig();
          return true;
        case 'toolAreaSelect':
          if (!activeId || processing) return false;
          setSegmentEditTool('select');
          setManualImageTool('none');
          setManualToolsConfigOpen(true);
          return true;
        case 'toolClearRegions':
          if (!activeId || processing) return false;
          clearAioRegionsForActiveImage();
          return true;
        case 'toolSegmentBrush':
          if (!activeId || processing) return false;
          setManualImageTool('none');
          setSegmentEditTool('brush');
          setManualToolsConfigOpen(true);
          return true;
        case 'toolSegmentEraser':
          if (!activeId || processing) return false;
          setManualImageTool('none');
          setSegmentEditTool('eraser');
          setManualToolsConfigOpen(true);
          return true;
        case 'toolPaint':
          if (!activeId || processing) return false;
          toggleManualImageTool('paint');
          return true;
        case 'toolPaintEraser':
          if (!activeId || processing) return false;
          toggleManualImageTool('paint_eraser');
          return true;
        case 'toolMagicWand':
          if (!activeId || processing) return false;
          toggleManualImageTool('magic_wand');
          return true;
        case 'toolHealingBrush':
          if (!activeId || processing) return false;
          toggleManualImageTool('healing_brush');
          return true;
        case 'toolClearPaint':
          if (!activeId || processing) return false;
          if (mode === 'cleaner') clearCleanerManualPaintForImage(activeId);
          else clearAioManualPaintForImage(activeId);
          return true;
        case 'toolResetEdits':
          if (!activeId || processing) return false;
          if (mode === 'cleaner') resetCleanerManualImageEditsForImage(activeId);
          else resetAioManualImageEditsForImage(activeId);
          return true;
        default:
          return false;
      }
    },
    [
      activeId,
      activeSelectedRegion,
      applySelectedTypographerQueueItem,
      applyActiveTypographyPresetToSelection,
      applyLegacyTypographyPresetToSelection,
      applyAutoDetectedShapeToActiveRegion,
      convertActiveTypographerShape,
      clearAioManualPaintForImage,
      clearAioRegionsForActiveImage,
      clearCleanerManualPaintForImage,
      duplicateSelectedTypographerRegion,
      handleModeChange,
      handleToolsToggle,
      handleTypographerSaveSnapshot,
      handleTypographerToggleMultiBubble,
      handleWorkspaceManualSave,
      handleWorkspaceRedo,
      handleWorkspaceUndo,
      mode,
      navigateActiveTypographerRegion,
      openShortcutCenter,
      processing,
      refineActiveTypographerShape,
      removeSelectedAioRegion,
      resetAioManualImageEditsForImage,
      resetCleanerManualImageEditsForImage,
      rotateImage,
      setManualImageTool,
      setManualToolsConfigOpen,
      setSegmentEditTool,
      toggleManualImageTool,
      toggleManualToolsConfig,
    ],
  );

  useEffect(() => {
    if (shortcutCenterOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const pressedShortcut = collectShortcutStateFromKeyboardEvent(event);
      const matchedAction = findMatchingShortcutAction(
        keyboardShortcutConfig,
        pressedShortcut,
        {
          mode,
          subMode,
          translatorWorkspaceMode,
          activeId,
          activeSelectedRegionId: currentManualSelectedRegionId,
          aioRenderReady: aioSteps.render,
          processing,
        },
      );
      if (
        isEditableShortcutTarget(event.target)
        && matchedAction?.id !== 'workspaceSave'
      ) {
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'y') {
          void handleWorkspaceRedo();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (!matchedAction) return;

      const handled = dispatchKeyboardShortcutAction(matchedAction.id);
      if (!handled) return;

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    activeId,
    aioSteps.render,
    currentManualSelectedRegionId,
    dispatchKeyboardShortcutAction,
    keyboardShortcutConfig,
    mode,
    processing,
    shortcutCenterOpen,
    subMode,
    handleWorkspaceRedo,
    translatorWorkspaceMode,
  ]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ actionId?: ShortcutActionId }>;
      const actionId = customEvent.detail?.actionId;
      if (!actionId) {
        return;
      }

      const handled = dispatchKeyboardShortcutAction(actionId);
      if (!handled) {
        return;
      }
    };

    window.addEventListener("koma-desktop-shortcut", handler as EventListener);
    return () => {
      window.removeEventListener("koma-desktop-shortcut", handler as EventListener);
    };
  }, [dispatchKeyboardShortcutAction]);

  // ── Render Helpers ──
  const isProcessableMode =
    !INFO_MODES.includes(mode) &&
    mode !== 'organize' &&
    mode !== 'blogger' &&
    mode !== 'imgur';
  const specialModeStageProps = useMemo(
    () => ({
      mode,
      translatorWorkspaceMode,
      images,
      translatorImageImportRef,
      stitchBatchPlans,
      stitchSelectedBatchIndex,
      setStitchSelectedBatchIndex,
      stitchLayoutMode,
      stitchGap,
      stitchAlignMode,
      stitchBackground,
      stitchSingleExportFormat,
      stitchSafeFileStem,
      processing,
      outQuality,
      ensureVerifiedEmailOrNotify,
        isDesktopRuntime,
      registerDownloads,
      triggerBlobDownload,
      setProcessing,
      setProgress,
      setStatusMessage,
      recordProcessedPages,
      splitterController,
      outFormat,
      optimizerSourceVariants,
      watermarkWorkspaceState: currentWatermarkWorkspaceState,
      optimizerWorkspaceState: currentOptimizerWorkspaceState,
      workspaceRestoreToken,
      onWatermarkWorkspaceStateChange: setWatermarkWorkspaceState,
      onOptimizerWorkspaceStateChange: setOptimizerWorkspaceState,
    }),
    [
      currentOptimizerWorkspaceState,
      currentWatermarkWorkspaceState,
        ensureVerifiedEmailOrNotify,
      images,
      isDesktopRuntime,
      mode,
      optimizerSourceVariants,
      outFormat,
      outQuality,
      processing,
      registerDownloads,
      setOptimizerWorkspaceState,
      setProcessing,
      setProgress,
      setStatusMessage,
      setStitchSelectedBatchIndex,
      setWatermarkWorkspaceState,
      splitterController,
      stitchAlignMode,
      stitchBackground,
      stitchBatchPlans,
      stitchGap,
      stitchLayoutMode,
      stitchSafeFileStem,
      stitchSelectedBatchIndex,
      stitchSingleExportFormat,
      recordProcessedPages,
      translatorImageImportRef,
      translatorWorkspaceMode,
      triggerBlobDownload,
      workspaceRestoreToken,
    ],
  );
  const hasRenderableAioOutput =
    mode === 'aio' && aioSteps.render && images.length > 0;
  const hasRenderableTypographerOutput =
    mode === 'typesetter' && images.length > 0;
  const translatorTextHasDownload = translatorTranslatedText.trim().length > 0;
  const translatorVisualHasDownload = images.some((img) => {
    const regions = translatorDetectionsByImage[img.id] ?? [];
    return regions.some(
      (region) =>
        (region.recognizedText ?? '').trim().length > 0 ||
        (region.translatedText ?? '').trim().length > 0,
    );
  });
  const activeDownloadScope: ProcessableMode | null = isProcessableMode
    ? (mode as ProcessableMode)
    : lastActionScope;
  const canExportAioMetadata = activeDownloadScope === 'aio';
  const activePsdImage = activeImage ?? images[0] ?? null;
  const canExportPsd =
    mode !== 'cleaner' &&
    (mode !== 'translator' || translatorWorkspaceMode === 'visual') &&
    Boolean(activePsdImage);
  const hasAioRenderRegionsForPsd = Boolean(
    activePsdImage &&
    (aioDetectionsByImage[activePsdImage.id] ?? []).length > 0,
  );
  const hasInpaintedOutputs = downloadItems.some(
    (item) => item.scope === 'aio',
  );
  const hasDownloads =
    mode === 'translator'
      ? translatorWorkspaceMode === 'text'
        ? translatorTextHasDownload
        : translatorVisualHasDownload
      : downloadItems.some((item) =>
          isProcessableMode
            ? item.scope === mode
            : lastActionScope
              ? item.scope === lastActionScope
              : false,
        ) ||
        hasRenderableAioOutput ||
        hasRenderableTypographerOutput;
  const hasDownloadActions = hasDownloads || canExportPsd;
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
  }, [activeDockToolHasConfig, manualToolsConfigOpen]);

  const translationNotesEnabled = llmSettings.translation_notes_enabled;
  const renderAioStageItem = useCallback(
    (
      img: (typeof images)[number],
      index: number,
      imageHistoryMeta: ReturnType<typeof getAioImageSnapshotMeta>,
      imageStageKey: AioPipelineSnapshotKey,
      imageStageBadgeLabel: string,
      imageHistoryHint: string | null,
    ) => {
      const imageAllowsAreaSelection =
        subMode === 'manual' &&
        areaSelectionToolActive &&
        (imageStageKey === 'detectText' || imageStageKey === 'render');
      const imageAllowsSegmentBrush =
        subMode === 'manual' && imageStageKey === 'segmentText';
      const isManualEarlyStage =
        subMode === 'manual' &&
        (imageStageKey === 'detectText' ||
          imageStageKey === 'recognizeText' ||
          imageStageKey === 'getTranslations');
      const shouldUseRenderPreview =
        (!isManualEarlyStage && aioSteps.render) ||
        (subMode === 'manual' && imageStageKey === 'render') ||
        (manualImageTool !== 'none' && imageStageKey === 'render');

      if (shouldUseRenderPreview) {
        return (
          <RenderTextPreview
            key={`${img.id}-snapshot-${imageHistoryMeta.index}`}
            label={`#${index + 1} — ${img.file.name}`}
            image={img}
            previewSrc={getPreviewSrc(img)}
            zoom={zoom}
            viewMode={viewMode}
            active={resolvedActiveId === img.id}
            regions={aioDetectionsByImage[img.id] ?? EMPTY_REGIONS}
            selectedRegionId={aioSelectedRegionByImage[img.id] ?? null}
            onCardSelect={() => setActiveId(img.id)}
            onSelectRegion={(regionId) =>
              selectAioRegionForImage(img.id, regionId)
            }
            onRegionsChange={(nextRegions, selectedRegionIdOverride) =>
              updateAioRegionsForImage(
                img.id,
                nextRegions,
                selectedRegionIdOverride,
              )
            }
            editable={subMode === 'manual'}
            areaSelectionEnabled={imageAllowsAreaSelection}
            newRegionShapeKind={resolvedAioAreaSelectionShapeKind}
            fallbackStyle={renderDefaultStyle}
            fontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            stageBadgeKey={imageStageKey}
            stageBadgeLabel={imageStageBadgeLabel}
            canRewind={imageHistoryMeta.canRewind}
            canForward={imageHistoryMeta.canForward}
            onRewind={() => rewindAioPipelineForImage(img.id)}
            onForward={() => forwardAioPipelineForImage(img.id)}
            historyHint={imageHistoryHint}
            renderStageActive={imageStageKey === 'render'}
            onRequestRefineRegion={() => void refineActiveTypographerShape()}
            onRequestAutoShapeRegion={applyAutoDetectedShapeToActiveRegion}
            availableTypographyPresets={typographyPresetList}
            availableTypographyFolders={typographyFolderList}
            onRequestApplyPresetById={(regionId, presetId) =>
              applyTypographyPresetToRegionById(img.id, regionId, presetId)
            }
            onRequestConvertShapeRegion={(regionId, kind) => {
              if (kind === 'auto') {
                applyAutoDetectedShapeToRegionById(img.id, regionId);
                return;
              }
              convertRegionShapeById(img.id, regionId, kind);
            }}
            manualEditEnabled={subMode === 'manual'}
            manualImageTool={manualImageTool}
            manualPaintColor={manualImagePaintColor}
            manualBrushSize={manualImageBrushSize}
            manualBrushOpacity={manualImageBrushOpacity}
            manualBrushBlur={manualImageBrushBlur}
            manualPaintLayerDataUrl={
              getAioManualImageEditState(img.id).paintLayerDataUrl
            }
            manualWandMaskDataUrl={
              getAioManualImageEditState(img.id).wandMaskDataUrl
            }
            manualHealingPending={Boolean(aioManualHealingBusyByImage[img.id])}
            textFillSwatches={textFillSwatches}
            segmentEditEnabled={imageAllowsSegmentBrush}
            segmentEditTool={segmentEditTool}
            segmentBrushSize={segmentBrushSize}
            segmentBrushDataUrl={
              getAioManualImageEditState(img.id).segmentBrushDataUrl
            }
            onSegmentBrushChange={(nextUrl) =>
              patchAioManualImageEditState(img.id, {
                segmentBrushDataUrl: nextUrl,
              })
            }
            inlineEditorRequestKey={inlineEditorShortcutRequestKey}
            onManualPaintLayerChange={(nextLayer) => {
              patchAioManualImageEditState(img.id, {
                paintLayerDataUrl: nextLayer,
              });
            }}
            onManualWandMaskChange={(nextMask) => {
              patchAioManualImageEditState(img.id, {
                wandMaskDataUrl: nextMask,
              });
            }}
            onManualWandRequest={async (x, y) => {
              await runAioMagicWandForImage(img.id, x, y);
            }}
            onManualHealingMaskCommit={async (maskDataUrl) => {
              await applyAioHealingMaskForImage(img.id, maskDataUrl);
            }}
            translationNotesEnabled={translationNotesEnabled}
          />
        );
      }

      return (
        <TextDetectionPreview
          key={`${img.id}-snapshot-${imageHistoryMeta.index}`}
          label={`#${index + 1} — ${img.file.name}`}
          image={img}
          previewSrc={getPreviewSrc(img)}
          zoom={zoom}
          viewMode={viewMode}
          active={resolvedActiveId === img.id}
          regions={aioDetectionsByImage[img.id] ?? EMPTY_REGIONS}
          selectedRegionId={aioSelectedRegionByImage[img.id] ?? null}
          onCardSelect={() => setActiveId(img.id)}
          onSelectRegion={(regionId) =>
            selectAioRegionForImage(img.id, regionId)
          }
          onRegionsChange={(nextRegions, selectedRegionIdOverride) =>
            updateAioRegionsForImage(
              img.id,
              nextRegions,
              selectedRegionIdOverride,
            )
          }
          editable={subMode === 'manual'}
          selectionEnabled={imageAllowsAreaSelection}
          creationEnabled={imageAllowsAreaSelection}
          newRegionShapeKind={resolvedAioAreaSelectionShapeKind}
          segmentEditEnabled={imageAllowsSegmentBrush}
          segmentEditTool={segmentEditTool}
          segmentBrushSize={segmentBrushSize}
          segmentBrushDataUrl={
            getAioManualImageEditState(img.id).segmentBrushDataUrl
          }
          onSegmentBrushChange={(nextUrl) =>
            patchAioManualImageEditState(img.id, {
              segmentBrushDataUrl: nextUrl,
            })
          }
          stageBadgeKey={imageStageKey}
          stageBadgeLabel={imageStageBadgeLabel}
          canRewind={imageHistoryMeta.canRewind}
          canForward={imageHistoryMeta.canForward}
          onRewind={() => rewindAioPipelineForImage(img.id)}
          onForward={() => forwardAioPipelineForImage(img.id)}
          historyHint={imageHistoryHint}
          translationNotesEnabled={translationNotesEnabled}
        />
      );
    },
    [
      aioDetectionsByImage,
      aioManualHealingBusyByImage,
      aioSelectedRegionByImage,
      aioSteps.render,
      applyAioHealingMaskForImage,
      applyAutoDetectedShapeToActiveRegion,
      applyAutoDetectedShapeToRegionById,
      applyTypographyPresetToRegionById,
      areaSelectionToolActive,
      availableRenderFonts,
      convertRegionShapeById,
      getAioManualImageEditState,
      getPreviewSrc,
      inlineEditorShortcutRequestKey,
      isCompactViewport,
      manualImageBrushBlur,
      manualImageBrushOpacity,
      manualImageBrushSize,
      manualImagePaintColor,
      manualImageTool,
      patchAioManualImageEditState,
      refineActiveTypographerShape,
      renderDefaultStyle,
      renderFontRefreshToken,
      resolvedActiveId,
      resolvedAioAreaSelectionShapeKind,
      rewindAioPipelineForImage,
      runAioMagicWandForImage,
      segmentBrushSize,
      segmentEditTool,
      selectAioRegionForImage,
      setActiveId,
      subMode,
      textFillSwatches,
      translationNotesEnabled,
      typographyFolderList,
      typographyPresetList,
      updateAioRegionsForImage,
      viewMode,
      zoom,
      forwardAioPipelineForImage,
    ],
  );
  const stageItemKey = useCallback(
    (index: number) => images[index]?.id ?? `${index}`,
    [images],
  );
  const renderStageItem = useCallback(
    (index: number) => {
      const img = images[index];
      if (!img) return null;

      const imageHistoryMeta = getAioImageSnapshotMeta(img.id);
      const imageStageKey = imageHistoryMeta.key ?? getAioFallbackStageKey();
      const imageStageBadgeLabel = AIO_STAGE_BADGE_LABELS[imageStageKey];
      const imageHistoryHint = imageHistoryMeta.label
        ? t('dashboard.aio.historyHint', {
            label: imageHistoryMeta.label,
            current: imageHistoryMeta.index + 1,
            total: aioPipelineSnapshots.length,
          })
        : null;

      if (mode === 'aio') {
        return renderAioStageItem(
          img,
          index,
          imageHistoryMeta,
          imageStageKey,
          imageStageBadgeLabel,
          imageHistoryHint,
        );
      }

      if (mode === 'typesetter') {
        return (
          <TypesetterStageItem
            img={img}
            index={index}
            getAioDownloadItemForImage={(imageId) => {
              const item = getAioDownloadItemForImage(imageId);
              return item ? { previewUrl: item.previewUrl } : undefined;
            }}
            getPreviewSrc={getPreviewSrc}
            aioDetectionsByImage={aioDetectionsByImage}
            aioSelectedRegionByImage={aioSelectedRegionByImage}
            resolvedActiveId={resolvedActiveId}
            subMode={subMode}
            typographerSelectionTool={typographerSelectionTool}
            renderDefaultStyle={renderDefaultStyle}
            renderFontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            inlineEditorShortcutRequestKey={inlineEditorShortcutRequestKey}
            textFillSwatches={textFillSwatches}
            translationNotesEnabled={translationNotesEnabled}
            typographerMultiSelectedByImage={typographerMultiSelectedByImage}
            typographyPresetList={typographyPresetList}
            viewMode={viewMode}
            zoom={zoom}
            onSelect={(id) => setActiveId(id)}
            onSelectRegion={(imageId, regionId) =>
              selectAioRegionForImage(imageId, regionId)
            }
            onSetTypographerSelectedRegionId={(imageId, regionId) =>
              typographerWorkspace.setSelectedRegionId(imageId, regionId)
            }
            onClearTypographerMultiSelect={(imageId: string) => {
              setTypographerMultiSelectedByImage((prev: Record<string, string[]>) => {
                const { [imageId]: _removed, ...rest } = prev;
                return rest;
              });
            }}
            onRegionsChange={(imageId, nextRegions, selectedRegionIdOverride) =>
              updateAioRegionsForImage(imageId, nextRegions, selectedRegionIdOverride)
            }
            onRefineActiveShape={() => void refineActiveTypographerShape()}
            onAutoShapeActiveRegion={applyAutoDetectedShapeToActiveRegion}
            onApplyPresetToRegion={applyTypographyPresetToRegionById}
            onConvertRegionShape={(imageId, regionId, kind) =>
              convertRegionShapeById(
                imageId,
                regionId,
                kind as unknown as Parameters<typeof convertRegionShapeById>[2],
              )
            }
            onMultiSelectToggle={(imageId: string, regionId: string) => {
              setActiveId(imageId);
              setTypographerMultiSelectedByImage((prev: Record<string, string[]>) => {
                const current = prev[imageId] ?? [];
                const idx = current.indexOf(regionId);
                if (idx >= 0) {
                  const next = current.filter((id: string) => id !== regionId);
                  if (next.length === 0) {
                    const { [imageId]: _removed, ...rest } = prev;
                    return rest;
                  }
                  return { ...prev, [imageId]: next };
                }
                return { ...prev, [imageId]: [...current, regionId] };
              });
            }}
          />
        );
      }

      if (mode === 'cleaner') {
        return (
          <CleanerStageItem
            img={img}
            index={index}
            cleanerRunMetaByImage={cleanerRunMetaByImage}
            cleanerDetectionsByImage={cleanerDetectionsByImage}
            cleanerSelectedRegionByImage={cleanerSelectedRegionByImage}
            cleanerHealingBusyByImage={cleanerHealingBusyByImage}
            cleanerShowOverlays={cleanerShowOverlays}
            getCleanerManualImageEditState={getCleanerManualImageEditState}
            getPreviewSrc={getPreviewSrc}
            resolvedActiveId={resolvedActiveId}
            resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
            renderDefaultStyle={renderDefaultStyle}
            renderFontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            manualImageBrushOpacity={manualImageBrushOpacity}
            manualImageBrushBlur={manualImageBrushBlur}
            manualImageBrushSize={manualImageBrushSize}
            manualImagePaintColor={manualImagePaintColor}
            manualImageTool={manualImageTool}
            segmentEditTool={segmentEditTool}
            segmentBrushSize={segmentBrushSize}
            inlineEditorShortcutRequestKey={inlineEditorShortcutRequestKey}
            textFillSwatches={textFillSwatches}
            viewMode={viewMode}
            zoom={zoom}
            onSelect={(id) => setActiveId(id)}
            onSelectRegion={(imageId, regionId) =>
              selectCleanerRegionForImage(imageId, regionId)
            }
            onRegionsChange={(imageId, nextRegions, selectedRegionIdOverride) =>
              updateCleanerRegionsForImage(
                imageId,
                nextRegions,
                selectedRegionIdOverride,
              )
            }
            onManualPaintLayerChange={(imageId, nextLayer) =>
              patchCleanerManualImageEditState(imageId, {
                paintLayerDataUrl: nextLayer,
              })
            }
            onManualWandMaskChange={(imageId, nextMask) =>
              patchCleanerManualImageEditState(imageId, {
                wandMaskDataUrl: nextMask,
              })
            }
            onManualWandRequest={async (imageId, x, y) => {
              await runCleanerMagicWandForImage(imageId, x, y);
            }}
            onManualHealingMaskCommit={async (imageId, maskDataUrl) => {
              await applyCleanerHealingMaskForImage(imageId, maskDataUrl);
            }}
          />
        );
      }

      if (mode === 'translator' && translatorWorkspaceMode === 'visual') {
        return (
          <TranslatorVisualStageItem
            img={img}
            index={index}
            translatorRunMetaByImage={translatorRunMetaByImage}
            translatorDetectionsByImage={translatorDetectionsByImage}
            translatorSelectedRegionByImage={translatorSelectedRegionByImage}
            resolvedActiveId={resolvedActiveId}
            resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
            segmentBrushSize={segmentBrushSize}
            translationNotesEnabled={translationNotesEnabled}
            viewMode={viewMode}
            zoom={zoom}
            getPreviewSrc={getPreviewSrc}
            onSelect={(id) => setActiveId(id)}
            onSelectRegion={(imageId, regionId) =>
              selectTranslatorRegionForImage(imageId, regionId)
            }
            onRegionsChange={(imageId, nextRegions, selectedRegionIdOverride) =>
              updateTranslatorRegionsForImage(
                imageId,
                nextRegions,
                selectedRegionIdOverride,
              )
            }
          />
        );
      }

      return (
        <PreviewStageItem
          img={img}
          index={index}
          viewMode={viewMode}
          zoom={zoom}
          resolvedActiveId={resolvedActiveId}
          onSelect={(id) => setActiveId(id)}
          getPreviewSrc={getPreviewSrc}
        />
      );
    },
    [
      aioPipelineSnapshots,
      getAioFallbackStageKey,
      getAioImageSnapshotMeta,
      images,
      mode,
      renderAioStageItem,
      t,
      translatorWorkspaceMode,
      translationNotesEnabled,
    ],
  );

  // ══════════════ RENDER ══════════════
  return (
    <div className="koma-dash">
      <div className="koma-dash__bg" aria-hidden="true" />
      <div className="koma-dash__halftone" aria-hidden="true" />

      {/* Mobile overlay backdrop */}
      <DashboardMobileBackdrop
        visible={mobileNavOpen || mobileSidebarOpen || mobileToolsOpen}
        onClose={() => {
          setMobileNavOpen(false);
          setMobileSidebarOpen(false);
          setMobileToolsOpen(false);
        }}
      />

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      <DashboardLeftSidebar
        mobileSidebarOpen={mobileSidebarOpen}
        isCompactViewport={isCompactViewport}
        desktopSidebarCollapsed={desktopSidebarCollapsed}
        leftSidebarWidth={leftSidebarWidth}
        desktopSidebarToggleRef={desktopSidebarToggleRef}
        processingStats={processingStats}
        images={images}
        downloadItems={downloadItems}
        activeId={resolvedActiveId}
        mode={mode}
        processing={processing}
        isExtractingUploads={isExtractingUploads}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        setImages={setImages}
        setActiveId={setActiveId}
        setDownloadItems={setDownloadItems}
        setAioDetectionsByImage={(value) =>
          setAioDetectionsByImage(value as Record<string, AioTextRegion[]>)
        }
        setAioSelectedRegionByImage={(value) => {
          const next: Record<string, string | null> = {};
          for (const [k] of Object.entries(value)) {
            next[k] = null;
          }
          setAioSelectedRegionByImage(next);
        }}
        setCleanerDetectionsByImage={(value) =>
          setCleanerDetectionsByImage(value as unknown as Record<string, AioTextRegion[]>)
        }
        setCleanerSelectedRegionByImage={setCleanerSelectedRegionByImage}
        setCleanerProcessedBaseByImage={setCleanerProcessedBaseByImage}
        setCleanerRunMetaByImage={setCleanerRunMetaByImage}
        setCleanerManualImageEditsByImage={setCleanerManualImageEditsByImage}
        setCleanerHealingBusyByImage={setCleanerHealingBusyByImage}
        setTranslatorDetectionsByImage={(value) =>
          setTranslatorDetectionsByImage(
            value as Record<string, AioTextRegion[]>,
          )
        }
        setTranslatorSelectedRegionByImage={setTranslatorSelectedRegionByImage}
        setTranslatorRunMetaByImage={setTranslatorRunMetaByImage}
        setTranslatorProcessedBaseByImage={setTranslatorProcessedBaseByImage}
        invalidateAioPipelineHistory={invalidateAioPipelineHistory}
        setStatusMessage={setStatusMessage}
        toggleDesktopSidebar={toggleDesktopSidebar}
        startSidebarResize={startSidebarResize}
        resetLeftSidebarWidth={resetLeftSidebarWidth}
        resizeLeftSidebarBy={resizeLeftSidebarBy}
        sidebarResizeStep={SIDEBAR_RESIZE_STEP}
        getRotatedDims={getRotatedDims}
        getAioImageSnapshotMeta={getAioImageSnapshotMeta}
        rewindAioPipelineForImage={rewindAioPipelineForImage}
        forwardAioPipelineForImage={forwardAioPipelineForImage}
        rotateImage={rotateImage}
        moveImage={moveImage}
        removeImage={removeImage}
      />

      {/* ═══════════ CENTER STAGE ═══════════ */}
      <main className="koma-dash__main">
        <KomaTopbar
          mode={mode}
          onModeChange={handleModeChange}
          forcedDropdown={forcedTourDropdown}
          translatorWorkspaceMode={
            mode === 'translator' ? translatorWorkspaceMode : null
          }
          zoom={zoom}
          onZoomChange={setZoom}
          batchThreads={batchThreads}
          onBatchThreadsChange={setBatchThreads}
          batchThreadsEnabled={batchThreadsEnabled}
          onBatchThreadsToggle={setBatchThreadsEnabled}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          processing={processing}
          activeId={activeImage?.id ?? null}
          onRotateImage={rotateImage}
          canUndoWorkspace={workspaceHistory.canUndo}
          canRedoWorkspace={workspaceHistory.canRedo}
          onUndoWorkspace={() => {
            void handleWorkspaceUndo();
          }}
          onRedoWorkspace={() => {
            void handleWorkspaceRedo();
          }}
          onExportWorkspace={() => {
            void exportCurrentWorkspace();
          }}
          onImportWorkspace={() => {
            void importWorkspaceFile();
          }}
          onCloseWorkspace={() => {
            void closeWorkspace();
          }}
          hasDownloadActions={hasDownloadActions}
          hasDownloads={hasDownloads}
          activeDownloadScope={activeDownloadScope}
          outFormat={outFormat}
          onOutFormatChange={setOutFormat}
          outQuality={outQuality}
          onOutQualityChange={setOutQuality}
          downloadBundleFormat={downloadBundleFormat}
          onDownloadBundleFormatChange={setDownloadBundleFormat}
          canExportAioMetadata={canExportAioMetadata}
          downloadIncludeRawText={downloadIncludeRawText}
          onDownloadIncludeRawTextChange={setDownloadIncludeRawText}
          downloadIncludeTranslatedText={downloadIncludeTranslatedText}
          onDownloadIncludeTranslatedTextChange={
            setDownloadIncludeTranslatedText
          }
          downloadIncludeInpaintedImage={downloadIncludeInpaintedImage}
          onDownloadIncludeInpaintedImageChange={
            setDownloadIncludeInpaintedImage
          }
          hasInpaintedOutputs={hasInpaintedOutputs}
          onDownload={(scope) => {
            const normalizedScope =
              scope === 'aio' ||
              scope === 'cleaner' ||
              scope === 'typesetter' ||
              scope === 'translator' ||
              scope === 'proofreader' ||
              scope === 'enhance' ||
              scope === 'split' ||
              scope === 'raw' ||
              scope === 'optimizer'
                ? scope
                : null;
            void handleDownload(normalizedScope);
          }}
          canExportPsd={canExportPsd}
          downloadPsdLoading={downloadPsdLoading}
          downloadPsdCompression={downloadPsdCompression}
          onDownloadPsdCompressionChange={setDownloadPsdCompression}
          downloadPsdDpi={downloadPsdDpi}
          onDownloadPsdDpiChange={setDownloadPsdDpi}
          downloadPsdIncludeOcrOverlay={downloadPsdIncludeOcrOverlay}
          onDownloadPsdIncludeOcrOverlayChange={setDownloadPsdIncludeOcrOverlay}
          downloadPsdIncludeIndividualCrops={downloadPsdIncludeIndividualCrops}
          onDownloadPsdIncludeIndividualCropsChange={
            setDownloadPsdIncludeIndividualCrops
          }
          downloadPsdIncludeRawTextLayer={downloadPsdIncludeRawTextLayer}
          onDownloadPsdIncludeRawTextLayerChange={
            setDownloadPsdIncludeRawTextLayer
          }
          downloadPsdIncludeTranslatedTextLayer={
            downloadPsdIncludeTranslatedTextLayer
          }
          onDownloadPsdIncludeTranslatedTextLayerChange={
            setDownloadPsdIncludeTranslatedTextLayer
          }
          downloadPsdUsePhotoshopTextLayers={downloadPsdUsePhotoshopTextLayers}
          onDownloadPsdUsePhotoshopTextLayersChange={
            setDownloadPsdUsePhotoshopTextLayers
          }
          downloadPsdIncludeMetadataJson={downloadPsdIncludeMetadataJson}
          onDownloadPsdIncludeMetadataJsonChange={
            setDownloadPsdIncludeMetadataJson
          }
          hasAioRenderRegionsForPsd={hasAioRenderRegionsForPsd}
          onDownloadPsd={handleDownloadPsd}
          toolsPanelVisible={toolsPanelVisible}
          onToolsPanelToggle={handleToolsToggle}
          isCompactViewport={isCompactViewport}
          toolsRevealButtonRef={(node) => {
            topbarToolsRevealRef.current = node;
          }}
          sidebarCollapsed={desktopSidebarCollapsed}
          onSidebarToggle={() => toggleDesktopSidebar(false)}
          sidebarRevealButtonRef={(node) => {
            topbarSidebarRevealRef.current = node;
          }}
          userDisplayName={userDisplayName ?? ''}
          userDisplayEmail={userDisplayEmail}
          onLogout={logout}
          onOpenSettings={onOpenSettings}
          onOpenModelRankings={onOpenModelRankings}
          onOpenScanlationFeed={onOpenScanlationFeed}
          onReplayTour={replayTour}
          onOpenShortcuts={openShortcutCenter}
          shortcutModalOpen={shortcutCenterOpen}
        />

        {/* Email verify banner */}
        {emailVerificationRequired && (
          <div className="koma-alert koma-alert--amber">
            <AlertTriangle size={16} />
            <div>
              <div className="koma-alert__title">
                {t('dashboard.alert.emailPendingTitle')}
              </div>
              <div className="koma-alert__text">
                {t('dashboard.alert.emailPendingText')}
              </div>
              <button
                type="button"
                className="koma-btn koma-btn--amber koma-btn--sm"
                disabled={verifyEmailSending}
                onClick={() => void handleSendVerificationEmail()}
              >
                {verifyEmailSending ? (
                  <>
                    <span
                      className="auth-spinner"
                      style={{ width: 12, height: 12 }}
                    />{' '}
                    Enviando...
                  </>
                ) : (
                  'Reenviar email'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Stage */}
        <section
          className="koma-stage custom-scrollbar"
          data-tour="dashboard-stage"
          onWheel={handleStageWheelZoom}
        >
          {/* Info modes show content instead of images */}
          {mode === 'guides' ||
          mode === 'resources' ||
          mode === 'blogger' ||
          mode === 'imgur' ? (
            <DashboardInfoModeStage
              mode={mode}
              onOpenSettings={onOpenSettings ?? (() => {})}
            />
          ) : mode === 'translator' && translatorWorkspaceMode === 'text' ? (
            <TranslatorTextStage
              translatorDraftText={translatorDraftText}
              setTranslatorDraftText={setTranslatorDraftText}
              setTranslatorTranslatedText={setTranslatorTranslatedText}
              setTranslatorTextDirty={setTranslatorTextDirty}
              translatorTextImportRef={translatorTextImportRef}
              translatorTextRunning={translatorTextRunning}
              processing={processing}
              runTranslatorText={async () => {
                await runTranslatorText();
              }}
              translatorTranslatedText={translatorTranslatedText ?? ''}
              translatorTextDirty={translatorTextDirty ?? false}
              copyTextToClipboardSafe={(text) => {
                void copyTextToClipboardSafe(text);
              }}
              setStatusMessage={setStatusMessage}
              handleDownload={(scope) => {
                void handleDownload(scope as ProcessableMode | null);
              }}
              setTranslatorLastTextModelUsed={setTranslatorLastTextModelUsed}
              translatorLastTextModelUsed={translatorLastTextModelUsed}
              handleTranslatorTextImport={handleTranslatorTextImport}
            />
          ) : [
              'translator',
              'stitch',
              'split',
              'watermark',
              'optimizer',
            ].includes(mode) ? (
            <DashboardSpecialModeStage
              props={specialModeStageProps}
            />
          ) : images.length > 0 ? (
            <div
              className={cn(
                'koma-stage__grid',
                viewMode === 'paginated'
                  ? 'koma-stage__grid--pages'
                  : 'koma-stage__grid--strip',
              )}
              data-tour="dashboard-stage-grid"
            >
              <DashboardStageGrid
                viewMode={viewMode}
                itemCount={images.length}
                itemKey={stageItemKey}
                renderStageItem={renderStageItem}
              />
            </div>
          ) : (
            <DashboardEmptyStage
              emptyPreviewTipIndex={emptyPreviewTipIndex}
              currentEmptyPreviewTip={currentEmptyPreviewTip ?? ''}
            />
          )}
        </section>

        <DashboardFooter
          statusMessage={statusMessage}
          statusMessageTone={statusMessageTone}
          processingLabel={aioFooterProcessingLabel}
          workspaceStatus={workspaceStatus}
          workspaceStatusDetail={workspaceStatusDetail}
          workspaceLastSavedAt={workspaceLastSavedAt}
          miniBackendRuntimeState={aioMiniBackendRuntimeState}
          aioDeviceInfo={aioDeviceInfo}
          processing={processing}
          progress={progress}
          openBugReportModal={openBugReportModal}
          openProjectExternalLink={openProjectExternalLink}
          projectDiscordUrl={projectDiscordUrl}
          projectWebsiteUrl={projectWebsiteUrl}
          runtimeExecutionNotice={runtimeExecutionNotice}
        />
      </main>

      {manualDockVisible && (
        <DashboardManualDock
          manualDockRightOffset={manualDockRightOffset}
          manualToolsConfigVisible={manualToolsConfigVisible}
          manualToolsConfigTitle={manualToolsConfigTitle}
          setManualToolsConfigOpen={setManualToolsConfigOpen}
          areaSelectionToolHasConfig={areaSelectionToolHasConfig}
          areaSelectionCreateMode={areaSelectionCreateMode}
          setAreaSelectionCreateMode={setAreaSelectionCreateMode}
          resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
          activeSelectedRegion={activeSelectedRegion}
          duplicateSelectedTypographerRegion={
            duplicateSelectedTypographerRegion
          }
          applyAutoDetectedShapeToActiveRegion={
            applyAutoDetectedShapeToActiveRegion
          }
          convertActiveTypographerShape={convertActiveTypographerShape}
          activeStageAllowsSegmentTools={activeStageAllowsSegmentTools}
          segmentEditTool={segmentEditTool}
          segmentBrushSize={segmentBrushSize}
          setSegmentBrushSize={setSegmentBrushSize}
          activeStageAllowsManualImageTools={activeStageAllowsManualImageTools}
          manualImageTool={manualImageTool}
          manualImageBrushSize={manualImageBrushSize}
          setManualImageBrushSize={setManualImageBrushSize}
          manualImageBrushOpacity={manualImageBrushOpacity}
          setManualImageBrushOpacity={setManualImageBrushOpacity}
          manualImageBrushBlur={manualImageBrushBlur}
          setManualImageBrushBlur={setManualImageBrushBlur}
          manualImagePaintColor={manualImagePaintColor}
          setManualImagePaintColor={setManualImagePaintColor}
          manualImageWandTolerance={manualImageWandTolerance}
          setManualImageWandTolerance={setManualImageWandTolerance}
          activeHasManualWandSelection={activeHasManualWandSelection}
          activeManualHealingBusy={activeManualHealingBusy}
          applyHealingFromActiveWandSelection={
            applyHealingFromActiveWandSelection
          }
          activeId={resolvedActiveId}
          clearManualWandSelection={clearManualWandSelection}
          aioStageSelection={aioStageSelection}
          toggleManualToolsConfig={toggleManualToolsConfig}
          activeDockToolHasConfig={activeDockToolHasConfig}
          isAioManualMode={isAioManualMode}
          areaSelectionToolActive={areaSelectionToolActive}
          activeStageAllowsAreaTools={activeStageAllowsAreaTools}
          setSegmentEditTool={setSegmentEditTool}
          setManualImageTool={setManualImageTool}
          clearAioRegionsForActiveImage={clearAioRegionsForActiveImage}
          activeDockRegionsCount={activeDockRegionsCount}
          toggleManualImageTool={toggleManualImageTool}
          mode={mode}
          clearCleanerManualPaintForImage={clearCleanerManualPaintForImage}
          clearAioManualPaintForImage={clearAioManualPaintForImage}
          resetCleanerManualImageEditsForImage={
            resetCleanerManualImageEditsForImage
          }
          resetAioManualImageEditsForImage={resetAioManualImageEditsForImage}
          activeHasManualPaintLayer={activeHasManualPaintLayer}
          activeHasManualEdits={activeHasManualEdits}
          shortcutConfig={keyboardShortcutConfig}
        />
      )}

      <HealingToolHint trigger={healingHintTrigger} />

      {/* ═══════════ RIGHT TOOLS ═══════════ */}
      <DashboardRightSidebar
        mobileToolsOpen={mobileToolsOpen}
        isCompactViewport={isCompactViewport}
        toolsPanelCollapsed={toolsPanelCollapsed}
        rightSidebarWidth={rightSidebarWidth}
        modeLabel={modeLabel}
        desktopToolsToggleRef={desktopToolsToggleRef}
        setMobileToolsOpen={setMobileToolsOpen}
        setToolsPanelCollapsed={setToolsPanelCollapsed}
        toggleDesktopToolsPanel={toggleDesktopToolsPanel}
        startSidebarResize={startSidebarResize}
        resetRightSidebarWidth={resetRightSidebarWidth}
        resizeRightSidebarBy={resizeRightSidebarBy}
        sidebarResizeStep={SIDEBAR_RESIZE_STEP}
      >
        {/* Sub-mode toggle for applicable modes */}
        {MODES_WITH_SUBMODE.includes(mode) && (
          <SubModeToggle value={subMode} onChange={handleAioSubModeChange} />
        )}
        {mode === 'organize' && <OrganizeToolsHint />}
        {/* ─── AIO — ALL IN ONE ─── */}
        {mode === 'aio' && (
          <div className="koma-aio-tools">
            {/* ═══════════════════ PIPELINE ═══════════════════ */}
            <AioSection
              icon={Zap}
              title={t('dashboard.sections.pipeline')}
              badge={
                <span className="koma-aio-section__badge">
                  {enabledStepCount}/6
                </span>
              }
            >
              {/* SubMode Toggle */}
              <SubModeToggle
                value={subMode}
                onChange={handleAioSubModeChange}
              />

              {subMode === 'auto' ? (
                <>
                  {/* Auto: compact 3×2 chip grid */}
                  <div
                    className="koma-aio-pipeline-grid"
                    data-tour="dashboard-aio-pipeline"
                  >
                    <AioPipelineChip
                      icon={ScanText}
                      label={t('dashboard.stage.detectText.short')}
                      subtitle={t('dashboard.aio.pipeline.detect.subtitle')}
                      enabled={aioSteps.detectText}
                      onToggle={() =>
                        setAioSteps((p) => ({ ...p, detectText: true }))
                      }
                      disabled
                    />
                    <AioPipelineChip
                      icon={Eye}
                      label={t('dashboard.stage.recognizeText.short')}
                      subtitle={t('dashboard.aio.pipeline.ocr.subtitle')}
                      enabled={aioSteps.recognizeText}
                      onToggle={() =>
                        setAioSteps((p) => ({
                          ...p,
                          recognizeText: !p.recognizeText,
                        }))
                      }
                    />
                    <AioPipelineChip
                      icon={Languages}
                      label={t('dashboard.stage.getTranslations.short')}
                      subtitle={t('dashboard.aio.pipeline.translate.subtitle')}
                      enabled={aioSteps.getTranslations}
                      onToggle={() =>
                        setAioSteps((p) => ({
                          ...p,
                          getTranslations: !p.getTranslations,
                        }))
                      }
                    />
                    <AioPipelineChip
                      icon={Replace}
                      label={t('dashboard.stage.segmentText.short')}
                      subtitle={t('dashboard.aio.pipeline.segment.subtitle')}
                      enabled={aioSteps.segmentText}
                      onToggle={() =>
                        setAioSteps((p) => ({
                          ...p,
                          segmentText: !p.segmentText,
                        }))
                      }
                    />
                    <AioPipelineChip
                      icon={Eraser}
                      label={t('dashboard.stage.cleanImage.short')}
                      subtitle={t('dashboard.aio.pipeline.clean.subtitle')}
                      enabled={aioSteps.cleanImage}
                      onToggle={() =>
                        setAioSteps((p) => ({
                          ...p,
                          cleanImage: !p.cleanImage,
                        }))
                      }
                    />
                    <AioPipelineChip
                      icon={Paintbrush}
                      label={t('dashboard.stage.render.short')}
                      subtitle={t('dashboard.aio.pipeline.render.subtitle')}
                      enabled={aioSteps.render}
                      onToggle={() =>
                        setAioSteps((p) => ({ ...p, render: !p.render }))
                      }
                    />
                  </div>

                  {/* Rewind / Forward */}
                  <div className="koma-aio-pipeline-controls">
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost"
                      onClick={rewindAioPipeline}
                      disabled={processing || !canAioRewind}
                      title={t('dashboard.pipeline.prevStep.title')}
                      aria-label="Rewind pipeline"
                    >
                      <SkipBack size={13} /> Rewind
                    </button>
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost"
                      onClick={forwardAioPipeline}
                      disabled={processing || !canAioForward}
                      title={t('dashboard.pipeline.nextStep.title')}
                      aria-label="Forward pipeline"
                    >
                      Forward <SkipForward size={13} />
                    </button>
                  </div>

                  {activeAioPipelineSnapshot && (
                    <p className="koma-aio-hint">
                      Snapshot:{' '}
                      <strong>{activeAioPipelineSnapshot.label}</strong> (
                      {aioPipelineSnapshotIndex + 1}/
                      {aioPipelineSnapshots.length})
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* Manual: timeline */}
                  <div className="koma-aio-timeline">
                    {AIO_MANUAL_STAGE_ORDER.map((stageKey, index) => {
                      const stageStatus =
                        activeManualProgress?.statusByStage[stageKey] ??
                        (index === 0 ? 'pending' : 'locked');
                      const unlocked = activeManualProgress
                        ? index <= activeManualProgress.unlockedMaxIndex
                        : index === 0;
                      const isActiveStage = activeManualProgress
                        ? activeManualProgress.currentIndex === index
                        : index === 0;
                      const StageIcon = AIO_PIPELINE_STAGE_ICONS[stageKey];
                      return (
                        <AioTimelineStep
                          key={stageKey}
                          icon={StageIcon}
                          label={aioPipelineStageLabels[stageKey]}
                          active={isActiveStage}
                          status={stageStatus}
                          locked={!unlocked || !resolvedActiveId}
                          onSelect={() => setManualStageForActiveImage(index)}
                        />
                      );
                    })}
                  </div>

                  {/* Manual controls */}
                  <div className="koma-aio-pipeline-controls">
                    <button
                      type="button"
                      className="koma-btn koma-btn--primary"
                      onClick={() => void executeManualStageForActiveImage()}
                      disabled={
                        processing ||
                        !resolvedActiveId ||
                        !activeManualProgress
                      }
                      title={t('dashboard.pipeline.runStep.title')}
                      aria-busy={processing}
                    >
                      {processing ? (
                        <>
                          <span
                            className="auth-spinner"
                            style={{ width: 13, height: 13 }}
                          />{' '}
                          Executando...
                        </>
                      ) : (
                        <>
                          <Zap size={12} />
                          {activeManualStageStatus === 'done' ||
                          activeManualStageStatus === 'skipped'
                            ? 'Reexecutar'
                            : 'Executar'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost"
                      onClick={skipManualStageForActiveImage}
                      disabled={
                        processing ||
                        !resolvedActiveId ||
                        !activeManualProgress ||
                        activeManualStageStatus === 'done'
                      }
                      title={t('dashboard.pipeline.skipStep.title')}
                    >
                      {t('dashboard.aio.skip')}
                    </button>
                  </div>

                  {resolvedActiveId && activeManualProgress && (
                    <p className="koma-aio-hint">
                      {t('dashboard.aio.imageLabel')}{' '}
                      <strong>
                        {images.find((i) => i.id === resolvedActiveId)?.file.name ??
                          '—'}
                      </strong>
                      {' · '}{t('dashboard.aio.stepLabel')}{' '}
                      <strong>
                        {
                          (() => {
                            const stageKey =
                              AIO_MANUAL_STAGE_ORDER[
                                activeManualProgress.currentIndex
                              ];
                            return stageKey
                              ? aioPipelineStageLabels[stageKey]
                              : '';
                          })()
                        }
                      </strong>
                    </p>
                  )}
                </>
              )}
            </AioSection>

            {/* ═══════════════════ LANGUAGES ═══════════════════ */}
            {(mode as string) === 'cleaner' ? (
              <AioSection icon={Languages} title={t('dashboard.sections.languages')}>
                <div className="koma-field">
                  <label className="koma-field__label">{t('dashboard.cleaner.ocr.language')}</label>
                  <select
                    value={cleanerSrcLang}
                    onChange={(e) => setCleanerSrcLang(e.target.value)}
                    className="koma-select"
                    aria-label={t('dashboard.cleaner.ocr.languageAria')}
                  >
                    {aioLanguageOptions.source.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.label as any)}
                      </option>
                    ))}
                  </select>
                </div>
              </AioSection>
            ) : (
            <AioSection icon={Languages} title={t('dashboard.sections.languages')}>
              {/* Language pair */}
              <div className="koma-aio-lang-row">
                <select
                  value={aioSrcLang}
                  onChange={(e) => setAioSrcLang(e.target.value)}
                  className="koma-select"
                  aria-label={t('dashboard.aio.config.sourceLanguage')}
                >
                  {aioLanguageOptions.source.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label as any)}
                    </option>
                  ))}
                </select>
                <span className="koma-aio-lang-row__arrow" aria-hidden="true">
                  <ArrowRight size={12} />
                </span>
                <select
                  value={aioTgtLang}
                  onChange={(e) => setAioTgtLang(e.target.value)}
                  className="koma-select"
                  aria-label={t('dashboard.aio.config.targetLanguage')}
                >
                  {aioLanguageOptions.target.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label as any)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preset row */}
              <div className="koma-aio-lang-divider" />
              <div className="koma-aio-lang-preset-row">
                <span className="koma-aio-lang-preset-row__label">
                  <Bookmark size={10} />
                  {t('settings.tabs.presets')}
                  <FieldInfoTooltip
                    content={resolveTooltipText(
                      'dashboard.aio.presets.tooltip',
                      'Presets save a per-language combination of models and stage choices. Use them to switch your AIO setup faster when changing source language or workflow.',
                    )}
                    ariaLabel={resolveTooltipText(
                      'dashboard.aio.presets.tooltipAria',
                      'What language presets are used for',
                    )}
                  />
                </span>
                <select
                  className="koma-select koma-aio-lang-preset-row__select"
                  value={
                    aioPresetState.activePresetBySourceLanguage[
                      normalizedAioSourceLanguage
                    ] ?? ''
                  }
                  onChange={(e) => handlePresetSelectionChange(e.target.value)}
                  aria-label={t('dashboard.aio.presets.noneActive')}
                >
                  <option value="">{t('dashboard.aio.presets.noneActive')}</option>
                  {presetsForCurrentLanguage.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                      {activePresetForCurrentLanguage?.id === preset.id
                        ? ' ✓'
                        : ''}
                    </option>
                  ))}
                </select>
                <div className="koma-aio-preset-bar__actions">
                  <button
                    type="button"
                    className="koma-aio-preset-action koma-aio-preset-action--primary"
                    onClick={handleSaveCurrentSelectionAsPreset}
                    title={t('dashboard.aio.presets.saveCurrent')}
                    aria-label={t('dashboard.aio.presets.saveCurrent')}
                  >
                    <Save size={12} />
                  </button>
                  <button
                    type="button"
                    className="koma-aio-preset-action koma-aio-preset-action--primary"
                    onClick={openCreatePresetEditor}
                    title={t('dashboard.aio.presets.new')}
                    aria-label={t('dashboard.aio.presets.new')}
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    className="koma-aio-preset-action"
                    onClick={openEditPresetEditor}
                    disabled={!activePresetForCurrentLanguage}
                    title={t('dashboard.aio.presets.edit')}
                    aria-label={t('dashboard.aio.presets.edit')}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="koma-aio-preset-action koma-aio-preset-action--danger"
                    onClick={handleDeleteActivePreset}
                    disabled={!activePresetForCurrentLanguage}
                    title={t('dashboard.aio.presets.delete')}
                    aria-label={t('dashboard.aio.presets.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    type="button"
                    className="koma-aio-preset-action"
                    onClick={openSettingsOnPresetsTab}
                    title={t('dashboard.aio.presets.openSettings')}
                    aria-label={t('dashboard.aio.presets.openSettings')}
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Inline preset editor */}
              {aioPresetEditorOpen && (
                <div className="koma-aio-preset-editor">
                  <div className="koma-aio-preset-editor__grid">
                    <label className="koma-field">
                      <span className="koma-field__label">{t('dashboard.aio.customAi.name')}</span>
                      <input
                        type="text"
                        className="koma-input"
                        value={aioPresetEditorDraft.name}
                        onChange={(e) =>
                          setAioPresetEditorDraft((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder={t('dashboard.aio.presets.namePlaceholder')}
                      />
                    </label>
                    <label className="koma-field">
                      <span className="koma-field__label">{t('dashboard.aio.presets.description')}</span>
                      <input
                        type="text"
                        className="koma-input"
                        value={aioPresetEditorDraft.description}
                        onChange={(e) =>
                          setAioPresetEditorDraft((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder={t('dashboard.aio.presets.optional')}
                      />
                    </label>
                  </div>
                  <div className="koma-aio-preset-editor__stages">
                    {AIO_PRESET_STAGE_KEYS.map((stageKey) => {
                      const stageOptions = presetEditorStageOptions[stageKey];
                      const selectedModel =
                        aioPresetEditorDraft.stageModels[stageKey];
                      return (
                        <label key={stageKey} className="koma-field">
                          <span className="koma-field__label">
                            {aioStageLabels[stageKey]}
                          </span>
                          <select
                            className="koma-select"
                            value={selectedModel}
                            disabled={stageOptions.length === 0}
                            onChange={(e) =>
                              setAioPresetEditorDraft((prev) => ({
                                ...prev,
                                stageModels: {
                                  ...prev.stageModels,
                                  [stageKey]: e.target.value,
                                },
                              }))
                            }
                          >
                            {stageOptions.length === 0 && (
                              <option value="">{t('aio.model.noneAvailable')}</option>
                            )}
                            {stageOptions.map((opt) => (
                              <option key={opt.key} value={opt.key}>
                                {formatAioStageOptionLabel(opt)}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <label className="koma-checklist__item">
                    <input
                      type="checkbox"
                      checked={aioPresetEditorDraft.setAsActive}
                      onChange={(e) =>
                        setAioPresetEditorDraft((prev) => ({
                          ...prev,
                          setAsActive: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      {t('dashboard.aio.presets.setActiveFor')}{' '}
                      {normalizedAioSourceLanguage.toUpperCase()}
                    </span>
                  </label>
                  <div className="koma-aio-preset-editor__footer">
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost koma-btn--sm"
                      onClick={closePresetEditor}
                    >
                      {t('dashboard.aio.presets.cancel')}
                    </button>
                    <button
                      type="button"
                      className="koma-btn koma-btn--primary koma-btn--sm"
                      onClick={handleSavePresetEditor}
                    >
                      {aioPresetEditorDraft.presetId
                        ? t('dashboard.aio.presets.update')
                        : t('dashboard.aio.presets.create')}
                    </button>
                  </div>
                </div>
              )}

              <p className="koma-aio-hint">{t('dashboard.aio.config.langHint')}</p>
            </AioSection>
            )}

            {/* ═══════════════════ MODELS & CONFIG ═══════════════════ */}
            <AioSection
              icon={Settings}
              title={t('dashboard.sections.modelsConfig')}
              data-tour="dashboard-aio-stage-config"
            >
              {aioOptionsLoading && (
                <p className="koma-aio-hint">
                  {t('dashboard.aio.config.loadingCatalogs')}
                </p>
              )}

              {/* Tab bar */}
              <AioStageTabBar
                tabs={STAGE_TABS}
                activeTab={activeStageTab}
                enabledSteps={{
                  detectText: aioSteps.detectText,
                  recognizeText: aioSteps.recognizeText,
                  getTranslations: aioSteps.getTranslations,
                  segmentText: aioSteps.segmentText,
                  cleanImage: aioSteps.cleanImage,
                  render: aioSteps.render,
                }}
                onSelect={setActiveStageTab}
              />

              {/* Tab content */}
              <div className="koma-aio-stage-content" key={activeStageTab}>
                {/* ── Detect ──────────────────────────────────────────── */}
                {activeStageTab === 'detectText' && (
                  <DetectTextModelControl
                    value={aioStageSelection.detectText}
                    options={availableDetectStageOptions}
                    selectedModel={selectedDetectModel}
                    statusText={selectedDetectStatusText}
                    formatOptionLabel={formatAioStageOptionLabel}
                    onSelectModel={(modelKey) =>
                      selectAioLocalStageModel('detectText', modelKey)
                    }
                    onOpenManager={() =>
                      openModelManagerForStage('detectText', {
                        focusedModelId: aioStageSelection.detectText,
                      })
                    }
                  />
                )}

                {/* ── OCR ─────────────────────────────────────────────── */}
                {activeStageTab === 'recognizeText' && (
                  <RecognizeTextModelControl
                    value={aioStageSelection.recognizeText}
                    options={availableOcrStageOptions}
                    selectedModel={selectedOcrModel}
                    statusText={selectedOcrStatusText}
                    formatOptionLabel={formatAioStageOptionLabel}
                    onSelectModel={selectAioRecognizeTextModel}
                    onOpenManager={() =>
                      openModelManagerForStage('recognizeText', {
                        focusedModelId: resolveLocalModelFocusForStage(
                          'recognizeText',
                          aioStageSelection.recognizeText,
                        ),
                      })
                    }
                  />
                )}

                {/* ── Translation ─────────────────────────────────────── */}
                {activeStageTab === 'getTranslations' && (
                  <>
                    <TranslationModelControl
                      selectedModelId={aioStageSelection.getTranslations}
                      sourceLanguage={aioSrcLang}
                      targetLanguage={aioTgtLang}
                      entries={modelManagerState.entries}
                      legacyOptions={availableTranslationStageOptions}
                      installedCount={modelSummary.installedCount}
                      updatesCount={modelSummary.updateCount}
                      onSelectModel={(modelId) =>
                        setAioStageSelection((prev) => ({
                          ...prev,
                          getTranslations: modelId,
                        }))
                      }
                      onOpenManager={(args) => {
                        openModelManagerForStage('getTranslations', {
                          language: args?.language ?? aioSrcLang,
                          focusedModelId: args?.focusedModelId ?? null,
                        });
                      }}
                      selectedSummary={
                        selectedTranslationModelState
                          ? `${selectedTranslationModelState.model.name}`
                          : selectedCustomTranslationProfile
                            ? `${selectedCustomTranslationProfile.label} (Custom)`
                            : selectedLegacyTranslationOption
                              ? `${selectedLegacyTranslationOption.name} ${t('dashboard.status.cloudSuffix')}`
                              : t('dashboard.status.noModelSelected')
                      }
                      supportSummary={t('dashboard.status.localModelDownloadHint')}
                    />

                    {showLlmSettingsPanel && (
                      <div className="koma-aio-translation-extras">
                        <span className="koma-field__label">
                          {t('dashboard.aio.customAi.title')}
                        </span>
                        <div className="koma-aio-llm-panel">
                          <textarea
                            value={llmSettings.extra_context}
                            onChange={(e) =>
                              setLlmSettings((prev) =>
                                clampLlmRequestSettings({
                                  ...prev,
                                  extra_context: e.target.value,
                                }),
                              )
                            }
                            className="koma-input"
                            rows={3}
                            placeholder={t("dashboard.dashboardLlm.extraContextPlaceholder")}
                          />

                          <div className="koma-aio-llm-toggles">
                            <label className="koma-checklist__item">
                              <input
                                type="checkbox"
                                checked={llmSettings.translation_notes_enabled}
                                onChange={(e) =>
                                  setLlmSettings((prev) =>
                                    clampLlmRequestSettings({
                                      ...prev,
                                      translation_notes_enabled: e.target.checked,
                                    }),
                                  )
                                }
                              />
                              <span>{t("dashboard.aio.translation.notesToggle")}</span>
                            </label>
                            <label className="koma-checklist__item">
                              <input
                                type="checkbox"
                                checked={llmSettings.neighbor_image_context_enabled}
                                onChange={(e) =>
                                  setLlmSettings((prev) =>
                                    clampLlmRequestSettings({
                                      ...prev,
                                      neighbor_image_context_enabled: e.target.checked,
                                    }),
                                  )
                                }
                              />
                              <span>{t("dashboard.aio.translation.neighborContextToggle")}</span>
                            </label>
                            <label className="koma-checklist__item">
                              <input
                                type="checkbox"
                                checked={llmSettings.image_input_enabled}
                                onChange={(e) =>
                                  setLlmSettings((prev) =>
                                    clampLlmRequestSettings({
                                      ...prev,
                                      image_input_enabled: e.target.checked,
                                    }),
                                  )
                                }
                              />
                              <span>{t("dashboard.aio.translation.multimodalToggle")}</span>
                            </label>
                          </div>

                          <div className="koma-aio-llm-sliders">
                            <KlSlider
                              label={t("dashboard.dashboardLlm.temperature")}
                              value={llmSettings.temperature}
                              min={0}
                              max={2}
                              step={0.05}
                              onChange={(v) =>
                                setLlmSettings((prev) =>
                                  clampLlmRequestSettings({
                                    ...prev,
                                    temperature: v,
                                  }),
                                )
                              }
                              resetVal={0.2}
                            />
                            <KlSlider
                              label={t("dashboard.dashboardLlm.topP")}
                              value={llmSettings.top_p}
                              min={0}
                              max={1}
                              step={0.01}
                              onChange={(v) =>
                                setLlmSettings((prev) =>
                                  clampLlmRequestSettings({
                                    ...prev,
                                    top_p: v,
                                  }),
                                )
                              }
                              resetVal={0.95}
                            />
                            <KlSlider
                              label={t("dashboard.dashboardLlm.maxTokens")}
                              value={llmSettings.max_tokens}
                              min={128}
                              max={8192}
                              step={64}
                              onChange={(v) =>
                                setLlmSettings((prev) =>
                                  clampLlmRequestSettings({
                                    ...prev,
                                    max_tokens: v,
                                  }),
                                )
                              }
                              resetVal={4096}
                            />
                          </div>

                          <p className="koma-aio-hint">
                            {t("dashboard.aio.translation.activeConfigFor", {
                              value: llmSettingsSupportSummary,
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── Segment ─────────────────────────────────────────── */}
                {activeStageTab === 'segmentText' && (
                  <SegmentTextModelControl
                    value={aioStageSelection.segmentText}
                    options={availableSegmentStageOptions}
                    selectedModel={selectedSegmentModel}
                    statusText={selectedSegmentStatusText}
                    formatOptionLabel={formatAioStageOptionLabel}
                    onSelectModel={(modelKey) =>
                      selectAioLocalStageModel('segmentText', modelKey)
                    }
                    onOpenManager={() =>
                      openModelManagerForStage('segmentText', {
                        focusedModelId: aioStageSelection.segmentText,
                      })
                    }
                  />
                )}

                {/* ── Clean ───────────────────────────────────────────── */}
                {activeStageTab === 'cleanImage' && (
                  <CleanImageModelControl
                    value={aioStageSelection.cleanImage}
                    options={availableCleanStageOptions}
                    selectedModel={selectedCleanModel}
                    statusText={selectedCleanStatusText}
                    formatOptionLabel={formatAioStageOptionLabel}
                    onSelectModel={(modelKey) =>
                      selectAioLocalStageModel('cleanImage', modelKey)
                    }
                    onOpenManager={() =>
                      openModelManagerForStage('cleanImage', {
                        focusedModelId: aioStageSelection.cleanImage,
                      })
                    }
                  >
                    <KlSlider
                      label={(
                        <span className="koma-inline-label-with-info">
                          {t("dashboard.aio.clean.maskDilation")}
                          <FieldInfoTooltip
                            content={resolveTooltipText(
                              'dashboard.aio.clean.maskDilation.tooltip',
                              'Expands the cleanup mask before inpainting. Raise it when text edges remain; keep it lower to preserve nearby artwork.',
                            )}
                            ariaLabel={resolveTooltipText(
                              'dashboard.aio.clean.maskDilation.tooltipAria',
                              'What Mask Dilation is used for',
                            )}
                          />
                        </span>
                      )}
                      value={aioMaskDilation}
                      min={0}
                      max={50}
                      step={1}
                      onChange={setAioMaskDilation}
                      resetVal={5}
                    />

                    <label className="koma-field__label">
                      <span className="koma-inline-label-with-info">
                        {t("dashboard.dashboardLlm.hdStrategy")}
                        <FieldInfoTooltip
                          content={resolveTooltipText(
                            'dashboard.dashboardLlm.hdStrategy.tooltip',
                            'Defines how large images are prepared before cleanup. Resize scales the page, Crop splits it into tiles, and Original sends it as-is.',
                          )}
                          ariaLabel={resolveTooltipText(
                            'dashboard.dashboardLlm.hdStrategy.tooltipAria',
                            'What HD Strategy is used for',
                          )}
                        />
                      </span>
                    </label>
                    <select
                      value={aioHdStrategy}
                      onChange={(e) =>
                        setAioHdStrategy(
                          e.target.value as 'original' | 'resize' | 'crop',
                        )
                      }
                      className="koma-select"
                    >
                      <option value="resize">{t("dashboard.dashboardLlm.resize")}</option>
                      <option value="crop">{t("dashboard.dashboardLlm.crop")}</option>
                      <option value="original">{t("dashboard.dashboardLlm.original")}</option>
                    </select>
                    <p className="koma-aio-hint">
                      {t("dashboard.dashboardLlm.hdStrategyHint")}
                    </p>

                    {aioHdStrategy === 'resize' && (
                      <KlSlider
                        label={t("dashboard.dashboardLlm.resizeLimit")}
                        value={aioHdResizeLimit}
                        min={256}
                        max={3000}
                        step={1}
                        onChange={setAioHdResizeLimit}
                        resetVal={960}
                      />
                    )}
                    {aioHdStrategy === 'crop' && (
                      <>
                        <KlSlider
                          label={(
                            <span className="koma-inline-label-with-info">
                              {t("dashboard.dashboardLlm.cropMargin")}
                              <FieldInfoTooltip
                                content={resolveTooltipText(
                                  'dashboard.dashboardLlm.cropMargin.tooltip',
                                  'Adds extra padding around each crop tile. Increase it if borders lose context or show seams after cleanup.',
                                )}
                                ariaLabel={resolveTooltipText(
                                  'dashboard.dashboardLlm.cropMargin.tooltipAria',
                                  'What Crop Margin is used for',
                                )}
                              />
                            </span>
                          )}
                          value={aioHdCropMargin}
                          min={0}
                          max={3000}
                          step={1}
                          onChange={setAioHdCropMargin}
                          resetVal={512}
                        />
                        <KlSlider
                          label={(
                            <span className="koma-inline-label-with-info">
                              {t("dashboard.dashboardLlm.cropTriggerSize")}
                              <FieldInfoTooltip
                                content={resolveTooltipText(
                                  'dashboard.dashboardLlm.cropTriggerSize.tooltip',
                                  'Minimum image size that activates crop tiling. Smaller images stay as one piece; larger ones are split into crops.',
                                )}
                                ariaLabel={resolveTooltipText(
                                  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria',
                                  'What Crop Trigger Size is used for',
                                )}
                              />
                            </span>
                          )}
                          value={aioHdCropTriggerSize}
                          min={64}
                          max={3000}
                          step={1}
                          onChange={setAioHdCropTriggerSize}
                          resetVal={512}
                        />
                      </>
                    )}
                  </CleanImageModelControl>
                )}

                {/* ── Render ──────────────────────────────────────────── */}
                {activeStageTab === 'render' && aioSteps.render && (
                  <div className="koma-aio-text-mode">
                    {/* Text Mode */}
                    <div className="koma-field">
                      <label className="koma-field__label">
                        {t('dashboard.status.selectionMode')}
                      </label>
                      <select
                        className="koma-select"
                        disabled={!canEditActiveRenderStage}
                        value={activeSelectedRenderMode}
                        onChange={(e) =>
                          updateActiveRenderMode(
                            e.target.value as RenderTextMode,
                          )
                        }
                        aria-label={t('dashboard.status.selectionTextModeAria')}
                      >
                        {(
                          Object.entries(RENDER_TEXT_MODE_LABELS) as Array<
                            [RenderTextMode, string]
                          >
                        ).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <p className="koma-aio-hint">
                        {activeSelectedRegion
                          ? activeSelectedRenderMode === 'auto'
                            ? `AUTO → ${RENDER_TEXT_MODE_LABELS[activeSelectedResolvedRenderMode]}`
                            : `${t('dashboard.status.modeLabel')}: ${RENDER_TEXT_MODE_LABELS[activeSelectedResolvedRenderMode]}`
                          : t('dashboard.status.selectBoxInPreview')}
                      </p>
                    </div>

                    {/* Fonts */}
                    <hr className="koma-aio-divider" />
                    <div className="koma-aio-font-row">
                      <button
                        type="button"
                        className="koma-btn koma-btn--ghost"
                        onClick={() => void loadRenderFontCatalog()}
                        disabled={renderFontsLoading}
                      >
                        {renderFontsLoading
                          ? t('dashboard.typo.fontsUpdating')
                          : t('dashboard.typo.updateFonts')}
                      </button>
                      <button
                        type="button"
                        className="koma-btn koma-btn--ghost"
                        onClick={() => renderFontInputRef.current?.click()}
                        disabled={!isDesktopRuntime || renderFontsImporting}
                        title={
                          isDesktopRuntime
                            ? t('dashboard.typo.importFontTitle')
                            : t('dashboard.typo.desktopOnly')
                        }
                      >
                        {renderFontsImporting
                          ? t('dashboard.typo.fontImporting')
                          : t('dashboard.typo.importFont')}
                      </button>
                      <input
                        ref={renderFontInputRef}
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          void handleRenderFontImport(e);
                        }}
                      />
                    </div>
                    {renderFontsError && (
                      <p className="koma-aio-hint" style={{ color: '#fda4af' }}>
                        {renderFontsError}
                      </p>
                    )}

                    {/* Apply style */}
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost koma-btn--full"
                      disabled={!canEditActiveRenderStage}
                      onClick={applyActiveRenderStyleToAllRegions}
                      title={t('dashboard.typesetter.applyStyleAll.title')}
                    >
                      {t('dashboard.typo.applyStyleToAll')}
                    </button>

                    <p className="koma-aio-hint">
                      {t('dashboard.typo.fontControlsHint')}{' '}
                      {t('dashboard.aio.render.hintRot')}
                      <strong>Shift + Scroll</strong>{' '}
                      {t('dashboard.aio.render.hintRotSuffix')}
                    </p>

                    {!activeImageRenderStageActive && (
                      <div
                        className="koma-aio-info koma-aio-info--warning"
                        role="status"
                      >
                        <Info size={12} className="koma-aio-info__icon" />
                        <span>
                          {t('dashboard.aio.render.warning')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activeStageTab === 'render' && !aioSteps.render && (
                  <p className="koma-aio-hint">
                    {t('dashboard.aio.render.disabled')}
                  </p>
                )}
              </div>

              {/* GPU per-stage toggles */}
              <AioSection
                icon={Zap}
                title={t('dashboard.aio.gpuStages.title')}
                defaultOpen={false}
              >
                <p className="koma-aio-hint">
                  {t('dashboard.aio.gpuStages.hint')}
                </p>
                {!aioHasGpuExecutionProfile && (
                  <p className="koma-aio-hint">
                    {t('dashboard.aio.gpuStages.noActiveProfile')}
                  </p>
                )}
                <div className="koma-aio-llm-toggles">
                  <label className="koma-checklist__item">
                    <input
                      type="checkbox"
                      checked={aioGpuStages.detectText}
                      disabled={!aioHasGpuExecutionProfile}
                      onChange={(e) => updateAioGpuStage('detectText', e.target.checked)}
                    />
                    <span>{t('dashboard.aio.gpuStages.detect')}</span>
                  </label>
                  <label className="koma-checklist__item">
                    <input
                      type="checkbox"
                      checked={aioGpuStages.recognizeText}
                      disabled={!aioHasGpuExecutionProfile}
                      onChange={(e) => updateAioGpuStage('recognizeText', e.target.checked)}
                    />
                    <span>{t('dashboard.aio.gpuStages.ocr')}</span>
                  </label>
                  <label className="koma-checklist__item">
                    <input
                      type="checkbox"
                      checked={aioGpuStages.segmentText}
                      disabled={!aioHasGpuExecutionProfile}
                      onChange={(e) => updateAioGpuStage('segmentText', e.target.checked)}
                    />
                    <span>{t('dashboard.aio.gpuStages.segment')}</span>
                  </label>
                  <label className="koma-checklist__item">
                    <input
                      type="checkbox"
                      checked={aioGpuStages.cleanImage}
                      disabled={!aioHasGpuExecutionProfile}
                      onChange={(e) => updateAioGpuStage('cleanImage', e.target.checked)}
                    />
                    <span>{t('dashboard.aio.gpuStages.clean')}</span>
                  </label>
                </div>
              </AioSection>
            </AioSection>

            {/* ═══════════════════ REGION ═══════════════════ */}
            <AioSection
              icon={Box}
              title={t("dashboard.dashboardRegion.title")}
              defaultOpen={aioSteps.render || !!activeSelectedRegion}
            >
              <div className="koma-aio-region">
                <div className="koma-aio-region__grid">
                  <span className="koma-aio-region__key">{t("dashboard.dashboardRegion.blocks")}</span>
                  <span className="koma-aio-region__val">
                    {activeImageDetections.length}
                  </span>

                  <span className="koma-aio-region__key">{t("dashboard.dashboardRegion.selection")}</span>
                  <span
                    className={cn(
                      'koma-aio-region__val',
                      !activeSelectedRegion && 'koma-aio-region__val--muted',
                    )}
                  >
                    {activeSelectedRegion ? activeSelectedRegion.id : t("aio.region.noSelection")}
                  </span>

                  {!aioSteps.render && activeSelectedRegion && (
                    <>
                      <span className="koma-aio-region__key">{t("dashboard.dashboardRegion.ocr")}</span>
                      <span
                        className={cn(
                          'koma-aio-region__val',
                          !activeSelectedRegion.recognizedText &&
                            'koma-aio-region__val--muted',
                        )}
                      >
                        {activeSelectedRegion.recognizedText
                          ? `"${activeSelectedRegion.recognizedText.slice(0, 80)}"`
                          : aioSteps.recognizeText
                            ? '—'
                            : t("dashboard.dashboardRegion.disabled")}
                      </span>

                      <span className="koma-aio-region__key">{t("dashboard.dashboardRegion.translation")}</span>
                      <span
                        className={cn(
                          'koma-aio-region__val',
                          !activeSelectedRegion.translatedText &&
                            'koma-aio-region__val--muted',
                        )}
                      >
                        {activeSelectedRegion.translatedText
                          ? `"${activeSelectedRegion.translatedText.slice(0, 80)}"`
                          : aioSteps.getTranslations
                            ? '—'
                            : t("dashboard.dashboardRegion.disabled")}
                      </span>

                      {activeSelectedTranslationNotes.length > 0 && (
                        <>
                          <span className="koma-aio-region__key">{t("dashboard.dashboardRegion.notes")}</span>
                          <span className="koma-aio-region__val">
                            {activeSelectedTranslationNotes.join(' | ')}
                          </span>
                        </>
                      )}

                      <span className="koma-aio-region__key">{t("dashboard.dashboardRegion.segments")}</span>
                      <span className="koma-aio-region__val">
                        {activeSelectedRegion
                          ? `${activeSelectedRegion.mergedSegmentBoxes?.length ?? activeSelectedRegion.segmentBoxes?.length ?? 0} caixa(s)`
                          : '—'}
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="koma-aio-region__actions">
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost"
                    disabled={!activeSelectedRegion}
                    onClick={removeSelectedAioRegion}
                  >
                    {t("aio.region.removeSelected")}
                  </button>
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost"
                    disabled={!activeSelectedRegion}
                    onClick={duplicateSelectedTypographerRegion}
                  >
                    {t("aio.region.duplicateSelected")}
                  </button>
                </div>

                {subMode === 'manual' && !aioSteps.render && (
                  <p className="koma-aio-hint">
                    {subMode === 'manual'
                      ? t("dashboard.dashboardRegion.manualHint")
                      : t("dashboard.dashboardRegion.manualModeHint")}
                  </p>
                )}
              </div>
            </AioSection>

            {/* ═══════════════════ MANUAL HINT ═══════════════════ */}
            {subMode === 'manual' && (
              <div className="koma-aio-info" role="status" aria-hidden="true">
                <Paintbrush size={13} className="koma-aio-info__icon" />
                <span>
                  {t("dashboard.dashboardRegion.dockHint")}
                </span>
              </div>
            )}

            {/* ═══════════════════ EXECUTE BAR ═══════════════════ */}
            <div className="koma-aio-execute">
              <button
                type="button"
                className={cn(
                  'koma-aio-execute__btn',
                  processing && 'koma-aio-execute__btn--processing',
                )}
                disabled={
                  subMode === 'manual'
                    ? processing ||
                      !resolvedActiveId ||
                      !activeManualProgress
                    : processing || images.length === 0
                }
                title={
                  subMode === 'manual'
                    ? !resolvedActiveId
                      ? t("dashboard.dashboardExecute.selectImage")
                      : t("dashboard.dashboardExecute.runCurrentStage")
                    : undefined
                }
                onClick={
                  subMode === 'manual'
                    ? () => void handleExecuteManualAioStage()
                    : processAIO
                }
                aria-busy={processing}
              >
                {processing ? (
                  <>
                    <span
                      className="auth-spinner"
                      style={{ width: 14, height: 14 }}
                      aria-hidden="true"
                    />
                    {aioExecuteButtonProcessingLabel}
                  </>
                ) : (
                  <>
                    {!processing && (
                      <span
                        className="koma-aio-execute__pulse"
                        aria-hidden="true"
                      />
                    )}
                    <Zap size={14} />
                    {subMode === 'manual'
                      ? activeManualStageStatus === 'done' ||
                        activeManualStageStatus === 'skipped'
                        ? t("dashboard.dashboardExecute.rerunStage")
                        : t("dashboard.dashboardExecute.runStage")
                  : t("dashboard.dashboardExecute.runAio")}
                  </>
                )}
              </button>
              {processing && (
                <button
                  type="button"
                  className="koma-aio-execute__btn koma-aio-execute__btn--stop"
                  onClick={stopAioExecution}
                >
                  <X size={14} />
                  {t("dashboard.dashboardExecute.stop")}
                </button>
              )}
            </div>
          </div>
        )}
        {mode === 'cleaner' && (
          <CleanerToolsPanel
            cleanerMode={cleanerMode}
            setCleanerMode={setCleanerMode}
            cleanerSrcLang={cleanerSrcLang}
            setCleanerSrcLang={setCleanerSrcLang}
            sourceLanguageOptions={aioLanguageOptions.source}
            recognizeTextValue={aioStageSelection.recognizeText}
            segmentTextValue={aioStageSelection.segmentText}
            cleanImageValue={aioStageSelection.cleanImage}
            cleanerAiModelKey={cleanerAiModelKey}
            cleanerAiModelOptions={cleanerAiOptionsForSelect}
            availableOcrStageOptions={cleanerAvailableOcrStageOptions}
            availableSegmentStageOptions={cleanerAvailableSegmentStageOptions}
            availableCleanStageOptions={cleanerAvailableCleanStageOptions}
            selectedOcrCloudOption={selectedOcrCloudOption}
            selectedSegmentModel={selectedSegmentModel}
            selectedCleanModel={selectedCleanModel}
            selectedCleanerAiOption={selectedCleanerAiDisplayOption}
            selectedOcrStatusText={selectedOcrStatusText}
            selectedSegmentStatusText={selectedSegmentStatusText}
            selectedCleanStatusText={selectedCleanStatusText}
            formatAioStageOptionLabel={formatAioStageOptionLabel}
            setRecognizeTextModel={(modelKey) =>
              setAioStageSelection((prev) => ({
                ...prev,
                recognizeText: modelKey,
              }))
            }
            selectSegmentTextModel={(modelKey) =>
              selectAioLocalStageModel('segmentText', modelKey)
            }
            selectCleanImageModel={(modelKey) =>
              selectAioLocalStageModel('cleanImage', modelKey)
            }
            selectCleanerAiModel={selectCleanerAiModel}
            openRecognizeTextManager={() => {
              openModelManagerForStage('recognizeText', {
                focusedModelId: resolveLocalModelFocusForStage(
                  'recognizeText',
                  aioStageSelection.recognizeText,
                ),
              });
            }}
            openSegmentTextManager={() => {
              openModelManagerForStage('segmentText', {
                focusedModelId: aioStageSelection.segmentText,
              });
            }}
            openCleanImageManager={() => {
              openModelManagerForStage('cleanImage', {
                focusedModelId: aioStageSelection.cleanImage,
              });
            }}
            openCleanerAiModelManager={() =>
              setCleanerAiModelManagerOpen(true)
            }
            localApiUrl={apiConfig.localUrl}
            aioMaskDilation={aioMaskDilation}
            setAioMaskDilation={setAioMaskDilation}
            aioHdStrategy={aioHdStrategy}
            setAioHdStrategy={setAioHdStrategy}
            aioHdResizeLimit={aioHdResizeLimit}
            setAioHdResizeLimit={setAioHdResizeLimit}
            aioHdCropMargin={aioHdCropMargin}
            setAioHdCropMargin={setAioHdCropMargin}
            aioHdCropTriggerSize={aioHdCropTriggerSize}
            setAioHdCropTriggerSize={setAioHdCropTriggerSize}
            cleanerAiAdditionalInstructions={cleanerAiAdditionalInstructions}
            setCleanerAiAdditionalInstructions={
              setCleanerAiAdditionalInstructions
            }
            activeCleanerRunMeta={activeCleanerRunMeta}
            activeCleanerSelectedRegion={activeCleanerSelectedRegion}
            processing={processing}
            imagesCount={images.length}
            progress={progress}
            handleClean={handleClean}
          />
        )}
        {mode === 'typesetter' && (
          <TypesetterToolsPanel
            activeImageName={activeImage?.file.name ?? images[0]?.file.name ?? null}
            activeRegion={activeSelectedRegion}
            regionsCount={activeImageDetections.length}
            session={activeTypographerSession}
            queueSelectedId={typographerQueueSelectedId}
            availablePresets={typographyPresetList}
            selectedPresetId={
              activeTypographerSession?.activePresetId ??
              activeTypographerPreset?.id ??
              null
            }
            selectedTool={typographerSelectionTool}
            snapshotName={typographerSnapshotName}
            selectedSnapshotId={typographerSelectedSnapshotId}
            onSelectedToolChange={setTypographerSelectionTool}
            onPresetChange={handleTypographerPresetChange}
            onRefineShape={() => void refineActiveTypographerShape()}
            onConvertShape={convertActiveTypographerShape}
            onDuplicateRegion={duplicateSelectedTypographerRegion}
            onDeleteRegion={removeSelectedAioRegion}
            onApplyPresetToSelection={applyActiveTypographyPresetToSelection}
            onApplyPresetToImage={applyActiveTypographyPresetToImage}
            onSnapshotNameChange={setTypographerSnapshotName}
            onSaveSnapshot={handleTypographerSaveSnapshot}
            onSelectSnapshot={setTypographerSelectedSnapshotId}
            onRestoreSnapshot={handleTypographerRestoreSnapshot}
            onDraftTextChange={handleTypographerDraftChange}
            onBuildQueue={handleTypographerBuildQueue}
            onClearQueue={handleTypographerClearQueue}
            onApplySelectedQueueItem={applySelectedTypographerQueueItem}
            onApplyNextQueueItem={applyNextTypographerQueueItem}
            onSelectQueueItem={setTypographerQueueSelectedId}
            onToggleMultiBubble={handleTypographerToggleMultiBubble}
            onImportQueueText={handleTypographerImportQueueText}
            multiBubbleRegions={activeTypographerMultiSelectedIds.map(
              (id, i) => {
                const region = activeImageDetections.find((r) => r.id === id);
                const text = (region?.renderText ?? '').trim();
                return {
                  id,
                  label: text.length > 0 ? text.slice(0, 28) : `Bubble ${i + 1}`,
                };
              },
            )}
            onReorderMultiBubbleRegions={handleTypographerMultiSelectReorder}
            availableFolders={typographyFolderList}
            availableFonts={availableRenderFonts}
            onUpdatePreset={handleUpdateTypographyPreset}
          />
        )}
        {mode === 'translator' && (
          <TranslatorToolsPanel
            translatorWorkspaceMode={translatorWorkspaceMode}
            setTranslatorWorkspaceMode={setTranslatorWorkspaceMode}
            translatorVisualProcessingMode={translatorVisualProcessingMode}
            setTranslatorVisualProcessingMode={
              setTranslatorVisualProcessingMode
            }
            srcLang={srcLang}
            setSrcLang={setSrcLang}
            tgtLang={tgtLang}
            setTgtLang={setTgtLang}
            sourceLanguageOptions={SOURCE_LANGUAGE_OPTIONS}
            targetLanguageOptions={TARGET_LANGUAGE_OPTIONS}
            aioRecognizeTextValue={aioStageSelection.recognizeText}
            translatorAvailableOcrStageOptions={
              translatorAvailableOcrStageOptions
            }
            selectedTranslatorOcrCloudOption={selectedTranslatorOcrCloudOption}
            selectedOcrStatusText={selectedOcrStatusText ?? ''}
            formatAioStageOptionLabel={formatAioStageOptionLabel}
            setAioRecognizeTextModel={(modelKey) =>
              setAioStageSelection((prev) => ({
                ...prev,
                recognizeText: modelKey,
              }))
            }
            openRecognizeTextManager={() => {
              openModelManagerForStage('recognizeText', {
                focusedModelId: resolveLocalModelFocusForStage(
                  'recognizeText',
                  aioStageSelection.recognizeText,
                ),
              });
            }}
            translationSelectedModelId={aioStageSelection.getTranslations}
            modelEntries={modelManagerState.entries}
            availableTranslationStageOptions={availableTranslationStageOptions}
            installedCount={modelSummary.installedCount}
            updatesCount={modelSummary.updateCount}
            setTranslationModel={(modelId) =>
              setAioStageSelection((prev) => ({
                ...prev,
                getTranslations: modelId,
              }))
            }
            openTranslationManager={(args) => {
              openModelManagerForStage('getTranslations', {
                language: args?.language ?? srcLang,
                focusedModelId: args?.focusedModelId ?? null,
              });
            }}
            translationSelectedSummary={
              selectedTranslationModelState
                ? `${t('dashboard.status.selectedLabel')}: ${selectedTranslationModelState.model.name}`
                : selectedCustomTranslationProfile
                  ? `${t('dashboard.status.selectedLabel')}: ${selectedCustomTranslationProfile.label} (Custom/FREE Provider)`
                  : selectedLegacyTranslationOption
                    ? `${t('dashboard.status.selectedLabel')}: ${selectedLegacyTranslationOption.name} ${t('dashboard.status.cloudApiSuffix')}`
                    : t('dashboard.status.selectTranslatorModel')
            }
            translationSupportSummary={
              translatorSelectedLocalTranslationCompatible
                ? t('dashboard.status.translatorUsesAioModel')
                : t('dashboard.status.translatorLocalModelIncompatible')
            }
            translatorSfxCleanModelKey={translatorSfxCleanModelKey}
            translatorSfxCleanModelOptions={cleanerAiOptionsForSelect}
            selectedTranslatorSfxCleanOption={
              selectedTranslatorSfxCleanDisplayOption
            }
            selectTranslatorSfxCleanModel={selectTranslatorSfxCleanModel}
            translatorSfxAdditionalInstructions={
              translatorSfxAdditionalInstructions
            }
            setTranslatorSfxAdditionalInstructions={
              setTranslatorSfxAdditionalInstructions
            }
            showLlmSettingsPanel={showLlmSettingsPanel}
            llmSettings={llmSettings}
            setLlmSettings={setLlmSettings}
            clampLlmRequestSettings={clampLlmRequestSettings}
            translatorTextImportRef={translatorTextImportRef}
            translatorImageImportRef={translatorImageImportRef}
            translatorDraftText={translatorDraftText}
            translatorTranslatedText={translatorTranslatedText}
            translatorTextRunning={translatorTextRunning}
            processing={processing}
            imagesCount={images.length}
            runTranslatorText={runTranslatorText}
            processTranslatorVisual={processTranslatorVisual}
            handleTranslatorTextImport={handleTranslatorTextImport}
            handleTranslatorImageUpload={handleTranslatorImageUpload}
        activeId={resolvedActiveId}
            activeTranslatorImageDetectionsCount={
              activeTranslatorImageDetections.length
            }
            activeTranslatorSelectedRegion={activeTranslatorSelectedRegion}
            activeTranslatorSelectedTranslationNotes={
              activeTranslatorSelectedTranslationNotes
            }
            retranslateTranslatorRegions={retranslateTranslatorRegions}
          />
        )}
        <WorkflowSidebarPanels
          mode={mode}
          imagesCount={images.length}
          stitchLayoutMode={stitchLayoutMode}
          setStitchLayoutMode={setStitchLayoutMode}
          stitchBatchStrategy={stitchBatchStrategy}
          setStitchBatchStrategy={setStitchBatchStrategy}
          stitchBatchSize={stitchBatchSize}
          setStitchBatchSize={setStitchBatchSize}
          stitchTargetPrimaryAxis={stitchTargetPrimaryAxis}
          stitchTargetAxisLabel={stitchTargetAxisLabel}
          setStitchTargetPrimaryAxis={setStitchTargetPrimaryAxis}
          stitchGap={stitchGap}
          setStitchGap={setStitchGap}
          stitchAlignMode={stitchAlignMode}
          setStitchAlignMode={setStitchAlignMode}
          stitchBackground={stitchBackground}
          setStitchBackground={setStitchBackground}
          stitchSingleExportFormat={stitchSingleExportFormat}
          setStitchSingleExportFormat={setStitchSingleExportFormat}
          stitchFileBaseName={stitchFileBaseName}
          setStitchFileBaseName={setStitchFileBaseName}
          stitchSelectedBatchIndex={stitchSelectedBatchIndex}
          stitchBatchPlans={stitchBatchPlans}
          moveLastToNext={() => {
            setStitchBatchIndexes((current) =>
              moveLastImageToNextBatch(current, stitchSelectedBatchIndex),
            );
            setTonedStatus(t('dashboard.status.stitchLastMoved'), 'success');
          }}
          pullFirstFromNext={() => {
            setStitchBatchIndexes((current) =>
              pullFirstImageFromNextBatch(current, stitchSelectedBatchIndex),
            );
            setTonedStatus(
              t('dashboard.status.stitchFirstPulled'),
              'success',
            );
          }}
          resetPlanning={() => {
            setStitchBatchIndexes(stitchAutoBatchIndexes);
            setStitchSelectedBatchIndex(0);
            setStatusMessage(
              'Stitcher plan recalculated automatically.',
            );
          }}
          splitterController={splitterController}
          processing={processing}
        />
        <InfoModesToolsPanel mode={mode} />
        {/* ─── MELHORAR (ENHANCE) ─── */}
        {mode === 'enhance' && (
          <EnhanceToolsPanel
            isDesktopRuntime={isDesktopRuntime}
            enhanceScale={enhanceScale}
            setEnhanceScale={setEnhanceScale}
            enhanceProfile={enhanceProfile}
            setEnhanceProfile={(value) =>
              setEnhanceProfile(value as unknown as Parameters<typeof setEnhanceProfile>[0])
            }
            enhanceOutputFormat={enhanceOutputFormat}
            setEnhanceOutputFormat={setEnhanceOutputFormat}
            selectedEnhanceModel={selectedEnhanceModel}
            selectedEnhanceInstallState={selectedEnhanceInstallState}
            filteredEnhanceModels={filteredEnhanceModels}
            enhanceActionBusy={enhanceActionBusy}
            processing={processing}
            imagesCount={images.length}
            setEnhanceModelId={setEnhanceModelId}
            setEnhanceModelManagerOpen={setEnhanceModelManagerOpen}
            importSelectedEnhanceModel={importSelectedEnhanceModel}
            installSelectedEnhanceModel={installSelectedEnhanceModel}
            processEnhance={processEnhance}
            enhanceProfileLabels={enhanceProfileLabels}
            enhanceOutputFormats={[...ENHANCE_OUTPUT_FORMATS]}
          />
        )}
        <ReviewRawToolsPanel
          mode={mode}
          subMode={subMode}
          imagesCount={images.length}
          processing={processing}
          setStatusMessage={setStatusMessage}
        />
      </DashboardRightSidebar>

      <DashboardOverlays
        shortcutCenterOpen={shortcutCenterOpen}
        keyboardShortcutConfig={keyboardShortcutConfig}
        handleKeyboardShortcutConfigChange={handleKeyboardShortcutConfigChange}
        closeShortcutCenter={closeShortcutCenter}
        bugReportModalOpen={bugReportModalOpen}
        setBugReportModalOpen={setBugReportModalOpen}
        mode={mode}
        statusMessage={statusMessage}
        userEmail={authUser?.email ?? user.email}
      />
      <DashboardModelManagers
        activeModelManagerStage={activeModelManagerStage}
        modelManagerState={modelManagerState}
        modelSummary={modelSummary}
        aioSrcLang={aioSrcLang}
        aioStageSelection={aioStageSelection}
        aioStageOptions={aioStageOptions}
        aioOcrStageOptions={ocrStageOptionsForSelect}
        installAllSummary={installAllSummary}
        translationFreeProviderManagerSection={
          translationFreeProviderManagerSection
        }
        ocrFreeProviderManagerSection={ocrFreeProviderManagerSection}
        translationCustomProfilesManagerSection={
          translationCustomProfilesManagerSection
        }
        ocrCustomProfilesManagerSection={ocrCustomProfilesManagerSection}
        closeModelManagerForStage={closeModelManagerForStage}
        setModelModalLanguageFilter={setModelModalLanguageFilter}
        installTranslationModel={installTranslationModel}
        updateTranslationModel={updateTranslationModel}
        uninstallTranslationModel={uninstallTranslationModel}
        retryTranslationModel={retryTranslationModel}
        cancelTranslationModel={cancelTranslationModel}
        installAllTranslationModels={installAllTranslationModels}
        cancelAllTranslationModels={cancelAllTranslationModels}
        checkModelUpdatesNow={checkModelUpdatesNow}
        setAioStageSelection={setAioStageSelection}
        selectAioRecognizeTextModel={selectAioRecognizeTextModel}
        setStatusMessage={setStatusMessage}
        enhanceModelManagerOpen={enhanceModelManagerOpen}
        setEnhanceModelManagerOpen={setEnhanceModelManagerOpen}
        enhanceModelId={enhanceModelId}
        setEnhanceModelId={setEnhanceModelId}
        importOnnxModelFromStorage={importOnnxModelFromStorage}
        refreshModelState={refreshModelState}
      />
      <CleanerAiRecognizeTextModelManagerModal
        open={cleanerAiModelManagerOpen}
        entries={{}}
        freeProviderSection={cleanerAiFreeProviderManagerSection}
        customProfilesSection={cleanerAiCustomProfilesManagerSection}
        diskSpace={null}
        installedCount={0}
        totalCount={0}
        updatesCount={0}
        installedSizeBytes={0}
        checkingRemoteUpdates={false}
        lastRemoteCheckAt={null}
        defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
        focusedModelId={null}
        selectedModelId={cleanerAiModelKey}
        batch={{ active: false, total: 0, completed: 0, cancelled: false }}
        installAllSummary={{ totalBytes: 0, requiredBytes: 0, eligibleModelIds: [] }}
        onClose={() => setCleanerAiModelManagerOpen(false)}
        onSetLanguageFilter={() => {}}
        onInstallModel={async () => {}}
        onUpdateModel={async () => {}}
        onUninstallModel={async () => {}}
        onRetryModel={async () => {}}
        onCancelModel={async () => {}}
        onSelectModel={(modelKey) => {
          selectCleanerAiModel(modelKey);
          setStatusMessage(t('dashboard.status.aiCleanModelSelected', { model: modelKey }));
        }}
        onInstallAll={async () => {}}
        onCancelAll={async () => {}}
        onCheckUpdatesNow={async () => {}}
      />
    </div>
  );
};

export default DashboardPage;
