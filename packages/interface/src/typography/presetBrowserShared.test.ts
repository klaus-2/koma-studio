// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import { useImageCollectionStore } from '../pages/dashboard/stores/image-collection-store';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';
import { useTypographerStore } from '../pages/dashboard/stores/typographer-store';
import type { AioTextRegion } from '../types/dashboard.types';
import { loadTypographyPresetState, TYPOGRAPHY_PRESET_STORAGE_KEY } from './presets';
import { publishPresetPreview, subscribePresetPreview } from './presetPreviewSignal';
import { resolveSfxModePresetId, usePresetBrowserActions } from './presetBrowserShared';
import { modeDefaultPresetId } from './modeDefaults';
import { createDefaultTypographyShape } from './types';
import type { TypographyPresetStateV1 } from './types';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = (id: string, overrides: Partial<AioTextRegion> = {}): AioTextRegion =>
  ({
    id,
    bbox: [10, 10, 110, 60],
    score: 0.9,
    source: 'model',
    modelKey: 'font_rtdetr_v2',
    renderStyle: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Region Font' },
    renderMode: 'auto',
    detectedRenderMode: 'text_bubble',
    ...overrides,
  }) as AioTextRegion;

beforeEach(() => {
  window.localStorage.clear();
  useRegionEditorStore.setState({
    typographyPresetState: loadTypographyPresetState(),
  });
});

const idsBefore = (): Set<string> =>
  new Set(useRegionEditorStore.getState().typographyPresetState.presets.map((preset) => preset.id));

const createdPresets = (before: Set<string>): TypographyPresetStateV1['presets'] =>
  useRegionEditorStore.getState().typographyPresetState.presets.filter((preset) => !before.has(preset.id));

const persistedPresetIds = (): string[] => {
  const raw = window.localStorage.getItem(TYPOGRAPHY_PRESET_STORAGE_KEY);
  if (raw === null) return [];
  const parsed = JSON.parse(raw) as TypographyPresetStateV1;
  return parsed.presets.map((preset) => preset.id);
};

describe('saveRegionAsPreset (B2: save the active region as a preset)', () => {
  const seedActiveRegion = (overrides: Partial<AioTextRegion> = {}): void => {
    useImageCollectionStore.setState({ activeId: 'img-1' });
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [region('r-1', overrides)] },
      aioSelectedRegionByImage: { 'img-1': 'r-1' },
    });
  };

  it('creates exactly one preset with the region values, persists it and resets the input', () => {
    seedActiveRegion({
      renderStyle: { ...DEFAULT_RENDER_STYLE, fontFamily: 'My Hand Font', fontSize: 220 },
    });
    const before = idsBefore();
    const { result } = renderHook(() => usePresetBrowserActions());

    act(() => {
      result.current.setSaveName('Minha Fonte');
    });
    act(() => {
      result.current.saveRegionAsPreset();
    });

    const created = createdPresets(before);
    expect(created).toHaveLength(1);
    const saved = created[0];
    expect(saved?.name).toBe('Minha Fonte');
    expect(saved?.style.fontFamily).toBe('My Hand Font');
    expect(saved?.style.fontSize).toBe(220);
    expect(saved?.defaultShapeKind).toBe('rounded');
    expect(saved?.padding).toBe(10);
    expect(useRegionEditorStore.getState().typographyPresetState.presets.some(
      (preset) => preset.id === saved?.id,
    )).toBe(true);
    expect(persistedPresetIds()).toContain(saved?.id);
    expect(result.current.saveName).toBe('');
  });

  it('uses the deterministic default name when the input is empty', () => {
    seedActiveRegion();
    const before = idsBefore();
    const { result } = renderHook(() => usePresetBrowserActions());
    act(() => {
      result.current.saveRegionAsPreset();
    });
    const created = createdPresets(before);
    expect(created).toHaveLength(1);
    expect(created[0]?.name).toBe('Preset');
  });

  it('derives the preset shape kind from the region shape', () => {
    seedActiveRegion({ shape: createDefaultTypographyShape(100, 50, 'square') });
    const before = idsBefore();
    const { result } = renderHook(() => usePresetBrowserActions());
    act(() => {
      result.current.saveRegionAsPreset();
    });
    const created = createdPresets(before);
    expect(created).toHaveLength(1);
    expect(created[0]?.defaultShapeKind).toBe('square');
  });

  it('does nothing without an active region (no preset, no throw)', () => {
    useImageCollectionStore.setState({ activeId: null });
    useRegionEditorStore.setState({ aioDetectionsByImage: {}, aioSelectedRegionByImage: {} });
    const before = useRegionEditorStore.getState().typographyPresetState;
    const { result } = renderHook(() => usePresetBrowserActions());
    expect(() => {
      act(() => {
        result.current.saveRegionAsPreset();
      });
    }).not.toThrow();
    expect(useRegionEditorStore.getState().typographyPresetState).toBe(before);
    expect(result.current.saveName).toBe('');
  });

  it('does not persist when the active region has no renderStyle (documented contract)', () => {
    seedActiveRegion({ renderStyle: undefined });
    const before = useRegionEditorStore.getState().typographyPresetState;
    const { result } = renderHook(() => usePresetBrowserActions());
    act(() => {
      result.current.saveRegionAsPreset();
    });
    expect(useRegionEditorStore.getState().typographyPresetState).toBe(before);
    expect(result.current.saveName).toBe('');
  });
});

describe('handlePresetClick (toggle-off, multiselection apply, preview clear)', () => {
  const PRESET_ID = 'preset-under-test';
  type OnSelectPreset = (presetId: string | null) => void;
  type OnApplyToSelection = (presetId: string | null, scope?: 'multi' | 'sfxApproved') => void;
  let onSelectPreset: ReturnType<typeof vi.fn<OnSelectPreset>>;
  let onApplyToSelection: ReturnType<typeof vi.fn<OnApplyToSelection>>;

  beforeEach(() => {
    onSelectPreset = vi.fn<OnSelectPreset>();
    onApplyToSelection = vi.fn<OnApplyToSelection>();
    useImageCollectionStore.setState({ activeId: 'img-1' });
    useTypographerStore.setState({ typographerMultiSelectedByImage: {} });
    publishPresetPreview('stale-hover');
  });

  it('applies once and clears the preview signal under an active multiselection', () => {
    useTypographerStore.setState({
      typographerMultiSelectedByImage: { 'img-1': ['r-1', 'r-2'] },
    });
    const seen: Array<string | null> = [];
    const unsubscribe = subscribePresetPreview((value) => seen.push(value));
    const { result } = renderHook(() => usePresetBrowserActions());

    act(() => {
      result.current.handlePresetClick(
        PRESET_ID,
        null,
        onSelectPreset,
        onApplyToSelection,
      );
    });
    unsubscribe();

    expect(onSelectPreset).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).toHaveBeenCalledWith(PRESET_ID);
    expect(onApplyToSelection).toHaveBeenCalledTimes(1);
    expect(onApplyToSelection).toHaveBeenCalledWith(PRESET_ID, 'multi');
    expect(seen).toEqual([null]);
  });

  it('only selects without applying when there is no multiselection', () => {
    const { result } = renderHook(() => usePresetBrowserActions());
    const seen: Array<string | null> = [];
    const unsubscribe = subscribePresetPreview((value) => seen.push(value));

    act(() => {
      result.current.handlePresetClick(
        PRESET_ID,
        null,
        onSelectPreset,
        onApplyToSelection,
      );
    });
    unsubscribe();

    expect(onSelectPreset).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).toHaveBeenCalledWith(PRESET_ID);
    expect(onApplyToSelection).not.toHaveBeenCalled();
    expect(seen).toEqual([null]);
  });

  it('deselects without applying when the clicked preset is already selected', () => {
    const { result } = renderHook(() => usePresetBrowserActions());

    act(() => {
      result.current.handlePresetClick(
        PRESET_ID,
        PRESET_ID,
        onSelectPreset,
        onApplyToSelection,
      );
    });

    expect(onSelectPreset).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).toHaveBeenCalledWith(null);
    expect(onApplyToSelection).not.toHaveBeenCalled();
  });

  it('keeps the apply behavior when the clicked preset is selected AND multi is active', () => {
    useTypographerStore.setState({
      typographerMultiSelectedByImage: { 'img-1': ['r-1'] },
    });
    const { result } = renderHook(() => usePresetBrowserActions());

    act(() => {
      result.current.handlePresetClick(
        PRESET_ID,
        PRESET_ID,
        onSelectPreset,
        onApplyToSelection,
      );
    });

    expect(onSelectPreset).toHaveBeenCalledWith(PRESET_ID);
    expect(onApplyToSelection).toHaveBeenCalledTimes(1);
    expect(onApplyToSelection).toHaveBeenCalledWith(PRESET_ID, 'multi');
  });

  it('selects a different preset normally even without multiselection', () => {
    const { result } = renderHook(() => usePresetBrowserActions());

    act(() => {
      result.current.handlePresetClick(
        PRESET_ID,
        'other-preset',
        onSelectPreset,
        onApplyToSelection,
      );
    });

    expect(onSelectPreset).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).toHaveBeenCalledWith(PRESET_ID);
    expect(onApplyToSelection).not.toHaveBeenCalled();
  });
});

describe('resolveSfxModePresetId (preset bound to the SFX mode)', () => {
  const presets = [{ id: 'user-preset-1' }, { id: modeDefaultPresetId('text_sfx') }];

  it('returns the preset bound to the SFX mode', () => {
    expect(resolveSfxModePresetId(presets, { text_sfx: modeDefaultPresetId('text_sfx') }))
      .toBe(modeDefaultPresetId('text_sfx'));
    expect(resolveSfxModePresetId(presets, { text_sfx: 'user-preset-1' })).toBe('user-preset-1');
  });

  it('returns null when the SFX mode has no binding', () => {
    expect(resolveSfxModePresetId(presets, { text_bubble: 'user-preset-1' })).toBeNull();
  });

  it('returns null when the bound preset no longer exists', () => {
    expect(resolveSfxModePresetId(presets, { text_sfx: 'deleted-preset' })).toBeNull();
    expect(resolveSfxModePresetId([], { text_sfx: modeDefaultPresetId('text_sfx') })).toBeNull();
  });
});
