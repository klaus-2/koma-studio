/**
 * Translator domain — entry point. Hosts the visual batch run (detect →
 * [sfx classify] → ocr → translate → [sfx clean]) and re-exports the
 * per-concern sibling modules split out in T10, so consumer imports from
 * 'hooks/translator' stay valid.
 */
import { useCallback } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_STAGE_LABELS, MIN_REGION_SIZE } from '../../../constants/dashboard.constants';
import {
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import {
  blobToDataUrl,
  cloneAioRegions,
  cloneRenderStyle,
  resolveSelectedRegionForRegions,
} from '../../../utils/dashboard.utils';
import {
  applyStageReadinessRefusal,
  resolveStageModelReadiness,
  runCleanImageAiStage,
  runDetectTextStage,
  runGetTranslationsStage,
  runRecognizeTextStage,
  runSfxClassifyStage,
  withSfxTranslationSettings,
  type StageRuntime,
} from '../../../aio-stages';
import {
  applySfxDecisionsToRegions,
  buildSfxClassifierInstructions,
  buildSfxCleanInstructions,
  buildSfxTranslationInstructions,
  isLikelySfxCandidate,
} from '../../../utils/sfx';
import type {
  AioTextRegion,
  LoadedImage,
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
  modelEntries: Record<string, { status: string; model: { id: string; name: string } } | null | undefined>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedTranslatorSfxCleanCustomProfile: CustomLlmProfile | null;
  ensureVerifiedEmailOrNotify: () => boolean;
  openModelManagerForStage: (stage: string, options?: Record<string, unknown>) => void;
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
  modelEntries,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  selectedTranslatorSfxCleanCustomProfile,
  ensureVerifiedEmailOrNotify,
  openModelManagerForStage,
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
  // Store is typed as LlmRequestSettings — no cast.
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return useCallback(async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    if (images.length === 0) {
      setStatusMessage(t('translatorVisual.noImages'));
      return;
    }
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
        useCloudOcr,
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
        const stageRuntime = { localApiUrl } satisfies StageRuntime;

        const detectDone = await runDetectTextStage(
          {
            image: imgData,
            modelKey: detectSelectionKey,
            sourceLanguage: srcLang,
            minRegionSize,
          },
          stageRuntime,
          {
            stageLabel: 'Detectar Texto',
            failurePrefix: `Failed to detect text in "${imgData.file.name}"`,
            parseApiError,
          },
        );
        let detectedRegions = detectDone.value;

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
            const classifyDone = await runSfxClassifyStage(
              {
                image: imgData,
                modelKey: translatorSfxCleanModelKey,
                regions: candidateRegions,
                additionalInstructions: buildSfxClassifierInstructions(
                  translatorSfxAdditionalInstructions,
                ),
                customProfile: selectedTranslatorSfxCleanCustomProfile,
              },
              stageRuntime,
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

          detectedRegions = enrichedCandidates.filter((region) => region.sfxApproved);
          sfxApprovedCount = detectedRegions.length;
          sfxReviewCount = detectedRegions.filter((region) => region.sfxRequiresRedraw).length;
          totalSfxApproved += sfxApprovedCount;
          totalSfxReview += sfxReviewCount;
        }

        totalDetected += detectedRegions.length;

        if (detectedRegions.length > 0) {
          const ocrDone = await runRecognizeTextStage(
            {
              image: imgData,
              modelKey: selectedOcrKey,
              sourceLanguage: srcLang,
              regions: detectedRegions,
              useCloudOcr,
              llmSettings: useLlmSettingsForOcr ? llmSettings : null,
              customProfile: useLlmSettingsForOcr ? selectedCustomOcrProfile : null,
            },
            stageRuntime,
            {
              stageLabel: 'Reconhecer Texto',
              failurePrefix: `Failed to recognize text in "${imgData.file.name}"`,
              parseApiError,
            },
          );
          detectedRegions = ocrDone.value;
          totalRecognized += detectedRegions.filter((region) => (region.recognizedText ?? '').trim().length > 0).length;
        }

        const hasTextForTranslation = detectedRegions.some((region) => (region.recognizedText ?? '').trim().length > 0);
        if (hasTextForTranslation) {
          const isSfxTranslate = translatorVisualProcessingMode === 'ai_sfx';
          const sfxExtraContext = isSfxTranslate
            ? buildSfxTranslationInstructions(
                llmSettings.extra_context ?? '',
                translatorSfxAdditionalInstructions,
            )
          : undefined;

          const translateDone = await runGetTranslationsStage(
            {
              image: imgData,
              modelKey: selectedTranslationKey,
              sourceLanguage: srcLang,
              targetLanguage: tgtLang,
              regions: detectedRegions,
              fallbackOcrModelKey: selectedOcrKey,
              sfx: sfxExtraContext != null ? { extraContext: sfxExtraContext } : undefined,
              llmSettings: useLlmSettingsForTranslation
                ? (isSfxTranslate && sfxExtraContext != null
                    ? withSfxTranslationSettings(llmSettings, sfxExtraContext)
                    : llmSettings)
                : null,
              customProfile: useLlmSettingsForTranslation
                ? selectedCustomTranslationProfile
                : null,
            },
            stageRuntime,
            {
              stageLabel: 'Obter Traduções',
              failurePrefix: `Failed to translate text in "${imgData.file.name}"`,
              parseApiError,
            },
          );
          detectedRegions = translateDone.value;
          totalTranslated += detectedRegions.filter((region) => (region.translatedText ?? '').trim().length > 0).length;
        }

        if (translatorVisualProcessingMode === 'ai_sfx' && detectedRegions.length > 0) {
          const cleanDone = await runCleanImageAiStage(
            {
              image: imgData,
              modelKey: translatorSfxCleanModelKey,
              regions: detectedRegions,
              additionalInstructions: buildSfxCleanInstructions(
                translatorSfxAdditionalInstructions,
              ),
              customProfile: selectedTranslatorSfxCleanCustomProfile,
            },
            stageRuntime,
            {
              stageLabel: 'AI SFX',
              failurePrefix: `Failed to clean SFX in "${imgData.file.name}"`,
              parseApiError,
            },
          );
          const cleanBlob = cleanDone.value;
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
    openModelManagerForStage,
    modelEntries,
  ]);
}
