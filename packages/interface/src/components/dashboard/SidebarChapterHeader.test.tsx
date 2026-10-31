// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import SidebarChapterHeader from '@/components/dashboard/SidebarChapterHeader';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { LoadedImage } from '@/types/dashboard.types';

const makeImage = (index: number): LoadedImage => ({
  id: `img-${index}`,
  file: new File([`page-${index}`], `page-${index}.png`, {
    type: 'image/png',
  }),
  url: `data:image/png;base64,AA${index}`,
  width: 40,
  height: 30,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
});

const chapteredImages = (): [LoadedImage, LoadedImage] => [
  { ...makeImage(0), chapterId: 'manual:1', chapterLabel: 'Capítulo 1' },
  { ...makeImage(1), chapterId: 'manual:1', chapterLabel: 'Capítulo 1' },
];

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  useImageCollectionStore.setState({
    images: chapteredImages(),
    activeId: 'img-0',
    isExtractingUploads: false,
  });
  useUiShellStore.setState({ processing: false });
  useStatusStore.getState().setStatusMessage('');
  vi.restoreAllMocks();
});

afterEach(cleanup);

const renderHeader = (chapterId: string | null = 'manual:1') =>
  render(
    <I18nProvider>
      <SidebarChapterHeader
        chapterId={chapterId}
        label="Capítulo 1"
        count={2}
        noir={false}
      />
    </I18nProvider>,
  );

describe('SidebarChapterHeader', () => {
  it('renames the chapter through the prompt', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'prompt').mockReturnValue('  Capítulo novo  ');
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Rename chapter' }));

    const next = useImageCollectionStore.getState().images;
    expect(next[0]?.chapterLabel).toBe('Capítulo novo');
    expect(next[1]?.chapterLabel).toBe('Capítulo novo');
    expect(useStatusStore.getState().statusMessage).toBe(
      'Chapter renamed to "Capítulo novo".',
    );
  });

  it('removes the chapter after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Remove chapter' }));

    const next = useImageCollectionStore.getState().images;
    expect(next[0]).not.toHaveProperty('chapterId');
    expect(next[1]).not.toHaveProperty('chapterLabel');
    expect(confirm).toHaveBeenCalledWith(
      'Remove chapter "Capítulo 1"? The images stay in the file list.',
    );
    expect(useStatusStore.getState().statusMessage).toBe(
      'Chapter "Capítulo 1" removed from 2 image(s).',
    );
  });

  it('keeps the chapter when the removal is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Remove chapter' }));

    expect(useImageCollectionStore.getState().images[0]?.chapterId).toBe(
      'manual:1',
    );
  });

  it('renders no actions for images without a chapter', () => {
    renderHeader(null);

    expect(screen.queryByRole('button', { name: 'Rename chapter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove chapter' })).toBeNull();
  });
});
