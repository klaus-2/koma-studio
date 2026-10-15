import type {
  TypographyBounds,
  TypographyShape,
  TypographyShapeKind,
} from "@/typography/types";
import type { RenderTextStyle } from "@/typography/renderStyle";

const positiveDimension = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("Geometry dimensions must be finite and positive.");
  }
  return value;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampSafeZoneInset = (
  size: number,
  inset: number,
): number =>
  clamp(
    Number.isFinite(inset) ? inset : 0,
    0,
    Math.max(0, (positiveDimension(size) - Math.min(1, size)) / 2),
  );

export const buildRefinedSafeZoneInnerBox = (
  kind: TypographyShapeKind,
  roiWidth: number,
  roiHeight: number,
): TypographyBounds => {
  const width = positiveDimension(roiWidth);
  const height = positiveDimension(roiHeight);
  const rounded = kind === "rounded";
  const horizontal = clampSafeZoneInset(
    width,
    Math.min(rounded ? 16 : 8, Math.max(4, Math.round(width * (rounded ? 0.05 : 0.02)))),
  );
  const vertical = clampSafeZoneInset(
    height,
    Math.min(rounded ? 60 : 30, Math.max(8, Math.round(height * (rounded ? 0.2 : 0.15)))),
  );

  return [horizontal, vertical, width - horizontal, height - vertical];
};

export const resolveStrictSafeZoneMode = (
  shape: TypographyShape | null | undefined,
  roiWidth: number,
  roiHeight: number,
): boolean => {
  if (shape?.source !== "refined") return false;

  const expected = buildRefinedSafeZoneInnerBox(
    shape.kind,
    roiWidth,
    roiHeight,
  );

  return expected.every(
    (value, index) => Math.abs(value - (shape.innerBox[index] ?? NaN)) < 1e-6,
  );
};

export const normalizeShape = (
  shape: TypographyShape | undefined,
  roiWidth: number,
  roiHeight: number,
): TypographyShape | null => {
  if (!shape) return null;

  const width = positiveDimension(roiWidth);
  const height = positiveDimension(roiHeight);
  const [rawX1, rawY1, rawX2, rawY2] = shape.innerBox;

  if (![rawX1, rawY1, rawX2, rawY2].every(Number.isFinite)) {
    throw new RangeError("Shape bounds must be finite.");
  }

  const x1 = clamp(rawX1, 0, width);
  const y1 = clamp(rawY1, 0, height);
  const x2 = clamp(rawX2, 0, width);
  const y2 = clamp(rawY2, 0, height);

  if (x2 <= x1 || y2 <= y1) {
    throw new RangeError("Shape bounds must define a non-empty rectangle.");
  }

  const fitProfile =
    shape.fitProfile.length > 0
      ? shape.fitProfile.map((value) => {
          if (!Number.isFinite(value)) {
            throw new RangeError("Shape profile values must be finite.");
          }
          return clamp(value, 0, 1);
        })
      : [1];

  return {
    ...shape,
    innerBox: [x1, y1, x2, y2],
    fitProfile,
  };
};

const profileRatioAt = (
  profile: readonly number[],
  ratio: number,
): number => {
  if (profile.length === 0) return 1;

  const position = clamp(ratio, 0, 1) * (profile.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(profile.length - 1, lower + 1);
  const fraction = position - lower;
  const start = profile[lower] ?? 1;
  const end = profile[upper] ?? start;

  return start + (end - start) * fraction;
};

export const resolveHorizontalBandWidth = (
  shape: TypographyShape | null,
  fallbackWidth: number,
  startRatio: number,
  endRatio: number,
): number => {
  if (!shape || shape.kind !== "rounded") return fallbackWidth;

  const profile = shape.fitProfile;
  let ratio = Math.min(
    profileRatioAt(profile, startRatio),
    profileRatioAt(profile, endRatio),
  );

  const denominator = profile.length - 1;
  if (denominator > 0) {
    const first = Math.ceil(clamp(startRatio, 0, 1) * denominator);
    const last = Math.floor(clamp(endRatio, 0, 1) * denominator);

    for (let index = first; index <= last; index += 1) {
      ratio = Math.min(ratio, profile[index] ?? 1);
    }
  }

  return Math.max(0, fallbackWidth * ratio);
};

export const resolveHorizontalLineWidths = (
  shape: TypographyShape | null,
  lineCount: number,
  fallbackWidth: number,
): number[] => {
  if (!Number.isSafeInteger(lineCount) || lineCount < 0) {
    throw new RangeError("Line count must be a non-negative integer.");
  }

  return Array.from({ length: lineCount }, (_, index) =>
    resolveHorizontalBandWidth(
      shape,
      fallbackWidth,
      index / lineCount,
      (index + 1) / lineCount,
    ),
  );
};

export const inferAutoFontBounds = (
  roiWidth: number,
  roiHeight: number,
  style: RenderTextStyle,
  shape?: TypographyShape | null,
): Readonly<{ minFontSize: number; maxFontSize: number }> => {
  const width = shape
    ? shape.innerBox[2] - shape.innerBox[0]
    : positiveDimension(roiWidth);
  const height = shape
    ? shape.innerBox[3] - shape.innerBox[1]
    : positiveDimension(roiHeight);
  const widthFactor = style.textOrientation === "vertical" ? 1.5 : 0.88;
  const maxFontSize = Math.max(
    1,
    Math.min(300, Math.floor(Math.min(height * 0.95, width * widthFactor))),
  );

  return {
    minFontSize: Math.min(maxFontSize, Math.max(1, Math.floor(maxFontSize * 0.15))),
    maxFontSize,
  };
};
