// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { LoadedImage } from '../../../types/dashboard.types';
import type { DirectPageFile } from '../../../utils/page-source';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useDashboardPasteImport } from './useDashboardPasteImport';

type OnDropFn = (files: File[]) => Promise<void>;

const PNG_BYTES = [137, 80, 78, 71, 1, 2, 3, 4];

const pngFile = (name: string): File =>
  new File([new Uint8Array(PNG_BYTES)], name, { type: 'image/png' });

const textFile = (): File =>
  new File(['hello'], 'notes.txt', { type: 'text/plain' });

const makeDirectPageFile = (): DirectPageFile => {
  const file = new File([new Uint8Array(PNG_BYTES)], 'seed.png');
  return {
    kind: 'direct',
    name: 'seed.png',
    type: 'image/png',
    size: file.size,
    lastModified: 1000,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 10, height: 10 }),
    release: () => {},
  };
};

const makeLibraryImage = (id: string): LoadedImage => ({
  id,
  file: makeDirectPageFile(),
  url: `blob:${id}`,
  width: 10,
  height: 10,
  rotation: 0,
  filters: {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
});

interface DispatchedPaste {
  preventDefault: ReturnType<typeof vi.fn>;
}

/**
 * Dispatches a paste event through the real DOM path (bubbles to the window
 * listener). jsdom has no DataTransfer files, so clipboardData is stubbed
 * with the shape the handler reads: `{ files }`.
 */
const dispatchPaste = (
  target: EventTarget,
  files: File[],
): DispatchedPaste => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { files: [...files] },
  });
  const preventDefault = vi.spyOn(event, 'preventDefault');
  target.dispatchEvent(event);
  return { preventDefault };
};

describe('useDashboardPasteImport', () => {
  let onDrop: Mock<OnDropFn>;

  beforeEach(() => {
    onDrop = vi.fn<OnDropFn>(async () => undefined);
    useUiShellStore.setState({ mode: 'aio' });
    useTranslatorStore.setState({ translatorWorkspaceMode: 'text' });
    useImageCollectionStore.setState({
      images: [],
      activeId: null,
      isExtractingUploads: false,
    });
  });

  it('imports pasted image files through the drop flow and prevents the default', () => {
    renderHook(() => useDashboardPasteImport({ onDrop }));
    const first = pngFile('page-001.png');
    const second = pngFile('page-002.png');

    const dispatched = dispatchPaste(window, [first, second]);

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith([first, second]);
    expect(dispatched.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('keeps native paste on editable targets (no interception, no preventDefault)', () => {
    renderHook(() => useDashboardPasteImport({ onDrop }));
    const input = document.createElement('input');
    document.body.appendChild(input);

    try {
      const dispatched = dispatchPaste(input, [pngFile('page-001.png')]);

      expect(onDrop).not.toHaveBeenCalled();
      expect(dispatched.preventDefault).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });

  it('stays inert while a workspace stage owns the center', () => {
    renderHook(() => useDashboardPasteImport({ onDrop }));

    useUiShellStore.setState({ mode: 'stitch' });
    dispatchPaste(window, [pngFile('page-001.png')]);
    expect(onDrop).not.toHaveBeenCalled();

    useUiShellStore.setState({ mode: 'blogger' });
    dispatchPaste(window, [pngFile('page-001.png')]);
    expect(onDrop).not.toHaveBeenCalled();

    useUiShellStore.setState({ mode: 'translator' });
    dispatchPaste(window, [pngFile('page-001.png')]);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('imports in the translator visual workspace once pages exist', () => {
    useUiShellStore.setState({ mode: 'translator' });
    useTranslatorStore.setState({ translatorWorkspaceMode: 'visual' });
    useImageCollectionStore.setState({ images: [makeLibraryImage('img-1')] });
    renderHook(() => useDashboardPasteImport({ onDrop }));

    dispatchPaste(window, [pngFile('page-001.png')]);

    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('stays silent while composite extraction is busy (same as a disabled drop)', () => {
    useImageCollectionStore.setState({ isExtractingUploads: true });
    renderHook(() => useDashboardPasteImport({ onDrop }));

    const dispatched = dispatchPaste(window, [pngFile('page-001.png')]);

    expect(onDrop).not.toHaveBeenCalled();
    expect(dispatched.preventDefault).not.toHaveBeenCalled();
  });

  it('routes a clipboard without compatible images to the empty-drop warning path', () => {
    renderHook(() => useDashboardPasteImport({ onDrop }));

    dispatchPaste(window, []);
    expect(onDrop).toHaveBeenCalledWith([]);

    onDrop.mockClear();
    dispatchPaste(window, [textFile()]);
    expect(onDrop).toHaveBeenCalledWith([]);
  });

  it('removes the listener on unmount', () => {
    const rendered = renderHook(() => useDashboardPasteImport({ onDrop }));
    rendered.unmount();

    dispatchPaste(window, [pngFile('page-001.png')]);

    expect(onDrop).not.toHaveBeenCalled();
  });
});
