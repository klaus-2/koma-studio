import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import type { DesktopModelsApi } from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import {
  buildKomaImagePageUrl,
  buildKomaMediaUrl,
  hasKomaImageProtocolBridge,
  percentEncodeNonAlphanumeric,
} from './koma-media-url';
import {
  createArchivePageFile,
  createDirectPageFile,
  registerPageSourcePath,
  resolvePagePreview,
} from './page-source';
import { openArchiveChapter } from './archive-chapter-reader';
import type { ImageFilters, LoadedImage } from '../types/dashboard.types';

const modelsStub: DesktopModelsApi = {
  listInstalled: async () => [],
  getDiskSpace: async () => ({ freeBytes: 1, totalBytes: 1, path: 'mock' }),
  checkUpdates: async () => [],
  download: async () => ({ queued: true, queueLength: 0 }),
  importOnnx: async () => {
    throw new Error('not used');
  },
  cancel: async () => undefined,
  cancelAll: async () => undefined,
  uninstall: async () => undefined,
  listActive: async () => ({ known: false }),
  on: async () => true,
  off: () => undefined,
};

const textBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const encoded = new TextEncoder().encode(value);
  const copy = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  copy.set(encoded);
  return copy;
};

const TEST_FILTERS: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const buildImage = (
  file: ReturnType<typeof createDirectPageFile>,
  url: string,
): LoadedImage => ({
  id: 'image-1',
  file,
  url,
  width: 0,
  height: 0,
  rotation: 0,
  filters: { ...TEST_FILTERS },
});

const stubUserAgent = (userAgent: string): void => {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
};

const stubRevokeObjectURL = (): ReturnType<typeof vi.fn> => {
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  });
  return revokeObjectURL;
};

describe('koma-media-url', () => {
  it('percent-encodes every non-alphanumeric byte as uppercase UTF-8 hex', () => {
    expect(percentEncodeNonAlphanumeric('C:/Imgs/page 01.png')).toBe(
      'C%3A%2FImgs%2Fpage%2001%2Epng',
    );
    expect(percentEncodeNonAlphanumeric('C:/aéb.png')).toBe(
      'C%3A%2Fa%C3%A9b%2Epng',
    );
  });

  it('mirrors the media.rs URL shape on Windows and elsewhere', () => {
    expect(buildKomaMediaUrl('koma-image', 'C:/a/b.png', true)).toBe(
      'http://koma-image.localhost/C%3A%2Fa%2Fb%2Epng',
    );
    expect(buildKomaMediaUrl('koma-image', '/home/u/b.png', false)).toBe(
      'koma-image://localhost/%2Fhome%2Fu%2Fb%2Epng',
    );
  });

  it('builds the platform URL from the navigator user agent', () => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    expect(buildKomaImagePageUrl('C:/a/b.png')).toBe(
      'http://koma-image.localhost/C%3A%2Fa%2Fb%2Epng',
    );
    stubUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
    expect(buildKomaImagePageUrl('/home/u/b.png')).toBe(
      'koma-image://localhost/%2Fhome%2Fu%2Fb%2Epng',
    );
  });
});

describe('protocol-backed direct pages', () => {
  const allowPaths = vi.fn(async () => [
    {
      status: 'allowed' as const,
      index: 0,
      entry: { filePath: 'C:/w/01.png', mimeType: 'image/png', size: 3 },
    },
  ]);

  beforeEach(() => {
    stubUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    stubRevokeObjectURL();
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { imagesAllowPaths: allowPaths }),
    });
  });

  afterEach(() => {
    setDesktopBridgeProvider(null);
    stubUserAgent('');
  });

  it('marks an imported forwarded file as path-backed after allowPaths succeeds', async () => {
    const file = new File([textBytes('abc')], '01.png', { type: 'image/png' });
    const bridge = createDesktopBridgeStub(modelsStub, { imagesAllowPaths: allowPaths });
    const outcomes = await bridge.images.allowPaths?.(['C:/w/01.png']);
    expect(outcomes?.[0]?.status).toBe('allowed');
    registerPageSourcePath(file, 'C:/w/01.png');

    const page = createDirectPageFile(file);
    expect(page.sourcePath).toBe('C:/w/01.png');
    expect(allowPaths).toHaveBeenCalledWith(['C:/w/01.png']);
  });

  it('prefers a protocol URL over a blob URL for path-backed pages', async () => {
    const file = new File([textBytes('abc')], '01.png', { type: 'image/png' });
    registerPageSourcePath(file, 'C:/w/01.png');
    const page = createDirectPageFile(file);
    const image = buildImage(page, '');

    const preview = await resolvePagePreview(image);

    expect(preview.src).toBe('http://koma-image.localhost/C%3A%2Fw%2F01%2Epng');
    expect(() => preview.release()).not.toThrow();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the blob pipeline for pages without a resident path', async () => {
    const file = new File([textBytes('abc')], '01.png', { type: 'image/png' });
    const page = createDirectPageFile(file);
    const image = buildImage(page, '');

    const preview = await resolvePagePreview(image);

    expect(page.sourcePath).toBeUndefined();
    expect(preview.src.startsWith('blob:')).toBe(true);
    preview.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(preview.src);
  });

  it('keeps the blob pipeline for archive members', async () => {
    const archive = new File(
      [zipSync({ 'page-1.png': textBytes('first') })],
      'chapter.cbz',
      { type: 'application/zip' },
    );
    const { chapter } = await openArchiveChapter(archive);
    const entry = chapter.entries[0] as NonNullable<(typeof chapter.entries)[number]>;
    const page = createArchivePageFile(chapter, entry, 'page-1.png', 'image/png');
    const image: LoadedImage = {
      id: 'archive-image',
      file: page,
      url: '',
      width: 0,
      height: 0,
      rotation: 0,
      filters: { ...TEST_FILTERS },
    };

    const preview = await resolvePagePreview(image);

    expect(page.kind).toBe('archive');
    expect(preview.src.startsWith('blob:')).toBe(true);
    preview.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(preview.src);
  });

  it('reports the protocol bridge as absent without the allowPaths member', () => {
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub),
    });
    expect(hasKomaImageProtocolBridge()).toBe(false);
  });
});
