import { useSyncExternalStore } from 'react';

import { getFontCatalogSnapshot, subscribeFontCatalog } from '../lib/font-catalog-cache';

export function useFontCatalogOptions(): readonly string[] {
  return useSyncExternalStore(subscribeFontCatalog, getFontCatalogSnapshot);
}
