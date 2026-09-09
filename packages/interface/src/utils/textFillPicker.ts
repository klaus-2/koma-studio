import type { RenderModeStylePreset } from "./renderModePresets";
import type { RenderTextStyle } from "./renderText";

const LINEAR_DIRECTION_TO_ANGLE: Record<string, number> = {
  "to top": 0,
  "to top right": 45,
  "to right top": 45,
  "to right": 90,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom": 180,
  "to bottom left": 225,
  "to left bottom": 225,
  "to left": 270,
  "to top left": 315,
  "to left top": 315,
};

export const DEFAULT_SOLID_TEXT_FILL_SWATCHES: string[] = [
  "#111111",
  "#ffffff",
  "#a855f7",
  "#06b6d4",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
];

export const DEFAULT_GRADIENT_TEXT_FILL_SWATCHES: string[] = [
  "linear-gradient(90deg, #111111 0%, #ffffff 100%)",
  "linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
];



export interface TextFillSwatchStateV1 {
  version: 1;
  solid: string[];
  gradient: string[];
}

export const TEXT_FILL_SWATCH_STORAGE_KEY = "koma-text-fill-swatches-v1";

const DEFAULT_TEXT_FILL_SWATCH_STATE: TextFillSwatchStateV1 = {
  version: 1,
  solid: [...DEFAULT_SOLID_TEXT_FILL_SWATCHES],
  gradient: [...DEFAULT_GRADIENT_TEXT_FILL_SWATCHES],
};

type FillStyleShape = Pick<
  RenderTextStyle,
  "color" | "fillCssValue" | "gradientEnabled" | "gradientStartColor" | "gradientEndColor" | "gradientAngle"
>;

const COLOR_HEX_3 = /^#([\da-f]{3})$/i;
const COLOR_HEX_4 = /^#([\da-f]{4})$/i;
const COLOR_HEX_6 = /^#([\da-f]{6})$/i;
const COLOR_HEX_8 = /^#([\da-f]{8})$/i;

const expandShortHex = (value: string): string =>
  `#${value
    .slice(1)
    .split("")
    .map((char) => `${char}${char}`)
    .join("")}`;

const hexToRgbaString = (value: string): string => {
  const normalized = value.trim();
  const expanded =
    COLOR_HEX_4.test(normalized) || COLOR_HEX_8.test(normalized)
      ? (COLOR_HEX_4.test(normalized) ? expandShortHex(normalized) : normalized).toLowerCase()
      : normalized.toLowerCase();
  const hex = expanded.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const alpha = Number.parseInt(hex.slice(6, 8), 16) / 255;
  const roundedAlpha = Math.round(alpha * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`;
};

const normalizeHexColor = (value: string): string => {
  const trimmed = value.trim();
  if (COLOR_HEX_3.test(trimmed)) {
    return expandShortHex(trimmed).toLowerCase();
  }
  if (COLOR_HEX_4.test(trimmed)) {
    return hexToRgbaString(trimmed);
  }
  if (COLOR_HEX_6.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (COLOR_HEX_8.test(trimmed)) {
    return hexToRgbaString(trimmed);
  }
  return trimmed;
};

const normalizeCssColorString = (value: string, fallback: string): string => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return fallback;
  }

  if (
    COLOR_HEX_3.test(normalizedValue) ||
    COLOR_HEX_4.test(normalizedValue) ||
    COLOR_HEX_6.test(normalizedValue) ||
    COLOR_HEX_8.test(normalizedValue)
  ) {
    return normalizeHexColor(normalizedValue);
  }

  if (typeof document === "undefined") {
    return normalizedValue;
  }

  const option = document.createElement("option");
  option.style.color = "";
  option.style.color = normalizedValue;
  return option.style.color || fallback;
};

const splitTopLevelByComma = (value: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of value) {
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const stripGradientStopPosition = (value: string): string =>
  value
    .replace(/\s+-?\d+(?:\.\d+)?(?:%|px|deg)?\s*$/iu, "")
    .trim();

const cssColorToHex = (value: string, fallback: string): string => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return fallback;
  }

  if (
    COLOR_HEX_3.test(normalizedValue) ||
    COLOR_HEX_4.test(normalizedValue) ||
    COLOR_HEX_6.test(normalizedValue) ||
    COLOR_HEX_8.test(normalizedValue)
  ) {
    return normalizeHexColor(normalizedValue);
  }

  if (typeof document === "undefined") {
    return fallback;
  }

  const option = document.createElement("option");
  option.style.color = "";
  option.style.color = normalizedValue;
  const parsed = option.style.color;
  if (!parsed) {
    return fallback;
  }

  if (
    COLOR_HEX_3.test(parsed) ||
    COLOR_HEX_4.test(parsed) ||
    COLOR_HEX_6.test(parsed) ||
    COLOR_HEX_8.test(parsed)
  ) {
    return normalizeHexColor(parsed);
  }

  const rgbMatch = parsed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) {
    return fallback;
  }

  return `#${rgbMatch
    .slice(1, 4)
    .map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, "0"))
    .join("")}`.toLowerCase();
};

const parseStopPosition = (value: string): number | null => {
  const match = value.match(/(-?\d+(?:\.\d+)?)%/u);
  if (!match) {
    return null;
  }
  return Math.max(0, Math.min(100, Number(match[1])));
};

export interface ParsedGradientStop {
  color: string;
  position: number;
}

export interface ParsedCssGradient {
  mode: "linear" | "radial";
  angle: number;
  position: string;
  stops: ParsedGradientStop[];
}

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const parseGradientAngle = (value: string): number => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith("deg")) {
    const parsed = Number.parseFloat(trimmed.slice(0, -3));
    if (Number.isFinite(parsed)) {
      const normalized = parsed % 360;
      return normalized < 0 ? normalized + 360 : normalized;
    }
  }

  return LINEAR_DIRECTION_TO_ANGLE[trimmed] ?? 90;
};

const parseLinearGradient = (
  value: string,
  fallbackColor: string,
): {
  gradientEnabled: true;
  fillCssValue: string;
  color: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
} | null => {
  const trimmed = value.trim();
  if (!/^linear-gradient\(/i.test(trimmed) || !trimmed.endsWith(")")) {
    return null;
  }

  const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
  const parts = splitTopLevelByComma(inner);
  if (parts.length < 3) {
    return null;
  }

  const angle = parseGradientAngle(parts[0] ?? "90deg");
  const startColor = normalizeCssColorString(stripGradientStopPosition(parts[1] ?? ""), fallbackColor);
  const endColor = normalizeCssColorString(stripGradientStopPosition(parts[parts.length - 1] ?? ""), startColor);

  return {
    gradientEnabled: true,
    fillCssValue: trimmed,
    color: startColor,
    gradientStartColor: startColor,
    gradientEndColor: endColor,
    gradientAngle: angle,
  };
};

const parseRadialGradient = (
  value: string,
  fallbackColor: string,
): {
  gradientEnabled: true;
  fillCssValue: string;
  color: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
} | null => {
  const trimmed = value.trim();
  if (!/^radial-gradient\(/i.test(trimmed) || !trimmed.endsWith(")")) {
    return null;
  }

  const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
  const parts = splitTopLevelByComma(inner);
  if (parts.length < 3) {
    return null;
  }

  const startColor = normalizeCssColorString(stripGradientStopPosition(parts[1] ?? ""), fallbackColor);
  const endColor = normalizeCssColorString(stripGradientStopPosition(parts[parts.length - 1] ?? ""), startColor);

  return {
    gradientEnabled: true,
    fillCssValue: trimmed,
    color: startColor,
    gradientStartColor: startColor,
    gradientEndColor: endColor,
    gradientAngle: 90,
  };
};

export const parseCssGradientValue = (value: string): ParsedCssGradient | null => {
  const trimmed = value.trim();
  const mode = trimmed.startsWith("radial-gradient(")
    ? "radial"
    : trimmed.startsWith("linear-gradient(")
      ? "linear"
      : null;
  if (!mode || !trimmed.endsWith(")")) {
    return null;
  }

  const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
  const parts = splitTopLevelByComma(inner);
  if (parts.length < 3) {
    return null;
  }

  const descriptor = parts[0] ?? (mode === "linear" ? "90deg" : "circle at center");
  const rawStops = parts.slice(1);
  const stopCount = rawStops.length;
  const stops = rawStops.map((stop, index) => {
    const parsedPosition = parseStopPosition(stop);
    const fallbackPosition = stopCount <= 1 ? 0 : (index / (stopCount - 1)) * 100;
    return {
      color: normalizeCssColorString(stripGradientStopPosition(stop), "#111111"),
      position: parsedPosition ?? fallbackPosition,
    };
  });

  return {
    mode,
    angle: mode === "linear" ? parseGradientAngle(descriptor) : 90,
    position: mode === "radial" ? descriptor.trim() : "circle at center",
    stops,
  };
};

export const isGradientFillValue = (value: string): boolean =>
  /^(linear|radial)-gradient\(/i.test(value.trim());

export const normalizeTextFillSwatchValue = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isGradientFillValue(trimmed)) {
    return parseCssGradientValue(trimmed) ? trimmed : null;
  }

  const normalized = normalizeCssColorString(trimmed, "");
  return normalized.trim() ? normalized : null;
};

const sanitizeSwatchList = (values: unknown, type: "solid" | "gradient"): string[] => {
  if (!Array.isArray(values)) {
    return type === "solid"
      ? [...DEFAULT_SOLID_TEXT_FILL_SWATCHES]
      : [...DEFAULT_GRADIENT_TEXT_FILL_SWATCHES];
  }

  const normalized = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeTextFillSwatchValue(item))
    .filter((item): item is string => Boolean(item))
    .filter((item) => (type === "gradient" ? isGradientFillValue(item) : !isGradientFillValue(item)));

  const unique = Array.from(new Set(normalized));
  if (unique.length > 0) {
    return unique;
  }

  return type === "solid"
    ? [...DEFAULT_SOLID_TEXT_FILL_SWATCHES]
    : [...DEFAULT_GRADIENT_TEXT_FILL_SWATCHES];
};

const sanitizeTextFillSwatchState = (value: unknown): TextFillSwatchStateV1 => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Number((value as { version?: number }).version) !== 1) {
    return { ...DEFAULT_TEXT_FILL_SWATCH_STATE };
  }

  const source = value as { solid?: unknown; gradient?: unknown };
  return {
    version: 1,
    solid: sanitizeSwatchList(source.solid, "solid"),
    gradient: sanitizeSwatchList(source.gradient, "gradient"),
  };
};

export const listTextFillSwatches = (state: TextFillSwatchStateV1): string[] => [
  ...state.solid,
  ...state.gradient,
];

export const loadTextFillSwatchState = (): TextFillSwatchStateV1 => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_TEXT_FILL_SWATCH_STATE };
  }

  return sanitizeTextFillSwatchState(
    parseJson<unknown>(window.localStorage.getItem(TEXT_FILL_SWATCH_STORAGE_KEY), DEFAULT_TEXT_FILL_SWATCH_STATE),
  );
};

export const saveTextFillSwatchState = (state: TextFillSwatchStateV1): TextFillSwatchStateV1 => {
  const sanitized = sanitizeTextFillSwatchState(state);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEXT_FILL_SWATCH_STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
};

export const addTextFillSwatch = (
  state: TextFillSwatchStateV1,
  rawValue: string,
): TextFillSwatchStateV1 => {
  const normalized = normalizeTextFillSwatchValue(rawValue);
  if (!normalized) {
    return state;
  }

  const bucket = isGradientFillValue(normalized) ? "gradient" : "solid";
  return saveTextFillSwatchState({
    ...state,
    [bucket]: Array.from(new Set([normalized, ...state[bucket]])).slice(0, 24),
  });
};

export const removeTextFillSwatch = (
  state: TextFillSwatchStateV1,
  rawValue: string,
): TextFillSwatchStateV1 => {
  const normalized = normalizeTextFillSwatchValue(rawValue);
  if (!normalized) {
    return state;
  }

  const bucket = isGradientFillValue(normalized) ? "gradient" : "solid";
  return saveTextFillSwatchState({
    ...state,
    [bucket]: state[bucket].filter((item) => item !== normalized),
  });
};

export const resetTextFillSwatches = (): TextFillSwatchStateV1 =>
  saveTextFillSwatchState({ ...DEFAULT_TEXT_FILL_SWATCH_STATE });

export const buildFillPickerValue = (style: FillStyleShape): string => {
  if (style.fillCssValue?.trim()) {
    return style.fillCssValue.trim();
  }

  if (style.gradientEnabled) {
    return `linear-gradient(${Math.round(style.gradientAngle)}deg, ${cssColorToHex(
      style.gradientStartColor,
      "#111111",
    )} 0%, ${cssColorToHex(style.gradientEndColor, "#ffffff")} 100%)`;
  }

  return cssColorToHex(style.color, "#111111");
};

export const parseFillPickerValue = (
  value: string,
  fallbackColor: string,
): {
  color: string;
  fillCssValue: string;
  gradientEnabled: boolean;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
} => {
  const gradient = parseLinearGradient(value, fallbackColor) ?? parseRadialGradient(value, fallbackColor);
  if (gradient) {
    return gradient;
  }

  const solidColor = normalizeCssColorString(value, fallbackColor);
  return {
    color: solidColor,
    fillCssValue: solidColor,
    gradientEnabled: false,
    gradientStartColor: solidColor,
    gradientEndColor: solidColor,
    gradientAngle: 90,
  };
};

export const buildRenderModeColorPickerValue = (style: Pick<RenderModeStylePreset, "color">): string =>
  normalizeCssColorString(style.color, "#111111");
