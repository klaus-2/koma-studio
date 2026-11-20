import { useCallback, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type HTMLAttributes } from 'react';
import DashboardLeftSidebarPageDragGuideClassic from './DashboardLeftSidebarPageDragGuideClassic';
import DashboardLeftSidebarPageDragGuideNoir from './noir/DashboardLeftSidebarPageDragGuideNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { useI18n } from '../../i18n';
import { useImageCollectionStore } from '../../pages/dashboard/stores/image-collection-store';
import type { SidebarChapterSelection } from '../../pages/dashboard/hooks/use-sidebar-chapter-selection';
import type { LoadedImage } from '../../types/dashboard.types';

/**
 * Insertion guide line of the HTML5 page drag-reorder, plus the
 * shared drag controller both sidebar variants consume. Rendered inside the
 * hovered page item (top edge), purely decorative.
 */
export const DashboardLeftSidebarPageDragGuide = createFamilyComponent(
  DashboardLeftSidebarPageDragGuideClassic,
  DashboardLeftSidebarPageDragGuideNoir,
);

export default DashboardLeftSidebarPageDragGuide;

export interface SidebarPageDragHandlers {
  draggable: boolean;
  title: string;
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onDragEnd: (event: ReactDragEvent<HTMLElement>) => void;
}

export type SidebarPageListHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  'onDragOver' | 'onDrop'
>;

/**
 * Shared HTML5 drag-reorder controller: the dragged group (the whole
 * chapter selection when a selected page is dragged), the insertion guide
 * index and the store write. One drop = one `moveImagesTo` store mutation =
 * one undo snapshot (workspace-persistence change signal).
 */
export function usePageDragReorder(args: {
  imageIndexById: Map<string, number>;
  chapterSelection: SidebarChapterSelection;
  dragEnabled: boolean;
}): {
  dropGuideIndex: number | null;
  itemHandlers: (img: LoadedImage, idx: number) => SidebarPageDragHandlers;
  listHandlers: (total: number) => SidebarPageListHandlers;
} {
  const { imageIndexById, chapterSelection, dragEnabled } = args;
  // Destructured to primitives so the handler cache survives sidebar
  // re-renders that don't change the selection (stats ticks, activeId) —
  // the chapterSelection object itself is recreated every render.
  const chapterSelectionActive = chapterSelection.active;
  const chapterSelectionSelectedIds = chapterSelection.selectedIds;
  const { t } = useI18n();
  const [dropGuideIndex, setDropGuideIndex] = useState<number | null>(null);
  const dragSourceIndicesRef = useRef<readonly number[] | null>(null);
  const clearDragState = useCallback(() => {
    dragSourceIndicesRef.current = null;
    setDropGuideIndex(null);
  }, []);
  const buildHandlers = useCallback(
    (imgId: string, idx: number): SidebarPageDragHandlers => {
      const draggingGroup =
        chapterSelectionActive && chapterSelectionSelectedIds.has(imgId);
      return {
        draggable: dragEnabled,
        title: draggingGroup
          ? t('dashboard.sidebar.dragPageSelected')
          : t('dashboard.sidebar.dragPage'),
        onDragStart: (event) => {
          if (!dragEnabled) return;
          dragSourceIndicesRef.current = draggingGroup
            ? [...chapterSelectionSelectedIds].flatMap((id) => {
                const index = imageIndexById.get(id);
                return index === undefined ? [] : [index];
              })
            : [idx];
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', imgId);
        },
        onDragOver: (event) => {
          if (!dragEnabled) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          setDropGuideIndex(idx);
        },
        onDrop: (event) => {
          event.preventDefault();
          event.stopPropagation();
          const sourceIndices = dragSourceIndicesRef.current;
          clearDragState();
          if (!dragEnabled || sourceIndices === null) return;
          useImageCollectionStore.getState().moveImagesTo(sourceIndices, idx);
        },
        onDragEnd: () => {
          clearDragState();
        },
      };
    },
    [chapterSelectionActive, chapterSelectionSelectedIds, clearDragState, dragEnabled, imageIndexById, t],
  );
  // Handlers are cached per index and `dropGuideIndex` is deliberately NOT a
  // dependency: during a drag-over every crossed item re-renders the list,
  // and fresh handler objects would defeat the SidebarImageItem memo. The
  // guide line only needs the new index to render.
  const itemHandlersByIndex = useMemo(() => {
    const map = new Map<number, SidebarPageDragHandlers>();
    for (const [imgId, idx] of imageIndexById) {
      map.set(idx, buildHandlers(imgId, idx));
    }
    return map;
  }, [buildHandlers, imageIndexById]);
  const itemHandlers = useCallback(
    (img: LoadedImage, idx: number): SidebarPageDragHandlers => {
      const cached = itemHandlersByIndex.get(idx);
      if (cached) return cached;
      // Index outside the cached map (image added mid-drag): build on demand.
      return buildHandlers(img.id, idx);
    },
    [buildHandlers, itemHandlersByIndex],
  );
  // Dropping on the list background (outside a page item) appends at the end;
  // no guide line is drawn for that spot.
  const listHandlers = useCallback(
    (total: number): SidebarPageListHandlers => ({
      onDragOver: (event) => {
        if (!dragEnabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropGuideIndex(total);
      },
      onDrop: (event) => {
        if (!dragEnabled) return;
        event.preventDefault();
        const sourceIndices = dragSourceIndicesRef.current;
        clearDragState();
        if (sourceIndices === null) return;
        useImageCollectionStore.getState().moveImagesTo(sourceIndices, total);
      },
    }),
    [clearDragState, dragEnabled],
  );
  return { dropGuideIndex, itemHandlers, listHandlers };
}
