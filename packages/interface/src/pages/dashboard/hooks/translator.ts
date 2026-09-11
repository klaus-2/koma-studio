import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_STAGE_LABELS, MIN_REGION_SIZE } from '../../../constants/dashboard.constants';
import {
  buildCustomStageOption,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
} from '../../../models/aioStageCatalog';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { ModelInstallState } from '../../../models/types';
import {
  TRANSLATION_MODELS_BY_ID,
  modelSupportsLanguage,
} from '../../../models/translation-models-registry';
import {
  type CustomLlmProfile,
  findCustomProfileForSelection,
  getCustomLlmRuntimeRestriction,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
  toCustomLlmRequestPayload,
} from '../../../utils/customLlm';
import {
  blobToDataUrl,
  cloneAioRegions,
  cloneRenderStyle,
  getRegionTranslationNotesForDisplay,
  isDirectImageUploadFile,
  normalizeDetectedGradient,
  normalizeRgbTriplet,
  normalizeTranslationNotes,
  parseTranslatorStructuredTextInput,
  resolveSelectedRegionForRegions,
  toApiIntegerBbox,
} from '../../../utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  applySfxDecisionsToRegions,
  buildSfxClassifierInstructions,
  buildSfxClassifierRegionsPayload,
  buildSfxCleanInstructions,
  buildSfxTranslationInstructions,
  isLikelySfxCandidate,
  type SfxClassificationResponse,
} from '../../../utils/sfx';
import { normalizeDetectedRenderMode } from '../../../utils/renderModes';
import type {
  AioTextRegion,
  DetectApiResponse,
  LoadedImage,
  OcrApiResponse,
  TranslationApiResponse,
  TranslatorTextRequestRegion,
  TranslatorVisualRunMeta,
} from '../../../types/dashboard.types';
import { parseApiError } from '../helpers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';

/* ── Region callbacks (update/select per-image visual regions) ── */

export function useTranslatorRegionEditing() {
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const setTranslatorDetectionsByImage = useTranslatorStore(
    (s) => s.setTranslatorDetectionsByImage,
  );
  const setTranslatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.setTranslatorSelectedRegionByImage,
  );

  const updateTranslatorRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      setTranslatorDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setTranslatorSelectedRegionByImage((prev) => {
        const currentSelected = prev[imageId] ?? null;
        const resolvedSelected =
          selectedRegionIdOverride === undefined
            ? resolveSelectedRegionForRegions(clonedRegions, currentSelected)
            : resolveSelectedRegionForRegions(
                clonedRegions,
                selectedRegionIdOverride,
              );
        return {
          ...prev,
          [imageId]: resolvedSelected,
        };
      });
    },
    [
      resolveSelectedRegionForRegions,
      setTranslatorDetectionsByImage,
      setTranslatorSelectedRegionByImage,
    ],
  );

  const selectTranslatorRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const regions = translatorDetectionsByImage[imageId] ?? [];
      const resolvedSelected = resolveSelectedRegionForRegions(
        regions,
        regionId,
      );
      setTranslatorSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
    },
    [
      resolveSelectedRegionForRegions,
      setTranslatorSelectedRegionByImage,
      translatorDetectionsByImage,
    ],
  );

  return { updateTranslatorRegionsForImage, selectTranslatorRegionForImage };
}

/* ── Text file import + image upload entry points ── */

interface UseTranslatorImportsArgs {
  /* Cross-domain callback (image-collection uploads) */
  onDrop: (files: File[]) => Promise<void>;
}

export function useTranslatorImports({
  onDrop,
}: UseTranslatorImportsArgs) {
  const setTranslatorDraftText = useTranslatorStore(
    (s) => s.setTranslatorDraftText,
  );
  const setTranslatorTextDirty = useTranslatorStore(
    (s) => s.setTranslatorTextDirty,
  );
  const setTranslatorWorkspaceMode = useTranslatorStore(
    (s) => s.setTranslatorWorkspaceMode,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const handleTranslatorTextImport = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      setTranslatorDraftText(content);
      setTranslatorTextDirty(true);
      setStatusMessage(`Text "${file.name}" imported into the Translator.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to import the text into the Translator.');
    }
  }, [setStatusMessage, setTranslatorDraftText, setTranslatorTextDirty]);

  const handleTranslatorImageUpload = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []).filter(isDirectImageUploadFile);
    event.target.value = '';
    if (files.length === 0) {
      setStatusMessage('Select at least one PNG/JPG/WEBP image for the visual Translator.');
      return;
    }
    setTranslatorWorkspaceMode('visual');
    await onDrop(files);
  }, [onDrop, setStatusMessage, setTranslatorWorkspaceMode]);

  return {
    handleTranslatorTextImport,
    handleTranslatorImageUpload,
  };
}

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

  const resolveTranslatorTranslationExecution = useCallback(async () => {
    let selectedTranslationKey = translationSelectionKey;

    const selectedLocalModelState = modelEntries[selectedTranslationKey] ?? null;
    const selectedTranslationOption = translationStageOptionsForSelect.find(
      (option) => option.key === selectedTranslationKey,
    ) ?? null;

    if (selectedLocalModelState) {
      const selectedModelInstalled =
        selectedLocalModelState.status === 'installed'
        || selectedLocalModelState.status === 'update_available';
      if (!selectedModelInstalled) {
        throw new Error(t('aioExec.installTranslationModel'));
      }
      const modelDefinition = TRANSLATION_MODELS_BY_ID[selectedLocalModelState.model.id] ?? null;
      if (modelDefinition && !modelSupportsLanguage(modelDefinition, srcLang, tgtLang)) {
        throw new Error(t('translator.localModelIncompatible'));
      }
    } else {
      if (!selectedTranslationOption) {
        throw new Error(t('translator.selectValidTranslationModel'));
      }
      if (!selectedTranslationOption.implemented) {
        throw new Error(t('aioModel.status.inRoadmap', { name: selectedTranslationOption.name }));
      }
      if (!selectedTranslationOption.available) {
        throw new Error(t('aioModel.status.requiresConfig', { name: selectedTranslationOption.name }));
      }
      if (isCustomModelSelectionKey(selectedTranslationKey) && !selectedCustomTranslationProfile) {
        throw new Error(t('translator.selectCustomAiTranslationProfile'));
      }
      if (
        isCustomModelSelectionKey(selectedTranslationKey)
        && selectedCustomTranslationProfile
        && requiresCustomLlmApiKey(selectedCustomTranslationProfile.apiBase)
        && !selectedCustomTranslationProfile.apiKey.trim()
      ) {
        throw new Error(t('aioExec.translationRequiresApiKey'));
      }
      if (isCustomModelSelectionKey(selectedTranslationKey) && selectedCustomTranslationProfile) {
        const runtimeRestriction = getCustomLlmRuntimeRestriction(selectedCustomTranslationProfile.apiBase);
        if (runtimeRestriction) {
          throw new Error(runtimeRestriction);
        }
      }
    }

    const useCloudTranslation = isCustomModelSelectionKey(selectedTranslationKey)
      ? !shouldUseLocalDesktopTranslationForCustomProfile(selectedCustomTranslationProfile)
      : isCloudTranslationModelKey(selectedTranslationKey);
    const useLlmSettingsForTranslation = (useCloudTranslation || isCustomModelSelectionKey(selectedTranslationKey)) && hasAnyLlmCapability(
      selectedTranslationOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('translation', selectedTranslationKey),
    );

    return {
      selectedTranslationKey,
      selectedTranslationOption,
      useCloudTranslation,
      useLlmSettingsForTranslation,
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
    let selectedOcrKey = ocrSelectionKey;

    const selectedOcrOption = translatorOcrStageOptionsForSelect.find(
      (option) => option.key === selectedOcrKey,
    ) ?? null;

    if (modelEntries[selectedOcrKey]) {
      if (!selectedOcrOption) {
        throw new Error(t('translator.localOcrModelIncompatible'));
      }
      if (!validateManualLocalStageModel('recognizeText', AIO_STAGE_LABELS.recognizeText, selectedOcrKey)) {
        throw new Error(t('translator.installCompatibleOcrModel'));
      }
    } else {
      if (!selectedOcrOption) {
        throw new Error(t('translator.selectValidOcrModel'));
      }
      if (!selectedOcrOption.implemented) {
        throw new Error(t('aioModel.status.inRoadmap', { name: selectedOcrOption.name }));
      }
      if (!selectedOcrOption.available) {
        throw new Error(t('aioModel.status.requiresConfig', { name: selectedOcrOption.name }));
      }
      if (isCustomModelSelectionKey(selectedOcrKey) && !selectedCustomOcrProfile) {
        throw new Error(t('aioExec.selectCustomOcrProfile'));
      }
      if (
        isCustomModelSelectionKey(selectedOcrKey)
        && selectedCustomOcrProfile
        && requiresCustomLlmApiKey(selectedCustomOcrProfile.apiBase)
        && !selectedCustomOcrProfile.apiKey.trim()
      ) {
        throw new Error(t('aioExec.ocrRequiresApiKey'));
      }
    }

    const useCloudOcr = isCloudOcrModelKey(selectedOcrKey);
    const useLlmSettingsForOcr = useCloudOcr && hasAnyLlmCapability(
      selectedOcrOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('ocr', selectedOcrKey),
    );

    return {
      selectedOcrKey,
      selectedOcrOption,
      useCloudOcr,
      useLlmSettingsForOcr,
    };
  }, [
    modelEntries,
    ocrSelectionKey,
    selectedCustomOcrProfile,
    t,
    translatorOcrStageOptionsForSelect,
    validateManualLocalStageModel,
  ]);

  return {
    resolveTranslatorTranslationExecution,
    resolveTranslatorOcrExecution,
  };
}

/* ── Free-text translation run ── */

interface TranslationExecutionResult {
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
  const translatorDraftText = useTranslatorStore((s) => s.translatorDraftText);
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

      const translationFormData = new FormData();
      translationFormData.append('model_key', selectedTranslationKey);
      translationFormData.append('source_language', srcLang);
      translationFormData.append('target_language', tgtLang);
      translationFormData.append('regions', JSON.stringify(requestRegions));
      if (useLlmSettingsForTranslation) {
        translationFormData.append('llm_settings', JSON.stringify(llmSettings));
        const customPayload = toCustomLlmRequestPayload(selectedCustomTranslationProfile);
        if (customPayload) {
          translationFormData.append('custom_llm', JSON.stringify(customPayload));
        }
      }

      setProgress(50);
      const translationRequestUrl = `${localApiUrl}/translate`;
      const translationResponse = await fetchWithTimeoutAndRetry(
        translationRequestUrl,
        { method: 'POST', body: translationFormData },
        { timeoutMs: 120_000, retryCount: 0 },
      );
      if (!translationResponse.ok) {
        const message = await parseApiError(translationResponse);
        throw new Error(`Failed to translate free text: ${message}`);
      }

      const translationPayload = (await translationResponse.json()) as TranslationApiResponse;
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
    translatorDraftText,
  ]);
}

/* ── Visual batch run (detect → [sfx classify] → ocr → translate → [sfx clean]) ── */

interface OcrExecutionResult {
  selectedOcrKey: string;
  useCloudOcr: boolean;
  useLlmSettingsForOcr: boolean;
}

interface UseTranslatorVisualActionsArgs {
  /* Cross-domain values (image-collection, page memos & callbacks, export-download T10) */
  images: LoadedImage[];
  activeTranslatorSelectedRegionId: string | null;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedTranslatorSfxCleanCustomProfile: CustomLlmProfile | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  validateManualLocalStageModel: (stageKey: string, stageLabel: string, modelKey: string) => boolean;
  resolveTranslatorOcrExecution: () => Promise<OcrExecutionResult>;
  resolveTranslatorTranslationExecution: () => Promise<TranslationExecutionResult>;
  emitProcessStartWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessCompleteWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessErrorWebhook: (processName: string, pages: number, error: unknown, context?: Record<string, unknown>) => void;
  setDiscordTranslating: (targetLabel: string, sourceLanguage: string, targetLanguage: string) => Promise<void>;
  syncDiscordForTab: () => Promise<void> | void;
  recordProcessedPages: (pages: number) => void;
  setLastActionScope: (value: 'translator') => void;
  localApiUrl: string;
}

export function useTranslatorVisualActions({
  images,
  activeTranslatorSelectedRegionId,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  selectedTranslatorSfxCleanCustomProfile,
  ensureVerifiedEmailOrNotify,
  validateManualLocalStageModel,
  resolveTranslatorOcrExecution,
  resolveTranslatorTranslationExecution,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  setDiscordTranslating,
  syncDiscordForTab,
  recordProcessedPages,
  setLastActionScope,
  localApiUrl,
}: UseTranslatorVisualActionsArgs) {
  const { t } = useI18n();
  const activeId = useImageCollectionStore((s) => s.activeId);
  const detectSelectionKey = useAioPipelineStore(
    (s) => s.aioStageSelection.detectText,
  );
  const minRegionSize = MIN_REGION_SIZE;
  const translatorVisualProcessingMode = useTranslatorStore(
    (s) => s.translatorVisualProcessingMode,
  );
  const translatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.translatorSfxCleanModelKey,
  );
  const translatorSfxAdditionalInstructions = useTranslatorStore(
    (s) => s.translatorSfxAdditionalInstructions,
  );
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const setTranslatorWorkspaceMode = useTranslatorStore(
    (s) => s.setTranslatorWorkspaceMode,
  );
  const setTranslatorVisualRunning = useTranslatorStore(
    (s) => s.setTranslatorVisualRunning,
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
  // Same `unknown` local type the hook's args interface declared (the SFX
  // branches narrow it with casts).
  const llmSettings: unknown = useLlmProvidersStore((s) => s.llmSettings);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return useCallback(async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    if (images.length === 0) {
      setStatusMessage(t('translatorVisual.noImages'));
      return;
    }
    if (!validateManualLocalStageModel('detectText', AIO_STAGE_LABELS.detectText, detectSelectionKey)) {
      return;
    }

    setTranslatorWorkspaceMode('visual');
    setProcessing(true);
    setTranslatorVisualRunning(true);
    setProgress(0);
    emitProcessStartWebhook('Tradutor Visual', images.length, {
      idioma_origem: srcLang,
      idioma_destino: tgtLang,
    });

    try {
      const {
        selectedOcrKey,
        useLlmSettingsForOcr,
      } = await resolveTranslatorOcrExecution();
      const {
        selectedTranslationKey,
        useLlmSettingsForTranslation,
      } = await resolveTranslatorTranslationExecution();
      const nextDetections: Record<string, AioTextRegion[]> = {};
      const nextSelections: Record<string, string | null> = {};
      const nextMeta: Record<string, TranslatorVisualRunMeta> = {};
      const nextProcessedBase: Record<string, string> = {};
      let totalDetected = 0;
      let totalRecognized = 0;
      let totalTranslated = 0;
      let totalSfxCandidates = 0;
      let totalSfxApproved = 0;
      let totalSfxReview = 0;
      let processedPagesCount = 0;

      setStatusMessage(
        translatorVisualProcessingMode === 'ai_sfx'
          ? t('translatorVisual.running.aiSfx')
          : t('translatorVisual.running.standard'),
      );

      for (let index = 0; index < images.length; index += 1) {
        const imgData = images[index]!;
        await setDiscordTranslating(imgData.file.name, srcLang, tgtLang);

        const detectFormData = new FormData();
        detectFormData.append('file', imgData.file);
        detectFormData.append('model_key', detectSelectionKey);
        detectFormData.append('language', srcLang);
        detectFormData.append('source_language', srcLang);
        const detectResponse = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/detect`,
          { method: 'POST', body: detectFormData },
          { timeoutMs: 90_000, retryCount: 0 },
        );
        if (!detectResponse.ok) {
          const message = await parseApiError(detectResponse);
          throw new Error(`Failed to detect text in "${imgData.file.name}": ${message}`);
        }

        const detectPayload = (await detectResponse.json()) as DetectApiResponse;
        const sourceWidth = detectPayload.image_width > 0 ? detectPayload.image_width : imgData.width;
        const sourceHeight = detectPayload.image_height > 0 ? detectPayload.image_height : imgData.height;
        const scaleX = imgData.width / Math.max(1, sourceWidth);
        const scaleY = imgData.height / Math.max(1, sourceHeight);
        let detectedRegions = detectPayload.detections
          .map((item): AioTextRegion | null => {
            const [bx1, by1, bx2, by2] = item.bbox;
            const rawX1 = Math.max(0, Math.min(sourceWidth, Math.min(bx1, bx2)));
            const rawY1 = Math.max(0, Math.min(sourceHeight, Math.min(by1, by2)));
            const rawX2 = Math.max(0, Math.min(sourceWidth, Math.max(bx1, bx2)));
            const rawY2 = Math.max(0, Math.min(sourceHeight, Math.max(by1, by2)));
            const x1 = Math.round(Math.max(0, Math.min(imgData.width, rawX1 * scaleX)));
            const y1 = Math.round(Math.max(0, Math.min(imgData.height, rawY1 * scaleY)));
            const x2 = Math.round(Math.max(0, Math.min(imgData.width, rawX2 * scaleX)));
            const y2 = Math.round(Math.max(0, Math.min(imgData.height, rawY2 * scaleY)));
            if ((x2 - x1) < minRegionSize || (y2 - y1) < minRegionSize) return null;
            return {
              id: item.id,
              bbox: [x1, y1, x2, y2],
              score: item.score,
              source: item.source,
              modelKey: item.model_key,
              detectorModelKey: item.model_key,
              detectedForegroundRgb: normalizeRgbTriplet(item.foreground_rgb),
              structuralType: item.structural_type ?? undefined,
              structuralConfidence: item.structural_confidence ?? undefined,
              structuralSource: item.structural_source ?? undefined,
              matchedReferenceImage: item.matched_reference_image ?? undefined,
              detectedRenderMode: normalizeDetectedRenderMode(item.label) ?? 'text_bubble',
              renderMode: 'auto',
            };
          })
          .filter((item): item is AioTextRegion => item !== null);

        let processedBaseDataUrl: string | null = null;
        let sfxCandidateCount = 0;
        let sfxApprovedCount = 0;
        let sfxReviewCount = 0;

        if (translatorVisualProcessingMode === 'ai_sfx') {
          const candidateRegions = detectedRegions.filter(isLikelySfxCandidate);
          sfxCandidateCount = candidateRegions.length;
          totalSfxCandidates += sfxCandidateCount;

          let enrichedCandidates: AioTextRegion[] = candidateRegions.map((region) => ({
            ...region,
            sfxCandidate: true,
            sfxApproved: false,
            sfxConfidence: null,
            sfxRequiresRedraw: false,
            sfxReason: null,
          }));

          if (candidateRegions.length > 0) {
            const classifyFormData = new FormData();
            classifyFormData.append('file', imgData.file);
            classifyFormData.append('model_key', translatorSfxCleanModelKey);
            classifyFormData.append(
              'regions',
              JSON.stringify(buildSfxClassifierRegionsPayload(candidateRegions, imgData)),
            );
            classifyFormData.append(
              'additional_instructions',
              buildSfxClassifierInstructions(translatorSfxAdditionalInstructions),
            );
            const customCleanPayload = toCustomLlmRequestPayload(
              selectedTranslatorSfxCleanCustomProfile,
            );
            if (customCleanPayload) {
              classifyFormData.append('custom_llm', JSON.stringify(customCleanPayload));
            }
            const classifyResponse = await fetchWithTimeoutAndRetry(
              `${localApiUrl}/sfx/classify`,
              { method: 'POST', body: classifyFormData },
              { timeoutMs: 180_000, retryCount: 0 },
            );
            if (!classifyResponse.ok) {
              const message = await parseApiError(classifyResponse);
              throw new Error(`Failed to classify SFX in "${imgData.file.name}": ${message}`);
            }
            const classifyPayload =
              (await classifyResponse.json()) as SfxClassificationResponse;
            enrichedCandidates = applySfxDecisionsToRegions(
              candidateRegions,
              classifyPayload.regions,
            );
          }

          detectedRegions = enrichedCandidates.filter((region) => region.sfxApproved);
          sfxApprovedCount = detectedRegions.length;
          sfxReviewCount = detectedRegions.filter((region) => region.sfxRequiresRedraw).length;
          totalSfxApproved += sfxApprovedCount;
          totalSfxReview += sfxReviewCount;
        }

        totalDetected += detectedRegions.length;

        if (detectedRegions.length > 0) {
          const ocrFormData = new FormData();
          ocrFormData.append('file', imgData.file);
          ocrFormData.append('model_key', selectedOcrKey);
          ocrFormData.append('language', srcLang);
          ocrFormData.append(
            'regions',
            JSON.stringify(
              detectedRegions.map((region) => ({
                id: region.id,
                bbox: toApiIntegerBbox(region.bbox, imgData.width, imgData.height),
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
              })),
            ),
          );
          if (useLlmSettingsForOcr) {
            ocrFormData.append('llm_settings', JSON.stringify(llmSettings));
            const customPayload = toCustomLlmRequestPayload(selectedCustomOcrProfile);
            if (customPayload) {
              ocrFormData.append('custom_llm', JSON.stringify(customPayload));
            }
          }

          const ocrRequestUrl = `${localApiUrl}/ocr`;
          const ocrResponse = await fetchWithTimeoutAndRetry(
            ocrRequestUrl,
            { method: 'POST', body: ocrFormData },
            { timeoutMs: 90_000, retryCount: 0 },
          );
          if (!ocrResponse.ok) {
            const message = await parseApiError(ocrResponse);
            throw new Error(`Failed to recognize text in "${imgData.file.name}": ${message}`);
          }

          const ocrPayload = (await ocrResponse.json()) as OcrApiResponse;
          const ocrById = new Map(ocrPayload.regions.map((region) => [String(region.id), region]));
          detectedRegions = detectedRegions.map((region) => {
            const match = ocrById.get(String(region.id)) ?? null;
            if (!match) return region;
            return {
              ...region,
              recognizedText: match.text,
              ocrScore: match.score,
              ocrModelKey: match.ocr_model_key,
              detectedGradient: normalizeDetectedGradient(match.foreground_gradient),
            };
          });
          totalRecognized += detectedRegions.filter((region) => (region.recognizedText ?? '').trim().length > 0).length;
        }

        const hasTextForTranslation = detectedRegions.some((region) => (region.recognizedText ?? '').trim().length > 0);
        if (hasTextForTranslation) {
          const translationFormData = new FormData();
          translationFormData.append('model_key', selectedTranslationKey);
          translationFormData.append('source_language', srcLang);
          translationFormData.append('target_language', tgtLang);
          if (translatorVisualProcessingMode === 'ai_sfx') {
            translationFormData.append('translation_mode', 'sfx');
            translationFormData.append(
              'extra_context',
              buildSfxTranslationInstructions(
                String((llmSettings as { extra_context?: string } | null)?.extra_context ?? ''),
                translatorSfxAdditionalInstructions,
              ),
            );
          }
          translationFormData.append(
            'regions',
            JSON.stringify(
              detectedRegions.map((region) => ({
                id: region.id,
                text: region.recognizedText ?? '',
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
                ocr_model_key: region.ocrModelKey ?? selectedOcrKey,
                detected_render_mode: region.detectedRenderMode ?? '',
                structural_type: region.structuralType ?? '',
                sfx_requires_redraw: region.sfxRequiresRedraw ?? false,
              })),
            ),
          );
          if (useLlmSettingsForTranslation) {
            translationFormData.append('file', imgData.file);
            translationFormData.append(
              'llm_settings',
              JSON.stringify(
                translatorVisualProcessingMode === 'ai_sfx'
                  ? {
                      ...(llmSettings as Record<string, unknown>),
                      extra_context: buildSfxTranslationInstructions(
                        String((llmSettings as { extra_context?: string } | null)?.extra_context ?? ''),
                        translatorSfxAdditionalInstructions,
                      ),
                      translation_notes_enabled: false,
                    }
                  : llmSettings,
              ),
            );
            const customPayload = toCustomLlmRequestPayload(selectedCustomTranslationProfile);
            if (customPayload) {
              translationFormData.append('custom_llm', JSON.stringify(customPayload));
            }
          }

          const translationRequestUrl = `${localApiUrl}/translate`;
          const translationResponse = await fetchWithTimeoutAndRetry(
            translationRequestUrl,
            { method: 'POST', body: translationFormData },
            { timeoutMs: 120_000, retryCount: 0 },
          );
          if (!translationResponse.ok) {
            const message = await parseApiError(translationResponse);
            throw new Error(`Failed to translate text in "${imgData.file.name}": ${message}`);
          }

          const translationPayload = (await translationResponse.json()) as TranslationApiResponse;
          const translationById = new Map(translationPayload.regions.map((region) => [region.id, region]));
          detectedRegions = detectedRegions.map((region) => {
            const match = translationById.get(region.id) ?? null;
            if (!match) return region;
            return {
              ...region,
              translatedText: match.translated_text,
              translationNotes: normalizeTranslationNotes(match.translation_notes),
              translationNoteOverlay: undefined,
              translatorModelKey: match.translator_model_key,
            };
          });
          totalTranslated += detectedRegions.filter((region) => (region.translatedText ?? '').trim().length > 0).length;
        }

        if (translatorVisualProcessingMode === 'ai_sfx' && detectedRegions.length > 0) {
          const cleanFormData = new FormData();
          cleanFormData.append('file', imgData.file);
          cleanFormData.append('model_key', translatorSfxCleanModelKey);
          cleanFormData.append(
            'regions',
            JSON.stringify(buildSfxClassifierRegionsPayload(detectedRegions, imgData)),
          );
          cleanFormData.append(
            'additional_instructions',
            buildSfxCleanInstructions(translatorSfxAdditionalInstructions),
          );
          const customCleanPayload = toCustomLlmRequestPayload(
            selectedTranslatorSfxCleanCustomProfile,
          );
          if (customCleanPayload) {
            cleanFormData.append('custom_llm', JSON.stringify(customCleanPayload));
          }
          const cleanResponse = await fetchWithTimeoutAndRetry(
            `${localApiUrl}/clean/ai`,
            { method: 'POST', body: cleanFormData },
            { timeoutMs: 240_000, retryCount: 0 },
          );
          if (!cleanResponse.ok) {
            const message = await parseApiError(cleanResponse);
            throw new Error(`Failed to clean SFX in "${imgData.file.name}": ${message}`);
          }
          const cleanBlob = await cleanResponse.blob();
          if (!cleanBlob.type.startsWith('image/')) {
            throw new Error(t('translatorVisual.invalidSfxResponse', { fileName: imgData.file.name }));
          }
          processedBaseDataUrl = await blobToDataUrl(cleanBlob);
        }

        processedPagesCount += 1;

        nextDetections[imgData.id] = cloneAioRegions(detectedRegions, cloneRenderStyle);
        nextSelections[imgData.id] = resolveSelectedRegionForRegions(detectedRegions, activeId === imgData.id ? activeTranslatorSelectedRegionId : null);
        if (processedBaseDataUrl) {
          nextProcessedBase[imgData.id] = processedBaseDataUrl;
        }
        nextMeta[imgData.id] = {
          detected: true,
          ocr: detectedRegions.some((region) => typeof region.ocrScore === 'number' || Boolean(region.recognizedText?.trim())),
          translated: detectedRegions.some((region) => Boolean(region.translatedText?.trim())),
          detectModelKey: detectSelectionKey,
          ocrModelKey: selectedOcrKey,
          translatorModelKey: selectedTranslationKey,
          sourceLanguage: srcLang,
          targetLanguage: tgtLang,
          visualMode: translatorVisualProcessingMode,
          sfxCandidateCount,
          sfxApprovedCount,
          sfxReviewCount,
          cleanModelKey:
            translatorVisualProcessingMode === 'ai_sfx'
              ? translatorSfxCleanModelKey
              : null,
        };
        setProgress(((index + 1) / images.length) * 100);
      }

      setTranslatorDetectionsByImage(nextDetections);
      setTranslatorSelectedRegionByImage(nextSelections);
      setTranslatorRunMetaByImage(nextMeta);
      setTranslatorProcessedBaseByImage(nextProcessedBase);
      setLastActionScope('translator');

      if (processedPagesCount > 0) {
        recordProcessedPages(processedPagesCount);
      }

      emitProcessCompleteWebhook('Tradutor Visual', images.length, {
        imagens_processadas: images.length,
        regioes_detectadas: totalDetected,
        textos_reconhecidos: totalRecognized,
        traducoes_geradas: totalTranslated,
        sfx_candidatas: totalSfxCandidates,
        sfx_aprovadas: totalSfxApproved,
        sfx_review: totalSfxReview,
        paginas_processadas: processedPagesCount,
      });
      setStatusMessage(
        translatorVisualProcessingMode === 'ai_sfx'
          ? t('translatorVisual.done.aiSfx', { candidates: totalSfxCandidates, approved: totalSfxApproved, ocr: totalRecognized, translations: totalTranslated, redraw: totalSfxReview })
          : t('translatorVisual.done.standard', { detected: totalDetected, recognized: totalRecognized, translated: totalTranslated }),
      );
    } catch (error) {
      emitProcessErrorWebhook('Tradutor Visual', images.length, error, {
        idioma_origem: srcLang,
        idioma_destino: tgtLang,
      });
      setStatusMessage(error instanceof Error ? error.message : t('translatorVisual.genericError'));
    } finally {
      setTranslatorVisualRunning(false);
      setProcessing(false);
      setProgress(0);
      void syncDiscordForTab();
    }
  }, [
    activeId,
    activeTranslatorSelectedRegionId,
    detectSelectionKey,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    emitProcessStartWebhook,
    ensureVerifiedEmailOrNotify,
    images,
    llmSettings,
    localApiUrl,
    minRegionSize,
    parseApiError,
    resolveTranslatorOcrExecution,
    resolveTranslatorTranslationExecution,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    selectedTranslatorSfxCleanCustomProfile,
    setDiscordTranslating,
    setLastActionScope,
    setProcessing,
    setProgress,
    setStatusMessage,
    setTranslatorDetectionsByImage,
    setTranslatorProcessedBaseByImage,
    setTranslatorRunMetaByImage,
    setTranslatorSelectedRegionByImage,
    setTranslatorVisualRunning,
    setTranslatorWorkspaceMode,
    translatorSfxAdditionalInstructions,
    translatorSfxCleanModelKey,
    translatorVisualProcessingMode,
    srcLang,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    tgtLang,
    validateManualLocalStageModel,
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
  activeTranslatorSelectedRegionId: string | null;
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
  activeTranslatorSelectedRegionId,
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

      const translationFormData = new FormData();
      translationFormData.append('model_key', selectedTranslationKey);
      translationFormData.append('source_language', srcLang);
      translationFormData.append('target_language', tgtLang);
      if (translatorVisualProcessingMode === 'ai_sfx') {
        translationFormData.append('translation_mode', 'sfx');
        translationFormData.append(
          'extra_context',
          buildSfxTranslationInstructions(
            String((llmSettings as { extra_context?: string } | null)?.extra_context ?? ''),
            translatorSfxAdditionalInstructions,
          ),
        );
      }
      translationFormData.append(
        'regions',
        JSON.stringify(
          targetRegions.map((region) => ({
            id: region.id,
            text: region.recognizedText ?? '',
            source: region.source,
            detector_model_key: region.detectorModelKey ?? region.modelKey,
            ocr_model_key: region.ocrModelKey ?? ocrSelectionKey,
            detected_render_mode: region.detectedRenderMode ?? '',
            structural_type: region.structuralType ?? '',
            sfx_requires_redraw: region.sfxRequiresRedraw ?? false,
          })),
        ),
      );
      if (useLlmSettingsForTranslation) {
        translationFormData.append('file', imgData.file);
        translationFormData.append(
          'llm_settings',
          JSON.stringify(
            translatorVisualProcessingMode === 'ai_sfx'
              ? {
                  ...(llmSettings as Record<string, unknown>),
                  extra_context: buildSfxTranslationInstructions(
                    String((llmSettings as { extra_context?: string } | null)?.extra_context ?? ''),
                    translatorSfxAdditionalInstructions,
                  ),
                  translation_notes_enabled: false,
                }
              : llmSettings,
          ),
        );
        const customPayload = toCustomLlmRequestPayload(
          selectedCustomTranslationProfile as unknown as Parameters<typeof toCustomLlmRequestPayload>[0],
        );
        if (customPayload) {
          translationFormData.append('custom_llm', JSON.stringify(customPayload));
        }
      }

      const translationRequestUrl = `${localApiUrl}/translate`;
      const translationResponse = await fetchWithTimeoutAndRetry(
        translationRequestUrl,
        { method: 'POST', body: translationFormData },
        { timeoutMs: 120_000, retryCount: 0 },
      );
      if (!translationResponse.ok) {
        const message = await parseApiError(translationResponse);
        throw new Error(`Failed to retranslate "${imgData.file.name}": ${message}`);
      }

      const translationPayload = (await translationResponse.json()) as TranslationApiResponse;
      const translationById = new Map(translationPayload.regions.map((region) => [region.id, region]));
      const nextRegions = regions.map((region) => {
        const match = translationById.get(region.id);
        if (!match) return region;
        return {
          ...region,
          translatedText: match.translated_text,
          translationNotes: normalizeTranslationNotes(match.translation_notes),
          translationNoteOverlay: undefined,
          translatorModelKey: match.translator_model_key,
        };
      });
      updateTranslatorRegionsForImage(imageId, nextRegions, activeTranslatorSelectedRegionId);
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
    activeTranslatorSelectedRegionId,
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

/* ── Active translator region state: memos for the active image
   (translator store + llm translation-notes setting) ── */

export function useActiveTranslatorRegionState({ resolvedActiveId }: { resolvedActiveId: string | null }) {
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const translatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.translatorSelectedRegionByImage,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const activeTranslatorImageDetections = useMemo(
    () =>
      resolvedActiveId
        ? (translatorDetectionsByImage[resolvedActiveId] ?? [])
        : [],
    [resolvedActiveId, translatorDetectionsByImage],
  );
  const activeTranslatorSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (translatorSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [resolvedActiveId, translatorSelectedRegionByImage],
  );
  const activeTranslatorSelectedRegion = useMemo(
    () =>
      activeTranslatorImageDetections.find(
        (region) => region.id === activeTranslatorSelectedRegionId,
      ) ?? null,
    [activeTranslatorImageDetections, activeTranslatorSelectedRegionId],
  );
  const activeTranslatorSelectedTranslationNotes = useMemo(
    () =>
      activeTranslatorSelectedRegion
        ? getRegionTranslationNotesForDisplay(
            activeTranslatorSelectedRegion,
            llmSettings.translation_notes_enabled,
          )
        : [],
    [activeTranslatorSelectedRegion, llmSettings.translation_notes_enabled],
  );

  return {
    activeTranslatorImageDetections,
    activeTranslatorSelectedRegionId,
    activeTranslatorSelectedRegion,
    activeTranslatorSelectedTranslationNotes,
  };
}


/* ── Translator SFX/OCR options: stage option lists for the visual translator,
   SFX clean model selection and translation-model compatibility
   (translator + aio store reads; llm profile data, the cleaner option list and
   the aio selectable callback arrive by args) ── */

export function useTranslatorSfxOptions({
  modelManagerState,
  selectedCustomOcrProfile,
  customOcrStageOptions,
  ocrCustomProfiles,
  cleanerAiOptionsForSelect,
  isStageOptionSelectable,
}: {
  modelManagerState: { entries: Record<string, ModelInstallState> };
  selectedCustomOcrProfile: CustomLlmProfile | null;
  customOcrStageOptions: AioStageOption[];
  ocrCustomProfiles: CustomLlmProfile[];
  cleanerAiOptionsForSelect: AioStageOption[];
  isStageOptionSelectable: (option: AioStageOption | null | undefined) => boolean;
}) {
  const t = useI18n().t;
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const translatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.translatorSfxCleanModelKey,
  );
  const setTranslatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.setTranslatorSfxCleanModelKey,
  );
  const selectedTranslationModelState = useMemo(
    () => modelManagerState.entries[aioStageSelection.getTranslations] ?? null,
    [aioStageSelection.getTranslations, modelManagerState.entries],
  );
  const translatorSelectedLocalTranslationCompatible = useMemo(() => {
    if (!selectedTranslationModelState) return true;
    const modelDefinition =
      TRANSLATION_MODELS_BY_ID[selectedTranslationModelState.model.id] ?? null;
    if (!modelDefinition) return true;
    return modelSupportsLanguage(modelDefinition, srcLang, tgtLang);
  }, [selectedTranslationModelState, srcLang, tgtLang]);
  const filteredTranslatorOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, srcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [aioStageOptions.recognizeText, srcLang]);
  const translatorOcrStageOptionsForSelect = useMemo(() => {
    const selectedKey = aioStageSelection.recognizeText;
    const selectedOption = selectedCustomOcrProfile
      ? buildCustomStageOption(selectedCustomOcrProfile)
      : (customOcrStageOptions.find((option) => option.key === selectedKey) ??
        null);
    if (!selectedOption) {
      return filteredTranslatorOcrStageOptions;
    }
    if (
      filteredTranslatorOcrStageOptions.some(
        (option) => option.key === selectedOption.key,
      )
    ) {
      return filteredTranslatorOcrStageOptions;
    }
    return [...filteredTranslatorOcrStageOptions, selectedOption];
  }, [
    aioStageSelection.recognizeText,
    buildCustomStageOption,
    customOcrStageOptions,
    filteredTranslatorOcrStageOptions,
    selectedCustomOcrProfile,
  ]);
  const selectedTranslatorOcrCloudOption = useMemo(
    () =>
      translatorOcrStageOptionsForSelect.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ?? null,
    [aioStageSelection.recognizeText, translatorOcrStageOptionsForSelect],
  );
  const selectedTranslatorSfxCleanCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(
        translatorSfxCleanModelKey,
        ocrCustomProfiles,
      ),
    [ocrCustomProfiles, translatorSfxCleanModelKey],
  );
  const selectedTranslatorSfxCleanDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find(
        (option) => option.key === translatorSfxCleanModelKey,
      ) ?? null
    );
  }, [cleanerAiOptionsForSelect, translatorSfxCleanModelKey]);
  const translatorAvailableOcrStageOptions = useMemo(
    () =>
      translatorOcrStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, translatorOcrStageOptionsForSelect],
  );
  const selectTranslatorSfxCleanModel = useCallback(
    (modelKey: string) => {
      const option = cleanerAiOptionsForSelect.find(
        (item) => item.key === modelKey,
      );
      if (!option) {
        setTonedStatus(t('dashboard.status.translatorSfxSelectValidModel'), 'error');
        return;
      }
      if (!option.implemented) {
        setTonedStatus(t('dashboard.status.modelInRoadmap', { name: option.name }), 'error');
        return;
      }
      if (!option.available) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setTranslatorSfxCleanModelKey(modelKey);
    },
    [cleanerAiOptionsForSelect, setStatusMessage, setTonedStatus, setTranslatorSfxCleanModelKey],
  );
  return {
    selectedTranslationModelState,
    translatorSelectedLocalTranslationCompatible,
    filteredTranslatorOcrStageOptions,
    translatorOcrStageOptionsForSelect,
    selectedTranslatorOcrCloudOption,
    selectedTranslatorSfxCleanCustomProfile,
    selectedTranslatorSfxCleanDisplayOption,
    translatorAvailableOcrStageOptions,
    selectTranslatorSfxCleanModel,
  };
}
