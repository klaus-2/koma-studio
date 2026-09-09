import { useState } from "react";

import { AuthSimpleShell } from "../components/auth/AuthSimpleShell";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";

interface VerifyEmailPageProps {
  onBackDashboard: () => void;
}

export const VerifyEmailPage = ({ onBackDashboard }: VerifyEmailPageProps) => {
  const { t } = useI18n();
  const { user, sendVerificationEmail } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSend = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);
    try {
      await sendVerificationEmail();
      setSuccessMessage(t("verify.success"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("verify.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const alreadyVerified = user?.emailVerified === true;

  return (
    <AuthSimpleShell
      title={t("verify.title")}
      subtitle={
        alreadyVerified
          ? t("verify.subtitle.done")
          : t("verify.subtitle.pending")
      }
    >
      <div className="auth-email-display">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" className="auth-email-display__icon">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
        <span>{user?.email ?? t("verify.noEmail")}</span>
        {alreadyVerified && <span className="auth-email-display__verified">✓ {t("verify.verified")}</span>}
      </div>

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

      <div className="auth-form">
        <button
          type="button"
          disabled={isSubmitting || alreadyVerified}
          onClick={() => void handleSend()}
          className="auth-submit"
        >
          {isSubmitting ? (
            <span className="auth-submit__loading">
              <span className="auth-spinner" />
              {t("verify.button.sending")}
            </span>
          ) : alreadyVerified ? (
            t("verify.button.alreadyConfirmed")
          ) : (
            t("verify.button.resend")
          )}
        </button>

        <button type="button" onClick={onBackDashboard} className="auth-submit auth-submit--outline">
          ← {t("verify.button.backDashboard")}
        </button>
      </div>
    </AuthSimpleShell>
  );
};
