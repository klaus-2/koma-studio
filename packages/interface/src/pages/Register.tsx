import { FormEvent, useState } from "react";

import { AuthShell } from "../components/auth/AuthShell";
import { LegalInlineLinks } from "../components/legal/LegalInlineLinks";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { useAuth } from "../hooks/useAuth";
import { createRegistrationLegalAcceptance } from "../legal/legalDocuments";
import { getPasswordPolicyErrors } from "../utils/passwordPolicy";
import { useI18n } from "../i18n";

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onNavigateLogin: () => void;
}

const PASSWORD_POLICY_ERROR_KEYS = {
  "Password must be at least 12 characters long.": "password.policy.minLength",
  "Password must contain at least one uppercase letter.": "password.policy.uppercase",
  "Password must contain at least one lowercase letter.": "password.policy.lowercase",
  "Password must contain at least one number.": "password.policy.number",
  "Password must contain at least one special symbol.": "password.policy.special",
} as const;

const handleSelectRegister = (): void => undefined;

export const RegisterPage = ({ onRegisterSuccess, onNavigateLogin }: RegisterPageProps) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);

  const { register } = useAuth();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage(t("register.error.passwordMismatch"));
      return;
    }
    const passwordErrors = getPasswordPolicyErrors(password);
    if (passwordErrors.length > 0) {
      const firstPasswordError = passwordErrors[0];
      if (!firstPasswordError) return;
      const passwordErrorKey =
        PASSWORD_POLICY_ERROR_KEYS[firstPasswordError as keyof typeof PASSWORD_POLICY_ERROR_KEYS];
      setErrorMessage(passwordErrorKey ? t(passwordErrorKey) : firstPasswordError);
      return;
    }
    if (!acceptedLegalTerms) {
      setErrorMessage(t("register.error.acceptTerms"));
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, name, undefined, createRegistrationLegalAcceptance());
      onRegisterSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("register.error.generic");
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      activeTab="register"
      onSelectLogin={onNavigateLogin}
      onSelectRegister={handleSelectRegister}
      subtitle={t("register.subtitle")}
    >
      {errorMessage && (
        <div className="auth-alert auth-alert--error" role="alert">
          {errorMessage}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="register-name">
            {t("register.displayName")}
          </label>
          <div className="auth-field__input-wrap">
            <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-6 8a6 6 0 0112 0H4z" />
            </svg>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              placeholder={t("register.displayNamePlaceholder")}
              className="auth-field__input auth-field__input--icon"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="register-email">
            {t("register.email")}
          </label>
          <div className="auth-field__input-wrap">
            <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("register.emailPlaceholder")}
              className="auth-field__input auth-field__input--icon"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="register-password">
            {t("register.password")}
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
              id="register-password"
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
          <label className="auth-field__label" htmlFor="register-confirm-password">
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
              id="register-confirm-password"
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

        <label className="auth-check auth-check--legal">
          <input
            type="checkbox"
            checked={acceptedLegalTerms}
            onChange={(event) => setAcceptedLegalTerms(event.target.checked)}
          />
          <span>
            {t("register.legalPrefix")}
            <span className="koma-legal-inline">
              <LegalInlineLinks />
            </span>
            . {t("register.legalSuffix")}
          </span>
        </label>

        <button type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? (
            <span className="auth-submit__loading">
              <span className="auth-spinner" />
              {t("register.button.creating")}
            </span>
          ) : (
            t("register.button.create")
          )}
        </button>
      </form>

      <div className="auth-divider" aria-hidden="true">
        <span className="auth-divider__line" />
        <span className="auth-divider__text">{t("register.alreadyHaveAccount")}</span>
        <span className="auth-divider__line" />
      </div>

      <p className="auth-switch">
        <button className="auth-link" onClick={onNavigateLogin} type="button">
          {t("register.button.loginNow")}
        </button>
      </p>
    </AuthShell>
  );
};
