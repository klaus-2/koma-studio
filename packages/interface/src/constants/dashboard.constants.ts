import {
  Eye,
  Eraser,
  Languages,
  Paintbrush,
  Replace,
  ScanText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TranslationKey } from "../i18n/messages";
import { translateMessage } from "../i18n/messages";
import { DEFAULT_APP_LOCALE } from "../i18n/config";

import type {
  AioPipelineSnapshotKey,
  EnhanceProfile,
  ImageFilters,
  ToolMode,
} from "../types/dashboard.types";
import type { AioStageKey } from "../types/aioModelPresets";
import type { RenderTextStyle } from "../utils/renderText";

type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number | null | undefined>) => string;

export const ENHANCE_PROFILE_LABEL_KEYS: Record<EnhanceProfile, TranslationKey> = {
  manga_scan: "dashboard.enhance.profile.mangaScan",
  anime_art: "dashboard.enhance.profile.animeArt",
  general: "dashboard.enhance.profile.general",
  high_quality_4x: "dashboard.enhance.profile.highQuality4x",
};

export const getEnhanceProfileLabels = (t: TranslateFn): Record<EnhanceProfile, string> => ({
  manga_scan: t(ENHANCE_PROFILE_LABEL_KEYS.manga_scan),
  anime_art: t(ENHANCE_PROFILE_LABEL_KEYS.anime_art),
  general: t(ENHANCE_PROFILE_LABEL_KEYS.general),
  high_quality_4x: t(ENHANCE_PROFILE_LABEL_KEYS.high_quality_4x),
});


export const ENHANCE_OUTPUT_FORMATS = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
] as const;

export const ZOOM_MIN = 0.1;

export const ZOOM_MAX = 5;

export const ZOOM_STEP = 0.1;

export const DIRECT_IMAGE_UPLOAD_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export const CONTAINER_UPLOAD_EXTENSIONS = new Set([".zip", ".cbz", ".cb7", ".pdf", ".psd"]);

export const DASHBOARD_UPLOAD_ACCEPT: Record<string, string[]> = {
  "image/*": [".png", ".jpg", ".jpeg", ".webp"],
  "application/zip": [".zip", ".cbz"],
  "application/vnd.comicbook+zip": [".cbz"],
  "application/x-7z-compressed": [".cb7"],
  "application/pdf": [".pdf"],
  "image/vnd.adobe.photoshop": [".psd"],
};

export const TOOLS_PANEL_COMPACT_BREAKPOINT = 1100;

export const LEFT_SIDEBAR_MIN_WIDTH = 240;

export const LEFT_SIDEBAR_MAX_WIDTH = 420;

export const LEFT_SIDEBAR_DEFAULT_WIDTH = 280;

export const RIGHT_SIDEBAR_MIN_WIDTH = 280;

export const RIGHT_SIDEBAR_MAX_WIDTH = 460;

export const RIGHT_SIDEBAR_DEFAULT_WIDTH = 310;

export const SIDEBAR_RESIZE_STEP = 16;

export const EMPTY_PREVIEW_TIP_ROTATION_MS = 15_000;

export const SETTINGS_REQUESTED_TAB_STORAGE_KEY = "koma-settings-requested-tab";

export const EMPTY_PREVIEW_TIP_KEYS = [
  "dashboard.emptyTip.1",
  "dashboard.emptyTip.2",
  "dashboard.emptyTip.3",
  "dashboard.emptyTip.4",
  "dashboard.emptyTip.5",
  "dashboard.emptyTip.6",
  "dashboard.emptyTip.7",
  "dashboard.emptyTip.8",
  "dashboard.emptyTip.9",
  "dashboard.emptyTip.10",
  "dashboard.emptyTip.11",
  "dashboard.emptyTip.12",
  "dashboard.emptyTip.13",
  "dashboard.emptyTip.14",
  "dashboard.emptyTip.15",
] as const;

export const getEmptyPreviewTips = (t: TranslateFn): string[] =>
  EMPTY_PREVIEW_TIP_KEYS.map((key) => t(key as TranslationKey));


export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1.0 },
  grayscale: false,
  inverted: false,
};

export const TRANSLATION_NOTE_REGION_PREFIX = "koma-note::";

export const AIO_PRESET_STAGE_KEYS: AioStageKey[] = [
  "detectText",
  "recognizeText",
  "getTranslations",
  "segmentText",
  "cleanImage",
];

export const AIO_STAGE_LABEL_KEYS: Record<AioStageKey, TranslationKey> = {
  detectText: "aio.stage.detectText",
  recognizeText: "aio.stage.recognizeText",
  getTranslations: "aio.stage.getTranslations",
  segmentText: "aio.stage.segmentText",
  cleanImage: "aio.stage.cleanImage",
};

export const getAioStageLabels = (t: TranslateFn): Record<AioStageKey, string> => ({
  detectText: t(AIO_STAGE_LABEL_KEYS.detectText),
  recognizeText: t(AIO_STAGE_LABEL_KEYS.recognizeText),
  getTranslations: t(AIO_STAGE_LABEL_KEYS.getTranslations),
  segmentText: t(AIO_STAGE_LABEL_KEYS.segmentText),
  cleanImage: t(AIO_STAGE_LABEL_KEYS.cleanImage),
});

export const AIO_STAGE_LABELS: Record<AioStageKey, string> = getAioStageLabels((key, vars) =>
  translateMessage(DEFAULT_APP_LOCALE, key, vars),
);

export const AIO_STAGE_BADGE_LABELS: Record<AioPipelineSnapshotKey, string> = {
  detectText: "DETECT",
  recognizeText: "OCR",
  getTranslations: "TRANSLATE",
  segmentText: "SEGMENT",
  cleanImage: "CLEAN",
  render: "RENDER",
};

export const AIO_MANUAL_STAGE_ORDER: AioPipelineSnapshotKey[] = [
  "detectText",
  "recognizeText",
  "getTranslations",
  "segmentText",
  "cleanImage",
  "render",
];

export const getAioPipelineStageLabels = (t: TranslateFn): Record<AioPipelineSnapshotKey, string> => ({
  ...getAioStageLabels(t),
  render: t("aio.pipeline.render"),
});

export const AIO_PIPELINE_STAGE_LABELS: Record<AioPipelineSnapshotKey, string> =
  getAioPipelineStageLabels((key, vars) => translateMessage(DEFAULT_APP_LOCALE, key, vars));

export const getAioPipelineStageProgressLabels = (t: TranslateFn): Record<AioPipelineSnapshotKey, string> => ({
  detectText: t("dashboard.aio.progress.detectText"),
  recognizeText: t("dashboard.aio.progress.recognizeText"),
  getTranslations: t("dashboard.aio.progress.getTranslations"),
  segmentText: t("dashboard.aio.progress.segmentText"),
  cleanImage: t("dashboard.aio.progress.cleanImage"),
  render: t("dashboard.aio.progress.render"),
});


export const AIO_PIPELINE_STAGE_ICONS: Record<AioPipelineSnapshotKey, LucideIcon> = {
  detectText: ScanText,
  recognizeText: Eye,
  getTranslations: Languages,
  segmentText: Replace,
  cleanImage: Eraser,
  render: Paintbrush,
};

export const DEFAULT_RENDER_STYLE: RenderTextStyle = {
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
  shadowOpacity: 1,
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
  textEffectPreset: "none",
  textEffectIntensity: 1,
};

export const UNDER_DEVELOPMENT_MODES: ToolMode[] = [];

export const UNDER_DEVELOPMENT_TOOLTIP_KEY: TranslationKey = "dashboard.mode.underDevelopment";


export const MODES_WITH_SUBMODE: ToolMode[] = ["aio", "typesetter"];

export const INFO_MODES: ToolMode[] = ["guides", "resources"];

export const MODE_LABEL_KEYS: Record<ToolMode, TranslationKey> = {
  organize: "dashboard.mode.organize",
  aio: "dashboard.mode.aio",
  cleaner: "dashboard.mode.cleaner",
  typesetter: "dashboard.mode.typesetter",
  translator: "dashboard.mode.translator",
  raw: "dashboard.mode.raw",
  proofreader: "dashboard.mode.proofreader",
  stitch: "dashboard.mode.stitch",
  split: "dashboard.mode.split",
  watermark: "dashboard.mode.watermark",
  enhance: "dashboard.mode.enhance",
  optimizer: "dashboard.mode.optimizer",
  blogger: "dashboard.mode.blogger",
  imgur: "dashboard.mode.imgur",
  guides: "dashboard.mode.guides",
  resources: "dashboard.mode.resources",
};

export const getModeLabels = (t: TranslateFn): Record<ToolMode, string> => ({
  organize: t(MODE_LABEL_KEYS.organize),
  aio: t(MODE_LABEL_KEYS.aio),
  cleaner: t(MODE_LABEL_KEYS.cleaner),
  typesetter: t(MODE_LABEL_KEYS.typesetter),
  translator: t(MODE_LABEL_KEYS.translator),
  raw: t(MODE_LABEL_KEYS.raw),
  proofreader: t(MODE_LABEL_KEYS.proofreader),
  stitch: t(MODE_LABEL_KEYS.stitch),
  split: t(MODE_LABEL_KEYS.split),
  watermark: t(MODE_LABEL_KEYS.watermark),
  enhance: t(MODE_LABEL_KEYS.enhance),
  optimizer: t(MODE_LABEL_KEYS.optimizer),
  blogger: t(MODE_LABEL_KEYS.blogger),
  imgur: t(MODE_LABEL_KEYS.imgur),
  guides: t(MODE_LABEL_KEYS.guides),
  resources: t(MODE_LABEL_KEYS.resources),
});

export const MODE_LABELS: Record<ToolMode, string> = getModeLabels((key, vars) =>
  translateMessage(DEFAULT_APP_LOCALE, key, vars),
);


export const DEFAULT_RENDER_FONT_FAMILIES = [
  "CC Wild Words",
  "Anime Ace",
  "Manga Temple",
  "Back Issues",
  "Arial",
  "Segoe UI",
  "Times New Roman",
];


export const MIN_REGION_SIZE = 8;

export const EMPTY_AIO_MANUAL_EDIT_STATE = {
  paintLayerDataUrl: null,
  baseImageDataUrl: null,
  wandMaskDataUrl: null,
  segmentBrushDataUrl: null,
} as const;

export const MAGIC_WAND_MAX_PIXELS = 12_000_000;

export const isModeUnderDevelopment = (mode: ToolMode): boolean =>
  UNDER_DEVELOPMENT_MODES.includes(mode);
