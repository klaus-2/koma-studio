import {
  Box,
  Eraser,
  Eye,
  HardDrive,
  RefreshCcw,
  Replace,
  Sparkles,
  Wand2,
  Wrench,
} from 'lucide-react';

import { AioSection } from '../../pages/AioSection';
import { cn } from '../../utils/dashboard.utils';
import type {
  CleanerMode,
} from '../../types/dashboard.types';
import type { AioStageOption } from '../../models/aioStageCatalog';
import KlSlider from './KlSlider';
import '../../pages/CleanerTranslatorTools.css';
import { useI18n } from '../../i18n';

interface CleanerToolsPanelProps {
  cleanerMode: CleanerMode;
  setCleanerMode: (value: CleanerMode) => void;
  cleanerSrcLang: string;
  setCleanerSrcLang: (value: string) => void;
  sourceLanguageOptions: Array<{ value: string; label: string }>;
  recognizeTextValue: string;
  segmentTextValue: string;
  cleanImageValue: string;
  cleanerAiModelKey: string;
  cleanerAiModelOptions: AioStageOption[];
  availableOcrStageOptions: any[];
  availableSegmentStageOptions: any[];
  availableCleanStageOptions: any[];
  selectedOcrCloudOption: any;
  selectedSegmentModel: any;
  selectedCleanModel: any;
  selectedCleanerAiOption: AioStageOption | null;
  selectedOcrStatusText: string | null;
  selectedSegmentStatusText: string | null;
  selectedCleanStatusText: string | null;
  formatAioStageOptionLabel: (option: any) => string;
  setRecognizeTextModel: (modelKey: string) => void;
  selectSegmentTextModel: (modelKey: string) => void;
  selectCleanImageModel: (modelKey: string) => void;
  selectCleanerAiModel: (modelKey: string) => void;
  openRecognizeTextManager: () => void;
  openSegmentTextManager: () => void;
  openCleanImageManager: () => void;
  openCleanerAiModelManager: () => void;
  localApiUrl: string;
  aioMaskDilation: number;
  setAioMaskDilation: (value: number) => void;
  aioHdStrategy: 'original' | 'resize' | 'crop';
  setAioHdStrategy: (value: 'original' | 'resize' | 'crop') => void;
  aioHdResizeLimit: number;
  setAioHdResizeLimit: (value: number) => void;
  aioHdCropMargin: number;
  setAioHdCropMargin: (value: number) => void;
  aioHdCropTriggerSize: number;
  setAioHdCropTriggerSize: (value: number) => void;
  cleanerAiAdditionalInstructions: string;
  setCleanerAiAdditionalInstructions: (value: string) => void;
  activeCleanerRunMeta: {
    ocrCount: number;
    segmentedCount: number;
    candidateCount?: number;
    approvedCount?: number;
    reviewCount?: number;
  } | null;
  activeCleanerSelectedRegion: {
    id: string;
    recognizedText?: string;
    mergedSegmentBoxes?: unknown[];
    segmentBoxes?: unknown[];
  } | null;
  processing: boolean;
  imagesCount: number;
  progress: number;
  handleClean: () => void;
}

const renderModeToggle = (
  cleanerMode: CleanerMode,
  setCleanerMode: (value: CleanerMode) => void,
  t: (key: any) => string,
) => (
  <div className="koma-submode-toggle">
    <button
      type="button"
      className={`koma-submode-toggle__btn${cleanerMode === 'assisted' ? ' koma-submode-toggle__btn--active' : ''}`}
      onClick={() => setCleanerMode('assisted')}
      title={t('dashboard.cleaner.mode.assistedTitle')}
    >
      <Wrench size={12} />
      <span>{t('dashboard.cleaner.mode.assisted')}</span>
    </button>
    <button
      type="button"
      className={`koma-submode-toggle__btn${cleanerMode === 'automatic_ai' ? ' koma-submode-toggle__btn--active' : ''}`}
      onClick={() => setCleanerMode('automatic_ai')}
      title={t('dashboard.cleaner.mode.automaticAiTitle')}
    >
      <Sparkles size={12} />
      <span>{t('dashboard.cleaner.mode.automaticAi')}</span>
    </button>
    <button
      type="button"
      className={`koma-submode-toggle__btn${cleanerMode === 'ai_sfx' ? ' koma-submode-toggle__btn--active' : ''}`}
      onClick={() => setCleanerMode('ai_sfx')}
      title={t('dashboard.cleaner.mode.aiSfxTitle')}
    >
      <Sparkles size={12} />
      <span>{t('dashboard.cleaner.mode.aiSfx')}</span>
    </button>
  </div>
);

export default function CleanerToolsPanel({
  cleanerMode,
  setCleanerMode,
  cleanerSrcLang,
  setCleanerSrcLang,
  sourceLanguageOptions,
  recognizeTextValue,
  segmentTextValue,
  cleanImageValue,
  cleanerAiModelKey,
  cleanerAiModelOptions,
  availableOcrStageOptions,
  availableSegmentStageOptions,
  availableCleanStageOptions,
  selectedOcrCloudOption,
  selectedSegmentModel,
  selectedCleanModel,
  selectedCleanerAiOption,
  selectedOcrStatusText,
  selectedSegmentStatusText,
  selectedCleanStatusText,
  formatAioStageOptionLabel,
  setRecognizeTextModel,
  selectSegmentTextModel,
  selectCleanImageModel,
  selectCleanerAiModel,
  openRecognizeTextManager,
  openSegmentTextManager,
  openCleanImageManager,
  openCleanerAiModelManager,
  localApiUrl,
  aioMaskDilation,
  setAioMaskDilation,
  aioHdStrategy,
  setAioHdStrategy,
  aioHdResizeLimit,
  setAioHdResizeLimit,
  aioHdCropMargin,
  setAioHdCropMargin,
  aioHdCropTriggerSize,
  setAioHdCropTriggerSize,
  cleanerAiAdditionalInstructions,
  setCleanerAiAdditionalInstructions,
  activeCleanerRunMeta,
  activeCleanerSelectedRegion,
  processing,
  imagesCount,
  progress,
  handleClean,
}: CleanerToolsPanelProps) {
  const { t } = useI18n();
  const isAutomaticAi = cleanerMode === 'automatic_ai';
  const isAiSfx = cleanerMode === 'ai_sfx';
  return (
    <>
      <div className="koma-mode-tools">
        <span className="koma-mode-tag" aria-hidden="true">
          <span className="koma-mode-tag__dot" />
          {t('dashboard.cleaner.modeTag')}
        </span>

        <AioSection icon={Eraser} title={t('dashboard.cleaner.mode.title')} defaultOpen={true}>
          <p className="koma-tools-hint" dangerouslySetInnerHTML={{ __html: t('dashboard.cleaner.mode.hint') }} />
          {renderModeToggle(cleanerMode, setCleanerMode, t)}
        </AioSection>

        {!isAutomaticAi && !isAiSfx ? (
          <>
            <AioSection icon={Eraser} title={t('dashboard.cleaner.pipeline.title')}>
              <p className="koma-tools-hint">
                {t('dashboard.cleaner.pipeline.hint')}
              </p>

              <div className="koma-field">
                <label className="koma-field__label">{t('dashboard.cleaner.ocr.language')}</label>
                <select
                  value={cleanerSrcLang}
                  onChange={(e) => setCleanerSrcLang(e.target.value)}
                  className="koma-select"
                  aria-label={t('dashboard.cleaner.ocr.languageAria')}
                >
                  {sourceLanguageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label as any)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="koma-model-slot">
                <div className="koma-model-slot__head">
                  <span className="koma-model-slot__title">
                    <span
                      className="koma-model-slot__title-icon"
                      aria-hidden="true"
                    >
                      <Eye size={10} />
                    </span>
                    {t('dashboard.cleaner.ocr.label')}
                  </span>
                  <button
                    type="button"
                    className="koma-model-slot__manage"
                    onClick={openRecognizeTextManager}
                    aria-label={t('dashboard.cleaner.ocr.manageAria')}
                  >
                    <HardDrive size={9} /> {t('dashboard.cleaner.models.button')}
                  </button>
                </div>
                <select
                  value={
                    availableOcrStageOptions.some(
                      (option) => option.key === recognizeTextValue,
                    )
                      ? recognizeTextValue
                      : ''
                  }
                  onChange={(event) => setRecognizeTextModel(event.target.value)}
                  className="koma-select"
                  disabled={availableOcrStageOptions.length === 0}
                  aria-label={t('dashboard.cleaner.ocr.modelAria')}
                >
                  {availableOcrStageOptions.length === 0 ? (
                    <option value="" disabled>
                      {t('dashboard.cleaner.models.none')}
                    </option>
                  ) : (
                    availableOcrStageOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {formatAioStageOptionLabel(opt)}
                      </option>
                    ))
                  )}
                </select>
                {selectedOcrCloudOption && (
                  <span className="koma-model-slot__meta">
                    {selectedOcrCloudOption.device ?? '—'}
                  </span>
                )}
                {selectedOcrStatusText && (
                  <p className="koma-tools-hint">{selectedOcrStatusText}</p>
                )}
              </div>

              <div className="koma-model-slot">
                <div className="koma-model-slot__head">
                  <span className="koma-model-slot__title">
                    <span
                      className="koma-model-slot__title-icon"
                      aria-hidden="true"
                    >
                      <Replace size={10} />
                    </span>
                    {t('dashboard.cleaner.segment.title')}
                  </span>
                  <button
                    type="button"
                    className="koma-model-slot__manage"
                    onClick={openSegmentTextManager}
                    aria-label={t('dashboard.cleaner.segment.manageAria')}
                  >
                    <HardDrive size={9} /> {t('dashboard.cleaner.models.button')}
                  </button>
                </div>
                <select
                  value={
                    availableSegmentStageOptions.some(
                      (option) => option.key === segmentTextValue,
                    )
                      ? segmentTextValue
                      : ''
                  }
                  onChange={(event) =>
                    selectSegmentTextModel(event.target.value)
                  }
                  className="koma-select"
                  disabled={availableSegmentStageOptions.length === 0}
                  aria-label={t('dashboard.cleaner.segment.modelAria')}
                >
                  {availableSegmentStageOptions.length === 0 ? (
                    <option value="" disabled>
                      {t('dashboard.cleaner.models.none')}
                    </option>
                  ) : (
                    availableSegmentStageOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {formatAioStageOptionLabel(opt)}
                      </option>
                    ))
                  )}
                </select>
                {selectedSegmentModel && (
                  <span className="koma-model-slot__meta">
                    {selectedSegmentModel.device ?? '—'}
                  </span>
                )}
                {selectedSegmentStatusText && (
                  <p className="koma-tools-hint">{selectedSegmentStatusText}</p>
                )}
              </div>

              <div className="koma-model-slot">
                <div className="koma-model-slot__head">
                  <span className="koma-model-slot__title">
                    <span
                      className="koma-model-slot__title-icon"
                      aria-hidden="true"
                    >
                      <Eraser size={10} />
                    </span>
                    {t('dashboard.cleaner.clean.title')}
                  </span>
                  <button
                    type="button"
                    className="koma-model-slot__manage"
                    onClick={openCleanImageManager}
                    aria-label={t('dashboard.cleaner.clean.manageAria')}
                  >
                    <HardDrive size={9} /> {t('dashboard.cleaner.models.button')}
                  </button>
                </div>
                <select
                  value={
                    availableCleanStageOptions.some(
                      (option) => option.key === cleanImageValue,
                    )
                      ? cleanImageValue
                      : ''
                  }
                  onChange={(event) =>
                    selectCleanImageModel(event.target.value)
                  }
                  className="koma-select"
                  disabled={availableCleanStageOptions.length === 0}
                  aria-label={t('dashboard.cleaner.clean.modelAria')}
                >
                  {availableCleanStageOptions.length === 0 ? (
                    <option value="" disabled>
                      {t('dashboard.cleaner.models.none')}
                    </option>
                  ) : (
                    availableCleanStageOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {formatAioStageOptionLabel(opt)}
                      </option>
                    ))
                  )}
                </select>
                {selectedCleanModel && (
                  <span className="koma-model-slot__meta">
                    {selectedCleanModel.device ?? '—'}
                  </span>
                )}
                {selectedCleanStatusText && (
                  <p className="koma-tools-hint">{selectedCleanStatusText}</p>
                )}
              </div>

              <span className="koma-backend-chip">
                <span className="koma-backend-chip__dot" aria-hidden="true" />
                {localApiUrl}
              </span>
            </AioSection>

            <AioSection icon={Wrench} title={t('dashboard.cleaner.settings.title')} defaultOpen={true}>
              <KlSlider
                label={t('dashboard.cleaner.settings.maskDilation')}
                value={aioMaskDilation}
                min={0}
                max={50}
                step={1}
                onChange={setAioMaskDilation}
                resetVal={5}
              />

              <div className="koma-hd-strategy">
                <label className="koma-field__label">{t('dashboard.cleaner.settings.hdStrategy')}</label>
                <select
                  value={aioHdStrategy}
                  onChange={(e) =>
                    setAioHdStrategy(
                      e.target.value as 'original' | 'resize' | 'crop',
                    )
                  }
                  className="koma-select"
                >
                  <option value="resize">{t('dashboard.aio.clean.hdStrategy.resize')}</option>
                  <option value="crop">{t('dashboard.aio.clean.hdStrategy.crop')}</option>
                  <option value="original">{t('dashboard.aio.clean.hdStrategy.original')}</option>
                </select>
              </div>

              {aioHdStrategy === 'resize' && (
                <KlSlider
                  label={t('dashboard.cleaner.settings.resizeLimit')}
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
                    label={t('dashboard.cleaner.settings.cropMargin')}
                    value={aioHdCropMargin}
                    min={0}
                    max={3000}
                    step={1}
                    onChange={setAioHdCropMargin}
                    resetVal={512}
                  />
                  <KlSlider
                    label={t('dashboard.cleaner.settings.cropTrigger')}
                    value={aioHdCropTriggerSize}
                    min={64}
                    max={3000}
                    step={1}
                    onChange={setAioHdCropTriggerSize}
                    resetVal={512}
                  />
                </>
              )}
            </AioSection>

            <AioSection icon={Box} title={t('dashboard.cleaner.inspect.title')} defaultOpen={false}>
              <div className="koma-cleaner-stats">
                <div className="koma-cleaner-stat">
                  <span className="koma-cleaner-stat__value">
                    {activeCleanerRunMeta ? activeCleanerRunMeta.ocrCount : 0}
                  </span>
                  <span className="koma-cleaner-stat__label">{t('dashboard.cleaner.inspect.ocrBlocks')}</span>
                </div>
                <div className="koma-cleaner-stat">
                  <span className="koma-cleaner-stat__value">
                    {activeCleanerRunMeta
                      ? activeCleanerRunMeta.segmentedCount
                      : 0}
                  </span>
                  <span className="koma-cleaner-stat__label">{t('dashboard.cleaner.inspect.segmented')}</span>
                </div>
              </div>

              <div className="koma-region-inspect">
                <span className="koma-region-inspect__key">{t('dashboard.cleaner.inspect.selection')}</span>
                <span
                  className={cn(
                    'koma-region-inspect__val',
                    !activeCleanerSelectedRegion &&
                      'koma-region-inspect__val--muted',
                  )}
                >
                  {activeCleanerSelectedRegion
                    ? activeCleanerSelectedRegion.id
                    : t('dashboard.cleaner.inspect.none')}
                </span>

                {activeCleanerSelectedRegion && (
                  <>
                    <span className="koma-region-inspect__key">{t('dashboard.cleaner.inspect.ocr')}</span>
                    <span
                      className={cn(
                        'koma-region-inspect__val',
                        !activeCleanerSelectedRegion.recognizedText &&
                          'koma-region-inspect__val--muted',
                      )}
                    >
                      {activeCleanerSelectedRegion.recognizedText
                        ? `"${activeCleanerSelectedRegion.recognizedText.slice(0, 80)}"`
                        : '—'}
                    </span>

                    <span className="koma-region-inspect__key">{t('dashboard.cleaner.inspect.segments')}</span>
                    <span className="koma-region-inspect__val koma-region-inspect__val--mono">
                      {t('dashboard.cleaner.inspect.boxesCount', {
                        count: activeCleanerSelectedRegion.mergedSegmentBoxes?.length ??
                          activeCleanerSelectedRegion.segmentBoxes?.length ??
                          0
                      })}
                    </span>
                  </>
                )}
              </div>
            </AioSection>
          </>
        ) : (
          <AioSection icon={Wand2} title={isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean')} defaultOpen={true}>
            <p className="koma-tools-hint">
              {isAiSfx
                ? t('dashboard.cleaner.ai.sfxDesc')
                : t('dashboard.cleaner.ai.automaticDesc')}
            </p>

            <div className="koma-model-slot">
              <div className="koma-model-slot__head">
                <span className="koma-model-slot__title">
                  <span
                    className="koma-model-slot__title-icon"
                    aria-hidden="true"
                  >
                    <Sparkles size={10} />
                  </span>
                  {t('dashboard.cleaner.ai.modelTitle')}
                </span>
                <button
                  type="button"
                  className="koma-model-slot__manage"
                  onClick={openCleanerAiModelManager}
                  aria-label={t('dashboard.cleaner.ai.manageAria', {
                    value: isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean')
                  })}
                >
                  <HardDrive size={9} /> {t('dashboard.cleaner.models.button')}
                </button>
              </div>
              <select
                value={
                  cleanerAiModelOptions.some(
                    (option) => option.key === cleanerAiModelKey,
                  )
                    ? cleanerAiModelKey
                    : ''
                }
                onChange={(event) => selectCleanerAiModel(event.target.value)}
                className="koma-select"
                disabled={cleanerAiModelOptions.length === 0}
                aria-label={t('dashboard.cleaner.ai.modelAria', {
                  value: isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean')
                })}
              >
                {cleanerAiModelOptions.length === 0 ? (
                  <option value="" disabled>
                    {t('dashboard.cleaner.ai.noneAvailable')}
                  </option>
                ) : (
                  cleanerAiModelOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {formatAioStageOptionLabel(option)}
                    </option>
                  ))
                )}
              </select>
              {selectedCleanerAiOption && (
                <span className="koma-model-slot__meta">
                  {selectedCleanerAiOption.provider_name ?? t('dashboard.cleaner.ai.defaultProvider')}
                  <span
                    className="koma-model-slot__meta-dot"
                    aria-hidden="true"
                  />
                  {selectedCleanerAiOption.device}
                </span>
              )}
              {selectedCleanerAiOption?.use_case ? (
                <p className="koma-tools-hint">
                  {selectedCleanerAiOption.use_case}
                </p>
              ) : null}
            </div>

            <div className="koma-field">
              <label className="koma-field__label">
                {t('dashboard.cleaner.instructions.title')}
              </label>
              <textarea
                value={cleanerAiAdditionalInstructions}
                onChange={(event) =>
                  setCleanerAiAdditionalInstructions(event.target.value)
                }
                className="koma-input"
                rows={5}
                placeholder={t('dashboard.cleaner.instructions.placeholder')}
              />
              <p className="koma-tools-hint">
                {isAiSfx
                  ? t('dashboard.cleaner.instructions.hintSfx')
                  : t('dashboard.cleaner.instructions.hintAi')}
              </p>
            </div>
            {isAiSfx && activeCleanerRunMeta && (
              <div className="koma-cleaner-stats" style={{ marginTop: 10 }}>
                <div className="koma-cleaner-stat">
                  <span className="koma-cleaner-stat__value">
                    {activeCleanerRunMeta.candidateCount ?? 0}
                  </span>
                  <span className="koma-cleaner-stat__label">{t('dashboard.cleaner.stats.candidates')}</span>
                </div>
                <div className="koma-cleaner-stat">
                  <span className="koma-cleaner-stat__value">
                    {activeCleanerRunMeta.approvedCount ?? 0}
                  </span>
                  <span className="koma-cleaner-stat__label">{t('dashboard.cleaner.stats.sfxApproved')}</span>
                </div>
                <div className="koma-cleaner-stat">
                  <span className="koma-cleaner-stat__value">
                    {activeCleanerRunMeta.reviewCount ?? 0}
                  </span>
                  <span className="koma-cleaner-stat__label">{t('dashboard.cleaner.stats.redraw')}</span>
                </div>
              </div>
            )}
          </AioSection>
        )}

        <div className="koma-execute-bar">
          <button
            type="button"
            className={cn(
              'koma-execute-bar__btn',
              processing && 'koma-execute-bar__btn--processing',
            )}
            disabled={processing || imagesCount === 0}
            onClick={handleClean}
            aria-busy={processing}
          >
            {processing ? (
              <>
                <span
                  className="auth-spinner"
                  style={{ width: 14, height: 14 }}
                />
                {t('dashboard.cleaner.action.processing', {
                  value: isAutomaticAi || isAiSfx
                    ? (isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean'))
                    : t('dashboard.cleaner.modeTag'),
                  percent: Math.round(progress)
                })}
              </>
            ) : (
              <>
                <RefreshCcw size={14} />
                {isAutomaticAi || isAiSfx
                  ? (isAiSfx
                    ? t('dashboard.cleaner.action.runAiSfx')
                    : t('dashboard.cleaner.action.runAutomatic'))
                  : t('dashboard.cleaner.action.runAssisted')}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
