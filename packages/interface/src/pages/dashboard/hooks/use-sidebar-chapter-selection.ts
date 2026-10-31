import { useCallback, useMemo, useState } from 'react';

import { useI18n } from '@/i18n';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

export interface SidebarChapterSelection {
  readonly active: boolean;
  /** Selected ids that still exist in the collection. */
  readonly selectedIds: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly toggleMode: () => void;
  readonly toggleImage: (imageId: string) => void;
  readonly createChapter: () => void;
  readonly clearChapter: () => void;
  readonly cancel: () => void;
}

/**
 * Multi-select over the file list plus the manual chapter actions. Chapters are
 * only labels on images, so creating one writes `chapterId`/`chapterLabel` to
 * the selected images and lets the Batch Mode queue group them.
 */
export function useSidebarChapterSelection(): SidebarChapterSelection {
  const { t } = useI18n();
  const images = useImageCollectionStore((state) => state.images);
  const assignChapterToImages = useImageCollectionStore(
    (state) => state.assignChapterToImages,
  );
  const isExtractingUploads = useImageCollectionStore(
    (state) => state.isExtractingUploads,
  );
  const processing = useUiShellStore((state) => state.processing);
  const setStatusMessage = useStatusStore((state) => state.setStatusMessage);

  const [active, setActive] = useState(false);
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const disabled = processing || isExtractingUploads;

  const selectedIds = useMemo(() => {
    const existing = new Set(images.map((image) => image.id));
    const next = new Set<string>();

    for (const id of pickedIds) {
      if (existing.has(id)) {
        next.add(id);
      }
    }

    return next;
  }, [images, pickedIds]);

  const cancel = useCallback(() => {
    setActive(false);
    setPickedIds(new Set());
  }, []);

  const toggleMode = useCallback(() => {
    setActive((previous) => {
      if (previous) {
        setPickedIds(new Set());
      }
      return !previous;
    });
  }, []);

  const toggleImage = useCallback((imageId: string) => {
    setPickedIds((previous) => {
      const next = new Set(previous);

      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }

      return next;
    });
  }, []);

  const createChapter = useCallback(() => {
    if (disabled) {
      return;
    }

    const ids = [...selectedIds];

    if (ids.length === 0) {
      setStatusMessage(t('dashboard.sidebar.selection.selectFirst'));
      return;
    }

    const defaultName = t('dashboard.sidebar.selection.defaultName');
    const manualCount = new Set(
      images
        .map((image) => image.chapterId)
        .filter((id): id is string => id?.startsWith('manual:') ?? false),
    ).size;
    const requested = window.prompt(
      t('dashboard.sidebar.selection.prompt'),
      `${defaultName} ${manualCount + 1}`,
    );

    if (requested === null) {
      return;
    }

    const label = requested.trim() || `${defaultName} ${manualCount + 1}`;

    assignChapterToImages(ids, { id: `manual:${crypto.randomUUID()}`, label });
    setStatusMessage(
      t('dashboard.sidebar.selection.created', {
        name: label,
        count: ids.length,
      }),
    );
    setActive(false);
    setPickedIds(new Set());
  }, [assignChapterToImages, disabled, images, selectedIds, setStatusMessage, t]);

  const clearChapter = useCallback(() => {
    if (disabled) {
      return;
    }

    const ids = [...selectedIds];

    if (ids.length === 0) {
      setStatusMessage(t('dashboard.sidebar.selection.selectFirst'));
      return;
    }

    assignChapterToImages(ids, null);
    setStatusMessage(
      t('dashboard.sidebar.selection.cleared', { count: ids.length }),
    );
    setActive(false);
    setPickedIds(new Set());
  }, [assignChapterToImages, disabled, selectedIds, setStatusMessage, t]);

  return {
    active,
    selectedIds,
    disabled,
    toggleMode,
    toggleImage,
    createChapter,
    clearChapter,
    cancel,
  };
}
