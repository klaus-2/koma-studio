import { describe, expect, it } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import type { AioTextRegion } from '../types/dashboard.types';
import type { RenderTextStyle } from '../utils/renderText';
import type {
  TypographyPresetStateV1,
  TypographyStylePreset,
} from './types';
import {
  applyModePresetBindingsToRegions,
  hasRegionManualStyleEdits,
  resolveBoundTypographyPresetForMode,
} from './autoModeApply';

const applyDetectedGradient = (
  _region: AioTextRegion,
  style: RenderTextStyle,
): RenderTextStyle => style;

const preset = (
  id: string,
  mode: string,
  style: Partial<RenderTextStyle> = {},
): { preset: TypographyStylePreset; state: TypographyPresetStateV1 } => ({
  preset: {
    id,
    folderId: null,
    name: `Preset ${id}`,
    description: '',
    style: { ...DEFAULT_RENDER_STYLE, fontFamily: `Font ${id}`, fontSize: 42, ...style },
    defaultShapeKind: 'rounded',
    padding: 6,
    createdAt: 0,
    updatedAt: 0,
  },
  state: {
    version: 1,
    folders: [],
    presets: [],
    modeBindings: { [mode]: id },
    defaultPresetId: null,
  },
});

const region = (overrides: Partial<AioTextRegion> = {}): AioTextRegion => ({
  id: 'r-1',
  bbox: [10, 10, 110, 70],
  score: 0.9,
  source: 'model',
  modelKey: 'detector',
  ...overrides,
});

const withPresets = (
  state: TypographyPresetStateV1,
  presets: TypographyStylePreset[],
): TypographyPresetStateV1 => ({ ...state, presets });

describe('hasRegionManualStyleEdits', () => {
  it('treats fresh detected regions as unstyled', () => {
    expect(hasRegionManualStyleEdits(region())).toBe(false);
  });

  it('flags regions carrying an explicit style, preset attribution, ranges or style lock', () => {
    expect(hasRegionManualStyleEdits(region({ renderStyle: { ...DEFAULT_RENDER_STYLE, bold: true } }))).toBe(true);
    expect(hasRegionManualStyleEdits(region({ stylePresetId: 'p-1' }))).toBe(true);
    expect(hasRegionManualStyleEdits(region({ renderTextStyleRanges: [] }))).toBe(true);
    expect(hasRegionManualStyleEdits(region({ lockedFields: { style: true } }))).toBe(true);
    expect(hasRegionManualStyleEdits(region({ locked: true }))).toBe(true);
  });
});

describe('resolveBoundTypographyPresetForMode', () => {
  it('resolves only explicit mode bindings, never the default preset fallback', () => {
    const { preset: bound, state } = preset('p-sfx', 'text_sfx');
    expect(resolveBoundTypographyPresetForMode('text_sfx', withPresets(state, [bound]))).toBe(bound);
    expect(resolveBoundTypographyPresetForMode('text_bubble', withPresets(state, [bound]))).toBeNull();
    expect(
      resolveBoundTypographyPresetForMode(
        'text_bubble',
        withPresets({ ...state, modeBindings: {}, defaultPresetId: bound.id }, [bound]),
      ),
    ).toBeNull();
    expect(resolveBoundTypographyPresetForMode('text_bubble', withPresets(state, []))).toBeNull();
  });
});

describe('applyModePresetBindingsToRegions', () => {
  it('stamps the bound mode preset onto unstyled regions', () => {
    const { preset: bound, state } = preset('p-sfx', 'text_sfx', { bold: true });
    const [next] = applyModePresetBindingsToRegions({
      regions: [region({ detectedRenderMode: 'text_sfx', renderText: 'BOOM' })],
      renderDefaultStyle: DEFAULT_RENDER_STYLE,
      typographyPresetState: withPresets(state, [bound]),
      applyDetectedGradientToStyle: applyDetectedGradient,
    });
    expect(next?.renderStyle?.fontFamily).toBe('Font p-sfx');
    expect(next?.renderStyle?.fontSize).toBe(42);
    expect(next?.renderStyle?.bold).toBe(true);
    expect(next?.stylePresetId).toBe('p-sfx');
    expect(next?.renderMode).toBe('auto');
    expect(next?.detectedRenderMode).toBe('text_sfx');
  });

  it('keeps the mode preset of an explicit renderMode and skips unbound modes', () => {
    const { preset: sfxPreset, state: sfxState } = preset('p-sfx', 'text_sfx');
    const { preset: narrationPreset } = preset('p-nar', 'text_narration');
    const state = withPresets(
      { ...sfxState, modeBindings: { ...sfxState.modeBindings, text_narration: narrationPreset.id } },
      [sfxPreset, narrationPreset],
    );
    const [explicit, unbound] = applyModePresetBindingsToRegions({
      regions: [
        region({ detectedRenderMode: 'text_bubble', renderMode: 'text_sfx' }),
        region({ detectedRenderMode: 'text_free' }),
      ],
      renderDefaultStyle: DEFAULT_RENDER_STYLE,
      typographyPresetState: state,
      applyDetectedGradientToStyle: applyDetectedGradient,
    });
    expect(explicit?.stylePresetId).toBe('p-sfx');
    expect(unbound?.stylePresetId).toBeNull();
  });

  it('never clobbers regions with manual style edits', () => {
    const { preset: bound, state } = preset('p-sfx', 'text_sfx');
    const manualStyle = { ...DEFAULT_RENDER_STYLE, fontFamily: 'User Font', bold: true };
    const [styled, attributed, locked] = applyModePresetBindingsToRegions({
      regions: [
        region({ detectedRenderMode: 'text_sfx', renderStyle: manualStyle }),
        region({ detectedRenderMode: 'text_sfx', stylePresetId: 'user-preset' }),
        region({ detectedRenderMode: 'text_sfx', lockedFields: { style: true } }),
      ],
      renderDefaultStyle: DEFAULT_RENDER_STYLE,
      typographyPresetState: withPresets(state, [bound]),
      applyDetectedGradientToStyle: applyDetectedGradient,
    });
    expect(styled?.renderStyle?.fontFamily).toBe('User Font');
    expect(styled?.stylePresetId).toBeNull();
    expect(attributed?.renderStyle?.fontFamily).toBe(DEFAULT_RENDER_STYLE.fontFamily);
    expect(attributed?.stylePresetId).toBe('user-preset');
    expect(locked?.renderStyle?.fontFamily).toBe(DEFAULT_RENDER_STYLE.fontFamily);
    expect(locked?.stylePresetId).toBeNull();
  });

  it('rebuilds auto shapes from the preset but keeps refined shapes', () => {
    const { preset: bound, state } = preset('p-sfx', 'text_sfx', { fontSize: 30 });
    const refinedShape = {
      kind: 'square' as const,
      source: 'refined' as const,
      cornerRadius: 4,
      innerBox: [2, 2, 98, 66] as [number, number, number, number],
      fitProfile: [1, 1],
    };
    const [auto, refined] = applyModePresetBindingsToRegions({
      regions: [
        region({ detectedRenderMode: 'text_sfx' }),
        region({ detectedRenderMode: 'text_sfx', shape: refinedShape }),
      ],
      renderDefaultStyle: DEFAULT_RENDER_STYLE,
      typographyPresetState: withPresets(state, [bound]),
      applyDetectedGradientToStyle: applyDetectedGradient,
    });
    expect(auto?.shape?.source).toBe('legacy');
    expect(auto?.shape?.kind).toBe('rounded');
    expect(refined?.shape).toEqual(refinedShape);
  });

  it('applies the target language hyphenation over the preset style', () => {
    const { preset: bound, state } = preset('p-sfx', 'text_sfx');
    const [next] = applyModePresetBindingsToRegions({
      regions: [region({ detectedRenderMode: 'text_sfx' })],
      renderDefaultStyle: DEFAULT_RENDER_STYLE,
      typographyPresetState: withPresets(state, [bound]),
      applyDetectedGradientToStyle: applyDetectedGradient,
      targetLanguage: ' PT-BR ',
    });
    expect(next?.renderStyle?.hyphenationLanguage).toBe('pt-br');
  });

  it('leaves regions untouched when no binding exists for the mode', () => {
    const { preset: bound, state } = preset('p-sfx', 'text_sfx');
    const source = region({ detectedRenderMode: 'text_narration', recognizedText: 'raw' });
    const [next] = applyModePresetBindingsToRegions({
      regions: [source],
      renderDefaultStyle: DEFAULT_RENDER_STYLE,
      typographyPresetState: withPresets(state, [bound]),
      applyDetectedGradientToStyle: applyDetectedGradient,
    });
    expect(next?.stylePresetId).toBeNull();
    expect(next?.renderText).toBe('raw');
    expect(next?.renderStyle).toBeDefined();
    expect(next?.renderStyle?.fontFamily).toBe('Times New Roman');
  });
});
