import { useCallback, useMemo, useState } from 'react';

import type { useI18n } from '../../../i18n';
import { buildModeDefaultPreset } from '../../../typography/modeDefaults';
import {
  createTypographyStyleFromPreset,
  resolveModeTypographyPreset,
  restoreModeDefaultPresets,
  updateTypographyPreset,
} from '../../../typography/presets';
import type { RenderTextStyle } from '../../../typography/renderStyle';
import type { TypographyPresetStateV1 } from '../../../typography/types';
import {
  RENDER_MODE_PRESET_MODES,
  type RenderModePresetMode,
  type RenderModeStylePreset,
} from '../../../utils/renderModePresets';
import {
  RENDER_MODE_EDITOR_BASE_STYLE,
  RENDER_MODE_PRESET_OPTIONS,
  toRenderModePresetStyle,
} from '../settings.constants';
import type { RenderModePresetFormData } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseRenderModePresetsArgs {
  t: TranslationFn;
  typographyPresetState: TypographyPresetStateV1;
  setTypographyPresetState: (state: TypographyPresetStateV1) => void;
}

const resolveModeFullStyle = (mode: RenderModePresetMode, state: TypographyPresetStateV1): RenderTextStyle =>
  createTypographyStyleFromPreset(
    resolveModeTypographyPreset(mode, state) ?? buildModeDefaultPreset(mode, RENDER_MODE_EDITOR_BASE_STYLE),
  );

const resolveModeStyle = (mode: RenderModePresetMode, state: TypographyPresetStateV1): RenderModeStylePreset =>
  toRenderModePresetStyle(resolveModeFullStyle(mode, state));

const toTypographyStylePatch = (
  style: RenderModeStylePreset,
  current: RenderTextStyle,
): Partial<RenderTextStyle> => ({
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  bold: style.bold,
  italic: style.italic,
  color: style.color,
  ...(current.gradientEnabled ? {} : { fillCssValue: style.color }),
  outlineColor: style.outlineColor,
  outlineWidth: style.outlineEnabled === false ? 0 : style.outlineWidth,
  uppercase: style.uppercase,
  detectGradient: style.detectGradient,
});

export const useRenderModePresets = ({
  t,
  typographyPresetState,
  setTypographyPresetState,
}: UseRenderModePresetsArgs) => {
  const [mode, setMode] = useState<RenderModePresetMode>(RENDER_MODE_PRESET_OPTIONS[0]?.[0] ?? 'text_bubble');
  const [draft, setDraft] = useState<RenderModeStylePreset | null>(null);
  const [advancedDraft, setAdvancedDraft] = useState<Partial<RenderTextStyle>>({});
  const [renderModePresetFeedback, setRenderModePresetFeedback] = useState<string | null>(null);
  const [renderModePresetError, setRenderModePresetError] = useState<string | null>(null);

  const renderModePresetForm = useMemo<RenderModePresetFormData>(
    () => {
      const style = draft ?? resolveModeStyle(mode, typographyPresetState);
      const advanced = { ...resolveModeFullStyle(mode, typographyPresetState), ...advancedDraft };
      return {
        mode,
        style,
        advanced,
        preview: { ...advanced, ...toTypographyStylePatch(style, advanced) },
        shapeKind: resolveModeTypographyPreset(mode, typographyPresetState)?.defaultShapeKind
          ?? buildModeDefaultPreset(mode, RENDER_MODE_EDITOR_BASE_STYLE).defaultShapeKind,
      };
    },
    [mode, draft, advancedDraft, typographyPresetState],
  );

  const handleRenderModePresetModeChange = useCallback((nextMode: RenderModePresetMode) => {
    setMode(nextMode);
    setDraft(null);
    setAdvancedDraft({});
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, []);

  const handleRenderModePresetFieldChange = useCallback(<K extends keyof RenderModeStylePreset>(key: K, value: RenderModeStylePreset[K]) => {
    setDraft((prev) => ({ ...(prev ?? resolveModeStyle(mode, typographyPresetState)), [key]: value }));
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, [mode, typographyPresetState]);

  const handleRenderModePresetAdvancedChange = useCallback(<K extends keyof RenderTextStyle>(key: K, value: RenderTextStyle[K]) => {
    setAdvancedDraft((prev) => ({ ...prev, [key]: value }));
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, []);

  const handleSaveRenderModePreset = useCallback(() => {
    const base = resolveModeTypographyPreset(mode, typographyPresetState)
      ? typographyPresetState
      : restoreModeDefaultPresets([mode], typographyPresetState);
    const preset = resolveModeTypographyPreset(mode, base);
    if (!preset) {
      setRenderModePresetError(t('dashboard.status.modePresetNotFound', { modeKey: mode }));
      return;
    }
    const { state: nextState } = updateTypographyPreset(
      preset.id,
      { style: { ...preset.style, ...advancedDraft, ...toTypographyStylePatch(renderModePresetForm.style, preset.style) } },
      base,
    );
    setTypographyPresetState(nextState);
    setDraft(null);
    setAdvancedDraft({});
    setRenderModePresetFeedback(t('settings.presets.render.desc'));
    setRenderModePresetError(null);
  }, [mode, renderModePresetForm.style, advancedDraft, typographyPresetState, setTypographyPresetState, t]);

  const handleResetRenderModePreset = useCallback(() => {
    setTypographyPresetState(restoreModeDefaultPresets([mode], typographyPresetState));
    setDraft(null);
    setAdvancedDraft({});
    setRenderModePresetFeedback(t('settings.presets.render.desc'));
    setRenderModePresetError(null);
  }, [mode, typographyPresetState, setTypographyPresetState, t]);

  const handleResetAllRenderModePreset = useCallback(() => {
    const confirmed = window.confirm(t('settings.app.reset.confirm'));
    if (!confirmed) return;
    setTypographyPresetState(restoreModeDefaultPresets(RENDER_MODE_PRESET_MODES, typographyPresetState));
    setDraft(null);
    setAdvancedDraft({});
    setRenderModePresetFeedback(t('settings.app.reset.success'));
    setRenderModePresetError(null);
  }, [typographyPresetState, setTypographyPresetState, t]);

  return {
    renderModePresetFeedback,
    renderModePresetError,
    renderModePresetForm,
    handleRenderModePresetModeChange,
    handleRenderModePresetFieldChange,
    handleRenderModePresetAdvancedChange,
    handleSaveRenderModePreset,
    handleResetAllRenderModePreset,
    handleResetRenderModePreset,
  };
};
