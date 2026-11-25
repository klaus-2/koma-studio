import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { LoadedImage } from '../../../types/dashboard.types';
import type { DuplicateMatch } from '../utils/import-duplicates';

export interface PendingDuplicateImport {
  /** The full import batch awaiting the duplicate decision. */
  images: LoadedImage[];
  matches: readonly DuplicateMatch[];
  /** Completes the interrupted import with the pages the user chose to keep. */
  resume: (keptImages: readonly LoadedImage[]) => void;
}

interface ImportDuplicatesStore {
  pending: PendingDuplicateImport | null;
  openPending: (pending: PendingDuplicateImport) => void;
  clearPending: () => void;
}

export const useImportDuplicatesStore = create<ImportDuplicatesStore>()(
  devtools(
    (set) => ({
      pending: null,
      openPending: (pending) => set({ pending }),
      clearPending: () => set({ pending: null }),
    }),
    { name: 'import-duplicates-store', enabled: import.meta.env.DEV },
  ),
);
