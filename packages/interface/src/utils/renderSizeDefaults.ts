/**
 * One-shot override of the persisted text-size defaults: Max Size (fontSize)
 * becomes the slider maximum and Min Size (minFontSize) the slider minimum.
 *
 * Every saved style the app can restore is rewritten once — each preset
 * catalog on first read and the first restored workspace document — and a flag
 * records that the override ran, so later edits stick.
 */

export const RENDER_SIZE_MAX = 160;
export const RENDER_SIZE_MIN = 6;

/** Pre-migration defaults; used to spot styles that were never customized. */
export const LEGACY_RENDER_SIZE_MAX = 40;
export const LEGACY_RENDER_SIZE_MIN = 10;

export const RENDER_SIZE_WORKSPACE_MIGRATION_KEY =
  'koma-render-size-defaults-workspace-v2';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** A RenderTextStyle is the only saved holder of both sizes; watermark text
 *  layers also carry fontSize and must not be touched. */
const isRenderTextStyle = (value: Record<string, unknown>): boolean =>
  typeof value.fontSize === 'number' && typeof value.minFontSize === 'number';

/** Sets fontSize→RENDER_SIZE_MAX and minFontSize→RENDER_SIZE_MIN on every
 *  render text style in the tree, in place. */
export const forceRenderSizesInPlace = (value: unknown, depth = 0): void => {
  if (!value || typeof value !== 'object' || depth > 32) return;
  if (Array.isArray(value)) {
    value.forEach((item) => forceRenderSizesInPlace(item, depth + 1));
    return;
  }
  if (!isPlainObject(value)) return;
  if (isRenderTextStyle(value)) {
    value.fontSize = RENDER_SIZE_MAX;
    value.minFontSize = RENDER_SIZE_MIN;
    return;
  }
  Object.keys(value).forEach((key) => forceRenderSizesInPlace(value[key], depth + 1));
};

/** Cache-layer variant: only styles still on the pre-migration defaults are
 *  rewritten, so cached sessions never resurface the old sizes and customized
 *  values survive. */
export const forceLegacyRenderSizesInPlace = (value: unknown, depth = 0): void => {
  if (!value || typeof value !== 'object' || depth > 32) return;
  if (Array.isArray(value)) {
    value.forEach((item) => forceLegacyRenderSizesInPlace(item, depth + 1));
    return;
  }
  if (!isPlainObject(value)) return;
  if (isRenderTextStyle(value)) {
    if (value.fontSize === LEGACY_RENDER_SIZE_MAX) value.fontSize = RENDER_SIZE_MAX;
    if (value.minFontSize === LEGACY_RENDER_SIZE_MIN) value.minFontSize = RENDER_SIZE_MIN;
    return;
  }
  Object.keys(value).forEach((key) => forceLegacyRenderSizesInPlace(value[key], depth + 1));
};

/** Typography presets are an array of entries with a nested `style`; the
 *  render-mode catalog is a record of per-mode presets with a flat fontSize. */
const rewriteCatalog = (catalog: Record<string, unknown>): void => {
  const presets = catalog.presets;
  if (Array.isArray(presets)) {
    presets.forEach((preset) => {
      if (isPlainObject(preset) && isPlainObject(preset.style)) {
        forceRenderSizesInPlace(preset.style);
      }
    });
    return;
  }
  if (isPlainObject(presets)) {
    Object.values(presets).forEach((preset) => {
      if (isPlainObject(preset) && typeof preset.fontSize === 'number') {
        preset.fontSize = RENDER_SIZE_MAX;
      }
    });
  }
};

/** Rewrites one persisted catalog once; call before reading it. The flag is
 *  scoped to the storage key so each catalog migrates independently. */
export const migrateRenderSizeCatalog = (storageKey: string): void => {
  if (typeof window === 'undefined') return;
  const flagKey = `${storageKey}:render-size-defaults-v2`;
  if (window.localStorage.getItem(flagKey)) return;

  try {
    const raw = window.localStorage.getItem(storageKey);
    const catalog: unknown = raw ? JSON.parse(raw) : null;
    if (isPlainObject(catalog)) {
      rewriteCatalog(catalog);
      window.localStorage.setItem(storageKey, JSON.stringify(catalog));
    }
  } catch {
    // A corrupt catalog falls back to the in-code defaults on read.
  }

  window.localStorage.setItem(flagKey, '1');
};

export const shouldMigrateWorkspaceRenderSizes = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !window.localStorage.getItem(RENDER_SIZE_WORKSPACE_MIGRATION_KEY);
};

export const markWorkspaceRenderSizesMigrated = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RENDER_SIZE_WORKSPACE_MIGRATION_KEY, '1');
};
