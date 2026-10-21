'use client';

import React from 'react';
import {
  ArrowRight, Box, Eye, FolderOpen, Languages, RefreshCcw,
  Settings, Sliders, Sparkles, Upload, Zap,
} from 'lucide-react';

import TranslationModelControl from '../../AioStageModelControls/TranslationModelControl';

import KlSlider from '../KlSlider';
import { useI18n } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/messages';
import { AioSection } from '../../../pages/AioSection';
import { TranslatorWorkspaceToggle } from '../../../pages/TranslatorWorkspaceToggle';
import {
  ModeTag, Hint, Check, ModelSlot, SegToggle, InspectRow,
} from '../../noir-panels/NoirPrimitives';

interface TranslatorToolsPanelProps {
  translatorWorkspaceMode: 'text' | 'visual';
  setTranslatorWorkspaceMode: (value: 'text' | 'visual') => void;
  translatorVisualProcessingMode: 'standard' | 'ai_sfx';
  setTranslatorVisualProcessingMode: (value: 'standard' | 'ai_sfx') => void;
  srcLang: string; setSrcLang: (v: string) => void;
  tgtLang: string; setTgtLang: (v: string) => void;
  sourceLanguageOptions: Array<{ value: string; label: TranslationKey }>;
  targetLanguageOptions: Array<{ value: string; label: TranslationKey }>;
  aioRecognizeTextValue: string;
  translatorAvailableOcrStageOptions: any[];
  selectedTranslatorOcrCloudOption: any;
  selectedOcrStatusText: string;
  formatAioStageOptionLabel: (o: any) => string;
  setAioRecognizeTextModel: (k: string) => void;
  openRecognizeTextManager: () => void;
  translationSelectedModelId: string;
  modelUserTier?: string;
  modelEntries: Record<string, unknown>;
  availableTranslationStageOptions: any[];
  installedCount: number;
  updatesCount: number;
  setTranslationModel: (id: string) => void;
  openTranslationManager: (args?: { language?: string; focusedModelId?: string | null }) => void;
  translationSelectedSummary: string;
  translationSupportSummary: string;
  translatorSfxCleanModelKey: string;
  translatorSfxCleanModelOptions: any[];
  selectedTranslatorSfxCleanOption: any;
  selectTranslatorSfxCleanModel: (k: string) => void;
  translatorSfxAdditionalInstructions: string;
  setTranslatorSfxAdditionalInstructions: (v: string) => void;
  showLlmSettingsPanel: boolean;
  llmSettings: { extra_context: string; translation_notes_enabled: boolean; image_input_enabled: boolean; temperature: number; top_p: number; max_tokens: number };
  setLlmSettings: (updater: (prev: any) => any) => void;
  clampLlmRequestSettings: (next: any) => any;
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  translatorImageImportRef: React.RefObject<HTMLInputElement | null>;
  translatorDraftText: string;
  translatorTranslatedText: string;
  translatorTextRunning: boolean;
  processing: boolean;
  imagesCount: number;
  hasQuotaForCurrentBatch?: boolean;
  quotaLimitButtonTitle?: string;
  runTranslatorText: () => Promise<void> | void;
  processTranslatorVisual: () => Promise<void> | void;
  handleTranslatorTextImport: React.ChangeEventHandler<HTMLInputElement>;
  handleTranslatorImageUpload: React.ChangeEventHandler<HTMLInputElement>;
  activeId: string | null;
  activeTranslatorImageDetectionsCount: number;
  activeTranslatorSelectedRegion: { id: string; recognizedText?: string; translatedText?: string } | null;
  activeTranslatorSelectedTranslationNotes: string[];
  retranslateTranslatorRegions: (imageId: string, regionIds?: string[]) => Promise<void> | void;
}

export default function TranslatorToolsPanel(props: TranslatorToolsPanelProps) {
  const {
    translatorWorkspaceMode, setTranslatorWorkspaceMode, translatorVisualProcessingMode, setTranslatorVisualProcessingMode,
    srcLang, setSrcLang, tgtLang, setTgtLang, sourceLanguageOptions, targetLanguageOptions,
    aioRecognizeTextValue, translatorAvailableOcrStageOptions, selectedTranslatorOcrCloudOption, selectedOcrStatusText,
    formatAioStageOptionLabel, setAioRecognizeTextModel, openRecognizeTextManager, translationSelectedModelId,
    modelEntries, availableTranslationStageOptions, installedCount, updatesCount, setTranslationModel,
    openTranslationManager, translationSelectedSummary, translationSupportSummary, translatorSfxCleanModelKey,
    translatorSfxCleanModelOptions, selectedTranslatorSfxCleanOption, selectTranslatorSfxCleanModel,
    translatorSfxAdditionalInstructions, setTranslatorSfxAdditionalInstructions, showLlmSettingsPanel, llmSettings,
    setLlmSettings, clampLlmRequestSettings, translatorTextImportRef, translatorImageImportRef, translatorDraftText,
    translatorTranslatedText, translatorTextRunning, processing, imagesCount, hasQuotaForCurrentBatch = true,
    quotaLimitButtonTitle = '', runTranslatorText, processTranslatorVisual, handleTranslatorTextImport,
    handleTranslatorImageUpload, activeId, activeTranslatorImageDetectionsCount, activeTranslatorSelectedRegion,
    activeTranslatorSelectedTranslationNotes, retranslateTranslatorRegions,
  } = props;

  const { t } = useI18n();
  const isVisualSfxMode = translatorWorkspaceMode === 'visual' && translatorVisualProcessingMode === 'ai_sfx';
  const selectVal = (opts: any[], v: string) => (opts.some((o) => o.key === v) ? v : '');

  return (
    <div className="font-display text-paper">
      <ModeTag>{t('dashboard.translator.modeLabel')}</ModeTag>

      {/* ── WORKSPACE ── */}
      <AioSection icon={Languages} title={t('dashboard.translator.modeLabel')}>
        <Hint>{translatorWorkspaceMode === 'text' ? t('dashboard.translator.workspace.textHint') : t('dashboard.translator.workspace.visualHint')}</Hint>
        <TranslatorWorkspaceToggle value={translatorWorkspaceMode} onChange={setTranslatorWorkspaceMode} />

        {translatorWorkspaceMode === 'visual' && (
          <SegToggle
            ariaLabel="visual-processing"
            value={translatorVisualProcessingMode}
            onChange={(v: string) => setTranslatorVisualProcessingMode(v as 'standard' | 'ai_sfx')}
            items={[
              { key: 'standard', label: t('dashboard.translator.processing.standard') },
              { key: 'ai_sfx', label: t('dashboard.translator.processing.aiSfx'), icon: Sparkles },
            ]}
          />
        )}

        {/* Language pair */}
        <div className="flex items-center gap-2">
          <select value={srcLang} onChange={(e) => setSrcLang(e.target.value)} className="noir-select panel-cut-sm" aria-label={t('dashboard.language.source')}>
            {sourceLanguageOptions.map((opt) => (<option key={opt.value} value={opt.value}>{t(opt.label)}</option>))}
          </select>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-crimson/12 text-crimson panel-cut-sm" aria-hidden="true"><ArrowRight size={11} /></span>
          <select value={tgtLang} onChange={(e) => setTgtLang(e.target.value)} className="noir-select panel-cut-sm" aria-label={t('dashboard.language.target')}>
            {targetLanguageOptions.map((opt) => (<option key={opt.value} value={opt.value}>{t(opt.label)}</option>))}
          </select>
        </div>
      </AioSection>

      {/* ── MODELS ── */}
      <AioSection icon={Settings} title={t('dashboard.models.title')} defaultOpen>
        {translatorWorkspaceMode === 'visual' && (
          <ModelSlot icon={Eye} title={t('dashboard.translator.ocr')} onManage={openRecognizeTextManager} manageLabel={t('aio.model.manage')}>
            <select value={selectVal(translatorAvailableOcrStageOptions, aioRecognizeTextValue)} onChange={(e) => setAioRecognizeTextModel(e.target.value)} className="noir-select panel-cut-sm" disabled={translatorAvailableOcrStageOptions.length === 0} aria-label={t('dashboard.translator.ocr')}>
              {translatorAvailableOcrStageOptions.length === 0 ? <option value="" disabled>{t('dashboard.translator.noneAvailable')}</option> : translatorAvailableOcrStageOptions.map((opt) => (<option key={opt.key} value={opt.key}>{formatAioStageOptionLabel(opt)}</option>))}
            </select>
            {selectedTranslatorOcrCloudOption && (
              <div className="space-y-1 pt-1">
                <Hint>{t('dashboard.translator.tier')}: {selectedTranslatorOcrCloudOption?.tier.join(', ') ?? '-'} | {t('dashboard.translator.device')}: {selectedTranslatorOcrCloudOption?.device ?? '-'}</Hint>
                <Hint>{t('dashboard.translator.languages')}: {(selectedTranslatorOcrCloudOption?.languages ?? []).join(', ') || t('dashboard.translator.multi')}</Hint>
                <Hint>{selectedTranslatorOcrCloudOption?.use_case ?? t('dashboard.translator.noDescription')}</Hint>
                {selectedOcrStatusText ? <Hint tone="mint">{t('dashboard.translator.localStatus', { value: selectedOcrStatusText })}</Hint> : null}
              </div>
            )}
          </ModelSlot>
        )}

        <TranslationModelControl
          selectedModelId={translationSelectedModelId} sourceLanguage={srcLang} targetLanguage={tgtLang}
          entries={modelEntries as any} legacyOptions={availableTranslationStageOptions as any}
          installedCount={installedCount} updatesCount={updatesCount} onSelectModel={setTranslationModel}
          onOpenManager={openTranslationManager} selectedSummary={translationSelectedSummary} supportSummary={translationSupportSummary}
        />

        {isVisualSfxMode && (
          <ModelSlot icon={Sparkles} title={t('dashboard.translator.sfx.cleanModel')}
            hint={selectedTranslatorSfxCleanOption?.use_case ?? undefined}>
            <select value={selectVal(translatorSfxCleanModelOptions, translatorSfxCleanModelKey)} onChange={(e) => selectTranslatorSfxCleanModel(e.target.value)} className="noir-select panel-cut-sm" disabled={translatorSfxCleanModelOptions.length === 0} aria-label={t('dashboard.translator.sfx.cleanModel')}>
              {translatorSfxCleanModelOptions.length === 0 ? <option value="" disabled>{t('dashboard.translator.noneAvailable')}</option> : translatorSfxCleanModelOptions.map((o) => (<option key={o.key} value={o.key}>{formatAioStageOptionLabel(o)}</option>))}
            </select>
            <textarea value={translatorSfxAdditionalInstructions} onChange={(e) => setTranslatorSfxAdditionalInstructions(e.target.value)} className="noir-textarea panel-cut-sm mt-2" rows={3} placeholder={t('dashboard.translator.sfx.hint')} />
          </ModelSlot>
        )}
      </AioSection>

      {/* ── LLM SETTINGS ── */}
      {showLlmSettingsPanel && (
        <AioSection icon={Sliders} title={t('dashboard.aio.customAi.title')} defaultOpen={false}>
          <textarea value={llmSettings.extra_context} onChange={(e) => setLlmSettings((prev) => clampLlmRequestSettings({ ...prev, extra_context: e.target.value }))} className="noir-textarea panel-cut-sm" rows={3} placeholder={t('dashboard.translator.llm.contextPlaceholder')} />
          <div className="space-y-1.5">
            <Check label={t('dashboard.translator.llm.generateNotes')} checked={llmSettings.translation_notes_enabled} onChange={(v: boolean) => setLlmSettings((prev) => clampLlmRequestSettings({ ...prev, translation_notes_enabled: v }))} />
            <Check label={t('dashboard.translator.llm.multimodalContext')} checked={llmSettings.image_input_enabled} onChange={(v: boolean) => setLlmSettings((prev) => clampLlmRequestSettings({ ...prev, image_input_enabled: v }))} />
          </div>
          <div className="space-y-2">
            <KlSlider label={t('dashboard.translator.llm.temperature')} value={llmSettings.temperature} min={0} max={2} step={0.05} onChange={(v: number) => setLlmSettings((prev) => clampLlmRequestSettings({ ...prev, temperature: v }))} resetVal={0.2} />
            <KlSlider label={t('dashboard.translator.llm.topP')} value={llmSettings.top_p} min={0} max={1} step={0.01} onChange={(v: number) => setLlmSettings((prev) => clampLlmRequestSettings({ ...prev, top_p: v }))} resetVal={0.95} />
            <KlSlider label={t('dashboard.translator.llm.maxTokens')} value={llmSettings.max_tokens} min={128} max={8192} step={64} onChange={(v: number) => setLlmSettings((prev) => clampLlmRequestSettings({ ...prev, max_tokens: v }))} resetVal={4096} />
          </div>
        </AioSection>
      )}

      {/* ── ACTIONS ── */}
      <AioSection icon={Zap} title={t('dashboard.translator.execute.title')}>
        {translatorWorkspaceMode === 'text' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost panel-cut-sm" onClick={() => translatorTextImportRef.current?.click()}><FolderOpen size={12} /> {t('dashboard.translator.import')}</button>
              <button type="button" className="btn-primary panel-cut-sm" disabled={processing || translatorDraftText.trim().length === 0} onClick={() => void runTranslatorText()} aria-busy={translatorTextRunning}>
                {translatorTextRunning ? (<><span className="auth-spinner" style={{ width: 12, height: 12 }} /> {t('dashboard.translator.translating')}</>) : (<><Languages size={12} /> {t('dashboard.translator.translate')}</>)}
              </button>
            </div>
            <Hint tone={translatorTranslatedText.trim().length > 0 ? 'mint' : 'dim'}>{translatorTranslatedText.trim().length > 0 ? t('dashboard.translator.charactersTranslated', { count: translatorTranslatedText.length }) : t('dashboard.translator.noTranslation')}</Hint>
            <input ref={translatorTextImportRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={handleTranslatorTextImport} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost panel-cut-sm" onClick={() => translatorImageImportRef.current?.click()}><Upload size={12} /> {t('dashboard.translator.loadImage')}</button>
              <button type="button" className="btn-primary panel-cut-sm" disabled={processing || imagesCount === 0 || !hasQuotaForCurrentBatch} title={quotaLimitButtonTitle} onClick={() => void processTranslatorVisual()} aria-busy={processing}>
                {processing ? (<><span className="auth-spinner" style={{ width: 12, height: 12 }} /> {t('dashboard.translator.processing.loading')}</>) : (<><Languages size={12} /> {t('dashboard.translator.detectTranslate')}</>)}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost panel-cut-sm" disabled={processing || !activeId || activeTranslatorImageDetectionsCount === 0} onClick={() => { if (activeId) void retranslateTranslatorRegions(activeId); }}><RefreshCcw size={11} /> {t('dashboard.translator.retranslateImage')}</button>
              <button type="button" className="btn-ghost panel-cut-sm" disabled={processing || !activeId || !activeTranslatorSelectedRegion} onClick={() => { if (activeId && activeTranslatorSelectedRegion) void retranslateTranslatorRegions(activeId, [activeTranslatorSelectedRegion.id]); }}><Sparkles size={11} /> {t('dashboard.translator.retranslateRegion')}</button>
            </div>
            <input ref={translatorImageImportRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden multiple onChange={handleTranslatorImageUpload} />
          </>
        )}
      </AioSection>

      {/* ── REGION INSPECTOR ── */}
      {translatorWorkspaceMode === 'visual' && (
        <AioSection icon={Box} title={t('dashboard.translator.regionTitle')} defaultOpen={!!activeTranslatorSelectedRegion}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <InspectRow mono k={t('dashboard.translator.blocks')} v={activeTranslatorImageDetectionsCount} />
            <InspectRow k={t('dashboard.translator.selection')} v={activeTranslatorSelectedRegion ? activeTranslatorSelectedRegion.id : t('dashboard.translator.none')} muted={!activeTranslatorSelectedRegion} />
            {activeTranslatorSelectedRegion && (
              <>
                <InspectRow k={t('dashboard.translator.ocr')} v={activeTranslatorSelectedRegion.recognizedText ? `"${activeTranslatorSelectedRegion.recognizedText.slice(0, 80)}"` : '—'} muted={!activeTranslatorSelectedRegion.recognizedText} />
                <InspectRow k={t('dashboard.translator.translation')} v={activeTranslatorSelectedRegion.translatedText ? `"${activeTranslatorSelectedRegion.translatedText.slice(0, 80)}"` : '—'} muted={!activeTranslatorSelectedRegion.translatedText} />
                {activeTranslatorSelectedTranslationNotes.length > 0 && <InspectRow k={t('dashboard.translator.notes')} v={activeTranslatorSelectedTranslationNotes.join(' | ')} />}
              </>
            )}
          </dl>
        </AioSection>
      )}
    </div>
  );
}
