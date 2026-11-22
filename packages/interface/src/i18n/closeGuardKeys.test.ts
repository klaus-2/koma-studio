import { describe, expect, it } from 'vitest';

import type { TranslationCatalog } from '@/i18n/messages';
import { arMessages } from '@/i18n/langs/ar';
import { deMessages } from '@/i18n/langs/de';
import { enMessages } from '@/i18n/langs/en';
import { esMessages } from '@/i18n/langs/es';
import { frMessages } from '@/i18n/langs/fr';
import { hiMessages } from '@/i18n/langs/hi';
import { itMessages } from '@/i18n/langs/it';
import { jaMessages } from '@/i18n/langs/ja';
import { koMessages } from '@/i18n/langs/ko';
import { ptMessages } from '@/i18n/langs/pt';
import { ptBrMessages } from '@/i18n/langs/ptBR';
import { ruMessages } from '@/i18n/langs/ru';
import { zhMessages as zhCnMessages } from '@/i18n/langs/zh';
import { zhMessages as zhTwMessages } from '@/i18n/langs/zhTW';

const localeCatalogs: Record<string, TranslationCatalog> = {
  ar: arMessages,
  de: deMessages,
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  hi: hiMessages,
  it: itMessages,
  ja: jaMessages,
  ko: koMessages,
  pt: ptMessages,
  'pt-br': ptBrMessages,
  ru: ruMessages,
  zh: zhCnMessages,
  'zh-tw': zhTwMessages,
};

const CLOSE_GUARD_KEYS = [
  'desktop.closeGuard.title',
  'desktop.closeGuard.body',
  'desktop.closeGuard.closeAnyway',
  'desktop.closeGuard.cancel',
] as const;

describe('desktop close guard i18n keys', () => {
  it('resolves the close guard keys in every locale catalog', () => {
    for (const [locale, catalog] of Object.entries(localeCatalogs)) {
      const missing = CLOSE_GUARD_KEYS.filter((key) => !(key in catalog));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });

  it('has non-empty values for every close guard key', () => {
    for (const [locale, catalog] of Object.entries(localeCatalogs)) {
      for (const key of CLOSE_GUARD_KEYS) {
        expect(typeof catalog[key], `${locale}:${key}`).toBe('string');
        expect((catalog[key] ?? '').length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });
});
