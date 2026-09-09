import { FormEvent, useMemo, useState } from "react";

import { AuthSimpleShell } from "../components/auth/AuthSimpleShell";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { useAuth } from "../hooks/useAuth";
import { getPasswordPolicyErrors } from "../utils/passwordPolicy";
import { useI18n } from "../i18n";

interface ResetPasswordPageProps {
  onNavigateLogin: () => void;
}

const PASSWORD_POLICY_ERROR_KEYS = {
  "Password must be at least 12 characters long.": "password.policy.minLength",
  "Password must contain at least one uppercase letter.": "password.policy.uppercase",
  "Password must contain at least one lowercase letter.": "password.policy.lowercase",
  "Password must contain at least one number.": "password.policy.number",
  "Password must contain at least one special symbol.": "password.policy.special",
} as const;

const getResetTokenFromLocation = (): string => {
  const searchToken = new URLSearchParams(window.location.search).get("token");
  if (searchToken) return searchToken;
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(hashQuery).get("token") ?? "";
};

export const ResetPasswordPage = ({ onNavigateLogin }: ResetPasswordPageProps) => {
  const { t } = useI18n();
  const { resetPassword } = useAuth();
  const token = useMemo(() => getResetTokenFromLocation(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!token) {
      setErrorMessage(t("reset.error.missingToken"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t("register.error.passwordMismatch"));
      return;
    }
    const passwordErrors = getPasswordPolicyErrors(password);
    if (passwordErrors.length > 0) {
      const passwordErrorKey =
        PASSWORD_POLICY_ERROR_KEYS[passwordErrors[0] as keyof typeof PASSWORD_POLICY_ERROR_KEYS];
      setErrorMessage(passwordErrorKey ? t(passwordErrorKey) : (passwordErrors[0] ?? ''));
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccessMessage(t("reset.success"));
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("reset.error.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSimpleShell title={t("reset.title")} subtitle={t("reset.subtitle")}>
      {errorMessage && (
        <div className="auth-alert auth-alert--error" role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="auth-alert auth-alert--success" role="status">
          {successMessage}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reset-password">
            {t("reset.newPassword")}
          </label>
          <div className="auth-field__input-wrap">
            <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              required
              placeholder={t("register.passwordPlaceholder")}
              className="auth-field__input auth-field__input--icon"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <PasswordStrength password={password} />

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reset-confirm-password">
            {t("register.confirmPassword")}
          </label>
          <div className="auth-field__input-wrap">
            <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <input
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              placeholder={t("register.confirmPasswordPlaceholder")}
              className="auth-field__input auth-field__input--icon"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={isSubmitting || !token} className="auth-submit">
          {isSubmitting ? (
            <span className="auth-submit__loading">
              <span className="auth-spinner" />
              {t("reset.button.submitting")}
            </span>
          ) : (
            t("reset.button.submit")
          )}
        </button>
      </form>

      <p className="auth-switch">
        <button className="auth-link" onClick={onNavigateLogin} type="button">
          ← {t("forgot.backToLogin")}
        </button>
      </p>
    </AuthSimpleShell>
  );
};
