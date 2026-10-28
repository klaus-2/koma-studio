import { useCallback, useState } from 'react';

import type { useI18n } from '../../../i18n';
import {
  loadRenderModePresetState,
  resetAllRenderModePresets,
  resetRenderModePreset,
  setRenderModePreset,
  type RenderModePresetMode,
  type RenderModePresetStateV1,
  type RenderModeStylePreset,
} from '../../../utils/renderModePresets';
import { RENDER_MODE_PRESET_OPTIONS, resolveRenderModePresetFormData } from '../settings.constants';
import type { RenderModePresetFormData } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseRenderModePresetsArgs {
  t: TranslationFn;
}

export const useRenderModePresets = ({ t }: UseRenderModePresetsArgs) => {
  const [renderModePresetState, setRenderModePresetState] = useState<RenderModePresetStateV1>(() => loadRenderModePresetState());
  const [renderModePresetForm, setRenderModePresetForm] = useState<RenderModePresetFormData>(() =>
    resolveRenderModePresetFormData(RENDER_MODE_PRESET_OPTIONS[0]?.[0] ?? "text_bubble", loadRenderModePresetState()),
  );
  const [renderModePresetFeedback, setRenderModePresetFeedback] = useState<string | null>(null);
  const [renderModePresetError, setRenderModePresetError] = useState<string | null>(null);

  const handleRenderModePresetModeChange = useCallback((mode: RenderModePresetMode) => {
    setRenderModePresetForm(resolveRenderModePresetFormData(mode, renderModePresetState));
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, [renderModePresetState]);

  const handleRenderModePresetFieldChange = useCallback(<K extends keyof RenderModeStylePreset>(key: K, value: RenderModeStylePreset[K]) => {
    setRenderModePresetForm((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    }));
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, []);

  const handleSaveRenderModePreset = useCallback(() => {
    const nextState = setRenderModePreset(renderModePresetForm.mode, renderModePresetForm.style, renderModePresetState);
    setRenderModePresetState(nextState);
    setRenderModePresetForm(resolveRenderModePresetFormData(renderModePresetForm.mode, nextState));
    setRenderModePresetFeedback(t("settings.presets.render.desc"));
    setRenderModePresetError(null);
  }, [renderModePresetForm, renderModePresetState, t]);

  const handleResetRenderModePreset = useCallback(() => {
    const nextState = resetRenderModePreset(renderModePresetForm.mode, renderModePresetState);
    setRenderModePresetState(nextState);
    setRenderModePresetForm(resolveRenderModePresetFormData(renderModePresetForm.mode, nextState));
    setRenderModePresetFeedback(t("settings.presets.render.desc"));
    setRenderModePresetError(null);
  }, [renderModePresetForm.mode, renderModePresetState, t]);

  const handleResetAllRenderModePreset = useCallback(() => {
    const confirmed = window.confirm(t("settings.app.reset.confirm"));
    if (!confirmed) return;
    const nextState = resetAllRenderModePresets();
    setRenderModePresetState(nextState);
    setRenderModePresetForm((prev) => resolveRenderModePresetFormData(prev.mode, nextState));
    setRenderModePresetFeedback(t("settings.app.reset.success"));
    setRenderModePresetError(null);
  }, [t]);

  return {
    renderModePresetFeedback,
    renderModePresetError,
    renderModePresetForm,
    handleRenderModePresetModeChange,
    handleRenderModePresetFieldChange,
    handleSaveRenderModePreset,
    handleResetAllRenderModePreset,
    handleResetRenderModePreset,
  };
};
