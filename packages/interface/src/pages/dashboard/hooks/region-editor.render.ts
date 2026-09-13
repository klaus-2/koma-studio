/**
 * AIO region derived state — the active-region memos for the active image
 * (region/style/mode/preset resolution for the panels) and the export
 * render-to-blob compositing of the edited canvas with its regions. Split out
 * of region-editor.ts (T10); the entry file keeps the region editing hook and
 * re-exports this module.
 */
import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  buildDefaultRegionRenderText,
  buildTranslationNoteOverlayRegions,
  canvasToBlob,
  cloneRenderStyle,
  ensureCanvasFontLoaded,
  getRegionTranslationNotesForDisplay,
  scaleTypographyShapeForBounds,
} from '../../../utils/dashboard.utils';
import {
  resolveRenderTextMode,
  type RenderTextMode,
} from '../../../utils/renderModes';
import { listTextFillSwatches } from '../../../utils/textFillPicker';
import {
  computeRenderTextLayout,
  drawRenderedTextInRegion,
} from '../../../utils/renderText';
import { resolveTypographyPresetForMode } from '../../../typography/presets';
import type {
  AioTextRegion,
  DownloadItem,
  LoadedImage,
} from '../../../types/dashboard.types';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';

interface AioManualImageEditComposer {
  (
    imgData: LoadedImage,
    fallbackBaseSource?: string,
    options?: { includePaintLayer?: boolean },
  ): Promise<HTMLCanvasElement>;
}

/* ── Export rendering: composites the edited canvas and draws the regions ── */

interface UseAioRegionRenderToBlobArgs {
  /* Page callbacks / export-download state (T10) */
  composeAioEditableCanvas: AioManualImageEditComposer;
  downloadItems: DownloadItem[];
  outFormat: string;
  outQuality: number;
}

export function useAioRegionRenderToBlob({
  composeAioEditableCanvas,
  downloadItems,
  outFormat,
  outQuality,
}: UseAioRegionRenderToBlobArgs) {
  const { t } = useI18n();
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);

  const renderAioImageToBlob = useCallback(
    async (imgData: LoadedImage, regions: AioTextRegion[]): Promise<Blob> => {
      const baseItem = downloadItems.find(
        (item) => item.scope === 'aio' && item.sourceImageId === imgData.id,
      );
      const canvas = await composeAioEditableCanvas(
        imgData,
        baseItem?.previewUrl ?? imgData.url,
      );
      const renderWidth = canvas.width;
      const renderHeight = canvas.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('dashboard.status.renderCanvasInitFailed'));
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const baseRenderRegions = regions.map((item) =>
        applyRenderDefaultsToRegion(
          item,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
          undefined,
          aioTgtLang,
        ),
      );
      const renderRegions = [
        ...baseRenderRegions,
        ...buildTranslationNoteOverlayRegions(
          baseRenderRegions,
          imgData.width,
          imgData.height,
          renderDefaultStyle,
          llmSettings.translation_notes_enabled,
        ),
      ];
      await Promise.all(
        renderRegions.map(async (region) => {
          const style = cloneRenderStyle(
            region.renderStyle ?? renderDefaultStyle,
          );
          await ensureCanvasFontLoaded(style, region.renderTextStyleRanges);
        }),
      );

      const scaleX = renderWidth / Math.max(1, imgData.width);
      const scaleY = renderHeight / Math.max(1, imgData.height);
      for (const region of renderRegions) {
        const text = buildDefaultRegionRenderText(region);
        if (!text.trim()) continue;
        const style = cloneRenderStyle(
          region.renderStyle ?? renderDefaultStyle,
        );
        const [x1, y1, x2, y2] = region.bbox;
        const scaledBbox: [number, number, number, number] = [
          Math.round(x1 * scaleX),
          Math.round(y1 * scaleY),
          Math.round(x2 * scaleX),
          Math.round(y2 * scaleY),
        ];
        const scaledShape = scaleTypographyShapeForBounds(
          region.shape,
          region.bbox,
          scaledBbox,
        );
        const width = Math.max(1, scaledBbox[2] - scaledBbox[0]);
        const height = Math.max(1, scaledBbox[3] - scaledBbox[1]);
        const layout = computeRenderTextLayout(
          ctx,
          text,
          width,
          height,
          style,
          scaledShape,
          region.renderTextStyleRanges,
        );
        drawRenderedTextInRegion(ctx, scaledBbox, layout, style, scaledShape);
      }

      return canvasToBlob(canvas, outFormat, outQuality);
    },
    [
      aioTgtLang,
      composeAioEditableCanvas,
      downloadItems,
      llmSettings.translation_notes_enabled,
      outFormat,
      outQuality,
      renderDefaultStyle,
    ],
  );

  return { renderAioImageToBlob };
}

/* ── Active region state: memos derived from the region-editor stores for the
   active image (page consumers: region editing hooks + stage/layout views) ── */

export function useActiveAioRegionState({ resolvedActiveId }: { resolvedActiveId: string | null }) {
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const typographyPresetState = useRegionEditorStore(
    (s) => s.typographyPresetState,
  );
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const textFillSwatchState = useRegionEditorStore(
    (s) => s.textFillSwatchState,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const textFillSwatches = useMemo(
    () => listTextFillSwatches(textFillSwatchState),
    [textFillSwatchState],
  );
  const typographyPresetList = useMemo(
    () =>
      [...typographyPresetState.presets].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [typographyPresetState.presets],
  );
  const typographyFolderList = useMemo(
    () => [...typographyPresetState.folders].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'pt-BR')),
    [typographyPresetState.folders],
  );
  const defaultBubbleTypographyPreset = useMemo(
    () => resolveTypographyPresetForMode('text_bubble', typographyPresetState),
    [typographyPresetState],
  );
  const activeImageDetections = useMemo(
    () =>
      resolvedActiveId ? (aioDetectionsByImage[resolvedActiveId] ?? []) : [],
    [aioDetectionsByImage, resolvedActiveId],
  );
  const activeSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (aioSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [aioSelectedRegionByImage, resolvedActiveId],
  );
  const activeSelectedRegion = useMemo(
    () =>
      activeImageDetections.find(
        (region) => region.id === activeSelectedRegionId,
      ) ?? null,
    [activeImageDetections, activeSelectedRegionId],
  );
  const activeSelectedRenderStyle = useMemo(
    () =>
      cloneRenderStyle(activeSelectedRegion?.renderStyle ?? renderDefaultStyle),
    [activeSelectedRegion?.renderStyle, renderDefaultStyle],
  );
  const activeSelectedRenderMode = useMemo<RenderTextMode>(
    () => activeSelectedRegion?.renderMode ?? 'auto',
    [activeSelectedRegion?.renderMode],
  );
  const activeSelectedDetectedRenderMode = useMemo(
    () => activeSelectedRegion?.detectedRenderMode ?? 'text_bubble',
    [activeSelectedRegion?.detectedRenderMode],
  );
  const activeSelectedResolvedRenderMode = useMemo(
    () =>
      resolveRenderTextMode({
        renderMode: activeSelectedRenderMode,
        detectedRenderMode: activeSelectedDetectedRenderMode,
      }),
    [activeSelectedDetectedRenderMode, activeSelectedRenderMode],
  );
  const activeSelectedTranslationNotes = useMemo(
    () =>
      activeSelectedRegion
        ? getRegionTranslationNotesForDisplay(
            activeSelectedRegion,
            llmSettings.translation_notes_enabled,
          )
        : [],
    [activeSelectedRegion, llmSettings.translation_notes_enabled],
  );

  return {
    textFillSwatches,
    typographyPresetList,
    typographyFolderList,
    defaultBubbleTypographyPreset,
    activeImageDetections,
    activeSelectedRegionId,
    activeSelectedRegion,
    activeSelectedRenderStyle,
    activeSelectedRenderMode,
    activeSelectedDetectedRenderMode,
    activeSelectedResolvedRenderMode,
    activeSelectedTranslationNotes,
  };
}
