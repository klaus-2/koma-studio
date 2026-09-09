export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError'
      : false;

export const isTimeoutError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'TimeoutError'
    : error instanceof Error
      ? error.name === 'TimeoutError'
      : false;

export const capitalizeStageLabel = (value: string): string =>
  value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export type AioExecutionScope = 'auto' | 'manual';

export interface AioExecutionStatus {
  scope: AioExecutionScope;
  stageKey: string | null;
  imageName: string | null;
  imageIndex: number | null;
  totalImages: number;
  label: string;
}

export const EMPTY_REGIONS: any[] = [];
export const EMPTY_SELECTED_REGION_IDS: string[] = [];

export const resolveCurrentFreeProviderModel = (
  model: string,
  allowedModels: string[],
  fallbackModel: string,
): string => {
  const normalized = String(model || '').trim();
  if (!normalized) {
    return fallbackModel;
  }
  if (allowedModels.includes(normalized)) {
    return normalized;
  }
  return fallbackModel;
};
