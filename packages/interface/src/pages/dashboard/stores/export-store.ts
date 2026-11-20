import type { SetStateAction } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { isRecord } from '../../../utils/guards';
import type {
  AioDownloadEntry,
  DownloadBundleFormat,
  DownloadItem,
  ProcessableMode,
  PsdCompression,
} from '../../../types/dashboard.types';

/** Storage key of the export-naming persistence boundary. */
const EXPORT_NAMING_STORAGE_KEY = 'koma-studio.export-naming.v1';
const MAX_RECENT_NAMING_PATTERNS = 5;

/* Untrusted localStorage JSON is narrowed through isRecord before any field is
   read (works-store boundary); quota-blocked writes keep memory authoritative. */
const loadPersistedNaming = (): {
  namingPattern: string;
  recentNamingPatterns: string[];
} => {
  const fallback = { namingPattern: '', recentNamingPatterns: [] };
  if (typeof window === 'undefined') return fallback;
  let value: unknown = null;
  try {
    value = JSON.parse(
      window.localStorage.getItem(EXPORT_NAMING_STORAGE_KEY) ?? 'null',
    );
  } catch (error) {
    console.warn('Failed to parse the persisted export naming.', error);
    return fallback;
  }
  if (!isRecord(value)) return fallback;
  const recents = Array.isArray(value.recentNamingPatterns)
    ? value.recentNamingPatterns
    : [];
  return {
    namingPattern:
      typeof value.namingPattern === 'string' ? value.namingPattern : '',
    recentNamingPatterns: recents
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
      .slice(0, MAX_RECENT_NAMING_PATTERNS),
  };
};

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

  /** User file-name pattern; '' keeps the legacy names. */
  namingPattern: string;
  /** Most-recent-first non-empty patterns actually used, capped at 5. */
  recentNamingPatterns: string[];
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
  setNamingPattern: (value: string) => void;
  /** Records a pattern as recently used (dedup, most-recent-first, cap 5). */
  addRecentNamingPattern: (pattern: string) => void;

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
      namingPattern: loadPersistedNaming().namingPattern,
      recentNamingPatterns: loadPersistedNaming().recentNamingPatterns,

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
      setNamingPattern: (namingPattern) => set({ namingPattern }),
      addRecentNamingPattern: (pattern) =>
        set((state) => {
          const trimmed = pattern.trim();
          if (!trimmed) {
            return state;
          }
          const next = [
            trimmed,
            ...state.recentNamingPatterns.filter((existing) => existing !== trimmed),
          ].slice(0, MAX_RECENT_NAMING_PATTERNS);
          return { recentNamingPatterns: next };
        }),

      // Composed actions, ported 1:1 from the page's useCallback bodies.
      setAioDownloadItems: (entries) => {
        get().setDownloadItems((prev) => {
          const keep: DownloadItem[] = [];
          const reusableByImageId = new Map<string, DownloadItem>();
          const staleAio: DownloadItem[] = [];
          for (const item of prev) {
            if (item.scope !== 'aio') {
              keep.push(item);
              continue;
            }
            if (
              item.sourceImageId !== undefined &&
              !reusableByImageId.has(item.sourceImageId)
            ) {
              reusableByImageId.set(item.sourceImageId, item);
            } else {
              staleAio.push(item);
            }
          }
          const dedupedEntries: AioDownloadEntry[] = [];
          const indexByImageId = new Map<string, number>();
          for (const entry of entries) {
            const existingIndex = indexByImageId.get(entry.sourceImageId);
            if (existingIndex !== undefined) {
              dedupedEntries[existingIndex] = entry;
            } else {
              indexByImageId.set(entry.sourceImageId, dedupedEntries.length);
              dedupedEntries.push(entry);
            }
          }
          const aioItems: DownloadItem[] = [];
          for (const entry of dedupedEntries) {
            const existing = reusableByImageId.get(entry.sourceImageId);
            if (
              existing !== undefined &&
              existing.blob === entry.blob &&
              existing.name === entry.fileName
            ) {
              reusableByImageId.delete(entry.sourceImageId);
              aioItems.push(existing);
              continue;
            }
            aioItems.push({
              name: entry.fileName,
              blob: entry.blob,
              scope: 'aio',
              sourceImageId: entry.sourceImageId,
              previewUrl: URL.createObjectURL(entry.blob),
            });
          }
          for (const unused of reusableByImageId.values()) {
            URL.revokeObjectURL(unused.previewUrl);
          }
          for (const extra of staleAio) {
            URL.revokeObjectURL(extra.previewUrl);
          }
          return [...keep, ...aioItems];
        });
        if (entries.length > 0) {
          get().setLastActionScope('aio');
        }
      },
      setAioDownloadItemForImage: (imageId, entry) => {
        const existing = get()
          .downloadItems.find(
            (item) => item.scope === 'aio' && item.sourceImageId === imageId,
          ) ?? null;
        if (
          (existing === null && entry === null) ||
          (existing !== null &&
            entry !== null &&
            existing.blob === entry.blob &&
            existing.name === entry.fileName)
        ) {
          return;
        }
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

/* SYNC-EXTERNAL: mirrors the naming pattern + recents to localStorage on
   change (explicit sync stays the source of truth, works-store pattern). */
if (typeof window !== 'undefined') {
  let lastPersistedNaming: string | null = null;
  useExportStore.subscribe((state) => {
    const payload = JSON.stringify({
      namingPattern: state.namingPattern,
      recentNamingPatterns: state.recentNamingPatterns,
    });
    if (payload === lastPersistedNaming) return;
    lastPersistedNaming = payload;
    try {
      window.localStorage.setItem(EXPORT_NAMING_STORAGE_KEY, payload);
    } catch (error) {
      // Quota-blocked localStorage must not take the store down.
      console.warn('Failed to persist the export naming.', error);
    }
  });
}
