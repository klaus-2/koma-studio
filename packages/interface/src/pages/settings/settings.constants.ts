import { RENDER_TEXT_MODE_LABELS, getRenderModePresetStyle, type DetectedRenderTextMode } from "../../utils/renderModes";
import type { RenderTextStyle } from "../../utils/renderText";
import type { AioStageKey, AioStageSelection } from "../../types/aioModelPresets";
import type { AioStageOptionMap } from "../../models/aioStageCatalog";
import type { RenderModePresetMode, RenderModePresetStateV1, RenderModeStylePreset } from "../../utils/renderModePresets";
import type { RenderModePresetFormData, PresetFormData, SettingsTab, TypographyPresetFormData } from "./settings.types";

/* ─── Constants ─────────────────────────────────────────── */

// Single source lives in constants/dashboard.constants.ts; re-exported here to
// avoid breaking the importers of this page.
export {
  DEFAULT_RENDER_FONT_FAMILIES,
  SETTINGS_REQUESTED_TAB_STORAGE_KEY,
} from "../../constants/dashboard.constants";

export const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: "general", label: "general", icon: "user" },
  { id: "presets", label: "presets", icon: "sliders" },
  { id: "integrations", label: "integrations", icon: "link" },
  { id: "app", label: "app", icon: "app" },
];

export const AIO_STAGE_KEYS: AioStageKey[] = [
  "detectText",
  "recognizeText",
  "getTranslations",
  "segmentText",
  "cleanImage",
];

export const AIO_STAGE_LABELS: Record<AioStageKey, string> = {
  detectText: "detectText",
  recognizeText: "recognizeText",
  getTranslations: "getTranslations",
  segmentText: "segmentText",
  cleanImage: "cleanImage",
};

export const RENDER_MODE_PRESET_OPTIONS = (Object.entries(RENDER_TEXT_MODE_LABELS) as Array<["auto" | DetectedRenderTextMode, string]>)
  .filter(([mode]) => mode !== "auto") as Array<[RenderModePresetMode, string]>;

export const RENDER_MODE_EDITOR_BASE_STYLE: RenderTextStyle = {
  fontFamily: "Arial",
  fontSize: 40,
  minFontSize: 10,
  autoFontSize: true,
  lineSpacing: 1,
  textOrientation: "horizontal",
  textPathMode: "normal",
  circularRadiusScale: 0.78,
  circularStartAngle: -90,
  circularLetterSpacing: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  alignment: "center",
  bold: false,
  italic: false,
  uppercase: false,
  underline: false,
  opacity: 1,
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowFillCssValue: "#000000",
  shadowGradientEnabled: false,
  shadowGradientStartColor: "#000000",
  shadowGradientEndColor: "#000000",
  shadowGradientAngle: 90,
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  color: "#111111",
  fillCssValue: "#111111",
  gradientEnabled: false,
  gradientStartColor: "#111111",
  gradientEndColor: "#111111",
  gradientAngle: 90,
  detectGradient: true,
  hyphenationEnabled: false,
  outlineColor: "#ffffff",
  outlineOpacity: 1,
  outlineWidth: 2,
  shadowOpacity: 1,
  textEffectPreset: "none",
  textEffectIntensity: 1,
};

export const toRenderModePresetStyle = (
  style: RenderTextStyle,
  outlineEnabled: boolean = style.outlineWidth > 0,
): RenderModeStylePreset => ({
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  bold: style.bold,
  italic: style.italic,
  color: style.color,
  outlineColor: style.outlineColor,
  outlineWidth: style.outlineWidth,
  outlineEnabled,
  uppercase: style.uppercase,
  detectGradient: style.detectGradient,
});

export const resolveRenderModePresetFormData = (
  mode: RenderModePresetMode,
  state: RenderModePresetStateV1,
): RenderModePresetFormData => {
  const resolvedStyle = getRenderModePresetStyle(mode, RENDER_MODE_EDITOR_BASE_STYLE, mode, state.presets);
  const persistedPreset = state.presets[mode];
  return {
    mode,
    style: toRenderModePresetStyle(
      resolvedStyle,
      persistedPreset?.outlineEnabled ?? (resolvedStyle.outlineWidth > 0),
    ),
  };
};

export const createEmptyTypographyPresetFormData = (): TypographyPresetFormData => ({
  presetId: null,
  folderId: null,
  name: "",
  description: "",
  defaultShapeKind: "rounded",
  padding: 10,
  style: { ...RENDER_MODE_EDITOR_BASE_STYLE },
});

/* ─── Utilities ─────────────────────────────────────────── */
export const normalizeLanguageCode = (value: string): string => value.trim().toLowerCase();

export const shortId = (v?: string): string => {
  if (!v) return "—";
  return v.length <= 12 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
};

export const maskEmail = (v?: string): string => {
  if (!v?.includes("@")) return "—";
  const [local, domain] = v.split("@");
  if (!local || !domain) return "—";
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
};

export const getFallbackStageSelection = (options: AioStageOptionMap): AioStageSelection => ({
  detectText: options.detectText[0]?.key ?? "",
  recognizeText: options.recognizeText[0]?.key ?? "",
  getTranslations: options.getTranslations[0]?.key ?? "",
  segmentText: options.segmentText[0]?.key ?? "",
  cleanImage: options.cleanImage[0]?.key ?? "",
});

export const sanitizeStageSelection = (
  selection: AioStageSelection,
  options: AioStageOptionMap,
): AioStageSelection => {
  const fallback = getFallbackStageSelection(options);
  return {
    detectText: options.detectText.some((item) => item.key === selection.detectText)
      ? selection.detectText
      : fallback.detectText,
    recognizeText: options.recognizeText.some((item) => item.key === selection.recognizeText)
      ? selection.recognizeText
      : fallback.recognizeText,
    getTranslations: options.getTranslations.some((item) => item.key === selection.getTranslations)
      ? selection.getTranslations
      : fallback.getTranslations,
    segmentText: options.segmentText.some((item) => item.key === selection.segmentText)
      ? selection.segmentText
      : fallback.segmentText,
    cleanImage: options.cleanImage.some((item) => item.key === selection.cleanImage)
      ? selection.cleanImage
      : fallback.cleanImage,
  };
};

export const createPresetForm = (
  sourceLanguage: string,
  stageModels: AioStageSelection,
): PresetFormData => ({
  presetId: null,
  sourceLanguage: normalizeLanguageCode(sourceLanguage),
  stageModels,
  description: "",
  name: "",
  setAsActive: true,
});

type UpdaterStatusConfig = { labelKey: string; color: string; dot: string };

export const statusCfg = (s: string): UpdaterStatusConfig => {
  const fallback: UpdaterStatusConfig = {
    labelKey: "settings.app.updater.status.error",
    color: "#fda4af",
    dot: "#f43f5e",
  };
  const map: Record<string, UpdaterStatusConfig> = {
    idle: { labelKey: "settings.app.updater.status.idle", color: "var(--auth-text-muted)", dot: "rgba(186,199,247,0.35)" },
    checking: { labelKey: "settings.app.updater.status.checking", color: "#67e8f9", dot: "#06b6d4" },
    available: { labelKey: "settings.app.updater.status.available", color: "#c084fc", dot: "#a855f7" },
    "not-available": { labelKey: "settings.app.updater.status.notAvailable", color: "#86efac", dot: "#10b981" },
    downloading: { labelKey: "settings.app.updater.status.downloading", color: "#67e8f9", dot: "#06b6d4" },
    downloaded: { labelKey: "settings.app.updater.status.downloaded", color: "#86efac", dot: "#10b981" },
    error: fallback,
  };
  return map[s] ?? fallback;
};

export const formatRuntimeProfileLabel = (profile: string): string => {
  switch (profile) {
    case "nvidia-cuda":
      return "NVIDIA CUDA";
    case "nvidia-cuda-legacy":
      return "NVIDIA CUDA Legacy";
    case "nvidia-tensorrt":
      return "NVIDIA TensorRT";
    case "intel-openvino":
      return "Intel OpenVINO";
    case "apple-mps":
      return "Apple MPS";
    case "amd-rocm":
      return "AMD ROCm";
    case "cpu":
    default:
      return "CPU";
  }
};
