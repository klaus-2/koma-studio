'use client';

import {
  Box, Eraser, Eye, RefreshCcw, Replace, Sparkles, Wand2, Wrench,
} from 'lucide-react';

import { AioSection } from '../../../pages/AioSection';
import KlSlider from '../KlSlider';
import { useI18n } from '../../../i18n';
import type { CleanerMode } from '@/types/dashboard.types';
import type { AioStageOption } from '@/models/aioStageCatalog';
import {
  ModeTag, Field, Hint, ModelSlot, MetaDot, SegToggle, InspectRow, StatCard,
  BackendChip, ExecuteButton,
} from '../../noir-panels/NoirPrimitives';

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
    ocrCount: number; segmentedCount: number;
    candidateCount?: number; approvedCount?: number; reviewCount?: number;
  } | null;
  activeCleanerSelectedRegion: {
    id: string; recognizedText?: string; mergedSegmentBoxes?: unknown[]; segmentBoxes?: unknown[];
  } | null;
  processing: boolean;
  imagesCount: number;
  hasQuotaForCurrentBatch: boolean;
  quotaLimitButtonTitle: string;
  progress: number;
  handleClean: () => void;
}

export default function CleanerToolsPanel(props: CleanerToolsPanelProps) {
  const {
    cleanerMode, setCleanerMode, cleanerSrcLang, setCleanerSrcLang, sourceLanguageOptions,
    recognizeTextValue, segmentTextValue, cleanImageValue, cleanerAiModelKey, cleanerAiModelOptions,
    availableOcrStageOptions, availableSegmentStageOptions, availableCleanStageOptions,
    selectedOcrCloudOption, selectedSegmentModel, selectedCleanModel, selectedCleanerAiOption,
    selectedOcrStatusText, selectedSegmentStatusText, selectedCleanStatusText, formatAioStageOptionLabel,
    setRecognizeTextModel, selectSegmentTextModel, selectCleanImageModel, selectCleanerAiModel,
    openRecognizeTextManager, openSegmentTextManager, openCleanImageManager, openCleanerAiModelManager,
    localApiUrl, aioMaskDilation, setAioMaskDilation, aioHdStrategy, setAioHdStrategy,
    aioHdResizeLimit, setAioHdResizeLimit, aioHdCropMargin, setAioHdCropMargin,
    aioHdCropTriggerSize, setAioHdCropTriggerSize, cleanerAiAdditionalInstructions,
    setCleanerAiAdditionalInstructions, activeCleanerRunMeta, activeCleanerSelectedRegion,
    processing, imagesCount, hasQuotaForCurrentBatch, quotaLimitButtonTitle, progress, handleClean,
  } = props;

  const { t } = useI18n();
  const isAutomaticAi = cleanerMode === 'automatic_ai';
  const isAiSfx = cleanerMode === 'ai_sfx';

  const selectVal = (opts: any[], v: string) => (opts.some((o) => o.key === v) ? v : '');

  return (
    <div className="font-display text-paper">
      <ModeTag>{t('dashboard.cleaner.modeTag')}</ModeTag>

      {/* ── MODE ── */}
      <AioSection icon={Eraser} title={t('dashboard.cleaner.mode.title')} defaultOpen>
        <Hint>
          <span dangerouslySetInnerHTML={{ __html: t('dashboard.cleaner.mode.hint') }} />
        </Hint>
        <SegToggle
          ariaLabel="cleaner-mode"
          value={cleanerMode}
          onChange={(v: string) => setCleanerMode(v as CleanerMode)}
          items={[
            { key: 'assisted', label: t('dashboard.cleaner.mode.assisted'), icon: Wrench, title: t('dashboard.cleaner.mode.assistedTitle') },
            { key: 'automatic_ai', label: t('dashboard.cleaner.mode.automaticAi'), icon: Sparkles, title: t('dashboard.cleaner.mode.automaticAiTitle') },
            { key: 'ai_sfx', label: t('dashboard.cleaner.mode.aiSfx'), icon: Sparkles, title: t('dashboard.cleaner.mode.aiSfxTitle') },
          ]}
        />
      </AioSection>

      {!isAutomaticAi && !isAiSfx ? (
        <>
          {/* ── PIPELINE ── */}
          <AioSection icon={Eraser} title={t('dashboard.cleaner.pipeline.title')}>
            <Hint>{t('dashboard.cleaner.pipeline.hint')}</Hint>

            <Field label={t('dashboard.cleaner.ocr.language')}>
              <select value={cleanerSrcLang} onChange={(e) => setCleanerSrcLang(e.target.value)} className="noir-select panel-cut-sm" aria-label={t('dashboard.cleaner.ocr.languageAria')}>
                {sourceLanguageOptions.map((opt) => (<option key={opt.value} value={opt.value}>{t(opt.label as any)}</option>))}
              </select>
            </Field>

            {/* OCR */}
            <ModelSlot icon={Eye} title={t('dashboard.cleaner.ocr.label')} onManage={openRecognizeTextManager} manageLabel={t('dashboard.cleaner.models.button')}
              meta={selectedOcrCloudOption && (<>{selectedOcrCloudOption.tier?.join(', ') ?? '—'}<MetaDot />{selectedOcrCloudOption.device ?? '—'}</>)}
              hint={selectedOcrStatusText}>
              <select value={selectVal(availableOcrStageOptions, recognizeTextValue)} onChange={(e) => setRecognizeTextModel(e.target.value)} className="noir-select panel-cut-sm" disabled={availableOcrStageOptions.length === 0} aria-label={t('dashboard.cleaner.ocr.modelAria')}>
                {availableOcrStageOptions.length === 0 ? <option value="" disabled>{t('dashboard.cleaner.models.none')}</option> : availableOcrStageOptions.map((opt) => (<option key={opt.key} value={opt.key}>{formatAioStageOptionLabel(opt)}</option>))}
              </select>
            </ModelSlot>

            {/* Segment */}
            <ModelSlot icon={Replace} title={t('dashboard.cleaner.segment.title')} onManage={openSegmentTextManager} manageLabel={t('dashboard.cleaner.models.button')}
              meta={selectedSegmentModel && (<>{selectedSegmentModel.tier?.join(', ') ?? '—'}<MetaDot />{selectedSegmentModel.device ?? '—'}</>)}
              hint={selectedSegmentStatusText}>
              <select value={selectVal(availableSegmentStageOptions, segmentTextValue)} onChange={(e) => selectSegmentTextModel(e.target.value)} className="noir-select panel-cut-sm" disabled={availableSegmentStageOptions.length === 0} aria-label={t('dashboard.cleaner.segment.modelAria')}>
                {availableSegmentStageOptions.length === 0 ? <option value="" disabled>{t('dashboard.cleaner.models.none')}</option> : availableSegmentStageOptions.map((opt) => (<option key={opt.key} value={opt.key}>{formatAioStageOptionLabel(opt)}</option>))}
              </select>
            </ModelSlot>

            {/* Clean */}
            <ModelSlot icon={Eraser} title={t('dashboard.cleaner.clean.title')} onManage={openCleanImageManager} manageLabel={t('dashboard.cleaner.models.button')}
              meta={selectedCleanModel && (<>{selectedCleanModel.tier?.join(', ') ?? '—'}<MetaDot />{selectedCleanModel.device ?? '—'}</>)}
              hint={selectedCleanStatusText}>
              <select value={selectVal(availableCleanStageOptions, cleanImageValue)} onChange={(e) => selectCleanImageModel(e.target.value)} className="noir-select panel-cut-sm" disabled={availableCleanStageOptions.length === 0} aria-label={t('dashboard.cleaner.clean.modelAria')}>
                {availableCleanStageOptions.length === 0 ? <option value="" disabled>{t('dashboard.cleaner.models.none')}</option> : availableCleanStageOptions.map((opt) => (<option key={opt.key} value={opt.key}>{formatAioStageOptionLabel(opt)}</option>))}
              </select>
            </ModelSlot>

            <BackendChip>{localApiUrl}</BackendChip>
          </AioSection>

          {/* ── SETTINGS ── */}
          <AioSection icon={Wrench} title={t('dashboard.cleaner.settings.title')} defaultOpen>
            <KlSlider label={t('dashboard.cleaner.settings.maskDilation')} value={aioMaskDilation} min={0} max={50} step={1} onChange={setAioMaskDilation} resetVal={5} />
            <Field label={t('dashboard.cleaner.settings.hdStrategy')}>
              <select value={aioHdStrategy} onChange={(e) => setAioHdStrategy(e.target.value as any)} className="noir-select panel-cut-sm">
                <option value="resize">{t('dashboard.aio.clean.hdStrategy.resize')}</option>
                <option value="crop">{t('dashboard.aio.clean.hdStrategy.crop')}</option>
                <option value="original">{t('dashboard.aio.clean.hdStrategy.original')}</option>
              </select>
            </Field>
            {aioHdStrategy === 'resize' && <KlSlider label={t('dashboard.cleaner.settings.resizeLimit')} value={aioHdResizeLimit} min={256} max={3000} step={1} onChange={setAioHdResizeLimit} resetVal={960} />}
            {aioHdStrategy === 'crop' && (
              <>
                <KlSlider label={t('dashboard.cleaner.settings.cropMargin')} value={aioHdCropMargin} min={0} max={3000} step={1} onChange={setAioHdCropMargin} resetVal={512} />
                <KlSlider label={t('dashboard.cleaner.settings.cropTrigger')} value={aioHdCropTriggerSize} min={64} max={3000} step={1} onChange={setAioHdCropTriggerSize} resetVal={512} />
              </>
            )}
          </AioSection>

          {/* ── INSPECT ── */}
          <AioSection icon={Box} title={t('dashboard.cleaner.inspect.title')} defaultOpen={false}>
            <div className="flex gap-2">
              <StatCard value={activeCleanerRunMeta ? activeCleanerRunMeta.ocrCount : 0} label={t('dashboard.cleaner.inspect.ocrBlocks')} />
              <StatCard value={activeCleanerRunMeta ? activeCleanerRunMeta.segmentedCount : 0} label={t('dashboard.cleaner.inspect.segmented')} tone="mint" />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <InspectRow k={t('dashboard.cleaner.inspect.selection')} v={activeCleanerSelectedRegion ? activeCleanerSelectedRegion.id : t('dashboard.cleaner.inspect.none')} muted={!activeCleanerSelectedRegion} />
              {activeCleanerSelectedRegion && (
                <>
                  <InspectRow k={t('dashboard.cleaner.inspect.ocr')} v={activeCleanerSelectedRegion.recognizedText ? `"${activeCleanerSelectedRegion.recognizedText.slice(0, 80)}"` : '—'} muted={!activeCleanerSelectedRegion.recognizedText} />
                  <InspectRow mono k={t('dashboard.cleaner.inspect.segments')} v={t('dashboard.cleaner.inspect.boxesCount', { count: activeCleanerSelectedRegion.mergedSegmentBoxes?.length ?? activeCleanerSelectedRegion.segmentBoxes?.length ?? 0 })} />
                </>
              )}
            </dl>
          </AioSection>
        </>
      ) : (
        /* ── AI MODES ── */
        <AioSection icon={Wand2} title={isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean')} defaultOpen>
          <Hint>{isAiSfx ? t('dashboard.cleaner.ai.sfxDesc') : t('dashboard.cleaner.ai.automaticDesc')}</Hint>

          <ModelSlot icon={Sparkles} title={t('dashboard.cleaner.ai.modelTitle')} onManage={openCleanerAiModelManager}
            manageLabel={t('dashboard.cleaner.models.button')}
            meta={selectedCleanerAiOption && (<>{selectedCleanerAiOption.provider_name ?? t('dashboard.cleaner.ai.defaultProvider')}<MetaDot />{selectedCleanerAiOption.device}</>)}
            hint={selectedCleanerAiOption?.use_case ?? undefined}>
            <select value={selectVal(cleanerAiModelOptions, cleanerAiModelKey)} onChange={(e) => selectCleanerAiModel(e.target.value)} className="noir-select panel-cut-sm" disabled={cleanerAiModelOptions.length === 0}
              aria-label={t('dashboard.cleaner.ai.modelAria', { value: isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean') })}>
              {cleanerAiModelOptions.length === 0 ? <option value="" disabled>{t('dashboard.cleaner.ai.noneAvailable')}</option> : cleanerAiModelOptions.map((o) => (<option key={o.key} value={o.key}>{formatAioStageOptionLabel(o)}</option>))}
            </select>
          </ModelSlot>

          <Field label={t('dashboard.cleaner.instructions.title')}>
            <textarea value={cleanerAiAdditionalInstructions} onChange={(e) => setCleanerAiAdditionalInstructions(e.target.value)} className="noir-textarea panel-cut-sm" rows={5} placeholder={t('dashboard.cleaner.instructions.placeholder')} />
            <Hint>{isAiSfx ? t('dashboard.cleaner.instructions.hintSfx') : t('dashboard.cleaner.instructions.hintAi')}</Hint>
          </Field>

          {isAiSfx && activeCleanerRunMeta && (
            <div className="flex gap-2">
              <StatCard value={activeCleanerRunMeta.candidateCount ?? 0} label={t('dashboard.cleaner.stats.candidates')} tone="gold" />
              <StatCard value={activeCleanerRunMeta.approvedCount ?? 0} label={t('dashboard.cleaner.stats.sfxApproved')} tone="mint" />
              <StatCard value={activeCleanerRunMeta.reviewCount ?? 0} label={t('dashboard.cleaner.stats.redraw')} />
            </div>
          )}
        </AioSection>
      )}

      {/* ── EXECUTE ── */}
      <div className="sticky bottom-0 z-10 border-t border-paper/8 bg-ink/90 py-3 backdrop-blur-md">
        <ExecuteButton processing={processing} disabled={processing || imagesCount === 0 || !hasQuotaForCurrentBatch} title={quotaLimitButtonTitle} onClick={handleClean} ariaBusy={processing}>
          {processing ? (
            <><span className="auth-spinner" style={{ width: 14, height: 14 }} />{t('dashboard.cleaner.action.processing', { value: isAutomaticAi || isAiSfx ? (isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean')) : t('dashboard.cleaner.modeTag'), percent: Math.round(progress) })}</>
          ) : (
            <><RefreshCcw size={14} />{isAutomaticAi || isAiSfx ? (isAiSfx ? t('dashboard.cleaner.action.runAiSfx') : t('dashboard.cleaner.action.runAutomatic')) : t('dashboard.cleaner.action.runAssisted')}</>
          )}
        </ExecuteButton>
      </div>
    </div>
  );
}
