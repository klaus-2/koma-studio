import type { TranslationKey } from "../../i18n/messages";

export interface PasswordRule {
  labelKey: TranslationKey;
  test: (password: string) => boolean;
}

export interface PasswordLevel {
  labelKey: TranslationKey;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { labelKey: "password.rule.minLength", test: (pw) => pw.length >= 8 },
  { labelKey: "password.rule.uppercase", test: (pw) => /[A-Z]/.test(pw) },
  { labelKey: "password.rule.lowercase", test: (pw) => /[a-z]/.test(pw) },
  { labelKey: "password.rule.number", test: (pw) => /\d/.test(pw) },
  { labelKey: "password.rule.special", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const PASSWORD_LEVELS: readonly PasswordLevel[] = [
  { labelKey: "password.level.veryWeak" },
  { labelKey: "password.level.weak" },
  { labelKey: "password.level.fair" },
  { labelKey: "password.level.good" },
  { labelKey: "password.level.strong" },
];

/** Shared password-strength model — skins only paint the result. */
export function evaluatePasswordStrength(password: string): {
  passed: number;
  /** -1 when empty; otherwise 0..PASSWORD_LEVELS.length - 1 */
  level: number;
  ruleResults: ReadonlyArray<{ rule: PasswordRule; ok: boolean }>;
} {
  const ruleResults = PASSWORD_RULES.map((rule) => ({
    rule,
    ok: rule.test(password),
  }));
  const passed = ruleResults.filter((entry) => entry.ok).length;
  const level =
    password.length === 0
      ? -1
      : Math.min(passed, PASSWORD_LEVELS.length - 1);
  return { passed, level, ruleResults };
}
