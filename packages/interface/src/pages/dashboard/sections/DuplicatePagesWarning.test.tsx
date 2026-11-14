// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { I18nProvider } from '@/i18n';
import type { LoadedImage } from '../../../types/dashboard.types';
import type { DirectPageFile } from '../../../utils/page-source';
import { useImageCollectionStore } from '../stores/image-collection-store';
import {
  useImportDuplicatesStore,
} from '../stores/import-duplicates-store';
import DuplicatePagesWarning from './DuplicatePagesWarning';

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const directPage = (name: string, bytes: readonly number[]): DirectPageFile => {
  const file = new File([new Uint8Array(bytes)], name);
  return {
    kind: 'direct',
    name,
    type: 'image/png',
    size: file.size,
    lastModified: 1000,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 10, height: 10 }),
    release: () => {},
  };
};

const image = (id: string, pageName: string, thumbnailUrl?: string): LoadedImage => ({
  id,
  file: directPage(pageName, [1, 2, 3]),
  url: `blob:${id}`,
  ...(thumbnailUrl ? { thumbnailUrl } : {}),
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

const importBatch = (): LoadedImage[] => [
  image('imp-1', 'dup-page.png'),
  image('imp-2', 'fresh-page.png'),
  image('imp-3', 'twin-page.png'),
];

describe('DuplicatePagesWarning', () => {
  beforeEach(() => {
    useImportDuplicatesStore.setState({ pending: null });
    useImageCollectionStore.setState({
      images: [image('lib-1', 'existing.png', 'blob:thumb-1')],
      activeId: 'lib-1',
    });
  });

  it('renders nothing without a pending batch', () => {
    const { container } = render(
      <I18nProvider>
        <DuplicatePagesWarning />
      </I18nProvider>,
    );
    expect(container.firstElementChild).toBeNull();
  });

  it('lists duplicates with keep-both as the default choice', () => {
    const resume = vi.fn();
    useImportDuplicatesStore.setState({
      pending: {
        images: importBatch(),
        matches: [
          { importIndex: 0, existingImageId: 'lib-1' },
          { importIndex: 2, otherImportIndex: 0 },
        ],
        resume,
      },
    });

    render(
      <I18nProvider>
        <DuplicatePagesWarning />
      </I18nProvider>,
    );

    // Two duplicate rows (the non-duplicate batch member is not listed).
    // The page name appears twice per row: text fallback + name label.
    expect(screen.getAllByText('dup-page.png').length).toBeGreaterThan(0);
    expect(screen.getAllByText('twin-page.png').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('fresh-page.png')).toHaveLength(0);
    // Keep-both is the default: its choice button is active, ignore is not.
    const keepButtons = screen.getAllByText('Keep both');
    for (const button of keepButtons) {
      expect(button.className).toContain('is-active');
    }
    const ignoreButtons = screen.getAllByText('Ignore');
    for (const button of ignoreButtons) {
      expect(button.className).not.toContain('is-active');
    }
  });

  it('resumes the import with the non-ignored pages, including non-duplicate batch members', () => {
    const resume = vi.fn();
    const batch = importBatch();
    useImportDuplicatesStore.setState({
      pending: {
        images: batch,
        matches: [
          { importIndex: 0, existingImageId: 'lib-1' },
          { importIndex: 2, otherImportIndex: 0 },
        ],
        resume,
      },
    });

    render(
      <I18nProvider>
        <DuplicatePagesWarning />
      </I18nProvider>,
    );

    // Ignore the second duplicate row (twin-page.png).
    const ignoreButtons = screen.getAllByText('Ignore');
    fireEvent.click(ignoreButtons[1] as HTMLButtonElement);
    fireEvent.click(screen.getByText('Add selected pages'));

    // The full batch minus the ignored page resumes (the fresh page rides along).
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith([batch[0], batch[1]]);
    // Clearing the pending batch is owned by the resume closure in the
    // uploads hook, not by the dialog.
  });

  it('resets the ignored set for the next pending batch', () => {
    const resume = vi.fn();
    useImportDuplicatesStore.setState({
      pending: {
        images: importBatch(),
        matches: [{ importIndex: 0, existingImageId: 'lib-1' }],
        resume,
      },
    });

    const { unmount } = render(
      <I18nProvider>
        <DuplicatePagesWarning />
      </I18nProvider>,
    );
    fireEvent.click(screen.getAllByText('Ignore')[0] as HTMLButtonElement);
    unmount();

    // A new pending batch mounts a fresh dialog: keep-both is the default again.
    useImportDuplicatesStore.setState({
      pending: {
        images: importBatch(),
        matches: [{ importIndex: 0, existingImageId: 'lib-1' }],
        resume,
      },
    });
    render(
      <I18nProvider>
        <DuplicatePagesWarning />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText('Add selected pages'));

    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'imp-1' })]));
  });
});
