import { useCallback } from 'react';

import { fetchWithTimeoutAndRetry } from '../utils/http';
import {
  applyRenderDefaultsToRegion,
  buildDefaultRegionRenderText,
  buildTranslationNoteOverlayRegions,
  canvasToBlob,
  cloneRenderStyle,
  cloneTypographyShape,
  dataUrlToBlob,
  ensureCanvasFontLoaded,
  getRegionTextForOverlayTarget,
  loadImageFromSource,
  removeFileExtension,
  resolveDownloadFileName,
  scaleTypographyShapeForBounds,
} from '../utils/dashboard.utils';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  PsdTextLayerEntry,
  RenderTextOverlayTarget,
  ToolMode,
} from '../types/dashboard.types';
import {
  computeRenderTextLayout,
  drawRenderedTextInRegion,
} from '../utils/renderText';
import type { TypographySessionSourceType } from '../typography/types';

interface UseDashboardPsdDownloadArgs {
  activeImage: LoadedImage | null;
  images: LoadedImage[];
  mode: ToolMode;
  aioSrcLang: string;
  srcLang: string;
  tgtLang: string;
  aioTgtLang: string;
  localApiUrl: string;
  aioDetectionsByImage: Record<string, AioTextRegion[]>;
  translatorDetectionsByImage: Record<string, AioTextRegion[]>;
  translatorProcessedBaseByImage: Record<string, string>;
  downloadPsdCompression: string;
  downloadPsdDpi: number;
  downloadPsdIncludeIndividualCrops: boolean;
  downloadPsdIncludeMetadataJson: boolean;
  downloadPsdIncludeOcrOverlay: boolean;
  downloadPsdIncludeRawTextLayer: boolean;
  downloadPsdIncludeTranslatedTextLayer: boolean;
  downloadPsdUsePhotoshopTextLayers: boolean;
  renderDefaultStyle: unknown;
  setDownloadPsdLoading: (value: boolean) => void;
  setDownloadMenuOpen: (value: boolean) => void;
  setStatusMessage: (value: string) => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  parseApiError: (response: Response) => Promise<string>;
  resolveAioStageKeyForImage: (imageId: string) => AioPipelineSnapshotKey;
  getAioDownloadItemForImage: (imageId: string) => { blob: Blob; previewUrl?: string | null } | null;
  hasAioManualImageEdits: (imageId: string) => boolean;
  composeAioEditableCanvas: (img: LoadedImage, fallbackBaseSource?: string) => Promise<HTMLCanvasElement>;
  setTypographerSessionSourceType: (imageId: string, sourceType: TypographySessionSourceType) => void;
  translationNotesEnabled: boolean;
  applyDetectedGradientToStyle: (...args: any[]) => any;
}

export function useDashboardPsdDownload({
  activeImage,
  images,
  mode,
  aioSrcLang,
  srcLang,
  tgtLang,
  aioTgtLang,
  localApiUrl,
  aioDetectionsByImage,
  translatorDetectionsByImage,
  translatorProcessedBaseByImage,
  downloadPsdCompression,
  downloadPsdDpi,
  downloadPsdIncludeIndividualCrops,
  downloadPsdIncludeMetadataJson,
  downloadPsdIncludeOcrOverlay,
  downloadPsdIncludeRawTextLayer,
  downloadPsdIncludeTranslatedTextLayer,
  downloadPsdUsePhotoshopTextLayers,
  renderDefaultStyle,
  setDownloadPsdLoading,
  setDownloadMenuOpen,
  setStatusMessage,
  triggerBlobDownload,
  parseApiError,
  resolveAioStageKeyForImage,
  getAioDownloadItemForImage,
  hasAioManualImageEdits,
  composeAioEditableCanvas,
  setTypographerSessionSourceType,
  translationNotesEnabled,
  applyDetectedGradientToStyle,
}: UseDashboardPsdDownloadArgs) {
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
