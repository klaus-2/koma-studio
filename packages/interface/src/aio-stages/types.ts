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

export interface StageRunNotice {
  title: string;
  detail: string;
  tone: 'fallback' | 'legacy';
}

export interface FinishedStageRun<T> {
  value: T;
  response: Response;
  notice: StageRunNotice | null;
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
