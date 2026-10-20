/**
 * Translator execution — translation/OCR pre-flight resolvers, the free-text
 * translation run, and the retranslate-existing-regions run. Split out of
 * translator.ts (T10); the entry file keeps the visual batch run and
 * re-exports this module.
 */
import { useCallback } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import {
  type CustomLlmProfile,
  type LlmRequestSettings,
} from '../../../utils/customLlm';
import {
  parseTranslatorStructuredTextInput,
} from '../../../utils/dashboard.utils';
import {
  resolveGetTranslationsReadiness,
  resolveRecognizeTextReadiness,
  runGetTranslationsStage,
  runTranslateTextStage,
  type StageReadiness,
  type StageRuntime,
} from '../../../aio-stages';
import { buildSfxTranslationInstructions } from '../../../utils/sfx';
import type {
  AioTextRegion,
  LoadedImage,
  TranslatorTextRequestRegion,
} from '../../../types/dashboard.types';
import { parseApiError } from '../helpers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';

/* ── Execution resolvers (translation/OCR pre-flight validation) ── */

interface ModelManagerEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseTranslatorExecutionResolversArgs {
  /* Cross-domain values (aio memos, model manager, page callback) */
  modelEntries: Record<string, ModelManagerEntryLike | undefined>;
  translationStageOptionsForSelect: AioStageOption[];
  translatorOcrStageOptionsForSelect: AioStageOption[];
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  validateManualLocalStageModel: (stageKey: string, stageLabel: string, modelKey: string) => boolean;
}

export function useTranslatorExecutionResolvers({
  modelEntries,
  translationStageOptionsForSelect,
  translatorOcrStageOptionsForSelect,
  selectedCustomTranslationProfile,
  selectedCustomOcrProfile,
  validateManualLocalStageModel,
}: UseTranslatorExecutionResolversArgs) {
  const { t } = useI18n();
  const translationSelectionKey = useAioPipelineStore(
    (s) => s.aioStageSelection.getTranslations,
  );
  const ocrSelectionKey = useAioPipelineStore(
    (s) => s.aioStageSelection.recognizeText,
  );
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);

  const ensureLocalModelReady = validateManualLocalStageModel;
  const throwReadinessRefusal = (
    readiness: Extract<StageReadiness, { ok: false }>,
  ): never => {
    throw new Error(
      readiness.message
      || t('translator.installCompatibleOcrModel'),
    );
  };

  const resolveTranslatorTranslationExecution = useCallback(async () => {
    const selectedTranslationKey = translationSelectionKey;
    const selectedTranslationOption = translationStageOptionsForSelect.find(
      (option) => option.key === selectedTranslationKey,
    ) ?? null;

    const readiness = resolveGetTranslationsReadiness({
      modelKey: selectedTranslationKey,
      options: translationStageOptionsForSelect,
      modelEntries,
      customProfile: selectedCustomTranslationProfile,
      sourceLanguage: srcLang,
      targetLanguage: tgtLang,
      messages: {
        invalidSelection: t('translator.selectValidTranslationModel'),
        selectCustomProfile: t('translator.selectCustomAiTranslationProfile'),
        requiresApiKey: t('aioExec.translationRequiresApiKey'),
        installTranslationModel: t('aioExec.installTranslationModel'),
        incompatibleLanguage: t('translator.localModelIncompatible'),
      },
      t,
    });
    if (!readiness.ok) {
      return throwReadinessRefusal(readiness);
    }

    return {
      selectedTranslationKey,
      selectedTranslationOption,
      useCloudTranslation: readiness.useCloud,
      useLlmSettingsForTranslation: readiness.useLlmSettings,
    };
  }, [
    modelEntries,
    selectedCustomTranslationProfile,
    srcLang,
    t,
    tgtLang,
    translationSelectionKey,
    translationStageOptionsForSelect,
  ]);

  const resolveTranslatorOcrExecution = useCallback(async () => {
    const selectedOcrKey = ocrSelectionKey;
    const selectedOcrOption = translatorOcrStageOptionsForSelect.find(
      (option) => option.key === selectedOcrKey,
    ) ?? null;

    const readiness = resolveRecognizeTextReadiness({
      modelKey: selectedOcrKey,
      stageLabel: AIO_STAGE_LABELS.recognizeText,
      options: translatorOcrStageOptionsForSelect,
      modelEntries,
      customProfile: selectedCustomOcrProfile,
      ensureLocalModelReady,
      requireOptionWithLocal: true,
      messages: {
        invalidSelection: t('translator.selectValidOcrModel'),
        selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
        requiresApiKey: t('aioExec.ocrRequiresApiKey'),
      },
      t,
    });
    if (!readiness.ok) {
      return throwReadinessRefusal(readiness);
    }

    return {
      selectedOcrKey,
      selectedOcrOption,
      useCloudOcr: readiness.useCloud,
      useLlmSettingsForOcr: readiness.useLlmSettings,
    };
  }, [
    ensureLocalModelReady,
    modelEntries,
    ocrSelectionKey,
    selectedCustomOcrProfile,
    t,
    translatorOcrStageOptionsForSelect,
  ]);

  return {
    resolveTranslatorTranslationExecution,
    resolveTranslatorOcrExecution,
  };
}

/* ── Free-text translation run ── */

export interface TranslationExecutionResult {
  selectedTranslationKey: string;
  useCloudTranslation: boolean;
  useLlmSettingsForTranslation: boolean;
}

interface UseTranslatorTextActionsArgs {
  /* Cross-domain values (api config, page memos & callbacks, export-download T10) */
  localApiUrl: string;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  resolveTranslatorTranslationExecution: () => Promise<TranslationExecutionResult>;
  emitProcessStartWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessCompleteWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessErrorWebhook: (processName: string, pages: number, error: unknown, context?: Record<string, unknown>) => void;
  setDiscordTranslating: (targetLabel: string, sourceLanguage: string, targetLanguage: string) => Promise<void>;
  syncDiscordForTab: () => Promise<void> | void;
  recordProcessedPages: (pages: number) => void;
  setLastActionScope: (value: 'translator') => void;
}

export function useTranslatorTextActions({
  localApiUrl,
  selectedCustomTranslationProfile,
  ensureVerifiedEmailOrNotify,
  resolveTranslatorTranslationExecution,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  setDiscordTranslating,
  syncDiscordForTab,
  recordProcessedPages,
  setLastActionScope,
}: UseTranslatorTextActionsArgs) {
  const { t } = useI18n();
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const setTranslatorTextRunning = useTranslatorStore(
    (s) => s.setTranslatorTextRunning,
  );
  const setTranslatorTranslatedText = useTranslatorStore(
    (s) => s.setTranslatorTranslatedText,
  );
  const setTranslatorLastTextModelUsed = useTranslatorStore(
    (s) => s.setTranslatorLastTextModelUsed,
  );
  const setTranslatorTextDirty = useTranslatorStore(
    (s) => s.setTranslatorTextDirty,
  );
  // Same `unknown` local type the hook's args interface declared (the SFX
  // branches narrow it with casts).
  const llmSettings: unknown = useLlmProvidersStore((s) => s.llmSettings);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return useCallback(async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    const translatorDraftText = useTranslatorStore.getState().translatorDraftText;
    const sourceText = translatorDraftText.trim();
    if (!sourceText) {
      setStatusMessage('Paste or import some text before translating.');
      return;
    }

    setProcessing(true);
    setTranslatorTextRunning(true);
    setProgress(10);
    emitProcessStartWebhook('Tradutor Texto', 1, {
      idioma_origem: srcLang,
      idioma_destino: tgtLang,
    });

    try {
      const {
        selectedTranslationKey,
        useLlmSettingsForTranslation,
      } = await resolveTranslatorTranslationExecution();

      await setDiscordTranslating('texto-livre', srcLang, tgtLang);
      setStatusMessage('Tradutor texto: traduzindo documento...');

      const structuredInput = parseTranslatorStructuredTextInput(translatorDraftText);
      const requestRegions: TranslatorTextRequestRegion[] = structuredInput?.regions ?? [
        {
          id: 'doc-1',
          text: translatorDraftText,
          source: 'manual',
          detector_model_key: 'translator_text',
          ocr_model_key: 'translator_text',
        },
      ];

      const translationDone = await runTranslateTextStage(
        {
          modelKey: selectedTranslationKey,
          sourceLanguage: srcLang,
          targetLanguage: tgtLang,
          requestRegions,
          llmSettings: useLlmSettingsForTranslation
            ? (llmSettings as LlmRequestSettings | null)
            : null,
          customProfile: useLlmSettingsForTranslation
            ? selectedCustomTranslationProfile
            : null,
        },
        { localApiUrl } satisfies StageRuntime,
        {
          stageLabel: 'Tradutor Texto',
          failurePrefix: 'Failed to translate free text',
          parseApiError,
        },
      );

      const translationPayload = translationDone.value;
      const translatedById = new Map(
        translationPayload.regions.map((region) => [region.id, region.translated_text]),
      );
      const translatedRegion = translationPayload.regions.find((region) => region.id === 'doc-1')
        ?? translationPayload.regions[0]
        ?? null;
      const translatedText = structuredInput
        ? structuredInput.reconstruct(translatedById)
        : (translatedRegion?.translated_text ?? '');

      setTranslatorTranslatedText(translatedText);
      setTranslatorLastTextModelUsed(translationPayload.model_used || selectedTranslationKey);
      setTranslatorTextDirty(false);
      setLastActionScope('translator');
      setProgress(100);

      recordProcessedPages(1);

      emitProcessCompleteWebhook('Tradutor Texto', 1, {
        idioma_origem: srcLang,
        idioma_destino: tgtLang,
        modelo: translationPayload.model_used || selectedTranslationKey,
        caracteres_entrada: translatorDraftText.length,
        caracteres_saida: translatedText.length,
      });
      setStatusMessage(t('translatorText.done'));
    } catch (error) {
      emitProcessErrorWebhook('Tradutor Texto', 1, error, {
        idioma_origem: srcLang,
        idioma_destino: tgtLang,
      });
      setStatusMessage(error instanceof Error ? error.message : 'Failed to translate free text.');
    } finally {
      setTranslatorTextRunning(false);
      setProcessing(false);
      setProgress(0);
      void syncDiscordForTab();
    }
  }, [
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    emitProcessStartWebhook,
    ensureVerifiedEmailOrNotify,
    llmSettings,
    localApiUrl,
    parseApiError,
    resolveTranslatorTranslationExecution,
    selectedCustomTranslationProfile,
    setDiscordTranslating,
    setLastActionScope,
    setProcessing,
    setProgress,
    setStatusMessage,
    setTranslatorLastTextModelUsed,
    setTranslatorTextDirty,
    setTranslatorTextRunning,
    setTranslatorTranslatedText,
    srcLang,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    tgtLang,
  ]);
}

/* ── Retranslate existing regions of an image ── */

interface CustomProfileLike {
  apiBase: string;
  apiKey: string;
  model?: string;
}

interface UseTranslatorRetranslateArgs {
  /* Cross-domain values (image-collection, page memos & callbacks, export-download T10) */
  images: LoadedImage[];
  localApiUrl: string;
  selectedCustomTranslationProfile: CustomProfileLike | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  resolveTranslatorTranslationExecution: () => Promise<TranslationExecutionResult>;
  setDiscordTranslating: (targetLabel: string, sourceLanguage: string, targetLanguage: string) => Promise<void>;
  syncDiscordForTab: () => Promise<void> | void;
  recordProcessedPages: (pages: number) => void;
  /* Translator region callback (useTranslatorRegionEditing) */
  updateTranslatorRegionsForImage: (imageId: string, nextRegions: AioTextRegion[], nextSelectedRegionId?: string | null) => void;
  setLastActionScope: (value: 'translator') => void;
}

export function useTranslatorRetranslate({
  images,
  localApiUrl,
  selectedCustomTranslationProfile,
  ensureVerifiedEmailOrNotify,
  resolveTranslatorTranslationExecution,
  setDiscordTranslating,
  syncDiscordForTab,
  recordProcessedPages,
  updateTranslatorRegionsForImage,
  setLastActionScope,
}: UseTranslatorRetranslateArgs) {
  const { t } = useI18n();
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const translatorVisualProcessingMode = useTranslatorStore(
    (s) => s.translatorVisualProcessingMode,
  );
  const translatorSfxAdditionalInstructions = useTranslatorStore(
    (s) => s.translatorSfxAdditionalInstructions,
  );
  const detectSelectionKey = useAioPipelineStore(
    (s) => s.aioStageSelection.detectText,
  );
  const ocrSelectionKey = useAioPipelineStore(
    (s) => s.aioStageSelection.recognizeText,
  );
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const setTranslatorRunMetaByImage = useTranslatorStore(
    (s) => s.setTranslatorRunMetaByImage,
  );
  const setTranslatorVisualRunning = useTranslatorStore(
    (s) => s.setTranslatorVisualRunning,
  );
  // Same `unknown` local type the hook's args interface declared (the SFX
  // branches narrow it with casts).
  const llmSettings: unknown = useLlmProvidersStore((s) => s.llmSettings);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return useCallback(async (
    imageId: string,
    regionIds?: string[],
  ) => {
    if (!ensureVerifiedEmailOrNotify()) return;
    const imgData = images.find((image) => image.id === imageId);
    if (!imgData) {
      setStatusMessage(t('translatorRetranslate.targetNotFound'));
      return;
    }
    const regions = translatorDetectionsByImage[imageId] ?? [];
    const targetRegions = (regionIds && regionIds.length > 0
      ? regions.filter((region) => regionIds.includes(region.id))
      : regions
    ).filter((region) => (region.recognizedText ?? '').trim().length > 0);
    if (targetRegions.length === 0) {
      setStatusMessage(t('translatorRetranslate.noTextAvailable'));
      return;
    }

    setProcessing(true);
    setTranslatorVisualRunning(true);
    setProgress(15);
    try {
      const {
        selectedTranslationKey,
        useLlmSettingsForTranslation,
      } = await resolveTranslatorTranslationExecution();
      await setDiscordTranslating(imgData.file.name, srcLang, tgtLang);
      setStatusMessage(
        t(regionIds?.length ? 'translatorRetranslate.retranslatingRegion' : 'translatorRetranslate.retranslatingActive'),
      );

      const isSfxRetranslate = translatorVisualProcessingMode === 'ai_sfx';
      const sfxExtraContext = isSfxRetranslate
        ? buildSfxTranslationInstructions(
            String((llmSettings as { extra_context?: string } | null)?.extra_context ?? ''),
            translatorSfxAdditionalInstructions,
        )
      : undefined;
    const llmSettingsOverride = isSfxRetranslate
      ? {
          ...(llmSettings as LlmRequestSettings),
          extra_context: sfxExtraContext ?? '',
          translation_notes_enabled: false,
        }
      : (llmSettings as LlmRequestSettings | null);

    const translateDone = await runGetTranslationsStage(
      {
        image: imgData,
        modelKey: selectedTranslationKey,
        sourceLanguage: srcLang,
        targetLanguage: tgtLang,
        regions: targetRegions,
        fallbackOcrModelKey: ocrSelectionKey,
        sfxExtraContext,
        llmSettingsOverride: useLlmSettingsForTranslation
          ? llmSettingsOverride
          : null,
        customProfile: useLlmSettingsForTranslation
          ? selectedCustomTranslationProfile
          : null,
      },
      { localApiUrl } satisfies StageRuntime,
      {
        stageLabel: 'Tradutor Visual',
        failurePrefix: `Failed to retranslate "${imgData.file.name}"`,
        parseApiError,
      },
      );

      const nextRegions = regions.map((region) => {
        const updated = translateDone.value.find((item) => item.id === region.id);
        return updated ?? region;
      });
      updateTranslatorRegionsForImage(
        imageId,
        nextRegions,
        useTranslatorStore.getState().translatorSelectedRegionByImage[imageId] ?? null,
      );
      setTranslatorRunMetaByImage((prev) => ({
        ...prev,
        [imageId]: {
          detected: prev[imageId]?.detected ?? nextRegions.length > 0,
          ocr: prev[imageId]?.ocr ?? nextRegions.some((region) => Boolean(region.recognizedText?.trim())),
          translated: nextRegions.some((region) => Boolean(region.translatedText?.trim())),
          detectModelKey: prev[imageId]?.detectModelKey ?? detectSelectionKey,
          ocrModelKey: prev[imageId]?.ocrModelKey ?? ocrSelectionKey,
          translatorModelKey: selectedTranslationKey,
          sourceLanguage: srcLang,
          targetLanguage: tgtLang,
          visualMode: prev[imageId]?.visualMode ?? translatorVisualProcessingMode,
        },
      }));
      setLastActionScope('translator');
      setProgress(100);

      recordProcessedPages(1);

      setStatusMessage(regionIds?.length
        ? t('translatorRetranslate.regionRetranslated')
        : 'Active image retranslated successfully.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to retranslate in the visual Translator.');
    } finally {
      setTranslatorVisualRunning(false);
      setProcessing(false);
      setProgress(0);
      void syncDiscordForTab();
    }
  }, [
    detectSelectionKey,
    ensureVerifiedEmailOrNotify,
    images,
    llmSettings,
    localApiUrl,
    ocrSelectionKey,
    parseApiError,
    resolveTranslatorTranslationExecution,
    selectedCustomTranslationProfile,
    setDiscordTranslating,
    setLastActionScope,
    setProcessing,
    setProgress,
    setStatusMessage,
    setTranslatorRunMetaByImage,
    setTranslatorVisualRunning,
    srcLang,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    tgtLang,
    translatorSfxAdditionalInstructions,
    translatorDetectionsByImage,
    translatorVisualProcessingMode,
    updateTranslatorRegionsForImage,
  ]);
}
