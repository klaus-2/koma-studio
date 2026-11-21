// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import type { LoadedImage } from '@/types/dashboard.types';
import { createDirectPageFile } from '@/utils/page-source';
import ClassicSidebar from '@/components/dashboard/DashboardLeftSidebarClassic';
import NoirSidebar from '@/components/dashboard/noir/DashboardLeftSidebarNoir';
import type { SidebarChapterSelection } from '@/pages/dashboard/hooks/use-sidebar-chapter-selection';
import type { DashboardProcessingStatsSummary } from '@/types/dashboard.types';
import VirtualizedSidebarList, {
  buildVirtualizedSidebarRows,
  VIRTUALIZED_SIDEBAR_MIN_IMAGES,
  type SidebarVirtualRow,
  type VirtualizedSidebarRowDomProps,
} from './VirtualizedSidebarList';

const virtualMocks = vi.hoisted(() => ({ measureElement: vi.fn() }));

vi.mock('@tanstack/react-virtual', () => ({
  defaultRangeExtractor: (range: { start: number; end: number }): number[] =>
    Array.from({ length: Math.max(0, range.end - range.start + 1) }, (_, index) => range.start + index),
  useVirtualizer: (options: { count: number; enabled: boolean }) => ({
    getVirtualItems: () => (options.enabled
      ? [0, 1].filter((index) => index < options.count).map((index) => ({
          index,
          key: index,
          start: index * 76,
          end: index * 76 + 76,
          size: 76,
        }))
      : []),
    getTotalSize: () => options.count * 76,
    measureElement: virtualMocks.measureElement,
  }),
}));

const makeImage = (index: number): LoadedImage => ({
  id: `img-${index}`,
  file: createDirectPageFile(new File([`page-${index}`], `page-${index}.png`, { type: 'image/png' })),
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

const rows: SidebarVirtualRow[] = [
  { kind: 'chapter-header', id: 'header:1', chapterId: '1', label: 'Chapter 1', count: 2 },
  { kind: 'image', id: 'a', globalIndex: 0, image: makeImage(0) },
  { kind: 'image', id: 'b', globalIndex: 7, image: makeImage(1) },
];

const renderItemRow = (row: SidebarVirtualRow, domProps: VirtualizedSidebarRowDomProps) => (
  <li {...domProps} data-testid={row.kind} data-global={row.kind === 'image' ? row.globalIndex : undefined}>
    {row.kind === 'image' ? row.image.file.name : row.label}
  </li>
);

describe('VirtualizedSidebarList', () => {
  it('renders static <ul><li> children with data-index when disabled', () => {
    render(<VirtualizedSidebarList rows={rows} estimatedHeights={{ 'chapter-header': 42, image: 76 }} enabled={false} renderItemRow={renderItemRow} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.getAttribute('data-index'))).toEqual(['0', '1', '2']);
    expect(items.every((item) => item.style.position !== 'absolute')).toBe(true);
  });

  it('uses measured rows, absolute placement and the visible-range callback when enabled', () => {
    const onVisibleRangeChange = vi.fn();
    render(<VirtualizedSidebarList rows={rows} estimatedHeights={{ 'chapter-header': 42, image: 76 }} enabled onVisibleRangeChange={onVisibleRangeChange} renderItemRow={renderItemRow} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const firstItem = items[0];
    if (!(firstItem instanceof HTMLElement)) throw new Error('first item is not an HTMLElement');
    expect(firstItem).toHaveAttribute('data-index', '0');
    expect(firstItem.style.position).toBe('absolute');
    expect(virtualMocks.measureElement).toHaveBeenCalled();
    expect(onVisibleRangeChange).toHaveBeenCalledWith({ start: 0, end: 1 });
  });

  it('keeps the original global index when groups are reordered', () => {
    const images = [makeImage(0), makeImage(1), makeImage(2)];
    const [first, second, third] = images;
    if (first === undefined || second === undefined || third === undefined) throw new Error('missing fixture image');
    const groups = [
      { id: 'g2', label: 'Two', images: [third] },
      { id: 'g1', label: 'One', images: [first, second] },
    ];
    const built = buildVirtualizedSidebarRows(images, groups, 'Unassigned', true);
    expect(built.filter((row) => row.kind === 'image').map((row) => (row.kind === 'image' ? row.globalIndex : -1))).toEqual([2, 0, 1]);
  });
});

type SidebarProps = ComponentProps<typeof ClassicSidebar>;
const stats: DashboardProcessingStatsSummary = {
  daily: { key: 'daily', count: 0, resetInMs: 60_000 },
  weekly: { key: 'weekly', count: 0, resetInMs: 60_000 },
  monthly: { key: 'monthly', count: 0, resetInMs: 60_000 },
};
const selection: SidebarChapterSelection = {
  active: false,
  selectedIds: new Set<string>(),
  disabled: false,
  toggleMode: vi.fn(),
  toggleImage: vi.fn(),
  createChapter: vi.fn(),
  clearChapter: vi.fn(),
  cancel: vi.fn(),
};

const renderSidebar = (variant: 'classic' | 'noir', count: number) => {
  const images = Array.from({ length: count }, (_, index) => makeImage(index));
  const noop = vi.fn();
  const props: SidebarProps = {
    mobileSidebarOpen: true,
    isCompactViewport: false,
    desktopSidebarCollapsed: false,
    leftSidebarWidth: 260,
    desktopSidebarToggleRef: { current: null },
    processingStats: stats,
    images,
    activeId: images[0]?.id ?? null,
    mode: 'aio',
    processing: false,
    isExtractingUploads: false,
    getRootProps: () => ({}) as Record<string, unknown>,
    getInputProps: () => ({}) as Record<string, unknown>,
    isDragActive: false,
    setImages: noop,
    setActiveId: noop,
    invalidateAioPipelineHistory: noop,
    setStatusMessage: noop,
    toggleDesktopSidebar: noop,
    startSidebarResize: noop,
    resetLeftSidebarWidth: noop,
    resizeLeftSidebarBy: noop,
    sidebarResizeStep: 12,
    getRotatedDims: (image) => ({ width: image.width, height: image.height }),
    getAioImageSnapshotMeta: () => ({ key: null, label: null, index: 0, canRewind: false, canForward: false }),
    rewindAioPipelineForImage: noop,
    forwardAioPipelineForImage: noop,
    rotateImage: noop,
    moveImage: noop,
    removeImage: noop,
    chapterSelection: selection,
  };
  return render(
    <I18nProvider>
      {variant === 'classic' ? <ClassicSidebar {...props} /> : <NoirSidebar {...props} />}
    </I18nProvider>,
  );
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

describe.each([
  ['classic', 'classic'],
  ['noir', 'noir'],
] as const)('sidebar virtualization threshold (%s)', (_label, variant) => {
  it('keeps the legacy list below the threshold', () => {
    renderSidebar(variant, VIRTUALIZED_SIDEBAR_MIN_IMAGES - 1);
    const list = document.querySelector<HTMLElement>('ul.koma-filelist, ul.flex.flex-col');
    expect(list).not.toBeNull();
    expect(list?.style.position).not.toBe('relative');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('mounts the virtualized list at the threshold', () => {
    renderSidebar(variant, VIRTUALIZED_SIDEBAR_MIN_IMAGES);
    const list = document.querySelector<HTMLElement>('ul[style*="position: relative"]');
    expect(list).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
