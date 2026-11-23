import { useEffect, useState } from "react";
import type { NativeTextEffectPresetId } from "./textEffects.types";

export type TextEffectPreviewSignal = NativeTextEffectPresetId | null;

type EffectPreviewListener = (presetId: TextEffectPreviewSignal) => void;

let currentEffectSignal: TextEffectPreviewSignal = null;
const effectListeners = new Set<EffectPreviewListener>();

export const publishTextEffectPreview = (
  presetId: TextEffectPreviewSignal,
): void => {
  if (currentEffectSignal === presetId) return;
  currentEffectSignal = presetId;
  for (const listener of effectListeners) listener(presetId);
};

export const subscribeTextEffectPreview = (
  listener: EffectPreviewListener,
): (() => void) => {
  effectListeners.add(listener);
  return () => {
    effectListeners.delete(listener);
  };
};

export const useTextEffectPreviewSignal = (): TextEffectPreviewSignal => {
  const [presetId, setPresetId] = useState<TextEffectPreviewSignal>(currentEffectSignal);
  useEffect(() => subscribeTextEffectPreview(setPresetId), []);
  return presetId;
};
