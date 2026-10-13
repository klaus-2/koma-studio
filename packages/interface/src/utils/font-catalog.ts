import { APP_WEBFONT_FAMILIES } from "../constants/app-webfonts";
import { DEFAULT_RENDER_FONT_FAMILIES } from "../constants/dashboard.constants";
import { desktopBridge } from "../lib/desktop-bridge";

export type FontCatalogSource = {
  osFamilies: readonly string[];
  customFamilies: readonly string[];
  fallbackFamilies: readonly string[];
};

const FAMILY_COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

const compareFamilies = (left: string, right: string): number =>
  FAMILY_COLLATOR.compare(left, right);

export const getFontCatalogFallbackFamilies = (): readonly string[] =>
  desktopBridge.desktop?.api?.fonts !== undefined ? [] : DEFAULT_RENDER_FONT_FAMILIES;

export const buildFontCatalog = (source: FontCatalogSource): string[] => {
  const familiesByLowerName = new Map<string, string>();

  const addFamily = (family: string): void => {
    const trimmedFamily = family.trim();
    if (!trimmedFamily) {
      return;
    }
    const dedupeKey = trimmedFamily.toLowerCase();
    if (!familiesByLowerName.has(dedupeKey)) {
      familiesByLowerName.set(dedupeKey, trimmedFamily);
    }
  };

  APP_WEBFONT_FAMILIES.forEach(addFamily);
  source.osFamilies.forEach(addFamily);
  source.customFamilies.forEach(addFamily);
  source.fallbackFamilies.forEach(addFamily);

  return [...familiesByLowerName.values()].sort(compareFamilies);
};
