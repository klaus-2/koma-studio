import type { SetStateAction } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type {
  EnhanceProfile,
  EnhanceScale,
} from '../../../types/dashboard.types';

/**
 * Enhance tools domain: the image upscaler config slots (scale, profile,
 * selected model, output format) and the panel busy flag.
 */
interface EnhanceStore {
  /** Upscale factor (2x/4x). */
  enhanceScale: EnhanceScale;
  /** Enhancement profile preset. */
  enhanceProfile: EnhanceProfile;
  /** Selected model id from the filtered registry. */
  enhanceModelId: string;
  /** Output mime for the enhance API. */
  enhanceOutputFormat: 'png' | 'webp';
  /** True while an install/import action is running. */
  enhanceActionBusy: boolean;

  setEnhanceScale: (value: EnhanceScale) => void;
  setEnhanceProfile: (value: EnhanceProfile) => void;
  /** Value-or-updater: DashboardModelManagers receives this as a
   *  Dispatch&lt;SetStateAction&lt;string&gt;&gt; prop (call sites are value-only). */
  setEnhanceModelId: (value: SetStateAction<string>) => void;
  setEnhanceOutputFormat: (value: 'png' | 'webp') => void;
  setEnhanceActionBusy: (value: boolean) => void;
}

export const useEnhanceStore = create<EnhanceStore>()(
  devtools(
    (set) => ({
      // Same initial values the page's useState had.
      enhanceScale: 2,
      enhanceProfile: 'manga_scan',
      enhanceModelId: 'waifu2x_swin_unet_art_scan_2x',
      enhanceOutputFormat: 'png',
      enhanceActionBusy: false,

      setEnhanceScale: (enhanceScale) => set({ enhanceScale }),
      setEnhanceProfile: (enhanceProfile) => set({ enhanceProfile }),
      // Value-or-updater: keeps the Dispatch<SetStateAction<string>> prop type
      // of DashboardModelManagers assignable (call sites are value-only).
      setEnhanceModelId: (value) =>
        set((state) => ({
          enhanceModelId:
            typeof value === 'function' ? value(state.enhanceModelId) : value,
        })),
      setEnhanceOutputFormat: (enhanceOutputFormat) =>
        set({ enhanceOutputFormat }),
      setEnhanceActionBusy: (enhanceActionBusy) =>
        set({ enhanceActionBusy }),
    }),
    { name: 'enhance-store' },
  ),
);
