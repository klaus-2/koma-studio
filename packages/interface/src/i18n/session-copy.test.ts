import { describe, expect, it } from "vitest";

import type { AppLocale } from "./config";
import { SUPPORTED_LOCALES } from "./config";
import {
  defaultMessages,
  defaultTranslationCatalogs,
  loadTranslationCatalog,
  translateMessage,
} from "./messages";

const KEY = "auth.error.sessionExpired";

const EXPECTED: Record<AppLocale, string> = {
  ar: "انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.",
  de: "Sitzung abgelaufen. Bitte melden Sie sich erneut an.",
  en: "Session expired. Please sign in again.",
  es: "Sesión expirada. Inicie sesión nuevamente.",
  fr: "Session expirée. Veuillez vous reconnecter.",
  hi: "सत्र समाप्त हो गया। कृपया फिर से साइन इन करें।",
  it: "Sessione scaduta. Effettua nuovamente l'accesso.",
  ja: "セッションの有効期限が切れました。再度ログインしてください。",
  ko: "세션이 만료되었습니다. 다시 로그인하세요.",
  pt: "Sessão expirada. Inicie sessão novamente.",
  "pt-br": "Sessão expirada. Faça login novamente.",
  ru: "Сессия истекла. Пожалуйста, войдите снова.",
  zh: "会话已过期。请重新登录。",
  "zh-tw": "工作階段已過期。請重新登入。",
};

describe("auth.error.sessionExpired catalog coverage", () => {
  it("covers all 14 client locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(14);
    expect(Object.keys(EXPECTED).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it("is present in the default (en) catalog and resolves through translateMessage", () => {
    expect(defaultMessages[KEY as keyof typeof defaultMessages]).toBe(EXPECTED.en);
    expect(translateMessage("en", KEY)).toBe(EXPECTED.en);
  });

  for (const locale of SUPPORTED_LOCALES) {
    it(`resolves ${locale} to a human string, not the raw key`, async () => {
      const catalog = await loadTranslationCatalog(locale);
      expect(catalog[KEY], locale).toBe(EXPECTED[locale]);
      expect(
        translateMessage(locale, KEY, undefined, { ...defaultTranslationCatalogs, [locale]: catalog }),
      ).not.toBe(KEY);
    });
  }
});
