import assert from "node:assert/strict";
import test from "node:test";

import { SUPPORTED_EMAIL_LOCALES, type EmailLocale } from "../src/services/locale.ts";
import { tServer } from "../src/services/server-i18n.ts";

const KEY = "auth.error.sessionRevoked";

const EXPECTED: Record<EmailLocale, string> = {
  ar: "انتهت الجلسة وتم إلغاءها. يرجى تسجيل الدخول مرة أخرى.",
  de: "Ihre Sitzung wurde widerrufen. Bitte melden Sie sich erneut an.",
  en: "Your session was revoked. Please sign in again.",
  es: "Su sesión fue revocada. Inicie sesión nuevamente.",
  fr: "Votre session a été révoquée. Veuillez vous reconnecter.",
  hi: "सत्र रद्द कर दिया गया है। कृपया फिर से साइन इन करें।",
  it: "La tua sessione è stata revocata. Effettua nuovamente l'accesso.",
  ja: "セッションは取り消されました。再度ログインしてください。",
  ko: "세션이 폐기되었습니다. 다시 로그인하세요.",
  pt: "A sua sessão foi revogada. Inicie sessão novamente.",
  "pt-br": "Sua sessão foi revogada. Faça login novamente.",
  ru: "Сессия была отозвана. Пожалуйста, войдите снова.",
  zh: "会话已被撤销。请重新登录。",
};

const FORBIDDEN_COPY: RegExp[] = [
  /credencial de dispositivo desktop inv[aá]lida/i,
  /dispositivo desktop n[aã]o registrado/i,
  /invalid desktop device credential/i,
  /desktop device not registered/i,
  /sess[aã]o desktop inv[aá]lida ou expirada/i,
  /acesso permitido apenas pelo aplicativo desktop/i,
  /desktop session invalid or expired/i,
  /access is only allowed through the desktop app/i,
];

test("server exposes exactly the 13 locales this fix targets", () => {
  assert.equal(SUPPORTED_EMAIL_LOCALES.length, 13);
});

test("tServer resolves auth.error.sessionRevoked for every server locale", () => {
  for (const locale of SUPPORTED_EMAIL_LOCALES) {
    const value = tServer(locale, KEY);
    assert.notEqual(value, KEY, `${locale} leaked the raw key (P1 regression)`);
    assert.equal(value, EXPECTED[locale], `${locale} copy drifted from the locked value`);
  }
});

test("the revoked-session copy never matches desktop-recovery patterns", () => {
  for (const locale of SUPPORTED_EMAIL_LOCALES) {
    const value = tServer(locale, KEY);
    for (const pattern of FORBIDDEN_COPY) {
      assert.ok(!pattern.test(value), `${locale} copy matches ${pattern} -> would trigger refresh-device`);
    }
  }
});

test("vacuity guard: an unknown key still resolves to itself", () => {
  assert.equal(tServer("de", "auth.error.definitelyNotAKey"), "auth.error.definitelyNotAKey");
});
