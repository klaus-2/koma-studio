import { useCallback } from 'react';

import {
  DASHBOARD_UPLOAD_ACCEPT,
  DEFAULT_FILTERS,
  DIRECT_IMAGE_UPLOAD_EXTENSIONS,
  INFO_MODES,
} from '../../../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  getFileExtension,
  inferMimeTypeFromFileName,
  isChapterArchiveUploadFile,
  isContainerUploadFile,
  isDirectImageUploadFile,
  loadImageFromSource,
  parseResponseErrorMessage,
} from '../../../utils/dashboard.utils';
import {
  createThumbnailFromUrl,
  revokeLoadedImageUrls,
} from '../../../utils/imagePerformance';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import {
  importArchiveChapter,
  importDirectPage,
} from '../lib/chapter-archive-import';
import type { PageFile } from '../../../utils/page-source';
import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerRunMeta,
  DownloadItem,
  IngestArchiveManifest,
  IngestArchiveManifestEntry,
  LoadedImage,
  ProcessableMode,
  ToolMode,
  TranslatorVisualRunMeta,
} from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useExportStore } from '../stores/export-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUploadDropzone } from './useUploadDropzone';

interface UploadChapter {
  id: string;
  label: string;
}

interface ExtractedUpload {
  /** The page's lazy file. */
  file: PageFile;
  chapter: UploadChapter | null;
}

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

  const loadImageDetails = useCallback(
    (file: PageFile, chapter?: UploadChapter): Promise<LoadedImage> =>
      new Promise((resolve, reject) => {
        // The URL is owned by the created LoadedImage and revoked when the
        // image is removed from the collection (revokeLoadedImageUrls).
        // For an archive-backed page there is no URL yet: the page's bytes are
        // materialized on demand, so the preview resolves one when it is shown.
        // The URL is owned by the created LoadedImage and revoked when the
        // image is removed from the collection (revokeLoadedImageUrls).
        // For an archive-backed page there is no URL yet: the page's bytes are
        // materialized on demand, so the preview resolves one when it is shown.
        const url = file.kind === 'direct'
          ? URL.createObjectURL(file.resident as Blob)
          : '';
        const chapterFields = chapter
          ? { chapterId: chapter.id, chapterLabel: chapter.label }
          : {};

        const resolveWith = (
          width: number,
          height: number,
          thumbnailUrl?: string,
        ): void => {
          resolve({
            id: crypto.randomUUID(),
            file,
            url,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            width,
            height,
            rotation: 0,
            filters: { ...DEFAULT_FILTERS },
            ...chapterFields,
          });
        };

        if (file.kind === 'archive') {
          // Nothing is decoded at import time: the dimensions are resolved the
          // first time the page is materialized, and the sidebar shows `?x?`
          // until then.
          resolveWith(0, 0);
          return;
        }

        loadImageFromSource(url)
          .then((img) => {
            const width = img.width;
            const height = img.height;
            img.src = '';

            // Generate thumbnail for list/grid display to reduce memory
            createThumbnailFromUrl(url, 400, 600, 0.7)
              .then((thumbUrl) => {
                resolveWith(width, height, thumbUrl);
              })
              .catch(() => {
                // Thumbnail generation failed, still resolve without it
                resolveWith(width, height);
              });
          })
          .catch(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load the image.'));
          });
      }),
    [],
  );

  /**
   * Read a `.cbz`/`.zip` chapter in the browser.
   *
   * Only the central directory is parsed here, so a 100-page chapter opens
   * without decoding a single page. Each page's bytes are produced later, on
   * demand, and released as soon as its consumer is done with them.
   */
  const extractImagesFromChapterArchives = useCallback(async (
    files: File[],
  ): Promise<{ extractedFiles: ExtractedUpload[]; warnings: string[] }> => {
    const extractedFiles: ExtractedUpload[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      try {
        const imported = await importArchiveChapter(file);
        warnings.push(...imported.warnings);
        imported.pages.forEach((page) => {
          extractedFiles.push({
            file: page.file,
            chapter: { id: page.chapterId, label: page.chapterLabel },
          });
        });
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Failed to read "${file.name}": ${error.message}`
            : `Failed to read "${file.name}".`,
        );
      }
    }

    if (extractedFiles.length === 0) {
      throw new Error('No valid image was extracted from the uploaded files.');
    }

    return { extractedFiles, warnings };
  }, []);

  const extractImagesFromContainerFiles = useCallback(async (
    files: File[],
  ): Promise<{ extractedFiles: ExtractedUpload[]; warnings: string[] }> => {
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

    const extractedFiles: ExtractedUpload[] = [];
    Object.entries(unpacked).forEach(([archivePath, bytes]) => {
      if (archivePath === 'manifest.json' || archivePath.endsWith('/')) return;
      const normalizedPath = archivePath.replace(/\\/g, '/');
      const fileName = normalizedPath.split('/').pop()?.trim() || `image-${String(extractedFiles.length + 1).padStart(3, '0')}.png`;
      if (!DIRECT_IMAGE_UPLOAD_EXTENSIONS.has(getFileExtension(fileName))) return;
      const normalized = new Uint8Array(bytes.byteLength);
      normalized.set(bytes);
      const manifestEntry = manifestByPath.get(normalizedPath);
      const sourceFile = typeof manifestEntry?.source_file === 'string'
        ? manifestEntry.source_file.trim()
        : '';
      const file = new File(
        [normalized],
        fileName,
        { type: manifestEntry?.mime_type || inferMimeTypeFromFileName(fileName) },
      );
      extractedFiles.push({
        file: importDirectPage(file),
        chapter: sourceFile
          ? { id: `archive:${sourceFile}`, label: sourceFile }
          : null,
      });
    });

    if (extractedFiles.length === 0) {
      throw new Error('No valid image was extracted from the uploaded files.');
    }

    return { extractedFiles, warnings };
  }, [localApiUrl]);

  const onDrop = useCallback(async (
    files: File[],
    folders?: ReadonlyMap<File, string>,
  ) => {
    const folderChapterFor = (file: File): UploadChapter | null => {
      const folder = folders?.get(file);

      return folder ? { id: `folder:${folder}`, label: folder } : null;
    };
    const directImageFiles = files.filter(isDirectImageUploadFile);
    const containerFiles = files.filter(isContainerUploadFile);
    // `.cbz`/`.zip` are read in the browser; every other container type
    // (`.cb7`, `.pdf`, `.psd`) still goes through the backend's ingest route.
    const chapterArchiveFiles = containerFiles.filter(isChapterArchiveUploadFile);
    const backendContainerFiles = containerFiles.filter(
      (file) => !isChapterArchiveUploadFile(file),
    );
    let extractedContainerFiles: ExtractedUpload[] = [];
    const warnings: string[] = [];

    if (containerFiles.length > 0) {
      setIsExtractingUploads(true);
      setStatusMessage(
        containerFiles.length === 1
          ? 'Extracting images from the composite file, please wait...'
          : `Extracting images from ${containerFiles.length} composite files, please wait...`,
      );
      try {
        if (chapterArchiveFiles.length > 0) {
          const archiveResult = await extractImagesFromChapterArchives(chapterArchiveFiles);
          extractedContainerFiles = [
            ...extractedContainerFiles,
            ...archiveResult.extractedFiles,
          ];
          warnings.push(...archiveResult.warnings);
        }
        if (backendContainerFiles.length > 0) {
          const ingestResult = await extractImagesFromContainerFiles(backendContainerFiles);
          extractedContainerFiles = [
            ...extractedContainerFiles,
            ...ingestResult.extractedFiles,
          ];
          warnings.push(...ingestResult.warnings);
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : 'Failed to extract composite files.');
      } finally {
        setIsExtractingUploads(false);
      }
    }

    const candidateUploads: ExtractedUpload[] = [
      ...directImageFiles.map((file) => ({
        file: importDirectPage(file),
        chapter: folderChapterFor(file),
      })),
      ...extractedContainerFiles,
    ];
    if (candidateUploads.length === 0) {
      setStatusMessage(warnings[0] ?? 'No compatible file was found.');
      return;
    }

    try {
      const newImgs = await runConcurrentBatch({
        items: candidateUploads,
        concurrency: 4,
        worker: async ({ item: { file, chapter } }) =>
          loadImageDetails(file, chapter ?? undefined),
      });
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
    extractImagesFromChapterArchives,
    extractImagesFromContainerFiles,
    invalidateAioPipelineHistory,
    loadImageDetails,
    setActiveId,
    setIsExtractingUploads,
    setStatusMessage,
  ]);

  const { getRootProps, getInputProps, isDragActive } = useUploadDropzone({
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
}

/**
 * Pure preview-src resolution shared by the dashboard's `getPreviewSrc`
 * callback and the compare-review overlay (which renders the exact same
 * base image as the render stage without a hook-bound callback).
 */
export const resolveImagePreviewSrc = (
  img: LoadedImage,
  mode: ToolMode,
): string => {
  if (INFO_MODES.includes(mode)) return img.thumbnailUrl ?? img.url;
  const manualToolsState = useManualToolsStore.getState();
  const cleanerState = useCleanerStore.getState();
  const translatorState = useTranslatorStore.getState();
  if (mode === 'aio') {
    const manualState = manualToolsState.aioManualImageEditsByImage[img.id];
    if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
  }
  if (mode === 'cleaner') {
    const manualState =
      cleanerState.cleanerManualImageEditsByImage[img.id];
    if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
    const processedBase = cleanerState.cleanerProcessedBaseByImage[img.id];
    if (processedBase) return processedBase;
  }
  const translatorProcessedBase =
    translatorState.translatorProcessedBaseByImage[img.id];
  if (mode === 'translator' && translatorProcessedBase) {
    return translatorProcessedBase;
  }
  const scopedDownload = useExportStore
    .getState()
    .downloadItems.find(
      (item) => item.scope === mode && item.sourceImageId === img.id,
    );
  if (mode === 'raw') {
    return scopedDownload?.previewUrl ?? img.thumbnailUrl ?? img.url;
  }
  return scopedDownload?.previewUrl ?? img.url;
};

export function useDashboardImageCollection({
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
}: UseDashboardImageCollectionArgs) {
  const mode = useUiShellStore((s) => s.mode);
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const removeImageById = useImageCollectionStore((s) => s.removeImageById);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const removeImage = useCallback((id: string) => {
    const removed = images.find((img) => img.id === id);
    const fallbackActiveId = activeId === id ? images.find((img) => img.id !== id)?.id ?? null : activeId;

    if (removed) {
      // Revoke blob URLs to free memory immediately
      revokeLoadedImageUrls([removed]);
    }

    setDownloadItems((prev) => {
      const keep: typeof prev = [];
      for (const item of prev) {
        if (item.sourceImageId === id) {
          if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
        } else {
          keep.push(item);
        }
      }
      return keep;
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
      const next: DownloadItem[] = [];
      for (const item of items) {
        const previewUrl = URL.createObjectURL(item.blob);
        next.push({
          name: item.fileName,
          blob: item.blob,
          scope,
          sourceImageId: item.sourceImageId,
          previewUrl,
        });
      }
      return next;
    });
    setLastActionScope(scope);
  }, [setDownloadItems, setLastActionScope]);

  const getPreviewSrc = useCallback(
    (img: LoadedImage) => resolveImagePreviewSrc(img, mode),
    [mode],
  );

  // List/grid preview uses thumbnailUrl when available for lower memory usage
  const getListPreviewSrc = useCallback((img: LoadedImage) => {
    return img.thumbnailUrl ?? img.url;
  }, []);

  return {
    removeImage,
    registerDownloads,
    getPreviewSrc,
    getListPreviewSrc,
  };
}
