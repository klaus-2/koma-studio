// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import type { AioTextRegion } from '../types/dashboard.types';
import type { TypographyStylePreset } from './types';
import {
  SFX_SEED_EFFECT_IDS,
  SFX_SEED_ID_PREFIX,
  seedSfxPresets,
} from './sfxPresetSeed';
import { loadTypographyPresetState, TYPOGRAPHY_PRESET_STORAGE_KEY } from './presets';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';
import { useImageCollectionStore } from '../pages/dashboard/stores/image-collection-store';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import {
  applyTypographyPresetToRegionIds,
  readSfxApprovedRegionIds,
} from '../pages/dashboard/hooks/region-editor';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const userPreset = (): TypographyStylePreset => ({
  id: 'user-preset-1',
  folderId: null,
  name: 'User Preset',
  description: '',
  style: { ...DEFAULT_RENDER_STYLE },
  defaultShapeKind: 'square',
  padding: 10,
  createdAt: 123,
  updatedAt: 123,
});

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
});

describe('seedSfxPresets (pure, idempotent)', () => {
  it('adds the curated seeds on first load', () => {
    const state = loadTypographyPresetState();
    const seededIds = state.presets
      .filter((preset) => preset.id.startsWith(SFX_SEED_ID_PREFIX))
      .map((preset) => preset.id);
    expect(seededIds).toEqual(
      SFX_SEED_EFFECT_IDS.map((effectId) => `${SFX_SEED_ID_PREFIX}${effectId}`),
    );
  });

  it('keeps a deleted seed deleted on the second load (delete is a decision)', () => {
    const first = loadTypographyPresetState();
    const withoutSeeds = {
      ...first,
      presets: first.presets.filter((preset) => !preset.id.startsWith(SFX_SEED_ID_PREFIX)),
    };
    window.localStorage.setItem(TYPOGRAPHY_PRESET_STORAGE_KEY, JSON.stringify(withoutSeeds));
    const second = loadTypographyPresetState();
    expect(second.presets.some((preset) => preset.id.startsWith(SFX_SEED_ID_PREFIX))).toBe(false);
    const withOneSeed = {
      ...second,
      presets: [...second.presets, { ...second.presets[0]!, id: `${SFX_SEED_ID_PREFIX}tremble_brush` }],
    };
    expect(seedSfxPresets(withOneSeed)).toBe(withOneSeed);
  });

  it('does not overwrite user presets and seeds coexist with them', () => {
    const first = loadTypographyPresetState();
    const withUser = { ...first, presets: [userPreset(), ...first.presets] };
    const seeded = seedSfxPresets(withUser);
    const user = seeded.presets.find((preset) => preset.id === 'user-preset-1');
    expect(user).toBe(withUser.presets[0]);
    expect(seeded.presets.filter((preset) => preset.id.startsWith(SFX_SEED_ID_PREFIX)))
      .toHaveLength(SFX_SEED_EFFECT_IDS.length);
  });

  it('survives a corrupted storage payload (sanitize handles it)', () => {
    window.localStorage.setItem(TYPOGRAPHY_PRESET_STORAGE_KEY, '{not-json');
    const state = loadTypographyPresetState();
    expect(state.version).toBe(1);
    expect(state.presets.length).toBeGreaterThan(0);
    expect(state.presets.some((preset) => preset.id.startsWith(SFX_SEED_ID_PREFIX))).toBe(true);
  });

  it('passes through a non-array presets field untouched (sanitize owns it)', () => {
    expect(
      seedSfxPresets({ ...loadTypographyPresetState(), presets: undefined as unknown as never[] }),
    ).toMatchObject({ version: 1 });
  });
});

describe('SFX approved-region application (single commit via B1 core)', () => {
  const seed = (): { r1: AioTextRegion; r2: AioTextRegion } => {
    const r1 = region('r-1', { sfxApproved: true });
    const r2 = region('r-2', { sfxApproved: false });
    useImageCollectionStore.setState({ activeId: 'img-1' });
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [r1, r2] },
      aioSelectedRegionByImage: { 'img-1': 'r-1' },
      typographyPresetState: seedSfxPresets(loadTypographyPresetState()),
    });
    return { r1, r2 };
  };

  it('collects exactly the sfxApproved ids', () => {
    seed();
    expect(readSfxApprovedRegionIds('img-1')).toEqual(['r-1']);
    expect(readSfxApprovedRegionIds('missing')).toEqual([]);
  });

  it('applies one SFX seed preset in ONE commit to approved regions only', () => {
    const seedId = `${SFX_SEED_ID_PREFIX}blam_impact`;
    let committedRegions: AioTextRegion[] = [];
    const { r2 } = seed();
    const result = applyTypographyPresetToRegionIds(
      'img-1',
      readSfxApprovedRegionIds('img-1'),
      (_imageId, nextRegions) => {
        committedRegions = nextRegions;
      },
      seedId,
    );
    expect(result).toMatchObject({ kind: 'applied', count: 1 });
    const committed = committedRegions.find((next) => next.id === 'r-1');
    expect(committedRegions.length).toBeGreaterThan(0);
    expect(committed?.stylePresetId).toBe(seedId);
    expect(committed?.renderStyle?.textEffectPreset).toBe('blam_impact');
    expect(committedRegions.some((next) => next.id === 'r-2')).toBe(true);
    expect(r2.renderStyle?.fontFamily).toBe('Region Font');
    expect(r2.stylePresetId).toBeUndefined();
  });

  it('reports no-preset for an unknown seed id without committing', () => {
    seed();
    let commits = 0;
    const result = applyTypographyPresetToRegionIds(
      'img-1',
      ['r-1'],
      () => {
        commits++;
      },
      `${SFX_SEED_ID_PREFIX}does_not_exist`,
    );
    expect(result).toEqual({ kind: 'no-preset' });
    expect(commits).toBe(0);
  });
});
