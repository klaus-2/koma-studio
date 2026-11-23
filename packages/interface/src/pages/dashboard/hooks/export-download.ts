/**
 * Export-download domain — entry point. Hosts the per-scope download bundle
 * preparation (typesetter/cleaner/aio/translator entry rendering, zip/txt/pdf
 * packaging) and re-exports the per-concern sibling modules split out in T10,
 * so consumer imports from 'hooks/export-download' stay valid.
 */
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
import { useWorksStore } from '../stores/works-store';

export { useDashboardDownloadActions, useDashboardPsdDownload } from './export-download.actions';
export { useExportDownloadAvailability } from './export-download.availability';

export interface DownloadBundleResult {
  readonly fileName: string;
  readonly blob: Blob | null;
  readonly shellFilePath: string | null;
}

let sharedExportPool: ExportWorkerPool | null = null;
const getExportPool = (): ExportWorkerPool => {
  sharedExportPool ??= createExportWorkerPool();
  return sharedExportPool;
};

/** Naming context of one ordered bundle entry: works/chapter label/AIO
 * target language resolve `{obra}/{capitulo}/{idioma}` (bundle scopes never
 * reach this builder as 'translator' — same rule as export-download.actions).
 * Exported alongside `resolveBundleFileName` as the naming integration seam. */
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

/** Bundle name: pattern-based when set (recorded as used), else the legacy one.
 *  Exported as the integration seam of the naming feature: the user-
 *  visible bundle name and the recent-patterns recording flow through here. */
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

/**
 * One-shot sheet worker run (Feature 3): a fresh standalone worker per
 * operation, terminated on settle. Sheet ops are rare single-file ops — no
 * pool, no queue, and `xlsx` stays out of every other chunk. A wedged worker
 * is terminated after `SHEET_WORKER_TIMEOUT_MS` so the promise always settles.
 */
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

/** Serializes sheet rows to CSV/XLSX bytes in the standalone sheet worker. */
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

/** Parses a reviewer's CSV/XLSX file back into sheet rows via the worker. */
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

/** Anchor download of a generated blob (object-URL lifecycle 1:1). */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const desktopBridgeRef = desktopBridge.desktop;
  const desktopFiles = desktopBridgeRef?.files;
  if (desktopFiles?.saveBlob) {
    // Native save dialog on desktop; browser fallback if the dialog is
    // cancelled or the IPC fails.
    void (async () => {
      try {
        const data = await blob.arrayBuffer();
        const result = await desktopFiles.saveBlob({ defaultFileName: fileName, data });
        if (!result.cancelled) {
          useExportStore.getState().setLastExportedFilePath(result.filePath);
          return;
        }
      } catch {
        // fall through to anchor download
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
      // ponytail: sequential by design — canvas render pipeline holds one full-page bitmap at a time (parallelizing would hold N decoded pages)
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
      // ponytail: sequential by design — canvas composition holds one full-page bitmap at a time (parallelizing would hold N decoded pages)
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

    if (scope === 'aio') {
      const extension = getImageExtensionFromMime(outFormat);
      const outputs: PreparedDownloadEntry[] = [];
      // ponytail: sequential by design — canvas composition holds one full-page bitmap at a time (parallelizing would hold N decoded pages)
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
        if (stageKey === 'render') {
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
          // The export owns these bytes: the archive-backed page is
          // materialized and kept until the bundle is written.
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
    const targetExt = extensionByFormat[downloadBundleFormat];

    if (downloadBundleFormat === 'pdf') {
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
      // First ordered page = representative context; empty pattern → legacy.
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
      // Empty pattern → the legacy base name exactly; a pattern resolves the
      // shared page stem (reused by the sibling texts/typographer paths).
      const patternedStem = buildExportName(namingPattern, buildEntryNamingContext(entry, index, imageExt));
      const baseName = patternedStem ?? sanitizeArchivePathToken(removeFileExtension(imageRef?.file.name ?? `page-${index + 1}`));
      const orderedIndex = String(index + 1).padStart(3, '0');
      const imagePath = patternedStem === null
        ? `images/${orderedIndex}-${baseName}.${imageExt}`
        : `images/${orderedIndex}-${ensureExportExtension(baseName, imageExt)}`;
      const textOnlyEntry = scope === 'aio' && aioTextOnly;
      if (!textOnlyEntry) {
        zipFiles[imagePath] = new Uint8Array(await entry.blob.arrayBuffer());
      }

      if (scope !== 'aio' && scope !== 'typesetter') return;
      const regions = useRegionEditorStore.getState().aioDetectionsByImage[entry.sourceImageId] ?? [];
      if (scope === 'aio' && aioIncludeRawText) {
        const rawTextPath = `texts/raw/${orderedIndex}-${baseName}.txt`;
        zipFiles[rawTextPath] = strToU8(buildRegionTextDump(regions, 'recognized'));
      }
      if (scope === 'aio' && aioIncludeTranslatedText) {
        const translatedTextPath = `texts/translated/${orderedIndex}-${baseName}.txt`;
        zipFiles[translatedTextPath] = strToU8(buildRegionTextDump(regions, 'translated'));
      }
      const notesDump = scope === 'aio' ? buildRegionNotesDump(regions) : '';
      if (scope === 'aio' && notesDump) {
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
    if (downloadBundleFormat === 'zip' || downloadBundleFormat === 'cbz') {
      const outcome = await streamBundleViaShell(downloadBundleFormat, fileName, zipEntries);
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
      bundleFormat: downloadBundleFormat,
      scope,
      outFormat,
      zipEntries,
      createdAt: new Date().toISOString(),
      flags: {
        includeRawText: scope === 'aio' ? aioIncludeRawText : false,
        includeTranslatedText: scope === 'aio' ? aioIncludeTranslatedText : false,
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
