import { useI18n } from "../../i18n";
import { EMPTY_REGIONS } from "../../utils/dashboardRenderUtils";
import type { RenderTextStyle } from "../../utils/renderText";
import type {
  AioTextRegion,
  LoadedImage,
  ManualImageEditTool,
  SegmentEditTool,
} from "../../types/dashboard.types";
import RenderTextPreview from "./RenderTextPreview";

interface CleanerRunMeta {
  ocrCount: number;
  segmentedCount: number;
  cleaned: boolean;
}

interface ManualImageEditState {
  paintLayerDataUrl: string | null;
  wandMaskDataUrl: string | null;
}

interface CleanerStageItemProps {
  img: LoadedImage;
  index: number;
  cleanerRunMetaByImage: Record<string, CleanerRunMeta | undefined>;
  cleanerDetectionsByImage: Record<string, any[]>;
  cleanerSelectedRegionByImage: Record<string, string | null>;
  cleanerHealingBusyByImage: Record<string, boolean>;
  cleanerShowOverlays: boolean;
  getCleanerManualImageEditState: (imageId: string) => ManualImageEditState;
  getPreviewSrc: (img: LoadedImage) => string;
  resolvedActiveId: string | null;
  resolvedAioAreaSelectionShapeKind: "square" | "rounded";
  renderDefaultStyle: RenderTextStyle;
  renderFontRefreshToken: number;
  availableRenderFonts: any[];
  isCompactViewport: boolean;
  manualImageBrushOpacity: number;
  manualImageBrushBlur: number;
  manualImageBrushSize: number;
  manualImagePaintColor: string;
  manualImageTool: ManualImageEditTool;
  segmentEditTool: SegmentEditTool | undefined;
  segmentBrushSize: number;
  inlineEditorShortcutRequestKey: string | null;
  textFillSwatches: any[];
  viewMode: "long_strip" | "paginated";
  zoom: number;
  onSelect: (id: string) => void;
  onSelectRegion: (imageId: string, regionId: string | null) => void;
  onRegionsChange: (
    imageId: string,
    nextRegions: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  onManualPaintLayerChange: (imageId: string, nextLayer: string | null) => void;
  onManualWandMaskChange: (imageId: string, nextMask: string | null) => void;
  onManualWandRequest: (imageId: string, x: number, y: number) => Promise<void>;
  onManualHealingMaskCommit: (imageId: string, maskDataUrl: string) => Promise<void>;
}

export function CleanerStageItem({
  img,
  index,
  cleanerRunMetaByImage,
  cleanerDetectionsByImage,
  cleanerSelectedRegionByImage,
  cleanerHealingBusyByImage,
  cleanerShowOverlays,
  getCleanerManualImageEditState,
  getPreviewSrc,
  resolvedActiveId,
  resolvedAioAreaSelectionShapeKind,
  renderDefaultStyle,
  renderFontRefreshToken,
  availableRenderFonts,
  isCompactViewport,
  manualImageBrushOpacity,
  manualImageBrushBlur,
  manualImageBrushSize,
  manualImagePaintColor,
  manualImageTool,
  segmentEditTool,
  segmentBrushSize,
  inlineEditorShortcutRequestKey,
  textFillSwatches,
  viewMode,
  zoom,
  onSelect,
  onSelectRegion,
  onRegionsChange,
  onManualPaintLayerChange,
  onManualWandMaskChange,
  onManualWandRequest,
  onManualHealingMaskCommit,
}: CleanerStageItemProps) {
  const { t } = useI18n();
  const cleanerMeta = cleanerRunMetaByImage[img.id] ?? null;
  const cleanerHint = cleanerMeta
    ? t("dashboard.status.cleanerMeta", {
        ocrCount: cleanerMeta.ocrCount,
        segmentedCount: cleanerMeta.segmentedCount,
        cleaned: cleanerMeta.cleaned
          ? t("dashboard.status.metaOk")
          : t("dashboard.status.metaPending"),
      })
    : t("dashboard.status.cleanerRunFirst");

  return (
    <RenderTextPreview
      key={`${img.id}-cleaner`}
      label={`#${index + 1} — ${img.file.name}`}
      image={img as any}
      previewSrc={getPreviewSrc(img)}
      zoom={zoom}
      viewMode={viewMode}
      active={resolvedActiveId === img.id}
      regions={cleanerDetectionsByImage[img.id] ?? EMPTY_REGIONS}
      selectedRegionId={cleanerSelectedRegionByImage[img.id] ?? null}
      onCardSelect={() => onSelect(img.id)}
      onSelectRegion={(regionId: string | null) => {
        onSelect(img.id);
        onSelectRegion(img.id, regionId);
      }}
      onRegionsChange={(nextRegions: AioTextRegion[], selectedRegionIdOverride?: string | null) =>
        onRegionsChange(img.id, nextRegions, selectedRegionIdOverride)
      }
      editable
      areaSelectionEnabled
      allowRegionCreation={false}
      newRegionShapeKind={resolvedAioAreaSelectionShapeKind}
      fallbackStyle={renderDefaultStyle}
      fontRefreshToken={renderFontRefreshToken}
      availableRenderFonts={availableRenderFonts}
      isCompactViewport={isCompactViewport}
      stageBadgeKey="cleanImage"
      stageBadgeLabel="CLEAN"
      canRewind={false}
      canForward={false}
      onRewind={() => undefined}
      onForward={() => undefined}
      historyHint={cleanerHint}
      renderStageActive={false}
      manualEditEnabled
      enableManualImageTools
      manualBrushOpacity={manualImageBrushOpacity}
      manualBrushBlur={manualImageBrushBlur}
      manualImageTool={manualImageTool}
      manualPaintColor={manualImagePaintColor}
      manualBrushSize={manualImageBrushSize}
      manualPaintLayerDataUrl={
        getCleanerManualImageEditState(img.id).paintLayerDataUrl
      }
      manualWandMaskDataUrl={
        getCleanerManualImageEditState(img.id).wandMaskDataUrl
      }
      manualHealingPending={Boolean(cleanerHealingBusyByImage[img.id])}
      textFillSwatches={textFillSwatches}
      segmentEditEnabled
      segmentEditTool={segmentEditTool}
      segmentBrushSize={segmentBrushSize}
      inlineEditorRequestKey={inlineEditorShortcutRequestKey}
      onManualPaintLayerChange={(nextLayer: string | null) => {
        onManualPaintLayerChange(img.id, nextLayer);
      }}
      onManualWandMaskChange={(nextMask: string | null) => {
        onManualWandMaskChange(img.id, nextMask);
      }}
      onManualWandRequest={async (x: number, y: number) => {
        await onManualWandRequest(img.id, x, y);
      }}
      onManualHealingMaskCommit={async (maskDataUrl: string) => {
        await onManualHealingMaskCommit(img.id, maskDataUrl);
      }}
      translationNotesEnabled={false}
      showRegionOverlays={cleanerShowOverlays}
    />
  );
}
