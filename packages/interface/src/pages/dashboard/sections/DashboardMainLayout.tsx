import { memo, useCallback } from 'react';

import { AlertTriangle } from 'lucide-react';

import KomaTopbar from '../../KomaTopbar.tsx';
import DashboardBackdrop from '../../../components/dashboard/DashboardBackdrop';
import DashboardMobileBackdrop from '../../../components/dashboard/DashboardMobileBackdrop';
import DashboardRightSidebar from '../../../components/dashboard/DashboardRightSidebar';
import InfoModesToolsPanel from '../../../components/dashboard/InfoModesToolsPanel';
import ReviewRawToolsPanel from '../../../components/dashboard/ReviewRawToolsPanel';
import DashboardOverlays from '../../../components/dashboard/DashboardOverlays';
import DashboardModelManagers from '../../../components/dashboard/DashboardModelManagers';
import DashboardFooter from '../../../components/dashboard/DashboardFooter';
import { KomaStudioCompanion } from '../../../components/koma-mascot/KomaStudioCompanion';
import ImageCollectionSidebar from './ImageCollectionSidebar';
import ManualToolsDockSection from './ManualToolsDock';
import WorkflowSidebarPanelsSection from './WorkflowSidebarPanels';
import DashboardStageSection from './StageGrid';
import CleanerAiRecognizeTextModelManagerModal from './CleanerAiRecognizeTextModelManagerModal';
import AioRightPanel from './AioRightPanel';
import CleanerToolsPanel from './CleanerToolsPanel';
import TypographerToolsPanel from './TypographerToolsPanel';
import TranslatorToolsPanel from './TranslatorToolsPanel';
import EnhanceToolsPanelSection from './EnhanceToolsPanel';

import type { useSpecialModeStageProps } from '../hooks/utility-workspaces';

type SpecialModeStageProps = ReturnType<typeof useSpecialModeStageProps>['specialModeStageProps'];

import { useI18n } from '../../../i18n';
import { getApiConfig } from '../../../config/api';
import { importOnnxModelFromStorage } from '../../../models/model-storage';
import {
  SIDEBAR_RESIZE_STEP,
} from '../../../constants/dashboard.constants';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
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
} from '../hooks/utility-workspaces';
import {
  useTypographerControls,
  useTypographerWorkspace,
} from '../hooks/typographer';
import { useWorkspacePersistence } from '../hooks/workspace-persistence';
import { useDashboardShellLayout } from '../../../hooks/useDashboardShellLayout';
import { useDashboardExternalActions } from '../../../hooks/useDashboardExternalActions';
import { useDashboardTour } from '../../../hooks/useDashboardTour';
import type { OnboardingState } from '../../../hooks/useOnboardingFlow';
import { useAuth } from '../../../hooks/useAuth';
import { useDashboardAccountSync } from '../../../hooks/useDashboardAccountSync';
import { useDashboardUsageAndPresence } from '../../../hooks/useDashboardUsageAndPresence';
import { useModelManager } from '../../../hooks/useModelManager';
import { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import { useRenderFontCatalog } from '../../../hooks/useRenderFontCatalog';
import type {
  AioManualStageStatus,
  AioPipelineSnapshotKey,
  DashboardPageProps,
  DownloadItem,
  ProcessableMode,
  SubMode,
  ToolMode,
} from '../../../types/dashboard.types';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { KeyboardShortcutConfigV2 } from '../../../shortcuts/keyboardShortcuts';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import type { AioStageKey } from '../../../types/aioModelPresets';
import type { StageTabDef } from '../../AioStageTabBar';
import type { SnapshotLabels } from '../hooks/aio-snapshot.normalization';

type ImageCollectionState = ReturnType<typeof useImageCollectionStore.getState>;
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
type ImageCollectionApi = ReturnType<typeof useDashboardImageCollection>;
type UploadsApi = ReturnType<typeof useDashboardUploads>;
type DownloadActionsApi = ReturnType<typeof useDashboardDownloadActions>;
type PsdDownloadApi = ReturnType<typeof useDashboardPsdDownload>;
type TranslatorTextActionsApi = ReturnType<typeof useTranslatorTextActions>;
type TranslatorVisualActionsApi = ReturnType<typeof useTranslatorVisualActions>;
type TranslatorRetranslateApi = ReturnType<typeof useTranslatorRetranslate>;
type TranslatorImportsApi = ReturnType<typeof useTranslatorImports>;
type EnhanceSelectionApi = ReturnType<typeof useEnhanceModelSelection>;
type EnhanceActionsApi = ReturnType<typeof useDashboardEnhanceActions>;

export interface DashboardMainLayoutProps {
  resolvedActiveId: string | null;
  translationNotesEnabled: boolean;
  handleStageWheelZoom: (event: WheelEvent) => void;
  specialModeStageProps: SpecialModeStageProps;
  deferredStageMode: ToolMode;
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
  rightSidebarRef?: React.RefObject<HTMLElement | null>;
  leftSidebarRef?: React.RefObject<HTMLElement | null>;
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

  getRootProps: UploadsApi['getRootProps'];
  getInputProps: UploadsApi['getInputProps'];
  isDragActive: boolean;
  removeImage: ImageCollectionApi['removeImage'];
  activeImage: ImageCollectionState['images'][number] | null;
  modeLabel: string;

  workspaceHistory: WorkspacePersistenceApi['workspaceHistory'];
  handleWorkspaceUndo: WorkspacePersistenceApi['handleWorkspaceUndo'];
  handleWorkspaceRedo: WorkspacePersistenceApi['handleWorkspaceRedo'];
  exportCurrentWorkspace: WorkspacePersistenceApi['exportCurrentWorkspace'];
  importWorkspaceFile: WorkspacePersistenceApi['importWorkspaceFile'];
  closeWorkspace: WorkspacePersistenceApi['closeWorkspace'];

  hasDownloadActions: boolean;
  hasDownloads: boolean;
  activeDownloadScope: ProcessableMode | null;
  canExportAioMetadata: boolean;
  hasInpaintedOutputs: boolean;
  canExportPsd: boolean;
  hasAioRenderRegionsForPsd: boolean;
  handleDownload: DownloadActionsApi['handleDownload'];
  handleDownloadPsd: PsdDownloadApi;

  authUser: AuthApi['user'];
  logout: AuthApi['logout'];
  userDisplayName: UsageAndPresenceApi['userDisplayName'];
  userDisplayEmail: UsageAndPresenceApi['userDisplayEmail'];
  emailVerificationRequired: UsageAndPresenceApi['emailVerificationRequired'];
  verifyEmailSending: AccountSyncApi['verifyEmailSending'];
  handleSendVerificationEmail: AccountSyncApi['handleSendVerificationEmail'];
  replayTour: TourApi['replayTour'];
  onboarding: OnboardingState;

  openShortcutCenter: ExternalActionsApi['openShortcutCenter'];
  shortcutCenterOpen: ExternalActionsApi['shortcutCenterOpen'];
  closeShortcutCenter: ExternalActionsApi['closeShortcutCenter'];
  bugReportModalOpen: ExternalActionsApi['bugReportModalOpen'];
  setBugReportModalOpen: ExternalActionsApi['setBugReportModalOpen'];
  openBugReportModal: ExternalActionsApi['openBugReportModal'];
  openProjectExternalLink: ExternalActionsApi['openProjectExternalLink'];
  projectDiscordUrl: ExternalActionsApi['projectDiscordUrl'];
  projectWebsiteUrl: ExternalActionsApi['projectWebsiteUrl'];
  projectGithubUrl: ExternalActionsApi['projectGithubUrl'];
  openSettingsOnTab: ExternalActionsApi['openSettingsOnTab'];
  openSettingsOnPresetsTab: ExternalActionsApi['openSettingsOnPresetsTab']; openSettingsOnIntegrationsTab: ExternalActionsApi['openSettingsOnIntegrationsTab']; openSettingsOnRuntimeTab: ExternalActionsApi['openSettingsOnRuntimeTab'];

  manualDockVisible: boolean;
  manualDockRightOffset: number;
  isAioManualMode: boolean;
  activeStageAllowsAreaTools: boolean;
  activeStageAllowsSegmentTools: boolean;
  activeStageAllowsManualImageTools: boolean;
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
  rewindAioPipeline: () => void;
  forwardAioPipeline: () => void;
  setManualStageForActiveImage: AioManualExecutionApi['setManualStageForActiveImage'];
  executeManualStageForActiveImage: AioManualExecutionApi['executeManualStageForActiveImage'];
  skipManualStageForActiveImage: AioManualExecutionApi['skipManualStageForActiveImage'];
  handleExecuteManualAioStage: AioManualExecutionApi['handleExecuteManualAioStage'];
  activeManualStageStatus: AioManualStageStatus | null;
  stopAioExecution: () => void;
  processAIO: AioPipelineExecutionApi['processAIO'];
  processAioAi: AioPipelineExecutionApi['processAioAi'];
  activeAioStageKey: AioPipelineSnapshotKey;
  aioPipelineStageProgressLabels: SnapshotLabels;
  normalizedAioSourceLanguage: AioPresetEditorApi['normalizedAioSourceLanguage'];
  presetsForCurrentLanguage: AioPresetEditorApi['presetsForCurrentLanguage'];
  activePresetForCurrentLanguage: AioPresetEditorApi['activePresetForCurrentLanguage'];
  presetEditorStageOptions: AioPresetEditorApi['presetEditorStageOptions'];
  aioPresetEditorOpen: AioPresetEditorApi['aioPresetEditorOpen'];
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
  selectAioTranslationModel: AioModelSelectionApi['selectAioTranslationModel'];
  selectedDetectStatusText: AioModelSelectionApi['selectedDetectStatusText'];
  selectedOcrStatusText: AioModelSelectionApi['selectedOcrStatusText'];
  selectedSegmentStatusText: AioModelSelectionApi['selectedSegmentStatusText'];
  selectedCleanStatusText: AioModelSelectionApi['selectedCleanStatusText'];
  openModelManagerForStage: ModelManagerPanelApi['openModelManagerForStage'];
  modelModalLanguageFilter: string;
  selectedTranslationModelState: ModelManagerApi['state']['entries'][string] | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedLegacyTranslationOption: AioStageOption | null;
  aioStageLabels: Record<AioStageKey, string>;
  STAGE_TABS: StageTabDef[];
  showLlmSettingsPanel: boolean;
  llmSettingsSupportSummary: string;
  updateActiveRenderMode: AioRegionEditingApi['updateActiveRenderMode'];
  removeSelectedAioRegion: AioRegionEditingApi['removeSelectedAioRegion'];
  applyActiveRenderStyleToAllRegions: AioRegionEditingApi['applyActiveRenderStyleToAllRegions'];
  activeImageRenderStageActive: boolean;
  loadRenderFontCatalog: RenderFontCatalogApi['loadRenderFontCatalog'];
  fontCatalogLoading: boolean;
  fontCatalogImporting: boolean;
  fontCatalogError: RenderFontCatalogApi['fontCatalogError'];
  handleRenderFontImport: RenderFontCatalogApi['handleRenderFontImport'];
  renderFontRefreshToken: RenderFontCatalogApi['renderFontRefreshToken'];
  availableRenderFonts: RenderFontCatalogApi['availableRenderFonts'];

  cleanerAiOptionsForSelect: AioStageOption[];
  cleanerAvailableOcrStageOptions: AioStageOption[];
  cleanerAvailableSegmentStageOptions: AioStageOption[];
  cleanerAvailableCleanStageOptions: AioStageOption[];
  selectedOcrCloudOption: AioStageOption | null;
  selectedCleanerAiDisplayOption: AioStageOption | null;
  selectCleanerAiModel: CleanerModelSelectionApi['selectCleanerAiModel'];
  handleClean: ReturnType<typeof useCleanerActions>;
  translatorAvailableOcrStageOptions: AioStageOption[];
  selectedTranslatorOcrCloudOption: AioStageOption | null;
  translatorSelectedLocalTranslationCompatible: boolean;
  selectedTranslatorSfxCleanDisplayOption: AioStageOption | null;
  selectTranslatorSfxCleanModel: (modelKey: string) => void;
  processTranslatorVisual: TranslatorVisualActionsApi;
  retranslateTranslatorRegions: TranslatorRetranslateApi;
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

  stitchBatchPlans: StitchWorkspaceApi['stitchBatchPlans'];
  stitchAutoBatchIndexes: StitchWorkspaceApi['stitchAutoBatchIndexes'];
  selectedEnhanceModel: EnhanceSelectionApi['selectedEnhanceModel'];
  selectedEnhanceInstallState: EnhanceSelectionApi['selectedEnhanceInstallState'];
  filteredEnhanceModels: EnhanceSelectionApi['filteredEnhanceModels'];
  setEnhanceModelManagerOpen: ModelManagerPanelApi['setEnhanceModelManagerOpen'];
  importSelectedEnhanceModel: EnhanceActionsApi['importSelectedEnhanceModel'];
  installSelectedEnhanceModel: ReturnType<typeof useEnhanceInstallAction>;
  processEnhance: EnhanceActionsApi['processEnhance'];

  activeModelManagerStage: ModelManagerPanelApi['activeModelManagerStage'];
  ocrStageOptionsForSelect: AioStageOption[];
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

export default memo(function DashboardMainLayout({
  resolvedActiveId,
  translationNotesEnabled,
  handleStageWheelZoom,
  specialModeStageProps, deferredStageMode,
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
  rightSidebarRef,
  leftSidebarRef,
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
  getRootProps,
  getInputProps,
  isDragActive,
  removeImage,
  activeImage,
  modeLabel,
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
  onboarding,
  openShortcutCenter,
  shortcutCenterOpen,
  closeShortcutCenter,
  bugReportModalOpen,
  setBugReportModalOpen,
  openBugReportModal,
  openProjectExternalLink,
  projectDiscordUrl,
  projectWebsiteUrl,
  projectGithubUrl,
  openSettingsOnTab,
  openSettingsOnPresetsTab, openSettingsOnIntegrationsTab, openSettingsOnRuntimeTab,
  manualDockVisible,
  manualDockRightOffset,
  isAioManualMode,
  activeStageAllowsAreaTools,
  activeStageAllowsSegmentTools,
  activeStageAllowsManualImageTools,
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
  stopAioExecution,
  processAIO,
  processAioAi,
  activeAioStageKey,
  aioPipelineStageProgressLabels,
  normalizedAioSourceLanguage,
  presetsForCurrentLanguage,
  activePresetForCurrentLanguage,
  presetEditorStageOptions,
  aioPresetEditorOpen,
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
  selectAioTranslationModel,
  selectedDetectStatusText,
  selectedOcrStatusText,
  selectedSegmentStatusText,
  selectedCleanStatusText,
  openModelManagerForStage,
  modelModalLanguageFilter,
  selectedTranslationModelState,
  selectedCustomTranslationProfile,

  selectedLegacyTranslationOption,
  aioStageLabels,
  STAGE_TABS,
  showLlmSettingsPanel,
  llmSettingsSupportSummary,
  updateActiveRenderMode,
  removeSelectedAioRegion,
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
  translatorAvailableOcrStageOptions,
  selectedTranslatorOcrCloudOption,
  translatorSelectedLocalTranslationCompatible,
  selectedTranslatorSfxCleanDisplayOption,
  selectTranslatorSfxCleanModel,
  processTranslatorVisual,
  retranslateTranslatorRegions,
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
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  filteredEnhanceModels,
  setEnhanceModelManagerOpen,
  importSelectedEnhanceModel,
  installSelectedEnhanceModel,
  processEnhance,
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

  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const viewMode = useUiShellStore((s) => s.viewMode);
  const setViewMode = useUiShellStore((s) => s.setViewMode);
  const keyboardShortcutConfig = useUiShellStore(
    (s) => s.keyboardShortcutConfig,
  );
  const forcedTourDropdown = useUiShellStore((s) => s.forcedTourDropdown);
  const inlineEditorShortcutRequestKey = useUiShellStore(
    (s) => s.inlineEditorShortcutRequestKey,
  );
  const images = useImageCollectionStore((s) => s.images);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const rotateImage = useImageCollectionStore((s) => s.rotateImage);

  const handleUndoWorkspace = useCallback(() => {
    void handleWorkspaceUndo();
  }, [handleWorkspaceUndo]);
  const handleRedoWorkspace = useCallback(() => {
    void handleWorkspaceRedo();
  }, [handleWorkspaceRedo]);
  const handleExportWorkspace = useCallback(() => {
    void exportCurrentWorkspace();
  }, [exportCurrentWorkspace]);
  const handleImportWorkspaceFile = useCallback(() => {
    void importWorkspaceFile();
  }, [importWorkspaceFile]);
  const handleCloseWorkspace = useCallback(() => {
    void closeWorkspace();
  }, [closeWorkspace]);
  const handleTopbarDownload = useCallback(
    (scope: string | null) => {
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
    },
    [handleDownload],
  );
  const setToolsRevealNode = useCallback(
    (node: HTMLButtonElement | null) => {
      topbarToolsRevealRef.current = node;
    },
    [topbarToolsRevealRef],
  );
  const setSidebarRevealNode = useCallback(
    (node: HTMLButtonElement | null) => {
      topbarSidebarRevealRef.current = node;
    },
    [topbarSidebarRevealRef],
  );
  const handleSidebarToggle = useCallback(() => {
    toggleDesktopSidebar(false);
  }, [toggleDesktopSidebar]);

  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const setBatchThreads = useAioPipelineStore((s) => s.setBatchThreads);
  const batchThreadsEnabled = useAioPipelineStore((s) => s.batchThreadsEnabled);
  const setBatchThreadsEnabled = useAioPipelineStore((s) => s.setBatchThreadsEnabled);
  const aioDeviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const aioMiniBackendRuntimeState = useAioPipelineStore((s) => s.aioMiniBackendRuntimeState);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const invalidateAioPipelineHistory = useAioPipelineStore((s) => s.invalidateAioPipelineHistory);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
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
      <DashboardBackdrop />

      <DashboardMobileBackdrop
        visible={mobileNavOpen || mobileSidebarOpen || mobileToolsOpen}
        onClose={() => {
          setMobileNavOpen(false);
          setMobileSidebarOpen(false);
          setMobileToolsOpen(false);
        }}
      />

      <ImageCollectionSidebar
        mobileSidebarOpen={mobileSidebarOpen}
        isCompactViewport={isCompactViewport}
        desktopSidebarCollapsed={desktopSidebarCollapsed}
        leftSidebarWidth={leftSidebarWidth}
        sidebarRef={leftSidebarRef}
        desktopSidebarToggleRef={desktopSidebarToggleRef}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
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

      <main className="koma-dash__main relative">
        <KomaTopbar
          mode={mode}
          onModeChange={handleModeChange}
          forcedDropdown={forcedTourDropdown}
          translatorWorkspaceMode={
            mode === 'translator' ? translatorWorkspaceMode : null
          }
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
          onUndoWorkspace={handleUndoWorkspace}
          onRedoWorkspace={handleRedoWorkspace}
          onExportWorkspace={handleExportWorkspace}
          onImportWorkspace={handleImportWorkspaceFile}
          onCloseWorkspace={handleCloseWorkspace}
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
          onDownload={handleTopbarDownload}
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
          toolsRevealButtonRef={setToolsRevealNode}
          sidebarCollapsed={desktopSidebarCollapsed}
          onSidebarToggle={handleSidebarToggle}
          sidebarRevealButtonRef={setSidebarRevealNode}
          userDisplayName={userDisplayName ?? ''}
          userDisplayEmail={userDisplayEmail}
          onLogout={logout}
          onOpenSettings={onOpenSettings}
          onOpenModelRankings={onOpenModelRankings}
          onOpenScanlationFeed={onOpenScanlationFeed}
          onReplayTour={replayTour}
          onOpenOnboarding={onboarding.open}
          onOpenShortcuts={openShortcutCenter}
          shortcutModalOpen={shortcutCenterOpen}
        />

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

        <DashboardStageSection
          mode={deferredStageMode}
          subMode={subMode}
          viewMode={viewMode}
          images={images}
          setActiveId={setActiveId}
          inlineEditorShortcutRequestKey={inlineEditorShortcutRequestKey}
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
          applyAutoDetectedShapeToActiveRegion={applyAutoDetectedShapeToActiveRegion}
          applyAutoDetectedShapeToRegionById={applyAutoDetectedShapeToRegionById}
          applyTypographyPresetToRegionById={applyTypographyPresetToRegionById}
          convertRegionShapeById={convertRegionShapeById}
          translationNotesEnabled={translationNotesEnabled}
          isCompactViewport={isCompactViewport}
          renderFontRefreshToken={renderFontRefreshToken}
          availableRenderFonts={availableRenderFonts}
          handleStageWheelZoom={handleStageWheelZoom}
          specialModeStageProps={specialModeStageProps}
          openSettingsOnIntegrationsTab={openSettingsOnIntegrationsTab}
          translatorTextImportRef={translatorTextImportRef}
          runTranslatorText={runTranslatorText}
          handleDownload={handleDownload}
          handleTranslatorTextImport={handleTranslatorTextImport}
          getPreviewSrc={getPreviewSrc}
          typographerWorkspace={typographerWorkspace}
        />

        {!onboarding.isOpen && <KomaStudioCompanion />}

        <DashboardFooter
          statusMessage={statusMessage}
          statusMessageTone={statusMessageTone}
          workspaceStatus={workspaceStatus}
          workspaceStatusDetail={workspaceStatusDetail}
          workspaceLastSavedAt={workspaceLastSavedAt}
          miniBackendRuntimeState={aioMiniBackendRuntimeState}
          aioDeviceInfo={aioDeviceInfo}
          processing={processing}
          openBugReportModal={openBugReportModal}
          openProjectExternalLink={openProjectExternalLink}
          projectDiscordUrl={projectDiscordUrl}
          projectWebsiteUrl={projectWebsiteUrl}
          runtimeExecutionNotice={runtimeExecutionNotice} openSettingsOnRuntimeTab={openSettingsOnRuntimeTab}
        />
      </main>

      <ManualToolsDockSection
        manualDockVisible={manualDockVisible}
        manualDockRightOffset={manualDockRightOffset}
        isAioManualMode={isAioManualMode}
        activeStageAllowsAreaTools={activeStageAllowsAreaTools}
        activeStageAllowsSegmentTools={activeStageAllowsSegmentTools}
        activeStageAllowsManualImageTools={activeStageAllowsManualImageTools}
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

      <DashboardRightSidebar
        mobileToolsOpen={mobileToolsOpen}
        isCompactViewport={isCompactViewport}
        toolsPanelCollapsed={toolsPanelCollapsed}
        rightSidebarWidth={rightSidebarWidth}
        sidebarRef={rightSidebarRef}
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
        {deferredStageMode === 'aio' && (
            <AioRightPanel
              handleAioSubModeChange={handleAioSubModeChange}
              rewindAioPipeline={rewindAioPipeline}
              forwardAioPipeline={forwardAioPipeline}
              setManualStageForActiveImage={setManualStageForActiveImage}
              executeManualStageForActiveImage={executeManualStageForActiveImage}
              skipManualStageForActiveImage={skipManualStageForActiveImage}
              handleExecuteManualAioStage={handleExecuteManualAioStage}
              activeManualStageStatus={activeManualStageStatus}
              stopAioExecution={stopAioExecution}
              processAIO={processAIO}
              processAioAi={processAioAi}
              activeAioStageKey={activeAioStageKey}
              aioPipelineStageProgressLabels={aioPipelineStageProgressLabels}
              normalizedAioSourceLanguage={normalizedAioSourceLanguage}
              presetsForCurrentLanguage={presetsForCurrentLanguage}
              activePresetForCurrentLanguage={activePresetForCurrentLanguage}
              presetEditorStageOptions={presetEditorStageOptions}
              aioPresetEditorOpen={aioPresetEditorOpen}
              handlePresetSelectionChange={handlePresetSelectionChange}
              openCreatePresetEditor={openCreatePresetEditor}
              openEditPresetEditor={openEditPresetEditor}
              closePresetEditor={closePresetEditor}
              handleDeleteActivePreset={handleDeleteActivePreset}
              handleSaveCurrentSelectionAsPreset={handleSaveCurrentSelectionAsPreset}
              handleSavePresetEditor={handleSavePresetEditor}
              openSettingsOnPresetsTab={openSettingsOnPresetsTab}
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
              selectAioTranslationModel={selectAioTranslationModel}
              selectedDetectStatusText={selectedDetectStatusText}
              selectedOcrStatusText={selectedOcrStatusText}
              selectedSegmentStatusText={selectedSegmentStatusText}
              selectedCleanStatusText={selectedCleanStatusText}
              openModelManagerForStage={openModelManagerForStage}
              selectedTranslationModelState={selectedTranslationModelState}
              selectedLegacyTranslationOption={selectedLegacyTranslationOption}
              selectedCustomTranslationProfile={selectedCustomTranslationProfile}
              aioStageLabels={aioStageLabels}
              STAGE_TABS={STAGE_TABS}
              showLlmSettingsPanel={showLlmSettingsPanel}
              llmSettingsSupportSummary={llmSettingsSupportSummary}
              updateActiveRenderMode={updateActiveRenderMode}
              applyActiveRenderStyleToAllRegions={applyActiveRenderStyleToAllRegions}
              activeImageRenderStageActive={activeImageRenderStageActive}
              loadRenderFontCatalog={loadRenderFontCatalog}
              fontCatalogLoading={fontCatalogLoading}
              fontCatalogImporting={fontCatalogImporting}
              fontCatalogError={fontCatalogError}
              fontCatalogInputRef={fontCatalogInputRef}
              handleRenderFontImport={handleRenderFontImport}
              isDesktopRuntime={isDesktopRuntime}
            />
        )}
        {deferredStageMode === 'cleaner' && (
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
            />
        )}
        {deferredStageMode === 'typesetter' && (
            <TypographerToolsPanel
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
              handleUpdateTypographyPreset={handleUpdateTypographyPreset}
              retranslateTranslatorRegions={retranslateTranslatorRegions}
              updateAioRegionsForImage={updateAioRegionsForImage}
            />
        )}
        {deferredStageMode === 'translator' && (
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
              retranslateTranslatorRegions={retranslateTranslatorRegions}
            />
        )}
        <WorkflowSidebarPanelsSection
          stitchBatchPlans={stitchBatchPlans}
          stitchAutoBatchIndexes={stitchAutoBatchIndexes}
        />
        <InfoModesToolsPanel mode={mode} />
        {deferredStageMode === 'enhance' && (
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
        onboardingOpen={onboarding.isOpen}
        userId={authUser?.id ?? null}
        githubUrl={projectGithubUrl}
        onCloseOnboarding={onboarding.close}
        onStartTour={replayTour}
        onOpenSettingsTab={openSettingsOnTab}
        onOpenExternalUrl={openProjectExternalLink}
        onOpenModelManager={() => openModelManagerForStage('detectText')}
        onInstallModels={installAllTranslationModels}
        onRetryModel={retryTranslationModel}
        onCancelModel={cancelTranslationModel}
        onCancelAllModels={cancelAllTranslationModels}
      />
      <DashboardModelManagers
        activeModelManagerStage={activeModelManagerStage}
        aioSrcLang={aioSrcLang}
        aioStageSelection={aioStageSelection}
        aioStageOptions={aioStageOptions}
        aioOcrStageOptions={ocrStageOptionsForSelect}
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
        defaultLanguageFilter={modelModalLanguageFilter || aioSrcLang}
        selectCleanerAiModel={selectCleanerAiModel}
        onSetLanguageFilter={setModelModalLanguageFilter}
        onInstallModel={installTranslationModel}
        onUpdateModel={updateTranslationModel}
        onUninstallModel={uninstallTranslationModel}
        onRetryModel={retryTranslationModel}
        onCancelModel={cancelTranslationModel}
        onInstallAll={installAllTranslationModels}
        onCancelAll={cancelAllTranslationModels}
        onCheckUpdatesNow={checkModelUpdatesNow}
      />
    </div>
  );
});
