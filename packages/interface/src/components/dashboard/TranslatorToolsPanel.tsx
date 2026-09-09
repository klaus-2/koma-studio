import React from 'react';
import {
  ArrowRight,
  Box,
  Eye,
  FolderOpen,
  HardDrive,
  Languages,
  RefreshCcw,
  Settings,
  Sliders,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';

import {
  TranslationModelControl,
} from '../AioStageModelControls';
import KlSlider from './KlSlider';
import { useI18n } from '../../i18n';

import { AioSection } from '../../pages/AioSection';
import { cn } from '../../utils/dashboard.utils';
import { TranslatorWorkspaceToggle } from '../../pages/TranslatorWorkspaceToggle';

interface TranslatorToolsPanelProps {
  translatorWorkspaceMode: 'text' | 'visual';
  setTranslatorWorkspaceMode: (value: 'text' | 'visual') => void;
  translatorVisualProcessingMode: 'standard' | 'ai_sfx';
  setTranslatorVisualProcessingMode: (value: 'standard' | 'ai_sfx') => void;
  srcLang: string;
  setSrcLang: (value: string) => void;
  tgtLang: string;
  setTgtLang: (value: string) => void;
  sourceLanguageOptions: Array<{ value: string; label: string }>;
  targetLanguageOptions: Array<{ value: string; label: string }>;
  aioRecognizeTextValue: string;
  translatorAvailableOcrStageOptions: any[];
  selectedTranslatorOcrCloudOption: any;
  selectedOcrStatusText: string;
  formatAioStageOptionLabel: (option: any) => string;
  setAioRecognizeTextModel: (modelKey: string) => void;
  openRecognizeTextManager: () => void;
  translationSelectedModelId: string;
  modelEntries: Record<string, unknown>;
  availableTranslationStageOptions: any[];
  installedCount: number;
  updatesCount: number;
  setTranslationModel: (modelId: string) => void;
  openTranslationManager: (args?: {
    language?: string;
    focusedModelId?: string | null;
  }) => void;
  translationSelectedSummary: string;
  translationSupportSummary: string;
  translatorSfxCleanModelKey: string;
  translatorSfxCleanModelOptions: any[];
  selectedTranslatorSfxCleanOption: any;
  selectTranslatorSfxCleanModel: (modelKey: string) => void;
  translatorSfxAdditionalInstructions: string;
  setTranslatorSfxAdditionalInstructions: (value: string) => void;
  showLlmSettingsPanel: boolean;
  llmSettings: {
    extra_context: string;
    translation_notes_enabled: boolean;
    image_input_enabled: boolean;
    temperature: number;
    top_p: number;
    max_tokens: number;
  };
  setLlmSettings: (updater: (prev: any) => any) => void;
  clampLlmRequestSettings: (next: any) => any;
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  translatorImageImportRef: React.RefObject<HTMLInputElement | null>;
  translatorDraftText: string;
  translatorTranslatedText: string;
  translatorTextRunning: boolean;
  processing: boolean;
  imagesCount: number;
  runTranslatorText: () => Promise<void> | void;
  processTranslatorVisual: () => Promise<void> | void;
  handleTranslatorTextImport: React.ChangeEventHandler<HTMLInputElement>;
  handleTranslatorImageUpload: React.ChangeEventHandler<HTMLInputElement>;
  activeId: string | null;
  activeTranslatorImageDetectionsCount: number;
  activeTranslatorSelectedRegion: {
    id: string;
    recognizedText?: string;
    translatedText?: string;
  } | null;
  activeTranslatorSelectedTranslationNotes: string[];
  retranslateTranslatorRegions: (
    imageId: string,
    regionIds?: string[],
  ) => Promise<void> | void;
}

export default function TranslatorToolsPanel({
  translatorWorkspaceMode,
  setTranslatorWorkspaceMode,
  translatorVisualProcessingMode,
  setTranslatorVisualProcessingMode,
  srcLang,
  setSrcLang,
  tgtLang,
  setTgtLang,
  sourceLanguageOptions,
  targetLanguageOptions,
  aioRecognizeTextValue,
  translatorAvailableOcrStageOptions,
  selectedTranslatorOcrCloudOption,
  selectedOcrStatusText,
  formatAioStageOptionLabel,
  setAioRecognizeTextModel,
  openRecognizeTextManager,
  translationSelectedModelId,
  modelEntries,
  availableTranslationStageOptions,
  installedCount,
  updatesCount,
  setTranslationModel,
  openTranslationManager,
  translationSelectedSummary,
  translationSupportSummary,
  translatorSfxCleanModelKey,
  translatorSfxCleanModelOptions,
  selectedTranslatorSfxCleanOption,
  selectTranslatorSfxCleanModel,
  translatorSfxAdditionalInstructions,
  setTranslatorSfxAdditionalInstructions,
  showLlmSettingsPanel,
  llmSettings,
  setLlmSettings,
  clampLlmRequestSettings,
  translatorTextImportRef,
  translatorImageImportRef,
  translatorDraftText,
  translatorTranslatedText,
  translatorTextRunning,
  processing,
  imagesCount,
  runTranslatorText,
  processTranslatorVisual,
  handleTranslatorTextImport,
  handleTranslatorImageUpload,
  activeId,
  activeTranslatorImageDetectionsCount,
  activeTranslatorSelectedRegion,
  activeTranslatorSelectedTranslationNotes,
  retranslateTranslatorRegions,
}: TranslatorToolsPanelProps) {
  const { t } = useI18n();
  const isVisualSfxMode =
    translatorWorkspaceMode === 'visual' &&
    translatorVisualProcessingMode === 'ai_sfx';
  return (
    <div className="koma-mode-tools">
      {/* Mode Tag */}
      <span className="koma-mode-tag" aria-hidden="true">
        <span className="koma-mode-tag__dot" />
        {t("dashboard.translator.modeLabel")}
      </span>

      {/* ═══ Workspace ═══ */}
      <AioSection icon={Languages} title={t("dashboard.translator.modeLabel")}>
        <p className="koma-tools-hint">
          {translatorWorkspaceMode === 'text'
            ? t("dashboard.translator.workspace.textHint")
            : t("dashboard.translator.workspace.visualHint")}
        </p>

        {/* Workspace Toggle */}
        <TranslatorWorkspaceToggle
          value={translatorWorkspaceMode}
          onChange={setTranslatorWorkspaceMode}
        />

        {translatorWorkspaceMode === 'visual' && (
          <div className="koma-submode-toggle" style={{ marginTop: 10 }}>
            <button
              type="button"
              className={`koma-submode-toggle__btn${translatorVisualProcessingMode === 'standard' ? ' koma-submode-toggle__btn--active' : ''}`}
              onClick={() => setTranslatorVisualProcessingMode('standard')}
            >
              <span>{t("dashboard.translator.processing.standard")}</span>
            </button>
            <button
              type="button"
              className={`koma-submode-toggle__btn${translatorVisualProcessingMode === 'ai_sfx' ? ' koma-submode-toggle__btn--active' : ''}`}
              onClick={() => setTranslatorVisualProcessingMode('ai_sfx')}
            >
              <Sparkles size={12} />
              <span>{t("dashboard.translator.processing.aiSfx")}</span>
            </button>
          </div>
        )}

        {/* Languages */}
        <div className="koma-lang-pair">
          <select
            value={srcLang}
            onChange={(e) => setSrcLang(e.target.value)}
            className="koma-select"
            aria-label={t("dashboard.language.source")}
          >
            {sourceLanguageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label as any)}
              </option>
            ))}
          </select>

          <span className="koma-lang-pair__arrow" aria-hidden="true">
            <ArrowRight size={11} />
          </span>

          <select
            value={tgtLang}
            onChange={(e) => setTgtLang(e.target.value)}
            className="koma-select"
            aria-label={t("dashboard.language.target")}
          >
            {targetLanguageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label as any)}
              </option>
            ))}
          </select>
        </div>
      </AioSection>

      {/* ═══ Models ═══ */}
      <AioSection icon={Settings} title={t("dashboard.models.title")} defaultOpen={true}>
        {/* OCR (visual only) */}
        {translatorWorkspaceMode === 'visual' && (
          <div className="koma-model-slot">
            <div className="koma-model-slot__head">
              <span className="koma-model-slot__title">
                <span
                  className="koma-model-slot__title-icon"
                  aria-hidden="true"
                >
                  <Eye size={10} />
                </span>
                {t("dashboard.translator.ocr")}
              </span>
              <button
                type="button"
                className="koma-model-slot__manage"
                onClick={openRecognizeTextManager}
                aria-label={t("dashboard.translator.ocr.manageModels")}
              >
                <HardDrive size={9} /> {t("aio.model.manage")}
              </button>
            </div>
            <select
              value={
                translatorAvailableOcrStageOptions.some(
                  (o) => o.key === aioRecognizeTextValue,
                )
                  ? aioRecognizeTextValue
                  : ''
              }
              onChange={(e) => setAioRecognizeTextModel(e.target.value)}
              className="koma-select"
              disabled={translatorAvailableOcrStageOptions.length === 0}
              aria-label={t("dashboard.translator.ocr")}
            >
              {translatorAvailableOcrStageOptions.length === 0 ? (
                <option value="" disabled>
                  {t("dashboard.translator.noneAvailable")}
                </option>
              ) : (
                translatorAvailableOcrStageOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {formatAioStageOptionLabel(opt)}
                  </option>
                ))
              )}
            </select>
            {selectedTranslatorOcrCloudOption && (
              <>
                <p className="koma-field__hint">
                  {t("dashboard.translator.device")}: {selectedTranslatorOcrCloudOption?.device ?? '-'}
                </p>
                <p className="koma-field__hint">
                  {t("dashboard.translator.languages")}:{' '}
                  {(selectedTranslatorOcrCloudOption?.languages ?? []).join(
                    ', ',
                  ) || t("dashboard.translator.multi")}
                </p>
                <p className="koma-field__hint">
                  {selectedTranslatorOcrCloudOption?.use_case ??
                    t("dashboard.translator.noDescription")}
                </p>
                {selectedOcrStatusText ? (
                  <p className="koma-field__hint">
                    {t("dashboard.translator.localStatus", { value: selectedOcrStatusText })}
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Translation Model */}
        <TranslationModelControl
          selectedModelId={translationSelectedModelId}
          sourceLanguage={srcLang}
          targetLanguage={tgtLang}
          entries={modelEntries as any}
          legacyOptions={availableTranslationStageOptions as any}
          installedCount={installedCount}
          updatesCount={updatesCount}
          onSelectModel={setTranslationModel}
          onOpenManager={openTranslationManager}
          selectedSummary={translationSelectedSummary}
          supportSummary={translationSupportSummary}
        />

        {isVisualSfxMode && (
          <div className="koma-model-slot">
            <div className="koma-model-slot__head">
              <span className="koma-model-slot__title">
                <span className="koma-model-slot__title-icon" aria-hidden="true">
                  <Sparkles size={10} />
                </span>
                {t("dashboard.translator.sfx.cleanModel")}
              </span>
            </div>
            <select
              value={
                translatorSfxCleanModelOptions.some(
                  (option) => option.key === translatorSfxCleanModelKey,
                )
                  ? translatorSfxCleanModelKey
                  : ''
              }
              onChange={(event) =>
                selectTranslatorSfxCleanModel(event.target.value)
              }
              className="koma-select"
              disabled={translatorSfxCleanModelOptions.length === 0}
              aria-label={t("dashboard.translator.sfx.cleanModel")}
            >
              {translatorSfxCleanModelOptions.length === 0 ? (
                <option value="" disabled>
                  {t("dashboard.translator.noneAvailable")}
                </option>
              ) : (
                translatorSfxCleanModelOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {formatAioStageOptionLabel(option)}
                  </option>
                ))
              )}
            </select>
            {selectedTranslatorSfxCleanOption && (
              <p className="koma-field__hint">
                {selectedTranslatorSfxCleanOption?.use_case ?? t("dashboard.translator.noDescription")}
              </p>
            )}
            <textarea
              value={translatorSfxAdditionalInstructions}
              onChange={(event) =>
                setTranslatorSfxAdditionalInstructions(event.target.value)
              }
              className="koma-input"
              rows={3}
              placeholder={t("dashboard.translator.sfx.hint")}
              style={{ marginTop: 10 }}
            />
          </div>
        )}
      </AioSection>

      {/* ═══ LLM Settings (conditional) ═══ */}
      {showLlmSettingsPanel && (
        <AioSection
          icon={Sliders}
          title={t('dashboard.aio.customAi.title')}
          defaultOpen={false}
        >
          <div className="koma-llm-compact">
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
              placeholder={t("dashboard.translator.llm.contextPlaceholder")}
            />

            <div className="koma-llm-compact__toggles">
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
                <span>{t("dashboard.translator.llm.generateNotes")}</span>
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
                <span>{t("dashboard.translator.llm.multimodalContext")}</span>
              </label>
            </div>

            <div className="koma-llm-compact__sliders">
              <KlSlider
                label={t("dashboard.translator.llm.temperature")}
                value={llmSettings.temperature}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) =>
                  setLlmSettings((prev) =>
                    clampLlmRequestSettings({ ...prev, temperature: v }),
                  )
                }
                resetVal={0.2}
              />
              <KlSlider
                label={t("dashboard.translator.llm.topP")}
                value={llmSettings.top_p}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setLlmSettings((prev) =>
                    clampLlmRequestSettings({ ...prev, top_p: v }),
                  )
                }
                resetVal={0.95}
              />
              <KlSlider
                label={t("dashboard.translator.llm.maxTokens")}
                value={llmSettings.max_tokens}
                min={128}
                max={8192}
                step={64}
                onChange={(v) =>
                  setLlmSettings((prev) =>
                    clampLlmRequestSettings({ ...prev, max_tokens: v }),
                  )
                }
                resetVal={4096}
              />
            </div>
          </div>
        </AioSection>
      )}

      {/* ═══ Actions ═══ */}
      <AioSection icon={Zap} title={t("dashboard.translator.execute.title")}>
        {translatorWorkspaceMode === 'text' ? (
          <>
            <div className="koma-translator-actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost"
                onClick={() => translatorTextImportRef.current?.click()}
              >
                <FolderOpen size={12} /> {t("dashboard.translator.import")}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--primary"
                disabled={processing || translatorDraftText.trim().length === 0}
                onClick={() => void runTranslatorText()}
                aria-busy={translatorTextRunning}
              >
                {translatorTextRunning ? (
                  <>
                    <span
                      className="auth-spinner"
                      style={{ width: 12, height: 12 }}
                    />{' '}
                    {t("dashboard.translator.translating")}
                  </>
                ) : (
                  <>
                    <Languages size={12} /> {t("dashboard.translator.translate")}
                  </>
                )}
              </button>
            </div>

            <p className="koma-tools-hint">
              {translatorTranslatedText.trim().length > 0
                ? t("dashboard.translator.charactersTranslated", { count: translatorTranslatedText.length })
                : t("dashboard.translator.noTranslation")}
            </p>

            <input
              ref={translatorTextImportRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              onChange={handleTranslatorTextImport}
            />
          </>
        ) : (
          <>
            <div className="koma-translator-actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost"
                onClick={() => translatorImageImportRef.current?.click()}
              >
                <Upload size={12} /> {t("dashboard.translator.loadImage")}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--primary"
                disabled={processing || imagesCount === 0}
                onClick={() => void processTranslatorVisual()}
                aria-busy={processing}
              >
                {processing ? (
                  <>
                    <span
                      className="auth-spinner"
                      style={{ width: 12, height: 12 }}
                    />{' '}
                    {t("dashboard.translator.processing.loading")}
                  </>
                ) : (
                  <>
                    <Languages size={12} /> {t("dashboard.translator.detectTranslate")}
                  </>
                )}
              </button>
            </div>

            <div className="koma-translator-actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost"
                disabled={
                  processing ||
                  !activeId ||
                  activeTranslatorImageDetectionsCount === 0
                }
                onClick={() => {
                  if (activeId) void retranslateTranslatorRegions(activeId);
                }}
              >
                <RefreshCcw size={11} /> {t("dashboard.translator.retranslateImage")}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--ghost"
                disabled={
                  processing || !activeId || !activeTranslatorSelectedRegion
                }
                onClick={() => {
                  if (activeId && activeTranslatorSelectedRegion)
                    void retranslateTranslatorRegions(activeId, [
                      activeTranslatorSelectedRegion.id,
                    ]);
                }}
              >
                <Sparkles size={11} /> {t("dashboard.translator.retranslateRegion")}
              </button>
            </div>

            <input
              ref={translatorImageImportRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              hidden
              multiple
              onChange={handleTranslatorImageUpload}
            />
          </>
        )}
      </AioSection>

      {/* ═══ Region Inspector (visual only) ═══ */}
      {translatorWorkspaceMode === 'visual' && (
        <AioSection
          icon={Box}
          title={t("dashboard.translator.regionTitle")}
          defaultOpen={!!activeTranslatorSelectedRegion}
        >
          <div className="koma-region-inspect">
            <span className="koma-region-inspect__key">{t("dashboard.translator.blocks")}</span>
            <span className="koma-region-inspect__val koma-region-inspect__val--mono">
              {activeTranslatorImageDetectionsCount}
            </span>

            <span className="koma-region-inspect__key">{t("dashboard.translator.selection")}</span>
            <span
              className={cn(
                'koma-region-inspect__val',
                !activeTranslatorSelectedRegion &&
                  'koma-region-inspect__val--muted',
              )}
            >
              {activeTranslatorSelectedRegion
                ? activeTranslatorSelectedRegion.id
                : t("dashboard.translator.none")}
            </span>

            {activeTranslatorSelectedRegion && (
              <>
                <span className="koma-region-inspect__key">{t("dashboard.translator.ocr")}</span>
                <span
                  className={cn(
                    'koma-region-inspect__val',
                    !activeTranslatorSelectedRegion.recognizedText &&
                      'koma-region-inspect__val--muted',
                  )}
                >
                  {activeTranslatorSelectedRegion.recognizedText
                    ? `"${activeTranslatorSelectedRegion.recognizedText.slice(0, 80)}"`
                    : '—'}
                </span>

                <span className="koma-region-inspect__key">{t("dashboard.translator.translation")}</span>
                <span
                  className={cn(
                    'koma-region-inspect__val',
                    !activeTranslatorSelectedRegion.translatedText &&
                      'koma-region-inspect__val--muted',
                  )}
                >
                  {activeTranslatorSelectedRegion.translatedText
                    ? `"${activeTranslatorSelectedRegion.translatedText.slice(0, 80)}"`
                    : '—'}
                </span>

                {activeTranslatorSelectedTranslationNotes.length > 0 && (
                  <>
                    <span className="koma-region-inspect__key">{t("dashboard.translator.notes")}</span>
                    <span className="koma-region-inspect__val">
                      {activeTranslatorSelectedTranslationNotes.join(' | ')}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </AioSection>
      )}
    </div>
  );
}
