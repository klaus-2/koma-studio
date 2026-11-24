import { useEffect, useRef, useState } from "react";

import type { useI18n } from "../../i18n";
import type { RenderTextStyle } from "../../typography/renderStyle";
import type { TypographyShapeKind } from "../../typography/types";
import type { RenderModePresetMode } from "../../utils/renderModePresets";
import {
  drawPresetPreview,
  PRESET_PREVIEW_HEIGHT,
  PRESET_PREVIEW_WIDTH,
  toFontLoadDescriptor,
} from "./renderModePresetPreview.draw";

type TranslationFn = ReturnType<typeof useI18n>["t"];

export interface RenderModePresetPreviewProps {
  t: TranslationFn;
  mode: RenderModePresetMode;
  style: RenderTextStyle;
  shapeKind: TypographyShapeKind;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  canvasClassName?: string;
}

const paint = (canvas: HTMLCanvasElement, props: Pick<RenderModePresetPreviewProps, "mode" | "style" | "shapeKind">, text: string): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPresetPreview(ctx, { mode: props.mode, style: props.style, shapeKind: props.shapeKind, text });
};

export const RenderModePresetPreview = ({
  t,
  mode,
  style,
  shapeKind,
  className,
  labelClassName,
  inputClassName,
  canvasClassName,
}: RenderModePresetPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sampleText, setSampleText] = useState(() => t("settings.modePresets.sampleTextDefault"));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stale = false;
    paint(canvas, { mode, style, shapeKind }, sampleText);
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts && typeof fonts.load === "function") {
      fonts.load(toFontLoadDescriptor(style), sampleText || " ").then(
        () => {
          if (!stale) paint(canvas, { mode, style, shapeKind }, sampleText);
        },
        () => undefined,
      );
    }
    return () => {
      stale = true;
    };
  }, [mode, style, shapeKind, sampleText]);

  return (
    <div className={className} aria-label={t("settings.modePresets.preview")} role="group">
      <span className={labelClassName}>{t("settings.modePresets.preview")}</span>
      <canvas
        ref={canvasRef}
        width={PRESET_PREVIEW_WIDTH}
        height={PRESET_PREVIEW_HEIGHT}
        className={canvasClassName}
        style={{ width: "100%", height: "auto", aspectRatio: `${PRESET_PREVIEW_WIDTH} / ${PRESET_PREVIEW_HEIGHT}` }}
        aria-hidden
      />
      <label className={labelClassName}>
        {t("settings.modePresets.sampleText")}
        <input
          type="text"
          className={inputClassName}
          value={sampleText}
          onChange={(event) => setSampleText(event.target.value)}
        />
      </label>
    </div>
  );
};
