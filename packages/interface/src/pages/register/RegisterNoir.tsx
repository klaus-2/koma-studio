import { FormEvent, ReactNode } from "react";
import { User, Mail, Lock, CheckCheck, ArrowRight } from "lucide-react";

import { AuthShell } from "../../components/auth/AuthShell";
import { Alert, Field, Submit } from "../../components/auth/noir/koma-ui";
import { PasswordStrength } from "../../components/auth/PasswordStrength";
import { LegalInlineLinks } from "../../components/legal/LegalInlineLinks";
import { useI18n } from "../../i18n";

export interface RegisterViewProps {
  subtitle: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedLegalTerms: boolean;
  errorMessage: string;
  isSubmitting: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onAcceptedLegalTermsChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNavigateLogin: () => void;
}

export const RegisterNoir = ({
  subtitle,
  name,
  email,
  password,
  confirmPassword,
  acceptedLegalTerms,
  errorMessage,
  isSubmitting,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onAcceptedLegalTermsChange,
  onSubmit,
  onNavigateLogin,
}: RegisterViewProps): ReactNode => {
  const { t } = useI18n();

  return (
    <AuthShell
      activeTab="register"
      onSelectLogin={onNavigateLogin}
      onSelectRegister={() => undefined}
      subtitle={subtitle}
    >
      <div className="space-y-4">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        <form className="space-y-5" onSubmit={onSubmit}>
          <Field
            id="reg-name"
            label={t("register.displayName")}
            icon={<User size={15} />}
            type="text"
            autoComplete="name"
            maxLength={120}
            placeholder={t("register.displayNamePlaceholder")}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <Field
            id="reg-email"
            label={t("register.email")}
            icon={<Mail size={15} />}
            type="email"
            autoComplete="email"
            required
            placeholder={t("register.emailPlaceholder")}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <Field
            id="reg-password"
            label={t("register.password")}
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
            id="reg-confirm"
            label={t("register.confirmPassword")}
            icon={<CheckCheck size={15} />}
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("register.confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
          />

          <label className="flex cursor-pointer items-start gap-3 font-mono text-[10.5px] leading-relaxed tracking-wide text-paper/50">
            <input
              type="checkbox"
              checked={acceptedLegalTerms}
              onChange={(e) => onAcceptedLegalTermsChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 appearance-none border border-paper/25 bg-ink-3 checked:border-crimson checked:bg-crimson"
            />
            <span>
              {t("register.legalPrefix")} <LegalInlineLinks includeContentPolicy />. {t("register.legalSuffix")}
            </span>
          </label>

          <Submit loading={isSubmitting} loadingLabel={t("register.button.creating")}>
            {t("register.button.create")} <ArrowRight size={15} />
          </Submit>
        </form>

        <div className="flex items-center gap-4 pt-2" aria-hidden>
          <span className="h-px flex-1 bg-paper/10" />
          <button
            type="button"
            onClick={onNavigateLogin}
            className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/40 hover:text-crimson"
          >
            {t("register.alreadyHaveAccount")} {t("register.button.loginNow")} →
          </button>
          <span className="h-px flex-1 bg-paper/10" />
        </div>
      </div>
    </AuthShell>
  );
};
