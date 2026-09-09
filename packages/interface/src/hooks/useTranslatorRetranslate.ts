import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import {
  normalizeTranslationNotes,
} from '../utils/dashboard.utils';
import { toCustomLlmRequestPayload } from '../utils/customLlm';
import { buildSfxTranslationInstructions } from '../utils/sfx';
import type {
  AioTextRegion,
  LoadedImage,
  TranslatorVisualProcessingMode,
  TranslationApiResponse,
  TranslatorVisualRunMeta,
} from '../types/dashboard.types';

interface CustomProfileLike {
  apiBase: string;
  apiKey: string;
  model?: string;
}

interface TranslationExecutionResult {
  selectedTranslationKey: string;
  useCloudTranslation: boolean;
  useLlmSettingsForTranslation: boolean;
}

interface UseTranslatorRetranslateArgs {
  images: LoadedImage[];
  translatorDetectionsByImage: Record<string, AioTextRegion[]>;
  activeTranslatorSelectedRegionId: string | null;
  translatorVisualProcessingMode: TranslatorVisualProcessingMode;
  translatorSfxAdditionalInstructions: string;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  srcLang: string;
  tgtLang: string;
  llmSettings: unknown;
  localApiUrl: string;
  selectedCustomTranslationProfile: CustomProfileLike | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  parseApiError: (response: Response) => Promise<string>;
  resolveTranslatorTranslationExecution: () => Promise<TranslationExecutionResult>;
  setDiscordTranslating: (targetLabel: string, sourceLanguage: string, targetLanguage: string) => Promise<void>;
  syncDiscordForTab: () => Promise<void> | void;
  recordProcessedPages: (pages: number) => void;
  updateTranslatorRegionsForImage: (imageId: string, nextRegions: AioTextRegion[], nextSelectedRegionId?: string | null) => void;
  setTranslatorRunMetaByImage: React.Dispatch<React.SetStateAction<Record<string, TranslatorVisualRunMeta>>>;
  setLastActionScope: (value: 'translator') => void;
  setProcessing: (value: boolean) => void;
  setTranslatorVisualRunning: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (value: string) => void;
}

export function useTranslatorRetranslate({
  images,
  translatorDetectionsByImage,
  activeTranslatorSelectedRegionId,
  translatorVisualProcessingMode,
  translatorSfxAdditionalInstructions,
  detectSelectionKey,
  ocrSelectionKey,
  srcLang,
  tgtLang,
  llmSettings,
  localApiUrl,
  selectedCustomTranslationProfile,
  ensureVerifiedEmailOrNotify,
  parseApiError,
  resolveTranslatorTranslationExecution,
  setDiscordTranslating,
  syncDiscordForTab,
  recordProcessedPages,
  updateTranslatorRegionsForImage,
  setTranslatorRunMetaByImage,
  setLastActionScope,
  setProcessing,
  setTranslatorVisualRunning,
  setProgress,
  setStatusMessage,
}: UseTranslatorRetranslateArgs) {
  const { t } = useI18n();

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
