import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

import type {
  NativeTextEffectPreset,
  NativeTextEffectPresetId,
  TextEffectCategory,
} from "../../typography/textEffects";
import { publishTextEffectPreview } from "../../typography/textEffectPreviewSignal";
import type { TranslationKey } from "../../i18n/messages";

export const TEXT_EFFECT_CATEGORY_TABS: readonly {
  id: TextEffectCategory;
  labelKey: TranslationKey;
}[] = [
  { id: "all", labelKey: "dashboard.typography.effect.category.all" },
  { id: "impact", labelKey: "dashboard.typography.effect.category.impact" },
  { id: "soft", labelKey: "dashboard.typography.effect.category.soft" },
  { id: "brush", labelKey: "dashboard.typography.effect.category.brush" },
  { id: "comic", labelKey: "dashboard.typography.effect.category.comic" },
  { id: "smear", labelKey: "dashboard.typography.effect.category.smear" },
];

interface UseTextEffectPickerParams {
  value: NativeTextEffectPresetId;
  presets: readonly NativeTextEffectPreset[];
  translate: (key: TranslationKey) => string;
  onChange: (value: NativeTextEffectPresetId) => void;
}

export const useTextEffectPicker = ({
  value,
  presets,
  translate,
  onChange,
}: UseTextEffectPickerParams) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TextEffectCategory>("all");
  const gridRef = useRef<HTMLDivElement | null>(null);

  const nonePreset = useMemo(
    () => presets.find((preset) => preset.id === "none") ?? presets[0],
    [presets],
  );
  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === value) ?? nonePreset,
    [nonePreset, presets, value],
  );

  const effectPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return presets.filter((preset) => {
      if (preset.id === "none") return false;
      if (category !== "all" && preset.category !== category) return false;
      if (!normalizedQuery) return true;
      const labelMatch = translate(preset.label).toLowerCase().includes(normalizedQuery);
      const descMatch = translate(preset.description).toLowerCase().includes(normalizedQuery);
      const sampleMatch = preset.sampleText.toLowerCase().includes(normalizedQuery);
      const idMatch = preset.id.toLowerCase().includes(normalizedQuery);
      return labelMatch || descMatch || sampleMatch || idMatch;
    });
  }, [category, presets, query, translate]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      publishTextEffectPreview(null);
    }
  }, []);

  useEffect(() => () => publishTextEffectPreview(null), []);

  const handleSelectPreset = useCallback(
    (presetId: NativeTextEffectPresetId, shouldClose: boolean) => {
      publishTextEffectPreview(null);
      onChange(presetId);
      if (shouldClose) {
        setOpen(false);
      }
    },
    [onChange],
  );

  const handleClearEffect = useCallback(() => {
    handleSelectPreset("none", true);
  }, [handleSelectPreset]);

  const handlePreviewEnter = useCallback((presetId: NativeTextEffectPresetId) => {
    publishTextEffectPreview(presetId);
  }, []);

  const handlePreviewLeave = useCallback(() => {
    publishTextEffectPreview(null);
  }, []);

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const container = gridRef.current;
      if (!container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button[data-effect-id]"),
      );
      if (items.length === 0) return;

      const currentIndex = items.findIndex((item) => item === document.activeElement);
      if (currentIndex < 0) return;

      let nextIndex = -1;
      if (event.key === "ArrowRight") nextIndex = Math.min(items.length - 1, currentIndex + 1);
      else if (event.key === "ArrowLeft") nextIndex = Math.max(0, currentIndex - 1);
      else if (event.key === "ArrowDown") nextIndex = Math.min(items.length - 1, currentIndex + 2);
      else if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 2);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = items.length - 1;
      else return;

      event.preventDefault();
      const target = items[nextIndex];
      target?.focus();
    },
    [],
  );

  return {
    open,
    query,
    setQuery,
    category,
    setCategory,
    nonePreset,
    activePreset,
    effectPresets,
    gridRef,
    handleOpenChange,
    handleSelectPreset,
    handleClearEffect,
    handlePreviewEnter,
    handlePreviewLeave,
    handleGridKeyDown,
  };
};
