import { useCallback, useMemo, useState } from 'react';

import type { CustomLlmProfile } from '@/utils/customLlm';
import type { LoadedImage } from '@/types/dashboard.types';
import {
  isCloudPreviewSuppressed,
  resolveCloudPreviewGate,
  type CloudPreviewGate,
} from '@/pages/dashboard/lib/aio-cloud-preview';
import { useAioBatchPauseStore } from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useRegionEditorStore } from '@/pages/dashboard/stores/region-editor-store';
import { useTypographerStore } from '@/pages/dashboard/stores/typographer-store';

export interface UseAioCloudPreviewStartArgs {
  readonly processAIO: () => void;
  readonly processing: boolean;
  readonly images: ReadonlyArray<LoadedImage>;
  readonly selectedCustomTranslationProfile: CustomLlmProfile | null;
}

export interface UseAioCloudPreviewStartResult {
  readonly handleAutoStartWithCloudPreview: () => void;
  readonly previewGate: CloudPreviewGate | null;
  readonly clearPreviewGate: () => void;
  readonly runActive: boolean;
  readonly imageCount: number;
  readonly imageBytes: number;
  readonly textRegionCount: number;
  readonly knownTextChars: number;
  readonly imagesWithKnownText: number;
  readonly neighborContextEnabled: boolean;
}

export function useAioCloudPreviewStart({
  processAIO,
  images,
  processing,
  selectedCustomTranslationProfile,
}: UseAioCloudPreviewStartArgs): UseAioCloudPreviewStartResult {
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioAbortController = useAioPipelineStore(
    (s) => s.aioAbortController,
  );
  const batchPausePhase = useAioBatchPauseStore((s) => s.pausePhase);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const neighborContextEnabled = useLlmProvidersStore(
    (s) => s.llmSettings.neighbor_image_context_enabled === true,
  );
  const [previewGate, setPreviewGate] = useState<CloudPreviewGate | null>(
    null,
  );

  const handleAutoStartWithCloudPreview = useCallback((): void => {
    const ocrSelection = aioStageSelection.recognizeText;
    const ocrProfileId = ocrSelection.startsWith('custom_ocr:')
      ? ocrSelection.slice('custom_ocr:'.length)
      : null;
    const customOcrProfile =
      ocrProfileId !== null
        ? (useLlmProvidersStore
            .getState()
            .customLlmProfiles.find(
              (profile) =>
                profile.stage === 'ocr' && profile.id === ocrProfileId,
            ) ?? null)
        : null;
    const gate = resolveCloudPreviewGate({
      customOcrProfile,
      aioSteps: {
        recognizeText: aioSteps.recognizeText,
        getTranslations: aioSteps.getTranslations,
      },
      ocrModelKey: aioStageSelection.recognizeText,
      translationModelKey: aioStageSelection.getTranslations,
      customTranslationProfile: selectedCustomTranslationProfile,
    });
    const providers = [gate.ocr?.provider, gate.translation?.provider].filter(
      (provider): provider is string => typeof provider === 'string',
    );
    if (!gate.required || isCloudPreviewSuppressed(providers)) {
      processAIO();
      return;
    }
    setPreviewGate(gate);
  }, [
    aioStageSelection.getTranslations,
    aioStageSelection.recognizeText,
    aioSteps.getTranslations,
    aioSteps.recognizeText,
    processAIO,
    selectedCustomTranslationProfile,
  ]);

  const previewTextRegions = useMemo(() => {
    let regionCount = 0;
    let knownChars = 0;
    let imagesWithKnownText = 0;
    const sessions = useTypographerStore.getState().typographerSessionsByImage;
    for (const image of images) {
      regionCount += (aioDetectionsByImage[image.id] ?? []).length;
      const session = sessions[image.id];
      if (session) {
        imagesWithKnownText += 1;
        for (const item of session.queue) {
          knownChars += item.text.length;
        }
      }
    }
    return { regionCount, knownChars, imagesWithKnownText };
  }, [aioDetectionsByImage, images]);

  const imageBytes = useMemo(
    () => images.reduce((sum, image) => sum + image.file.size, 0),
    [images],
  );

  return {
    handleAutoStartWithCloudPreview,
    previewGate,
    clearPreviewGate: useCallback(() => setPreviewGate(null), []),
    runActive:
      processing || aioAbortController !== null || batchPausePhase !== 'idle',
    imageCount: images.length,
    imageBytes,
    textRegionCount: previewTextRegions.regionCount,
    knownTextChars: previewTextRegions.knownChars,
    imagesWithKnownText: previewTextRegions.imagesWithKnownText,
    neighborContextEnabled,
  };
}
