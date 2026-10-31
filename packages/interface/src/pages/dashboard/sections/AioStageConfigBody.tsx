import React, { memo, useMemo } from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { Info } from 'lucide-react';

import AioLlmSettingsPanel from './AioLlmSettingsPanel';
import FieldInfoTooltip from '../../../components/dashboard/FieldInfoTooltip';
import KlSlider from '../../../components/dashboard/KlSlider';
import StageModelSelect, {
  STAGE_HINTS_CLEAN,
  STAGE_HINTS_RECOGNIZE,
} from '../../../components/AioStageModelControls/StageModelSelect.tsx';
import TranslationModelControl from '../../../components/AioStageModelControls/TranslationModelControl.tsx';
import { useI18n } from '../../../i18n';
import { translateOrFallback } from '../../../i18n/messages';
import {
  RENDER_TEXT_MODE_LABELS,
  type RenderTextMode,
} from '../../../utils/renderModes';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import type { SubMode } from '../../../types/dashboard.types';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useActiveAioRegionState } from '../hooks/region-editor';
import type { StageTabKey } from '../../AioStageTabBar';
import type {
  useAioModelSelection,
} from '../hooks/aio-pipeline';
import { useModelManagerStatusSnapshot } from '../../../hooks/useModelManager';
import { summarizeInstalledModels } from '../../../models/model-storage';
import type { useModelManager } from '../../../hooks/useModelManager';
import type { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import type { useRenderFontCatalog } from '../../../hooks/useRenderFontCatalog';
import { aioPanelClasses } from './AioRightPanel.skin';

type ModelManagerApi = ReturnType<typeof useModelManager>;
type ModelManagerPanelApi = ReturnType<typeof useDashboardModelManager>;
type RenderFontCatalogApi = ReturnType<typeof useRenderFontCatalog>;
type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;

interface AioStageConfigBodyProps {
  activeStageTab: StageTabKey;
  subMode: SubMode;
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

/**
 * Island for the AIO stage-config tab content. Owns the subscriptions that
 * only the tab body needs (stage selection, mask dilation, HD strategy,
 * region editor, model-manager snapshot) so slider drags and model status
 * changes re-render this subtree instead of the whole AIO panel.
 */
export default memo(function AioStageConfigBody({
  activeStageTab,
  subMode,
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
}: AioStageConfigBodyProps) {
  const { t, locale } = useI18n();
  const noir = useThemeStore((s) => s.family === 'noir');
  const skin = aioPanelClasses(noir);

  const modelManagerState = useModelManagerStatusSnapshot();
  const modelSummary = useMemo(
    () => summarizeInstalledModels(modelManagerState.entries),
    [modelManagerState.entries],
  );

  const activeId = useImageCollectionStore((s) => s.activeId);
  const {
    activeSelectedRegion,
    activeSelectedRenderMode,
    activeSelectedResolvedRenderMode,
  } = useActiveAioRegionState({ resolvedActiveId: activeId });

  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
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
  const renderStepEnabled = useAioPipelineStore((s) => s.aioSteps.render);

  const canEditActiveRenderStage =
    activeImageRenderStageActive &&
    subMode === 'manual' &&
    Boolean(activeSelectedRegion);

  return (
    <>
      {/* ── Detect ──────────────────────────────────────────── */}
      {activeStageTab === 'detectText' && (
        <StageModelSelect
          label={t('aio.stage.detectText')}
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
        <StageModelSelect
          label={t('aio.stage.recognizeText')}
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
          hints={STAGE_HINTS_RECOGNIZE}
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
            <AioLlmSettingsPanel supportSummary={llmSettingsSupportSummary} />
          )}
        </>
      )}

      {/* ── Segment ─────────────────────────────────────────── */}
      {activeStageTab === 'segmentText' && (
        <StageModelSelect
          label={t('aio.stage.segmentText')}
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
        <StageModelSelect
          label={t('aio.stage.cleanImage')}
          labelTooltip={{
            content: translateOrFallback(locale,
              'dashboard.aio.cleanImage.tooltip',
              'Clean Image is the cleanup and inpainting stage. It removes text and selected artifacts before the final render/edit pass.',
            ),
            ariaLabel: translateOrFallback(locale,
              'dashboard.aio.cleanImage.tooltipAria',
              'What Clean Image is used for',
            ),
          }}
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
          hints={STAGE_HINTS_CLEAN}
        >
          <KlSlider
            label={(
              <span className="koma-inline-label-with-info">
                {t("dashboard.aio.clean.maskDilation")}
                <FieldInfoTooltip
                  content={translateOrFallback(locale,
                    'dashboard.aio.clean.maskDilation.tooltip',
                    'Expands the cleanup mask before inpainting. Raise it when text edges remain; keep it lower to preserve nearby artwork.',
                  )}
                  ariaLabel={translateOrFallback(locale,
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

          <span className="koma-field__label">
            <span className="koma-inline-label-with-info">
              {t("dashboard.dashboardLlm.hdStrategy")}
              <FieldInfoTooltip
                content={translateOrFallback(locale,
                  'dashboard.dashboardLlm.hdStrategy.tooltip',
                  'Defines how large images are prepared before cleanup. Resize scales the page, Crop splits it into tiles, and Original sends it as-is.',
                )}
                ariaLabel={translateOrFallback(locale,
                  'dashboard.dashboardLlm.hdStrategy.tooltipAria',
                  'What HD Strategy is used for',
                )}
              />
            </span>
          </span>
          <select
            value={aioHdStrategy}
            onChange={(e) =>
              setAioHdStrategy(
                e.target.value as 'original' | 'resize' | 'crop',
              )
            }
            className={skin.select}
            aria-label={t("dashboard.dashboardLlm.hdStrategy")}
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
                      content={translateOrFallback(locale,
                        'dashboard.dashboardLlm.cropMargin.tooltip',
                        'Adds extra padding around each crop tile. Increase it if borders lose context or show seams after cleanup.',
                      )}
                      ariaLabel={translateOrFallback(locale,
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
                      content={translateOrFallback(locale,
                        'dashboard.dashboardLlm.cropTriggerSize.tooltip',
                        'Minimum image size that activates crop tiling. Smaller images stay as one piece; larger ones are split into crops.',
                      )}
                      ariaLabel={translateOrFallback(locale,
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
        </StageModelSelect>
      )}

      {/* ── Render ──────────────────────────────────────────── */}
      {activeStageTab === 'render' && renderStepEnabled && (
        <div className="koma-aio-text-mode">
          {/* Text Mode */}
          <div className="koma-field">
            <span className="koma-field__label">
              {t('dashboard.status.selectionMode')}
            </span>
            <select
              className={skin.select}
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
              className={skin.actionButton}
              onClick={() => void loadRenderFontCatalog()}
              disabled={fontCatalogLoading}
            >
              {fontCatalogLoading
                ? t('dashboard.typo.fontsUpdating')
                : t('dashboard.typo.updateFonts')}
            </button>
            <button
              type="button"
              className={skin.actionButton}
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
            className={skin.primaryFullButton}
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

      {activeStageTab === 'render' && !renderStepEnabled && (
        <p className="koma-aio-hint">
          {t('dashboard.aio.render.disabled')}
        </p>
      )}
    </>
  );
});
