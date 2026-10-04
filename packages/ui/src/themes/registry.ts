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
}

export const DEFAULT_THEME_FAMILY: KomaThemeFamily = 'classic';

export const THEME_FAMILIES: readonly ThemeFamilyDef[] = [
  {
    id: 'classic',
    nameKey: 'settings.theme.family.classic',
    descKey: 'settings.theme.family.classicDesc',
  },
  {
    id: 'noir',
    nameKey: 'settings.theme.family.noir',
    descKey: 'settings.theme.family.noirDesc',
  },
];

export const isThemeFamilyId = (value: unknown): value is KomaThemeFamily =>
  value === 'classic' || value === 'noir';
