// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import DashboardLeftSidebarClassic from '@/components/dashboard/DashboardLeftSidebarClassic';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import type { SidebarChapterSelection } from '@/pages/dashboard/hooks/use-sidebar-chapter-selection';
import type {
  DashboardProcessingStatsSummary,
  LoadedImage,
} from '@/types/dashboard.types';
import { createDirectPageFile } from '@/utils/page-source';

const makeImage = (index: number): LoadedImage => ({
  id: `img-${index}`,
  file: createDirectPageFile(new File([`page-${index}`], `page-${index}.png`, {
    type: 'image/png',
  })),
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

const stats: DashboardProcessingStatsSummary = {
  daily: { key: 'daily', count: 0, resetInMs: 60_000 },
  weekly: { key: 'weekly', count: 0, resetInMs: 60_000 },
  monthly: { key: 'monthly', count: 0, resetInMs: 60_000 },
};

const chapterSelection = (active = false): SidebarChapterSelection => ({
  active,
  selectedIds: new Set<string>(),
  disabled: false,
  toggleMode: vi.fn(),
  toggleImage: vi.fn(),
  createChapter: vi.fn(),
  clearChapter: vi.fn(),
  cancel: vi.fn(),
});

const renderSidebar = (args: {
  images: LoadedImage[];
  processing?: boolean;
  isExtractingUploads?: boolean;
  chapterSelection?: SidebarChapterSelection;
}) => {
  const noop = vi.fn();
  return render(
    <I18nProvider>
      <DashboardLeftSidebarClassic
        mobileSidebarOpen
        isCompactViewport={false}
        desktopSidebarCollapsed={false}
        leftSidebarWidth={260}
        desktopSidebarToggleRef={{ current: null }}
        processingStats={stats}
        images={args.images}
        activeId={args.images[0]?.id ?? null}
        mode="aio"
        processing={args.processing ?? false}
        isExtractingUploads={args.isExtractingUploads ?? false}
        getRootProps={() => ({} as Record<string, unknown>)}
        getInputProps={() => ({} as Record<string, unknown>)}
        isDragActive={false}
        setImages={noop}
        setActiveId={noop}
        invalidateAioPipelineHistory={noop}
        setStatusMessage={noop}
        toggleDesktopSidebar={noop}
        startSidebarResize={noop}
        resetLeftSidebarWidth={noop}
        resizeLeftSidebarBy={noop}
        sidebarResizeStep={12}
        getRotatedDims={(image) => ({ width: image.width, height: image.height })}
        getAioImageSnapshotMeta={() => ({
          key: null,
          label: null,
          index: 0,
          canRewind: false,
          canForward: false,
        })}
        rewindAioPipelineForImage={noop}
        forwardAioPipelineForImage={noop}
        rotateImage={noop}
        moveImage={noop}
        removeImage={noop}
        chapterSelection={args.chapterSelection ?? chapterSelection()}
      />
    </I18nProvider>,
  );
};

/** jsdom has no DragEvent: fire a bubbling event with a dataTransfer stub. */
const fireDragEvent = (
  element: Element,
  type: 'dragstart' | 'dragover' | 'drop' | 'dragend',
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
    },
  });
  fireEvent(element, event);
};

const findItem = (name: string): HTMLElement => {
  const item = screen.getByTitle(name).closest('li');
  if (item === null) throw new Error(`item not found: ${name}`);
  return item;
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  useImageCollectionStore.setState({
    images: [0, 1, 2, 3].map(makeImage),
    activeId: 'img-0',
    isExtractingUploads: false,
  });
});

describe('DashboardLeftSidebarClassic drag reorder', () => {
  it('drops one page before the hovered item through moveImagesTo', () => {
    renderSidebar({ images: useImageCollectionStore.getState().images });
    // Dragging page-1 (idx 1) before page-3 (idx 3) is a real move; dropping
    // page-2 before page-3 would be its current spot (no-op).
    const source = findItem('page-1.png');
    const target = findItem('page-3.png');

    fireDragEvent(source, 'dragstart');
    fireDragEvent(target, 'dragover');
    // The insertion guide is visible on the hovered item.
    expect(
      within(target).getByTestId('page-drop-guide'),
    ).toBeDefined();
    fireDragEvent(target, 'drop');

    expect(
      useImageCollectionStore.getState().images.map((image) => image.id),
    ).toEqual(['img-0', 'img-2', 'img-1', 'img-3']);
  });

  it('shows no guide and ignores drops while processing is active', () => {
    renderSidebar({
      images: useImageCollectionStore.getState().images,
      processing: true,
    });
    const source = findItem('page-2.png');
    const target = findItem('page-3.png');

    fireDragEvent(source, 'dragstart');
    fireDragEvent(target, 'dragover');
    expect(screen.queryByTestId('page-drop-guide')).toBeNull();
    fireDragEvent(target, 'drop');
    expect(
      useImageCollectionStore.getState().images.map((image) => image.id),
    ).toEqual(['img-0', 'img-1', 'img-2', 'img-3']);
  });

  it('is inert while uploads are being extracted', () => {
    renderSidebar({
      images: useImageCollectionStore.getState().images,
      isExtractingUploads: true,
    });
    const target = findItem('page-1.png');
    fireDragEvent(target, 'dragover');
    expect(screen.queryByTestId('page-drop-guide')).toBeNull();
  });
});
