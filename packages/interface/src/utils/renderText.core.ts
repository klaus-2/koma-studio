import type {
  TypographyBounds,
  TypographyShape,
  TypographyShapeKind,
} from "../typography/types";
import type {
  RenderTextOrientation,
  RenderTextPathMode,
  RenderTextStyle,
  RenderTextStyleRange,
} from "../typography/renderStyle";
import { parseCssGradientValue } from "./textFillPicker";
import type {
  FillStyleSource,
  RenderTextPlacementSegment,
  RenderTextVisualPadding,
} from "./renderText.types";

const ROUNDED_REFINED_SAFE_ZONE = {
  left: 16,
  right: 16,
  top: 60,
  bottom: 60,
} as const;

const SQUARE_REFINED_SAFE_ZONE = {
  left: 8,
  right: 8,
  top: 30,
  bottom: 30,
} as const;

const ROUNDED_REFINED_H_RATIO = 0.05;
const ROUNDED_REFINED_V_RATIO = 0.20;
const SQUARE_REFINED_H_RATIO = 0.02;
const SQUARE_REFINED_V_RATIO = 0.15;

export const normalizeText = (value: string): string =>
  value.replace(/\r\n/g, "\n").trim();

export const normalizeFontFamily = (value: string): string => {
  const firstFamily = value.split(",")[0]?.trim() ?? "";
  const unquoted = firstFamily.replace(/^["']+|["']+$/g, "").trim();
  return unquoted.length > 0 ? unquoted : "Arial";
};

export const buildCanvasFont = (style: RenderTextStyle, fontSize: number): string => {
  const italic = style.italic ? "italic " : "";
  const bold = style.bold ? "bold " : "";
  const family = normalizeFontFamily(style.fontFamily);
  const escapedFamily = family.replace(/["\\]/g, "\\$&");
  return `${italic}${bold}${fontSize}px "${escapedFamily}", sans-serif`;
};

type StyledGlyph = {
  text: string;
  style: RenderTextStyle;
  measuredWidth: number;
  lineHeight: number;
};

export const cloneShadowLayers = (
  style: RenderTextStyle,
): RenderTextStyle["shadowLayers"] =>
  style.shadowLayers?.map((layer) => ({ ...layer }));

export const resolveGlyphStyle = (
  baseStyle: RenderTextStyle,
  fontSize: number,
  patch?: Partial<RenderTextStyle>,
): RenderTextStyle => ({
  ...baseStyle,
  fontSize,
  ...patch,
  shadowLayers: patch?.shadowLayers
    ? patch.shadowLayers.map((layer) => ({ ...layer }))
    : cloneShadowLayers(baseStyle),
});

export const buildStyledGlyphLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  baseStyle: RenderTextStyle,
  fontSize: number,
  ranges?: RenderTextStyleRange[],
): StyledGlyph[][] => {
  const lines: StyledGlyph[][] = [[]];
  const safeText = text.length > 0 ? text : " ";
  const lineBreaks = safeText.split("\n");
  let offset = 0;

  const applyPatchForIndex = (index: number): Partial<RenderTextStyle> | undefined => {
    const patch: Partial<RenderTextStyle> = {};
    ranges?.forEach((range) => {
      if (index < range.start || index >= range.end) return;
      Object.assign(patch, range.style);
    });
    return Object.keys(patch).length > 0 ? patch : undefined;
  };

  for (let lineIndex = 0; lineIndex < lineBreaks.length; lineIndex += 1) {
    const rawLine = lineBreaks[lineIndex] ?? "";
    const currentLine = lines[lineIndex] ?? [];
    const source = rawLine.length > 0 ? Array.from(rawLine) : [" "];

    source.forEach((rawGlyph, glyphIndex) => {
      const style = resolveGlyphStyle(
        baseStyle,
        fontSize,
        applyPatchForIndex(offset + glyphIndex),
      );
      const glyph = style.uppercase ? rawGlyph.toUpperCase() : rawGlyph;
      ctx.font = buildCanvasFont(style, style.fontSize);
      currentLine.push({
        text: glyph,
        style,
        measuredWidth: ctx.measureText(glyph || " ").width,
        lineHeight: estimateLineHeight(ctx, style, style.fontSize),
      });
    });

    offset += rawLine.length + 1;
    if (lineIndex < lineBreaks.length - 1) {
      lines.push([]);
    }
  }

  return lines;
};

export const compressGlyphSegments = (
  ctx: CanvasRenderingContext2D,
  glyphs: StyledGlyph[],
): RenderTextPlacementSegment[] => {
  const segments: RenderTextPlacementSegment[] = [];
  glyphs.forEach((glyph) => {
    const previousSegment = segments[segments.length - 1];
    const previousSignature = previousSegment
      ? JSON.stringify(previousSegment.style)
      : "";
    const nextSignature = JSON.stringify(glyph.style);
    if (previousSegment && previousSignature === nextSignature) {
      previousSegment.text += glyph.text;
      ctx.font = buildCanvasFont(previousSegment.style, previousSegment.style.fontSize);
      previousSegment.measuredWidth = ctx.measureText(previousSegment.text).width;
      return;
    }
    segments.push({
      text: glyph.text,
      style: glyph.style,
      measuredWidth: glyph.measuredWidth,
    });
  });
  return segments;
};

export const normalizeRotationAngle = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  let normalized = value % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
};

export const normalizeSkewAngle = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, -45), 45);
};

export const normalizeOpacity = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 0), 1);
};

export const applyOpacityToColor = (color: string, opacity: number): string => {
  const normalizedOpacity = normalizeOpacity(opacity);
  const normalizedColor = String(color || "").trim();
  if (!normalizedColor) {
    return `rgba(0, 0, 0, ${normalizedOpacity})`;
  }

  if (normalizedColor.startsWith("#")) {
    let hex = normalizedColor.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split("").map((char) => char + char).join("");
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
    }
  }

  const rgbMatch = normalizedColor.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = (rgbMatch[1] ?? "").split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${normalizedOpacity})`;
    }
  }

  return normalizedColor;
};

export const normalizeGradientAngle = (value: number): number => {
  if (!Number.isFinite(value)) return 90;
  let normalized = value % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

export const resolveRadialGradientCenter = (
  x: number,
  y: number,
  width: number,
  height: number,
  position: string,
): { centerX: number; centerY: number; radius: number } => {
  const normalized = position.trim().toLowerCase();
  const horizontal = normalized.includes("left")
    ? 0
    : normalized.includes("right")
      ? 1
      : 0.5;
  const vertical = normalized.includes("top")
    ? 0
    : normalized.includes("bottom")
      ? 1
      : 0.5;

  const centerX = x + (width * horizontal);
  const centerY = y + (height * vertical);
  const candidatePoints: Array<[number, number]> = [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ];
  const radius = candidatePoints.reduce((maxDistance, [pointX, pointY]) => {
    const distance = Math.hypot(pointX - centerX, pointY - centerY);
    return Math.max(maxDistance, distance);
  }, 1);

  return {
    centerX,
    centerY,
    radius: Math.max(1, radius),
  };
};

export const normalizeTextOrientation = (value: RenderTextStyle["textOrientation"]): RenderTextOrientation =>
  value === "vertical" ? "vertical" : "horizontal";

export const normalizeTextPathMode = (value: RenderTextStyle["textPathMode"]): RenderTextPathMode =>
  value === "circular" ? "circular" : "normal";

export const resolveCanvasFillStyle = (
  ctx: CanvasRenderingContext2D,
  style: FillStyleSource,
  x: number,
  y: number,
  width: number,
  height: number,
): string | CanvasGradient => {
  if (!style.gradientEnabled) {
    return style.fillCssValue || style.color;
  }

  const fillCssValue = style.fillCssValue?.trim();
  if (fillCssValue) {
    const parsedGradient = parseCssGradientValue(fillCssValue);
    if (parsedGradient?.stops.length) {
      if (parsedGradient.mode === "radial") {
        const { centerX, centerY, radius } = resolveRadialGradientCenter(
          x,
          y,
          width,
          height,
          parsedGradient.position,
        );
        const radialGradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          radius,
        );
        parsedGradient.stops.forEach((stop) => {
          radialGradient.addColorStop(
            Math.max(0, Math.min(1, stop.position / 100)),
            stop.color,
          );
        });
        return radialGradient;
      }

      const centerX = x + (width / 2);
      const centerY = y + (height / 2);
      const gradientLength = Math.max(1, Math.hypot(width, height) / 2);
      const angle = (normalizeGradientAngle(parsedGradient.angle) * Math.PI) / 180;
      const deltaX = Math.cos(angle) * gradientLength;
      const deltaY = Math.sin(angle) * gradientLength;
      const linearGradient = ctx.createLinearGradient(
        centerX - deltaX,
        centerY - deltaY,
        centerX + deltaX,
        centerY + deltaY,
      );
      parsedGradient.stops.forEach((stop) => {
        linearGradient.addColorStop(
          Math.max(0, Math.min(1, stop.position / 100)),
          stop.color,
        );
      });
      return linearGradient;
    }
  }

  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  const gradientLength = Math.max(1, Math.hypot(width, height) / 2);
  const angle = (normalizeGradientAngle(style.gradientAngle) * Math.PI) / 180;
  const deltaX = Math.cos(angle) * gradientLength;
  const deltaY = Math.sin(angle) * gradientLength;
  const gradient = ctx.createLinearGradient(
    centerX - deltaX,
    centerY - deltaY,
    centerX + deltaX,
    centerY + deltaY,
  );
  gradient.addColorStop(0, style.gradientStartColor || style.color);
  gradient.addColorStop(1, style.gradientEndColor || style.color);
  return gradient;
};

export const resolveTextFillStyle = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  x: number,
  y: number,
  width: number,
  height: number,
): string | CanvasGradient => resolveCanvasFillStyle(ctx, style, x, y, width, height);

export const estimateLineHeight = (
  ctx: CanvasRenderingContext2D,
  style: RenderTextStyle,
  fontSize: number,
): number => {
  ctx.font = buildCanvasFont(style, fontSize);
  const metrics = ctx.measureText("Mg");
  const baseHeight =
    (metrics.actualBoundingBoxAscent || fontSize * 0.8)
    + (metrics.actualBoundingBoxDescent || fontSize * 0.2);
  const spacing = Math.max(0.6, style.lineSpacing || 1);
  return Math.max(fontSize * 0.8, baseHeight) * spacing;
};

export const clampSafeZoneInset = (size: number, inset: number): number =>
  Math.min(
    inset,
    Math.max(0, Math.floor((Math.max(1, Math.round(size)) - 1) / 2)),
  );

export const buildRefinedSafeZoneInnerBox = (
  kind: TypographyShapeKind,
  roiWidth: number,
  roiHeight: number,
): TypographyBounds => {
  const safeWidth = Math.max(1, Math.round(roiWidth));
  const safeHeight = Math.max(1, Math.round(roiHeight));
  const template =
    kind === "rounded" ? ROUNDED_REFINED_SAFE_ZONE : SQUARE_REFINED_SAFE_ZONE;
  const hRatio = kind === "rounded" ? ROUNDED_REFINED_H_RATIO : SQUARE_REFINED_H_RATIO;
  const vRatio = kind === "rounded" ? ROUNDED_REFINED_V_RATIO : SQUARE_REFINED_V_RATIO;

  // Use the smaller of the fixed maximum or the proportional value,
  // with a floor so margins never collapse for tiny shapes.
  // This keeps text area consistent regardless of bubble size.
  const left = clampSafeZoneInset(safeWidth, Math.min(template.left, Math.max(4, Math.round(safeWidth * hRatio))));
  const right = clampSafeZoneInset(safeWidth, Math.min(template.right, Math.max(4, Math.round(safeWidth * hRatio))));
  const top = clampSafeZoneInset(safeHeight, Math.min(template.top, Math.max(8, Math.round(safeHeight * vRatio))));
  const bottom = clampSafeZoneInset(safeHeight, Math.min(template.bottom, Math.max(8, Math.round(safeHeight * vRatio))));

  return [
    left,
    top,
    Math.max(left + 1, safeWidth - right),
    Math.max(top + 1, safeHeight - bottom),
  ];
};

export const resolveStrictSafeZoneMode = (
  shape: TypographyShape | null | undefined,
  roiWidth: number,
  roiHeight: number,
): boolean => {
  if (!shape || shape.source !== "refined") {
    return false;
  }

  const expectedInnerBox = buildRefinedSafeZoneInnerBox(
    shape.kind,
    roiWidth,
    roiHeight,
  );

  return expectedInnerBox.every(
    (value, index) => value === (shape.innerBox[index] ?? value),
  );
};

export const resolveRenderTextVisualPadding = (
  style: RenderTextStyle,
  strictSafeZone: boolean,
): RenderTextVisualPadding => {
  const outlineWidth = Math.max(0, style.outlineWidth || 0);
  const padding: RenderTextVisualPadding = {
    left: outlineWidth,
    right: outlineWidth,
    top: outlineWidth,
    bottom: outlineWidth,
  };

  if (!strictSafeZone) {
    return padding;
  }

  return padding;
};

export const inferAutoFontBounds = (
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  shape?: TypographyShape | null,
): { minFontSize: number; maxFontSize: number } => {
  const safeWidth = Math.max(1, roiWidth);
  const safeHeight = Math.max(1, roiHeight);
  const orientation = normalizeTextOrientation(style.textOrientation);
  // Use inner box dimensions when available so the font bounds reflect
  // the actual usable area, not the full shape bounding box.
  let usableWidth = safeWidth;
  let usableHeight = safeHeight;
  if (shape?.innerBox) {
    usableWidth = Math.max(1, shape.innerBox[2] - shape.innerBox[0]);
    usableHeight = Math.max(1, shape.innerBox[3] - shape.innerBox[1]);
  }
  const maxByHeight = usableHeight * 0.95;
  const maxByWidth = orientation === "vertical" ? usableWidth * 1.5 : usableWidth * 0.88;
  const inferredMax = Math.floor(Math.min(maxByHeight, maxByWidth));
  const maxFontSize = Math.min(300, Math.max(8, inferredMax));
  const minFontSize = Math.min(maxFontSize, Math.max(6, Math.floor(maxFontSize * 0.15)));
  return { minFontSize, maxFontSize };
};

export const normalizeShape = (
  shape: TypographyShape | undefined,
  roiWidth: number,
  roiHeight: number,
): TypographyShape | null => {
  if (!shape) return null;
  const safeWidth = Math.max(1, roiWidth);
  const safeHeight = Math.max(1, roiHeight);
  const [rawX1, rawY1, rawX2, rawY2] = shape.innerBox;
  const x1 = Math.min(Math.max(0, rawX1), safeWidth);
  const y1 = Math.min(Math.max(0, rawY1), safeHeight);
  const x2 = Math.max(x1 + 1, Math.min(safeWidth, rawX2));
  const y2 = Math.max(y1 + 1, Math.min(safeHeight, rawY2));
  const fitProfile = Array.isArray(shape.fitProfile) && shape.fitProfile.length > 0
    ? shape.fitProfile.map((value) => Math.min(1, Math.max(0.2, Number(value) || 1)))
    : [1];
  return {
    ...shape,
    innerBox: [x1, y1, x2, y2],
    fitProfile,
  };
};

export const resolveHorizontalLineWidths = (
  normalizedShape: TypographyShape | null,
  lineCount: number,
  fallbackWidth: number,
): number[] => {
  if (!normalizedShape || normalizedShape.kind !== "rounded" || lineCount <= 0) {
    return Array.from({ length: Math.max(1, lineCount) }, () => fallbackWidth);
  }
  const fitProfile = normalizedShape.fitProfile.length > 0 ? normalizedShape.fitProfile : [1];
  const innerBox = normalizedShape.innerBox;
  const innerHeight = Math.max(1, (innerBox[3] ?? 0) - (innerBox[1] ?? 0));
  const widths: number[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    const yCenter = lineCount <= 1
      ? innerHeight / 2
      : (index + 0.5) / lineCount * innerHeight;
    const yRatio = yCenter / innerHeight;
    const profilePos = yRatio * (fitProfile.length - 1);
    const lowerIndex = Math.floor(profilePos);
    const upperIndex = Math.min(fitProfile.length - 1, lowerIndex + 1);
    const t = profilePos - lowerIndex;
    const lowerRatio = fitProfile[lowerIndex] ?? 1;
    const upperRatio = fitProfile[upperIndex] ?? 1;
    const ratio = lowerRatio + (upperRatio - lowerRatio) * t;
    widths.push(Math.max(1, fallbackWidth * ratio));
  }
  return widths;
};
