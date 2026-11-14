// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTypographerWorkspace } from './typographer';
import { useAioRegionEditing } from './region-editor';
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
  ...overrides,
});

const sourceStyle = (): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  fontFamily: 'Source Font',
  fontSize: 42,
  color: '#ff0000',
  outlineColor: '#00ff00',
  outlineOpacity: 0.5,
  outlineWidth: 3,
  alignment: 'center',
});

const targetStyle = (): RenderTextStyle => ({
  ...DEFAULT_RENDER_STYLE,
  fontFamily: 'Target Font',
  fontSize: 20,
  color: '#123456',
  outlineColor: '#654321',
  outlineOpacity: 0.9,
  outlineWidth: 1,
  alignment: 'left',
});

const LOCKED_RANGES = [{ start: 3, end: 5, style: { italic: true } }];

/** Fresh seeded region objects, kept around so identity can be asserted. */
let seeded: {
  src: AioTextRegion;
  locked: AioTextRegion;
  gone: AioTextRegion;
  plain: AioTextRegion;
  other: AioTextRegion;
};

const seedStores = (): void => {
  seeded = {
    src: region('src', {
      renderStyle: sourceStyle(),
      renderTextStyleRanges: [{ start: 0, end: 2, style: { bold: true } }],
    }),
    locked: region('locked', {
      renderStyle: targetStyle(),
      lockedFields: { style: true },
      locked: false,
      renderTextStyleRanges: LOCKED_RANGES,
    }),
    gone: region('gone', { renderStyle: targetStyle(), hidden: true }),
    plain: region('plain', { renderStyle: targetStyle() }),
    other: region('other', { renderStyle: targetStyle() }),
  };
  useImageCollectionStore.setState({ activeId: 'img-1' });
  // The mount effect of useAioRegionEditing normalizes every region when the
  // render step is on; disable it so the seeded raw regions stay untouched.
  useAioPipelineStore.setState({ aioSteps: { ...useAioPipelineStore.getState().aioSteps, render: false } });
  useRegionEditorStore.setState({
    aioDetectionsByImage: {
      'img-1': [seeded.src, seeded.locked, seeded.gone, seeded.plain],
      'img-2': [seeded.other],
    },
    aioSelectedRegionByImage: { 'img-1': 'src', 'img-2': 'other' },
  });
};

describe('applyActiveRenderStyleToAllRegions', () => {
  beforeEach(() => {
    seedStores();
  });

  // Real store write path: useAioRegionSnapshotSync.applyAioRegionsEditForImage
  // REPLACES each image's region list, so assertions run against
  // useRegionEditorStore state instead of a mocked callback.
  const mountEditing = () =>
    renderHook(
      () => {
        const typographerWorkspace = useTypographerWorkspace({ images: [] });
        const snapshotSync = useAioRegionSnapshotSync({
          getAioImageSnapshotIndex: () => -1,
          syncManualStagePreviewToNextStage: vi.fn(),
          typographerWorkspace,
        });
        return useAioRegionEditing({
          typographerWorkspace,
          applyAioRegionsEditForImage: snapshotSync.applyAioRegionsEditForImage,
          selectAioRegionForImage: snapshotSync.selectAioRegionForImage,
          updateTranslatorRegionsForImage: vi.fn(),
          updateCleanerRegionsForImage: vi.fn(),
          translatorDetectionsByImage: () => ({}),
          cleanerDetectionsByImage: () => ({}),
        });
      },
      { wrapper: I18nProvider },
    );

  it('keeps the wholesale behavior for the zero-arg invocation', () => {
    const { result } = mountEditing();

    result.current.applyActiveRenderStyleToAllRegions();

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(store['img-1']).toHaveLength(4);
    for (const next of store['img-1'] ?? []) {
      expect(next.renderStyle?.fontFamily).toBe('Source Font');
      expect(next.renderStyle?.fontSize).toBe(42);
    }
    expect(store['img-2']?.[0]?.renderStyle?.fontFamily).toBe('Source Font');
    // Target ranges stay untouched on the wholesale path.
    const kept = store['img-1']?.find((next) => next.id === 'locked');
    expect(kept?.renderTextStyleRanges).toEqual(LOCKED_RANGES);
  });

  it('reaches the wholesale path through the explicit all-attributes + all-pages options', () => {
    const { result } = mountEditing();

    result.current.applyActiveRenderStyleToAllRegions({
      attributes: ['fontFamily', 'fontSize', 'color', 'outline', 'alignment'],
      scope: 'allPages',
    });

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    // Wholesale path does not skip style-locked or hidden regions.
    expect(store['img-1']?.map((next) => next.id)).toEqual([
      'src',
      'locked',
      'gone',
      'plain',
    ]);
    expect(store['img-1']?.[0]?.renderStyle?.fontFamily).toBe('Source Font');
  });

  it('projects only the checked attributes and passes locked/hidden targets through untouched', () => {
    const { result } = mountEditing();

    result.current.applyActiveRenderStyleToAllRegions({
      attributes: ['fontFamily'],
      scope: 'allPages',
    });

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    // (a) ALL regions still present — the edit replaces the whole list.
    expect(store['img-1']?.map((next) => next.id)).toEqual([
      'src',
      'locked',
      'gone',
      'plain',
    ]);
    // (b) locked/hidden keep their pre-apply style and identity.
    const locked = store['img-1']?.find((next) => next.id === 'locked');
    expect(locked).toBe(seeded.locked);
    expect(locked?.renderStyle?.fontFamily).toBe('Target Font');
    expect(locked?.renderStyle?.fontSize).toBe(20);
    expect(locked?.renderTextStyleRanges).toEqual(LOCKED_RANGES);
    const gone = store['img-1']?.find((next) => next.id === 'gone');
    expect(gone).toBe(seeded.gone);
    expect(gone?.renderStyle?.fontFamily).toBe('Target Font');
    // (c) plain receives the projected style and the copied source ranges.
    const plain = store['img-1']?.find((next) => next.id === 'plain');
    expect(plain).not.toBe(seeded.plain);
    expect(plain?.renderStyle?.fontFamily).toBe('Source Font');
    expect(plain?.renderStyle?.fontSize).toBe(20);
    expect(plain?.renderStyle?.color).toBe('#123456');
    expect(plain?.renderStyle?.alignment).toBe('left');
    expect(plain?.renderTextStyleRanges).toEqual([
      { start: 0, end: 2, style: { bold: true } },
    ]);
    // The other page is projected too (allPages scope).
    expect(store['img-2']?.[0]?.renderStyle?.fontFamily).toBe('Source Font');
  });

  it('clears the target ranges when the font-family attribute is unchecked', () => {
    const { result } = mountEditing();

    result.current.applyActiveRenderStyleToAllRegions({
      attributes: ['color'],
      scope: 'allPages',
    });

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(store['img-1']?.map((next) => next.id)).toEqual([
      'src',
      'locked',
      'gone',
      'plain',
    ]);
    const plain = store['img-1']?.find((next) => next.id === 'plain');
    expect(plain?.renderStyle?.color).toBe('#ff0000');
    expect(plain?.renderStyle?.fontFamily).toBe('Target Font');
    expect(plain?.renderTextStyleRanges).toBeUndefined();
    const locked = store['img-1']?.find((next) => next.id === 'locked');
    expect(locked).toBe(seeded.locked);
  });

  it('writes only the active image when the scope is the current page', () => {
    const { result } = mountEditing();

    result.current.applyActiveRenderStyleToAllRegions({
      attributes: ['fontFamily'],
      scope: 'currentPage',
    });

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(store['img-1']?.map((next) => next.id)).toEqual([
      'src',
      'locked',
      'gone',
      'plain',
    ]);
    expect(store['img-1']?.find((next) => next.id === 'plain')?.renderStyle?.fontFamily).toBe(
      'Source Font',
    );
    // The other page was never written: identity and style stay pre-apply.
    expect(store['img-2']?.[0]).toBe(seeded.other);
    expect(store['img-2']?.[0]?.renderStyle?.fontFamily).toBe('Target Font');
  });

  it('never deletes a hidden selected region and does not crash on the hidden-selection edge', () => {
    useRegionEditorStore.setState({
      aioDetectionsByImage: {
        'img-1': [seeded.src],
        'img-2': [seeded.gone],
      },
      aioSelectedRegionByImage: { 'img-1': 'src', 'img-2': 'gone' },
    });
    const { result } = mountEditing();

    expect(() =>
      result.current.applyActiveRenderStyleToAllRegions({
        attributes: ['fontFamily'],
        scope: 'allPages',
      }),
    ).not.toThrow();

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    // The hidden sole region of img-2 survives the apply.
    expect(store['img-2']).toEqual([seeded.gone]);
    expect(store['img-2']?.[0]?.hidden).toBe(true);
  });
});
