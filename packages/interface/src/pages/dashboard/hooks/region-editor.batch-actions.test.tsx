// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { TypographyStylePreset } from '../../../typography/types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTypographerWorkspace } from './typographer';
import {
  applyTypographyPresetToRegionIds,
  removeAioRegionsByIds,
} from './region-editor';
import { useAioRegionSnapshotSync } from './region-editor.snapshot';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const region = (
  id: string,
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox: [10, 10, 110, 60],
  score: 0.9,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
  renderStyle: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Region Font' },
  ...overrides,
});

const preset = (): TypographyStylePreset => ({
  id: 'preset-1',
  folderId: null,
  name: 'Batch Preset',
  description: '',
  style: { ...DEFAULT_RENDER_STYLE, fontFamily: 'Preset Font', fontSize: 33 },
  defaultShapeKind: 'rounded',
  padding: 10,
  createdAt: 0,
  updatedAt: 0,
});

/** Fresh seeded region objects, kept around so identity can be asserted. */
let seeded: { r1: AioTextRegion; r2: AioTextRegion; r3: AioTextRegion };

const seedStores = (options: { presets: boolean } = { presets: true }): void => {
  seeded = {
    r1: region('r-1', { renderMode: 'auto', detectedRenderMode: 'text_bubble' }),
    r2: region('r-2', { renderMode: 'auto', detectedRenderMode: 'text_bubble' }),
    r3: region('r-3', { renderMode: 'auto', detectedRenderMode: 'text_bubble' }),
  };
  useImageCollectionStore.setState({ activeId: 'img-1' });
  // The mount effect of the region editing hook normalizes every region when
  // the render step is on; disable it so the seeded raw regions stay as-is.
  useAioPipelineStore.setState({
    aioSteps: { ...useAioPipelineStore.getState().aioSteps, render: false },
  });
  useRegionEditorStore.setState({
    aioDetectionsByImage: { 'img-1': [seeded.r1, seeded.r2, seeded.r3] },
    aioSelectedRegionByImage: { 'img-1': 'r-1' },
  });
  const current = useRegionEditorStore.getState().typographyPresetState;
  useRegionEditorStore.setState({
    typographyPresetState: options.presets
      ? {
        ...current,
        presets: [preset()],
        modeBindings: { text_bubble: 'preset-1' },
      }
      : {
        ...current,
        presets: [],
        modeBindings: {},
        defaultPresetId: null,
      },
  });
};

const mountCommitter = () => {
  const { result } = renderHook(
    () => {
      const typographerWorkspace = useTypographerWorkspace({ images: [] });
      const snapshotSync = useAioRegionSnapshotSync({
        getAioImageSnapshotIndex: () => -1,
        syncManualStagePreviewToNextStage: vi.fn(),
        typographerWorkspace,
      });
      return snapshotSync;
    },
    { wrapper: I18nProvider },
  );
  return result.current;
};

const spyCommitter = () => {
  const snapshotSync = mountCommitter();
  const commitSpy = vi.fn(
    (...args: Parameters<typeof snapshotSync.applyAioRegionsEditForImage>) => {
      snapshotSync.applyAioRegionsEditForImage(...args);
    },
  );
  return { commitSpy };
};

beforeEach(() => {
  seedStores();
});

describe('applyTypographyPresetToRegionIds (I4 batch)', () => {
  it('applies the active preset to exactly the requested ids in ONE committed edit', () => {
    const { commitSpy } = spyCommitter();

    const result = applyTypographyPresetToRegionIds(
      'img-1',
      ['r-1', 'r-3'],
      commitSpy,
    );

    expect(result).toEqual({
      kind: 'applied',
      count: 2,
      presetName: 'Batch Preset',
    });
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(store['img-1']?.find((next) => next.id === 'r-1')?.renderStyle?.fontFamily).toBe('Preset Font');
    expect(store['img-1']?.find((next) => next.id === 'r-1')?.stylePresetId).toBe('preset-1');
    expect(store['img-1']?.find((next) => next.id === 'r-3')?.renderStyle?.fontFamily).toBe('Preset Font');
    // Untouched regions keep their object identity (clone-on-write).
    expect(store['img-1']?.find((next) => next.id === 'r-2')).toBe(seeded.r2);
    expect(seeded.r2.renderStyle?.fontFamily).toBe('Region Font');
  });

  it('reports a no-preset no-op without committing anything', () => {
    seedStores({ presets: false });
    const { commitSpy } = spyCommitter();

    const result = applyTypographyPresetToRegionIds(
      'img-1',
      ['r-1'],
      commitSpy,
    );

    expect(result).toEqual({ kind: 'no-preset' });
    expect(commitSpy).not.toHaveBeenCalled();
    expect(useRegionEditorStore.getState().aioDetectionsByImage['img-1']).toEqual([
      seeded.r1,
      seeded.r2,
      seeded.r3,
    ]);
  });

  it('reports empty when none of the ids exist, without committing', () => {
    const { commitSpy } = spyCommitter();

    const result = applyTypographyPresetToRegionIds(
      'img-1',
      ['missing'],
      commitSpy,
    );

    expect(result).toEqual({ kind: 'empty' });
    expect(commitSpy).not.toHaveBeenCalled();
  });
});

describe('removeAioRegionsByIds (I4 batch)', () => {
  it('removes the ids and clears the active selection in the SAME single edit', () => {
    const { commitSpy } = spyCommitter();

    const result = removeAioRegionsByIds('img-1', ['r-1', 'r-2'], commitSpy);

    expect(result).toEqual({ kind: 'removed', count: 2 });
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const state = useRegionEditorStore.getState();
    const keptRegions = state.aioDetectionsByImage['img-1'] ?? [];
    expect(keptRegions.map((next) => next.id)).toEqual(['r-3']);
    expect(state.aioSelectedRegionByImage['img-1']).toBeNull();
  });

  it('keeps the active selection when it survives the batch removal', () => {
    useRegionEditorStore.setState({
      aioSelectedRegionByImage: { 'img-1': 'r-3' },
    });
    const { commitSpy } = spyCommitter();

    const result = removeAioRegionsByIds('img-1', ['r-1'], commitSpy);

    expect(result).toEqual({ kind: 'removed', count: 1 });
    expect(
      (useRegionEditorStore.getState().aioDetectionsByImage['img-1'] ?? []).map(
        (next) => next.id,
      ),
    ).toEqual(['r-2', 'r-3']);
    expect(useRegionEditorStore.getState().aioSelectedRegionByImage['img-1']).toBe('r-3');
  });

  it('reports empty for an empty id list or unknown ids without committing', () => {
    const { commitSpy } = spyCommitter();

    expect(removeAioRegionsByIds('img-1', [], commitSpy)).toEqual({ kind: 'empty' });
    expect(removeAioRegionsByIds('img-1', ['missing'], commitSpy)).toEqual({
      kind: 'empty',
    });
    expect(commitSpy).not.toHaveBeenCalled();
    expect(useRegionEditorStore.getState().aioDetectionsByImage['img-1']).toEqual([
      seeded.r1,
      seeded.r2,
      seeded.r3,
    ]);
  });
});
