import { AlertTriangle } from 'lucide-react';

import KomaTopbar from '../../KomaTopbar.tsx';
import DashboardMobileBackdrop from '../../../components/dashboard/DashboardMobileBackdrop';
import DashboardRightSidebar from '../../../components/dashboard/DashboardRightSidebar';
import SubModeToggle from '../../../components/dashboard/SubModeToggle';
import OrganizeToolsHint from '../../../components/dashboard/OrganizeToolsHint';
import InfoModesToolsPanel from '../../../components/dashboard/InfoModesToolsPanel';
import ReviewRawToolsPanel from '../../../components/dashboard/ReviewRawToolsPanel';
import DashboardOverlays from '../../../components/dashboard/DashboardOverlays';
import DashboardModelManagers from '../../../components/dashboard/DashboardModelManagers';
import DashboardFooter from '../../../components/dashboard/DashboardFooter';
import ImageCollectionSidebar from './ImageCollectionSidebar';
import ManualToolsDockSection from './ManualToolsDock';
import AioRightPanel from './AioRightPanel';
import CleanerToolsPanel from './CleanerToolsPanel';
import TypographerToolsPanel from './TypographerToolsPanel';
import TranslatorToolsPanel from './TranslatorToolsPanel';
import WorkflowSidebarPanelsSection from './WorkflowSidebarPanels';
import EnhanceToolsPanelSection from './EnhanceToolsPanel';
import DashboardStageSection from './StageGrid';
import CleanerAiRecognizeTextModelManagerModal from './CleanerAiRecognizeTextModelManagerModal';
import type { useSpecialModeStageProps } from '../hooks/utility-workspaces';

type SpecialModeStageProps = ReturnType<typeof useSpecialModeStageProps>['specialModeStageProps'];

import { useI18n } from '../../../i18n';
import { getApiConfig } from '../../../config/api';
import { importOnnxModelFromStorage } from '../../../models/model-storage';
import {
  MODES_WITH_SUBMODE,
  SIDEBAR_RESIZE_STEP,
} from '../../../constants/dashboard.constants';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useExportStore } from '../stores/export-store';
import { useStatusStore } from '../stores/status-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';
import { useAuthAccountStore } from '../stores/auth-account-store';
import { useEnhanceStore } from '../stores/enhance-store';
import {
  useAioRegionEditing,
  useAioRegionSnapshotSync,
} from '../hooks/region-editor';
import {
  useCleanerActions,
  useCleanerManualEdits,
  useCleanerModelSelection,
  useCleanerRegionEditing,
  useCleanerWandHealing,
} from '../hooks/cleaner';
import {
  useAioManualEdits,
  useAioWandHealing,
  useManualToolToggles,
} from '../hooks/manual-tools';
import {
  useTranslatorImports,
  useTranslatorRegionEditing,
  useTranslatorRetranslate,
  useTranslatorTextActions,
  useTranslatorVisualActions,
} from '../hooks/translator';
import {
  useAioManualExecution,
  useAioModelSelection,
  useAioPresetEditor,
  useAioPipelineExecution,
} from '../hooks/aio-pipeline';
import {
  useDashboardEnhanceActions,
  useEnhanceInstallAction,
  useEnhanceModelSelection,
} from '../hooks/enhance';
import {
  useDashboardDownloadActions,
  useDashboardPsdDownload,
} from '../hooks/export-download';
import {
  useDashboardImageCollection,
  useDashboardUploads,
} from '../hooks/image-collection';
import {
  useStitchWorkspace,
  useUtilitySplitterController,
} from '../hooks/utility-workspaces';
import { useAuthAccountProcessingStats } from '../hooks/auth-account';
import {
  useTypographerControls,
  useTypographerWorkspace,
} from '../hooks/typographer';
import { useWorkspacePersistence } from '../hooks/workspace-persistence';
import { useDashboardShellLayout } from '../../../hooks/useDashboardShellLayout';
import { useDashboardExternalActions } from '../../../hooks/useDashboardExternalActions';
import { useDashboardTour } from '../../../hooks/useDashboardTour';
import { useAuth } from '../../../hooks/useAuth';
import { useDashboardAccountSync } from '../../../hooks/useDashboardAccountSync';
import { useDashboardUsageAndPresence } from '../../../hooks/useDashboardUsageAndPresence';
import { useModelManager } from '../../../hooks/useModelManager';
import { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import { useRenderFontCatalog } from '../../../hooks/useRenderFontCatalog';
import type {
  AioManualStageStatus,
  AioPipelineSnapshotKey,
  AioTextRegion,
  DashboardPageProps,
  DownloadItem,
  ProcessableMode,
  SubMode,
  ToolMode,
} from '../../../types/dashboard.types';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { KeyboardShortcutConfigV2 } from '../../../shortcuts/keyboardShortcuts';
import type { RenderTextMode } from '../../../utils/renderModes';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import type { listTextFillSwatches } from '../../../utils/textFillPicker';
import type { TypographyShapeKind } from '../../../typography/types';
import type { AioStageKey } from '../../../types/aioModelPresets';
import type { StageTabDef } from '../../AioStageTabBar';

/* Store/hook-backed prop types (same fields the page reads today). */
type ImageCollectionState = ReturnType<typeof useImageCollectionStore.getState>;
type RegionEditorState = ReturnType<typeof useRegionEditorStore.getState>;
type CleanerState = ReturnType<typeof useCleanerStore.getState>;
type ShellLayoutApi = ReturnType<typeof useDashboardShellLayout>;
type ExternalActionsApi = ReturnType<typeof useDashboardExternalActions>;
type WorkspacePersistenceApi = ReturnType<typeof useWorkspacePersistence>;
type TourApi = ReturnType<typeof useDashboardTour>;
type AuthApi = ReturnType<typeof useAuth>;
type AccountSyncApi = ReturnType<typeof useDashboardAccountSync>;
type UsageAndPresenceApi = ReturnType<typeof useDashboardUsageAndPresence>;
type ModelManagerApi = ReturnType<typeof useModelManager>;
type ModelManagerPanelApi = ReturnType<typeof useDashboardModelManager>;
type RenderFontCatalogApi = ReturnType<typeof useRenderFontCatalog>;
type AioSnapshotSyncApi = ReturnType<typeof useAioRegionSnapshotSync>;
type CleanerRegionEditingApi = ReturnType<typeof useCleanerRegionEditing>;
type TranslatorRegionEditingApi = ReturnType<typeof useTranslatorRegionEditing>;
type CleanerWandHealingApi = ReturnType<typeof useCleanerWandHealing>;
type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;
type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;
type TypographerControlsApi = ReturnType<typeof useTypographerControls>;
type TypographerWorkspaceApi = ReturnType<typeof useTypographerWorkspace>;
type AioManualEditsApi = ReturnType<typeof useAioManualEdits>;
type CleanerManualEditsApi = ReturnType<typeof useCleanerManualEdits>;
type AioWandHealingApi = ReturnType<typeof useAioWandHealing>;
type ManualToolTogglesApi = ReturnType<typeof useManualToolToggles>;
type AioManualExecutionApi = ReturnType<typeof useAioManualExecution>;
type AioPipelineExecutionApi = ReturnType<typeof useAioPipelineExecution>;
type AioPresetEditorApi = ReturnType<typeof useAioPresetEditor>;
type CleanerModelSelectionApi = ReturnType<typeof useCleanerModelSelection>;
type StitchWorkspaceApi = ReturnType<typeof useStitchWorkspace>;
type SplitterApi = ReturnType<typeof useUtilitySplitterController>;
type ImageCollectionApi = ReturnType<typeof useDashboardImageCollection>;
type UploadsApi = ReturnType<typeof useDashboardUploads>;
type AccountStatsApi = ReturnType<typeof useAuthAccountProcessingStats>;
type DownloadActionsApi = ReturnType<typeof useDashboardDownloadActions>;
type PsdDownloadApi = ReturnType<typeof useDashboardPsdDownload>;
type TranslatorTextActionsApi = ReturnType<typeof useTranslatorTextActions>;
type TranslatorVisualActionsApi = ReturnType<typeof useTranslatorVisualActions>;
type TranslatorRetranslateApi = ReturnType<typeof useTranslatorRetranslate>;
type TranslatorImportsApi = ReturnType<typeof useTranslatorImports>;
type EnhanceSelectionApi = ReturnType<typeof useEnhanceModelSelection>;
type EnhanceActionsApi = ReturnType<typeof useDashboardEnhanceActions>;

/**
 * Full dashboard layout view. Receives page-derived values as same-name
 * props, reads store-backed fields via granular selectors, and mounts the
 * already-extracted panels plus `DashboardStageSection` (stage renderers).
 */
export interface DashboardMainLayoutProps {
  /* ── Stage section (page-derived values forwarded to StageGrid) ── */
  resolvedActiveId: string | null;
  resolvedAioAreaSelectionShapeKind: TypographyShapeKind;
  areaSelectionToolActive: boolean;
  textFillSwatches: ReturnType<typeof listTextFillSwatches>;
  typographyPresetList: RegionEditorState['typographyPresetState']['presets'];
  typographyFolderList: RegionEditorState['typographyPresetState']['folders'];
  translationNotesEnabled: boolean;
  currentEmptyPreviewTip: string | undefined;
  handleStageWheelZoom: (event: React.WheelEvent<HTMLElement>) => void;
  specialModeStageProps: SpecialModeStageProps;
  onOpenSettings: DashboardPageProps['onOpenSettings'];
  onOpenModelRankings: DashboardPageProps['onOpenModelRankings'];
  onOpenScanlationFeed: DashboardPageProps['onOpenScanlationFeed'];
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  translatorImageImportRef: React.RefObject<HTMLInputElement | null>;
  fontCatalogInputRef: React.RefObject<HTMLInputElement | null>;
  desktopSidebarToggleRef: React.RefObject<HTMLButtonElement | null>;
  topbarSidebarRevealRef: React.RefObject<HTMLButtonElement | null>;
  desktopToolsToggleRef: React.RefObject<HTMLButtonElement | null>;
  topbarToolsRevealRef: React.RefObject<HTMLButtonElement | null>;
  runTranslatorText: TranslatorTextActionsApi;
  handleTranslatorTextImport: TranslatorImportsApi['handleTranslatorTextImport'];
  handleTranslatorImageUpload: TranslatorImportsApi['handleTranslatorImageUpload'];
  getPreviewSrc: ImageCollectionApi['getPreviewSrc'];
  typographerWorkspace: TypographerWorkspaceApi;
  getAioImageSnapshotMeta: (
    imageId: string,
  ) => {
    index: number;
    canRewind: boolean;
    canForward: boolean;
    label: string | null;
    key: AioPipelineSnapshotKey | null;
  };
  getAioFallbackStageKey: () => AioPipelineSnapshotKey;
  getAioDownloadItemForImage: (imageId: string) => DownloadItem | null;
  rewindAioPipelineForImage: (imageId: string) => void;
  forwardAioPipelineForImage: (imageId: string) => void;
  selectAioRegionForImage: AioSnapshotSyncApi['selectAioRegionForImage'];
  updateAioRegionsForImage: AioSnapshotSyncApi['updateAioRegionsForImage'];
  selectCleanerRegionForImage: CleanerRegionEditingApi['selectCleanerRegionForImage'];
  updateCleanerRegionsForImage: CleanerRegionEditingApi['updateCleanerRegionsForImage'];
  selectTranslatorRegionForImage: TranslatorRegionEditingApi['selectTranslatorRegionForImage'];
  updateTranslatorRegionsForImage: TranslatorRegionEditingApi['updateTranslatorRegionsForImage'];
  getAioManualImageEditState: AioManualEditsApi['getAioManualImageEditState'];
  patchAioManualImageEditState: AioManualEditsApi['patchAioManualImageEditState'];
  getCleanerManualImageEditState: CleanerManualEditsApi['getCleanerManualImageEditState'];
  patchCleanerManualImageEditState: CleanerManualEditsApi['patchCleanerManualImageEditState'];
  runAioMagicWandForImage: AioWandHealingApi['runAioMagicWandForImage'];
  applyAioHealingMaskForImage: AioWandHealingApi['applyAioHealingMaskForImage'];
  runCleanerMagicWandForImage: CleanerWandHealingApi['runCleanerMagicWandForImage'];
  applyCleanerHealingMaskForImage: CleanerWandHealingApi['applyCleanerHealingMaskForImage'];
  refineActiveTypographerShape: TypographerControlsApi['refineActiveTypographerShape'];
  applyAutoDetectedShapeToActiveRegion: AioRegionEditingApi['applyAutoDetectedShapeToActiveRegion'];
  applyAutoDetectedShapeToRegionById: AioRegionEditingApi['applyAutoDetectedShapeToRegionById'];
  applyTypographyPresetToRegionById: AioRegionEditingApi['applyTypographyPresetToRegionById'];
  convertRegionShapeById: AioRegionEditingApi['convertRegionShapeById'];
  handleModeChange: (newMode: ToolMode) => void;
  handleKeyboardShortcutConfigChange: (nextConfig: KeyboardShortcutConfigV2) => void;
  isDesktopRuntime: boolean;

  /* ── Shell layout (hook-local state) ── */
  mobileNavOpen: boolean;
  setMobileNavOpen: ShellLayoutApi['setMobileNavOpen'];
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: ShellLayoutApi['setMobileSidebarOpen'];
  mobileToolsOpen: boolean;
  setMobileToolsOpen: ShellLayoutApi['setMobileToolsOpen'];
  desktopSidebarCollapsed: ShellLayoutApi['desktopSidebarCollapsed'];
  toolsPanelCollapsed: ShellLayoutApi['toolsPanelCollapsed'];
  setToolsPanelCollapsed: ShellLayoutApi['setToolsPanelCollapsed'];
  leftSidebarWidth: ShellLayoutApi['leftSidebarWidth'];
  rightSidebarWidth: ShellLayoutApi['rightSidebarWidth'];
  isCompactViewport: boolean;
  toolsPanelVisible: ShellLayoutApi['toolsPanelVisible'];
  toggleDesktopSidebar: ShellLayoutApi['toggleDesktopSidebar'];
  toggleDesktopToolsPanel: ShellLayoutApi['toggleDesktopToolsPanel'];
  startSidebarResize: ShellLayoutApi['startSidebarResize'];
  resizeLeftSidebarBy: ShellLayoutApi['resizeLeftSidebarBy'];
  resizeRightSidebarBy: ShellLayoutApi['resizeRightSidebarBy'];
  resetLeftSidebarWidth: ShellLayoutApi['resetLeftSidebarWidth'];
  resetRightSidebarWidth: ShellLayoutApi['resetRightSidebarWidth'];
  handleToolsToggle: ShellLayoutApi['handleToolsToggle'];

  /* ── Sidebar / uploads / collection hooks ── */
  processingStats: AccountStatsApi['processingStats'];
  getRootProps: UploadsApi['getRootProps'];
  getInputProps: UploadsApi['getInputProps'];
  isDragActive: boolean;
  removeImage: ImageCollectionApi['removeImage'];
  activeImage: ImageCollectionState['images'][number] | null;
  activeTypographerSession: TypographerWorkspaceApi['activeSession'];
  activeTypographerPreset: RegionEditorState['typographyPresetState']['presets'][number] | null;
  activeTypographerMultiSelectedIds: string[];
  modeLabel: string;
  handleTypographerMultiSelectReorder: (nextOrder: string[]) => void;

  /* ── Workspace persistence ── */
  workspaceHistory: WorkspacePersistenceApi['workspaceHistory'];
  handleWorkspaceUndo: WorkspacePersistenceApi['handleWorkspaceUndo'];
  handleWorkspaceRedo: WorkspacePersistenceApi['handleWorkspaceRedo'];
  exportCurrentWorkspace: WorkspacePersistenceApi['exportCurrentWorkspace'];
  importWorkspaceFile: WorkspacePersistenceApi['importWorkspaceFile'];
  closeWorkspace: WorkspacePersistenceApi['closeWorkspace'];

  /* ── Export / download ── */
  hasDownloadActions: boolean;
  hasDownloads: boolean;
  activeDownloadScope: ProcessableMode | null;
  canExportAioMetadata: boolean;
  hasInpaintedOutputs: boolean;
  canExportPsd: boolean;
  hasAioRenderRegionsForPsd: boolean;
  handleDownload: DownloadActionsApi['handleDownload'];
  handleDownloadPsd: PsdDownloadApi;

  /* ── Auth / account ── */
  authUser: AuthApi['user'];
  logout: AuthApi['logout'];
  userDisplayName: UsageAndPresenceApi['userDisplayName'];
  userDisplayEmail: UsageAndPresenceApi['userDisplayEmail'];
  emailVerificationRequired: UsageAndPresenceApi['emailVerificationRequired'];
  verifyEmailSending: AccountSyncApi['verifyEmailSending'];
  handleSendVerificationEmail: AccountSyncApi['handleSendVerificationEmail'];
  replayTour: TourApi['replayTour'];

  /* ── External actions ── */
  openShortcutCenter: ExternalActionsApi['openShortcutCenter'];
  shortcutCenterOpen: ExternalActionsApi['shortcutCenterOpen'];
  closeShortcutCenter: ExternalActionsApi['closeShortcutCenter'];
  bugReportModalOpen: ExternalActionsApi['bugReportModalOpen'];
  setBugReportModalOpen: ExternalActionsApi['setBugReportModalOpen'];
  openBugReportModal: ExternalActionsApi['openBugReportModal'];
  openProjectExternalLink: ExternalActionsApi['openProjectExternalLink'];
  projectDiscordUrl: ExternalActionsApi['projectDiscordUrl'];
  projectWebsiteUrl: ExternalActionsApi['projectWebsiteUrl'];
  openSettingsOnPresetsTab: ExternalActionsApi['openSettingsOnPresetsTab'];

  /* ── Footer / dock derivations ── */
  aioFooterProcessingLabel: string | null;
  manualDockVisible: boolean;
  manualDockRightOffset: number;
  manualToolsConfigVisible: boolean;
  manualToolsConfigTitle: string;
  areaSelectionToolHasConfig: boolean;
  activeDockToolHasConfig: boolean;
  activeDockRegionsCount: number;
  isAioManualMode: boolean;
  activeStageAllowsAreaTools: boolean;
  activeStageAllowsSegmentTools: boolean;
  activeStageAllowsManualImageTools: boolean;
  activeSelectedRegion: AioTextRegion | null;
  duplicateSelectedTypographerRegion: AioRegionEditingApi['duplicateSelectedTypographerRegion'];
  convertActiveTypographerShape: AioRegionEditingApi['convertActiveTypographerShape'];
  clearAioRegionsForActiveImage: AioRegionEditingApi['clearAioRegionsForActiveImage'];
  applyHealingFromActiveWandSelection: AioWandHealingApi['applyHealingFromActiveWandSelection'];
  clearManualWandSelection: (imageId: string) => void;
  toggleManualToolsConfig: ManualToolTogglesApi['toggleManualToolsConfig'];
  toggleManualImageTool: ManualToolTogglesApi['toggleManualImageTool'];
  clearCleanerManualPaintForImage: CleanerManualEditsApi['clearCleanerManualPaintForImage'];
  clearAioManualPaintForImage: AioManualEditsApi['clearAioManualPaintForImage'];
  resetCleanerManualImageEditsForImage: CleanerManualEditsApi['resetCleanerManualImageEditsForImage'];
  resetAioManualImageEditsForImage: AioManualEditsApi['resetAioManualImageEditsForImage'];
  activeHasManualWandSelection: boolean;
  activeManualHealingBusy: boolean;
  activeHasManualPaintLayer: boolean;
  activeHasManualEdits: boolean;
  handleAioSubModeChange: (nextMode: SubMode) => void;

  /* ── AIO right panel ── */
  rewindAioPipeline: () => void;
  forwardAioPipeline: () => void;
  setManualStageForActiveImage: AioManualExecutionApi['setManualStageForActiveImage'];
  executeManualStageForActiveImage: AioManualExecutionApi['executeManualStageForActiveImage'];
  skipManualStageForActiveImage: AioManualExecutionApi['skipManualStageForActiveImage'];
  handleExecuteManualAioStage: AioManualExecutionApi['handleExecuteManualAioStage'];
  activeManualStageStatus: AioManualStageStatus | null;
  aioPipelineStageLabels: Record<AioPipelineSnapshotKey, string>;
  stopAioExecution: () => void;
  processAIO: AioPipelineExecutionApi['processAIO'];
  aioExecuteButtonProcessingLabel: string;
  normalizedAioSourceLanguage: AioPresetEditorApi['normalizedAioSourceLanguage'];
  presetsForCurrentLanguage: AioPresetEditorApi['presetsForCurrentLanguage'];
  activePresetForCurrentLanguage: AioPresetEditorApi['activePresetForCurrentLanguage'];
  presetEditorStageOptions: AioPresetEditorApi['presetEditorStageOptions'];
  aioPresetEditorOpen: AioPresetEditorApi['aioPresetEditorOpen'];
  aioPresetEditorDraft: AioPresetEditorApi['aioPresetEditorDraft'];
  setAioPresetEditorDraft: AioPresetEditorApi['setAioPresetEditorDraft'];
  handlePresetSelectionChange: AioPresetEditorApi['handlePresetSelectionChange'];
  openCreatePresetEditor: AioPresetEditorApi['openCreatePresetEditor'];
  openEditPresetEditor: AioPresetEditorApi['openEditPresetEditor'];
  closePresetEditor: AioPresetEditorApi['closePresetEditor'];
  handleDeleteActivePreset: AioPresetEditorApi['handleDeleteActivePreset'];
  handleSaveCurrentSelectionAsPreset: AioPresetEditorApi['handleSaveCurrentSelectionAsPreset'];
  handleSavePresetEditor: AioPresetEditorApi['handleSavePresetEditor'];
  availableDetectStageOptions: AioStageOption[];
  availableOcrStageOptions: AioStageOption[];
  availableTranslationStageOptions: AioStageOption[];
  availableSegmentStageOptions: AioStageOption[];
  availableCleanStageOptions: AioStageOption[];
  selectedDetectModel: AioStageOption | null;
  selectedOcrModel: AioStageOption | null;
  selectedSegmentModel: AioStageOption | null;
  selectedCleanModel: AioStageOption | null;
  formatAioStageOptionLabel: AioModelSelectionApi['formatAioStageOptionLabel'];
  resolveLocalModelFocusForStage: AioModelSelectionApi['resolveLocalModelFocusForStage'];
  selectAioLocalStageModel: AioModelSelectionApi['selectAioLocalStageModel'];
  selectAioRecognizeTextModel: AioModelSelectionApi['selectAioRecognizeTextModel'];
  selectedDetectStatusText: AioModelSelectionApi['selectedDetectStatusText'];
  selectedOcrStatusText: AioModelSelectionApi['selectedOcrStatusText'];
  selectedSegmentStatusText: AioModelSelectionApi['selectedSegmentStatusText'];
  selectedCleanStatusText: AioModelSelectionApi['selectedCleanStatusText'];
  openModelManagerForStage: ModelManagerPanelApi['openModelManagerForStage'];
  modelManagerState: ModelManagerApi['state'];
  modelSummary: ModelManagerApi['summary'];
  selectedTranslationModelState: ModelManagerApi['state']['entries'][string] | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedLegacyTranslationOption: AioStageOption | null;
  aioStageLabels: Record<AioStageKey, string>;
  STAGE_TABS: StageTabDef[];
  showLlmSettingsPanel: boolean;
  llmSettingsSupportSummary: string;
  activeSelectedTranslationNotes: string[];
  activeSelectedRenderMode: RenderTextMode;
  activeSelectedResolvedRenderMode: RenderTextMode;
  updateActiveRenderMode: AioRegionEditingApi['updateActiveRenderMode'];
  removeSelectedAioRegion: AioRegionEditingApi['removeSelectedAioRegion'];
  canEditActiveRenderStage: boolean;
  applyActiveRenderStyleToAllRegions: AioRegionEditingApi['applyActiveRenderStyleToAllRegions'];
  activeImageRenderStageActive: boolean;
  loadRenderFontCatalog: RenderFontCatalogApi['loadRenderFontCatalog'];
  fontCatalogLoading: boolean;
  fontCatalogImporting: boolean;
  fontCatalogError: RenderFontCatalogApi['fontCatalogError'];
  handleRenderFontImport: RenderFontCatalogApi['handleRenderFontImport'];
  renderFontRefreshToken: RenderFontCatalogApi['renderFontRefreshToken'];
  availableRenderFonts: RenderFontCatalogApi['availableRenderFonts'];

  /* ── Cleaner / translator / typographer panels ── */
  cleanerAiOptionsForSelect: AioStageOption[];
  cleanerAvailableOcrStageOptions: AioStageOption[];
  cleanerAvailableSegmentStageOptions: AioStageOption[];
  cleanerAvailableCleanStageOptions: AioStageOption[];
  selectedOcrCloudOption: AioStageOption | null;
  selectedCleanerAiDisplayOption: AioStageOption | null;
  selectCleanerAiModel: CleanerModelSelectionApi['selectCleanerAiModel'];
  handleClean: ReturnType<typeof useCleanerActions>;
  activeCleanerRunMeta: CleanerState['cleanerRunMetaByImage'][string] | null;
  activeCleanerSelectedRegion: AioTextRegion | null;
  translatorAvailableOcrStageOptions: AioStageOption[];
  selectedTranslatorOcrCloudOption: AioStageOption | null;
  translatorSelectedLocalTranslationCompatible: boolean;
  selectedTranslatorSfxCleanDisplayOption: AioStageOption | null;
  selectTranslatorSfxCleanModel: (modelKey: string) => void;
  processTranslatorVisual: TranslatorVisualActionsApi;
  retranslateTranslatorRegions: TranslatorRetranslateApi;
  activeImageDetections: AioTextRegion[];
  activeTranslatorImageDetections: AioTextRegion[];
  activeTranslatorSelectedRegion: AioTextRegion | null;
  activeTranslatorSelectedTranslationNotes: string[];
  applyActiveTypographyPresetToSelection: AioRegionEditingApi['applyActiveTypographyPresetToSelection'];
  applyActiveTypographyPresetToImage: AioRegionEditingApi['applyActiveTypographyPresetToImage'];
  handleTypographerPresetChange: TypographerControlsApi['handleTypographerPresetChange'];
  handleTypographerSaveSnapshot: TypographerControlsApi['handleTypographerSaveSnapshot'];
  handleTypographerRestoreSnapshot: TypographerControlsApi['handleTypographerRestoreSnapshot'];
  handleTypographerDraftChange: TypographerControlsApi['handleTypographerDraftChange'];
  handleTypographerBuildQueue: TypographerControlsApi['handleTypographerBuildQueue'];
  handleTypographerClearQueue: TypographerControlsApi['handleTypographerClearQueue'];
  applySelectedTypographerQueueItem: TypographerControlsApi['applySelectedTypographerQueueItem'];
  applyNextTypographerQueueItem: TypographerControlsApi['applyNextTypographerQueueItem'];
  handleTypographerToggleMultiBubble: TypographerControlsApi['handleTypographerToggleMultiBubble'];
  handleTypographerImportQueueText: TypographerControlsApi['handleTypographerImportQueueText'];
  handleUpdateTypographyPreset: AioRegionEditingApi['handleUpdateTypographyPreset'];

  /* ── Utility / enhance panels ── */
  stitchBatchPlans: StitchWorkspaceApi['stitchBatchPlans'];
  stitchAutoBatchIndexes: StitchWorkspaceApi['stitchAutoBatchIndexes'];
  splitterController: SplitterApi['splitterController'];
  selectedEnhanceModel: EnhanceSelectionApi['selectedEnhanceModel'];
  selectedEnhanceInstallState: EnhanceSelectionApi['selectedEnhanceInstallState'];
  filteredEnhanceModels: EnhanceSelectionApi['filteredEnhanceModels'];
  setEnhanceModelManagerOpen: ModelManagerPanelApi['setEnhanceModelManagerOpen'];
  importSelectedEnhanceModel: EnhanceActionsApi['importSelectedEnhanceModel'];
  installSelectedEnhanceModel: ReturnType<typeof useEnhanceInstallAction>;
  processEnhance: EnhanceActionsApi['processEnhance'];

  /* ── Model managers modal ── */
  activeModelManagerStage: ModelManagerPanelApi['activeModelManagerStage'];
  ocrStageOptionsForSelect: AioStageOption[];
  installAllSummary: ModelManagerApi['installAllSummary'];
  translationFreeProviderManagerSection: React.ReactNode;
  ocrFreeProviderManagerSection: React.ReactNode;
  translationCustomProfilesManagerSection: React.ReactNode;
  ocrCustomProfilesManagerSection: React.ReactNode;
  cleanerAiFreeProviderManagerSection: React.ReactNode;
  cleanerAiCustomProfilesManagerSection: React.ReactNode;
  setModelModalLanguageFilter: ModelManagerApi['setModalLanguageFilter'];
  installTranslationModel: ModelManagerApi['installModel'];
  updateTranslationModel: ModelManagerApi['updateModel'];
  uninstallTranslationModel: ModelManagerApi['uninstallModel'];
  retryTranslationModel: ModelManagerApi['retryModel'];
  cancelTranslationModel: ModelManagerApi['cancelModel'];
  installAllTranslationModels: ModelManagerApi['installAll'];
  cancelAllTranslationModels: ModelManagerApi['cancelAll'];
  checkModelUpdatesNow: ModelManagerApi['refreshRemoteModelUpdates'];
  closeModelManagerForStage: ModelManagerPanelApi['closeModelManagerForStage'];
  enhanceModelManagerOpen: ModelManagerPanelApi['enhanceModelManagerOpen'];
  refreshModelState: ModelManagerApi['refreshModelState'];
}

export default function DashboardMainLayout({
  resolvedActiveId,
  resolvedAioAreaSelectionShapeKind,
  areaSelectionToolActive,
  textFillSwatches,
  typographyPresetList,
  typographyFolderList,
  translationNotesEnabled,
  currentEmptyPreviewTip,
  handleStageWheelZoom,
  specialModeStageProps,
  onOpenSettings,
  onOpenModelRankings,
  onOpenScanlationFeed,
  translatorTextImportRef,
  translatorImageImportRef,
  fontCatalogInputRef,
  desktopSidebarToggleRef,
  topbarSidebarRevealRef,
  desktopToolsToggleRef,
  topbarToolsRevealRef,
  runTranslatorText,
  handleTranslatorTextImport,
  handleTranslatorImageUpload,
  getPreviewSrc,
  typographerWorkspace,
  getAioImageSnapshotMeta,
  getAioFallbackStageKey,
  getAioDownloadItemForImage,
  rewindAioPipelineForImage,
  forwardAioPipelineForImage,
  selectAioRegionForImage,
  updateAioRegionsForImage,
  selectCleanerRegionForImage,
  updateCleanerRegionsForImage,
  selectTranslatorRegionForImage,
  updateTranslatorRegionsForImage,
  getAioManualImageEditState,
  patchAioManualImageEditState,
  getCleanerManualImageEditState,
  patchCleanerManualImageEditState,
  runAioMagicWandForImage,
  applyAioHealingMaskForImage,
  runCleanerMagicWandForImage,
  applyCleanerHealingMaskForImage,
  refineActiveTypographerShape,
  applyAutoDetectedShapeToActiveRegion,
  applyAutoDetectedShapeToRegionById,
  applyTypographyPresetToRegionById,
  convertRegionShapeById,
  handleModeChange,
  handleKeyboardShortcutConfigChange,
  isDesktopRuntime,
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
  processingStats,
  getRootProps,
  getInputProps,
  isDragActive,
  removeImage,
  activeImage,
  activeTypographerSession,
  activeTypographerPreset,
  activeTypographerMultiSelectedIds,
  modeLabel,
  handleTypographerMultiSelectReorder,
  workspaceHistory,
  handleWorkspaceUndo,
  handleWorkspaceRedo,
  exportCurrentWorkspace,
  importWorkspaceFile,
  closeWorkspace,
  hasDownloadActions,
  hasDownloads,
  activeDownloadScope,
  canExportAioMetadata,
  hasInpaintedOutputs,
  canExportPsd,
  hasAioRenderRegionsForPsd,
  handleDownload,
  handleDownloadPsd,
  authUser,
  logout,
  userDisplayName,
  userDisplayEmail,
  emailVerificationRequired,
  verifyEmailSending,
  handleSendVerificationEmail,
  replayTour,
  openShortcutCenter,
  shortcutCenterOpen,
  closeShortcutCenter,
  bugReportModalOpen,
  setBugReportModalOpen,
  openBugReportModal,
  openProjectExternalLink,
  projectDiscordUrl,
  projectWebsiteUrl,
  openSettingsOnPresetsTab,
  aioFooterProcessingLabel,
  manualDockVisible,
  manualDockRightOffset,
  manualToolsConfigVisible,
  manualToolsConfigTitle,
  areaSelectionToolHasConfig,
  activeDockToolHasConfig,
  activeDockRegionsCount,
  isAioManualMode,
  activeStageAllowsAreaTools,
  activeStageAllowsSegmentTools,
  activeStageAllowsManualImageTools,
  activeSelectedRegion,
  duplicateSelectedTypographerRegion,
  convertActiveTypographerShape,
  clearAioRegionsForActiveImage,
  applyHealingFromActiveWandSelection,
  clearManualWandSelection,
  toggleManualToolsConfig,
  toggleManualImageTool,
  clearCleanerManualPaintForImage,
  clearAioManualPaintForImage,
  resetCleanerManualImageEditsForImage,
  resetAioManualImageEditsForImage,
  activeHasManualWandSelection,
  activeManualHealingBusy,
  activeHasManualPaintLayer,
  activeHasManualEdits,
  handleAioSubModeChange,
  rewindAioPipeline,
  forwardAioPipeline,
  setManualStageForActiveImage,
  executeManualStageForActiveImage,
  skipManualStageForActiveImage,
  handleExecuteManualAioStage,
  activeManualStageStatus,
  aioPipelineStageLabels,
  stopAioExecution,
  processAIO,
  aioExecuteButtonProcessingLabel,
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
  availableDetectStageOptions,
  availableOcrStageOptions,
  availableTranslationStageOptions,
  availableSegmentStageOptions,
  availableCleanStageOptions,
  selectedDetectModel,
  selectedOcrModel,
  selectedSegmentModel,
  selectedCleanModel,
  formatAioStageOptionLabel,
  resolveLocalModelFocusForStage,
  selectAioLocalStageModel,
  selectAioRecognizeTextModel,
  selectedDetectStatusText,
  selectedOcrStatusText,
  selectedSegmentStatusText,
  selectedCleanStatusText,
  openModelManagerForStage,
  modelManagerState,
  modelSummary,
  selectedTranslationModelState,
  selectedCustomTranslationProfile,
  selectedLegacyTranslationOption,
  aioStageLabels,
  STAGE_TABS,
  showLlmSettingsPanel,
  llmSettingsSupportSummary,
  activeSelectedTranslationNotes,
  activeSelectedRenderMode,
  activeSelectedResolvedRenderMode,
  updateActiveRenderMode,
  removeSelectedAioRegion,
  canEditActiveRenderStage,
  applyActiveRenderStyleToAllRegions,
  activeImageRenderStageActive,
  loadRenderFontCatalog,
  fontCatalogLoading,
  fontCatalogImporting,
  fontCatalogError,
  handleRenderFontImport,
  renderFontRefreshToken,
  availableRenderFonts,
  cleanerAiOptionsForSelect,
  cleanerAvailableOcrStageOptions,
  cleanerAvailableSegmentStageOptions,
  cleanerAvailableCleanStageOptions,
  selectedOcrCloudOption,
  selectedCleanerAiDisplayOption,
  selectCleanerAiModel,
  handleClean,
  activeCleanerRunMeta,
  activeCleanerSelectedRegion,
  translatorAvailableOcrStageOptions,
  selectedTranslatorOcrCloudOption,
  translatorSelectedLocalTranslationCompatible,
  selectedTranslatorSfxCleanDisplayOption,
  selectTranslatorSfxCleanModel,
  processTranslatorVisual,
  retranslateTranslatorRegions,
  activeImageDetections,
  activeTranslatorImageDetections,
  activeTranslatorSelectedRegion,
  activeTranslatorSelectedTranslationNotes,
  applyActiveTypographyPresetToSelection,
  applyActiveTypographyPresetToImage,
  handleTypographerPresetChange,
  handleTypographerSaveSnapshot,
  handleTypographerRestoreSnapshot,
  handleTypographerDraftChange,
  handleTypographerBuildQueue,
  handleTypographerClearQueue,
  applySelectedTypographerQueueItem,
  applyNextTypographerQueueItem,
  handleTypographerToggleMultiBubble,
  handleTypographerImportQueueText,
  handleUpdateTypographyPreset,
  stitchBatchPlans,
  stitchAutoBatchIndexes,
  splitterController,
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  filteredEnhanceModels,
  setEnhanceModelManagerOpen,
  importSelectedEnhanceModel,
  installSelectedEnhanceModel,
  processEnhance,
  installAllSummary,
  translationFreeProviderManagerSection,
  ocrFreeProviderManagerSection,
  translationCustomProfilesManagerSection,
  ocrCustomProfilesManagerSection,
  cleanerAiFreeProviderManagerSection,
  cleanerAiCustomProfilesManagerSection,
  setModelModalLanguageFilter,
  installTranslationModel,
  updateTranslationModel,
  uninstallTranslationModel,
  retryTranslationModel,
  cancelTranslationModel,
  installAllTranslationModels,
  cancelAllTranslationModels,
  checkModelUpdatesNow,
  closeModelManagerForStage,
  enhanceModelManagerOpen,
  refreshModelState,
  activeModelManagerStage,
  ocrStageOptionsForSelect,
}: DashboardMainLayoutProps) {
  const { t } = useI18n();
  const apiConfig = getApiConfig();

  // ── Store-backed values (granular selectors) ──
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const progress = useUiShellStore((s) => s.progress);
  const zoom = useUiShellStore((s) => s.zoom);
  const setZoom = useUiShellStore((s) => s.setZoom);
  const viewMode = useUiShellStore((s) => s.viewMode);
  const setViewMode = useUiShellStore((s) => s.setViewMode);
  const keyboardShortcutConfig = useUiShellStore(
    (s) => s.keyboardShortcutConfig,
  );
  const forcedTourDropdown = useUiShellStore((s) => s.forcedTourDropdown);
  const inlineEditorShortcutRequestKey = useUiShellStore(
    (s) => s.inlineEditorShortcutRequestKey,
  );
  const emptyPreviewTipIndex = useUiShellStore((s) => s.emptyPreviewTipIndex);
  const images = useImageCollectionStore((s) => s.images);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const rotateImage = useImageCollectionStore((s) => s.rotateImage);
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const setCleanerDetectionsByImage = useCleanerStore(
    (s) => s.setCleanerDetectionsByImage,
  );
  const setCleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.setCleanerSelectedRegionByImage,
  );
  const setCleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.setCleanerProcessedBaseByImage,
  );
  const setCleanerRunMetaByImage = useCleanerStore(
    (s) => s.setCleanerRunMetaByImage,
  );
  const setCleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.setCleanerManualImageEditsByImage,
  );
  const setCleanerHealingBusyByImage = useCleanerStore(
    (s) => s.setCleanerHealingBusyByImage,
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
  const setTranslatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.setTranslatorProcessedBaseByImage,
  );
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const setBatchThreads = useAioPipelineStore((s) => s.setBatchThreads);
  const batchThreadsEnabled = useAioPipelineStore((s) => s.batchThreadsEnabled);
  const setBatchThreadsEnabled = useAioPipelineStore(
    (s) => s.setBatchThreadsEnabled,
  );
  const aioDeviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const aioMiniBackendRuntimeState = useAioPipelineStore(
    (s) => s.aioMiniBackendRuntimeState,
  );
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const invalidateAioPipelineHistory = useAioPipelineStore(
    (s) => s.invalidateAioPipelineHistory,
  );
  const aioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.aioManualHealingBusyByImage,
  );
  const manualImageTool = useManualToolsStore((s) => s.manualImageTool);
  const manualImagePaintColor = useManualToolsStore(
    (s) => s.manualImagePaintColor,
  );
  const manualImageBrushSize = useManualToolsStore(
    (s) => s.manualImageBrushSize,
  );
  const manualImageBrushOpacity = useManualToolsStore(
    (s) => s.manualImageBrushOpacity,
  );
  const manualImageBrushBlur = useManualToolsStore(
    (s) => s.manualImageBrushBlur,
  );
  const segmentEditTool = useManualToolsStore((s) => s.segmentEditTool);
  const segmentBrushSize = useManualToolsStore((s) => s.segmentBrushSize);
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const typographerMultiSelectedByImage = useTypographerStore(
    (s) => s.typographerMultiSelectedByImage,
  );
  const setTypographerMultiSelectedByImage = useTypographerStore(
    (s) => s.setTypographerMultiSelectedByImage,
  );
  const cleanerRunMetaByImage = useCleanerStore((s) => s.cleanerRunMetaByImage);
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => s.cleanerDetectionsByImage,
  );
  const cleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.cleanerSelectedRegionByImage,
  );
  const cleanerHealingBusyByImage = useCleanerStore(
    (s) => s.cleanerHealingBusyByImage,
  );
  const cleanerShowOverlays = useCleanerStore((s) => s.cleanerShowOverlays);
  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const setCleanerSrcLang = useCleanerStore((s) => s.setCleanerSrcLang);
  const translatorRunMetaByImage = useTranslatorStore(
    (s) => s.translatorRunMetaByImage,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const translatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.translatorSelectedRegionByImage,
  );
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const downloadItems = useExportStore((s) => s.downloadItems);
  const setDownloadItems = useExportStore((s) => s.setDownloadItems);
  const outFormat = useExportStore((s) => s.outFormat);
  const setOutFormat = useExportStore((s) => s.setOutFormat);
  const outQuality = useExportStore((s) => s.outQuality);
  const setOutQuality = useExportStore((s) => s.setOutQuality);
  const downloadBundleFormat = useExportStore((s) => s.downloadBundleFormat);
  const setDownloadBundleFormat = useExportStore(
    (s) => s.setDownloadBundleFormat,
  );
  const downloadIncludeRawText = useExportStore((s) => s.downloadIncludeRawText);
  const setDownloadIncludeRawText = useExportStore(
    (s) => s.setDownloadIncludeRawText,
  );
  const downloadIncludeTranslatedText = useExportStore(
    (s) => s.downloadIncludeTranslatedText,
  );
  const setDownloadIncludeTranslatedText = useExportStore(
    (s) => s.setDownloadIncludeTranslatedText,
  );
  const downloadIncludeInpaintedImage = useExportStore(
    (s) => s.downloadIncludeInpaintedImage,
  );
  const setDownloadIncludeInpaintedImage = useExportStore(
    (s) => s.setDownloadIncludeInpaintedImage,
  );
  const downloadPsdCompression = useExportStore((s) => s.downloadPsdCompression);
  const setDownloadPsdCompression = useExportStore(
    (s) => s.setDownloadPsdCompression,
  );
  const downloadPsdDpi = useExportStore((s) => s.downloadPsdDpi);
  const setDownloadPsdDpi = useExportStore((s) => s.setDownloadPsdDpi);
  const downloadPsdIncludeOcrOverlay = useExportStore(
    (s) => s.downloadPsdIncludeOcrOverlay,
  );
  const setDownloadPsdIncludeOcrOverlay = useExportStore(
    (s) => s.setDownloadPsdIncludeOcrOverlay,
  );
  const downloadPsdIncludeIndividualCrops = useExportStore(
    (s) => s.downloadPsdIncludeIndividualCrops,
  );
  const setDownloadPsdIncludeIndividualCrops = useExportStore(
    (s) => s.setDownloadPsdIncludeIndividualCrops,
  );
  const downloadPsdIncludeRawTextLayer = useExportStore(
    (s) => s.downloadPsdIncludeRawTextLayer,
  );
  const setDownloadPsdIncludeRawTextLayer = useExportStore(
    (s) => s.setDownloadPsdIncludeRawTextLayer,
  );
  const downloadPsdIncludeTranslatedTextLayer = useExportStore(
    (s) => s.downloadPsdIncludeTranslatedTextLayer,
  );
  const setDownloadPsdIncludeTranslatedTextLayer = useExportStore(
    (s) => s.setDownloadPsdIncludeTranslatedTextLayer,
  );
  const downloadPsdUsePhotoshopTextLayers = useExportStore(
    (s) => s.downloadPsdUsePhotoshopTextLayers,
  );
  const setDownloadPsdUsePhotoshopTextLayers = useExportStore(
    (s) => s.setDownloadPsdUsePhotoshopTextLayers,
  );
  const downloadPsdIncludeMetadataJson = useExportStore(
    (s) => s.downloadPsdIncludeMetadataJson,
  );
  const setDownloadPsdIncludeMetadataJson = useExportStore(
    (s) => s.setDownloadPsdIncludeMetadataJson,
  );
  const downloadPsdLoading = useExportStore((s) => s.downloadPsdLoading);
  const statusMessage = useStatusStore((s) => s.statusMessage);
  const statusMessageTone = useStatusStore((s) => s.statusMessageTone);
  const runtimeExecutionNotice = useStatusStore(
    (s) => s.runtimeExecutionNotice,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const workspaceStatus = useWorkspacePersistenceStore(
    (s) => s.workspaceStatus,
  );
  const workspaceStatusDetail = useWorkspacePersistenceStore(
    (s) => s.workspaceStatusDetail,
  );
  const workspaceLastSavedAt = useWorkspacePersistenceStore(
    (s) => s.workspaceLastSavedAt,
  );
  const user = useAuthAccountStore((s) => s.user);
  const enhanceModelId = useEnhanceStore((s) => s.enhanceModelId);
  const setEnhanceModelId = useEnhanceStore((s) => s.setEnhanceModelId);

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
      <ImageCollectionSidebar
        mobileSidebarOpen={mobileSidebarOpen}
        isCompactViewport={isCompactViewport}
        desktopSidebarCollapsed={desktopSidebarCollapsed}
        leftSidebarWidth={leftSidebarWidth}
        desktopSidebarToggleRef={desktopSidebarToggleRef}
        processingStats={processingStats}
        downloadItems={downloadItems}
        setDownloadItems={setDownloadItems}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        setAioDetectionsByImage={setAioDetectionsByImage}
        setAioSelectedRegionByImage={setAioSelectedRegionByImage}
        setCleanerDetectionsByImage={setCleanerDetectionsByImage}
        setCleanerSelectedRegionByImage={setCleanerSelectedRegionByImage}
        setCleanerProcessedBaseByImage={setCleanerProcessedBaseByImage}
        setCleanerRunMetaByImage={setCleanerRunMetaByImage}
        setCleanerManualImageEditsByImage={setCleanerManualImageEditsByImage}
        setCleanerHealingBusyByImage={setCleanerHealingBusyByImage}
        setTranslatorDetectionsByImage={setTranslatorDetectionsByImage}
        setTranslatorSelectedRegionByImage={setTranslatorSelectedRegionByImage}
        setTranslatorRunMetaByImage={setTranslatorRunMetaByImage}
        setTranslatorProcessedBaseByImage={setTranslatorProcessedBaseByImage}
        invalidateAioPipelineHistory={invalidateAioPipelineHistory}
        toggleDesktopSidebar={toggleDesktopSidebar}
        startSidebarResize={startSidebarResize}
        resetLeftSidebarWidth={resetLeftSidebarWidth}
        resizeLeftSidebarBy={resizeLeftSidebarBy}
        getAioImageSnapshotMeta={getAioImageSnapshotMeta}
        rewindAioPipelineForImage={rewindAioPipelineForImage}
        forwardAioPipelineForImage={forwardAioPipelineForImage}
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
        <DashboardStageSection
          mode={mode}
          subMode={subMode}
          viewMode={viewMode}
          zoom={zoom}
          images={images}
          setActiveId={setActiveId}
          inlineEditorShortcutRequestKey={inlineEditorShortcutRequestKey}
          emptyPreviewTipIndex={emptyPreviewTipIndex}
          aioDetectionsByImage={aioDetectionsByImage}
          aioSelectedRegionByImage={aioSelectedRegionByImage}
          renderDefaultStyle={renderDefaultStyle}
          aioSteps={aioSteps}
          aioPipelineSnapshots={aioPipelineSnapshots}
          aioManualHealingBusyByImage={aioManualHealingBusyByImage}
          manualImageTool={manualImageTool}
          manualImagePaintColor={manualImagePaintColor}
          manualImageBrushSize={manualImageBrushSize}
          manualImageBrushOpacity={manualImageBrushOpacity}
          manualImageBrushBlur={manualImageBrushBlur}
          segmentEditTool={segmentEditTool}
          segmentBrushSize={segmentBrushSize}
          typographerSelectionTool={typographerSelectionTool}
          typographerMultiSelectedByImage={typographerMultiSelectedByImage}
          setTypographerMultiSelectedByImage={setTypographerMultiSelectedByImage}
          cleanerRunMetaByImage={cleanerRunMetaByImage}
          cleanerDetectionsByImage={cleanerDetectionsByImage}
          cleanerSelectedRegionByImage={cleanerSelectedRegionByImage}
          cleanerHealingBusyByImage={cleanerHealingBusyByImage}
          cleanerShowOverlays={cleanerShowOverlays}
          translatorRunMetaByImage={translatorRunMetaByImage}
          translatorDetectionsByImage={translatorDetectionsByImage}
          translatorSelectedRegionByImage={translatorSelectedRegionByImage}
          translatorWorkspaceMode={translatorWorkspaceMode}
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
          rewindAioPipelineForImage={rewindAioPipelineForImage}
          forwardAioPipelineForImage={forwardAioPipelineForImage}
          getAioImageSnapshotMeta={getAioImageSnapshotMeta}
          getAioFallbackStageKey={getAioFallbackStageKey}
          getAioDownloadItemForImage={getAioDownloadItemForImage}
          resolvedActiveId={resolvedActiveId}
          resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
          areaSelectionToolActive={areaSelectionToolActive}
          applyAutoDetectedShapeToActiveRegion={applyAutoDetectedShapeToActiveRegion}
          applyAutoDetectedShapeToRegionById={applyAutoDetectedShapeToRegionById}
          applyTypographyPresetToRegionById={applyTypographyPresetToRegionById}
          convertRegionShapeById={convertRegionShapeById}
          textFillSwatches={textFillSwatches}
          typographyPresetList={typographyPresetList}
          typographyFolderList={typographyFolderList}
          translationNotesEnabled={translationNotesEnabled}
          currentEmptyPreviewTip={currentEmptyPreviewTip}
          isCompactViewport={isCompactViewport}
          renderFontRefreshToken={renderFontRefreshToken}
          availableRenderFonts={availableRenderFonts}
          handleStageWheelZoom={handleStageWheelZoom}
          specialModeStageProps={specialModeStageProps}
          onOpenSettings={onOpenSettings}
          translatorTextImportRef={translatorTextImportRef}
          runTranslatorText={runTranslatorText}
          handleDownload={handleDownload}
          handleTranslatorTextImport={handleTranslatorTextImport}
          getPreviewSrc={getPreviewSrc}
          typographerWorkspace={typographerWorkspace}
        />

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

      <ManualToolsDockSection
        manualDockVisible={manualDockVisible}
        manualDockRightOffset={manualDockRightOffset}
        manualToolsConfigVisible={manualToolsConfigVisible}
        manualToolsConfigTitle={manualToolsConfigTitle}
        areaSelectionToolHasConfig={areaSelectionToolHasConfig}
        activeDockToolHasConfig={activeDockToolHasConfig}
        activeDockRegionsCount={activeDockRegionsCount}
        isAioManualMode={isAioManualMode}
        areaSelectionToolActive={areaSelectionToolActive}
        activeStageAllowsAreaTools={activeStageAllowsAreaTools}
        activeStageAllowsSegmentTools={activeStageAllowsSegmentTools}
        activeStageAllowsManualImageTools={activeStageAllowsManualImageTools}
        resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
        activeSelectedRegion={activeSelectedRegion}
        duplicateSelectedTypographerRegion={
          duplicateSelectedTypographerRegion
        }
        applyAutoDetectedShapeToActiveRegion={
          applyAutoDetectedShapeToActiveRegion
        }
        convertActiveTypographerShape={convertActiveTypographerShape}
        clearAioRegionsForActiveImage={clearAioRegionsForActiveImage}
        applyHealingFromActiveWandSelection={
          applyHealingFromActiveWandSelection
        }
        activeId={resolvedActiveId}
        clearManualWandSelection={clearManualWandSelection}
        toggleManualToolsConfig={toggleManualToolsConfig}
        toggleManualImageTool={toggleManualImageTool}
        clearCleanerManualPaintForImage={clearCleanerManualPaintForImage}
        clearAioManualPaintForImage={clearAioManualPaintForImage}
        resetCleanerManualImageEditsForImage={
          resetCleanerManualImageEditsForImage
        }
        resetAioManualImageEditsForImage={resetAioManualImageEditsForImage}
        activeHasManualWandSelection={activeHasManualWandSelection}
        activeManualHealingBusy={activeManualHealingBusy}
        activeHasManualPaintLayer={activeHasManualPaintLayer}
        activeHasManualEdits={activeHasManualEdits}
      />

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
          <AioRightPanel
            // ── AIO pipeline — sub-mode & execution (not yet migrated) ──
            handleAioSubModeChange={handleAioSubModeChange}
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
            // ── AIO pipeline — preset editor (not yet migrated) ──
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
            openSettingsOnPresetsTab={openSettingsOnPresetsTab}
            // ── AIO pipeline — model selection & catalogs (not yet migrated) ──
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
            // ── AIO pipeline — labels & stage tabs (page memos) ──
            aioStageLabels={aioStageLabels}
            STAGE_TABS={STAGE_TABS}
            // ── LLM settings (not yet migrated) ──
            showLlmSettingsPanel={showLlmSettingsPanel}
            llmSettingsSupportSummary={llmSettingsSupportSummary}
            // ── Region editor / render stage (not yet migrated) ──
            activeImageDetections={activeImageDetections}
            activeSelectedRegion={activeSelectedRegion}
            activeSelectedTranslationNotes={activeSelectedTranslationNotes}
            activeSelectedRenderMode={activeSelectedRenderMode}
            activeSelectedResolvedRenderMode={activeSelectedResolvedRenderMode}
            updateActiveRenderMode={updateActiveRenderMode}
            removeSelectedAioRegion={removeSelectedAioRegion}
            duplicateSelectedTypographerRegion={duplicateSelectedTypographerRegion}
            canEditActiveRenderStage={canEditActiveRenderStage}
            applyActiveRenderStyleToAllRegions={applyActiveRenderStyleToAllRegions}
            activeImageRenderStageActive={activeImageRenderStageActive}
            // ── Typographer — render fonts (not yet migrated) ──
            loadRenderFontCatalog={loadRenderFontCatalog}
            fontCatalogLoading={fontCatalogLoading}
            fontCatalogImporting={fontCatalogImporting}
            fontCatalogError={fontCatalogError}
            fontCatalogInputRef={fontCatalogInputRef}
            handleRenderFontImport={handleRenderFontImport}
            // ── Cleaner tools (not yet migrated) ──
            cleanerSrcLang={cleanerSrcLang}
            setCleanerSrcLang={setCleanerSrcLang}
            // ── Shell (not yet migrated) ──
            isDesktopRuntime={isDesktopRuntime}
          />
        )}
        {mode === 'cleaner' && (
          <CleanerToolsPanel
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
            selectAioLocalStageModel={selectAioLocalStageModel}
            openModelManagerForStage={openModelManagerForStage}
            resolveLocalModelFocusForStage={resolveLocalModelFocusForStage}
            selectCleanerAiModel={selectCleanerAiModel}
            handleClean={handleClean}
            localApiUrl={apiConfig.localUrl}
            activeCleanerRunMeta={activeCleanerRunMeta}
            activeCleanerSelectedRegion={activeCleanerSelectedRegion}
          />
        )}
        {mode === 'typesetter' && (
          <TypographerToolsPanel
            activeTypographerSession={activeTypographerSession}
            activeTypographerPreset={activeTypographerPreset}
            activeTypographerMultiSelectedIds={activeTypographerMultiSelectedIds}
            availableRenderFonts={availableRenderFonts}
            handleTypographerPresetChange={handleTypographerPresetChange}
            refineActiveTypographerShape={refineActiveTypographerShape}
            convertActiveTypographerShape={convertActiveTypographerShape}
            duplicateSelectedTypographerRegion={duplicateSelectedTypographerRegion}
            removeSelectedAioRegion={removeSelectedAioRegion}
            applyActiveTypographyPresetToSelection={applyActiveTypographyPresetToSelection}
            applyActiveTypographyPresetToImage={applyActiveTypographyPresetToImage}
            handleTypographerSaveSnapshot={handleTypographerSaveSnapshot}
            handleTypographerRestoreSnapshot={handleTypographerRestoreSnapshot}
            handleTypographerDraftChange={handleTypographerDraftChange}
            handleTypographerBuildQueue={handleTypographerBuildQueue}
            handleTypographerClearQueue={handleTypographerClearQueue}
            applySelectedTypographerQueueItem={applySelectedTypographerQueueItem}
            applyNextTypographerQueueItem={applyNextTypographerQueueItem}
            handleTypographerToggleMultiBubble={handleTypographerToggleMultiBubble}
            handleTypographerImportQueueText={handleTypographerImportQueueText}
            handleTypographerMultiSelectReorder={handleTypographerMultiSelectReorder}
            handleUpdateTypographyPreset={handleUpdateTypographyPreset}
          />
        )}
        {mode === 'translator' && (
          <TranslatorToolsPanel
            translatorAvailableOcrStageOptions={
              translatorAvailableOcrStageOptions
            }
            selectedTranslatorOcrCloudOption={selectedTranslatorOcrCloudOption}
            selectedOcrStatusText={selectedOcrStatusText}
            availableTranslationStageOptions={availableTranslationStageOptions}
            selectedTranslationModelState={selectedTranslationModelState}
            selectedCustomTranslationProfile={selectedCustomTranslationProfile}
            selectedLegacyTranslationOption={selectedLegacyTranslationOption}
            translatorSelectedLocalTranslationCompatible={
              translatorSelectedLocalTranslationCompatible
            }
            selectedTranslatorSfxCleanOption={
              selectedTranslatorSfxCleanDisplayOption
            }
            formatAioStageOptionLabel={formatAioStageOptionLabel}
            resolveLocalModelFocusForStage={resolveLocalModelFocusForStage}
            modelEntries={modelManagerState.entries}
            modelSummary={modelSummary}
            openModelManagerForStage={openModelManagerForStage}
            cleanerAiOptionsForSelect={cleanerAiOptionsForSelect}
            selectTranslatorSfxCleanModel={selectTranslatorSfxCleanModel}
            showLlmSettingsPanel={showLlmSettingsPanel}
            translatorTextImportRef={translatorTextImportRef}
            translatorImageImportRef={translatorImageImportRef}
            runTranslatorText={runTranslatorText}
            processTranslatorVisual={processTranslatorVisual}
            handleTranslatorTextImport={handleTranslatorTextImport}
            handleTranslatorImageUpload={handleTranslatorImageUpload}
            activeId={resolvedActiveId}
            activeTranslatorImageDetections={activeTranslatorImageDetections}
            activeTranslatorSelectedRegion={activeTranslatorSelectedRegion}
            activeTranslatorSelectedTranslationNotes={
              activeTranslatorSelectedTranslationNotes
            }
            retranslateTranslatorRegions={retranslateTranslatorRegions}
          />
        )}
        <WorkflowSidebarPanelsSection
          stitchBatchPlans={stitchBatchPlans}
          stitchAutoBatchIndexes={stitchAutoBatchIndexes}
          splitterController={splitterController}
        />
        <InfoModesToolsPanel mode={mode} />
        {/* ─── MELHORAR (ENHANCE) ─── */}
        {mode === 'enhance' && (
          <EnhanceToolsPanelSection
            isDesktopRuntime={isDesktopRuntime}
            selectedEnhanceModel={selectedEnhanceModel}
            selectedEnhanceInstallState={selectedEnhanceInstallState}
            filteredEnhanceModels={filteredEnhanceModels}
            setEnhanceModelManagerOpen={setEnhanceModelManagerOpen}
            importSelectedEnhanceModel={importSelectedEnhanceModel}
            installSelectedEnhanceModel={installSelectedEnhanceModel}
            processEnhance={processEnhance}
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
        freeProviderSection={cleanerAiFreeProviderManagerSection}
        customProfilesSection={cleanerAiCustomProfilesManagerSection}
        defaultLanguageFilter={modelManagerState.modalLanguageFilter || aioSrcLang}
        selectCleanerAiModel={selectCleanerAiModel}
      />
    </div>
  );
}
