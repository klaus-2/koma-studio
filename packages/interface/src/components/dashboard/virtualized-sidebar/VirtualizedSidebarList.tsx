import { Fragment, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode, type RefObject } from 'react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';

import {
  DIRECT_IMAGES_CHAPTER_ID,
  type AioChapterGroup,
} from '../../../pages/dashboard/lib/aio-chapters';
import type { LoadedImage } from '../../../types/dashboard.types';
import type { SidebarPageListHandlers } from '../DashboardLeftSidebarPageDragGuide';

export const VIRTUALIZED_SIDEBAR_MIN_IMAGES = 50;

export type SidebarVirtualRow =
  | {
      readonly kind: 'chapter-header';
      readonly id: string;
      readonly chapterId: string | null;
      readonly label: string;
      readonly count: number;
    }
  | {
      readonly kind: 'image';
      readonly id: string;
      readonly globalIndex: number;
      readonly image: LoadedImage;
    };

export interface VirtualizedSidebarRowDomProps {
  readonly 'data-index': number;
  readonly ref?: (node: HTMLLIElement | null) => void;
  readonly style?: CSSProperties;
}

export type RenderSidebarRow = (
  row: SidebarVirtualRow,
  domProps: VirtualizedSidebarRowDomProps,
) => ReactNode;

export interface VirtualizedSidebarListProps {
  readonly rows: readonly SidebarVirtualRow[];
  readonly estimatedHeights: Readonly<Record<SidebarVirtualRow['kind'], number>>;
  readonly enabled: boolean;
  readonly onVisibleRangeChange?: (range: { start: number; end: number }) => void;
  readonly renderItemRow: RenderSidebarRow;
  readonly listHandlers?: SidebarPageListHandlers;
  readonly className?: string;
  readonly containerClassName?: string;
  readonly scrollRef?: RefObject<HTMLDivElement | null>;
}

export function buildVirtualizedSidebarRows(
  images: readonly LoadedImage[],
  groups: readonly AioChapterGroup[],
  unassignedLabel: string,
  includeHeaders: boolean,
): SidebarVirtualRow[] {
  const indexById = new Map(images.map((image, index) => [image.id, index]));
  const rows: SidebarVirtualRow[] = [];
  for (const group of groups) {
    if (includeHeaders) {
      rows.push({
        kind: 'chapter-header',
        id: `header:${group.id}`,
        chapterId: group.id === DIRECT_IMAGES_CHAPTER_ID ? null : group.id,
        label: group.id === DIRECT_IMAGES_CHAPTER_ID ? unassignedLabel : group.label,
        count: group.images.length,
      });
    }
    for (const image of group.images) {
      rows.push({
        kind: 'image',
        id: image.id,
        globalIndex: indexById.get(image.id) ?? 0,
        image,
      });
    }
  }
  return rows;
}

export default function VirtualizedSidebarList({
  rows,
  estimatedHeights,
  enabled,
  onVisibleRangeChange,
  renderItemRow,
  listHandlers,
  className,
  containerClassName,
  scrollRef,
}: VirtualizedSidebarListProps): ReactElement {
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef ?? localRef;
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLLIElement>({
    count: rows.length,
    enabled,
    getScrollElement: () => containerRef.current,
    getItemKey: (index) => rows[index]?.id ?? index,
    estimateSize: (index) => estimatedHeights[rows[index]?.kind ?? 'image'],
    overscan: 4,
    rangeExtractor: defaultRangeExtractor,
  });
  const virtualItems = enabled ? virtualizer.getVirtualItems() : [];

  useEffect(() => {
    const first = virtualItems[0];
    const last = virtualItems.at(-1);
    if (first === undefined || last === undefined || onVisibleRangeChange === undefined) return;
    onVisibleRangeChange({ start: first.index, end: last.index });
  }, [onVisibleRangeChange, virtualItems]);

  const renderRow = (row: SidebarVirtualRow, index: number, style?: CSSProperties, ref?: (node: HTMLLIElement | null) => void): ReactNode => (
    <Fragment key={row.id}>
      {renderItemRow(row, {
        'data-index': index,
        ...(style === undefined ? {} : { style }),
        ...(ref === undefined ? {} : { ref }),
      })}
    </Fragment>
  );

  return (
    <div ref={containerRef} className={containerClassName} style={{ minHeight: 0, overflowY: 'auto' }}>
      <ul
        className={className}
        {...listHandlers}
        style={{
          position: 'relative',
          height: enabled ? virtualizer.getTotalSize() : undefined,
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {enabled
          ? virtualItems.map((item) => {
              const row = rows[item.index];
              return row === undefined
                ? null
                : renderRow(row, item.index, { position: 'absolute', top: item.start, left: 0, width: '100%' }, virtualizer.measureElement);
            })
          : rows.map((row, index) => renderRow(row, index))}
      </ul>
    </div>
  );
}
