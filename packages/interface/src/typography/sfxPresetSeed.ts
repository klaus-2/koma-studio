import { DEFAULT_RENDER_STYLE } from "../constants/dashboard.constants";
import {
  getNativeTextEffectPreset,
  type NativeTextEffectPresetId,
} from "./textEffects";
import type { RenderTextStyle } from "./renderStyle";
import type {
  TypographyPresetStateV1,
  TypographyStylePreset,
} from "./types";

export const SFX_SEED_ID_PREFIX = "typo-preset-sfx-";

export const SFX_SEED_EFFECT_IDS: readonly NativeTextEffectPresetId[] = [
  "blam_impact",
  "thump_heavy",
  "boom_comic",
  "bang_chunk",
  "scream_scratch",
  "growl_moss",
  "eheheh_whisper",
  "yawn_soft",
  "tremble_brush",
  "shake_blur",
];

const SEED_TIMESTAMP = 0;
const SEED_PADDING = 10;

const toSeedName = (effectId: string): string => {
  const words = effectId.split("_").filter(Boolean);
  const label = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `SFX · ${label}`;
};

const buildSfxSeedPreset = (effectId: NativeTextEffectPresetId): TypographyStylePreset => {
  const effect = getNativeTextEffectPreset(effectId);
  const patch = effect.recommendedPatch ?? {};
  const style: RenderTextStyle = {
    ...DEFAULT_RENDER_STYLE,
    ...patch,
    textEffectPreset: effect.id,
    textEffectIntensity: 1,
    ...(effect.shadowLayers
      ? { shadowLayers: effect.shadowLayers.map((layer) => ({ ...layer })) }
      : {}),
  };
  return {
    id: `${SFX_SEED_ID_PREFIX}${effect.id}`,
    folderId: null,
    name: toSeedName(effect.id),
    description: "",
    style,
    defaultShapeKind: "square",
    padding: SEED_PADDING,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
};

const SFX_SEED_PRESETS: readonly TypographyStylePreset[] =
  SFX_SEED_EFFECT_IDS.map(buildSfxSeedPreset);
const SFX_SEED_IDS: ReadonlySet<string> = new Set(
  SFX_SEED_PRESETS.map((preset) => preset.id),
);

export const seedSfxPresets = (
  state: TypographyPresetStateV1,
): TypographyPresetStateV1 => {
  if (!state || typeof state !== "object" || !Array.isArray(state.presets)) return state;
  if (state.presets.some((preset) => SFX_SEED_IDS.has(preset.id))) return state;
  return { ...state, presets: [...state.presets, ...SFX_SEED_PRESETS] };
};
