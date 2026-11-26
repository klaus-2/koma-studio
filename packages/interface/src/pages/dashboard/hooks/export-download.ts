import { useCallback } from 'react';

import { AIO_STAGE_BADGE_LABELS } from '../../../constants/dashboard.constants';
import { desktopBridge } from '../../../lib/desktop-bridge';
import {
  buildRegionNotesDump,
  buildRegionTextDump,
  getImageExtensionFromMime,
  normalizeBlobForPdf,
  removeFileExtension,
  sanitizeArchivePathToken,
} from '../../../utils/dashboard.utils';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  DownloadBundleFormat,
  DownloadItem,
  LoadedImage,
  PreparedDownloadEntry,
  ProcessableMode,
} from '../../../types/dashboard.types';
import { materializePageFile } from '../../../utils/page-source';
import {
  buildBundleExportFileName,
  buildExportName,
  buildPageNamingContext,
  ensureExportExtension,
  isExportNamingPatternEmpty,
  type ExportNamingContext,
} from '../../../utils/exportNaming';
import type { SheetRow } from '../../../utils/spreadsheet-bridge';
import type { WorkerPdfPage, WorkerZipEntry } from './exportPackageWorker';
import type {
  SheetExportFormat,
  SheetWorkerRequest,
  SheetWorkerResponse,
} from './exportSheetWorker';
import { encodeCanvasToBlob } from './export-download.encode';
import { streamBundleViaShell } from './export-download.bundle-bridge';
import { createExportWorkerPool, type ExportWorkerPool } from './exportWorkerPool';
import { ensureDirectPageUrl } from './image-collection';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useWorksStore } from '../stores/works-store';

import type { DownloadBundleResult } from './export-download.types';

export { useDashboardDownloadActions, useDashboardPsdDownload } from './export-download.actions';
export { useExportDownloadAvailability } from './export-download.availability';

export type { DownloadBundleResult } from './export-download.types';

let sharedExportPool: ExportWorkerPool | null = null;
const getExportPool = (): ExportWorkerPool => {
  sharedExportPool ??= createExportWorkerPool();
  return sharedExportPool;
};

export const buildEntryNamingContext = (
  entry: PreparedDownloadEntry,
  pageIndex: number,
  ext: string,
): ExportNamingContext => {
  const imageRef = useImageCollectionStore
    .getState()
    .images.find((item) => item.id === entry.sourceImageId);
  return buildPageNamingContext({
    fileName: imageRef?.file.name ?? `page-${pageIndex + 1}`,
    chapterLabel: imageRef?.chapterLabel ?? null,
    works: useWorksStore.getState().works,
    targetLanguage: useAioPipelineStore.getState().aioTgtLang,
    pageIndex,
    ext,
  });
};

export const resolveBundleFileName = (
  pattern: string,
  firstEntry: PreparedDownloadEntry | undefined,
  scope: ProcessableMode,
  timestamp: string,
  targetExt: string,
): string => {
  if (!isExportNamingPatternEmpty(pattern)) {
    useExportStore.getState().addRecentNamingPattern(pattern);
  }
  return (
    (firstEntry === undefined
      ? null
      : buildBundleExportFileName(pattern, buildEntryNamingContext(firstEntry, 0, targetExt)))
    ?? `koma-studio-${scope}-${timestamp}.${targetExt}`
  );
};

const SHEET_WORKER_TIMEOUT_MS = 30_000;
const runSheetWorkerRequest = (request: SheetWorkerRequest): Promise<SheetWorkerResponse> =>
  new Promise<SheetWorkerResponse>((resolve, reject) => {
    const worker = new Worker(new URL('./exportSheetWorker.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(
        new Error(
          `sheet worker timed out after ${SHEET_WORKER_TIMEOUT_MS}ms`,
        ),
      );
    }, SHEET_WORKER_TIMEOUT_MS);
    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      finish();
    };
    worker.onmessage = (event: MessageEvent<SheetWorkerResponse>) => {
      settle(() => resolve(event.data));
    };
    worker.onmessageerror = () => {
      settle(() => reject(new Error('sheet worker message decode error')));
    };
    worker.onerror = (event: ErrorEvent) => {
      settle(() => reject(new Error(event.message || 'sheet worker failed')));
    };
    if (request.kind === 'sheet-import') {
      worker.postMessage(request, [request.bytes]);
      return;
    }
    worker.postMessage(request);
  });

export interface SheetExportFile {
  blob: Blob;
  fileName: string;
}

export const buildSheetExportFile = async (
  rows: readonly SheetRow[],
  format: SheetExportFormat,
): Promise<SheetExportFile> => {
  const response = await runSheetWorkerRequest({
    kind: 'sheet-export',
    jobId: 1,
    format,
    rows,
  });
  if (response.kind === 'sheet-failure') {
    throw new Error(response.message);
  }
  if (response.kind !== 'sheet-export-success') {
    throw new Error('sheet worker returned an unexpected response kind');
  }
  return {
    blob: new Blob([response.blobBytes], { type: response.mimeType }),
    fileName: `koma-studio-corrections-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`,
  };
};

export const parseSheetCorrections = async (file: File): Promise<SheetRow[]> => {
  const bytes = await file.arrayBuffer();
  const response = await runSheetWorkerRequest({
    kind: 'sheet-import',
    jobId: 1,
    fileName: file.name,
    bytes,
  });
  if (response.kind === 'sheet-failure') {
    throw new Error(response.message);
  }
  if (response.kind !== 'sheet-import-success') {
    throw new Error('sheet worker returned an unexpected response kind');
  }
  return response.rows;
};

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const desktopBridgeRef = desktopBridge.desktop;
  const desktopFiles = desktopBridgeRef?.files;
  if (desktopFiles?.saveBlob) {
    void (async () => {
      try {
        const data = await blob.arrayBuffer();
        const result = await desktopFiles.saveBlob({ defaultFileName: fileName, data });
        if (!result.cancelled) {
          useExportStore.getState().setLastExportedFilePath(result.filePath);
          return;
        }
      } catch {
      }
      useExportStore.getState().setLastExportedFilePath(null);
      anchorBlobDownload(blob, fileName);
    })();
    return;
  }
  useExportStore.getState().setLastExportedFilePath(null);
  anchorBlobDownload(blob, fileName);
}

function anchorBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface UseDashboardDownloadBundleArgs {
  getTypographerSessionsByImage: () => Record<string, unknown>;
  renderAioImageToBlob: (img: LoadedImage, regions: AioTextRegion[]) => Promise<Blob>;
  composeCleanerEditableCanvas: (img: LoadedImage, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  composeAioEditableCanvas: (img: LoadedImage, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  hasCleanerManualImageEdits: (imageId: string) => boolean;
  hasAioManualImageEdits: (imageId: string) => boolean;
  getAioDownloadItemForImage: (imageId: string) => DownloadItem | null;
  resolveAioStageKeyForImage: (imageId: string) => AioPipelineSnapshotKey;
}

export function useDashboardDownloadBundle({
  getTypographerSessionsByImage,
  renderAioImageToBlob,
  composeCleanerEditableCanvas,
  composeAioEditableCanvas,
  hasCleanerManualImageEdits,
  hasAioManualImageEdits,
  getAioDownloadItemForImage,
  resolveAioStageKeyForImage,
}: UseDashboardDownloadBundleArgs) {
  const getImages = () => useImageCollectionStore.getState().images;
  const getDownloadItems = () => useExportStore.getState().downloadItems;
  const outFormat = useExportStore((s) => s.outFormat);
  const outQuality = useExportStore((s) => s.outQuality);
  const downloadBundleFormat = useExportStore((s) => s.downloadBundleFormat);
  const downloadIncludeRawText = useExportStore(
    (s) => s.downloadIncludeRawText,
  );
  const downloadIncludeTranslatedText = useExportStore(
    (s) => s.downloadIncludeTranslatedText,
  );
  const downloadIncludeInpaintedImage = useExportStore(
    (s) => s.downloadIncludeInpaintedImage,
  );
  const downloadTextOnly = useExportStore((s) => s.downloadTextOnly);
  const aioTextOnly = downloadTextOnly && downloadBundleFormat !== 'pdf';
  const namingPattern = useExportStore((s) => s.namingPattern);

  const prepareDownloadEntries = useCallback(async (scope: ProcessableMode): Promise<PreparedDownloadEntry[]> => {
    if (scope === 'typesetter') {
      const extension = getImageExtensionFromMime(outFormat);
      const outputs: PreparedDownloadEntry[] = [];
      for (const imgData of getImages()) {
        const regions = useRegionEditorStore.getState().aioDetectionsByImage[imgData.id] ?? [];
        const blob = await renderAioImageToBlob(imgData, regions);
        outputs.push({
          fileName: `koma-studio-typesetter-render-${imgData.file.name.replace(/\s+/g, '-')}.${extension}`,
          blob,
          sourceImageId: imgData.id,
        });
      }
      return outputs;
    }

    if (scope === 'cleaner') {
      const extension = getImageExtensionFromMime(outFormat);
      const outputs: PreparedDownloadEntry[] = [];
      for (const imgData of getImages()) {
        const baseItem = getDownloadItems().find((item) => item.scope === 'cleaner' && item.sourceImageId === imgData.id) ?? null;
        if (hasCleanerManualImageEdits(imgData.id)) {
          const composed = await composeCleanerEditableCanvas(
            imgData,
            useCleanerStore.getState().cleanerProcessedBaseByImage[imgData.id] ||
              baseItem?.previewUrl ||
              ensureDirectPageUrl(imgData),
          );
          const blob = await encodeCanvasToBlob(composed, outFormat, outQuality);
          outputs.push({
            fileName: `koma-studio-cleaner-clean-${imgData.file.name.replace(/\s+/g, '-')}.${extension}`,
            blob,
            sourceImageId: imgData.id,
          });
          continue;
        }
        if (baseItem) {
          outputs.push({
            fileName: baseItem.name,
            blob: baseItem.blob,
            sourceImageId: baseItem.sourceImageId,
          });
        }
      }
      return outputs;
    }

    if (scope === 'translator') {
      return getImages().map((imgData) => ({
        fileName: `${removeFileExtension(imgData.file.name) || 'image'}.txt`,
        blob: new Blob([], { type: imgData.file.type || outFormat }),
        sourceImageId: imgData.id,
      }));
    }

    if (scope === 'aio') {
      const extension = getImageExtensionFromMime(outFormat);
      const outputs: PreparedDownloadEntry[] = [];
      for (const imgData of getImages()) {
        if (aioTextOnly) {
          outputs.push({
            fileName: `${removeFileExtension(imgData.file.name) || 'image'}.txt`,
            blob: new Blob([], { type: imgData.file.type || outFormat }),
            sourceImageId: imgData.id,
          });
          continue;
        }
        const stageKey = resolveAioStageKeyForImage(imgData.id);
        const isAioAiBaked = Boolean(
          useAioPipelineStore.getState().aioAiBakedImageIds[imgData.id],
        );
        if (stageKey === 'render' && !isAioAiBaked) {
          const regions = useRegionEditorStore.getState().aioDetectionsByImage[imgData.id] ?? [];
          const blob = await renderAioImageToBlob(imgData, regions);
          outputs.push({
            fileName: `koma-studio-aio-render-${imgData.file.name.replace(/\s+/g, '-')}.${extension}`,
            blob,
            sourceImageId: imgData.id,
          });
          continue;
        }

        const baseItem = getAioDownloadItemForImage(imgData.id);
        if (hasAioManualImageEdits(imgData.id)) {
          const composed = await composeAioEditableCanvas(
            imgData,
            baseItem?.previewUrl || ensureDirectPageUrl(imgData),
          );
          const blob = await encodeCanvasToBlob(composed, outFormat, outQuality);
          const fallbackName = `koma-studio-aio-${AIO_STAGE_BADGE_LABELS[stageKey].toLowerCase()}-${imgData.file.name.replace(/\s+/g, '-')}.${extension}`;
          outputs.push({
            fileName: baseItem?.name ?? fallbackName,
            blob,
            sourceImageId: imgData.id,
          });
          continue;
        }

        if (baseItem) {
          outputs.push({
            fileName: baseItem.name,
            blob: baseItem.blob,
            sourceImageId: baseItem.sourceImageId,
          });
          continue;
        }

        const sourceExt = getImageExtensionFromMime(imgData.file.type || 'image/png');
        const stageToken = AIO_STAGE_BADGE_LABELS[stageKey].toLowerCase();
        const normalizedStem = removeFileExtension(imgData.file.name).replace(/\s+/g, '-') || 'image';
        outputs.push({
          fileName: `koma-studio-aio-${stageToken}-${normalizedStem}.${sourceExt}`,
          blob: await materializePageFile(imgData),
          sourceImageId: imgData.id,
        });
      }
      return outputs;
    }

    const scopedEntries: PreparedDownloadEntry[] = [];
    for (const item of getDownloadItems()) {
      if (item.scope !== scope) continue;
      scopedEntries.push({
        fileName: item.name,
        blob: item.blob,
        sourceImageId: item.sourceImageId,
      });
    }
    return scopedEntries;
  }, [

    aioTextOnly,
    composeAioEditableCanvas,
    composeCleanerEditableCanvas,
    getAioDownloadItemForImage,
    hasAioManualImageEdits,
    hasCleanerManualImageEdits,
    outFormat,
    outQuality,
    renderAioImageToBlob,
    resolveAioStageKeyForImage,
  ]);

  const buildDownloadBundleBlob = useCallback(async (
    scope: ProcessableMode,
    entries: PreparedDownloadEntry[],
  ): Promise<DownloadBundleResult> => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extensionByFormat: Record<DownloadBundleFormat, string> = {
      zip: 'zip',
      cbz: 'cbz',
      cb7: 'cb7',
      pdf: 'pdf',
    };
    const translatorScope = scope === 'translator';
    const bundleFormat: DownloadBundleFormat = translatorScope ? 'zip' : downloadBundleFormat;
    const targetExt = extensionByFormat[bundleFormat];

    if (bundleFormat === 'pdf') {
      const orderedEntries = [...entries].sort((a, b) => {
        const ai = getImages().findIndex((item) => item.id === a.sourceImageId);
        const bi = getImages().findIndex((item) => item.id === b.sourceImageId);
        return ai - bi;
      });
      const pdfPages: WorkerPdfPage[] = [];
      for (const entry of orderedEntries) {
        const normalizedBlob = await normalizeBlobForPdf(entry.blob);
        const bytes = new Uint8Array(await normalizedBlob.arrayBuffer());
        pdfPages.push({
          sourceImageId: entry.sourceImageId,
          bytes,
          isJpeg: normalizedBlob.type === 'image/jpeg',
        });
      }
      const result = await getExportPool().package({
        bundleFormat: 'pdf',
        scope,
        outFormat,
        zipEntries: [],
        pdfPages,
        createdAt: new Date().toISOString(),
        flags: {
          includeRawText: false,
          includeTranslatedText: false,
          includeInpaintedImage: false,
          includesTypographerSession: false,
        },
        transferBytes: true,
      });
      return {
        blob: new Blob([result.blobBytes], { type: result.mimeType }),
        fileName: resolveBundleFileName(namingPattern, orderedEntries[0] ?? entries[0], scope, timestamp, targetExt),
        shellFilePath: null,
      };
    }

    const { strToU8 } = await import('fflate');
    const orderedEntries = [...entries].sort((a, b) => {
      const ai = getImages().findIndex((item) => item.id === a.sourceImageId);
      const bi = getImages().findIndex((item) => item.id === b.sourceImageId);
      return ai - bi;
    });
    const zipFiles: Record<string, Uint8Array> = {};
    const inpaintedByImageId = new Map<string, DownloadItem>();
    for (const item of getDownloadItems()) {
      if (item.scope === 'aio') inpaintedByImageId.set(item.sourceImageId, item);
    }

    const textOnlyFallback = aioTextOnly && !downloadIncludeRawText && !downloadIncludeTranslatedText;
    const aioIncludeRawText = downloadIncludeRawText || textOnlyFallback;
    const aioIncludeTranslatedText = downloadIncludeTranslatedText || textOnlyFallback;

    const imageWriteJobs = orderedEntries.map(async (entry, index) => {
      const imageRef = getImages().find((item) => item.id === entry.sourceImageId);
      const imageExt = getImageExtensionFromMime(entry.blob.type || outFormat);
      const patternedStem = buildExportName(namingPattern, buildEntryNamingContext(entry, index, imageExt));
      const baseName = patternedStem ?? sanitizeArchivePathToken(removeFileExtension(imageRef?.file.name ?? `page-${index + 1}`));
      const orderedIndex = String(index + 1).padStart(3, '0');
      const imagePath = patternedStem === null
        ? `images/${orderedIndex}-${baseName}.${imageExt}`
        : `images/${orderedIndex}-${ensureExportExtension(baseName, imageExt)}`;
      const textOnlyEntry = (scope === 'aio' && aioTextOnly) || translatorScope;
      if (!textOnlyEntry) {
        zipFiles[imagePath] = new Uint8Array(await entry.blob.arrayBuffer());
      }

      if (scope !== 'aio' && scope !== 'typesetter' && !translatorScope) return;
      const regionsByImage = translatorScope
        ? useTranslatorStore.getState().translatorDetectionsByImage
        : useRegionEditorStore.getState().aioDetectionsByImage;
      const regions = regionsByImage[entry.sourceImageId] ?? [];
      if ((scope === 'aio' && aioIncludeRawText) || translatorScope) {
        const rawTextPath = `texts/raw/${orderedIndex}-${baseName}.txt`;
        zipFiles[rawTextPath] = strToU8(buildRegionTextDump(regions, 'recognized'));
      }
      if ((scope === 'aio' && aioIncludeTranslatedText) || translatorScope) {
        const translatedTextPath = `texts/translated/${orderedIndex}-${baseName}.txt`;
        zipFiles[translatedTextPath] = strToU8(buildRegionTextDump(regions, 'translated'));
      }
      const notesDump = scope === 'aio' || translatorScope ? buildRegionNotesDump(regions) : '';
      if (notesDump) {
        const notesTextPath = `texts/notes/${orderedIndex}-${baseName}.txt`;
        zipFiles[notesTextPath] = strToU8(notesDump);
      }
      const typographySession =
        getTypographerSessionsByImage()[entry.sourceImageId];
      if (scope === 'typesetter' && typographySession) {
        const sessionPath = `typographer/${orderedIndex}-${baseName}.session.json`;
        zipFiles[sessionPath] = strToU8(JSON.stringify(typographySession, null, 2));
      }
      if (scope === 'aio' && !textOnlyEntry && downloadIncludeInpaintedImage) {
        const inpainted = inpaintedByImageId.get(entry.sourceImageId);
        const imageState = getImages().find((item) => item.id === entry.sourceImageId);
        if (imageState && hasAioManualImageEdits(entry.sourceImageId)) {
          const composed = await composeAioEditableCanvas(
            imageState,
            inpainted?.previewUrl || ensureDirectPageUrl(imageState),
          );
          const inpaintedBlob = await encodeCanvasToBlob(composed, 'image/png', 1);
          const inpaintedPath = `inpainted/${orderedIndex}-${baseName}.png`;
          zipFiles[inpaintedPath] = new Uint8Array(await inpaintedBlob.arrayBuffer());
        } else if (inpainted) {
          const inpaintedExt = getImageExtensionFromMime(inpainted.blob.type || 'image/png');
          const inpaintedPath = `inpainted/${orderedIndex}-${baseName}.${inpaintedExt}`;
          zipFiles[inpaintedPath] = new Uint8Array(await inpainted.blob.arrayBuffer());
        }
      }
    });

    await Promise.all(imageWriteJobs);

    const zipEntries: WorkerZipEntry[] = Object.entries(zipFiles).map(
      ([path, bytes]) => ({ path, bytes }),
    );
    const fileName = resolveBundleFileName(namingPattern, orderedEntries[0] ?? entries[0], scope, timestamp, targetExt);
    if (bundleFormat === 'zip' || bundleFormat === 'cbz') {
      const outcome = await streamBundleViaShell(bundleFormat, fileName, zipEntries);
      if (outcome !== null) {
        if (!outcome.cancelled) {
          useExportStore.getState().setLastExportedFilePath(outcome.filePath);
        }
        return {
          blob: null,
          fileName,
          shellFilePath: outcome.cancelled ? null : outcome.filePath,
        };
      }
    }
    const result = await getExportPool().package({
      bundleFormat,
      scope,
      outFormat,
      zipEntries,
      createdAt: new Date().toISOString(),
      flags: {
        includeRawText: scope === 'aio' ? aioIncludeRawText : translatorScope,
        includeTranslatedText: scope === 'aio' ? aioIncludeTranslatedText : translatorScope,
        includeInpaintedImage: scope === 'aio' && !aioTextOnly ? downloadIncludeInpaintedImage : false,
        includesTypographerSession: scope === 'typesetter',
      },
      transferBytes: true,
    });
    return {
      blob: new Blob([result.blobBytes], { type: result.mimeType }),
      fileName,
      shellFilePath: null,
    };
  }, [

    aioTextOnly,
    composeAioEditableCanvas,
    downloadBundleFormat,
    downloadIncludeInpaintedImage,
    downloadIncludeRawText,
    downloadIncludeTranslatedText,
    hasAioManualImageEdits,
    namingPattern,
    outFormat,
    getTypographerSessionsByImage,
  ]);

  return {
    prepareDownloadEntries,
    buildDownloadBundleBlob,
  };
}
