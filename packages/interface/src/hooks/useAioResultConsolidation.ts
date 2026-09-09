import { useCallback } from 'react';

import { AIO_STAGE_LABELS } from '../constants/dashboard.constants';
import {
  buildAioSelectionMapFromDetections,
  buildDefaultRegionRenderText,
  cloneAioDetectionsMap,
  cloneAioDownloadEntries,
  cloneAioRegions,
  cloneRenderStyle,
} from '../utils/dashboard.utils';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
} from '../types/dashboard.types';

interface UseAioResultConsolidationArgs {
  aioSteps: {
    recognizeText: boolean;
    getTranslations: boolean;
    segmentText: boolean;
    cleanImage: boolean;
    render: boolean;
  };
  buildAioImageSnapshotIndexMap: (index: number) => Record<string, number>;
  setAioAutoProcessedImageById: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setAioDetectionsByImage: (value: Record<string, AioTextRegion[]>) => void;
  setAioSelectedRegionByImage: (value: Record<string, string | null>) => void;
  setAioPipelineSnapshots: (value: AioPipelineSnapshot[]) => void;
  setAioPipelineSnapshotIndex: (value: number) => void;
  setAioImageSnapshotIndexById: (value: Record<string, number>) => void;
  setAioAutoHistoryAvailable: (value: boolean) => void;
  setAioDownloadItems: (entries: AioDownloadEntry[]) => void;
}

export function useAioResultConsolidation({
  aioSteps,
  buildAioImageSnapshotIndexMap,
  setAioAutoProcessedImageById,
  setAioDetectionsByImage,
  setAioSelectedRegionByImage,
  setAioPipelineSnapshots,
  setAioPipelineSnapshotIndex,
  setAioImageSnapshotIndexById,
  setAioAutoHistoryAvailable,
  setAioDownloadItems,
}: UseAioResultConsolidationArgs) {
  return useCallback((imageResults: AioBatchImageResult[]) => {
    const nextDetections: Record<string, AioTextRegion[]> = {};
    const detectStageDetections: Record<string, AioTextRegion[]> = {};
    const ocrStageDetections: Record<string, AioTextRegion[]> = {};
    const translationStageDetections: Record<string, AioTextRegion[]> = {};
    const segmentStageDetections: Record<string, AioTextRegion[]> = {};
    const cleanStageDetections: Record<string, AioTextRegion[]> = {};
    const renderStageDetections: Record<string, AioTextRegion[]> = {};
    let totalRecognized = 0;
    let totalTranslated = 0;
    let totalSegmented = 0;
    let totalCleaned = 0;
    let totalRendered = 0;
    const cleanedOutputs: AioDownloadEntry[] = [];

    imageResults.forEach((result) => {
      detectStageDetections[result.imageId] = cloneAioRegions(result.detectDetections, cloneRenderStyle);
      ocrStageDetections[result.imageId] = cloneAioRegions(result.ocrDetections, cloneRenderStyle);
      translationStageDetections[result.imageId] = cloneAioRegions(result.translationDetections, cloneRenderStyle);
      segmentStageDetections[result.imageId] = cloneAioRegions(result.segmentDetections, cloneRenderStyle);
      cleanStageDetections[result.imageId] = cloneAioRegions(result.cleanDetections, cloneRenderStyle);
      renderStageDetections[result.imageId] = cloneAioRegions(result.renderDetections, cloneRenderStyle);
      nextDetections[result.imageId] = cloneAioRegions(result.renderDetections, cloneRenderStyle);

      if (aioSteps.recognizeText) {
        totalRecognized += result.ocrDetections.filter((region) => (region.recognizedText ?? '').trim().length > 0).length;
      }
      if (aioSteps.getTranslations) {
        totalTranslated += result.translationDetections.filter((region) => (region.translatedText ?? '').trim().length > 0).length;
      }
      if (aioSteps.segmentText) {
        totalSegmented += result.segmentDetections.filter((region) => {
          const totalBoxes = (region.mergedSegmentBoxes?.length ?? 0) + (region.segmentBoxes?.length ?? 0);
          return totalBoxes > 0;
        }).length;
      }
      if (result.cleanedDownload) {
        cleanedOutputs.push(result.cleanedDownload);
        totalCleaned += 1;
      }
      if (aioSteps.render) {
        totalRendered += result.renderDetections.filter((region) => buildDefaultRegionRenderText(region).trim().length > 0).length;
      }
    });

    const autoProcessedByImage: Record<string, boolean> = {};
    imageResults.forEach((result) => {
      if (result.countAsProcessed ?? true) {
        autoProcessedByImage[result.imageId] = true;
      }
    });
    if (Object.keys(autoProcessedByImage).length > 0) {
      setAioAutoProcessedImageById((prev) => ({ ...prev, ...autoProcessedByImage }));
    }

    const cleanedDownloads = cloneAioDownloadEntries(cleanedOutputs);
    const processedPagesCount = imageResults.filter(
      (result) => result.countAsProcessed ?? true,
    ).length;
    const executionNotices = Array.from(
      new Set(
        imageResults.flatMap((result) => result.executionNotices ?? []),
      ),
    );

    const timelineDraft: Array<{
      key: AioPipelineSnapshotKey;
      label: string;
      detections: Record<string, AioTextRegion[]>;
      aioDownloads: AioDownloadEntry[];
    }> = [
      { key: 'detectText', label: AIO_STAGE_LABELS.detectText, detections: detectStageDetections, aioDownloads: [] },
    ];
    if (aioSteps.recognizeText) {
      timelineDraft.push({
        key: 'recognizeText',
        label: AIO_STAGE_LABELS.recognizeText,
        detections: ocrStageDetections,
        aioDownloads: [],
      });
    }
    if (aioSteps.getTranslations) {
      timelineDraft.push({
        key: 'getTranslations',
        label: AIO_STAGE_LABELS.getTranslations,
        detections: translationStageDetections,
        aioDownloads: [],
      });
    }
    if (aioSteps.segmentText) {
      timelineDraft.push({
        key: 'segmentText',
        label: AIO_STAGE_LABELS.segmentText,
        detections: segmentStageDetections,
        aioDownloads: [],
      });
    }
    if (aioSteps.cleanImage) {
      timelineDraft.push({
        key: 'cleanImage',
        label: AIO_STAGE_LABELS.cleanImage,
        detections: cleanStageDetections,
        aioDownloads: cleanedDownloads,
      });
    }
    if (aioSteps.render) {
      timelineDraft.push({
        key: 'render',
        label: 'Renderizar',
        detections: renderStageDetections,
        aioDownloads: aioSteps.cleanImage ? cleanedDownloads : [],
      });
    }

    const timelineSnapshots: AioPipelineSnapshot[] = timelineDraft.map((stage) => {
      const detectionsByImage = cloneAioDetectionsMap(stage.detections, cloneRenderStyle);
      return {
        key: stage.key,
        label: stage.label,
        detectionsByImage,
        selectedRegionByImage: buildAioSelectionMapFromDetections(detectionsByImage),
        aioDownloads: cloneAioDownloadEntries(stage.aioDownloads),
      };
    });

    const latestSnapshot = timelineSnapshots[timelineSnapshots.length - 1] ?? null;
    if (latestSnapshot) {
      setAioDetectionsByImage(cloneAioDetectionsMap(latestSnapshot.detectionsByImage, cloneRenderStyle));
      setAioSelectedRegionByImage({ ...latestSnapshot.selectedRegionByImage });
    } else {
      setAioDetectionsByImage(nextDetections);
      setAioSelectedRegionByImage(buildAioSelectionMapFromDetections(nextDetections));
    }
    setAioPipelineSnapshots(timelineSnapshots);
    const latestTimelineIndex = timelineSnapshots.length > 0 ? timelineSnapshots.length - 1 : -1;
    setAioPipelineSnapshotIndex(latestTimelineIndex);
    setAioImageSnapshotIndexById(buildAioImageSnapshotIndexMap(latestTimelineIndex));
    setAioAutoHistoryAvailable(timelineSnapshots.length > 0);
    setAioDownloadItems(latestSnapshot?.aioDownloads ?? []);

    const totalDetections = Object.values(nextDetections).reduce((sum, entries) => sum + entries.length, 0);
    const finalParts = [`${totalDetections} region(s) detected`];
    if (aioSteps.recognizeText) finalParts.push(`${totalRecognized} text(s) recognized`);
    if (aioSteps.getTranslations) finalParts.push(`${totalTranslated} translation(s) generated`);
    if (aioSteps.segmentText) finalParts.push(`${totalSegmented} region(s) segmented`);
    if (aioSteps.cleanImage) finalParts.push(`${totalCleaned} image(s) cleaned`);
    if (aioSteps.render) finalParts.push(`${totalRendered} block(s) ready to render`);

    let finalMessage = `AIO finished. ${finalParts.join(', ')}.`;
    if (executionNotices.length > 0) {
      finalMessage += ` ${executionNotices.join(' ')}`;
    }

    return {
      processedPagesCount,
      totalDetections,
      totalRecognized,
      totalTranslated,
      totalSegmented,
      totalCleaned,
      totalRendered,
      finalMessage,
    };
  }, [
    aioSteps,
    buildAioImageSnapshotIndexMap,
    setAioAutoHistoryAvailable,
    setAioAutoProcessedImageById,
    setAioDetectionsByImage,
    setAioDownloadItems,
    setAioImageSnapshotIndexById,
    setAioPipelineSnapshotIndex,
    setAioPipelineSnapshots,
    setAioSelectedRegionByImage,
  ]);
}
