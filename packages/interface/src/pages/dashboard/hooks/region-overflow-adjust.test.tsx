// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import type {
  AioTextRegion,
  ImageFilters,
} from '../../../types/dashboard.types';
import type { DirectPageFile } from '../../../utils/page-source';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useStatusStore } from '../stores/status-store';
import { useRegionOverflowReview } from './region-overflow-adjust';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

// jsdom has no 2D canvas: stub the region text measurer with a size-linear
// layout ("Hello" = 6px per size unit — fits the 100px bbox from size 16).
vi.mock('../../../components/dashboard/render-text-preview/canvasDrawing', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../components/dashboard/render-text-preview/canvasDrawing')
    >();
  return {
    ...actual,
    createRegionTextMeasurer:
      () =>
      (
        targetRegion: AioTextRegion,
        fontSizeOverride: number | undefined,
      ) => {
      const style = targetRegion.renderStyle;
      const fontSize =
        fontSizeOverride ?? (style ? style.fontSize : undefined);
      const text = (targetRegion.renderText ?? '').trim();
      if (fontSize === undefined || text.length === 0) return null;
        return {
          textWidth: text.length * 1.2 * fontSize,
          textHeight: fontSize * 1.2,
          fontSize,
        };
      },
  };
});

const directPage = (): DirectPageFile => {
  const file = new File([], 'page.png');
  return {
    kind: 'direct',
    name: 'page.png',
    type: 'image/png',
    size: 0,
    lastModified: 0,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 100, height: 40 }),
    release: () => {},
  };
};

const filters: ImageFilters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const region = (
  id: string,
  overrides: Partial<AioTextRegion> = {},
): AioTextRegion => ({
  id,
  bbox: [0, 0, 100, 40],
  score: 1,
  source: 'model',
  modelKey: 'font_rtdetr_v2',
  renderText: 'Hello',
  renderStyle: {
    ...DEFAULT_RENDER_STYLE,
    fontSize: 20,
    minFontSize: 8,
    autoFontSize: false,
  },
  ...overrides,
});

describe('useRegionOverflowReview style-lock gating', () => {
  beforeEach(() => {
    useImageCollectionStore.setState({
      images: [
        {
          id: 'img-1',
          file: directPage(),
          url: 'blob:img-1',
          width: 100,
          height: 40,
          rotation: 0,
          filters,
        },
      ],
      activeId: 'img-1',
    });
  });

  it('adjustPage fits only the unlocked region and keeps the style-locked one untouched', () => {
    const locked = region('locked', {
      lockedFields: { style: true },
    });
    const unlocked = region('plain');
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [locked, unlocked] },
    });
    const setStatusMessage = vi.fn();
    useStatusStore.setState({ setStatusMessage });

    const { result } = renderHook(() => useRegionOverflowReview(), {
      wrapper: I18nProvider,
    });

    result.current.adjustPage('img-1');

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    const nextRegions = store['img-1'] ?? [];
    expect(nextRegions).toHaveLength(2);
    const nextLocked = nextRegions.find((next) => next.id === 'locked');
    expect(nextLocked).toBe(locked);
    expect(nextLocked?.renderStyle?.fontSize).toBe(20);
    const nextUnlocked = nextRegions.find((next) => next.id === 'plain');
    expect(nextUnlocked).not.toBe(unlocked);
    expect(nextUnlocked?.renderStyle?.fontSize).toBe(16);
    // Page report (1 fitted), not the nothing-to-adjust notice.
    const lastMessage = setStatusMessage.mock.calls.at(-1)?.[0] as string;
    expect(lastMessage).not.toContain('nothingToAdjust');
  });

  it('reports nothing-to-adjust and writes nothing when every region is style-locked', () => {
    const lockedA = region('locked-a', { lockedFields: { style: true } });
    const lockedB = region('locked-b', { lockedFields: { style: true } });
    useRegionEditorStore.setState({
      aioDetectionsByImage: { 'img-1': [lockedA, lockedB] },
    });
    const setStatusMessage = vi.fn();
    useStatusStore.setState({ setStatusMessage });

    const { result } = renderHook(() => useRegionOverflowReview(), {
      wrapper: I18nProvider,
    });

    result.current.adjustPage('img-1');

    const store = useRegionEditorStore.getState().aioDetectionsByImage;
    expect(store['img-1']?.[0]).toBe(lockedA);
    expect(store['img-1']?.[1]).toBe(lockedB);
    const lastMessage = setStatusMessage.mock.calls.at(-1)?.[0] as string;
    expect(lastMessage).toContain('Nothing to adjust');
  });
});
