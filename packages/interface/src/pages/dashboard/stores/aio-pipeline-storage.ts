import { z } from 'zod';

import type { GpuStagePreferences } from '@/hooks/useAioSingleImageProcessor';
import { reportAioEvent } from '@/pages/dashboard/lib/aio-observability';
import {
  aioModelPresetStateV2Schema,
  type AioModelPresetStateV2,
} from '@/types/aioModelPresets';
import { loadPresetState } from '@/utils/aioModelPresets';

export const GPU_STAGES_STORAGE_KEY = 'koma-aio-gpu-stages';

const gpuStagePreferencesSchema = z.object({
  detectText: z.boolean().default(true),
  recognizeText: z.boolean().default(true),
  segmentText: z.boolean().default(true),
  cleanImage: z.boolean().default(true),
});

export function readAioStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    reportAioEvent('storage-read-failed');
    return null;
  }
}

export function writeAioStorage(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    reportAioEvent('storage-write-failed');
  }
}

export function loadGpuStagePreferences(): GpuStagePreferences {
  const defaults = gpuStagePreferencesSchema.parse({});
  const saved = readAioStorage(GPU_STAGES_STORAGE_KEY);

  if (saved === null) {
    return defaults;
  }

  try {
    const payload: unknown = JSON.parse(saved);
    const result = gpuStagePreferencesSchema.safeParse(payload);

    if (result.success) {
      return result.data;
    }
  } catch {
    reportAioEvent('storage-validation-failed');
    return defaults;
  }

  reportAioEvent('storage-validation-failed');
  return defaults;
}

export function loadValidatedPresetState(): AioModelPresetStateV2 {
  try {
    const result = aioModelPresetStateV2Schema.safeParse(loadPresetState());

    if (result.success) {
      return result.data;
    }
  } catch {
    reportAioEvent('storage-read-failed');
  }

  reportAioEvent('storage-validation-failed');

  return {
    version: 2,
    presets: [],
    activePresetBySourceLanguage: {},
  };
}
