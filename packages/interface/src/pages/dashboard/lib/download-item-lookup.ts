import type { DownloadItem } from '../../../types/dashboard.types';
import { useExportStore } from '../stores/export-store';

/** Current AIO download item for an image, or null when none is registered. */
export function getAioDownloadItemForImage(
  imageId: string,
): DownloadItem | null {
  return useExportStore
    .getState()
    .downloadItems.find(
      (item) => item.scope === 'aio' && item.sourceImageId === imageId,
    ) ?? null;
}

/** Current cleaner download item for an image, or null when none is registered. */
export function getCleanerDownloadItemForImage(
  imageId: string,
): DownloadItem | null {
  return useExportStore
    .getState()
    .downloadItems.find(
      (item) => item.scope === 'cleaner' && item.sourceImageId === imageId,
    ) ?? null;
}
