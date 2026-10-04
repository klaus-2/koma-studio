import { FormEvent, ReactNode } from "react";
import { Lock, CheckCheck, RefreshCcw } from "lucide-react";

import { AuthSimpleShell } from "../../components/auth/AuthSimpleShell";
import { Alert, Field, Submit } from "../../components/auth/noir/koma-ui";
import { PasswordStrength } from "../../components/auth/PasswordStrength";
import { useI18n } from "../../i18n";

export interface ResetPasswordViewProps {
  title: string;
  subtitle: string;
  hasToken: boolean;
  password: string;
  confirmPassword: string;
  errorMessage: string;
  successMessage: string;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNavigateLogin: () => void;
}

export const ResetPasswordNoir = ({
  title,
  subtitle,
  hasToken,
  password,
  confirmPassword,
  errorMessage,
  successMessage,
  isSubmitting,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onNavigateLogin,
}: ResetPasswordViewProps): ReactNode => {
  const { t } = useI18n();

  return (
    <AuthSimpleShell accent={t("auth.noir.accentReset")} title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
        {successMessage && <Alert tone="success">{successMessage}</Alert>}

        <form className="space-y-5" onSubmit={onSubmit}>
          <Field
            id="reset-password"
            label={t("reset.newPassword")}
            icon={<Lock size={15} />}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("register.passwordPlaceholder")}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
          <PasswordStrength password={password} />
          <Field
            id="reset-confirm"
            label={t("register.confirmPassword")}
            icon={<CheckCheck size={15} />}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("register.confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
          />
          <Submit loading={isSubmitting} loadingLabel={t("reset.button.submitting")} disabled={!hasToken}>
            {t("reset.button.submit")} <RefreshCcw size={14} />
          </Submit>
        </form>

        <button
          type="button"
          onClick={onNavigateLogin}
          className="w-full text-center font-mono text-[10px] uppercase tracking-[0.25em] text-paper/40 hover:text-crimson"
        >
          ← {t("forgot.backToLogin")}
        </button>
      </div>
    </AuthSimpleShell>
  );
};
