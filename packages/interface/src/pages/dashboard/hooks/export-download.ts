import { useCallback, useEffect } from 'react';

import { useI18n } from '../../../i18n';
import {
  AIO_STAGE_BADGE_LABELS,
  INFO_MODES,
} from '../../../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  applyRenderDefaultsToRegion,
  buildDefaultRegionRenderText,
  buildRegionNotesDump,
  buildRegionTextDump,
  buildTranslationNoteOverlayRegions,
  canvasToBlob,
  cloneRenderStyle,
  cloneTypographyShape,
  applyDetectedGradientToStyle,
  dataUrlToBlob,
  ensureCanvasFontLoaded,
  getRegionTextForOverlayTarget,
  getImageExtensionFromMime,
  loadImageFromSource,
  normalizeBlobForPdf,
  removeFileExtension,
  resolveDownloadFileName,
  sanitizeArchivePathToken,
  scaleTypographyShapeForBounds,
} from '../../../utils/dashboard.utils';
import { computeRenderTextLayout, drawRenderedTextInRegion } from '../../../utils/renderText';
import type { TypographySessionSourceType } from '../../../typography/types';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  DownloadBundleFormat,
  DownloadItem,
  LoadedImage,
  PreparedDownloadEntry,
  ProcessableMode,
  PsdTextLayerEntry,
  RenderTextOverlayTarget,
} from '../../../types/dashboard.types';
import { parseApiError } from '../helpers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';

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
  typographerSessionsByImage: Record<string, unknown>;
  renderAioImageToBlob: (img: ImageRef, regions: AioTextRegion[]) => Promise<Blob>;
  composeCleanerEditableCanvas: (img: ImageRef, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  composeAioEditableCanvas: (img: ImageRef, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  hasCleanerManualImageEdits: (imageId: string) => boolean;
  hasAioManualImageEdits: (imageId: string) => boolean;
  getAioDownloadItemForImage: (imageId: string) => DownloadItem | null;
  resolveAioStageKeyForImage: (imageId: string) => AioPipelineSnapshotKey;
}

export function useDashboardDownloadBundle({
  typographerSessionsByImage,
  renderAioImageToBlob,
  composeCleanerEditableCanvas,
  composeAioEditableCanvas,
  hasCleanerManualImageEdits,
  hasAioManualImageEdits,
  getAioDownloadItemForImage,
  resolveAioStageKeyForImage,
}: UseDashboardDownloadBundleArgs) {
  const images = useImageCollectionStore((s) => s.images);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const downloadItems = useExportStore((s) => s.downloadItems);
  const cleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.cleanerProcessedBaseByImage,
  );
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
      for (const imgData of images) {
        const regions = aioDetectionsByImage[imgData.id] ?? [];
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
      for (const imgData of images) {
        const baseItem = downloadItems.find((item) => item.scope === 'cleaner' && item.sourceImageId === imgData.id) ?? null;
        if (hasCleanerManualImageEdits(imgData.id)) {
          const composed = await composeCleanerEditableCanvas(
            imgData,
            cleanerProcessedBaseByImage[imgData.id] ?? baseItem?.previewUrl ?? imgData.url,
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
      for (const imgData of images) {
        const stageKey = resolveAioStageKeyForImage(imgData.id);
        if (stageKey === 'render') {
          const regions = aioDetectionsByImage[imgData.id] ?? [];
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

    return downloadItems
      .filter((item) => item.scope === scope)
      .map((item) => ({
        fileName: item.name,
        blob: item.blob,
        sourceImageId: item.sourceImageId,
      }));
  }, [
    aioDetectionsByImage,
    cleanerProcessedBaseByImage,
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
    const inpaintedByImageId = new Map(
      downloadItems
        .filter((item) => item.scope === 'aio')
        .map((item) => [item.sourceImageId, item]),
    );

    const imageWriteJobs = orderedEntries.map(async (entry, index) => {
      const imageRef = images.find((item) => item.id === entry.sourceImageId);
      const baseName = sanitizeArchivePathToken(removeFileExtension(imageRef?.file.name ?? `page-${index + 1}`));
      const imageExt = getImageExtensionFromMime(entry.blob.type || outFormat);
      const imagePath = `images/${String(index + 1).padStart(3, '0')}-${baseName}.${imageExt}`;
      zipFiles[imagePath] = new Uint8Array(await entry.blob.arrayBuffer());

      if (scope !== 'aio' && scope !== 'typesetter') return;
      const regions = aioDetectionsByImage[entry.sourceImageId] ?? [];
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
      const typographySession = typographerSessionsByImage[entry.sourceImageId];
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
    aioDetectionsByImage,
    composeAioEditableCanvas,
    downloadBundleFormat,
    downloadIncludeInpaintedImage,
    downloadIncludeRawText,
    downloadIncludeTranslatedText,
    downloadItems,
    hasAioManualImageEdits,
    images,
    outFormat,
    typographerSessionsByImage,
  ]);

  return {
    prepareDownloadEntries,
    buildDownloadBundleBlob,
  };
}

interface UseDashboardDownloadActionsArgs {
  prepareDownloadEntries: (scope: ProcessableMode) => Promise<PreparedDownloadEntry[]>;
  buildDownloadBundleBlob: (scope: ProcessableMode, entries: PreparedDownloadEntry[]) => Promise<{ blob: Blob; fileName: string }>;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  setDownloadMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useDashboardDownloadActions({
  prepareDownloadEntries,
  buildDownloadBundleBlob,
  triggerBlobDownload,
  setDownloadMenuOpen,
}: UseDashboardDownloadActionsArgs) {
  const { t } = useI18n();
  const images = useImageCollectionStore((s) => s.images);
  const lastActionScope = useExportStore((s) => s.lastActionScope);
  const downloadBundleFormat = useExportStore((s) => s.downloadBundleFormat);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const buildTranslatorDownloadBlob = useCallback(async (): Promise<{ blob: Blob; fileName: string }> => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (translatorWorkspaceMode === 'text') {
      const textBlob = new Blob([translatorTranslatedText], { type: 'text/plain;charset=utf-8' });
      return {
        blob: textBlob,
        fileName: `koma-studio-translator-text-${timestamp}.txt`,
      };
    }

    const { zipSync, strToU8 } = await import('fflate');
    const zipFiles: Record<string, Uint8Array> = {};
    images.forEach((imgData, index) => {
      const regions = translatorDetectionsByImage[imgData.id] ?? [];
      const baseName = sanitizeArchivePathToken(removeFileExtension(imgData.file.name));
      zipFiles[`texts/raw/${String(index + 1).padStart(3, '0')}-${baseName}.txt`] = strToU8(
        buildRegionTextDump(regions, 'recognized'),
      );
      zipFiles[`texts/translated/${String(index + 1).padStart(3, '0')}-${baseName}.txt`] = strToU8(
        buildRegionTextDump(regions, 'translated'),
      );
    });

    const zipped = zipSync(zipFiles, { level: 6 });
    const zippedCopy = new Uint8Array(zipped.byteLength);
    zippedCopy.set(zipped);
    return {
      blob: new Blob([zippedCopy.buffer], { type: 'application/zip' }),
      fileName: `koma-studio-translator-visual-${timestamp}.zip`,
    };
  }, [images, translatorDetectionsByImage, translatorTranslatedText, translatorWorkspaceMode]);

  const handleDownload = useCallback(async (scope: ProcessableMode | null = lastActionScope) => {
    try {
      if (!scope) {
        setStatusMessage('No results to download.');
        return;
      }

      if (scope === 'translator') {
        const translatorCanDownload = translatorWorkspaceMode === 'text'
          ? translatorTranslatedText.trim().length > 0
          : images.some((img) => {
            const regions = translatorDetectionsByImage[img.id] ?? [];
            return regions.some((region) => (
              (region.recognizedText ?? '').trim().length > 0
              || (region.translatedText ?? '').trim().length > 0
            ));
          });
        if (!translatorCanDownload) {
          setStatusMessage(t('downloadActions.noTranslatorResults'));
          return;
        }
        const { blob, fileName } = await buildTranslatorDownloadBlob();
        triggerBlobDownload(blob, fileName);
        setDownloadMenuOpen(false);
        setStatusMessage(`File ${fileName} generated successfully.`);
        return;
      }

      const entries = await prepareDownloadEntries(scope);
      if (entries.length === 0) {
        setStatusMessage('No results to download in this tab.');
        return;
      }

      const { blob, fileName } = await buildDownloadBundleBlob(scope, entries);
      triggerBlobDownload(blob, fileName);
      setDownloadMenuOpen(false);
      if (downloadBundleFormat === 'cb7') {
        setStatusMessage(`Pacote ${fileName} gerado (modo CB7 experimental com container ZIP).`);
        return;
      }
      setStatusMessage(`Package ${fileName} generated successfully.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to generate the download package.');
    }
  }, [
    buildDownloadBundleBlob,
    buildTranslatorDownloadBlob,
    downloadBundleFormat,
    images,
    lastActionScope,
    prepareDownloadEntries,
    setDownloadMenuOpen,
    setStatusMessage,
    t,
    translatorDetectionsByImage,
    translatorTranslatedText,
    translatorWorkspaceMode,
    triggerBlobDownload,
  ]);

  return {
    buildTranslatorDownloadBlob,
    handleDownload,
  };
}

interface UseDashboardPsdDownloadArgs {
  activeImage: LoadedImage | null;
  localApiUrl: string;
  setDownloadMenuOpen: (value: boolean) => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  resolveAioStageKeyForImage: (imageId: string) => AioPipelineSnapshotKey;
  getAioDownloadItemForImage: (imageId: string) => { blob: Blob; previewUrl?: string | null } | null;
  hasAioManualImageEdits: (imageId: string) => boolean;
  composeAioEditableCanvas: (img: LoadedImage, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  setTypographerSessionSourceType: (imageId: string, sourceType: TypographySessionSourceType) => void;
}

export function useDashboardPsdDownload({
  activeImage,
  localApiUrl,
  setDownloadMenuOpen,
  triggerBlobDownload,
  resolveAioStageKeyForImage,
  getAioDownloadItemForImage,
  hasAioManualImageEdits,
  composeAioEditableCanvas,
  setTypographerSessionSourceType,
}: UseDashboardPsdDownloadArgs) {
  const images = useImageCollectionStore((s) => s.images);
  const mode = useUiShellStore((s) => s.mode);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const renderDefaultStyle = useRegionEditorStore((s) => s.renderDefaultStyle);
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const translatorProcessedBaseByImage = useTranslatorStore(
    (s) => s.translatorProcessedBaseByImage,
  );
  const downloadPsdCompression = useExportStore((s) => s.downloadPsdCompression);
  const downloadPsdDpi = useExportStore((s) => s.downloadPsdDpi);
  const downloadPsdIncludeIndividualCrops = useExportStore(
    (s) => s.downloadPsdIncludeIndividualCrops,
  );
  const downloadPsdIncludeMetadataJson = useExportStore(
    (s) => s.downloadPsdIncludeMetadataJson,
  );
  const downloadPsdIncludeOcrOverlay = useExportStore(
    (s) => s.downloadPsdIncludeOcrOverlay,
  );
  const downloadPsdIncludeRawTextLayer = useExportStore(
    (s) => s.downloadPsdIncludeRawTextLayer,
  );
  const downloadPsdIncludeTranslatedTextLayer = useExportStore(
    (s) => s.downloadPsdIncludeTranslatedTextLayer,
  );
  const downloadPsdUsePhotoshopTextLayers = useExportStore(
    (s) => s.downloadPsdUsePhotoshopTextLayers,
  );
  const setDownloadPsdLoading = useExportStore((s) => s.setDownloadPsdLoading);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const translationNotesEnabled = useLlmProvidersStore(
    (s) => s.llmSettings.translation_notes_enabled,
  );

  const resolveTypographerSourcePayloadForImage = useCallback((imgData: LoadedImage): { file: File; sourceType: TypographySessionSourceType } => {
    const downloadItem = getAioDownloadItemForImage(imgData.id);
    if (downloadItem) {
      return {
        file: downloadItem.blob instanceof File
          ? downloadItem.blob
          : new File([downloadItem.blob], imgData.file.name, { type: downloadItem.blob.type || imgData.file.type || 'image/png' }),
        sourceType: 'aio-handoff',
      };
    }
    return {
      file: imgData.file,
      sourceType: 'generic-upload',
    };
  }, [getAioDownloadItemForImage]);

  const renderAioTextLayersForKind = useCallback(async (
    imgData: LoadedImage,
    regions: AioTextRegion[],
    target: RenderTextOverlayTarget,
    targetLanguage: string,
  ): Promise<PsdTextLayerEntry[]> => {
    const sourceImage = await loadImageFromSource(imgData.url);
    const renderWidth = sourceImage.naturalWidth || sourceImage.width || imgData.width;
    const renderHeight = sourceImage.naturalHeight || sourceImage.height || imgData.height;
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const baseRenderRegions = regions.map((item) => applyRenderDefaultsToRegion(item, renderDefaultStyle as any, applyDetectedGradientToStyle, undefined, targetLanguage));
    const renderRegions = target === 'rendered'
      ? [
        ...baseRenderRegions,
        ...buildTranslationNoteOverlayRegions(
          baseRenderRegions,
          imgData.width,
          imgData.height,
          renderDefaultStyle as any,
          translationNotesEnabled,
        ),
      ]
      : baseRenderRegions;
    await Promise.all(
      renderRegions.map(async (region) => {
        const style = cloneRenderStyle(region.renderStyle ?? (renderDefaultStyle as any));
        await ensureCanvasFontLoaded(style, region.renderTextStyleRanges);
      }),
    );

    const scaleX = renderWidth / Math.max(1, imgData.width);
    const scaleY = renderHeight / Math.max(1, imgData.height);
    const entries: PsdTextLayerEntry[] = [];
    for (let index = 0; index < renderRegions.length; index += 1) {
      const region = renderRegions[index]!;
      const text = getRegionTextForOverlayTarget(region, target);
      if (!text) continue;
      const style = cloneRenderStyle(region.renderStyle ?? (renderDefaultStyle as any));
      const [x1, y1, x2, y2] = region.bbox;
      const scaledBbox: [number, number, number, number] = [
        Math.round(x1 * scaleX),
        Math.round(y1 * scaleY),
        Math.round(x2 * scaleX),
        Math.round(y2 * scaleY),
      ];
      const scaledShape = scaleTypographyShapeForBounds(region.shape, region.bbox, scaledBbox);
      const width = Math.max(1, scaledBbox[2] - scaledBbox[0]);
      const height = Math.max(1, scaledBbox[3] - scaledBbox[1]);
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = width;
      layerCanvas.height = height;
      const layerCtx = layerCanvas.getContext('2d');
      if (!layerCtx) continue;
      const layout = computeRenderTextLayout(
        layerCtx,
        text,
        width,
        height,
        style,
        scaledShape,
        region.renderTextStyleRanges,
      );
      drawRenderedTextInRegion(layerCtx, [0, 0, width, height], layout, style, scaledShape);
      const outlineWidth = Math.max(0, style.outlineWidth || 0);
      const drawTopOffset = Math.max(0, (height - layout.textHeight) / 2) + outlineWidth;
      const pointAnchorX = style.alignment === 'center'
        ? (width / 2)
        : (style.alignment === 'right' ? Math.max(0, width - outlineWidth) : outlineWidth);
      const pointAnchorBaselineOffset = drawTopOffset + layout.fontSize;
      const normalizedTarget = target === 'rendered' ? 'rendered' : target;
      const layerName = `${normalizedTarget}_text_${String(index + 1).padStart(3, '0')}`;
      const blob = await canvasToBlob(layerCanvas, 'image/png', 1);
      entries.push({
        fileName: `${layerName}.png`,
        name: layerName,
        kind: target,
        left: scaledBbox[0],
        top: scaledBbox[1],
        width,
        height,
        text: layout.wrappedText || text,
        shape: scaledShape ? cloneTypographyShape(scaledShape) : undefined,
        stylePresetId: region.stylePresetId ?? null,
        style: {
          ...style,
          wrappedText: layout.wrappedText || text,
          computedFontSize: layout.fontSize,
          computedLineHeight: layout.lineHeight,
          computedTextHeight: layout.textHeight,
          drawTopOffset,
          pointAnchorX,
          pointAnchorBaselineOffset,
        },
        blob,
      });
    }

    return entries;
  }, [applyDetectedGradientToStyle, renderDefaultStyle, translationNotesEnabled]);

  return useCallback(async () => {
    const targetImage = activeImage ?? images[0];
    if (!targetImage) {
      setStatusMessage('Select an image to export as PSD.');
      return;
    }

    setDownloadPsdLoading(true);
    try {
      const withMetadata = downloadPsdIncludeMetadataJson;
      const targetAioStageKey = mode === 'aio'
        ? resolveAioStageKeyForImage(targetImage.id)
        : (mode === 'typesetter' ? 'render' : (mode === 'translator' ? 'getTranslations' : null));
      const targetAioBaseItem = mode === 'aio' ? getAioDownloadItemForImage(targetImage.id) : null;
      let sourceBlobForExport: Blob | File = targetAioBaseItem?.blob ?? targetImage.file;
      if (mode === 'aio' && hasAioManualImageEdits(targetImage.id)) {
        const composed = await composeAioEditableCanvas(
          targetImage,
          targetAioBaseItem?.previewUrl ?? targetImage.url,
        );
        sourceBlobForExport = await canvasToBlob(composed, 'image/png', 1);
      }
      if (mode === 'typesetter') {
        const { file: sourceFile, sourceType } = resolveTypographerSourcePayloadForImage(targetImage);
        setTypographerSessionSourceType(targetImage.id, sourceType);
        sourceBlobForExport = sourceFile;
      }
      if (mode === 'translator' && translatorProcessedBaseByImage[targetImage.id]) {
        sourceBlobForExport = await dataUrlToBlob(
          translatorProcessedBaseByImage[targetImage.id]!,
        );
      }
      const sourceFileForExport = sourceBlobForExport instanceof File
        ? sourceBlobForExport
        : new File([sourceBlobForExport], targetImage.file.name, {
          type: sourceBlobForExport.type || targetImage.file.type || 'image/png',
        });
      const formData = new FormData();
      formData.append('file', sourceFileForExport);
      formData.append('language', mode === 'aio' ? aioSrcLang : srcLang);
      formData.append('include_ocr_overlay', String(downloadPsdIncludeOcrOverlay));
      formData.append('include_individual_crops', String(downloadPsdIncludeIndividualCrops));
      formData.append('include_metadata_json', String(withMetadata));
      formData.append('compression', downloadPsdCompression);
      formData.append('text_layer_engine', downloadPsdUsePhotoshopTextLayers ? 'photoshop' : 'raster');
      formData.append('dpi', String(Math.max(72, Math.min(1200, downloadPsdDpi))));

      if (mode === 'aio' || mode === 'typesetter' || mode === 'translator') {
        const targetLanguage = mode === 'translator' ? tgtLang : aioTgtLang;
        const regions = (
          mode === 'translator'
            ? (translatorDetectionsByImage[targetImage.id] ?? [])
            : (aioDetectionsByImage[targetImage.id] ?? [])
        ).map((region) => applyRenderDefaultsToRegion(region, renderDefaultStyle as any, applyDetectedGradientToStyle, undefined, targetLanguage));
        if (regions.length > 0) {
          const textLayerEntries: PsdTextLayerEntry[] = [];
          if (mode === 'aio' && downloadPsdIncludeRawTextLayer) {
            const hasRawText = regions.some((region) => (region.recognizedText ?? '').trim().length > 0);
            if (hasRawText) {
              const rawLayers = await renderAioTextLayersForKind(targetImage, regions, 'raw', targetLanguage);
              textLayerEntries.push(...rawLayers);
            }
          }

          if ((mode === 'aio' || mode === 'translator') && downloadPsdIncludeTranslatedTextLayer) {
            const hasTranslatedText = regions.some((region) => (region.translatedText ?? '').trim().length > 0);
            if (hasTranslatedText) {
              const translatedLayers = await renderAioTextLayersForKind(targetImage, regions, 'translated', targetLanguage);
              textLayerEntries.push(...translatedLayers);
            }
          }

          const hasRenderedText = (mode === 'aio' || mode === 'typesetter') && targetAioStageKey === 'render'
            && regions.some((region) => buildDefaultRegionRenderText(region).length > 0);
          if (hasRenderedText) {
            const renderedLayers = await renderAioTextLayersForKind(targetImage, regions, 'rendered', targetLanguage);
            textLayerEntries.push(...renderedLayers);
          }

          if (textLayerEntries.length > 0) {
            formData.append('text_layers_manifest', JSON.stringify(
              textLayerEntries.map((entry) => ({
                fileName: entry.fileName,
                name: entry.name,
                kind: entry.kind,
                left: entry.left,
                top: entry.top,
                width: entry.width,
                height: entry.height,
                text: entry.text,
                shape: entry.shape,
                stylePresetId: entry.stylePresetId,
                style: entry.style,
              })),
            ));
            textLayerEntries.forEach((entry) => {
              formData.append('text_layer_files', entry.blob, entry.fileName);
            });
          }
        }
      }

      const route = withMetadata ? '/export/psd-with-metadata' : '/export/psd';
      const response = await fetchWithTimeoutAndRetry(
        `${localApiUrl}${route}`,
        { method: 'POST', body: formData },
        { timeoutMs: 180_000, retryCount: 0 },
      );

      if (!response.ok) {
        const message = await parseApiError(response);
        throw new Error(`Failed to export the PSD: ${message}`);
      }

      const blob = await response.blob();
      const sourceStem = removeFileExtension(targetImage.file.name);
      const normalizedStem = sourceStem
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '') || 'image';
      const exportStem = mode === 'translator'
        ? `koma-studio-translator-visual-${normalizedStem}`
        : `koma-studio-aio-render-${normalizedStem}`;
      const fallbackName = withMetadata
        ? `${exportStem}_export.zip`
        : `${exportStem}.psd`;
      const fileName = resolveDownloadFileName(response.headers.get('Content-Disposition'), fallbackName);

      triggerBlobDownload(blob, fileName);
      setDownloadMenuOpen(false);

      if (!withMetadata) {
        const header = response.headers.get('X-KOMA-STUDIO-EXPORT');
        if (header) {
          try {
            const metadata = JSON.parse(header) as { layer_count?: number; group_count?: number };
            const layerCount = typeof metadata.layer_count === 'number' ? metadata.layer_count : null;
            const groupCount = typeof metadata.group_count === 'number' ? metadata.group_count : null;
            if (layerCount !== null && groupCount !== null) {
              setStatusMessage(`PSD ${fileName} exportado (${layerCount} camadas, ${groupCount} grupos).`);
              return;
            }
          } catch {
            /* optional header */
          }
        }
      }

      setStatusMessage(`File ${fileName} exported successfully.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to export the PSD.');
    } finally {
      setDownloadPsdLoading(false);
    }
  }, [
    activeImage,
    aioDetectionsByImage,
    aioSrcLang,
    aioTgtLang,
    applyDetectedGradientToStyle,
    composeAioEditableCanvas,
    downloadPsdCompression,
    downloadPsdDpi,
    downloadPsdIncludeIndividualCrops,
    downloadPsdIncludeMetadataJson,
    downloadPsdIncludeOcrOverlay,
    downloadPsdIncludeRawTextLayer,
    downloadPsdIncludeTranslatedTextLayer,
    downloadPsdUsePhotoshopTextLayers,
    getAioDownloadItemForImage,
    hasAioManualImageEdits,
    images,
    localApiUrl,
    mode,
    parseApiError,
    renderAioTextLayersForKind,
    renderDefaultStyle,
    resolveAioStageKeyForImage,
    resolveTypographerSourcePayloadForImage,
    setDownloadMenuOpen,
    setDownloadPsdLoading,
    setStatusMessage,
    setTypographerSessionSourceType,
    srcLang,
    tgtLang,
    translatorDetectionsByImage,
    translatorProcessedBaseByImage,
    translationNotesEnabled,
    triggerBlobDownload,
  ]);
}

export function useExportDownloadLifecycle() {
  // Unmount revoke (LIFECYCLE). The downloadItems mirror ref effect is gone:
  // the store is the latest value, so the cleanup reads getState() directly.
  useEffect(() => {
    return () => {
      useExportStore.getState().downloadItems.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
    };
  }, []);
}


/* ── Download availability: render-time derivations consumed by the topbar
   download menus and the tour/coachmark hooks (export + ui-shell + translator
   + aio stores; `activeImage` arrives from the image-collection domain) ── */

export function useExportDownloadAvailability({ activeImage }: { activeImage: LoadedImage | null }) {
  const mode = useUiShellStore((s) => s.mode);
  const images = useImageCollectionStore((s) => s.images);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const downloadItems = useExportStore((s) => s.downloadItems);
  const lastActionScope = useExportStore((s) => s.lastActionScope);
  const isProcessableMode =
    !INFO_MODES.includes(mode) &&
    mode !== 'organize' &&
    mode !== 'blogger' &&
    mode !== 'imgur';
  const hasRenderableAioOutput =
    mode === 'aio' && aioSteps.render && images.length > 0;
  const hasRenderableTypographerOutput =
    mode === 'typesetter' && images.length > 0;
  const translatorTextHasDownload = translatorTranslatedText.trim().length > 0;
  const translatorVisualHasDownload = images.some((img) => {
    const regions = translatorDetectionsByImage[img.id] ?? [];
    return regions.some(
      (region) =>
        (region.recognizedText ?? '').trim().length > 0 ||
        (region.translatedText ?? '').trim().length > 0,
    );
  });
  const activeDownloadScope: ProcessableMode | null = isProcessableMode
    ? (mode as ProcessableMode)
    : lastActionScope;
  const canExportAioMetadata = activeDownloadScope === 'aio';
  const activePsdImage = activeImage ?? images[0] ?? null;
  const canExportPsd =
    mode !== 'cleaner' &&
    (mode !== 'translator' || translatorWorkspaceMode === 'visual') &&
    Boolean(activePsdImage);
  const hasAioRenderRegionsForPsd = Boolean(
    activePsdImage &&
    (aioDetectionsByImage[activePsdImage.id] ?? []).length > 0,
  );
  const hasInpaintedOutputs = downloadItems.some(
    (item) => item.scope === 'aio',
  );
  const hasDownloads =
    mode === 'translator'
      ? translatorWorkspaceMode === 'text'
        ? translatorTextHasDownload
        : translatorVisualHasDownload
      : downloadItems.some((item) =>
          isProcessableMode
            ? item.scope === mode
            : lastActionScope
              ? item.scope === lastActionScope
              : false,
        ) ||
        hasRenderableAioOutput ||
        hasRenderableTypographerOutput;
  const hasDownloadActions = hasDownloads || canExportPsd;
  return {
    hasDownloadActions,
    hasDownloads,
    activeDownloadScope,
    canExportAioMetadata,
    hasInpaintedOutputs,
    canExportPsd,
    hasAioRenderRegionsForPsd,
  };
}
