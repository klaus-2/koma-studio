import type { SetStateAction } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  AioDownloadEntry,
  DownloadBundleFormat,
  DownloadItem,
  ProcessableMode,
  PsdCompression,
} from '../../../types/dashboard.types';

/**
 * Export-download domain: the blob registry shared with the AIO/cleaner
 * domains, the last-action scope fallback and the download settings
 * (bundle/PSD options) consumed by the topbar download menus.
 */
interface ExportStore {
  /** Download blob registry (aio/cleaner/translator scopes). */
  downloadItems: DownloadItem[];
  /** Fallback download scope for the topbar gating. */
  lastActionScope: ProcessableMode | null;
  /** Export mime. */
  outFormat: string;
  /** Export quality. */
  outQuality: number;
  downloadBundleFormat: DownloadBundleFormat;
  downloadIncludeRawText: boolean;
  downloadIncludeTranslatedText: boolean;
  downloadIncludeInpaintedImage: boolean;
  downloadPsdCompression: PsdCompression;
  downloadPsdDpi: number;
  downloadPsdIncludeOcrOverlay: boolean;
  downloadPsdIncludeIndividualCrops: boolean;
  downloadPsdIncludeRawTextLayer: boolean;
  downloadPsdIncludeTranslatedTextLayer: boolean;
  downloadPsdUsePhotoshopTextLayers: boolean;
  downloadPsdIncludeMetadataJson: boolean;
  /** True while the PSD export request is running. */
  downloadPsdLoading: boolean;

  /** Value-or-updater: the image-collection hook, the cleaner healing hook
   *  and the restore all use functional updaters (same-name args). */
  setDownloadItems: (value: SetStateAction<DownloadItem[]>) => void;
  /** Value-or-updater: the image-collection/translator hooks receive a
   *  Dispatch<SetStateAction<ProcessableMode | null>> same-name arg. */
  setLastActionScope: (value: SetStateAction<ProcessableMode | null>) => void;
  setOutFormat: (value: string) => void;
  setOutQuality: (value: number) => void;
  setDownloadBundleFormat: (value: DownloadBundleFormat) => void;
  setDownloadIncludeRawText: (value: boolean) => void;
  setDownloadIncludeTranslatedText: (value: boolean) => void;
  setDownloadIncludeInpaintedImage: (value: boolean) => void;
  setDownloadPsdCompression: (value: PsdCompression) => void;
  setDownloadPsdDpi: (value: number) => void;
  setDownloadPsdIncludeOcrOverlay: (value: boolean) => void;
  setDownloadPsdIncludeIndividualCrops: (value: boolean) => void;
  setDownloadPsdIncludeRawTextLayer: (value: boolean) => void;
  setDownloadPsdIncludeTranslatedTextLayer: (value: boolean) => void;
  setDownloadPsdUsePhotoshopTextLayers: (value: boolean) => void;
  setDownloadPsdIncludeMetadataJson: (value: boolean) => void;
  setDownloadPsdLoading: (value: boolean) => void;

  /** Replaces every aio-scope item (composed action, page callback 1:1). */
  setAioDownloadItems: (entries: AioDownloadEntry[]) => void;
  /** Sets/clears the aio-scope item of one image (composed action, 1:1). */
  setAioDownloadItemForImage: (imageId: string, entry: AioDownloadEntry | null) => void;
}

export const useExportStore = create<ExportStore>()(
  devtools(
    (set, get) => ({
      // Same initial values the page's useState had.
      downloadItems: [],
      lastActionScope: null,
      outFormat: 'image/png',
      outQuality: 0.9,
      downloadBundleFormat: 'zip',
      downloadIncludeRawText: true,
      downloadIncludeTranslatedText: true,
      downloadIncludeInpaintedImage: true,
      downloadPsdCompression: 'rle',
      downloadPsdDpi: 300,
      downloadPsdIncludeOcrOverlay: true,
      downloadPsdIncludeIndividualCrops: true,
      downloadPsdIncludeRawTextLayer: true,
      downloadPsdIncludeTranslatedTextLayer: true,
      downloadPsdUsePhotoshopTextLayers: false,
      downloadPsdIncludeMetadataJson: true,
      downloadPsdLoading: false,

      // Value-or-updater: keeps the Dispatch<SetStateAction<T>> same-name
      // args of the image-collection/cleaner hooks assignable.
      setDownloadItems: (value) =>
        set((state) => ({
          downloadItems:
            typeof value === 'function' ? value(state.downloadItems) : value,
        })),
      setLastActionScope: (value) =>
        set((state) => ({
          lastActionScope:
            typeof value === 'function' ? value(state.lastActionScope) : value,
        })),
      setOutFormat: (outFormat) => set({ outFormat }),
      setOutQuality: (outQuality) => set({ outQuality }),
      setDownloadBundleFormat: (downloadBundleFormat) =>
        set({ downloadBundleFormat }),
      setDownloadIncludeRawText: (downloadIncludeRawText) =>
        set({ downloadIncludeRawText }),
      setDownloadIncludeTranslatedText: (downloadIncludeTranslatedText) =>
        set({ downloadIncludeTranslatedText }),
      setDownloadIncludeInpaintedImage: (downloadIncludeInpaintedImage) =>
        set({ downloadIncludeInpaintedImage }),
      setDownloadPsdCompression: (downloadPsdCompression) =>
        set({ downloadPsdCompression }),
      setDownloadPsdDpi: (downloadPsdDpi) => set({ downloadPsdDpi }),
      setDownloadPsdIncludeOcrOverlay: (downloadPsdIncludeOcrOverlay) =>
        set({ downloadPsdIncludeOcrOverlay }),
      setDownloadPsdIncludeIndividualCrops: (downloadPsdIncludeIndividualCrops) =>
        set({ downloadPsdIncludeIndividualCrops }),
      setDownloadPsdIncludeRawTextLayer: (downloadPsdIncludeRawTextLayer) =>
        set({ downloadPsdIncludeRawTextLayer }),
      setDownloadPsdIncludeTranslatedTextLayer: (
        downloadPsdIncludeTranslatedTextLayer,
      ) => set({ downloadPsdIncludeTranslatedTextLayer }),
      setDownloadPsdUsePhotoshopTextLayers: (
        downloadPsdUsePhotoshopTextLayers,
      ) => set({ downloadPsdUsePhotoshopTextLayers }),
      setDownloadPsdIncludeMetadataJson: (downloadPsdIncludeMetadataJson) =>
        set({ downloadPsdIncludeMetadataJson }),
      setDownloadPsdLoading: (downloadPsdLoading) =>
        set({ downloadPsdLoading }),

      // Composed actions, ported 1:1 from the page's useCallback bodies.
      setAioDownloadItems: (entries) => {
        get().setDownloadItems((prev) => {
          const keep = prev.filter((item) => item.scope !== 'aio');
          prev
            .filter((item) => item.scope === 'aio')
            .forEach((item) => URL.revokeObjectURL(item.previewUrl));
          if (entries.length === 0) return keep;
          const aioItems: DownloadItem[] = entries.map((entry) => ({
            name: entry.fileName,
            blob: entry.blob,
            scope: 'aio',
            sourceImageId: entry.sourceImageId,
            previewUrl: URL.createObjectURL(entry.blob),
          }));
          return [...keep, ...aioItems];
        });
        if (entries.length > 0) {
          get().setLastActionScope('aio');
        }
      },
      setAioDownloadItemForImage: (imageId, entry) => {
        get().setDownloadItems((prev) => {
          const next: DownloadItem[] = [];
          prev.forEach((item) => {
            if (item.scope === 'aio' && item.sourceImageId === imageId) {
              URL.revokeObjectURL(item.previewUrl);
              return;
            }
            next.push(item);
          });
          if (entry) {
            next.push({
              name: entry.fileName,
              blob: entry.blob,
              scope: 'aio',
              sourceImageId: entry.sourceImageId,
              previewUrl: URL.createObjectURL(entry.blob),
            });
          }
          return next;
        });
        if (entry) {
          get().setLastActionScope('aio');
        }
      },
    }),
    { name: 'export-store' },
  ),
);
