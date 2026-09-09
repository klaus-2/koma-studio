import { FormEvent, useState } from "react";

import { AuthSimpleShell } from "../components/auth/AuthSimpleShell.tsx";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";

interface ForgotPasswordPageProps {
  onNavigateLogin: () => void;
}

export const ForgotPasswordPage = ({ onNavigateLogin }: ForgotPasswordPageProps) => {
  const { t } = useI18n();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSuccessMessage(t("forgot.success"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("forgot.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSimpleShell title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
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
          <label className="auth-field__label" htmlFor="forgot-email">
            {t("register.email")}
          </label>
          <div className="auth-field__input-wrap">
            <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("login.emailPlaceholder")}
              className="auth-field__input auth-field__input--icon"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? (
            <span className="auth-submit__loading">
              <span className="auth-spinner" />
              {t("forgot.button.sending")}
            </span>
          ) : (
            t("forgot.button.send")
          )}
        </button>
      </form>

      <p className="auth-switch">
        {t("forgot.remembered")}{" "}
        <button className="auth-link" onClick={onNavigateLogin} type="button">
          {t("forgot.backToLogin")}
        </button>
      </p>
    </AuthSimpleShell>
  );
};
