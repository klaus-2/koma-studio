import React, { memo, useCallback, useMemo } from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { useShallowStableObject } from '../../../utils/shallowStable';

import {
  ArrowRight,
  Bookmark,
  Eraser,
  ExternalLink,
  Eye,
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
import { aioPanelClasses } from './AioRightPanel.skin';
import AioPresetEditorForm from './AioPresetEditorForm';
import { AioRightPanelGpuSection } from './AioRightPanelGpuSection';
import { AioPipelineChip } from '../../AioPipelineChip';
import { AioTimelineStep } from '../../AioTimelineStep';
import { AioStageTabBar, type StageTabDef, type StageTabKey } from '../../AioStageTabBar';
import SubModeToggle from '../../../components/dashboard/SubModeToggle';
import FieldInfoTooltip from '../../../components/dashboard/FieldInfoTooltip';
import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/dashboard.utils';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_ICONS,
  getAioPipelineStageLabels,
} from '../../../constants/dashboard.constants';
import type { RenderTextMode } from '../../../utils/renderModes';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import type {
  AioManualStageStatus,
  SubMode,
} from '../../../types/dashboard.types';
import type { AioStageKey } from '../../../types/aioModelPresets';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
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
import AioStageConfigBody from './AioStageConfigBody';
import AioBatchModePanel from '../../../components/dashboard/AioBatchModePanel';

type ModelManagerApi = ReturnType<typeof useModelManager>;
type ModelManagerPanelApi = ReturnType<typeof useDashboardModelManager>;
type RenderFontCatalogApi = ReturnType<typeof useRenderFontCatalog>;
type AioManualExecutionApi = ReturnType<typeof useAioManualExecution>;
type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;
type AioPresetEditorApi = ReturnType<typeof useAioPresetEditor>;
type AioPipelineExecutionApi = ReturnType<typeof useAioPipelineExecution>;

interface AioRightPanelProps {
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
  openSettingsOnPresetsTab: () => void;
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
  selectedTranslationModelState:
  | ModelManagerApi['state']['entries'][string]
  | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedLegacyTranslationOption: AioStageOption | null;
  aioStageLabels: Record<AioStageKey, string>;
  STAGE_TABS: StageTabDef[];
  showLlmSettingsPanel: boolean;
  llmSettingsSupportSummary: string;
  updateActiveRenderMode: (nextMode: RenderTextMode) => void;
  applyActiveRenderStyleToAllRegions: () => void;
  activeImageRenderStageActive: boolean;
  loadRenderFontCatalog: RenderFontCatalogApi['loadRenderFontCatalog'];
  fontCatalogLoading: RenderFontCatalogApi['fontCatalogLoading'];
  fontCatalogImporting: RenderFontCatalogApi['fontCatalogImporting'];
  fontCatalogError: RenderFontCatalogApi['fontCatalogError'];
  fontCatalogInputRef: React.RefObject<HTMLInputElement | null>;
  handleRenderFontImport: RenderFontCatalogApi['handleRenderFontImport'];
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
  selectedTranslationModelState,
  selectedCustomTranslationProfile,
  selectedLegacyTranslationOption,
  aioStageLabels,
  STAGE_TABS,
  showLlmSettingsPanel,
  llmSettingsSupportSummary,
  updateActiveRenderMode,
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
  const noir = useThemeStore((s) => s.family === 'noir');
  const skin = aioPanelClasses(noir);

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

  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const setCleanerSrcLang = useCleanerStore((s) => s.setCleanerSrcLang);

  /* ── UI shell ── */
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const activeStageTab = useUiShellStore((s) => s.activeStageTab);
  const setActiveStageTab = useUiShellStore((s) => s.setActiveStageTab);

  /* ── AIO pipeline ── */
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const setAioSteps = useAioPipelineStore((s) => s.setAioSteps);
  const handleToggleAioStep = useCallback(
    (stageKey: StageTabKey) => {
      setAioSteps((prev) => {
        if (stageKey === 'detectText') {
          return { ...prev, detectText: true };
        }
        return { ...prev, [stageKey]: !prev[stageKey] };
      });
    },
    [setAioSteps],
  );
  const enabledStepsForTabs = useShallowStableObject({
    detectText: aioSteps.detectText,
    recognizeText: aioSteps.recognizeText,
    getTranslations: aioSteps.getTranslations,
    segmentText: aioSteps.segmentText,
    cleanImage: aioSteps.cleanImage,
    render: aioSteps.render,
  });
  const aioLanguageOptions = useAioPipelineStore((s) => s.aioLanguageOptions);
  const aioPresetState = useAioPipelineStore((s) => s.aioPresetState);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const aioOptionsLoading = useAioPipelineStore((s) => s.aioOptionsLoading);
  const aioGpuStages = useAioPipelineStore((s) => s.aioGpuStages);
  const updateAioGpuStage = useAioPipelineStore((s) => s.updateAioGpuStage);
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
  const activeManualProgress = useAioPipelineStore((s) =>
    resolvedActiveId
      ? (s.aioManualProgressByImage[resolvedActiveId] ?? null)
      : null,
  );
  const aioDeviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const aioMiniBackendRuntimeState = useAioPipelineStore(
    (s) => s.aioMiniBackendRuntimeState,
  );

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

  const aioPipelineStageLabels = useMemo(
    () => getAioPipelineStageLabels(t),
    [t],
  );

  const aioHasGpuExecutionProfile = Boolean(
    aioDeviceInfo?.has_gpu
    || aioMiniBackendRuntimeState?.gpuName
    || (aioMiniBackendRuntimeState?.activeProfile
      && aioMiniBackendRuntimeState.activeProfile !== 'cpu')
    || (aioMiniBackendRuntimeState?.requestedProfile
      && aioMiniBackendRuntimeState.requestedProfile !== 'cpu'),
  );

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
                stageKey="detectText"
                onToggle={handleToggleAioStep}
                disabled
              />
              <AioPipelineChip
                icon={Eye}
                label={t('dashboard.stage.recognizeText.short')}
                subtitle={t('dashboard.aio.pipeline.ocr.subtitle')}
                enabled={aioSteps.recognizeText}
                stageKey="recognizeText"
                onToggle={handleToggleAioStep}
              />
              <AioPipelineChip
                icon={Languages}
                label={t('dashboard.stage.getTranslations.short')}
                subtitle={t('dashboard.aio.pipeline.translate.subtitle')}
                enabled={aioSteps.getTranslations}
                stageKey="getTranslations"
                onToggle={handleToggleAioStep}
              />
              <AioPipelineChip
                icon={Replace}
                label={t('dashboard.stage.segmentText.short')}
                subtitle={t('dashboard.aio.pipeline.segment.subtitle')}
                enabled={aioSteps.segmentText}
                stageKey="segmentText"
                onToggle={handleToggleAioStep}
              />
              <AioPipelineChip
                icon={Eraser}
                label={t('dashboard.stage.cleanImage.short')}
                subtitle={t('dashboard.aio.pipeline.clean.subtitle')}
                enabled={aioSteps.cleanImage}
                stageKey="cleanImage"
                onToggle={handleToggleAioStep}
              />
              <AioPipelineChip
                icon={Paintbrush}
                label={t('dashboard.stage.render.short')}
                subtitle={t('dashboard.aio.pipeline.render.subtitle')}
                enabled={aioSteps.render}
                stageKey="render"
                onToggle={handleToggleAioStep}
              />
            </div>

            {/* Rewind / Forward */}
            <div className="koma-aio-pipeline-controls">
              <button
                type="button"
                className={skin.ghostButton}
                onClick={rewindAioPipeline}
                disabled={processing || !canAioRewind}
                title={t('dashboard.pipeline.prevStep.title')}
                aria-label="Rewind pipeline"
              >
                <SkipBack size={13} /> Rewind
              </button>
              <button
                type="button"
                className={skin.ghostButton}
                onClick={forwardAioPipeline}
                disabled={processing || !canAioForward}
                title={t('dashboard.pipeline.nextStep.title')}
                aria-label="Forward pipeline"
              >
                Forward <SkipForward size={13} />
              </button>
            </div>

            <AioBatchModePanel />

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
                className={skin.primaryButton}
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
                className={skin.ghostButton}
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
            <span className="koma-field__label">{t('dashboard.cleaner.ocr.language')}</span>
            <select
              value={cleanerSrcLang}
              onChange={(e) => setCleanerSrcLang(e.target.value)}
              className={skin.select}
              aria-label={t('dashboard.cleaner.ocr.languageAria')}
            >
              {aioLanguageOptions.source.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
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
              className={skin.select}
              aria-label={t('dashboard.aio.config.sourceLanguage')}
            >
              {aioLanguageOptions.source.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
                </option>
              ))}
            </select>
            <span className="koma-aio-lang-row__arrow" aria-hidden="true">
              <ArrowRight size={12} />
            </span>
            <select
              value={aioTgtLang}
              onChange={(e) => setAioTgtLang(e.target.value)}
              className={skin.select}
              aria-label={t('dashboard.aio.config.targetLanguage')}
            >
              {aioLanguageOptions.target.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
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
              className={skin.langPresetSelect}
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
            <AioPresetEditorForm
              noir={noir}
              presetEditorStageOptions={presetEditorStageOptions}
              aioStageLabels={aioStageLabels}
              formatAioStageOptionLabel={formatAioStageOptionLabel}
              normalizedAioSourceLanguage={normalizedAioSourceLanguage}
              onClose={closePresetEditor}
              onSave={handleSavePresetEditor}
            />
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
          enabledSteps={enabledStepsForTabs}
          onSelect={setActiveStageTab}
        />

        {/* Tab content */}
        <div className="koma-aio-stage-content" key={activeStageTab}>
          <AioStageConfigBody
            activeStageTab={activeStageTab}
            subMode={subMode}
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
            selectedTranslationModelState={selectedTranslationModelState}
            selectedCustomTranslationProfile={selectedCustomTranslationProfile}
            selectedLegacyTranslationOption={selectedLegacyTranslationOption}
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
        </div>

        {/* GPU per-stage toggles */}
        <AioRightPanelGpuSection
          noir={noir}
          aioGpuStages={aioGpuStages}
          aioHasGpuExecutionProfile={aioHasGpuExecutionProfile}
          updateAioGpuStage={updateAioGpuStage}
        />
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
            <span
              className="auth-spinner"
              style={{ width: 14, height: 14 }}
              aria-hidden="true"
            />
            <X size={14} />
            {t("dashboard.dashboardExecute.stop")}
          </button>
        )}
      </div>
    </div>
  );
});