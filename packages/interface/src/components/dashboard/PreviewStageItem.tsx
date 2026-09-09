import { cn } from "../../lib/utils";
import type { LoadedImage } from "../../types/dashboard.types";

interface PreviewStageItemProps {
  img: LoadedImage;
  index: number;
  viewMode: "long_strip" | "paginated";
  zoom: number;
  resolvedActiveId: string | null;
  onSelect: (id: string) => void;
  getPreviewSrc: (img: LoadedImage) => string;
}

export function PreviewStageItem({
  img,
  index,
  viewMode,
  zoom,
  resolvedActiveId,
  onSelect,
  getPreviewSrc,
}: PreviewStageItemProps) {
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
}
