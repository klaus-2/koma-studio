/* ============================================================
   KŌMA STUDIO — Theme Families Registry
   Single source of truth for the available design-system
   themes ("families"). Settings and the in-app switchers
   render from this list; new families only get added here.
   ============================================================ */

import type { KomaThemeFamily } from '../stores/theme-store';

export interface ThemeFamilyDef {
  id: KomaThemeFamily;
  /** i18n keys for name/description */
  nameKey: string;
  descKey: string;
  /** Display glyph identifying the family in switchers/settings. */
  glyph: string;
}

export const DEFAULT_THEME_FAMILY: KomaThemeFamily = 'classic';

export const THEME_FAMILIES: readonly ThemeFamilyDef[] = [
  {
    id: 'classic',
    nameKey: 'settings.theme.family.classic',
    descKey: 'settings.theme.family.classicDesc',
    glyph: '色',
  },
  {
    id: 'noir',
    nameKey: 'settings.theme.family.noir',
    descKey: 'settings.theme.family.noirDesc',
    glyph: 'コマ',
  },
];

export const isThemeFamilyId = (value: unknown): value is KomaThemeFamily =>
  value === 'classic' || value === 'noir';
