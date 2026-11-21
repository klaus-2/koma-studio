import type { TranslationKey } from '../../i18n/messages';

export type QuickExportPreset = Readonly<{ id: string; labelKey: TranslationKey; format: string; quality: number }>;

export const QUICK_EXPORT_PRESETS: readonly QuickExportPreset[] = [
  { id: 'webp-light', labelKey: 'dashboard.topbar.quickExport.webpLight', format: 'image/webp', quality: 0.6 },
];
