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
  canvasToBlob,
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
import type { SheetRow } from '../../../utils/spreadsheet-bridge';
import type { WorkerPdfPage, WorkerZipEntry } from './exportPackageWorker';
import type {
  SheetExportFormat,
  SheetWorkerRequest,
  SheetWorkerResponse,
} from './exportSheetWorker';
import { createExportWorkerPool, type ExportWorkerPool } from './exportWorkerPool';
import { useCleanerStore } from '../stores/cleaner-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';

export { useDashboardDownloadActions, useDashboardPsdDownload } from './export-download.actions';
export { useExportDownloadLifecycle, useExportDownloadAvailability } from './export-download.availability';

let sharedExportPool: ExportWorkerPool | null = null;
const getExportPool = (): ExportWorkerPool => {
  sharedExportPool ??= createExportWorkerPool();
  return sharedExportPool;
};

/**
 * One-shot sheet worker run (Feature 3): a fresh standalone worker per
 * operation, terminated on settle. Sheet ops are rare single-file ops — no
 * pool, no queue, and `xlsx` stays out of every other chunk.
 */
const runSheetWorkerRequest = (request: SheetWorkerRequest): Promise<SheetWorkerResponse> =>
  new Promise<SheetWorkerResponse>((resolve, reject) => {
    const worker = new Worker(new URL('./exportSheetWorker.ts', import.meta.url), {
      type: 'module',
    });
    const settle = (finish: () => void) => {
      worker.terminate();
      finish();
    };
    worker.onmessage = (event: MessageEvent<SheetWorkerResponse>) => {
      settle(() => resolve(event.data));
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
  const desktopFiles = desktopBridge.desktop?.files;
  if (desktopFiles?.saveBlob) {
    // Native save dialog on desktop; browser fallback if the dialog is
    // cancelled or the IPC fails.
    void (async () => {
      try {
        const data = await blob.arrayBuffer();
        const result = await desktopFiles.saveBlob({ defaultFileName: fileName, data });
        if (!result.cancelled) {
          return;
        }
      } catch {
        // fall through to anchor download
      }
      anchorBlobDownload(blob, fileName);
    })();
    return;
  }
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
            useCleanerStore.getState().cleanerProcessedBaseByImage[imgData.id] ?? baseItem?.previewUrl ?? imgData.url,
          );
          const blob = await canvasToBlob(composed, outFormat, outQuality);
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
          const composed = await composeAioEditableCanvas(imgData, baseItem?.previewUrl ?? imgData.url);
          const blob = await canvasToBlob(composed, outFormat, outQuality);
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
  ): Promise<{ blob: Blob; fileName: string }> => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extensionByFormat: Record<DownloadBundleFormat, string> = {
      zip: 'zip',
      cbz: 'cbz',
      cb7: 'cb7',
      pdf: 'pdf',
    };

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
      });
      return {
        blob: new Blob([result.blobBytes], { type: result.mimeType }),
        fileName: `koma-studio-${scope}-${timestamp}.pdf`,
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

    const imageWriteJobs = orderedEntries.map(async (entry, index) => {
      const imageRef = getImages().find((item) => item.id === entry.sourceImageId);
      const baseName = sanitizeArchivePathToken(removeFileExtension(imageRef?.file.name ?? `page-${index + 1}`));
      const imageExt = getImageExtensionFromMime(entry.blob.type || outFormat);
      const imagePath = `images/${String(index + 1).padStart(3, '0')}-${baseName}.${imageExt}`;
      zipFiles[imagePath] = new Uint8Array(await entry.blob.arrayBuffer());

      if (scope !== 'aio' && scope !== 'typesetter') return;
      const regions = useRegionEditorStore.getState().aioDetectionsByImage[entry.sourceImageId] ?? [];
      if (scope === 'aio' && downloadIncludeRawText) {
        const rawTextPath = `texts/raw/${String(index + 1).padStart(3, '0')}-${baseName}.txt`;
        zipFiles[rawTextPath] = strToU8(buildRegionTextDump(regions, 'recognized'));
      }
      if (scope === 'aio' && downloadIncludeTranslatedText) {
        const translatedTextPath = `texts/translated/${String(index + 1).padStart(3, '0')}-${baseName}.txt`;
        zipFiles[translatedTextPath] = strToU8(buildRegionTextDump(regions, 'translated'));
      }
      const notesDump = scope === 'aio' ? buildRegionNotesDump(regions) : '';
      if (scope === 'aio' && notesDump) {
        const notesTextPath = `texts/notes/${String(index + 1).padStart(3, '0')}-${baseName}.txt`;
        zipFiles[notesTextPath] = strToU8(notesDump);
      }
      const typographySession =
        getTypographerSessionsByImage()[entry.sourceImageId];
      if (scope === 'typesetter' && typographySession) {
        const sessionPath = `typographer/${String(index + 1).padStart(3, '0')}-${baseName}.session.json`;
        zipFiles[sessionPath] = strToU8(JSON.stringify(typographySession, null, 2));
      }
      if (scope === 'aio' && downloadIncludeInpaintedImage) {
        const inpainted = inpaintedByImageId.get(entry.sourceImageId);
        const imageState = getImages().find((item) => item.id === entry.sourceImageId);
        if (imageState && hasAioManualImageEdits(entry.sourceImageId)) {
          const composed = await composeAioEditableCanvas(
            imageState,
            inpainted?.previewUrl ?? imageState.url,
          );
          const inpaintedBlob = await canvasToBlob(composed, 'image/png', 1);
          const inpaintedPath = `inpainted/${String(index + 1).padStart(3, '0')}-${baseName}.png`;
          zipFiles[inpaintedPath] = new Uint8Array(await inpaintedBlob.arrayBuffer());
        } else if (inpainted) {
          const inpaintedExt = getImageExtensionFromMime(inpainted.blob.type || 'image/png');
          const inpaintedPath = `inpainted/${String(index + 1).padStart(3, '0')}-${baseName}.${inpaintedExt}`;
          zipFiles[inpaintedPath] = new Uint8Array(await inpainted.blob.arrayBuffer());
        }
      }
    });

    await Promise.all(imageWriteJobs);

    const zipEntries: WorkerZipEntry[] = Object.entries(zipFiles).map(
      ([path, bytes]) => ({ path, bytes }),
    );
    const result = await getExportPool().package({
      bundleFormat: downloadBundleFormat,
      scope,
      outFormat,
      zipEntries,
      createdAt: new Date().toISOString(),
      flags: {
        includeRawText: scope === 'aio' ? downloadIncludeRawText : false,
        includeTranslatedText: scope === 'aio' ? downloadIncludeTranslatedText : false,
        includeInpaintedImage: scope === 'aio' ? downloadIncludeInpaintedImage : false,
        includesTypographerSession: scope === 'typesetter',
      },
    });
    const targetExt = extensionByFormat[downloadBundleFormat];
    return {
      blob: new Blob([result.blobBytes], { type: result.mimeType }),
      fileName: `koma-studio-${scope}-${timestamp}.${targetExt}`,
    };
  }, [

    composeAioEditableCanvas,
    downloadBundleFormat,
    downloadIncludeInpaintedImage,
    downloadIncludeRawText,
    downloadIncludeTranslatedText,
    hasAioManualImageEdits,
    outFormat,
    getTypographerSessionsByImage,
  ]);

  return {
    prepareDownloadEntries,
    buildDownloadBundleBlob,
  };
}