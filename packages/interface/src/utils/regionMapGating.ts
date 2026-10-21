import type { ToolMode } from "../types/dashboard.types";

export const EMPTY_REGION_MAP: Readonly<Record<string, never>> = Object.freeze({});
export const EMPTY_REGION_LIST: readonly never[] = Object.freeze([]);
export const EMPTY_BOOL_MAP: Readonly<Record<string, never>> = Object.freeze({});

/** Modes that display / mutate AIO region maps on the page. */
export function needsAioRegionMaps(mode: ToolMode): boolean {
  return (
    mode === "aio" ||
    mode === "typesetter" ||
    mode === "raw" ||
    mode === "proofreader"
  );
}

export function needsCleanerRegionMaps(mode: ToolMode): boolean {
  return mode === "cleaner";
}

export function needsTranslatorRegionMaps(mode: ToolMode): boolean {
  return mode === "translator";
}
