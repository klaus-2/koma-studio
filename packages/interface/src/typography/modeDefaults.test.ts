// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RENDER_STYLE } from '../constants/dashboard.constants';
import type { AioTextRegion } from '../types/dashboard.types';
import type { TypographyPresetStateV1, TypographyStylePreset } from './types';
import {
  LEGACY_MODE_FOLDER_NAME,
  LEGACY_SFX_SEED_ID_PREFIX,
  MODE_DEFAULT_PRESET_NAMES,
  buildDefaultTypographyPresetState,
  migrateLegacyModePresets,
  modeDefaultPresetId,
  needsLegacyModeMigration,
} from './modeDefaults';
import {
  loadTypographyPresetState,
  resolveModeTypographyPreset,
  TYPOGRAPHY_PRESET_STORAGE_KEY,
} from './presets';
import { RENDER_MODE_PRESET_MODES } from '../utils/renderModePresets';
import { useRegionEditorStore } from '../pages/dashboard/stores/region-editor-store';
import { useImageCollectionStore } from '../pages/dashboard/stores/image-collection-store';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import {
  applyTypographyPresetToRegionIds,
  readSfxApprovedRegionIds,
} from '../pages/dashboard/hooks/region-editor';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const preset = (overrides: Partial<TypographyStylePreset>): TypographyStylePreset => ({
  id: 'user-preset-1',
  folderId: null,
  name: 'User Preset',
  description: '',
  style: { ...DEFAULT_RENDER_STYLE },
  defaultShapeKind: 'square',
  padding: 10,
  createdAt: 123,
  updatedAt: 123,
  ...overrides,
});

const legacyState = (): TypographyPresetStateV1 => ({
  version: 1,
  folders: [
    { id: 'folder-legacy', name: LEGACY_MODE_FOLDER_NAME, parentId: null, order: 0, createdAt: 1, updatedAt: 1 },
    { id: 'folder-user', name: 'Mine', parentId: null, order: 1, createdAt: 1, updatedAt: 1 },
  ],
  presets: [
    preset({
      id: 'legacy-text_bubble-1',
      folderId: 'folder-legacy',
      name: 'Legacy text_bubble',
      style: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Edited Bubble Font' },
    }),
    preset({ id: 'legacy-text_sfx-1', folderId: 'folder-legacy', name: 'Legacy text_sfx' }),
    preset({ id: `${LEGACY_SFX_SEED_ID_PREFIX}blam_impact`, name: 'SFX · Blam Impact', createdAt: 0, updatedAt: 0 }),
    preset({ id: `${LEGACY_SFX_SEED_ID_PREFIX}boom_comic`, name: 'SFX · Boom Comic', createdAt: 0, updatedAt: 50 }),
    preset({ id: 'user-preset-1', folderId: 'folder-user' }),
  ],
  modeBindings: {
    text_bubble: 'legacy-text_bubble-1',
    text_sfx: `${LEGACY_SFX_SEED_ID_PREFIX}blam_impact`,
    text_free: 'user-preset-1',
  },
  defaultPresetId: 'legacy-text_bubble-1',
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

describe('mode default presets', () => {
  it('starts with exactly the five mode defaults, each bound to its mode', () => {
    const state = loadTypographyPresetState();
    expect(state.folders).toEqual([]);
    expect(state.presets.map((entry) => entry.id)).toEqual(
      RENDER_MODE_PRESET_MODES.map(modeDefaultPresetId),
    );
    expect(state.presets.map((entry) => entry.name)).toEqual(
      RENDER_MODE_PRESET_MODES.map((mode) => MODE_DEFAULT_PRESET_NAMES[mode]),
    );
    for (const mode of RENDER_MODE_PRESET_MODES) {
      expect(state.modeBindings[mode]).toBe(modeDefaultPresetId(mode));
      expect(resolveModeTypographyPreset(mode, state)?.id).toBe(modeDefaultPresetId(mode));
    }
    expect(state.defaultPresetId).toBe(modeDefaultPresetId('text_bubble'));
  });

  it('keeps the fill in sync with the mode text color', () => {
    const state = buildDefaultTypographyPresetState(DEFAULT_RENDER_STYLE);
    const insideBlack = state.presets.find((entry) => entry.id === modeDefaultPresetId('text_inside_black_bubble'));
    expect(insideBlack?.style.color).toBe('#ffffff');
    expect(insideBlack?.style.fillCssValue).toBe('#ffffff');
  });

  it('carries the old per-mode overrides into the defaults', () => {
    const state = buildDefaultTypographyPresetState(DEFAULT_RENDER_STYLE, {
      text_bubble: {
        fontFamily: 'Comic Neue',
        fontSize: 30,
        bold: true,
        italic: false,
        color: '#123456',
        detectGradient: false,
        outlineEnabled: false,
        outlineColor: '#ffffff',
        outlineWidth: 4,
        uppercase: true,
      },
    });
    const bubble = state.presets.find((entry) => entry.id === modeDefaultPresetId('text_bubble'));
    expect(bubble?.style).toMatchObject({
      fontFamily: 'Comic Neue',
      fontSize: 30,
      color: '#123456',
      fillCssValue: '#123456',
      outlineWidth: 0,
      uppercase: true,
    });
  });

  it('does not bring a deleted default back on the next load', () => {
    const first = loadTypographyPresetState();
    const withoutFree = {
      ...first,
      presets: first.presets.filter((entry) => entry.id !== modeDefaultPresetId('text_free')),
    };
    window.localStorage.setItem(TYPOGRAPHY_PRESET_STORAGE_KEY, JSON.stringify(withoutFree));
    const second = loadTypographyPresetState();
    expect(second.presets.some((entry) => entry.id === modeDefaultPresetId('text_free'))).toBe(false);
  });

  it('falls back to the defaults on a corrupted payload', () => {
    window.localStorage.setItem(TYPOGRAPHY_PRESET_STORAGE_KEY, '{not-json');
    const state = loadTypographyPresetState();
    expect(state.presets.map((entry) => entry.id)).toEqual(RENDER_MODE_PRESET_MODES.map(modeDefaultPresetId));
  });
});

describe('legacy mode preset migration', () => {
  it('detects the legacy folder, legacy names and untouched SFX seeds', () => {
    expect(needsLegacyModeMigration(legacyState())).toBe(true);
    expect(needsLegacyModeMigration(buildDefaultTypographyPresetState(DEFAULT_RENDER_STYLE))).toBe(false);
  });

  it('turns legacy presets into the mode defaults and keeps user edits', () => {
    const migrated = migrateLegacyModePresets(legacyState(), DEFAULT_RENDER_STYLE);
    const bubble = migrated.presets.find((entry) => entry.id === modeDefaultPresetId('text_bubble'));
    expect(bubble).toMatchObject({ name: 'Bubble', folderId: null, description: '' });
    expect(bubble?.style.fontFamily).toBe('Edited Bubble Font');
    expect(migrated.presets.some((entry) => entry.name.startsWith('Legacy '))).toBe(false);
    expect(migrated.folders.map((folder) => folder.name)).toEqual(['Mine']);
    expect(migrated.defaultPresetId).toBe(modeDefaultPresetId('text_bubble'));
  });

  it('drops untouched SFX seeds and keeps edited ones and user presets', () => {
    const migrated = migrateLegacyModePresets(legacyState(), DEFAULT_RENDER_STYLE);
    const ids = migrated.presets.map((entry) => entry.id);
    expect(ids).not.toContain(`${LEGACY_SFX_SEED_ID_PREFIX}blam_impact`);
    expect(ids).toContain(`${LEGACY_SFX_SEED_ID_PREFIX}boom_comic`);
    expect(migrated.presets.find((entry) => entry.id === 'user-preset-1')?.folderId).toBe('folder-user');
  });

  it('remaps bindings, rebinds removed seeds to the defaults and keeps user bindings', () => {
    const migrated = migrateLegacyModePresets(legacyState(), DEFAULT_RENDER_STYLE);
    expect(migrated.modeBindings).toEqual({
      text_bubble: modeDefaultPresetId('text_bubble'),
      text_sfx: modeDefaultPresetId('text_sfx'),
      text_free: 'user-preset-1',
      text_inside_black_bubble: modeDefaultPresetId('text_inside_black_bubble'),
      text_narration: modeDefaultPresetId('text_narration'),
    });
    for (const mode of RENDER_MODE_PRESET_MODES) {
      expect(migrated.presets.filter((entry) => entry.id === modeDefaultPresetId(mode))).toHaveLength(1);
    }
  });

  it('keeps a legacy preset as a user preset when its default already exists', () => {
    const state = legacyState();
    const withDefault = {
      ...state,
      presets: [...state.presets, preset({ id: modeDefaultPresetId('text_bubble'), name: 'Bubble' })],
    };
    const migrated = migrateLegacyModePresets(withDefault, DEFAULT_RENDER_STYLE);
    expect(migrated.presets.filter((entry) => entry.id === modeDefaultPresetId('text_bubble'))).toHaveLength(1);
    expect(migrated.presets.find((entry) => entry.id === 'legacy-text_bubble-1')?.folderId).toBeNull();
  });

  it('migrates a stored legacy state once and persists the result', () => {
    window.localStorage.setItem(TYPOGRAPHY_PRESET_STORAGE_KEY, JSON.stringify(legacyState()));
    const first = loadTypographyPresetState();
    expect(needsLegacyModeMigration(first)).toBe(false);
    const stored = JSON.parse(window.localStorage.getItem(TYPOGRAPHY_PRESET_STORAGE_KEY) ?? '{}') as TypographyPresetStateV1;
    expect(stored.presets.map((entry) => entry.id)).toEqual(first.presets.map((entry) => entry.id));
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
      typographyPresetState: loadTypographyPresetState(),
    });
    return { r1, r2 };
  };

  it('collects exactly the sfxApproved ids', () => {
    seed();
    expect(readSfxApprovedRegionIds('img-1')).toEqual(['r-1']);
    expect(readSfxApprovedRegionIds('missing')).toEqual([]);
  });

  it('applies the SFX mode preset in ONE commit to approved regions only', () => {
    const sfxId = modeDefaultPresetId('text_sfx');
    let committedRegions: AioTextRegion[] = [];
    const { r2 } = seed();
    const result = applyTypographyPresetToRegionIds(
      'img-1',
      readSfxApprovedRegionIds('img-1'),
      (_imageId, nextRegions) => {
        committedRegions = nextRegions;
      },
      sfxId,
    );
    expect(result).toMatchObject({ kind: 'applied', count: 1 });
    const committed = committedRegions.find((next) => next.id === 'r-1');
    expect(committed?.stylePresetId).toBe(sfxId);
    expect(committed?.renderStyle?.bold).toBe(true);
    expect(committedRegions.some((next) => next.id === 'r-2')).toBe(true);
    expect(r2.renderStyle?.fontFamily).toBe('Region Font');
    expect(r2.stylePresetId).toBeUndefined();
  });

  it('reports no-preset for an unknown preset id without committing', () => {
    seed();
    let commits = 0;
    const result = applyTypographyPresetToRegionIds(
      'img-1',
      ['r-1'],
      () => {
        commits++;
      },
      'does-not-exist',
    );
    expect(result).toEqual({ kind: 'no-preset' });
    expect(commits).toBe(0);
  });
});
