/**
 * Export-download domain — entry point. Hosts the per-scope download bundle
 * preparation (typesetter/cleaner/aio/translator entry rendering, zip/txt/pdf
 * packaging) and re-exports the per-concern sibling modules split out in T10,
 * so consumer imports from 'hooks/export-download' stay valid.
 */
import { useCallback } from 'react';

import { AIO_STAGE_BADGE_LABELS } from '../../../constants/dashboard.constants';
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
  PreparedDownloadEntry,
  ProcessableMode,
} from '../../../types/dashboard.types';
import { useCleanerStore } from '../stores/cleaner-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';

export { useDashboardDownloadActions, useDashboardPsdDownload } from './export-download.actions';
export { useExportDownloadLifecycle, useExportDownloadAvailability } from './export-download.availability';

/** Anchor download of a generated blob (object-URL lifecycle 1:1). */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface ImageRef {
  id: string;
  file: File;
  url: string;
}

interface UseDashboardDownloadBundleArgs {
  getTypographerSessionsByImage: () => Record<string, unknown>;
  renderAioImageToBlob: (img: ImageRef, regions: AioTextRegion[]) => Promise<Blob>;
  composeCleanerEditableCanvas: (img: ImageRef, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  composeAioEditableCanvas: (img: ImageRef, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
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
  const images = useImageCollectionStore((s) => s.images);
  const downloadItems = useExportStore((s) => s.downloadItems);
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
      for (const imgData of images) {
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
      for (const imgData of images) {
        const baseItem = downloadItems.find((item) => item.scope === 'cleaner' && item.sourceImageId === imgData.id) ?? null;
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
      for (const imgData of images) {
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
          blob: imgData.file,
          sourceImageId: imgData.id,
        });
      }
      return outputs;
    }

    const scopedEntries: PreparedDownloadEntry[] = [];
    for (const item of downloadItems) {
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
    downloadItems,
    getAioDownloadItemForImage,
    hasAioManualImageEdits,
    hasCleanerManualImageEdits,
    images,
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
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const orderedEntries = [...entries].sort((a, b) => {
        const ai = images.findIndex((item) => item.id === a.sourceImageId);
        const bi = images.findIndex((item) => item.id === b.sourceImageId);
        return ai - bi;
      });
      // ponytail: sequential by design — pdf-lib embeds pages in order; each embed mutates the document
      for (const entry of orderedEntries) {
        const normalizedBlob = await normalizeBlobForPdf(entry.blob);
        const bytes = new Uint8Array(await normalizedBlob.arrayBuffer());
        const embedded = normalizedBlob.type === 'image/jpeg'
          ? await pdf.embedJpg(bytes)
          : await pdf.embedPng(bytes);
        const page = pdf.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: embedded.width,
          height: embedded.height,
        });
      }
      const pdfBytes = await pdf.save();
      const pdfBytesCopy = new Uint8Array(pdfBytes.byteLength);
      pdfBytesCopy.set(pdfBytes);
      return {
        blob: new Blob([pdfBytesCopy.buffer], { type: 'application/pdf' }),
        fileName: `koma-studio-${scope}-${timestamp}.pdf`,
      };
    }

    const { zipSync, strToU8 } = await import('fflate');
    const orderedEntries = [...entries].sort((a, b) => {
      const ai = images.findIndex((item) => item.id === a.sourceImageId);
      const bi = images.findIndex((item) => item.id === b.sourceImageId);
      return ai - bi;
    });
    const zipFiles: Record<string, Uint8Array> = {};
    const inpaintedByImageId = new Map<string, DownloadItem>();
    for (const item of downloadItems) {
      if (item.scope === 'aio') inpaintedByImageId.set(item.sourceImageId, item);
    }

    const imageWriteJobs = orderedEntries.map(async (entry, index) => {
      const imageRef = images.find((item) => item.id === entry.sourceImageId);
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
        const imageState = images.find((item) => item.id === entry.sourceImageId);
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

    zipFiles['manifest.json'] = strToU8(JSON.stringify({
      scope,
      bundleFormat: downloadBundleFormat,
      imageFormat: outFormat,
      createdAt: new Date().toISOString(),
      includeRawText: scope === 'aio' ? downloadIncludeRawText : false,
      includeTranslatedText: scope === 'aio' ? downloadIncludeTranslatedText : false,
      includeInpaintedImage: scope === 'aio' ? downloadIncludeInpaintedImage : false,
      includesTypographerSession: scope === 'typesetter',
      files: Object.keys(zipFiles).sort(),
    }, null, 2));

    const zipped = zipSync(zipFiles, { level: 6 });
    const zippedCopy = new Uint8Array(zipped.byteLength);
    zippedCopy.set(zipped);
    const targetExt = extensionByFormat[downloadBundleFormat];
    return {
      blob: new Blob([zippedCopy.buffer], { type: 'application/zip' }),
      fileName: `koma-studio-${scope}-${timestamp}.${targetExt}`,
    };
  }, [

    composeAioEditableCanvas,
    downloadBundleFormat,
    downloadIncludeInpaintedImage,
    downloadIncludeRawText,
    downloadIncludeTranslatedText,
    downloadItems,
    hasAioManualImageEdits,
    images,
    outFormat,
    getTypographerSessionsByImage,
  ]);

  return {
    prepareDownloadEntries,
    buildDownloadBundleBlob,
  };
}
