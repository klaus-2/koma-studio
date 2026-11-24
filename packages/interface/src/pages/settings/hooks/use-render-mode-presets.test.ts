// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { modeDefaultPresetId } from '../../../typography/modeDefaults';
import { loadTypographyPresetState, updateTypographyPreset } from '../../../typography/presets';
import type { TypographyPresetStateV1 } from '../../../typography/types';
import { RENDER_MODE_PRESET_STORAGE_KEY } from '../../../utils/renderModePresets';
import { useRenderModePresets } from './use-render-mode-presets';

const t = (key: string): string => key;

const renderPresetsHook = () =>
  renderHook(() => {
    const [state, setState] = useState<TypographyPresetStateV1>(() => loadTypographyPresetState());
    const presets = useRenderModePresets({ t, typographyPresetState: state, setTypographyPresetState: setState });
    return { state, setState, presets };
  });

const bubbleStyle = (state: TypographyPresetStateV1) =>
  state.presets.find((preset) => preset.id === modeDefaultPresetId('text_bubble'))?.style;

beforeEach(() => {
  window.localStorage.clear();
});

describe('useRenderModePresets (edits the preset bound to each mode)', () => {
  it('shows the bound preset of the selected mode', () => {
    const { result } = renderPresetsHook();
    expect(result.current.presets.renderModePresetForm.mode).toBe('text_bubble');
    act(() => result.current.presets.handleRenderModePresetModeChange('text_inside_black_bubble'));
    expect(result.current.presets.renderModePresetForm.style.color).toBe('#ffffff');
  });

  it('saves into the bound Typographer preset and leaves the old store untouched', () => {
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetFieldChange('fontFamily', 'Comic Neue'));
    act(() => result.current.presets.handleRenderModePresetFieldChange('color', '#ff0000'));
    expect(bubbleStyle(result.current.state)?.fontFamily).not.toBe('Comic Neue');
    act(() => result.current.presets.handleSaveRenderModePreset());
    expect(bubbleStyle(result.current.state)).toMatchObject({
      fontFamily: 'Comic Neue',
      color: '#ff0000',
      fillCssValue: '#ff0000',
    });
    expect(bubbleStyle(loadTypographyPresetState())?.fontFamily).toBe('Comic Neue');
    expect(window.localStorage.getItem(RENDER_MODE_PRESET_STORAGE_KEY)).toBeNull();
  });

  it('follows edits made to the same preset in the Typographer tab', () => {
    const { result } = renderPresetsHook();
    act(() => {
      const { state } = updateTypographyPreset(
        modeDefaultPresetId('text_bubble'),
        { style: { ...bubbleStyle(result.current.state)!, fontFamily: 'Bangers' } },
        result.current.state,
      );
      result.current.setState(state);
    });
    expect(result.current.presets.renderModePresetForm.style.fontFamily).toBe('Bangers');
  });

  it('restores the default of the selected mode and rebinds it', () => {
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetFieldChange('fontFamily', 'Comic Neue'));
    act(() => result.current.presets.handleSaveRenderModePreset());
    act(() => {
      result.current.setState({
        ...result.current.state,
        modeBindings: { ...result.current.state.modeBindings, text_bubble: 'missing' },
      });
    });
    act(() => result.current.presets.handleResetRenderModePreset());
    expect(result.current.state.modeBindings.text_bubble).toBe(modeDefaultPresetId('text_bubble'));
    expect(bubbleStyle(result.current.state)?.fontFamily).toBe('Arial');
  });

  it('saves the advanced fields together with the basic form', () => {
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetAdvancedChange('alignment', 'left'));
    act(() => result.current.presets.handleRenderModePresetAdvancedChange('lineSpacing', 1.4));
    act(() => result.current.presets.handleRenderModePresetAdvancedChange('shadowEnabled', true));
    act(() => result.current.presets.handleRenderModePresetFieldChange('fontFamily', 'Comic Neue'));
    expect(result.current.presets.renderModePresetForm.advanced.alignment).toBe('left');
    expect(bubbleStyle(result.current.state)?.alignment).toBe('center');
    act(() => result.current.presets.handleSaveRenderModePreset());
    expect(bubbleStyle(result.current.state)).toMatchObject({
      alignment: 'left',
      lineSpacing: 1.4,
      shadowEnabled: true,
      fontFamily: 'Comic Neue',
    });
  });

  it('keeps saved advanced fields when only the basic form changes', () => {
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetAdvancedChange('rotation', 12));
    act(() => result.current.presets.handleSaveRenderModePreset());
    act(() => result.current.presets.handleRenderModePresetFieldChange('bold', true));
    act(() => result.current.presets.handleSaveRenderModePreset());
    expect(bubbleStyle(result.current.state)).toMatchObject({ rotation: 12, bold: true });
  });

  it('drops unsaved advanced edits when switching mode', () => {
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetAdvancedChange('alignment', 'right'));
    act(() => result.current.presets.handleRenderModePresetModeChange('text_free'));
    act(() => result.current.presets.handleRenderModePresetModeChange('text_bubble'));
    expect(result.current.presets.renderModePresetForm.advanced.alignment).toBe('center');
  });

  it('exposes a preview style that merges unsaved basic and advanced edits', () => {
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetFieldChange('color', '#00ff00'));
    act(() => result.current.presets.handleRenderModePresetAdvancedChange('alignment', 'right'));
    const { preview, shapeKind } = result.current.presets.renderModePresetForm;
    expect(preview).toMatchObject({ color: '#00ff00', fillCssValue: '#00ff00', alignment: 'right' });
    expect(shapeKind).toBe('rounded');
    expect(bubbleStyle(result.current.state)?.alignment).toBe('center');
    act(() => result.current.presets.handleRenderModePresetModeChange('text_free'));
    expect(result.current.presets.renderModePresetForm.shapeKind).toBe('square');
  });

  it('resets every mode only after confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { result } = renderPresetsHook();
    act(() => result.current.presets.handleRenderModePresetFieldChange('fontFamily', 'Comic Neue'));
    act(() => result.current.presets.handleSaveRenderModePreset());
    act(() => result.current.presets.handleResetAllRenderModePreset());
    expect(bubbleStyle(result.current.state)?.fontFamily).toBe('Comic Neue');
    act(() => result.current.presets.handleResetAllRenderModePreset());
    expect(bubbleStyle(result.current.state)?.fontFamily).toBe('Arial');
    confirm.mockRestore();
  });
});
