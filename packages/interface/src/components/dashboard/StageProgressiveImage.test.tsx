import '@testing-library/jest-dom/vitest';

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS } from '../../constants/dashboard.constants';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import type { LoadedImage } from '../../types/dashboard.types';
import { createDirectPageFile } from '../../utils/page-source';
import {
  useTextDetectionPreviewController,
  type TextDetectionPreviewProps,
} from './TextDetectionPreview';
import { PreviewStageItem } from './PreviewStageItem';
import { installJsdomBrowserStubs } from './renderTextPreviewTestSetup';
import { StageProgressiveImage } from './StageProgressiveImage';
import TextDetectionPreviewView from './text-detection-preview/TextDetectionPreview.view';

// The I18nProvider mount effect reads desktop locale preferences; tests run
// without a shell, so the bridge is nulled (textState.test.ts pattern).
beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
  installJsdomBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeImage = (overrides: Partial<LoadedImage> = {}): LoadedImage => ({
  id: 'page-0',
  file: createDirectPageFile(
    new File(['bytes'], 'page-0.png', { type: 'image/png' }),
  ),
  url: 'blob:page-0',
  width: 800,
  height: 1200,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
  ...overrides,
});

/** jsdom never decodes images: keep the full layer parked at opacity 0. */
const spyImagePending = (): void => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
};

interface ImageLayers {
  placeholder: HTMLImageElement;
  full: HTMLImageElement;
}

const expectImageLayers = (root: ParentNode): ImageLayers => {
  const images = Array.from(root.querySelectorAll('img'));
  expect(images).toHaveLength(2);
  const placeholder = images[0];
  const full = images[1];
  if (
    !(placeholder instanceof HTMLImageElement) ||
    !(full instanceof HTMLImageElement)
  ) {
    throw new Error('expected placeholder + full image layers');
  }
  return { placeholder, full };
};

const expectSingleImage = (root: ParentNode): HTMLImageElement => {
  const images = Array.from(root.querySelectorAll('img'));
  expect(images).toHaveLength(1);
  const only = images[0];
  if (!(only instanceof HTMLImageElement)) {
    throw new Error('expected a single image layer');
  }
  return only;
};

describe('StageProgressiveImage', () => {
  it('renders the placeholder underneath and fades the full image in on load', () => {
    spyImagePending();
    const { container } = render(
      <StageProgressiveImage
        placeholderSrc="blob:thumb"
        src="blob:full"
        alt="page.png"
      />,
    );
    const { placeholder, full } = expectImageLayers(container);

    expect(placeholder).toHaveAttribute('src', 'blob:thumb');
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    expect(placeholder).toHaveAttribute('alt', '');
    expect(placeholder).toHaveAttribute('draggable', 'false');
    expect(placeholder).toHaveStyle({ pointerEvents: 'none' });
    expect(full).toHaveAttribute('src', 'blob:full');
    expect(full).toHaveAttribute('alt', 'page.png');
    expect(full.style.opacity).toBe('0');
    expect(full.style.transition).toBe('opacity 120ms ease-out');

    fireEvent.load(full);

    expect(full.style.opacity).toBe('1');
    expect(placeholder.style.boxShadow).toBe('none');
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it.each([
    { label: 'placeholderSrc is null', placeholderSrc: null, src: 'blob:full' },
    {
      label: 'placeholderSrc equals src',
      placeholderSrc: 'blob:full',
      src: 'blob:full',
    },
    { label: 'src is empty', placeholderSrc: 'blob:thumb', src: '' },
  ] as Array<{ label: string; placeholderSrc: string | null; src: string }>)(
    'renders a single un-faded image when $label',
    ({ placeholderSrc, src }) => {
      const { container } = render(
        <StageProgressiveImage
          placeholderSrc={placeholderSrc}
          src={src}
          alt="page.png"
        />,
      );
      const only = expectSingleImage(container);

      expect(only).toHaveAttribute('alt', 'page.png');
      expect(only.style.opacity).toBe('1');
      expect(only.style.transition).toBe('');
    },
  );

  it('marks a cached image loaded via the complete check', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
      400,
    );
    const { container } = render(
      <StageProgressiveImage
        placeholderSrc="blob:thumb"
        src="blob:full"
        alt="page.png"
      />,
    );
    const { placeholder, full } = expectImageLayers(container);

    expect(full.style.opacity).toBe('1');
    expect(placeholder.style.boxShadow).toBe('none');
  });

  it('resets to the placeholder immediately when src changes', () => {
    spyImagePending();
    const { container, rerender } = render(
      <StageProgressiveImage
        placeholderSrc="blob:thumb"
        src="blob:full-1"
        alt="page.png"
      />,
    );
    const { placeholder, full } = expectImageLayers(container);
    fireEvent.load(full);
    expect(full.style.opacity).toBe('1');

    rerender(
      <StageProgressiveImage
        placeholderSrc="blob:thumb"
        src="blob:full-2"
        alt="page.png"
      />,
    );
    const { full: nextFull } = expectImageLayers(container);

    expect(nextFull).toHaveAttribute('src', 'blob:full-2');
    expect(nextFull.style.opacity).toBe('0');
    fireEvent.load(nextFull);
    expect(nextFull.style.opacity).toBe('1');
    expect(placeholder).toHaveAttribute('src', 'blob:thumb');
  });

  it('forwards loading to both layers when provided', () => {
    spyImagePending();
    const { container } = render(
      <StageProgressiveImage
        placeholderSrc="blob:thumb"
        src="blob:full"
        alt="page.png"
        loading="lazy"
      />,
    );
    const { placeholder, full } = expectImageLayers(container);

    expect(placeholder).toHaveAttribute('loading', 'lazy');
    expect(full).toHaveAttribute('loading', 'lazy');
  });

  it('omits the loading attribute when not provided', () => {
    spyImagePending();
    const { container } = render(
      <StageProgressiveImage
        placeholderSrc="blob:thumb"
        src="blob:full"
        alt="page.png"
      />,
    );
    const { placeholder, full } = expectImageLayers(container);

    expect(placeholder).not.toHaveAttribute('loading');
    expect(full).not.toHaveAttribute('loading');
  });
});

describe('StageProgressiveImage consumers', () => {
  it('PreviewStageItem keeps the absolute swap geometry on both layers', () => {
    spyImagePending();
    const img = makeImage({ thumbnailUrl: 'blob:thumb-0' });
    const { container } = render(
      <PreviewStageItem
        img={img}
        index={0}
        viewMode="long_strip"
        resolvedActiveId={null}
        onSelect={() => undefined}
        getPreviewSrc={(image) => image.url}
      />,
    );
    const { placeholder, full } = expectImageLayers(container);

    expect(placeholder).toHaveAttribute('src', 'blob:thumb-0');
    expect(full).toHaveAttribute('src', 'blob:page-0');
    for (const node of [placeholder, full]) {
      expect(node).toHaveClass('koma-preview-card__img');
      expect(node).toHaveStyle({
        width: '800px',
        height: '1200px',
        position: 'absolute',
        left: '0px',
        top: '0px',
      });
    }
    expect(full).toHaveAttribute('loading', 'lazy');
    expect(full).toHaveAttribute('decoding', 'async');
    expect(full.style.opacity).toBe('0');
    fireEvent.load(full);
    expect(full.style.opacity).toBe('1');
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('PreviewStageItem keeps rotation and centered offsets on both layers', () => {
    spyImagePending();
    const img = makeImage({
      thumbnailUrl: 'blob:thumb-0',
      width: 600,
      height: 800,
      rotation: 90,
    });
    const { container } = render(
      <PreviewStageItem
        img={img}
        index={0}
        viewMode="long_strip"
        resolvedActiveId={null}
        onSelect={() => undefined}
        getPreviewSrc={(image) => image.url}
      />,
    );
    const { placeholder, full } = expectImageLayers(container);

    for (const node of [placeholder, full]) {
      expect(node).toHaveStyle({
        width: '600px',
        height: '800px',
        position: 'absolute',
        left: '100px',
        top: '-100px',
        transform: 'rotate(90deg)',
      });
    }
  });

  it('TextDetectionPreview.view sizes both layers to the canvasWrap box', () => {
    spyImagePending();
    const image = makeImage({
      thumbnailUrl: 'blob:thumb-0',
      width: 1920,
      height: 2880,
    });
    const { container } = render(
      <I18nProvider>
        <DetectionPreviewHarness image={image} previewSrc="blob:page-0" />
      </I18nProvider>,
    );

    const canvasWrap = container.querySelector('.koma-preview-card__canvasWrap');
    if (!(canvasWrap instanceof HTMLElement)) {
      throw new Error('canvasWrap not rendered');
    }
    expect(canvasWrap.style.width).toBe('960px');
    expect(canvasWrap.style.height).toBe('1440px');

    const { placeholder, full } = expectImageLayers(canvasWrap);
    expect(placeholder).toHaveAttribute('src', 'blob:thumb-0');
    expect(full).toHaveAttribute('src', 'blob:page-0');
    for (const node of [placeholder, full]) {
      expect(node).toHaveClass('koma-preview-card__img');
      expect(node).toHaveStyle({
        width: '960px',
        height: '1440px',
        position: 'absolute',
        left: '0px',
        top: '0px',
      });
      expect(node).not.toHaveAttribute('loading');
    }
    expect(full.style.opacity).toBe('0');
    fireEvent.load(full);
    expect(full.style.opacity).toBe('1');
  });
});

interface DetectionPreviewHarnessProps {
  image: LoadedImage;
  previewSrc: string;
}

const makeDetectionPreviewProps = (
  image: LoadedImage,
  previewSrc: string,
): TextDetectionPreviewProps => ({
  label: 'detect',
  image,
  previewSrc,
  viewMode: 'long_strip',
  active: false,
  regions: [],
  selectedRegionId: null,
  onCardSelect: () => undefined,
  onSelectRegion: () => undefined,
  onRegionsChange: () => undefined,
  editable: false,
  selectionEnabled: false,
  creationEnabled: false,
  newRegionShapeKind: 'square',
  segmentEditEnabled: false,
  segmentEditTool: 'select',
  segmentBrushSize: 10,
  stageBadgeKey: 'render',
  stageBadgeLabel: 'render',
  canRewind: false,
  canForward: false,
  onRewind: () => undefined,
  onForward: () => undefined,
  historyHint: null,
  translationNotesEnabled: false,
});

const DetectionPreviewHarness = ({
  image,
  previewSrc,
}: DetectionPreviewHarnessProps) => {
  const props = makeDetectionPreviewProps(image, previewSrc);
  const controller = useTextDetectionPreviewController(props);
  return <TextDetectionPreviewView {...props} controller={controller} zoom={1} />;
};
