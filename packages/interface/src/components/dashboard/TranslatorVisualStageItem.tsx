import { useI18n } from "../../i18n";
import { EMPTY_REGIONS } from "../../utils/dashboardRenderUtils";
import type { LoadedImage } from "../../types/dashboard.types";
import TextDetectionPreview from "./TextDetectionPreview";

interface TranslatorVisualRunMeta {
  detected: boolean;
  ocr: boolean;
  translated: boolean;
}

interface TranslatorVisualStageItemProps {
  img: LoadedImage;
  index: number;
  translatorRunMetaByImage: Record<string, TranslatorVisualRunMeta | undefined>;
  translatorDetectionsByImage: Record<string, any[]>;
  translatorSelectedRegionByImage: Record<string, string | null>;
  resolvedActiveId: string | null;
  resolvedAioAreaSelectionShapeKind: "square" | "rounded";
  segmentBrushSize: number;
  translationNotesEnabled: boolean;
  viewMode: "long_strip" | "paginated";
  zoom: number;
  getPreviewSrc: (img: LoadedImage) => string;
  onSelect: (id: string) => void;
  onSelectRegion: (imageId: string, regionId: string | null) => void;
  onRegionsChange: (
    imageId: string,
    nextRegions: any[],
    selectedRegionIdOverride?: string | null,
  ) => void;
}

export function TranslatorVisualStageItem({
  img,
  index,
  translatorRunMetaByImage,
  translatorDetectionsByImage,
  translatorSelectedRegionByImage,
  resolvedActiveId,
  resolvedAioAreaSelectionShapeKind,
  segmentBrushSize,
  translationNotesEnabled,
  viewMode,
  zoom,
  getPreviewSrc,
  onSelect,
  onSelectRegion,
  onRegionsChange,
}: TranslatorVisualStageItemProps) {
  const { t } = useI18n();
  const translatorMeta = translatorRunMetaByImage[img.id];
  const translatorStageKey = translatorMeta?.translated
    ? "getTranslations"
    : translatorMeta?.ocr
      ? "recognizeText"
      : "detectText";
  const translatorStageLabel = translatorMeta?.translated
    ? "TRANSLATE"
    : translatorMeta?.ocr
      ? "OCR"
      : "DETECT";
  const translatorHint = translatorMeta
    ? t("dashboard.status.translatorMeta", {
        detected: translatorMeta.detected
          ? t("dashboard.status.metaOk")
          : t("dashboard.status.metaPending"),
        ocr: translatorMeta.ocr
          ? t("dashboard.status.metaOk")
          : t("dashboard.status.metaPending"),
        translated: translatorMeta.translated
          ? t("dashboard.status.metaOk")
          : t("dashboard.status.metaPending"),
      })
    : t("dashboard.status.translatorRunFirst");

  return (
    <TextDetectionPreview
      key={`${img.id}-translator-visual`}
      label={`#${index + 1} — ${img.file.name}`}
      image={img as any}
      previewSrc={getPreviewSrc(img)}
      zoom={zoom}
      viewMode={viewMode}
      active={resolvedActiveId === img.id}
      regions={translatorDetectionsByImage[img.id] ?? EMPTY_REGIONS}
      selectedRegionId={translatorSelectedRegionByImage[img.id] ?? null}
      onCardSelect={() => onSelect(img.id)}
      onSelectRegion={(regionId) => onSelectRegion(img.id, regionId ?? null)}
      onRegionsChange={(nextRegions: any[], selectedRegionIdOverride?: string | null) =>
        onRegionsChange(img.id, nextRegions, selectedRegionIdOverride)
      }
      editable
      selectionEnabled
      creationEnabled={false}
      newRegionShapeKind={resolvedAioAreaSelectionShapeKind}
      segmentEditEnabled={false}
      segmentEditTool="select"
      segmentBrushSize={segmentBrushSize}
      stageBadgeKey={translatorStageKey}
      stageBadgeLabel={translatorStageLabel}
      canRewind={false}
      canForward={false}
      onRewind={() => undefined}
      onForward={() => undefined}
      historyHint={translatorHint}
      translationNotesEnabled={translationNotesEnabled}
    />
  );
}
