import { memo } from "react";
import { cn } from "../../lib/utils";
import type { LoadedImage } from "../../types/dashboard.types";
import { useUiShellStore } from "@/pages/dashboard/stores/ui-shell-store";

interface PreviewStageItemProps {
  img: LoadedImage;
  index: number;
  viewMode: "long_strip" | "paginated";
  resolvedActiveId: string | null;
  onSelect: (id: string) => void;
  getPreviewSrc: (img: LoadedImage) => string;
}

export const PreviewStageItem = memo(function PreviewStageItem({
  img,
  index,
  viewMode,
  resolvedActiveId,
  onSelect,
  getPreviewSrc,
}: PreviewStageItemProps) {
  // Zoom is a high-frequency store value: the preview leaf subscribes itself,
  // so a Ctrl+wheel gesture re-renders this card without the stage section.
  const zoom = useUiShellStore((s) => s.zoom);
  const baseMaxWidth = viewMode === "paginated" ? 420 : 960;
  const isSwapped = img.rotation === 90 || img.rotation === 270;
  const scaleFactor = isSwapped
    ? img.height > baseMaxWidth
      ? baseMaxWidth / img.height
      : 1
    : img.width > baseMaxWidth
      ? baseMaxWidth / img.width
      : 1;
  const imgElemW = img.width * scaleFactor;
  const imgElemH = img.height * scaleFactor;
  const wrapW = isSwapped ? imgElemH : imgElemW;
  const wrapH = isSwapped ? imgElemW : imgElemH;

  return (
    <div
      key={img.id}
      onClick={() => onSelect(img.id)}
      className={cn(
        "koma-preview-card",
        resolvedActiveId === img.id && "koma-preview-card--active",
      )}
      style={{ zoom }}
    >
      <div className="koma-preview-card__label">
        #{index + 1} — {img.file.name}
      </div>
      <div
        className="koma-preview-card__rotateWrap"
        style={{ width: wrapW, height: wrapH }}
      >
        <img
          src={getPreviewSrc(img)}
          loading="lazy"
          decoding="async"
          className="koma-preview-card__img"
          style={{
            width: imgElemW,
            height: imgElemH,
            position: "absolute",
            left: (wrapW - imgElemW) / 2,
            top: (wrapH - imgElemH) / 2,
            transform: img.rotation ? `rotate(${img.rotation}deg)` : undefined,
          }}
          alt={img.file.name}
        />
      </div>
    </div>
  );
});
