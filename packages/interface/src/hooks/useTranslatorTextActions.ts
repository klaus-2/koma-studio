import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { parseTranslatorStructuredTextInput } from '../utils/dashboard.utils';
import { type CustomLlmProfile, toCustomLlmRequestPayload } from '../utils/customLlm';
import type {
  TranslationApiResponse,
  TranslatorTextRequestRegion,
} from '../types/dashboard.types';

interface TranslationExecutionResult {
  selectedTranslationKey: string;
  useCloudTranslation: boolean;
  useLlmSettingsForTranslation: boolean;
}

interface UseTranslatorTextActionsArgs {
  translatorDraftText: string;
  srcLang: string;
  tgtLang: string;
  llmSettings: unknown;
  localApiUrl: string;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  parseApiError: (response: Response) => Promise<string>;
  resolveTranslatorTranslationExecution: () => Promise<TranslationExecutionResult>;
  emitProcessStartWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessCompleteWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessErrorWebhook: (processName: string, pages: number, error: unknown, context?: Record<string, unknown>) => void;
  setDiscordTranslating: (targetLabel: string, sourceLanguage: string, targetLanguage: string) => Promise<void>;
  syncDiscordForTab: () => Promise<void> | void;
  recordProcessedPages: (pages: number) => void;
  setProcessing: (value: boolean) => void;
  setTranslatorTextRunning: (value: boolean) => void;
  setProgress: (value: number) => void;
  setTranslatorTranslatedText: (value: string) => void;
  setTranslatorLastTextModelUsed: (value: string) => void;
  setTranslatorTextDirty: (value: boolean) => void;
  setLastActionScope: (value: 'translator') => void;
  setStatusMessage: (value: string) => void;
}

export function useTranslatorTextActions({
  translatorDraftText,
  srcLang,
  tgtLang,
  llmSettings,
  localApiUrl,
  selectedCustomTranslationProfile,
  ensureVerifiedEmailOrNotify,
  parseApiError,
  resolveTranslatorTranslationExecution,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  setDiscordTranslating,
  syncDiscordForTab,
  recordProcessedPages,
  setProcessing,
  setTranslatorTextRunning,
  setProgress,
  setTranslatorTranslatedText,
  setTranslatorLastTextModelUsed,
  setTranslatorTextDirty,
  setLastActionScope,
  setStatusMessage,
}: UseTranslatorTextActionsArgs) {
  const { t } = useI18n();

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
