import React, { memo, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  ArrowRight,
  Bookmark,
  Box,
  Eraser,
  ExternalLink,
  Eye,
  Info,
  Languages,
  Paintbrush,
  Pencil,
  Plus,
  Replace,
  Save,
  ScanText,
  Settings,
  SkipBack,
  SkipForward,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { AioSection } from '../../AioSection';
import { AioPipelineChip } from '../../AioPipelineChip';
import { AioTimelineStep } from '../../AioTimelineStep';
import { AioStageTabBar, type StageTabDef } from '../../AioStageTabBar';
import SubModeToggle from '../../../components/dashboard/SubModeToggle';
import FieldInfoTooltip from '../../../components/dashboard/FieldInfoTooltip';
import KlSlider from '../../../components/dashboard/KlSlider';
import DetectTextModelControl from '../../../components/AioStageModelControls/DetectTextModelControl.tsx';
import RecognizeTextModelControl from '../../../components/AioStageModelControls/RecognizeTextModelControl.tsx';
import TranslationModelControl from '../../../components/AioStageModelControls/TranslationModelControl.tsx';
import SegmentTextModelControl from '../../../components/AioStageModelControls/SegmentTextModelControl.tsx';
import CleanImageModelControl from '../../../components/AioStageModelControls/CleanImageModelControl.tsx';
import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/dashboard.utils';
import {
  clampLlmRequestSettings,
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import {
  RENDER_TEXT_MODE_LABELS,
  type RenderTextMode,
} from '../../../utils/renderModes';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_ICONS,
  AIO_PRESET_STAGE_KEYS,
  getAioPipelineStageLabels,
} from '../../../constants/dashboard.constants';
import type {
  AioManualStageStatus,
  SubMode,
} from '../../../types/dashboard.types';
import type { AioStageKey } from '../../../types/aioModelPresets';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useActiveAioRegionState } from '../hooks/region-editor';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import type {
  useAioManualExecution,
  useAioModelSelection,
  useAioPipelineExecution,
  useAioPresetEditor,
} from '../hooks/aio-pipeline';
import type { useModelManager } from '../../../hooks/useModelManager';
import type { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import type { useRenderFontCatalog } from '../../../hooks/useRenderFontCatalog';

type ModelManagerApi = ReturnType<typeof useModelManager>;
type ModelManagerPanelApi = ReturnType<typeof useDashboardModelManager>;
type RenderFontCatalogApi = ReturnType<typeof useRenderFontCatalog>;
type AioManualExecutionApi = ReturnType<typeof useAioManualExecution>;
type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;
type AioPresetEditorApi = ReturnType<typeof useAioPresetEditor>;
type AioPipelineExecutionApi = ReturnType<typeof useAioPipelineExecution>;

interface AioRightPanelProps {
  /* ── AIO pipeline — sub-mode & execution (not yet migrated) ── */
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
  aioExecuteButtonProcessingLabel: string;

  /* ── AIO pipeline — preset editor (not yet migrated) ── */
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
  openSettingsOnPresetsTab: () => void;

  /* ── AIO pipeline — model selection & catalogs (not yet migrated) ── */
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
  selectedTranslationModelState:
  | ModelManagerApi['state']['entries'][string]
  | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedLegacyTranslationOption: AioStageOption | null;

  /* ── AIO pipeline — labels & stage tabs (page memos) ── */
  aioStageLabels: Record<AioStageKey, string>;
  STAGE_TABS: StageTabDef[];

  /* ── LLM settings (not yet migrated) ── */
  showLlmSettingsPanel: boolean;
  llmSettingsSupportSummary: string;

  /* ── Region editor / render stage (not yet migrated) ── */
  updateActiveRenderMode: (nextMode: RenderTextMode) => void;
  removeSelectedAioRegion: () => void;
  duplicateSelectedTypographerRegion: () => void;
  applyActiveRenderStyleToAllRegions: () => void;
  activeImageRenderStageActive: boolean;

  /* ── Typographer — render fonts (not yet migrated) ── */
  loadRenderFontCatalog: RenderFontCatalogApi['loadRenderFontCatalog'];
  fontCatalogLoading: RenderFontCatalogApi['fontCatalogLoading'];
  fontCatalogImporting: RenderFontCatalogApi['fontCatalogImporting'];
  fontCatalogError: RenderFontCatalogApi['fontCatalogError'];
  fontCatalogInputRef: React.RefObject<HTMLInputElement | null>;
  handleRenderFontImport: RenderFontCatalogApi['handleRenderFontImport'];

  /* ── Shell (not yet migrated) ── */
  isDesktopRuntime: boolean;
}

export default memo(function AioRightPanel({
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
  openSettingsOnPresetsTab,
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
  updateActiveRenderMode,
  removeSelectedAioRegion,
  duplicateSelectedTypographerRegion,
  applyActiveRenderStyleToAllRegions,
  activeImageRenderStageActive,
  loadRenderFontCatalog,
  fontCatalogLoading,
  fontCatalogImporting,
  fontCatalogError,
  fontCatalogInputRef,
  handleRenderFontImport,
  isDesktopRuntime,
}: AioRightPanelProps) {
  const { t } = useI18n();

  /* ── Image collection ── */
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const resolvedActiveId = useMemo(
    () =>
      (images.find((img) => img.id === activeId) ?? images[0] ?? null)?.id ??
      null,
    [activeId, images],
  );
  const selectManualStageByIndex = useCallback(
    (index: number) => {
      void setManualStageForActiveImage(index);
    },
    [setManualStageForActiveImage],
  );
  const {
    activeImageDetections,
    activeSelectedRegion,
    activeSelectedTranslationNotes,
    activeSelectedRenderMode,
    activeSelectedResolvedRenderMode,
  } = useActiveAioRegionState({ resolvedActiveId: activeId });

  /* ── Cleaner language (self-subscribed; panel renders the cleaner-language
     section only during the deferred-lane window) ── */
  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const setCleanerSrcLang = useCleanerStore((s) => s.setCleanerSrcLang);

  /* ── UI shell ── */
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const activeStageTab = useUiShellStore((s) => s.activeStageTab);
  const setActiveStageTab = useUiShellStore((s) => s.setActiveStageTab);

  const canEditActiveRenderStage =
    activeImageRenderStageActive &&
    subMode === 'manual' &&
    Boolean(activeSelectedRegion);

  /* ── LLM providers ── */
  const {
    llmExtraContext,
    llmTranslationNotesEnabled,
    llmNeighborContextEnabled,
    llmImageInputEnabled,
    llmTemperature,
    llmTopP,
    llmMaxTokens,
  } = useLlmProvidersStore(
    useShallow((s) => ({
      llmExtraContext: s.llmSettings.extra_context,
      llmTranslationNotesEnabled: s.llmSettings.translation_notes_enabled,
      llmNeighborContextEnabled: s.llmSettings.neighbor_image_context_enabled,
      llmImageInputEnabled: s.llmSettings.image_input_enabled,
      llmTemperature: s.llmSettings.temperature,
      llmTopP: s.llmSettings.top_p,
      llmMaxTokens: s.llmSettings.max_tokens,
    })),
  );
  const setLlmSettings = useLlmProvidersStore((s) => s.setLlmSettings);

  /* ── AIO pipeline ── */
  // Single-value slices (T4.3): map/array reads below are narrowed to the
  // active-image entries or primitive projections — whole-map subscriptions
  // made the panel re-render with every other image's pipeline churn.
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const setAioSteps = useAioPipelineStore((s) => s.setAioSteps);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const aioLanguageOptions = useAioPipelineStore((s) => s.aioLanguageOptions);
  const aioPresetState = useAioPipelineStore((s) => s.aioPresetState);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const aioOptionsLoading = useAioPipelineStore((s) => s.aioOptionsLoading);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const setAioMaskDilation = useAioPipelineStore((s) => s.setAioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const setAioHdStrategy = useAioPipelineStore((s) => s.setAioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const setAioHdResizeLimit = useAioPipelineStore((s) => s.setAioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const setAioHdCropMargin = useAioPipelineStore((s) => s.setAioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );
  const setAioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.setAioHdCropTriggerSize,
  );
  const aioGpuStages = useAioPipelineStore((s) => s.aioGpuStages);
  const updateAioGpuStage = useAioPipelineStore((s) => s.updateAioGpuStage);
  // Snapshot history narrowed to what this panel renders: count (hint
  // "n/m"), the index, and the active entry by identity.
  const aioPipelineSnapshotCount = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots.length,
  );
  const aioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.aioPipelineSnapshotIndex,
  );
  const activeAioPipelineSnapshot = useAioPipelineStore((s) => {
    const index = s.aioPipelineSnapshotIndex;
    return index >= 0 && index < s.aioPipelineSnapshots.length
      ? (s.aioPipelineSnapshots[index] ?? null)
      : null;
  });
  // Active-image manual progress entry only: other images' progress writes no
  // longer reach the panel.
  const activeManualProgress = useAioPipelineStore((s) =>
    resolvedActiveId
      ? (s.aioManualProgressByImage[resolvedActiveId] ?? null)
      : null,
  );
  const aioDeviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const aioMiniBackendRuntimeState = useAioPipelineStore(
    (s) => s.aioMiniBackendRuntimeState,
  );

  // Same derivation as the page-level `enabledStepCount` computation.
  const enabledStepCount = [
    aioSteps.detectText,
    aioSteps.recognizeText,
    aioSteps.getTranslations,
    aioSteps.segmentText,
    aioSteps.cleanImage,
    aioSteps.render,
  ].filter(Boolean).length;

  const canAioRewind = aioPipelineSnapshotIndex > 0;
  const canAioForward =
    aioPipelineSnapshotIndex >= 0 &&
    aioPipelineSnapshotIndex < aioPipelineSnapshotCount - 1;

  // Same helper as the page-level `aioPipelineStageLabels` memo (T4.3): built
  // locally so the page no longer forwards the labels through the layout.
  const aioPipelineStageLabels = useMemo(
    () => getAioPipelineStageLabels(t),
    [t],
  );

  // Same derivation as the page-level `aioHasGpuExecutionProfile` value.
  const aioHasGpuExecutionProfile = Boolean(
    aioDeviceInfo?.has_gpu
    || aioMiniBackendRuntimeState?.gpuName
    || (aioMiniBackendRuntimeState?.activeProfile
      && aioMiniBackendRuntimeState.activeProfile !== 'cpu')
    || (aioMiniBackendRuntimeState?.requestedProfile
      && aioMiniBackendRuntimeState.requestedProfile !== 'cpu'),
  );

  // Same helper as the page-level `resolveTooltipText` callback.
  const resolveTooltipText = useCallback(
    (key: string, fallback: string) => {
      const value = t(key as any) as string;
      return value === key ? fallback : value;
    },
    [t],
  );

  return (
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
                {aioPipelineSnapshotCount})
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
                    stageIndex={index}
                    onSelect={selectManualStageByIndex}
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
                      value={llmExtraContext}
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
                          checked={llmTranslationNotesEnabled}
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
                          checked={llmNeighborContextEnabled}
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
                          checked={llmImageInputEnabled}
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
                        value={llmTemperature}
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
                        value={llmTopP}
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
                        value={llmMaxTokens}
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
                  disabled={fontCatalogLoading}
                >
                  {fontCatalogLoading
                    ? t('dashboard.typo.fontsUpdating')
                    : t('dashboard.typo.updateFonts')}
                </button>
                <button
                  type="button"
                  className="koma-btn koma-btn--ghost"
                  onClick={() => fontCatalogInputRef.current?.click()}
                  disabled={!isDesktopRuntime || fontCatalogImporting}
                  title={
                    isDesktopRuntime
                      ? t('dashboard.typo.importFontTitle')
                      : t('dashboard.typo.desktopOnly')
                  }
                >
                  {fontCatalogImporting
                    ? t('dashboard.typo.fontImporting')
                    : t('dashboard.typo.importFont')}
                </button>
                <input
                  ref={fontCatalogInputRef}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void handleRenderFontImport(e);
                  }}
                />
              </div>
              {fontCatalogError && (
                <p className="koma-aio-hint" style={{ color: '#fda4af' }}>
                  {fontCatalogError}
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
  );
});