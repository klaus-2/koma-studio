import { FormEvent, ReactNode, RefObject } from "react";
import { Mail, Lock, KeyRound, ArrowRight } from "lucide-react";

import { AuthShell } from "../../components/auth/AuthShell";
import { Alert, Field, Submit } from "../../components/auth/noir/koma-ui";
import type { UseUpdaterApi } from "../../hooks/useUpdater";
import { useI18n } from "../../i18n";

export type LoginAuthFlow = "credentials" | "travel-token";

export interface VerificationFeedback {
  retryAfterSeconds: number;
  verificationHint: string;
}

export interface LoginViewProps {
  subtitle: string;
  authFlow: LoginAuthFlow;
  email: string;
  password: string;
  travelToken: string;
  rememberMe: boolean;
  errorMessage: string;
  travelError: string;
  isSubmitting: boolean;
  retryCountdown: number;
  verificationFeedback: VerificationFeedback | null;
  updater: UseUpdaterApi;
  emailDeliveryEnabled: boolean | null;
  travelTokenInputRef: RefObject<HTMLInputElement | null>;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTravelTokenChange: (value: string) => void;
  onRememberMeChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBackToCredentials: () => void;
  onNavigateRegister: () => void;
  onNavigateForgotPassword?: () => void;
}

export const LoginNoir = ({
  subtitle,
  authFlow,
  email,
  password,
  travelToken,
  rememberMe,
  errorMessage,
  travelError,
  isSubmitting,
  retryCountdown,
  verificationFeedback,
  updater,
  emailDeliveryEnabled,
  travelTokenInputRef,
  onEmailChange,
  onPasswordChange,
  onTravelTokenChange,
  onRememberMeChange,
  onSubmit,
  onBackToCredentials,
  onNavigateRegister,
  onNavigateForgotPassword,
}: LoginViewProps): ReactNode => {
  const { t } = useI18n();

  return (
    <AuthShell
      activeTab="login"
      onSelectLogin={() => undefined}
      onSelectRegister={onNavigateRegister}
      subtitle={subtitle}
    >
      <div className="space-y-4">
        {authFlow === "credentials" && errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        {updater.blocking && (
          <Alert tone="warning" title={t("login.warning.mandatoryUpdateTitle")}>
            <p>
              {t("login.warning.mandatoryUpdateBody", {
                version: updater.newVersion
                  ? t("login.warning.versionPrefix", { version: updater.newVersion })
                  : t("login.warning.latestVersion"),
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(updater.status === "available" || updater.status === "downloading") && (
                <button
                  type="button"
                  onClick={() => void updater.downloadUpdate()}
                  className="btn-ghost"
                  disabled={updater.status === "downloading"}
                >
                  {updater.status === "downloading"
                    ? t("login.warning.downloadingUpdate")
                    : t("login.warning.downloadUpdate")}
                </button>
              )}
              {updater.status === "downloaded" && (
                <button type="button" onClick={() => void updater.installUpdate()} className="btn-ghost">
                  {t("login.warning.installUpdateNow")}
                </button>
              )}
            </div>
          </Alert>
        )}

        {verificationFeedback && (
          <Alert tone="warning" title={t("login.verification.title")}>
            <p>{t("login.verification.wait", { seconds: retryCountdown || verificationFeedback.retryAfterSeconds })}</p>
            <p className="mt-1 opacity-80">{t("login.verification.retrySameDevice")}</p>
            <p className="mt-1 opacity-80">{t("login.verification.avoidVpn")}</p>
            <p className="mt-1 opacity-80">{verificationFeedback.verificationHint}</p>
          </Alert>
        )}

        <form className="space-y-5" onSubmit={onSubmit}>
          {authFlow === "credentials" ? (
            <>
              <Field
                id="login-email"
                label={t("login.email")}
                icon={<Mail size={15} />}
                type="email"
                autoComplete="email"
                required
                placeholder={t("login.emailPlaceholder")}
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
              />
              <Field
                id="login-password"
                label={t("login.password")}
                icon={<Lock size={15} />}
                type="password"
                autoComplete="current-password"
                required
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                trailing={
                  onNavigateForgotPassword ? (
                    <button
                      type="button"
                      onClick={onNavigateForgotPassword}
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-crimson hover:text-gold"
                    >
                      {t("login.forgotPassword")} →
                    </button>
                  ) : undefined
                }
              />

              <label className="flex cursor-pointer items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper/50">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => onRememberMeChange(e.target.checked)}
                  className="h-4 w-4 appearance-none border border-paper/25 bg-ink-3 checked:border-crimson checked:bg-crimson"
                />
                {t("login.rememberMe")}
              </label>
            </>
          ) : (
            <div className="space-y-4">
              <div className="panel-cut-sm border border-gold/40 bg-gold/5 p-4">
                <span className="kicker !text-gold">// {t("login.travel.eyebrow")}</span>
                <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-paper">
                  {t("login.travel.title")}
                </h2>
                <ol className="mt-3 list-decimal space-y-1 pl-4 font-mono text-[11px] leading-relaxed text-paper/60">
                  <li>{t("login.travel.step1")}</li>
                  <li>{t("login.travel.step2")}</li>
                  <li>{t("login.travel.step3")}</li>
                </ol>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                  {email.trim() ? t("login.travel.accountInUse", { email: email.trim() }) : t("login.travel.sameAccount")}
                  {" · "}
                  {emailDeliveryEnabled === false ? t("login.travel.emailDisabled") : t("login.travel.emailEnabled")}
                </p>
              </div>

              {travelError && <Alert tone="error">{travelError}</Alert>}

              <Field
                id="login-travel-token"
                ref={travelTokenInputRef}
                label={t("login.travel.tokenLabel")}
                icon={<KeyRound size={15} />}
                type="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t("login.travel.tokenPlaceholder")}
                value={travelToken}
                onChange={(e) => onTravelTokenChange(e.target.value)}
              />
            </div>
          )}

          <Submit
            loading={isSubmitting}
            loadingLabel={authFlow === "travel-token" ? t("login.button.authorizing") : t("login.button.validating")}
            disabled={retryCountdown > 0 || updater.blocking}
          >
            {retryCountdown > 0 ? (
              t("login.button.retryIn", { seconds: retryCountdown })
            ) : authFlow === "travel-token" ? (
              <>
                {t("login.button.authorizeComputer")} <ArrowRight size={15} />
              </>
            ) : (
              <>
                {t("login.button.login")} <ArrowRight size={15} />
              </>
            )}
          </Submit>

          {authFlow === "travel-token" && (
            <button type="button" onClick={onBackToCredentials} disabled={isSubmitting} className="btn-ghost w-full">
              {t("login.button.changeAccount")}
            </button>
          )}
        </form>

        {authFlow === "credentials" && (
          <div className="flex items-center gap-4 pt-2" aria-hidden>
            <span className="h-px flex-1 bg-paper/10" />
            <button
              type="button"
              onClick={onNavigateRegister}
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/40 hover:text-crimson"
            >
              {t("login.newHere")} {t("login.createFreeAccount")} →
            </button>
            <span className="h-px flex-1 bg-paper/10" />
          </div>
        )}
      </div>
    </AuthShell>
  );
};
