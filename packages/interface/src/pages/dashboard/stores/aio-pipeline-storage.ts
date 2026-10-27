import type { GpuStagePreferences } from '@/hooks/useAioSingleImageProcessor';
import { reportAioEvent } from '@/pages/dashboard/lib/aio-observability';
import {
  aioModelPresetStateV2Schema,
  type AioModelPresetStateV2,
} from '@/types/aioModelPresets';
import { loadPresetState } from '@/utils/aioModelPresets';

export const GPU_STAGES_STORAGE_KEY = 'koma-aio-gpu-stages';

const GPU_STAGE_KEYS = [
  'detectText',
  'recognizeText',
  'segmentText',
  'cleanImage',
] as const;

const parseGpuStagePreferences = (
  value: unknown,
): GpuStagePreferences | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const preferences = {} as GpuStagePreferences;
  for (const key of GPU_STAGE_KEYS) {
    const entry = record[key];
    if (entry !== undefined && typeof entry !== 'boolean') {
      return null;
    }
    preferences[key] = typeof entry === 'boolean' ? entry : true;
  }
  return preferences;
};

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
  const defaults = parseGpuStagePreferences({});
  if (defaults === null) {
    throw new Error('Unable to build the default GPU stage preferences.');
  }

  const saved = readAioStorage(GPU_STAGES_STORAGE_KEY);

  if (saved === null) {
    return defaults;
  }

  try {
    const preferences = parseGpuStagePreferences(JSON.parse(saved));
    if (preferences !== null) {
      return preferences;
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
