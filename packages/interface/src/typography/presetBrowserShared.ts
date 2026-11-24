import { useCallback, useState } from "react";

import { publishPresetPreview } from "./presetPreviewSignal";
import { createTypographyPreset } from "./presets";
import { resolveRegionShapeKind } from "../utils/dashboard.utils";
import { useRegionEditorStore } from "../pages/dashboard/stores/region-editor-store";
import { useImageCollectionStore } from "../pages/dashboard/stores/image-collection-store";
import { useTypographerStore } from "../pages/dashboard/stores/typographer-store";

export type PresetApplyScope = "multi" | "sfxApproved";

const DEFAULT_SAVED_PRESET_PADDING = 10;

const readActiveEditorRegion = () => {
  const editor = useRegionEditorStore.getState();
  const activeId = useImageCollectionStore.getState().activeId;
  const regions = activeId ? editor.aioDetectionsByImage[activeId] ?? [] : [];
  const active = regions.find(
    (region) => region.id === editor.aioSelectedRegionByImage[activeId ?? ""],
  );
  return { editor, activeId, active };
};

export const resolveSfxModePresetId = (
  presets: readonly { id: string }[],
  modeBindings: Readonly<Record<string, string>>,
): string | null => {
  const boundId = modeBindings.text_sfx;
  return boundId && presets.some((preset) => preset.id === boundId) ? boundId : null;
};

export const useSfxModePresetId = (presets: readonly { id: string }[]): string | null => {
  const modeBindings = useRegionEditorStore((state) => state.typographyPresetState.modeBindings);
  return resolveSfxModePresetId(presets, modeBindings);
};

const hasActiveMultiSelection = (activeId: string | null): boolean =>
  activeId !== null
  && (useTypographerStore.getState().typographerMultiSelectedByImage[activeId]?.length ?? 0) > 0;

export interface PresetBrowserActions {
  readonly saveName: string;
  readonly setSaveName: (value: string) => void;
  readonly saveRegionAsPreset: () => void;
  readonly handlePresetClick: (
    presetId: string,
    selectedPresetId: string | null,
    onSelectPreset: (presetId: string | null) => void,
    onApplyToSelection: (presetId: string | null, scope?: PresetApplyScope) => void,
  ) => void;
  readonly handleApplySelection: (
    selectedPresetId: string | null,
    onApplyToSelection: (presetId: string | null, scope?: PresetApplyScope) => void,
  ) => void;
}

export const usePresetBrowserActions = (): PresetBrowserActions => {
  const [saveName, setSaveName] = useState("");

  const saveRegionAsPreset = useCallback((): void => {
    const { editor, activeId, active } = readActiveEditorRegion();
    if (!active?.renderStyle || activeId === null) return;
    const { state: nextState } = createTypographyPreset({
      name: saveName,
      style: active.renderStyle,
      defaultShapeKind: resolveRegionShapeKind(active),
      padding: DEFAULT_SAVED_PRESET_PADDING,
    }, editor.typographyPresetState);
    useRegionEditorStore.getState().setTypographyPresetState(nextState);
    setSaveName("");
  }, [saveName]);

  const handlePresetClick = useCallback(
    (
      presetId: string,
      selectedPresetId: string | null,
      onSelectPreset: (presetId: string | null) => void,
      onApplyToSelection: (presetId: string | null, scope?: PresetApplyScope) => void,
    ): void => {
      const activeId = useImageCollectionStore.getState().activeId;
      const isMulti = hasActiveMultiSelection(activeId);
      const isToggleOff = !isMulti && selectedPresetId === presetId;
      onSelectPreset(isToggleOff ? null : presetId);
      publishPresetPreview(null);
      if (isMulti && activeId !== null) onApplyToSelection(presetId, "multi");
    },
    [],
  );

  const handleApplySelection = useCallback(
    (
      selectedPresetId: string | null,
      onApplyToSelection: (presetId: string | null, scope?: PresetApplyScope) => void,
    ): void => {
      onApplyToSelection(selectedPresetId, "multi");
    },
    [],
  );

  return { saveName, setSaveName, saveRegionAsPreset, handlePresetClick, handleApplySelection };
};
