/** Shared types for AIO stage-run modules. */
import type { AioTextRegion } from '../types/dashboard.types';

export interface StageImageRef {
  file: File;
  width: number;
  height: number;
}

export interface StageRuntime {
  localApiUrl: string;
  signal?: AbortSignal | null;
}

export type StageRunResult<T> =
  | { ok: true; response: Response; value: T }
  | { ok: false; response: Response; error: Error };

export interface StageGpuFlags {
  detectText?: boolean;
  recognizeText?: boolean;
  segmentText?: boolean;
  cleanImage?: boolean;
}

/** Lean Custom AI profile shape accepted by stage-run modules. */
export interface StageCustomLlmProfile {
  apiBase: string;
  apiKey: string;
  model?: string;
}

export function toStageCustomLlmPayload(
  profile: StageCustomLlmProfile | null | undefined,
): Record<string, string> | null {
  if (!profile) return null;
  const apiKey = profile.apiKey.trim();
  return {
    api_base: profile.apiBase,
    model: (profile.model ?? '').trim(),
    ...(apiKey ? { api_key: apiKey } : {}),
  };
}

export interface CleanImageStageOptions {
  maskDilation: number;
  hdStrategy: string;
  hdResizeLimit: number;
  hdCropMargin: number;
  hdCropTriggerSize: number;
  brushDataUrl?: string | null;
}

export type RegionList = readonly AioTextRegion[];
