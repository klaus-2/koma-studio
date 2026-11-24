import type { RenderTextStyle } from "../../typography/renderStyle";
import { createDefaultTypographyShape, type TypographyShapeKind } from "../../typography/types";
import type { RenderModePresetMode } from "../../utils/renderModePresets";
import { computeRenderTextLayout, drawRenderedTextInRegion } from "../../utils/renderText";

export const PRESET_PREVIEW_WIDTH = 560;
export const PRESET_PREVIEW_HEIGHT = 240;

type PreviewBox = [number, number, number, number];

const TEXT_BOXES: Readonly<Record<RenderModePresetMode, Readonly<PreviewBox>>> = {
  text_bubble: [96, 44, 464, 196],
  text_inside_black_bubble: [96, 44, 464, 196],
  text_narration: [76, 52, 484, 188],
  text_free: [40, 28, 520, 212],
  text_sfx: [28, 20, 532, 220],
};

export interface PresetPreviewInput {
  readonly mode: RenderModePresetMode;
  readonly style: RenderTextStyle;
  readonly text: string;
  readonly shapeKind: TypographyShapeKind;
}

export const presetPreviewTextBox = (mode: RenderModePresetMode): PreviewBox => {
  const [x1, y1, x2, y2] = TEXT_BOXES[mode];
  return [x1, y1, x2, y2];
};

const paintBubble = (ctx: CanvasRenderingContext2D, fill: string): void => {
  ctx.beginPath();
  ctx.ellipse(PRESET_PREVIEW_WIDTH / 2, PRESET_PREVIEW_HEIGHT / 2, 236, 104, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
};

export const paintPresetPreviewBackdrop = (ctx: CanvasRenderingContext2D, mode: RenderModePresetMode): void => {
  ctx.fillStyle = "#e9e4d8";
  ctx.fillRect(0, 0, PRESET_PREVIEW_WIDTH, PRESET_PREVIEW_HEIGHT);

  switch (mode) {
    case "text_bubble":
      paintBubble(ctx, "#ffffff");
      return;
    case "text_inside_black_bubble":
      paintBubble(ctx, "#111111");
      return;
    case "text_narration":
      ctx.fillStyle = "#fffdf5";
      ctx.fillRect(64, 40, 432, 160);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#111111";
      ctx.strokeRect(64, 40, 432, 160);
      return;
    case "text_free": {
      const gradient = ctx.createLinearGradient(0, 0, PRESET_PREVIEW_WIDTH, PRESET_PREVIEW_HEIGHT);
      gradient.addColorStop(0, "#9fb3c8");
      gradient.addColorStop(1, "#d9cbb5");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, PRESET_PREVIEW_WIDTH, PRESET_PREVIEW_HEIGHT);
      return;
    }
    case "text_sfx": {
      const cx = PRESET_PREVIEW_WIDTH / 2;
      const cy = PRESET_PREVIEW_HEIGHT / 2;
      const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, PRESET_PREVIEW_WIDTH / 2);
      gradient.addColorStop(0, "#f6d365");
      gradient.addColorStop(1, "#c0392b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, PRESET_PREVIEW_WIDTH, PRESET_PREVIEW_HEIGHT);
      return;
    }
  }
};

export const drawPresetPreview = (ctx: CanvasRenderingContext2D, input: PresetPreviewInput): void => {
  paintPresetPreviewBackdrop(ctx, input.mode);
  const box = presetPreviewTextBox(input.mode);
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  const shape = createDefaultTypographyShape(width, height, input.shapeKind, "manual");
  const text = input.text.trim() ? input.text : " ";
  const layout = computeRenderTextLayout(ctx, text, width, height, input.style, shape);
  drawRenderedTextInRegion(ctx, box, layout, input.style, shape);
};

export const toFontLoadDescriptor = (style: RenderTextStyle): string => {
  const family = style.fontFamily.trim();
  const quotedFamily = /[,"']/.test(family) ? family : `"${family}"`;
  const weight = style.bold ? "bold " : "";
  const slant = style.italic ? "italic " : "";
  return `${slant}${weight}${Math.max(1, Math.round(style.fontSize))}px ${quotedFamily}`;
};
