import { useI18n } from "../../i18n";
import { EMPTY_REGIONS, EMPTY_SELECTED_REGION_IDS } from "../../utils/dashboardRenderUtils";
import type { RenderTextStyle } from "../../utils/renderText";
import type { AioTextRegion, LoadedImage } from "../../types/dashboard.types";
import RenderTextPreview from "./RenderTextPreview";

interface TypesetterStageItemProps {
  img: LoadedImage;
  index: number;
  getAioDownloadItemForImage: (imageId: string) => { previewUrl?: string } | undefined;
  getPreviewSrc: (img: LoadedImage) => string;
  aioDetectionsByImage: Record<string, any[]>;
  aioSelectedRegionByImage: Record<string, string | null>;
  resolvedActiveId: string | null;
  subMode: "auto" | "manual";
  typographerSelectionTool: string;
  renderDefaultStyle: RenderTextStyle;
  renderFontRefreshToken: number;
  availableRenderFonts: any[];
  isCompactViewport: boolean;
  inlineEditorShortcutRequestKey: string | null;
  textFillSwatches: any[];
  translationNotesEnabled: boolean;
  typographerMultiSelectedByImage: Record<string, string[]>;
  typographyPresetList: any[];
  viewMode: "long_strip" | "paginated";
  zoom: number;
  onSelect: (id: string) => void;
  onSelectRegion: (imageId: string, regionId: string | null) => void;
  onSetTypographerSelectedRegionId: (imageId: string, regionId: string | null) => void;
  onClearTypographerMultiSelect: (imageId: string) => void;
  onRegionsChange: (
    imageId: string,
    nextRegions: any[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  onRefineActiveShape: () => void;
  onAutoShapeActiveRegion: () => void;
  onApplyPresetToRegion: (imageId: string, regionId: string, presetId: string) => void;
  onConvertRegionShape: (imageId: string, regionId: string, kind: "auto" | "square" | "rounded") => void;
  onMultiSelectToggle: (imageId: string, regionId: string) => void;
}

export function TypesetterStageItem({
  img,
  index,
  getAioDownloadItemForImage,
  getPreviewSrc,
  aioDetectionsByImage,
  aioSelectedRegionByImage,
  resolvedActiveId,
  subMode,
  typographerSelectionTool,
  renderDefaultStyle,
  renderFontRefreshToken,
  availableRenderFonts,
  isCompactViewport,
  inlineEditorShortcutRequestKey,
  textFillSwatches,
  translationNotesEnabled,
  typographerMultiSelectedByImage,
  typographyPresetList,
  viewMode,
  zoom,
  onSelect,
  onSelectRegion,
  onSetTypographerSelectedRegionId,
  onClearTypographerMultiSelect,
  onRegionsChange,
  onRefineActiveShape,
  onAutoShapeActiveRegion,
  onApplyPresetToRegion,
  onConvertRegionShape,
  onMultiSelectToggle,
}: TypesetterStageItemProps) {
  const { t } = useI18n();
  const typesetterBaseItem = getAioDownloadItemForImage(img.id);
  const typesetterPreviewSrc = typesetterBaseItem?.previewUrl ?? getPreviewSrc(img);

  return (
    <RenderTextPreview
      key={`${img.id}-typesetter`}
      label={`#${index + 1} — ${img.file.name}`}
      image={img as any}
      previewSrc={typesetterPreviewSrc}
      zoom={zoom}
      viewMode={viewMode}
      active={resolvedActiveId === img.id}
      regions={aioDetectionsByImage[img.id] ?? EMPTY_REGIONS}
      selectedRegionId={aioSelectedRegionByImage[img.id] ?? null}
      onCardSelect={() => onSelect(img.id)}
      onSelectRegion={(regionId: string | null) => {
        onSelectRegion(img.id, regionId);
        onSetTypographerSelectedRegionId(img.id, regionId);
        if (typographerMultiSelectedByImage[img.id]?.length) {
          onClearTypographerMultiSelect(img.id);
        }
      }}
      onRegionsChange={(nextRegions: AioTextRegion[], selectedRegionIdOverride?: string | null) =>
        onRegionsChange(img.id, nextRegions, selectedRegionIdOverride)
      }
      editable={subMode === "manual"}
      areaSelectionEnabled={
        subMode === "manual" &&
        (typographerSelectionTool === "draw-square" ||
          typographerSelectionTool === "draw-rounded" ||
          typographerSelectionTool === "select")
      }
      newRegionShapeKind={
        typographerSelectionTool === "draw-square" ? "square" : "rounded"
      }
      fallbackStyle={renderDefaultStyle}
      fontRefreshToken={renderFontRefreshToken}
      availableRenderFonts={availableRenderFonts}
      isCompactViewport={isCompactViewport}
      stageBadgeKey="render"
      stageBadgeLabel="TYPE"
      canRewind={false}
      canForward={false}
      onRewind={() => undefined}
      onForward={() => undefined}
      historyHint={t("dashboard.status.typographerSession")}
      renderStageActive
      onRequestRefineRegion={() => void onRefineActiveShape()}
      onRequestAutoShapeRegion={onAutoShapeActiveRegion}
      availableTypographyPresets={typographyPresetList}
      onRequestApplyPresetById={(regionId: string, presetId: string) =>
        onApplyPresetToRegion(img.id, regionId, presetId)
      }
      onRequestConvertShapeRegion={(regionId: string, kind: "auto" | "square" | "rounded") => {
        if (kind === "auto") {
          onAutoShapeActiveRegion();
          return;
        }
        onConvertRegionShape(img.id, regionId, kind);
      }}
      manualEditEnabled={false}
      manualImageTool="none"
      manualPaintColor="#ffffff"
      manualBrushSize={24}
      manualBrushOpacity={1}
      manualBrushBlur={0}
      manualPaintLayerDataUrl={null}
      manualWandMaskDataUrl={null}
      manualHealingPending={false}
      textFillSwatches={textFillSwatches}
      inlineEditorRequestKey={inlineEditorShortcutRequestKey}
      onManualPaintLayerChange={() => undefined}
      onManualWandMaskChange={() => undefined}
      onManualWandRequest={async () => undefined}
      onManualHealingMaskCommit={async () => undefined}
      translationNotesEnabled={translationNotesEnabled}
      multiSelectedRegionIds={
        typographerMultiSelectedByImage[img.id] ?? EMPTY_SELECTED_REGION_IDS
      }
      onMultiSelectToggle={(regionId: string) => {
        onSelect(img.id);
        onMultiSelectToggle(img.id, regionId);
      }}
    />
  );
}
