import {
  isCompleteShortcutCombo,
  isShortcutMatch,
  normalizeShortcutCombo,
} from "./keyboardShortcutUtils";

export {
  collectShortcutStateFromKeyboardEvent,
  getShortcutDisplayLabel,
  isCompleteShortcutCombo,
  isEditableShortcutTarget,
  isShortcutMatch,
  normalizeShortcutCombo,
} from "./keyboardShortcutUtils";

export type ShortcutToolMode =
  | "organize"
  | "aio"
  | "cleaner"
  | "typesetter"
  | "translator"
  | "raw"
  | "proofreader"
  | "stitch"
  | "split"
  | "watermark"
  | "enhance"
  | "optimizer"
  | "blogger"
  | "imgur"
  | "guides"
  | "resources";

export type ShortcutSubMode = "auto" | "manual";
export type ShortcutTranslatorWorkspaceMode = "text" | "visual" | null;
export type ShortcutCategory = "global" | "modes" | "typesetter" | "palette";
export type ShortcutModeGuard =
  | "dashboard"
  | "requires-active-image"
  | "typesetter-manual"
  | "aio-or-typesetter-manual"
  | "typesetter-manual-selection"
  | "aio-or-typesetter-manual-selection"
  | "manual-dock"
  | "manual-dock-selection";

export type ShortcutActionId =
  | "openShortcutModal"
  | "toggleToolsPanel"
  | "rotateActiveImage"
  | "workspaceSave"
  | "workspaceUndo"
  | "workspaceRedo"
  | "zoomIn"
  | "zoomOut"
  | "setViewPaginated"
  | "setViewLongStrip"
  | "setModeOrganize"
  | "setModeAio"
  | "setModeCleaner"
  | "setModeTypesetter"
  | "setModeTranslator"
  | "setModeRaw"
  | "setModeProofreader"
  | "setModeStitch"
  | "setModeSplit"
  | "setModeWatermark"
  | "setModeEnhance"
  | "setModeGuides"
  | "setModeResources"
  | "applyText"
  | "nextRegion"
  | "previousRegion"
  | "toggleMultiBubble"
  | "saveSnapshot"
  | "detectShapes"
  | "applyActivePreset"
  | "applyLegacyPresetTextBubble"
  | "applyLegacyPresetTextFree"
  | "applyLegacyPresetTextSfx"
  | "applyLegacyPresetTextNarration"
  | "applyLegacyPresetTextInsideBlackBubble"
  | "applyAutoShape"
  | "convertShapeSquare"
  | "convertShapeRounded"
  | "deleteRegion"
  | "editInline"
  // ── Tool Palette ──────────────────────────────────────────────────────────
  | "duplicateRegion"
  | "toolConfigToggle"
  | "toolAreaSelect"
  | "toolClearRegions"
  | "toolSegmentBrush"
  | "toolSegmentEraser"
  | "toolPaint"
  | "toolPaintEraser"
  | "toolMagicWand"
  | "toolHealingBrush"
  | "toolClearPaint"
  | "toolResetEdits";

export interface KeyboardShortcutConfigV2 {
  version: 2;
  shortcuts: Record<ShortcutActionId, string[]>;
}

interface TypographyShortcutConfigV1 {
  version: 1;
  shortcuts: Partial<Record<LegacyTypographyShortcutId, string[]>>;
}

type LegacyTypographyShortcutId =
  | "applyText"
  | "nextRegion"
  | "previousRegion"
  | "toggleMultiBubble"
  | "saveSnapshot"
  | "detectShapes"
  | "deleteRegion"
  | "editInline";

export interface ShortcutContext {
  mode: ShortcutToolMode;
  subMode: ShortcutSubMode;
  translatorWorkspaceMode: ShortcutTranslatorWorkspaceMode;
  activeId: string | null;
  activeSelectedRegionId: string | null;
  aioRenderReady: boolean;
  processing: boolean;
}

export interface ShortcutActionDefinition {
  id: ShortcutActionId;
  label: string;
  description: string;
  category: ShortcutCategory;
  modeGuard: ShortcutModeGuard;
  defaultCombo: string[];
  isEnabled: (context: ShortcutContext) => boolean;
}

export interface FixedShortcutDefinition {
  id: string;
  label: string;
  description: string;
  combo: string[];
}

export const KEYBOARD_SHORTCUT_STORAGE_KEY = "koma-keyboard-shortcuts-v2";
export const LEGACY_TYPOGRAPHY_SHORTCUT_STORAGE_KEY = "koma-typography-shortcuts-v1";

const LEGACY_DETECT_SHAPES_DEFAULT = normalizeShortcutCombo(["CTRL", "ALT", "D"]);
const CURRENT_DETECT_SHAPES_DEFAULT = normalizeShortcutCombo(["R"]);
const LEGACY_SAVE_SNAPSHOT_DEFAULT = normalizeShortcutCombo(["CTRL", "S"]);
const CURRENT_SAVE_SNAPSHOT_DEFAULT = normalizeShortcutCombo(["CTRL", "SHIFT", "S"]);

const createModeShortcut = (
  id: ShortcutActionId,
  label: string,
  description: string,
  defaultCombo: string[],
): ShortcutActionDefinition => ({
  id,
  label,
  description,
  category: "modes",
  modeGuard: "dashboard",
  defaultCombo,
  isEnabled: () => true,
});

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  global: "shortcuts.category.global",
  modes: "shortcuts.category.modes",
  typesetter: "shortcuts.category.typesetter",
  palette: "shortcuts.category.palette",
};

export const SHORTCUT_ACTIONS: ShortcutActionDefinition[] = [
  {
    id: "openShortcutModal",
    label: "shortcuts.openShortcutModal.label",
    description: "shortcuts.openShortcutModal.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["H"],
    isEnabled: () => true,
  },
  {
    id: "toggleToolsPanel",
    label: "shortcuts.toggleToolsPanel.label",
    description: "shortcuts.toggleToolsPanel.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["ALT", "T"],
    isEnabled: () => true,
  },
  {
    id: "rotateActiveImage",
    label: "shortcuts.rotateActiveImage.label",
    description: "shortcuts.rotateActiveImage.description",
    category: "global",
    modeGuard: "requires-active-image",
    defaultCombo: ["ALT", "R"],
    isEnabled: (context) => Boolean(context.activeId) && !context.processing,
  },
  {
    id: "workspaceSave",
    label: "shortcuts.workspaceSave.label",
    description: "shortcuts.workspaceSave.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["CTRL", "S"],
    isEnabled: () => true,
  },
  {
    id: "workspaceUndo",
    label: "shortcuts.workspaceUndo.label",
    description: "shortcuts.workspaceUndo.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["CTRL", "Z"],
    isEnabled: () => true,
  },
  {
    id: "workspaceRedo",
    label: "shortcuts.workspaceRedo.label",
    description: "shortcuts.workspaceRedo.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["CTRL", "SHIFT", "Z"],
    isEnabled: () => true,
  },
  {
    id: "zoomIn",
    label: "shortcuts.zoomIn.label",
    description: "shortcuts.zoomIn.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["CTRL", "="],
    isEnabled: () => true,
  },
  {
    id: "zoomOut",
    label: "shortcuts.zoomOut.label",
    description: "shortcuts.zoomOut.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["CTRL", "-"],
    isEnabled: () => true,
  },
  {
    id: "setViewPaginated",
    label: "shortcuts.setViewPaginated.label",
    description: "shortcuts.setViewPaginated.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["ALT", "1"],
    isEnabled: () => true,
  },
  {
    id: "setViewLongStrip",
    label: "shortcuts.setViewLongStrip.label",
    description: "shortcuts.setViewLongStrip.description",
    category: "global",
    modeGuard: "dashboard",
    defaultCombo: ["ALT", "2"],
    isEnabled: () => true,
  },
  createModeShortcut(
    "setModeOrganize",
    "shortcuts.setModeOrganize.label",
    "shortcuts.setModeOrganize.description",
    ["ALT", "SHIFT", "O"],
  ),
  createModeShortcut(
    "setModeAio",
    "shortcuts.setModeAio.label",
    "shortcuts.setModeAio.description",
    ["ALT", "SHIFT", "A"],
  ),
  createModeShortcut(
    "setModeCleaner",
    "shortcuts.setModeCleaner.label",
    "shortcuts.setModeCleaner.description",
    ["ALT", "SHIFT", "L"],
  ),
  createModeShortcut(
    "setModeTypesetter",
    "shortcuts.setModeTypesetter.label",
    "shortcuts.setModeTypesetter.description",
    ["ALT", "SHIFT", "T"],
  ),
  createModeShortcut(
    "setModeTranslator",
    "shortcuts.setModeTranslator.label",
    "shortcuts.setModeTranslator.description",
    ["ALT", "SHIFT", "D"],
  ),
  createModeShortcut(
    "setModeRaw",
    "shortcuts.setModeRaw.label",
    "shortcuts.setModeRaw.description",
    ["ALT", "SHIFT", "R"],
  ),
  createModeShortcut(
    "setModeProofreader",
    "shortcuts.setModeProofreader.label",
    "shortcuts.setModeProofreader.description",
    ["ALT", "SHIFT", "Q"],
  ),
  createModeShortcut(
    "setModeStitch",
    "shortcuts.setModeStitch.label",
    "shortcuts.setModeStitch.description",
    ["ALT", "SHIFT", "C"],
  ),
  createModeShortcut(
    "setModeSplit",
    "shortcuts.setModeSplit.label",
    "shortcuts.setModeSplit.description",
    ["ALT", "SHIFT", "X"],
  ),
  createModeShortcut(
    "setModeWatermark",
    "shortcuts.setModeWatermark.label",
    "shortcuts.setModeWatermark.description",
    ["ALT", "SHIFT", "W"],
  ),
  createModeShortcut(
    "setModeEnhance",
    "shortcuts.setModeEnhance.label",
    "shortcuts.setModeEnhance.description",
    ["ALT", "SHIFT", "E"],
  ),
  createModeShortcut(
    "setModeGuides",
    "shortcuts.setModeGuides.label",
    "shortcuts.setModeGuides.description",
    ["ALT", "SHIFT", "G"],
  ),
  createModeShortcut(
    "setModeResources",
    "shortcuts.setModeResources.label",
    "shortcuts.setModeResources.description",
    ["ALT", "SHIFT", "U"],
  ),
  {
    id: "applyText",
    label: "shortcuts.applyText.label",
    description: "shortcuts.applyText.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual",
    defaultCombo: ["CTRL", "ENTER"],
    isEnabled: (context) =>
      context.subMode === "manual"
      && (context.mode === "typesetter" || context.mode === "aio"),
  },
  {
    id: "nextRegion",
    label: "shortcuts.nextRegion.label",
    description: "shortcuts.nextRegion.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual",
    defaultCombo: ["CTRL", "TAB"],
    isEnabled: (context) =>
      context.subMode === "manual"
      && (context.mode === "typesetter" || context.mode === "aio"),
  },
  {
    id: "previousRegion",
    label: "shortcuts.previousRegion.label",
    description: "shortcuts.previousRegion.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual",
    defaultCombo: ["CTRL", "SHIFT", "TAB"],
    isEnabled: (context) =>
      context.subMode === "manual"
      && (context.mode === "typesetter" || context.mode === "aio"),
  },
  {
    id: "toggleMultiBubble",
    label: "shortcuts.toggleMultiBubble.label",
    description: "shortcuts.toggleMultiBubble.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual",
    defaultCombo: ["CTRL", "ALT", "M"],
    isEnabled: (context) =>
      context.subMode === "manual"
      && (context.mode === "typesetter" || context.mode === "aio"),
  },
  {
    id: "saveSnapshot",
    label: "shortcuts.saveSnapshot.label",
    description: "shortcuts.saveSnapshot.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual",
    defaultCombo: ["CTRL", "SHIFT", "S"],
    isEnabled: (context) =>
      context.subMode === "manual"
      && (context.mode === "typesetter" || context.mode === "aio"),
  },
  {
    id: "detectShapes",
    label: "shortcuts.detectShapes.label",
    description: "shortcuts.detectShapes.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["R"],
    isEnabled: (context) =>
      context.subMode === "manual"
      && Boolean(context.activeSelectedRegionId)
      && (context.mode === "typesetter" || context.mode === "aio"),
  },
  {
    id: "applyActivePreset",
    label: "shortcuts.applyActivePreset.label",
    description: "shortcuts.applyActivePreset.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "P"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "applyLegacyPresetTextBubble",
    label: "shortcuts.applyLegacyPresetTextBubble.label",
    description: "shortcuts.applyLegacyPresetTextBubble.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "1"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "applyLegacyPresetTextFree",
    label: "shortcuts.applyLegacyPresetTextFree.label",
    description: "shortcuts.applyLegacyPresetTextFree.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "2"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "applyLegacyPresetTextSfx",
    label: "shortcuts.applyLegacyPresetTextSfx.label",
    description: "shortcuts.applyLegacyPresetTextSfx.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "3"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "applyLegacyPresetTextNarration",
    label: "shortcuts.applyLegacyPresetTextNarration.label",
    description: "shortcuts.applyLegacyPresetTextNarration.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "4"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "applyLegacyPresetTextInsideBlackBubble",
    label: "shortcuts.applyLegacyPresetTextInsideBlackBubble.label",
    description: "shortcuts.applyLegacyPresetTextInsideBlackBubble.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "5"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "applyAutoShape",
    label: "shortcuts.applyAutoShape.label",
    description: "shortcuts.applyAutoShape.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "A"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "convertShapeSquare",
    label: "shortcuts.convertShapeSquare.label",
    description: "shortcuts.convertShapeSquare.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "S"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "convertShapeRounded",
    label: "shortcuts.convertShapeRounded.label",
    description: "shortcuts.convertShapeRounded.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["CTRL", "ALT", "O"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },
  {
    id: "deleteRegion",
    label: "shortcuts.deleteRegion.label",
    description: "shortcuts.deleteRegion.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["DELETE"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || context.mode === "translator"
        || context.mode === "cleaner"
        || context.mode === "aio"
      ),
  },
  {
    id: "editInline",
    label: "shortcuts.editInline.label",
    description: "shortcuts.editInline.description",
    category: "typesetter",
    modeGuard: "aio-or-typesetter-manual-selection",
    defaultCombo: ["ENTER"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (
        context.mode === "typesetter"
        || (context.mode === "aio" && context.aioRenderReady)
      ),
  },

  // ─── Tool Palette ──────────────────────────────────────────────────────────
  {
    id: "duplicateRegion",
    label: "shortcuts.duplicateRegion.label",
    description: "shortcuts.duplicateRegion.description",
    category: "palette",
    modeGuard: "manual-dock-selection",
    defaultCombo: ["CTRL", "D"],
    isEnabled: (context) =>
      Boolean(context.activeSelectedRegionId)
      && context.subMode === "manual"
      && (context.mode === "typesetter" || context.mode === "aio")
      && !context.processing,
  },
  {
    id: "toolConfigToggle",
    label: "shortcuts.toolConfigToggle.label",
    description: "shortcuts.toolConfigToggle.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["ALT", "C"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual",
  },
  {
    id: "toolAreaSelect",
    label: "shortcuts.toolAreaSelect.label",
    description: "shortcuts.toolAreaSelect.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["Q"],
    isEnabled: (context) =>
      context.mode === "aio"
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolClearRegions",
    label: "shortcuts.toolClearRegions.label",
    description: "shortcuts.toolClearRegions.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["CTRL", "SHIFT", "DELETE"],
    isEnabled: (context) =>
      context.mode === "aio"
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolSegmentBrush",
    label: "shortcuts.toolSegmentBrush.label",
    description: "shortcuts.toolSegmentBrush.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["B"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolSegmentEraser",
    label: "shortcuts.toolSegmentEraser.label",
    description: "shortcuts.toolSegmentEraser.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["E"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolPaint",
    label: "shortcuts.toolPaint.label",
    description: "shortcuts.toolPaint.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["P"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolPaintEraser",
    label: "shortcuts.toolPaintEraser.label",
    description: "shortcuts.toolPaintEraser.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["ALT", "E"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolMagicWand",
    label: "shortcuts.toolMagicWand.label",
    description: "shortcuts.toolMagicWand.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["W"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolHealingBrush",
    label: "shortcuts.toolHealingBrush.label",
    description: "shortcuts.toolHealingBrush.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["ALT", "H"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolClearPaint",
    label: "shortcuts.toolClearPaint.label",
    description: "shortcuts.toolClearPaint.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["CTRL", "SHIFT", "P"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
  {
    id: "toolResetEdits",
    label: "shortcuts.toolResetEdits.label",
    description: "shortcuts.toolResetEdits.description",
    category: "palette",
    modeGuard: "manual-dock",
    defaultCombo: ["CTRL", "SHIFT", "R"],
    isEnabled: (context) =>
      (context.mode === "aio" || context.mode === "cleaner")
      && context.subMode === "manual"
      && Boolean(context.activeId)
      && !context.processing,
  },
];

export const SHORTCUT_ACTIONS_BY_ID = SHORTCUT_ACTIONS.reduce<Record<ShortcutActionId, ShortcutActionDefinition>>(
  (acc, action) => {
    acc[action.id] = action;
    return acc;
  },
  {} as Record<ShortcutActionId, ShortcutActionDefinition>,
);

export const FIXED_CONTEXT_SHORTCUTS: FixedShortcutDefinition[] = [
  {
    id: "inlineEditorCancel",
    label: "shortcuts.inlineEditorCancel.label",
    description: "shortcuts.inlineEditorCancel.description",
    combo: ["ESC"],
  },
  {
    id: "inlineEditorSave",
    label: "shortcuts.inlineEditorSave.label",
    description: "shortcuts.inlineEditorSave.description",
    combo: ["CTRL", "ENTER"],
  },
];

const createDefaultShortcutRecord = (): Record<ShortcutActionId, string[]> =>
  SHORTCUT_ACTIONS.reduce<Record<ShortcutActionId, string[]>>((acc, action) => {
    acc[action.id] = [...action.defaultCombo];
    return acc;
  }, {} as Record<ShortcutActionId, string[]>);

export const DEFAULT_KEYBOARD_SHORTCUT_CONFIG: KeyboardShortcutConfigV2 = {
  version: 2,
  shortcuts: createDefaultShortcutRecord(),
};

const parseJson = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const sanitizeKeyboardShortcutConfig = (value: unknown): KeyboardShortcutConfigV2 => {
  const fallback = createDefaultShortcutRecord();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 2, shortcuts: fallback };
  }

  const raw = value as Partial<KeyboardShortcutConfigV2>;
  const rawShortcuts = raw.shortcuts && typeof raw.shortcuts === "object" && !Array.isArray(raw.shortcuts)
    ? raw.shortcuts
    : {};

  const shortcuts = SHORTCUT_ACTIONS.reduce<Record<ShortcutActionId, string[]>>((acc, action) => {
    const rawValue = (rawShortcuts as Partial<Record<ShortcutActionId, unknown>>)[action.id];
    if (rawValue === undefined) {
      acc[action.id] = [...fallback[action.id]];
      return acc;
    }

    const normalized = normalizeShortcutCombo(rawValue);
    acc[action.id] = normalized.length > 0 ? normalized : [...fallback[action.id]];
    return acc;
  }, {} as Record<ShortcutActionId, string[]>);

  return {
    version: 2,
    shortcuts,
  };
};

const migrateLegacyTypographyShortcuts = (
  legacy: TypographyShortcutConfigV1 | null,
): KeyboardShortcutConfigV2 | null => {
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return null;

  const nextState = sanitizeKeyboardShortcutConfig(DEFAULT_KEYBOARD_SHORTCUT_CONFIG);
  (Object.keys(legacy.shortcuts ?? {}) as LegacyTypographyShortcutId[]).forEach((legacyId) => {
    if (!(legacyId in nextState.shortcuts)) return;
    const normalized = normalizeShortcutCombo(legacy.shortcuts[legacyId]);
    if (normalized.length > 0) {
      nextState.shortcuts[legacyId as ShortcutActionId] = normalized;
    }
  });

  return nextState;
};

export const loadKeyboardShortcutConfig = (): KeyboardShortcutConfigV2 => {
  if (typeof window === "undefined") return DEFAULT_KEYBOARD_SHORTCUT_CONFIG;

  const persisted = parseJson<KeyboardShortcutConfigV2>(window.localStorage.getItem(KEYBOARD_SHORTCUT_STORAGE_KEY));
  if (persisted) {
    const sanitized = sanitizeKeyboardShortcutConfig(persisted);
    const migratedDetectShapes = isShortcutMatch(
      sanitized.shortcuts.detectShapes,
      LEGACY_DETECT_SHAPES_DEFAULT,
    )
      ? sanitizeKeyboardShortcutConfig({
          ...sanitized,
          shortcuts: {
            ...sanitized.shortcuts,
            detectShapes: CURRENT_DETECT_SHAPES_DEFAULT,
          },
        })
      : sanitized;
    const migratedSaveSnapshot = isShortcutMatch(
      migratedDetectShapes.shortcuts.saveSnapshot,
      LEGACY_SAVE_SNAPSHOT_DEFAULT,
    )
      ? sanitizeKeyboardShortcutConfig({
          ...migratedDetectShapes,
          shortcuts: {
            ...migratedDetectShapes.shortcuts,
            saveSnapshot: CURRENT_SAVE_SNAPSHOT_DEFAULT,
          },
        })
      : migratedDetectShapes;
    window.localStorage.setItem(KEYBOARD_SHORTCUT_STORAGE_KEY, JSON.stringify(migratedSaveSnapshot));
    return migratedSaveSnapshot;
  }

  const legacy = parseJson<TypographyShortcutConfigV1>(
    window.localStorage.getItem(LEGACY_TYPOGRAPHY_SHORTCUT_STORAGE_KEY),
  );
  const migrated = migrateLegacyTypographyShortcuts(legacy);
  if (migrated) {
    window.localStorage.setItem(KEYBOARD_SHORTCUT_STORAGE_KEY, JSON.stringify(migrated));
    window.localStorage.removeItem(LEGACY_TYPOGRAPHY_SHORTCUT_STORAGE_KEY);
    return migrated;
  }

  window.localStorage.setItem(
    KEYBOARD_SHORTCUT_STORAGE_KEY,
    JSON.stringify(DEFAULT_KEYBOARD_SHORTCUT_CONFIG),
  );
  return DEFAULT_KEYBOARD_SHORTCUT_CONFIG;
};

export const saveKeyboardShortcutConfig = (
  state: KeyboardShortcutConfigV2,
): KeyboardShortcutConfigV2 => {
  const sanitized = sanitizeKeyboardShortcutConfig(state);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEYBOARD_SHORTCUT_STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
};

export const resetKeyboardShortcutConfig = (): KeyboardShortcutConfigV2 =>
  saveKeyboardShortcutConfig(DEFAULT_KEYBOARD_SHORTCUT_CONFIG);

export const setShortcutActionCombo = (
  state: KeyboardShortcutConfigV2,
  actionId: ShortcutActionId,
  combo: string[],
): KeyboardShortcutConfigV2 => sanitizeKeyboardShortcutConfig({
  ...state,
  shortcuts: {
    ...state.shortcuts,
    [actionId]: normalizeShortcutCombo(combo),
  },
});

export const clearShortcutActionCombo = (
  state: KeyboardShortcutConfigV2,
  actionId: ShortcutActionId,
): KeyboardShortcutConfigV2 => setShortcutActionCombo(state, actionId, []);

export const restoreShortcutActionCombo = (
  state: KeyboardShortcutConfigV2,
  actionId: ShortcutActionId,
): KeyboardShortcutConfigV2 => setShortcutActionCombo(
  state,
  actionId,
  SHORTCUT_ACTIONS_BY_ID[actionId].defaultCombo,
);

export const getShortcutConflict = (
  state: KeyboardShortcutConfigV2,
  actionId: ShortcutActionId,
  combo: string[],
): ShortcutActionDefinition | null => {
  const normalizedCandidate = normalizeShortcutCombo(combo);
  if (!isCompleteShortcutCombo(normalizedCandidate)) return null;

  return SHORTCUT_ACTIONS.find((candidate) =>
    candidate.id !== actionId
    && isShortcutMatch(normalizedCandidate, state.shortcuts[candidate.id] ?? [])
  ) ?? null;
};

export const findMatchingShortcutAction = (
  state: KeyboardShortcutConfigV2,
  pressed: string[],
  context: ShortcutContext,
): ShortcutActionDefinition | null => {
  const normalizedPressed = normalizeShortcutCombo(pressed);
  if (!isCompleteShortcutCombo(normalizedPressed)) return null;

  return SHORTCUT_ACTIONS.find((action) =>
    action.isEnabled(context)
    && isShortcutMatch(normalizedPressed, state.shortcuts[action.id] ?? [])
  ) ?? null;
};
