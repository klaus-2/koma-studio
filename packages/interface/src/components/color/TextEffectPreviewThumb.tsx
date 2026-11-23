import { memo, useMemo } from "react";

import { DEFAULT_RENDER_STYLE } from "../../constants/dashboard.constants";
import type { NativeTextEffectPresetId } from "../../typography/textEffects";
import { renderTextEffectPreviewDataUrl } from "../../utils/renderText.effects.preview";

interface TextEffectPreviewThumbProps {
  presetId: NativeTextEffectPresetId;
  fallbackText: string;
  width?: number;
  height?: number;
  intensity?: number;
  className?: string;
}

export const TextEffectPreviewThumb = memo(function TextEffectPreviewThumb({
  presetId,
  fallbackText,
  width = 160,
  height = 50,
  intensity = 1,
  className = "",
}: TextEffectPreviewThumbProps) {
  const dataUrl = useMemo(
    () =>
      renderTextEffectPreviewDataUrl(presetId, DEFAULT_RENDER_STYLE, {
        width,
        height,
        intensity,
      }),
    [height, intensity, presetId, width],
  );

  if (!dataUrl) {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold text-[#1f2430] ${className}`}
        aria-hidden="true"
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={dataUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`pointer-events-none select-none object-contain ${className}`}
      style={{ width: `${width}px`, height: `${height}px`, maxWidth: "100%", maxHeight: "100%" }}
    />
  );
});
