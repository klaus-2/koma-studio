import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import {
  applyStageReadinessRefusal,
  resolveCleanerAiProfileReadiness,
  resolveStageModelReadiness,
  runCleanImageAiStage,
  runDetectTextStage,
  runSfxClassifyStage,
  type StageRuntime,
} from '../../../aio-stages';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  cloneAioRegions,
  cloneRenderStyle,
} from '../../../utils/dashboard.utils';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import {
  applySfxDecisionsToRegions,
  buildSfxClassifierInstructions,
  buildSfxCleanInstructions,
  isLikelySfxCandidate,
} from '../../../utils/sfx';
import type {
  AioTextRegion,
  CleanerRunMeta,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { CleanerRunContext, I18nTranslate } from './cleaner.types';

export async function runAutomaticCleanerWorkflow(
  ctx: CleanerRunContext,
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
    modelEntries,
    discord,
    openModelManagerForStage,
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
    const detectReadiness = resolveStageModelReadiness({
      stage: 'detectText',
      stageLabel: AIO_STAGE_LABELS.detectText,
      modelKey: detectSelectionKey,
      modelEntries,
      messages: {
        invalidSelection: t('aioManual.selectValidDetectModel'),
        selectCustomProfile: t('aioExec.selectCustomOcrProfile'),
        requiresApiKey: t('aioExec.ocrRequiresApiKey'),
      },
      t,
    });
    if (!detectReadiness.ok) {
      applyStageReadinessRefusal(detectReadiness, {
        setStatusMessage,
        openModelManagerForStage,
      });
      return;
    }

    const cleanerAiReadiness = resolveCleanerAiProfileReadiness({
      isCustomCleanerAi,
      profile: selectedCleanerCustomProfile,
      messages: {
        incomplete:
          'Fill in API Base and Model before running Automatic AI Clean with AI Custom.',
        requiresApiKey:
          'This AI Custom provider requires an API key for Automatic AI Clean.',
      },
    });
    if (!cleanerAiReadiness.ok) {
      setStatusMessage(cleanerAiReadiness.message);
      return;
    }
    const customCleanerPayload = cleanerAiReadiness.customPayload;

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

          const detectDone = await runDetectTextStage(
            {
              image: imgData,
              modelKey: detectSelectionKey,
              sourceLanguage,
              minRegionSize,
            },
            { localApiUrl },
            {
              stageLabel: AIO_STAGE_LABELS.detectText,
              failurePrefix: 'Failed to detect text',
              parseApiError,
              formatError: (message) =>
                t('cleanerActions.detectFailed', {
                  fileName: imgData.file.name,
                  message,
                }),
            },
          );
          const detectDetections = detectDone.value;

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
              const classifyDone = await runSfxClassifyStage(
                {
                  image: imgData,
                  modelKey: cleanerAiModelKey,
                  regions: candidateRegions,
                  additionalInstructions: buildSfxClassifierInstructions(
                    normalizedCleanerAiInstructions,
                  ),
                  customProfile: customCleanerPayload,
                },
                { localApiUrl } satisfies StageRuntime,
                {
                  stageLabel: 'AI SFX',
                  failurePrefix: `Failed to classify SFX in "${imgData.file.name}"`,
                  parseApiError,
                },
              );
              enrichedCandidates = applySfxDecisionsToRegions(
                candidateRegions,
                classifyDone.value.regions,
              );
            }

            outputRegions = enrichedCandidates.filter((region) => region.sfxApproved);
            approvedCount = outputRegions.length;
            reviewCount = outputRegions.filter((region) => region.sfxRequiresRedraw).length;

            if (outputRegions.length === 0) {
              blob = imgData.file;
            } else {
              const cleanDone = await runCleanImageAiStage(
                {
                  image: imgData,
                  modelKey: cleanerAiModelKey,
                  regions: outputRegions,
                  additionalInstructions: buildSfxCleanInstructions(
                    normalizedCleanerAiInstructions,
                  ),
                  customProfile: customCleanerPayload,
                },
                { localApiUrl } satisfies StageRuntime,
                {
                  stageLabel: 'AI SFX',
                  failurePrefix: `AI SFX Cleaner failed for "${imgData.file.name}"`,
                  parseApiError,
                },
              );
              blob = cleanDone.value;
              if (!blob.type.startsWith('image/')) {
                throw new Error(
                  t('cleanerActions.invalidSfxResponse', { fileName: imgData.file.name }),
                );
              }
            }
          } else {
            const cleanDone = await runCleanImageAiStage(
              {
                image: imgData,
                modelKey: cleanerAiModelKey,
                regions: detectDetections,
                additionalInstructions: normalizedCleanerAiInstructions,
                customProfile: customCleanerPayload,
              },
              { localApiUrl } satisfies StageRuntime,
              {
                stageLabel: 'Automatic AI Clean',
                failurePrefix: `Automatic AI Clean failed for "${imgData.file.name}"`,
                parseApiError,
              },
            );

            blob = cleanDone.value;
            if (!blob.type.startsWith('image/')) {
              throw new Error(
                t('cleanerActions.invalidAutoCleanResponse', { fileName: imgData.file.name }),
              );
            }
          }

          return {
            imageId: imgData.id,
            fileName: `${isAiSfxMode
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

