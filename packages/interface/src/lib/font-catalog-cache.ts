import { buildFontCatalog, getFontCatalogFallbackFamilies } from '../utils/font-catalog';

export type FontCatalogListener = () => void;

let publishedCatalog: readonly string[] | null = null;
let seedCatalog: readonly string[] | null = null;
const listeners = new Set<FontCatalogListener>();

const createSeedCatalog = (): readonly string[] => buildFontCatalog({
  osFamilies: [],
  customFamilies: [],
  fallbackFamilies: getFontCatalogFallbackFamilies(),
});

const areSameFamilies = (
  left: readonly string[],
  right: readonly string[],
): boolean => left.length === right.length && left.every((family, index) => family === right[index]);

export const getFontCatalogSnapshot = (): readonly string[] => {
  if (publishedCatalog !== null) {
    return publishedCatalog;
  }
  if (seedCatalog === null) {
    seedCatalog = createSeedCatalog();
  }
  return seedCatalog;
};

/** Equal content keeps the first reference, so array identity never churns. */
export const publishFontCatalog = (families: readonly string[]): void => {
  if (publishedCatalog !== null && areSameFamilies(publishedCatalog, families)) {
    return;
  }
  publishedCatalog = families;
  listeners.forEach((listener) => listener());
};

export const subscribeFontCatalog = (listener: FontCatalogListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
