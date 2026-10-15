import type { RenderTextStyle } from "@/typography/renderStyle";
import {
  loadRenderModePresetState,
} from "@/utils/renderModePresets";
import type {
  RenderModePresetMode,
  RenderModeStylePreset,
} from "@/utils/renderModePresets";

export type DetectedRenderTextMode = RenderModePresetMode;
export type RenderTextMode = "auto" | DetectedRenderTextMode;

export interface RenderModeRegionLike {
  readonly renderMode?: RenderTextMode;
  readonly detectedRenderMode?: DetectedRenderTextMode;
}

export const RENDER_TEXT_MODE_LABELS = Object.freeze({
  auto: "AUTO",
  text_bubble: "Bubble Text",
  text_free: "Free Text",
  text_sfx: "Sound Effect",
  text_narration: "Narration",
  text_inside_black_bubble: "Inside Black Bubble",
} satisfies Record<RenderTextMode, string>);

const aliases: ReadonlyMap<string, DetectedRenderTextMode> = new Map([
  ["text_bubble", "text_bubble"],
  ["bubble", "text_bubble"],
  ["text_free", "text_free"],
  ["free", "text_free"],
  ["text_sfx", "text_sfx"],
  ["sound_effect", "text_sfx"],
  ["sound-effect", "text_sfx"],
  ["sfx", "text_sfx"],
  ["text_narration", "text_narration"],
  ["narration", "text_narration"],
  ["text_inside_black_bubble", "text_inside_black_bubble"],
  ["inside_black_bubble", "text_inside_black_bubble"],
  ["inside-black-bubble", "text_inside_black_bubble"],
]);

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const buildDefaultModePatch = (
  mode: DetectedRenderTextMode,
  style: RenderTextStyle,
): Partial<RenderTextStyle> => {
  const outlineWidth = Math.max(0, finiteOr(style.outlineWidth, 0));

  switch (mode) {
    case "text_free":
      return {
        color: "#0f172a",
        outlineColor: "#ffffff",
        outlineWidth: 1.5,
        uppercase: false,
      };

    case "text_sfx":
      return {
        fontSize: Math.max(finiteOr(style.fontSize, 52), 52),
        minFontSize: Math.max(finiteOr(style.minFontSize, 12), 12),
        bold: true,
        outlineWidth: Math.max(outlineWidth, 3.5),
        uppercase: false,
      };

    case "text_narration":
      return {
        fontFamily: "Times New Roman",
        alignment: "left",
        italic: true,
        outlineWidth: Math.max(1, outlineWidth * 0.75),
        uppercase: false,
      };

    case "text_inside_black_bubble":
      return {
        color: "#ffffff",
        outlineColor: "#111111",
        outlineWidth: Math.max(outlineWidth, 2.5),
        uppercase: false,
      };

    case "text_bubble":
      return {
        color: "#111111",
        outlineColor: "#ffffff",
        outlineWidth: Math.max(outlineWidth, 2),
        alignment: "center",
        bold: false,
        italic: false,
        uppercase: false,
      };
  }
};

export const normalizeDetectedRenderMode = (
  value: string | null | undefined,
): DetectedRenderTextMode | undefined =>
  value ? aliases.get(value.trim().toLowerCase()) : undefined;

export const resolveRenderTextMode = (
  region: RenderModeRegionLike,
): DetectedRenderTextMode =>
  normalizeDetectedRenderMode(region.renderMode) ??
  normalizeDetectedRenderMode(region.detectedRenderMode) ??
  "text_bubble";

export const getRenderModePresetStyle = (
  renderMode: RenderTextMode,
  baseStyle: RenderTextStyle,
  detectedRenderMode?: DetectedRenderTextMode,
  modePresetOverrides?: Readonly<
    Partial<Record<DetectedRenderTextMode, RenderModeStylePreset>>
  >,
): RenderTextStyle => {
  const mode =
    normalizeDetectedRenderMode(renderMode) ??
    normalizeDetectedRenderMode(detectedRenderMode) ??
    "text_bubble";
  const defaults = {
    ...baseStyle,
    ...buildDefaultModePatch(mode, baseStyle),
  };
  const overrides =
    modePresetOverrides ?? loadRenderModePresetState().presets;
  const override = overrides[mode];

  if (!override) return structuredClone(defaults);

  const { outlineEnabled, ...patch } = override;

  return structuredClone({
    ...defaults,
    ...patch,
    ...(outlineEnabled === false ? { outlineWidth: 0 } : {}),
  });
};
