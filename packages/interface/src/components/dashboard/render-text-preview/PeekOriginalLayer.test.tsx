// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PeekOriginalLayer,
  usePeekOriginalOverlayHidden,
} from './PeekOriginalLayer';
import { ensureDirectPageUrl } from '@/pages/dashboard/hooks/image-collection';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { LoadedImage } from '@/types/dashboard.types';

const filters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const image = (overrides: Partial<LoadedImage> = {}): LoadedImage => ({
  id: 'img-1',
  file: {
    kind: 'direct',
    name: 'page.png',
    type: 'image/png',
    size: 0,
    lastModified: 0,
    resident: new File([], 'page.png'),
    toBlob: async () => new Blob(),
    dimensions: async () => ({ width: 100, height: 40 }),
    release: () => {},
  },
  url: 'blob:img-1',
  width: 100,
  height: 40,
  rotation: 0,
  filters,
  ...overrides,
});

const renderLayer = (props: {
  image: LoadedImage;
  active: boolean;
  previewSrc: string;
  variant?: 'classic' | 'noir';
}): void => {
  render(
    <PeekOriginalLayer
      image={props.image}
      active={props.active}
      previewSrc={props.previewSrc}
      imgElemWidth={480}
      variant={props.variant ?? 'classic'}
    />,
  );
};

beforeEach(() => {
  useUiShellStore.setState({ holdOriginalActive: false });
  useImageCollectionStore.setState({
    images: [image()],
    activeId: 'img-1',
  });
});

afterEach(cleanup);

describe('PeekOriginalLayer', () => {
  it('shows the preview src while the hold is inactive', () => {
    renderLayer({ image: image(), active: true, previewSrc: 'blob:preview' });
    expect(
      screen.getByAltText('page.png').getAttribute('src'),
    ).toBe('blob:preview');
  });

  it('switches to the direct page URL while holding on the active card', () => {
    useUiShellStore.setState({ holdOriginalActive: true });
    renderLayer({ image: image(), active: true, previewSrc: 'blob:preview' });
    expect(screen.getByAltText('page.png').getAttribute('src')).toBe(
      'blob:img-1',
    );
  });

  it('keeps the preview src when the hold is active on an inactive card', () => {
    useUiShellStore.setState({ holdOriginalActive: true });
    renderLayer({ image: image(), active: false, previewSrc: 'blob:preview' });
    expect(
      screen.getByAltText('page.png').getAttribute('src'),
    ).toBe('blob:preview');
  });

  it('falls back to the preview src for an archive page (no direct URL)', () => {
    useUiShellStore.setState({ holdOriginalActive: true });
    const archivePage: LoadedImage = {
      ...image({ url: '' }),
      file: {
        kind: 'archive',
        name: 'page.png',
        type: 'image/png',
        size: 0,
        lastModified: 0,
        toBlob: async () => new Blob(),
        dimensions: async () => ({ width: 100, height: 40 }),
        release: () => {},
        chapter: {
          id: 'archive:test',
          label: 'test.zip',
          archive: new File([], 'test.zip'),
          entries: [],
        },
        entry: {
          path: 'page.png',
          compressedSize: 0,
          uncompressedSize: 0,
          method: 0,
          compressedOffset: 0,
        },
      },
    };
    renderLayer({
      image: archivePage,
      active: true,
      previewSrc: 'blob:preview',
    });
    expect(
      screen.getByAltText('page.png').getAttribute('src'),
    ).toBe('blob:preview');
  });

  it('re-creates a revoked direct URL synchronously during the hold', () => {
    useUiShellStore.setState({ holdOriginalActive: true });
    renderLayer({
      image: image({ url: '' }),
      active: true,
      previewSrc: 'blob:preview',
    });
    const src = screen.getByAltText('page.png').getAttribute('src');
    expect(src).toMatch(/^blob:/);
    expect(src).not.toBe('blob:preview');
    expect(src).not.toBe('');
  });

  it('contract: an empty ensureDirectPageUrl result falls back to the preview src (shared by PreviewStageItem via || semantics)', () => {
    useUiShellStore.setState({ holdOriginalActive: true });
    const archivePage: LoadedImage = {
      ...image({ url: '' }),
      file: {
        kind: 'archive',
        name: 'page.png',
        type: 'image/png',
        size: 0,
        lastModified: 0,
        toBlob: async () => new Blob(),
        dimensions: async () => ({ width: 100, height: 40 }),
        release: () => {},
        chapter: {
          id: 'archive:test',
          label: 'test.zip',
          archive: new File([], 'test.zip'),
          entries: [],
        },
        entry: {
          path: 'page.png',
          compressedSize: 0,
          uncompressedSize: 0,
          method: 0,
          compressedOffset: 0,
        },
      },
    };
    const fallback = 'blob:preview';
    renderLayer({ image: archivePage, active: true, previewSrc: fallback });
    const layerSrc = screen.getByAltText('page.png').getAttribute('src');
    expect(layerSrc).toBe(fallback);
    cleanup();

    const peekSrc: string | null = ensureDirectPageUrl(archivePage);
    expect(peekSrc).toBe('');
    expect(peekSrc || fallback).toBe(fallback);
    expect(peekSrc ?? fallback).toBe('');
  });

  it('renders the noir markup for the noir variant', () => {
    renderLayer({
      image: image(),
      active: true,
      previewSrc: 'blob:preview',
      variant: 'noir',
    });
    const img = screen.getByAltText('page.png');
    expect(img.getAttribute('draggable')).toBe('false');
  });
});

describe('usePeekOriginalOverlayHidden', () => {
  it('reports hidden only while holding on the active card', () => {
    let hidden: boolean | undefined;
    const Probe = ({ active }: { active: boolean }): null => {
      hidden = usePeekOriginalOverlayHidden(active);
      return null;
    };

    render(<Probe active={true} />);
    expect(hidden).toBe(false);

    useUiShellStore.setState({ holdOriginalActive: true });
    expect(hidden).toBe(false);

    render(<Probe active={true} />);
    expect(hidden).toBe(true);
  });
});
