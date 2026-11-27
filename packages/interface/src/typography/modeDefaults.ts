import type { RenderTextStyle } from "./renderStyle";
import type { TypographyPresetStateV1, TypographyStylePreset } from "./types";
import { getRenderModePresetStyle } from "../utils/renderModes";
import {
  RENDER_MODE_PRESET_MODES,
  type RenderModePresetMode,
  type RenderModeStylePreset,
} from "../utils/renderModePresets";

export const MODE_DEFAULT_PRESET_ID_PREFIX = "typo-preset-mode-";
export const LEGACY_MODE_FOLDER_NAME = "Legacy Mode Presets";
export const LEGACY_SFX_SEED_ID_PREFIX = "typo-preset-sfx-";

export const MODE_DEFAULT_PRESET_NAMES: Readonly<Record<RenderModePresetMode, string>> = {
  text_bubble: "Bubble",
  text_free: "Free",
  text_inside_black_bubble: "Inside Black Bubble",
  text_narration: "Narration",
  text_sfx: "SFX",
};

type ModeStyleOverrides = Readonly<Partial<Record<RenderModePresetMode, RenderModeStylePreset>>>;

export const modeDefaultPresetId = (mode: RenderModePresetMode): string =>
  `${MODE_DEFAULT_PRESET_ID_PREFIX}${mode}`;

const legacyPresetName = (mode: RenderModePresetMode): string => `Legacy ${mode}`;

const buildModeDefaultStyle = (
  mode: RenderModePresetMode,
  baseStyle: RenderTextStyle,
  overrides: ModeStyleOverrides,
): RenderTextStyle => {
  const style = getRenderModePresetStyle(mode, baseStyle, mode, overrides);
  return style.gradientEnabled ? style : { ...style, fillCssValue: style.color };
};

export const buildModeDefaultPreset = (
  mode: RenderModePresetMode,
  baseStyle: RenderTextStyle,
  overrides: ModeStyleOverrides = {},
): TypographyStylePreset => ({
  id: modeDefaultPresetId(mode),
  folderId: null,
  name: MODE_DEFAULT_PRESET_NAMES[mode],
  description: "",
  style: buildModeDefaultStyle(mode, baseStyle, overrides),
  defaultShapeKind: mode === "text_bubble" || mode === "text_inside_black_bubble" ? "rounded" : "square",
  padding: 10,
  createdAt: 0,
  updatedAt: 0,
});

const bindAllModes = (): Record<string, string> =>
  Object.fromEntries(RENDER_MODE_PRESET_MODES.map((mode) => [mode, modeDefaultPresetId(mode)]));

export const buildDefaultTypographyPresetState = (
  baseStyle: RenderTextStyle,
  overrides: ModeStyleOverrides = {},
): TypographyPresetStateV1 => ({
  version: 1,
  folders: [],
  presets: RENDER_MODE_PRESET_MODES.map((mode) => buildModeDefaultPreset(mode, baseStyle, overrides)),
  modeBindings: bindAllModes(),
  defaultPresetId: modeDefaultPresetId("text_bubble"),
});

export const resetModeDefaultTransform = (
  state: TypographyPresetStateV1,
  mode: RenderModePresetMode,
): TypographyPresetStateV1 => {
  const id = modeDefaultPresetId(mode);
  let changed = false;
  const presets = state.presets.map((preset) => {
    if (preset.id !== id) return preset;
    const { rotation, skewX, skewY } = preset.style;
    if (!rotation && !skewX && !skewY) return preset;
    changed = true;
    return { ...preset, style: { ...preset.style, rotation: 0, skewX: 0, skewY: 0 } };
  });
  return changed ? { ...state, presets } : state;
};

const isUntouchedSfxSeed = (preset: TypographyStylePreset): boolean =>
  preset.id.startsWith(LEGACY_SFX_SEED_ID_PREFIX) && preset.createdAt === 0 && preset.updatedAt === 0;

const isLegacyModePreset = (preset: TypographyStylePreset): boolean =>
  RENDER_MODE_PRESET_MODES.some((mode) => preset.name === legacyPresetName(mode));

export const needsLegacyModeMigration = (state: TypographyPresetStateV1): boolean =>
  state.folders.some((folder) => folder.name === LEGACY_MODE_FOLDER_NAME)
  || state.presets.some((preset) => isLegacyModePreset(preset) || isUntouchedSfxSeed(preset));

export const migrateLegacyModePresets = (
  state: TypographyPresetStateV1,
  baseStyle: RenderTextStyle,
  overrides: ModeStyleOverrides = {},
): TypographyPresetStateV1 => {
  const legacyFolderIds = new Set(
    state.folders.filter((folder) => folder.name === LEGACY_MODE_FOLDER_NAME).map((folder) => folder.id),
  );
  const renamedIds = new Map<string, string>();
  const removedIds = new Set<string>();
  const claimedIds = new Set(state.presets.map((preset) => preset.id));
  const presets: TypographyStylePreset[] = [];

  for (const preset of state.presets) {
    if (isUntouchedSfxSeed(preset)) {
      removedIds.add(preset.id);
      continue;
    }
    const mode = RENDER_MODE_PRESET_MODES.find((candidate) => preset.name === legacyPresetName(candidate));
    if (mode !== undefined && !claimedIds.has(modeDefaultPresetId(mode))) {
      const id = modeDefaultPresetId(mode);
      claimedIds.add(id);
      renamedIds.set(preset.id, id);
      presets.push({ ...preset, id, folderId: null, name: MODE_DEFAULT_PRESET_NAMES[mode], description: "" });
      continue;
    }
    presets.push(preset.folderId !== null && legacyFolderIds.has(preset.folderId) ? { ...preset, folderId: null } : preset);
  }

  for (const mode of RENDER_MODE_PRESET_MODES) {
    if (!presets.some((preset) => preset.id === modeDefaultPresetId(mode))) {
      presets.push(buildModeDefaultPreset(mode, baseStyle, overrides));
    }
  }

  const presetIds = new Set(presets.map((preset) => preset.id));
  const remap = (id: string | null | undefined): string | null => {
    if (!id || removedIds.has(id)) return null;
    const next = renamedIds.get(id) ?? id;
    return presetIds.has(next) ? next : null;
  };

  const modeBindings: Record<string, string> = {};
  for (const [mode, id] of Object.entries(state.modeBindings)) {
    const next = remap(id);
    if (next !== null) modeBindings[mode] = next;
  }
  for (const mode of RENDER_MODE_PRESET_MODES) {
    modeBindings[mode] ??= modeDefaultPresetId(mode);
  }

  return {
    version: 1,
    folders: state.folders
      .filter((folder) => !legacyFolderIds.has(folder.id))
      .map((folder) => (folder.parentId !== null && legacyFolderIds.has(folder.parentId) ? { ...folder, parentId: null } : folder)),
    presets,
    modeBindings,
    defaultPresetId: remap(state.defaultPresetId) ?? modeDefaultPresetId("text_bubble"),
  };
};
