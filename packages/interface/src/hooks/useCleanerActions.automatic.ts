
import { AIO_STAGE_LABELS } from '../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
  normalizeRgbTriplet,
  toApiIntegerBbox,
} from '../utils/dashboard.utils';
import { normalizeDetectedRenderMode } from '../utils/renderModes';
import {
  applySfxDecisionsToRegions,
  buildSfxClassifierInstructions,
  buildSfxClassifierRegionsPayload,
  buildSfxCleanInstructions,
  isLikelySfxCandidate,
  type SfxClassificationResponse,
} from '../utils/sfx';
import {
  normalizeKnownCustomLlmApiBase,
  requiresCustomLlmApiKey,
} from '../utils/customLlm';
import { runConcurrentBatch } from '../utils/concurrentBatch';
import { createDefaultTypographyShape } from '../typography/types';
import type {
  AioTextRegion,
  CleanerRunMeta,
  DetectApiResponse,
  LoadedImage,
} from '../types/dashboard.types';
import type { useI18n } from '../i18n';
import type { UseCleanerActionsArgs } from './useCleanerActions';

type I18nTranslate = ReturnType<typeof useI18n>['t'];

type CleanerAutomaticWorkflowContext = UseCleanerActionsArgs & {
  t: I18nTranslate;
};

export async function runAutomaticCleanerWorkflow(
  ctx: CleanerAutomaticWorkflowContext,
): Promise<void> {
  const {
    images,
    localApiUrl,
    detectSelectionKey,
    cleanerMode,
    cleanerAiModelKey,
    selectedCleanerCustomProfile,
    cleanerAiAdditionalInstructions,
    sourceLanguage,
    effectiveBatchConcurrency,
    minRegionSize,
    discord,
    validateManualLocalStageModel,
    parseApiError,
    registerDownloads,
    emitProcessStartWebhook,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    syncDiscordForTab,
    setCleanerDetectionsByImage,
    setCleanerSelectedRegionByImage,
    setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage,
    setCleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    onRunComplete,
    t,
  } = ctx;
  const translate = (key: string, vars?: Record<string, unknown>) =>
    t(key as Parameters<I18nTranslate>[0], vars as Parameters<I18nTranslate>[1]);

    const isAutomaticAiMode = cleanerMode === 'automatic_ai';
    const isAiSfxMode = cleanerMode === 'ai_sfx';
    const isCustomCleanerAi = cleanerAiModelKey.startsWith('custom_clean');
    const normalizedCleanerAiInstructions = cleanerAiAdditionalInstructions.trim();

    if (isAutomaticAiMode || isAiSfxMode) {
      if (
        !validateManualLocalStageModel(
          'detectText',
          AIO_STAGE_LABELS.detectText,
          detectSelectionKey,
        )
      ) {
        return;
      }

      const normalizedCustomApiBase = normalizeKnownCustomLlmApiBase(
        selectedCleanerCustomProfile?.apiBase ?? '',
      );
      const normalizedCustomModel = selectedCleanerCustomProfile?.model?.trim() ?? '';
      const normalizedCustomApiKey = selectedCleanerCustomProfile?.apiKey.trim() ?? '';
      const customCleanerPayload = isCustomCleanerAi
        ? {
            api_base: normalizedCustomApiBase,
            model: normalizedCustomModel,
            ...(normalizedCustomApiKey
              ? { api_key: normalizedCustomApiKey }
              : {}),
          }
        : null;

      if (isCustomCleanerAi) {
        if (!normalizedCustomApiBase || !normalizedCustomModel) {
          setStatusMessage(
            'Fill in API Base and Model before running Automatic AI Clean with AI Custom.',
          );
          return;
        }
        if (
          requiresCustomLlmApiKey(normalizedCustomApiBase)
          && !normalizedCustomApiKey
        ) {
          setStatusMessage(
            'This AI Custom provider requires an API key for Automatic AI Clean.',
          );
          return;
        }
      }

      setCleanerManualImageEditsByImage({});
      setCleanerHealingBusyByImage({});
      setProcessing(true);
      setProgress(0);
      setStatusMessage(
        effectiveBatchConcurrency > 1
          ? `Executando ${isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean'} em lote com ${effectiveBatchConcurrency} threads...`
          : `Executando ${isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean'} em lote...`,
      );
      emitProcessStartWebhook(isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean', images.length, {
        threads: effectiveBatchConcurrency,
        modelo_ai: cleanerAiModelKey,
        detector_modelo: detectSelectionKey,
        custom_provider: isCustomCleanerAi,
      });
      await discord.setPreset('cleaner_redraw_mode', {
        details: translate('discord.presence.cleaner.details'),
        state: translate('discord.presence.cleaner.state.advanced'),
      });

      try {
        const results = await runConcurrentBatch({
          items: images,
          concurrency: effectiveBatchConcurrency,
          worker: async ({
            item: imgData,
            index,
          }: {
            item: LoadedImage;
            index: number;
          }) => {
            await discord.setPreset('batch_mode', {
              details: translate('discord.presence.batch.fileDetails', { fileName: imgData.file.name }),
              state: translate('discord.presence.batch.state', { current: index + 1, total: images.length }),
            });

            const detectFormData = new FormData();
            detectFormData.append('file', imgData.file);
            detectFormData.append('model_key', detectSelectionKey);
            detectFormData.append('language', sourceLanguage);
            detectFormData.append('source_language', sourceLanguage);

            const detectResponse = await fetchWithTimeoutAndRetry(
              `${localApiUrl}/detect`,
              { method: 'POST', body: detectFormData },
              { timeoutMs: 90_000, retryCount: 0 },
            );
            if (!detectResponse.ok) {
              const apiMessage = await parseApiError(detectResponse);
              throw new Error(
                t('cleanerActions.detectFailed', { fileName: imgData.file.name, message: apiMessage }),
              );
            }

            const detectPayload =
              (await detectResponse.json()) as DetectApiResponse;
            const sourceWidth =
              detectPayload.image_width > 0
                ? detectPayload.image_width
                : imgData.width;
            const sourceHeight =
              detectPayload.image_height > 0
                ? detectPayload.image_height
                : imgData.height;
            const scaleX = imgData.width / Math.max(1, sourceWidth);
            const scaleY = imgData.height / Math.max(1, sourceHeight);
            const detectDetections = detectPayload.detections
              .map((item): AioTextRegion | null => {
                const [bx1, by1, bx2, by2] = item.bbox;
                const rawX1 = clamp(Math.min(bx1, bx2), 0, sourceWidth);
                const rawY1 = clamp(Math.min(by1, by2), 0, sourceHeight);
                const rawX2 = clamp(Math.max(bx1, bx2), 0, sourceWidth);
                const rawY2 = clamp(Math.max(by1, by2), 0, sourceHeight);
                const x1 = Math.round(clamp(rawX1 * scaleX, 0, imgData.width));
                const y1 = Math.round(clamp(rawY1 * scaleY, 0, imgData.height));
                const x2 = Math.round(clamp(rawX2 * scaleX, 0, imgData.width));
                const y2 = Math.round(clamp(rawY2 * scaleY, 0, imgData.height));
                if ((x2 - x1) < minRegionSize || (y2 - y1) < minRegionSize) {
                  return null;
                }
                const detectedRenderMode = normalizeDetectedRenderMode(item.label) ?? 'text_bubble';

                return {
                  id: item.id,
                  bbox: [x1, y1, x2, y2],
                  score: item.score,
                  source: item.source,
                  modelKey: item.model_key,
                  detectorModelKey: item.model_key,
                  detectedForegroundRgb: normalizeRgbTriplet(
                    item.foreground_rgb,
                  ),
                  structuralType: item.structural_type ?? undefined,
                  structuralConfidence: item.structural_confidence ?? undefined,
                  structuralSource: item.structural_source ?? undefined,
                  matchedReferenceImage:
                    item.matched_reference_image ?? undefined,
                  detectedRenderMode,
                  renderMode: 'auto',
                  shape: createDefaultTypographyShape(
                    x2 - x1,
                    y2 - y1,
                    detectedRenderMode === 'text_bubble' || detectedRenderMode === 'text_inside_black_bubble'
                      ? 'rounded'
                      : 'square',
                    'detected',
                  ),
                };
              })
              .filter((item): item is AioTextRegion => item !== null);

            let outputRegions = detectDetections;
            let candidateCount = detectDetections.length;
            let approvedCount = detectDetections.length;
            let reviewCount = 0;
            let blob: Blob;

            if (isAiSfxMode) {
              const candidateRegions = detectDetections.filter(isLikelySfxCandidate);
              candidateCount = candidateRegions.length;
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
                classifyFormData.append('model_key', cleanerAiModelKey);
                classifyFormData.append(
                  'regions',
                  JSON.stringify(buildSfxClassifierRegionsPayload(candidateRegions, imgData)),
                );
                classifyFormData.append(
                  'additional_instructions',
                  buildSfxClassifierInstructions(normalizedCleanerAiInstructions),
                );
                if (customCleanerPayload) {
                  classifyFormData.append('custom_llm', JSON.stringify(customCleanerPayload));
                }

                const classifyResponse = await fetchWithTimeoutAndRetry(
                  `${localApiUrl}/sfx/classify`,
                  { method: 'POST', body: classifyFormData },
                  { timeoutMs: 180_000, retryCount: 0 },
                );
                if (!classifyResponse.ok) {
                  const apiMessage = await parseApiError(classifyResponse);
                  throw new Error(
                    `Failed to classify SFX in "${imgData.file.name}": ${apiMessage}`,
                  );
                }
                const classifyPayload =
                  (await classifyResponse.json()) as SfxClassificationResponse;
                enrichedCandidates = applySfxDecisionsToRegions(
                  candidateRegions,
                  classifyPayload.regions,
                );
              }

              outputRegions = enrichedCandidates.filter((region) => region.sfxApproved);
              approvedCount = outputRegions.length;
              reviewCount = outputRegions.filter((region) => region.sfxRequiresRedraw).length;

              if (outputRegions.length === 0) {
                blob = imgData.file;
              } else {
                const cleanFormData = new FormData();
                cleanFormData.append('file', imgData.file);
                cleanFormData.append('model_key', cleanerAiModelKey);
                cleanFormData.append(
                  'regions',
                  JSON.stringify(buildSfxClassifierRegionsPayload(outputRegions, imgData)),
                );
                cleanFormData.append(
                  'additional_instructions',
                  buildSfxCleanInstructions(normalizedCleanerAiInstructions),
                );
                if (customCleanerPayload) {
                  cleanFormData.append('custom_llm', JSON.stringify(customCleanerPayload));
                }

                const cleanResponse = await fetchWithTimeoutAndRetry(
                  `${localApiUrl}/clean/ai`,
                  { method: 'POST', body: cleanFormData },
                  { timeoutMs: 240_000, retryCount: 0 },
                );
                if (!cleanResponse.ok) {
                  const apiMessage = await parseApiError(cleanResponse);
                  throw new Error(
                    `AI SFX Cleaner failed for "${imgData.file.name}": ${apiMessage}`,
                  );
                }
                blob = await cleanResponse.blob();
                if (!blob.type.startsWith('image/')) {
                  throw new Error(
                    t('cleanerActions.invalidSfxResponse', { fileName: imgData.file.name }),
                  );
                }
              }
            } else {
              const cleanFormData = new FormData();
              cleanFormData.append('file', imgData.file);
              cleanFormData.append('model_key', cleanerAiModelKey);
              cleanFormData.append(
                'regions',
                JSON.stringify(
                  detectDetections.map((region) => ({
                    id: region.id,
                    bbox: toApiIntegerBbox(
                      region.bbox,
                      imgData.width,
                      imgData.height,
                    ),
                    source: region.source,
                    detector_model_key: region.detectorModelKey ?? region.modelKey,
                    score: region.score ?? 0,
                    structural_type: region.structuralType ?? null,
                    structural_confidence: region.structuralConfidence ?? null,
                    structural_source: region.structuralSource ?? null,
                    matched_reference_image: region.matchedReferenceImage ?? null,
                    detected_render_mode: region.detectedRenderMode ?? null,
                  })),
                ),
              );
              if (normalizedCleanerAiInstructions) {
                cleanFormData.append(
                  'additional_instructions',
                  normalizedCleanerAiInstructions,
                );
              }
              if (customCleanerPayload) {
                cleanFormData.append(
                  'custom_llm',
                  JSON.stringify(customCleanerPayload),
                );
              }

              const cleanResponse = await fetchWithTimeoutAndRetry(
                `${localApiUrl}/clean/ai`,
                { method: 'POST', body: cleanFormData },
                { timeoutMs: 240_000, retryCount: 0 },
              );
              if (!cleanResponse.ok) {
                const apiMessage = await parseApiError(cleanResponse);
                throw new Error(
                  `Automatic AI Clean failed for "${imgData.file.name}": ${apiMessage}`,
                );
              }

              blob = await cleanResponse.blob();
              if (!blob.type.startsWith('image/')) {
                throw new Error(
                  t('cleanerActions.invalidAutoCleanResponse', { fileName: imgData.file.name }),
                );
              }
            }

            return {
              imageId: imgData.id,
              fileName: `${
                isAiSfxMode
                  ? 'koma-studio-ai-sfx-clean'
                  : 'koma-studio-automatic-ai-clean'
              }-${imgData.file.name.replace(/\s+/g, '-')}.png`,
              blob,
              baseImageDataUrl: await blobToDataUrl(blob),
              regions: cloneAioRegions(outputRegions, cloneRenderStyle),
              detectCount: outputRegions.length,
              candidateCount,
              approvedCount,
              reviewCount,
            };
          },
          onProgress: ({ completed }: { completed: number }) => {
            setProgress((completed / images.length) * 100);
          },
        });

        const outputs = results.map((result) => ({
          fileName: result.fileName,
          blob: result.blob,
          sourceImageId: result.imageId,
        }));
        registerDownloads(outputs, 'cleaner');

        const nextDetections: Record<string, AioTextRegion[]> = {};
        const nextSelections: Record<string, string | null> = {};
        const nextBaseByImage: Record<string, string> = {};
        const nextMeta: Record<string, CleanerRunMeta> = {};
        let totalDetected = 0;
        let totalCandidates = 0;
        let totalReviews = 0;

        results.forEach((result) => {
          nextDetections[result.imageId] = cloneAioRegions(
            result.regions,
            cloneRenderStyle,
          );
          nextSelections[result.imageId] =
            buildAioSelectionMapFromDetections({
              [result.imageId]: result.regions,
            })[result.imageId] ?? null;
          nextBaseByImage[result.imageId] = result.baseImageDataUrl;
          nextMeta[result.imageId] = {
            detected: result.detectCount > 0,
            ocrCount: 0,
            segmentedCount: 0,
            cleaned: true,
            detectModelKey: detectSelectionKey,
            ocrModelKey: null,
            segmentModelKey: null,
            cleanModelKey: cleanerAiModelKey,
            sourceLanguage,
            candidateCount: result.candidateCount ?? result.detectCount,
            approvedCount: result.approvedCount ?? result.detectCount,
            reviewCount: result.reviewCount ?? 0,
          };
          totalDetected += result.detectCount;
          totalCandidates += result.candidateCount ?? result.detectCount;
          totalReviews += result.reviewCount ?? 0;
        });

        setCleanerDetectionsByImage(nextDetections);
        setCleanerSelectedRegionByImage(nextSelections);
        setCleanerProcessedBaseByImage(nextBaseByImage);
        setCleanerRunMetaByImage(nextMeta);

        emitProcessCompleteWebhook(isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean', images.length, {
          imagens_limpas: outputs.length,
          regioes_detectadas: totalDetected,
          regioes_candidatas: totalCandidates,
          regioes_review: totalReviews,
          threads: effectiveBatchConcurrency,
          modelo_ai: cleanerAiModelKey,
        });
        setStatusMessage(
          isAiSfxMode
            ? t('cleanerActions.sfxDone', { images: outputs.length, candidates: totalCandidates, approved: totalDetected, redraw: totalReviews })
            : t('cleanerActions.autoCleanDone', { images: outputs.length, detected: totalDetected }),
        );
        onRunComplete?.();
      } catch (error) {
        emitProcessErrorWebhook(isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean', images.length, error, {
          threads: effectiveBatchConcurrency,
          modelo_ai: cleanerAiModelKey,
        });
        setStatusMessage(
          error instanceof Error
            ? error.message
            : `Failed to run ${isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean'}.`,
        );
      } finally {
        setProcessing(false);
        setProgress(0);
        void syncDiscordForTab();
      }

      return;
    }
}
