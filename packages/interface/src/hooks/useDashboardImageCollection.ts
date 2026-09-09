import { useCallback, useMemo } from 'react';

import { useI18n } from '../i18n';
import { INFO_MODES, getModeLabels } from '../constants/dashboard.constants';
import { revokeLoadedImageUrls } from '../utils/imagePerformance';
import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerRunMeta,
  DownloadItem,
  LoadedImage,
  ProcessableMode,
  ToolMode,
  TranslatorVisualRunMeta,
} from '../types/dashboard.types';

interface UseDashboardImageCollectionArgs {
  mode: ToolMode;
  activeId: string | null;
  images: LoadedImage[];
  downloadItems: DownloadItem[];
  setImages: React.Dispatch<React.SetStateAction<LoadedImage[]>>;
  setDownloadItems: React.Dispatch<React.SetStateAction<DownloadItem[]>>;
  setLastActionScope: React.Dispatch<React.SetStateAction<ProcessableMode | null>>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  invalidateAioPipelineHistory: () => void;
  setAioDetectionsByImage: React.Dispatch<React.SetStateAction<Record<string, AioTextRegion[]>>>;
  setAioSelectedRegionByImage: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setCleanerDetectionsByImage: React.Dispatch<React.SetStateAction<Record<string, AioTextRegion[]>>>;
  setCleanerSelectedRegionByImage: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setCleanerProcessedBaseByImage: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setCleanerRunMetaByImage: React.Dispatch<React.SetStateAction<Record<string, CleanerRunMeta>>>;
  setCleanerManualImageEditsByImage: React.Dispatch<React.SetStateAction<Record<string, AioManualImageEditState>>>;
  setCleanerHealingBusyByImage: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setTranslatorDetectionsByImage: React.Dispatch<React.SetStateAction<Record<string, AioTextRegion[]>>>;
  setTranslatorSelectedRegionByImage: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setTranslatorRunMetaByImage: React.Dispatch<React.SetStateAction<Record<string, TranslatorVisualRunMeta>>>;
  setTranslatorProcessedBaseByImage: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  aioManualImageEditsByImage: Record<string, AioManualImageEditState>;
  cleanerManualImageEditsByImage: Record<string, AioManualImageEditState>;
  cleanerProcessedBaseByImage: Record<string, string>;
  translatorProcessedBaseByImage: Record<string, string>;
}

export function useDashboardImageCollection({
  mode,
  activeId,
  images,
  downloadItems,
  setImages,
  setDownloadItems,
  setLastActionScope,
  setActiveId,
  invalidateAioPipelineHistory,
  setAioDetectionsByImage,
  setAioSelectedRegionByImage,
  setCleanerDetectionsByImage,
  setCleanerSelectedRegionByImage,
  setCleanerProcessedBaseByImage,
  setCleanerRunMetaByImage,
  setCleanerManualImageEditsByImage,
  setCleanerHealingBusyByImage,
  setTranslatorDetectionsByImage,
  setTranslatorSelectedRegionByImage,
  setTranslatorRunMetaByImage,
  setTranslatorProcessedBaseByImage,
  aioManualImageEditsByImage,
  cleanerManualImageEditsByImage,
  cleanerProcessedBaseByImage,
  translatorProcessedBaseByImage,
}: UseDashboardImageCollectionArgs) {
  const { t } = useI18n();
  const modeLabels = useMemo(() => getModeLabels(t), [t]);

  const previewUrlByScopeAndImage = useMemo(() => {
    const lookup = new Map<string, string>();
    downloadItems.forEach((item) => {
      lookup.set(`${item.scope}:${item.sourceImageId}`, item.previewUrl);
    });
    return lookup;
  }, [downloadItems]);

  const removeImage = useCallback((id: string) => {
    const removed = images.find((img) => img.id === id);
    const fallbackActiveId = activeId === id ? images.find((img) => img.id !== id)?.id ?? null : activeId;

    if (removed) {
      // Revoke blob URLs to free memory immediately
      revokeLoadedImageUrls([removed]);
    }

    setDownloadItems((prev) => {
      prev.filter((item) => item.sourceImageId === id).forEach((item) => {
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      });
      return prev.filter((item) => item.sourceImageId !== id);
    });

    setAioDetectionsByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setAioSelectedRegionByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setCleanerDetectionsByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setCleanerSelectedRegionByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setCleanerProcessedBaseByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setCleanerRunMetaByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setCleanerManualImageEditsByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setCleanerHealingBusyByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTranslatorDetectionsByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTranslatorSelectedRegionByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTranslatorRunMetaByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setTranslatorProcessedBaseByImage((prev) => { const next = { ...prev }; delete next[id]; return next; });

    setImages((prev) => prev.filter((img) => img.id !== id));

    if (activeId === id) {
      setActiveId(fallbackActiveId ?? null);
    }

    invalidateAioPipelineHistory();
  }, [
    activeId,
    images,
    invalidateAioPipelineHistory,
    setActiveId,
    setAioDetectionsByImage,
    setAioSelectedRegionByImage,
    setCleanerDetectionsByImage,
    setCleanerHealingBusyByImage,
    setCleanerManualImageEditsByImage,
    setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage,
    setCleanerSelectedRegionByImage,
    setDownloadItems,
    setImages,
    setTranslatorDetectionsByImage,
    setTranslatorProcessedBaseByImage,
    setTranslatorRunMetaByImage,
    setTranslatorSelectedRegionByImage,
  ]);

  const moveImage = useCallback((index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === images.length - 1) return;
    setImages((prev) => {
      const newArr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const current = newArr[index];
      const target = newArr[targetIndex];
      if (!current || !target) return prev;
      [newArr[index], newArr[targetIndex]] = [target, current];
      return newArr;
    });
  }, [images.length, setImages]);

  const rotateImage = useCallback((id: string) => {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img));
  }, [setImages]);

  const registerDownloads = useCallback((items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: ProcessableMode) => {
    setDownloadItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      });
      return items.map((item) => {
        const previewUrl = URL.createObjectURL(item.blob);
        return {
          name: item.fileName,
          blob: item.blob,
          scope,
          sourceImageId: item.sourceImageId,
          previewUrl,
        };
      });
    });
    setLastActionScope(scope);
  }, [setDownloadItems, setLastActionScope]);

  const getPreviewSrc = useCallback((img: LoadedImage) => {
    if (mode === 'organize' || INFO_MODES.includes(mode)) return img.url;
    if (mode === 'aio') {
      const manualState = aioManualImageEditsByImage[img.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
    }
    if (mode === 'cleaner') {
      const manualState = cleanerManualImageEditsByImage[img.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
      if (cleanerProcessedBaseByImage[img.id]) return cleanerProcessedBaseByImage[img.id]!;
    }
    if (mode === 'translator' && translatorProcessedBaseByImage[img.id]) {
      return translatorProcessedBaseByImage[img.id]!;
    }
    return previewUrlByScopeAndImage.get(`${mode}:${img.id}`) ?? img.url;
  }, [
    aioManualImageEditsByImage,
    cleanerManualImageEditsByImage,
    cleanerProcessedBaseByImage,
    mode,
    previewUrlByScopeAndImage,
    translatorProcessedBaseByImage,
  ]);

  // List/grid preview uses thumbnailUrl when available for lower memory usage
  const getListPreviewSrc = useCallback((img: LoadedImage) => {
    return img.thumbnailUrl ?? img.url;
  }, []);

  const optimizerSourceVariants = useMemo(() => (
    downloadItems
      .filter((item) => item.scope !== 'proofreader' && item.scope !== 'optimizer')
      .map((item) => ({
        id: `${item.scope}-${item.sourceImageId}`,
        imageId: item.sourceImageId,
        label: modeLabels[item.scope],
        scope: item.scope,
        blob: item.blob,
        previewUrl: item.previewUrl,
      }))
  ), [downloadItems, modeLabels]);

  return {
    removeImage,
    moveImage,
    rotateImage,
    registerDownloads,
    getPreviewSrc,
    getListPreviewSrc,
    optimizerSourceVariants,
  };
}
