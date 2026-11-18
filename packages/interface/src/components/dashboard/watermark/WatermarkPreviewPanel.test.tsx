// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { createDirectPageFile } from '@/utils/page-source';
import WatermarkPreviewPanel from './WatermarkPreviewPanel';
import type {
  WatermarkLoadedImage,
  WatermarkResultEntry,
} from './watermarkTypes';

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

// jsdom may lack URL.createObjectURL depending on the runtime wiring; the
// render paths re-create evicted direct-page URLs through it.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (): string => '';
}

const makeFilters = (): WatermarkLoadedImage['filters'] => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
});

const makeImage = (
  id: string,
  url: string,
  thumbnailUrl?: string,
): WatermarkLoadedImage => ({
  id,
  file: createDirectPageFile(
    new File([new Uint8Array([137, 80, 78, 71])], `${id}.png`, {
      type: 'image/png',
    }),
  ),
  url,
  ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
  width: 8,
  height: 8,
  rotation: 0,
  filters: makeFilters(),
});

const noop = (): void => {};

const renderPanel = (
  images: WatermarkLoadedImage[],
  activeImage: WatermarkLoadedImage | null,
): ReturnType<typeof render> =>
  render(
    <I18nProvider>
      <WatermarkPreviewPanel
        images={images}
        activeImage={activeImage}
        activeTextZones={[]}
        textZoneCache={{}}
        resultsById={new Map<string, WatermarkResultEntry>()}
        hasRenderableLayer={true}
        previewUrl={null}
        previewBusy={false}
        previewAnchor="bottom-right"
        compareMode="preview"
        compareValue={58}
        zoom={1}
        showTextZoneOverlay={false}
        setActiveImageId={noop}
        setCompareMode={noop}
        setCompareValue={noop}
        setZoom={noop}
        thumbsStripRef={{ current: null }}
        previewStageRef={{ current: null }}
      />
    </I18nProvider>,
  );

describe('WatermarkPreviewPanel', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recreated');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('re-creates the stage URL for an evicted active image instead of rendering an empty src', () => {
    const evicted = makeImage('evicted-active', '');
    const { container } = renderPanel([evicted], evicted);

    const stageImg = container.querySelector<HTMLImageElement>(
      'img.koma-wm-stage__img',
    );
    expect(stageImg?.getAttribute('src')).toBe('blob:recreated');
  });

  it('keeps hydrated thumbnails for the strip and resolves evicted thumbs without one', () => {
    const live = makeImage('live', 'blob:live', 'blob:thumb-live');
    const evicted = makeImage('evicted-thumbless', '');
    const { container } = renderPanel([live, evicted], live);

    const liveThumb = container.querySelector<HTMLImageElement>(
      '[data-thumb-id="live"] img',
    );
    expect(liveThumb?.getAttribute('src')).toBe('blob:thumb-live');
    const evictedThumb = container.querySelector<HTMLImageElement>(
      '[data-thumb-id="evicted-thumbless"] img',
    );
    expect(evictedThumb?.getAttribute('src')).toBe('blob:recreated');
  });

  it('does not eagerly un-evict non-active images that already have a thumbnailUrl', () => {
    const active = makeImage('active', 'blob:active', 'blob:thumb-active');
    const evictedOne = makeImage('evicted-1', '', 'blob:thumb-1');
    const evictedTwo = makeImage('evicted-2', '', 'blob:thumb-2');

    renderPanel([active, evictedOne, evictedTwo], active);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
