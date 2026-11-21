import { useEffect, useState } from "react";

export type PresetPreviewSignal = string | null;

type PreviewListener = (presetId: PresetPreviewSignal) => void;

let currentSignal: PresetPreviewSignal = null;
const listeners = new Set<PreviewListener>();

export const publishPresetPreview = (presetId: PresetPreviewSignal): void => {
  if (currentSignal === presetId) return;
  currentSignal = presetId;
  for (const listener of listeners) listener(presetId);
};

export const subscribePresetPreview = (
  listener: PreviewListener,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePresetPreviewSignal = (): PresetPreviewSignal => {
  const [presetId, setPresetId] = useState<PresetPreviewSignal>(currentSignal);
  useEffect(() => subscribePresetPreview(setPresetId), []);
  return presetId;
};
