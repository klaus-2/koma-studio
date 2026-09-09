export type RenderModePresetMode =
  | "text_bubble"
  | "text_free"
  | "text_sfx"
  | "text_narration"
  | "text_inside_black_bubble";

export interface RenderModeStylePreset {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  outlineEnabled: boolean;
  uppercase: boolean;
  detectGradient: boolean;
}

export interface RenderModePresetStateV1 {
  version: 1;
  presets: Partial<Record<RenderModePresetMode, RenderModeStylePreset>>;
}

export const RENDER_MODE_PRESET_STORAGE_KEY = "koma-render-mode-presets-v1";

export const RENDER_MODE_PRESET_MODES: RenderModePresetMode[] = [
  "text_bubble",
  "text_free",
  "text_sfx",
  "text_narration",
  "text_inside_black_bubble",
];

const DEFAULT_STATE: RenderModePresetStateV1 = {
  version: 1,
  presets: {},
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const sanitizeText = (value: unknown, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

const sanitizeColor = (value: unknown, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return fallback;
  return normalized;
};

const sanitizePreset = (value: unknown, fallback?: RenderModeStylePreset): RenderModeStylePreset | null => {
  if (!isRecord(value)) return fallback ? { ...fallback } : null;
  const nextFallback = fallback ?? {
    fontFamily: "Arial",
    fontSize: 40,
    bold: false,
    italic: false,
    color: "#111111",
    outlineColor: "#ffffff",
    outlineWidth: 2,
    outlineEnabled: true,
    uppercase: false,
    detectGradient: true,
  };
  return {
    fontFamily: sanitizeText(value.fontFamily, nextFallback.fontFamily),
    fontSize: clamp(Number.isFinite(Number(value.fontSize)) ? Number(value.fontSize) : nextFallback.fontSize, 6, 160),
    bold: typeof value.bold === "boolean" ? value.bold : nextFallback.bold,
    italic: typeof value.italic === "boolean" ? value.italic : nextFallback.italic,
    color: sanitizeColor(value.color, nextFallback.color),
    outlineColor: sanitizeColor(value.outlineColor, nextFallback.outlineColor),
    outlineWidth: clamp(Number.isFinite(Number(value.outlineWidth)) ? Number(value.outlineWidth) : nextFallback.outlineWidth, 0, 10),
    outlineEnabled: typeof value.outlineEnabled === "boolean" ? value.outlineEnabled : nextFallback.outlineEnabled,
    uppercase: typeof value.uppercase === "boolean" ? value.uppercase : nextFallback.uppercase,
    detectGradient: typeof value.detectGradient === "boolean" ? value.detectGradient : nextFallback.detectGradient,
  };
};

const sanitizeState = (value: unknown): RenderModePresetStateV1 => {
  if (!isRecord(value) || Number(value.version) !== 1 || !isRecord(value.presets)) {
    return { ...DEFAULT_STATE };
  }

  const presets: Partial<Record<RenderModePresetMode, RenderModeStylePreset>> = {};
  const presetMap = value.presets as Record<RenderModePresetMode, unknown>;
  RENDER_MODE_PRESET_MODES.forEach((mode) => {
    const sanitized = sanitizePreset(presetMap[mode]);
    if (sanitized) {
      presets[mode] = sanitized;
    }
  });

  return {
    version: 1,
    presets,
  };
};

const persistState = (state: RenderModePresetStateV1): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RENDER_MODE_PRESET_STORAGE_KEY, JSON.stringify(state));
};



export const loadRenderModePresetState = (): RenderModePresetStateV1 => {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  return sanitizeState(
    parseJson<unknown>(window.localStorage.getItem(RENDER_MODE_PRESET_STORAGE_KEY), DEFAULT_STATE),
  );
};

export const saveRenderModePresetState = (state: RenderModePresetStateV1): RenderModePresetStateV1 => {
  const sanitizedState = sanitizeState(state);
  persistState(sanitizedState);
  return sanitizedState;
};

export const setRenderModePreset = (
  mode: RenderModePresetMode,
  preset: RenderModeStylePreset,
  state: RenderModePresetStateV1 = loadRenderModePresetState(),
): RenderModePresetStateV1 => {
  const sanitizedPreset = sanitizePreset(preset);
  if (!sanitizedPreset) return state;
  return saveRenderModePresetState({
    ...state,
    presets: {
      ...state.presets,
      [mode]: sanitizedPreset,
    },
  });
};



export const resetRenderModePreset = (
  mode: RenderModePresetMode,
  state: RenderModePresetStateV1 = loadRenderModePresetState(),
): RenderModePresetStateV1 => {
  const nextPresets = { ...state.presets };
  delete nextPresets[mode];
  return saveRenderModePresetState({
    ...state,
    presets: nextPresets,
  });
};

export const resetAllRenderModePresets = (): RenderModePresetStateV1 =>
  saveRenderModePresetState({ ...DEFAULT_STATE });
