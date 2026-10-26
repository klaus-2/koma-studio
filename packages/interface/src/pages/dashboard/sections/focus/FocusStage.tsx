import { Suspense, lazy, memo, useMemo, type WheelEvent } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

import DashboardLazyFallback from '../../../../components/dashboard/DashboardLazyFallback';
import {
  AIO_STAGE_BADGE_LABELS,
  EMPTY_AIO_MANUAL_EDIT_STATE,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '../../../../constants/dashboard.constants';
import { useI18n } from '../../../../i18n';
import type {
  AioTextRegion,
  LoadedImage,
} from '../../../../types/dashboard.types';
import { clamp } from '../../../../utils/dashboard.utils';
import { memoLoad } from '../../../../utils/lazyModule';
import { listTextFillSwatches } from '../../../../utils/textFillPicker';
import { useManualToolsStore } from '../../stores/manual-tools-store';
import { useRegionEditorStore } from '../../stores/region-editor-store';
import { useUiShellStore } from '../../stores/ui-shell-store';

const loadRenderTextPreview = memoLoad(
  () => import('../../../../components/dashboard/RenderTextPreview'),
);
const RenderTextPreview = lazy(loadRenderTextPreview);

const noop = (): void => undefined;
const noopAsync = async (): Promise<void> => undefined;

interface FocusStageProps {
  image: LoadedImage;
  imageIndex: number;
  totalImages: number;
  /** Active page already went through the AIO run (render stage). */
  processed: boolean;
  previewSrc: string;
  regions: AioTextRegion[];
  selectedRegionId: string | null;
  editable: boolean;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    nextRegions: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  onRequestRefineRegion: () => void;
  renderFontRefreshToken: number;
  availableRenderFonts: string[];
  isCompactViewport: boolean;
  translationNotesEnabled: boolean;
  canPrevPage: boolean;
  canNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onWheelZoom: (event: WheelEvent<HTMLElement>) => void;
}

/**
 * Single-page canvas for Focus: the existing RenderTextPreview in its
 * quietest configuration — select / move / resize / inline-edit only.
 * Manual paint, wand, segment brushes and snapshot time-travel stay in
 * Studio; existing manual layers still render (read from the store) so
 * nothing the user did there is hidden or lost.
 */
export default memo(function FocusStage({
  image,
  imageIndex,
  totalImages,
  processed,
  previewSrc,
  regions,
  selectedRegionId,
  editable,
  onSelectRegion,
  onRegionsChange,
  onRequestRefineRegion,
  renderFontRefreshToken,
  availableRenderFonts,
  isCompactViewport,
  translationNotesEnabled,
  canPrevPage,
  canNextPage,
  onPrevPage,
  onNextPage,
  onWheelZoom,
}: FocusStageProps) {
  const { t } = useI18n();
  const zoom = useUiShellStore((s) => s.zoom);
  const setZoom = useUiShellStore((s) => s.setZoom);
  const inlineEditorShortcutRequestKey = useUiShellStore(
    (s) => s.inlineEditorShortcutRequestKey,
  );
  const renderDefaultStyle = useRegionEditorStore((s) => s.renderDefaultStyle);
  const textFillSwatchState = useRegionEditorStore((s) => s.textFillSwatchState);
  const textFillSwatches = useMemo(
    () => listTextFillSwatches(textFillSwatchState),
    [textFillSwatchState],
  );
  const manualPaintColor = useManualToolsStore((s) => s.manualImagePaintColor);
  const manualBrushSize = useManualToolsStore((s) => s.manualImageBrushSize);
  const manualBrushOpacity = useManualToolsStore(
    (s) => s.manualImageBrushOpacity,
  );
  const manualBrushBlur = useManualToolsStore((s) => s.manualImageBrushBlur);
  const manualEdits = useManualToolsStore(
    (s) => s.aioManualImageEditsByImage[image.id],
  );

  const zoomPercent = Math.round(zoom * 100);

  return (
    <section className="koma-focus__stage" aria-label={image.file.name}>
      <div
        className="koma-focus__stage-scroll custom-scrollbar"
        onWheel={onWheelZoom}
      >
        <Suspense fallback={<DashboardLazyFallback />}>
          <RenderTextPreview
            label={`#${imageIndex + 1} — ${image.file.name}`}
            image={image}
            previewSrc={previewSrc}
            zoom={zoom}
            viewMode="long_strip"
            active
            regions={regions}
            selectedRegionId={selectedRegionId}
            onCardSelect={noop}
            onSelectRegion={onSelectRegion}
            onRegionsChange={onRegionsChange}
            editable={editable}
            areaSelectionEnabled={false}
            allowRegionCreation={false}
            newRegionShapeKind="rounded"
            fallbackStyle={renderDefaultStyle}
            fontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            stageBadgeKey="render"
            stageBadgeLabel={AIO_STAGE_BADGE_LABELS.render}
            canRewind={false}
            canForward={false}
            onRewind={noop}
            onForward={noop}
            historyHint={null}
            renderStageActive={processed}
            onRequestRefineRegion={onRequestRefineRegion}
            manualEditEnabled={false}
            enableManualImageTools={false}
            manualImageTool="none"
            manualPaintColor={manualPaintColor}
            manualBrushSize={manualBrushSize}
            manualBrushOpacity={manualBrushOpacity}
            manualBrushBlur={manualBrushBlur}
            manualPaintLayerDataUrl={
              manualEdits?.paintLayerDataUrl ??
              EMPTY_AIO_MANUAL_EDIT_STATE.paintLayerDataUrl
            }
            manualWandMaskDataUrl={
              manualEdits?.wandMaskDataUrl ??
              EMPTY_AIO_MANUAL_EDIT_STATE.wandMaskDataUrl
            }
            manualHealingPending={false}
            textFillSwatches={textFillSwatches}
            onManualPaintLayerChange={noop}
            onManualWandMaskChange={noop}
            onManualWandRequest={noopAsync}
            onManualHealingMaskCommit={noopAsync}
            translationNotesEnabled={translationNotesEnabled}
            inlineEditorRequestKey={inlineEditorShortcutRequestKey}
          />
        </Suspense>
      </div>

      <div className="koma-focus__page-nav">
        <button
          type="button"
          className="koma-focus__icon-btn"
          onClick={onPrevPage}
          disabled={!canPrevPage}
          aria-label={t('focus.stage.prev')}
        >
          <ChevronLeft size={15} />
        </button>
        <span>
          {t('focus.stage.pageOf', {
            current: imageIndex + 1,
            total: totalImages,
          })}
        </span>
        <button
          type="button"
          className="koma-focus__icon-btn"
          onClick={onNextPage}
          disabled={!canNextPage}
          aria-label={t('focus.stage.next')}
        >
          <ChevronRight size={15} />
        </button>
        <span className="koma-focus__page-nav-sep" aria-hidden="true" />
        <button
          type="button"
          className="koma-focus__icon-btn"
          onClick={() =>
            setZoom((prev) => clamp(prev - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
          }
          aria-label={t('focus.stage.zoomOut')}
        >
          <ZoomOut size={14} />
        </button>
        <span className="koma-focus__zoom-label">
          {t('focus.stage.zoomLabel', { percent: zoomPercent })}
        </span>
        <button
          type="button"
          className="koma-focus__icon-btn"
          onClick={() =>
            setZoom((prev) => clamp(prev + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
          }
          aria-label={t('focus.stage.zoomIn')}
        >
          <ZoomIn size={14} />
        </button>
      </div>
    </section>
  );
});
