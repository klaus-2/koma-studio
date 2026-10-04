import { FormEvent, ReactNode } from "react";
import { Mail, Send } from "lucide-react";

import { AuthSimpleShell } from "../../components/auth/AuthSimpleShell";
import { Alert, Field, Submit } from "../../components/auth/noir/koma-ui";
import { useI18n } from "../../i18n";

export interface ForgotPasswordViewProps {
  title: string;
  subtitle: string;
  email: string;
  errorMessage: string;
  successMessage: string;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNavigateLogin: () => void;
}

export const ForgotPasswordNoir = ({
  title,
  subtitle,
  email,
  errorMessage,
  successMessage,
  isSubmitting,
  onEmailChange,
  onSubmit,
  onNavigateLogin,
}: ForgotPasswordViewProps): ReactNode => {
  const { t } = useI18n();

  return (
    <AuthSimpleShell accent={t("auth.noir.accentForgot")} title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
        {successMessage && <Alert tone="success">{successMessage}</Alert>}

        <form className="space-y-5" onSubmit={onSubmit}>
          <Field
            id="forgot-email"
            label={t("register.email")}
            icon={<Mail size={15} />}
            type="email"
            autoComplete="email"
            required
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <Submit loading={isSubmitting} loadingLabel={t("forgot.button.sending")}>
            {t("forgot.button.send")} <Send size={14} />
          </Submit>
        </form>

        <button
          type="button"
          onClick={onNavigateLogin}
          className="w-full text-center font-mono text-[10px] uppercase tracking-[0.25em] text-paper/40 hover:text-crimson"
        >
          ← {t("forgot.remembered")} {t("forgot.backToLogin")}
        </button>
      </div>
    </AuthSimpleShell>
  );
};
