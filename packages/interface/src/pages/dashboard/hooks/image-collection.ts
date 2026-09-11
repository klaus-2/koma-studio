import { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';

import { useI18n } from '../../../i18n';
import {
  DASHBOARD_UPLOAD_ACCEPT,
  DEFAULT_FILTERS,
  DIRECT_IMAGE_UPLOAD_EXTENSIONS,
  INFO_MODES,
  getModeLabels,
} from '../../../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  getFileExtension,
  inferMimeTypeFromFileName,
  isContainerUploadFile,
  isDirectImageUploadFile,
  parseResponseErrorMessage,
} from '../../../utils/dashboard.utils';
import {
  createThumbnailFromUrl,
  revokeLoadedImageUrls,
} from '../../../utils/imagePerformance';
import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerRunMeta,
  DownloadItem,
  IngestArchiveManifest,
  IngestArchiveManifestEntry,
  LoadedImage,
  ProcessableMode,
  TranslatorVisualRunMeta,
} from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';

interface UseDashboardUploadsArgs {
  localApiUrl: string;
  setStatusMessage: (message: string) => void;
  invalidateAioPipelineHistory: () => void;
}

export function useDashboardUploads({
  localApiUrl,
  setStatusMessage,
  invalidateAioPipelineHistory,
}: UseDashboardUploadsArgs) {
  const activeId = useImageCollectionStore((s) => s.activeId);
  const isExtractingUploads = useImageCollectionStore(
    (s) => s.isExtractingUploads,
  );
  const addImages = useImageCollectionStore((s) => s.addImages);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const setIsExtractingUploads = useImageCollectionStore(
    (s) => s.setIsExtractingUploads,
  );

  const loadImageDetails = useCallback((file: File): Promise<LoadedImage> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;

        // Generate thumbnail for list/grid display to reduce memory
        createThumbnailFromUrl(url, 400, 600, 0.7).then((thumbUrl) => {
          resolve({
            id: uuidv4(),
            file,
            url,
            thumbnailUrl: thumbUrl,
            width,
            height,
            rotation: 0,
            filters: { ...DEFAULT_FILTERS },
          });
        }).catch(() => {
          // Thumbnail generation failed, still resolve without it
          resolve({
            id: uuidv4(),
            file,
            url,
            width,
            height,
            rotation: 0,
            filters: { ...DEFAULT_FILTERS },
          });
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load the image.'));
      };
      img.src = url;
    }), []);

  const extractImagesFromContainerFiles = useCallback(async (
    files: File[],
  ): Promise<{ extractedFiles: File[]; warnings: string[] }> => {
    if (files.length === 0) {
      return { extractedFiles: [], warnings: [] };
    }

    const ingestPayload = new FormData();
    files.forEach((file) => ingestPayload.append('files', file));

    const response = await fetchWithTimeoutAndRetry(
      `${localApiUrl}/ingest/images`,
      { method: 'POST', body: ingestPayload },
      { timeoutMs: 240_000, retryCount: 0 },
    );
    if (!response.ok) {
      const message = await parseResponseErrorMessage(response);
      throw new Error(`Failed to extract composite files: ${message}`);
    }

    const archiveBuffer = new Uint8Array(await response.arrayBuffer());
    const { unzipSync, strFromU8 } = await import('fflate');
    const unpacked = unzipSync(archiveBuffer);
    const manifestRaw = unpacked['manifest.json'];
    const warnings: string[] = [];
    const manifestByPath = new Map<string, IngestArchiveManifestEntry>();

    if (manifestRaw) {
      try {
        const manifest = JSON.parse(strFromU8(manifestRaw)) as Partial<IngestArchiveManifest>;
        if (Array.isArray(manifest.warnings)) {
          warnings.push(...manifest.warnings.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0));
        }
        if (Array.isArray(manifest.items)) {
          manifest.items.forEach((entry) => {
            if (!entry || typeof entry.path !== 'string') return;
            const normalizedPath = entry.path.replace(/\\/g, '/');
            manifestByPath.set(normalizedPath, entry);
          });
        }
      } catch {
        warnings.push('Could not parse the file extraction manifest.');
      }
    }

    const extractedFiles: File[] = [];
    Object.entries(unpacked).forEach(([archivePath, bytes]) => {
      if (archivePath === 'manifest.json' || archivePath.endsWith('/')) return;
      const normalizedPath = archivePath.replace(/\\/g, '/');
      const fileName = normalizedPath.split('/').pop()?.trim() || `image-${String(extractedFiles.length + 1).padStart(3, '0')}.png`;
      if (!DIRECT_IMAGE_UPLOAD_EXTENSIONS.has(getFileExtension(fileName))) return;
      const normalized = new Uint8Array(bytes.byteLength);
      normalized.set(bytes);
      const manifestEntry = manifestByPath.get(normalizedPath);
      extractedFiles.push(
        new File(
          [normalized],
          fileName,
          { type: manifestEntry?.mime_type || inferMimeTypeFromFileName(fileName) },
        ),
      );
    });

    if (extractedFiles.length === 0) {
      throw new Error('No valid image was extracted from the uploaded files.');
    }

    return { extractedFiles, warnings };
  }, [localApiUrl]);

  const onDrop = useCallback(async (files: File[]) => {
    const directImageFiles = files.filter(isDirectImageUploadFile);
    const containerFiles = files.filter(isContainerUploadFile);
    let extractedContainerFiles: File[] = [];
    const warnings: string[] = [];

    if (containerFiles.length > 0) {
      setIsExtractingUploads(true);
      setStatusMessage(
        containerFiles.length === 1
          ? 'Extracting images from the composite file, please wait...'
          : `Extracting images from ${containerFiles.length} composite files, please wait...`,
      );
      try {
        const ingestResult = await extractImagesFromContainerFiles(containerFiles);
        extractedContainerFiles = ingestResult.extractedFiles;
        warnings.push(...ingestResult.warnings);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : 'Failed to extract composite files.');
      } finally {
        setIsExtractingUploads(false);
      }
    }

    const candidateFiles = [...directImageFiles, ...extractedContainerFiles];
    if (candidateFiles.length === 0) {
      setStatusMessage(warnings[0] ?? 'No compatible file was found.');
      return;
    }

    try {
      const newImgs = await Promise.all(candidateFiles.map(loadImageDetails));
      addImages(newImgs);
      if (!activeId && newImgs.length > 0 && newImgs[0]) setActiveId(newImgs[0].id);
      invalidateAioPipelineHistory();

      let message = `${newImgs.length} image(s) added.`;
      if (containerFiles.length > 0 && extractedContainerFiles.length > 0) {
        message = `${newImgs.length} image(s) added (${extractedContainerFiles.length} extracted from ${containerFiles.length} container file(s)).`;
      }
      if (warnings.length > 0) {
        const excerpt = warnings.slice(0, 2).join(' | ');
        const suffix = warnings.length > 2 ? '...' : '';
        message = `${message} Warnings: ${excerpt}${suffix}`;
      }
      setStatusMessage(message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load the images.');
    }
  }, [
    activeId,
    addImages,
    extractImagesFromContainerFiles,
    invalidateAioPipelineHistory,
    loadImageDetails,
    setActiveId,
    setIsExtractingUploads,
    setStatusMessage,
  ]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: DASHBOARD_UPLOAD_ACCEPT,
    disabled: isExtractingUploads,
  });

  return {
    onDrop,
    getRootProps,
    getInputProps,
    isDragActive,
  };
}

interface UseDashboardImageCollectionArgs {
  downloadItems: DownloadItem[];
  setDownloadItems: React.Dispatch<React.SetStateAction<DownloadItem[]>>;
  setLastActionScope: React.Dispatch<React.SetStateAction<ProcessableMode | null>>;
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
  downloadItems,
  setDownloadItems,
  setLastActionScope,
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
  const mode = useUiShellStore((s) => s.mode);
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const removeImageById = useImageCollectionStore((s) => s.removeImageById);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
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

    removeImageById(id);

    if (activeId === id) {
      setActiveId(fallbackActiveId ?? null);
    }

    invalidateAioPipelineHistory();
  }, [
    activeId,
    images,
    invalidateAioPipelineHistory,
    removeImageById,
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
    setTranslatorDetectionsByImage,
    setTranslatorProcessedBaseByImage,
    setTranslatorRunMetaByImage,
    setTranslatorSelectedRegionByImage,
  ]);

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
    registerDownloads,
    getPreviewSrc,
    getListPreviewSrc,
    optimizerSourceVariants,
  };
}
