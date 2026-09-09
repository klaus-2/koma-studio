import type { RenderTextStyle } from "./renderStyle";
import type { RenderTextShadowLayer } from "./renderStyle";
import type {
  TypographyPresetStateV1,
  TypographyStyleFolder,
  TypographyStylePreset,
} from "./types";
import { createDefaultTypographyShape, createTypographyId } from "./types";
import {
  loadRenderModePresetState,
  RENDER_MODE_PRESET_MODES,
  type RenderModePresetMode,
} from "../utils/renderModePresets";
import { DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID, isNativeTextEffectPresetId } from "./textEffects";

export const TYPOGRAPHY_PRESET_STORAGE_KEY = "koma-typography-presets-v1";

const DEFAULT_STYLE: RenderTextStyle = {
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
  hyphenationLanguage: undefined,
  outlineColor: "#ffffff",
  outlineOpacity: 1,
  outlineWidth: 2,
  textEffectPreset: DEFAULT_NATIVE_TEXT_EFFECT_PRESET_ID,
  textEffectIntensity: 1,
};

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeStyle = (value: unknown): RenderTextStyle => {
  const source = isRecord(value) ? value : {};
  const rawShadowLayers = Array.isArray(source.shadowLayers) ? source.shadowLayers : [];
  const shadowLayers: RenderTextShadowLayer[] = rawShadowLayers
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      fillCssValue: String(entry.fillCssValue ?? entry.color ?? "#000000").trim() || "#000000",
      opacity: Number.isFinite(Number(entry.opacity)) ? Math.max(0, Math.min(1, Number(entry.opacity))) : 1,
      blur: Number.isFinite(Number(entry.blur)) ? Math.max(0, Number(entry.blur)) : 0,
      offsetX: Number.isFinite(Number(entry.offsetX)) ? Number(entry.offsetX) : 0,
      offsetY: Number.isFinite(Number(entry.offsetY)) ? Number(entry.offsetY) : 0,
    }));
  return {
    ...DEFAULT_STYLE,
    ...source,
    fontFamily: String(source.fontFamily ?? DEFAULT_STYLE.fontFamily),
    fontSize: Math.max(6, Math.round(Number(source.fontSize ?? DEFAULT_STYLE.fontSize))),
    minFontSize: Math.max(6, Math.round(Number(source.minFontSize ?? DEFAULT_STYLE.minFontSize))),
    autoFontSize: source.autoFontSize !== false,
    lineSpacing: Number.isFinite(Number(source.lineSpacing)) ? Number(source.lineSpacing) : DEFAULT_STYLE.lineSpacing,
    textOrientation: source.textOrientation === "vertical" ? "vertical" : "horizontal",
    textPathMode: source.textPathMode === "circular" ? "circular" : "normal",
    circularRadiusScale: Number.isFinite(Number(source.circularRadiusScale)) ? Number(source.circularRadiusScale) : DEFAULT_STYLE.circularRadiusScale,
    circularStartAngle: Number.isFinite(Number(source.circularStartAngle)) ? Number(source.circularStartAngle) : DEFAULT_STYLE.circularStartAngle,
    circularLetterSpacing: Number.isFinite(Number(source.circularLetterSpacing)) ? Number(source.circularLetterSpacing) : DEFAULT_STYLE.circularLetterSpacing,
    rotation: Number.isFinite(Number(source.rotation)) ? Number(source.rotation) : 0,
    skewX: Number.isFinite(Number(source.skewX)) ? Number(source.skewX) : DEFAULT_STYLE.skewX,
    skewY: Number.isFinite(Number(source.skewY)) ? Number(source.skewY) : DEFAULT_STYLE.skewY,
    alignment: source.alignment === "left" || source.alignment === "right" ? source.alignment : "center",
    bold: Boolean(source.bold),
    italic: Boolean(source.italic),
    uppercase: Boolean(source.uppercase),
    underline: Boolean(source.underline),
    opacity: Number.isFinite(Number(source.opacity)) ? Number(source.opacity) : 1,
    shadowEnabled: Boolean(source.shadowEnabled),
    shadowColor: String(source.shadowColor ?? DEFAULT_STYLE.shadowColor),
    shadowFillCssValue: source.shadowFillCssValue ? String(source.shadowFillCssValue).trim() : String(source.shadowColor ?? DEFAULT_STYLE.shadowColor),
    shadowGradientEnabled: Boolean(source.shadowGradientEnabled),
    shadowGradientStartColor: String(source.shadowGradientStartColor ?? source.shadowColor ?? DEFAULT_STYLE.shadowGradientStartColor),
    shadowGradientEndColor: String(source.shadowGradientEndColor ?? source.shadowColor ?? DEFAULT_STYLE.shadowGradientEndColor),
    shadowGradientAngle: Number.isFinite(Number(source.shadowGradientAngle)) ? Number(source.shadowGradientAngle) : DEFAULT_STYLE.shadowGradientAngle,
    shadowOpacity: Number.isFinite(Number(source.shadowOpacity)) ? Number(source.shadowOpacity) : DEFAULT_STYLE.shadowOpacity,
    shadowBlur: Number.isFinite(Number(source.shadowBlur)) ? Number(source.shadowBlur) : 0,
    shadowOffsetX: Number.isFinite(Number(source.shadowOffsetX)) ? Number(source.shadowOffsetX) : 0,
    shadowOffsetY: Number.isFinite(Number(source.shadowOffsetY)) ? Number(source.shadowOffsetY) : 0,
    shadowLayers: shadowLayers.length > 0 ? shadowLayers : undefined,
    color: String(source.color ?? DEFAULT_STYLE.color),
    fillCssValue: source.fillCssValue ? String(source.fillCssValue).trim() : String(source.color ?? DEFAULT_STYLE.color),
    gradientEnabled: Boolean(source.gradientEnabled),
    gradientStartColor: String(source.gradientStartColor ?? source.color ?? DEFAULT_STYLE.gradientStartColor),
    gradientEndColor: String(source.gradientEndColor ?? source.color ?? DEFAULT_STYLE.gradientEndColor),
    gradientAngle: Number.isFinite(Number(source.gradientAngle)) ? Number(source.gradientAngle) : DEFAULT_STYLE.gradientAngle,
    detectGradient: source.detectGradient === undefined ? DEFAULT_STYLE.detectGradient : Boolean(source.detectGradient),
    hyphenationEnabled: source.hyphenationEnabled === undefined ? DEFAULT_STYLE.hyphenationEnabled : Boolean(source.hyphenationEnabled),
    hyphenationLanguage: source.hyphenationLanguage ? String(source.hyphenationLanguage).trim().toLowerCase() : undefined,
    outlineColor: String(source.outlineColor ?? DEFAULT_STYLE.outlineColor),
    outlineOpacity: Number.isFinite(Number(source.outlineOpacity)) ? Number(source.outlineOpacity) : DEFAULT_STYLE.outlineOpacity,
    outlineWidth: Number.isFinite(Number(source.outlineWidth)) ? Number(source.outlineWidth) : DEFAULT_STYLE.outlineWidth,
    textEffectPreset: isNativeTextEffectPresetId(source.textEffectPreset) ? source.textEffectPreset : DEFAULT_STYLE.textEffectPreset,
    textEffectIntensity: Number.isFinite(Number(source.textEffectIntensity)) ? Number(source.textEffectIntensity) : DEFAULT_STYLE.textEffectIntensity,
  };
};

const sanitizeFolder = (value: unknown, index: number): TypographyStyleFolder | null => {
  if (!isRecord(value)) return null;
  const name = String(value.name ?? "").trim();
  if (!name) return null;
  const now = Date.now();
  return {
    id: String(value.id ?? createTypographyId("typo-folder")),
    name,
    parentId: value.parentId ? String(value.parentId) : null,
    order: Number.isFinite(Number(value.order)) ? Number(value.order) : index,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : now,
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : now,
  };
};

const sanitizePreset = (value: unknown): TypographyStylePreset | null => {
  if (!isRecord(value)) return null;
  const name = String(value.name ?? "").trim();
  if (!name) return null;
  const now = Date.now();
  return {
    id: String(value.id ?? createTypographyId("typo-preset")),
    folderId: value.folderId ? String(value.folderId) : null,
    name,
    description: String(value.description ?? "").trim(),
    style: sanitizeStyle(value.style),
    defaultShapeKind: value.defaultShapeKind === "rounded" ? "rounded" : "square",
    padding: Number.isFinite(Number(value.padding)) ? Math.max(0, Number(value.padding)) : 10,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : now,
    updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : now,
  };
};

const buildLegacyPresetState = (): TypographyPresetStateV1 => {
  const renderModePresetState = loadRenderModePresetState();
  const now = Date.now();
  const legacyFolderId = createTypographyId("typo-folder");
  const presets: TypographyStylePreset[] = [];
  const modeBindings: Record<string, string> = {};

  RENDER_MODE_PRESET_MODES.forEach((mode, index) => {
    const override = renderModePresetState.presets[mode];
    const style: RenderTextStyle = {
      ...DEFAULT_STYLE,
      ...(override ? {
        fontFamily: override.fontFamily,
        fontSize: override.fontSize,
        bold: override.bold,
        italic: override.italic,
        color: override.color,
        detectGradient: override.detectGradient,
        outlineColor: override.outlineColor,
        outlineWidth: override.outlineEnabled === false ? 0 : override.outlineWidth,
        uppercase: override.uppercase,
      } : {}),
    };
    const presetId = createTypographyId(`legacy-${mode}`);
    presets.push({
      id: presetId,
      folderId: legacyFolderId,
      name: `Legacy ${mode}`,
      description: "Migrado automaticamente dos presets legados de render mode.",
      style,
      defaultShapeKind: mode === "text_bubble" || mode === "text_inside_black_bubble" ? "rounded" : "square",
      padding: 10,
      createdAt: now + index,
      updatedAt: now + index,
    });
    modeBindings[mode] = presetId;
  });

  return {
    version: 1,
    folders: [
      {
        id: legacyFolderId,
        name: "Legacy Mode Presets",
        parentId: null,
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    presets,
    modeBindings,
    defaultPresetId: presets[0]?.id ?? null,
  };
};

const sanitizeState = (value: unknown): TypographyPresetStateV1 => {
  if (!isRecord(value) || Number(value.version) !== 1) {
    return buildLegacyPresetState();
  }

  const folders = Array.isArray(value.folders)
    ? value.folders.map((item, index) => sanitizeFolder(item, index)).filter((item): item is TypographyStyleFolder => Boolean(item))
    : [];
  const presets = Array.isArray(value.presets)
    ? value.presets.map((item) => sanitizePreset(item)).filter((item): item is TypographyStylePreset => Boolean(item))
    : [];
  const presetIds = new Set(presets.map((preset) => preset.id));
  const modeBindings = isRecord(value.modeBindings)
    ? Object.entries(value.modeBindings).reduce<Record<string, string>>((acc, [mode, presetId]) => {
      const normalizedPresetId = String(presetId ?? "").trim();
      if (normalizedPresetId && presetIds.has(normalizedPresetId)) {
        acc[mode] = normalizedPresetId;
      }
      return acc;
    }, {})
    : {};
  return {
    version: 1,
    folders,
    presets,
    modeBindings,
    defaultPresetId: value.defaultPresetId && presetIds.has(String(value.defaultPresetId))
      ? String(value.defaultPresetId)
      : (presets[0]?.id ?? null),
  };
};

const persistState = (state: TypographyPresetStateV1): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TYPOGRAPHY_PRESET_STORAGE_KEY, JSON.stringify(state));
};

export const loadTypographyPresetState = (): TypographyPresetStateV1 => {
  if (typeof window === "undefined") return buildLegacyPresetState();
  return sanitizeState(parseJson(window.localStorage.getItem(TYPOGRAPHY_PRESET_STORAGE_KEY), buildLegacyPresetState()));
};

export const saveTypographyPresetState = (state: TypographyPresetStateV1): TypographyPresetStateV1 => {
  const sanitized = sanitizeState(state);
  persistState(sanitized);
  return sanitized;
};



export const getTypographyPresetById = (
  presetId: string | null | undefined,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyStylePreset | null => {
  const normalizedId = String(presetId ?? "").trim();
  if (!normalizedId) return null;
  return state.presets.find((preset) => preset.id === normalizedId) ?? null;
};

export const createTypographyFolder = (
  name: string,
  parentId: string | null,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyPresetStateV1 => {
  const now = Date.now();
  const siblingCount = state.folders.filter((folder) => folder.parentId === parentId).length;
  return saveTypographyPresetState({
    ...state,
    folders: [...state.folders, {
      id: createTypographyId("typo-folder"),
      name: name.trim() || "Folder",
      parentId,
      order: siblingCount,
      createdAt: now,
      updatedAt: now,
    }],
  });
};

export const renameTypographyFolder = (
  folderId: string,
  newName: string,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyPresetStateV1 => {
  const trimmed = newName.trim();
  if (!trimmed) return state;
  return saveTypographyPresetState({
    ...state,
    folders: state.folders.map((folder) =>
      folder.id !== folderId ? folder : { ...folder, name: trimmed, updatedAt: Date.now() },
    ),
  });
};

const collectDescendantFolderIds = (folderId: string, folders: TypographyStyleFolder[]): Set<string> => {
  const result = new Set<string>([folderId]);
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const folder of folders) {
      if (folder.parentId === current) {
        result.add(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return result;
};

export const deleteTypographyFolder = (
  folderId: string,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyPresetStateV1 => {
  const idsToRemove = collectDescendantFolderIds(folderId, state.folders);
  const nextFolders = state.folders.filter((folder) => !idsToRemove.has(folder.id));
  // Move presets that belonged to any removed folder to no folder
  const nextPresets = state.presets.map((preset) =>
    preset.folderId && idsToRemove.has(preset.folderId)
      ? { ...preset, folderId: null, updatedAt: Date.now() }
      : preset,
  );
  return saveTypographyPresetState({ ...state, folders: nextFolders, presets: nextPresets });
};

export const createTypographyPreset = (
  input: Partial<TypographyStylePreset> & { name: string },
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): { state: TypographyPresetStateV1; preset: TypographyStylePreset } => {
  const now = Date.now();
  const preset: TypographyStylePreset = {
    id: createTypographyId("typo-preset"),
    folderId: input.folderId ?? null,
    name: input.name.trim() || "Preset",
    description: input.description?.trim() ?? "",
    style: sanitizeStyle(input.style),
    defaultShapeKind: input.defaultShapeKind === "rounded" ? "rounded" : "square",
    padding: Number.isFinite(Number(input.padding)) ? Math.max(0, Number(input.padding)) : 10,
    createdAt: now,
    updatedAt: now,
  };
  const nextState = saveTypographyPresetState({
    ...state,
    presets: [...state.presets, preset].sort((left, right) => left.name.localeCompare(right.name)),
    defaultPresetId: state.defaultPresetId ?? preset.id,
  });
  return { state: nextState, preset };
};

export const updateTypographyPreset = (
  presetId: string,
  patch: Partial<TypographyStylePreset>,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): { state: TypographyPresetStateV1; preset: TypographyStylePreset | null } => {
  let updatedPreset: TypographyStylePreset | null = null;
  const nextPresets = state.presets.map((preset) => {
    if (preset.id !== presetId) return preset;
    updatedPreset = {
      ...preset,
      folderId: patch.folderId === undefined ? preset.folderId : patch.folderId,
      name: patch.name?.trim() ? patch.name.trim() : preset.name,
      description: patch.description === undefined ? preset.description : patch.description.trim(),
      style: patch.style ? sanitizeStyle({ ...preset.style, ...patch.style }) : preset.style,
      defaultShapeKind: patch.defaultShapeKind === undefined ? preset.defaultShapeKind : patch.defaultShapeKind,
      padding: patch.padding === undefined ? preset.padding : Math.max(0, Number(patch.padding) || 0),
      updatedAt: Date.now(),
    };
    return updatedPreset;
  });
  if (!updatedPreset) return { state, preset: null };
  return {
    state: saveTypographyPresetState({
      ...state,
      presets: nextPresets.sort((left, right) => left.name.localeCompare(right.name)),
    }),
    preset: updatedPreset,
  };
};

export const deleteTypographyPreset = (
  presetId: string,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyPresetStateV1 => {
  const nextPresets = state.presets.filter((preset) => preset.id !== presetId);
  const nextBindings = Object.entries(state.modeBindings).reduce<Record<string, string>>((acc, [mode, id]) => {
    if (id !== presetId) acc[mode] = id;
    return acc;
  }, {});
  return saveTypographyPresetState({
    ...state,
    presets: nextPresets,
    modeBindings: nextBindings,
    defaultPresetId: state.defaultPresetId === presetId ? (nextPresets[0]?.id ?? null) : state.defaultPresetId,
  });
};

export const duplicateTypographyPreset = (
  presetId: string,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): { state: TypographyPresetStateV1; preset: TypographyStylePreset | null } => {
  const preset = getTypographyPresetById(presetId, state);
  if (!preset) return { state, preset: null };
  return createTypographyPreset({
    ...preset,
    name: `${preset.name} copy`,
  }, state);
};

export const bindTypographyPresetToMode = (
  mode: RenderModePresetMode | string,
  presetId: string | null,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyPresetStateV1 => {
  const nextBindings = { ...state.modeBindings };
  if (!presetId) {
    delete nextBindings[mode];
  } else {
    nextBindings[mode] = presetId;
  }
  return saveTypographyPresetState({
    ...state,
    modeBindings: nextBindings,
  });
};

export const resolveLegacyTypographyPresetForMode = (
  mode: RenderModePresetMode,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyStylePreset | null =>
  state.presets.find((preset) => preset.name === `Legacy ${mode}`) ?? null;

export const setDefaultTypographyPreset = (
  presetId: string | null,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyPresetStateV1 => saveTypographyPresetState({
  ...state,
  defaultPresetId: presetId,
});

export const resolveTypographyPresetForMode = (
  mode: string,
  state: TypographyPresetStateV1 = loadTypographyPresetState(),
): TypographyStylePreset | null => {
  const boundId = state.modeBindings[mode] ?? state.defaultPresetId;
  return getTypographyPresetById(boundId, state);
};

export const createTypographyStyleFromPreset = (
  preset: TypographyStylePreset | null,
  fallback: RenderTextStyle = DEFAULT_STYLE,
): RenderTextStyle => preset ? sanitizeStyle({ ...fallback, ...preset.style }) : sanitizeStyle(fallback);

export const getDefaultShapeKindFromPreset = (
  preset: TypographyStylePreset | null,
): "square" | "rounded" => preset?.defaultShapeKind ?? "square";

export const buildShapeFromPreset = (
  preset: TypographyStylePreset | null,
  width: number,
  height: number,
): ReturnType<typeof createDefaultTypographyShape> => {
  const shapeKind = getDefaultShapeKindFromPreset(preset);
  const shape = createDefaultTypographyShape(width, height, shapeKind, preset ? "legacy" : "manual");
  const padding = Math.max(0, preset?.padding ?? 10);
  return {
    ...shape,
    innerBox: [
      padding,
      padding,
      Math.max(padding + 1, width - padding),
      Math.max(padding + 1, height - padding),
    ],
  };
};
