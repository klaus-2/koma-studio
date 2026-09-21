/**
 * Translator domain — entry point. Hosts the visual batch run (detect →
 * [sfx classify] → ocr → translate → [sfx clean]) and re-exports the
 * per-concern sibling modules split out in T10, so consumer imports from
 * 'hooks/translator' stay valid.
 */
import { useCallback } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_STAGE_LABELS, MIN_REGION_SIZE } from '../../../constants/dashboard.constants';
import { toCustomLlmRequestPayload, type CustomLlmProfile } from '../../../utils/customLlm';
import {
  blobToDataUrl,
  cloneAioRegions,
  cloneRenderStyle,
  normalizeDetectedGradient,
  normalizeRgbTriplet,
  normalizeTranslationNotes,
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
  TranslatorVisualRunMeta,
} from '../../../types/dashboard.types';
import { parseApiError } from '../helpers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import type { TranslationExecutionResult } from './translator.execution';

export {
  useTranslatorRegionEditing,
  useTranslatorImports,
  useActiveTranslatorRegionState,
} from './translator.inputs';
export {
  useTranslatorExecutionResolvers,
  useTranslatorTextActions,
  useTranslatorRetranslate,
} from './translator.execution';
export { useTranslatorSfxOptions } from './translator.options';

/* ── Visual batch run (detect → [sfx classify] → ocr → translate → [sfx clean]) ── */

interface OcrExecutionResult {
  selectedOcrKey: string;
  useCloudOcr: boolean;
  useLlmSettingsForOcr: boolean;
}

interface UseTranslatorVisualActionsArgs {
  /* Cross-domain values (image-collection, page memos & callbacks, export-download T10) */
  images: LoadedImage[];
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

      // ponytail: sequential by design — per-page pipeline: ordered per-page progress and a failure stops the batch
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
        nextSelections[imgData.id] = resolveSelectedRegionForRegions(
          detectedRegions,
          // Event-time read of the active translator selection
          activeId === imgData.id
            ? (useTranslatorStore.getState().translatorSelectedRegionByImage[imgData.id] ?? null)
            : null,
        );
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
