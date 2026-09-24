import { FormEvent, useEffect, useRef, useState } from "react";

import { AuthShell } from "../components/auth/AuthShell";
import { useAuth } from "../hooks/useAuth";
import { useAuthConfigQuery } from "../query/authConfig";
import { useUpdater } from "../hooks/useUpdater";
import { useI18n } from "../i18n";

interface LoginPageProps {
  onLoginSuccess: () => void;
  onNavigateRegister: () => void;
  onNavigateForgotPassword?: () => void;
}

interface VerificationFeedback {
  retryAfterSeconds: number;
  verificationHint: string;
}

interface LoginActionError extends Error {
  code?: string;
  requiresVerification?: boolean;
  retryAfterSeconds?: number;
  verificationHint?: string;
}

type LoginAuthFlow = "credentials" | "travel-token";

const LOGIN_REMEMBER_EMAIL_KEY = "auth:remember-email";
const LOGIN_SAVED_EMAIL_KEY = "auth:saved-email";

const handleSelectLogin = (): void => undefined;

const hasTravelIntentInHash = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const [, queryString = ""] = window.location.hash.split("?");
  return new URLSearchParams(queryString).get("travel") === "1";
};

const clearTravelIntentFromHash = (): void => {
  if (typeof window === "undefined" || !hasTravelIntentInHash()) {
    return;
  }

  const currentRoute = window.location.hash.replace(/^#\/?/, "").split("?")[0] || "login";
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#/${currentRoute}`);
};

export const LoginPage = ({
  onLoginSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
}: LoginPageProps) => {
  const { t } = useI18n();
  const [email, setEmail] = useState(() => localStorage.getItem(LOGIN_SAVED_EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [travelToken, setTravelToken] = useState("");
  const [authFlow, setAuthFlow] = useState<LoginAuthFlow>(() =>
    hasTravelIntentInHash() ? "travel-token" : "credentials",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [travelError, setTravelError] = useState("");
  const [, setFailedAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem(LOGIN_REMEMBER_EMAIL_KEY) === "true",
  );
  const [emailDeliveryEnabled, setEmailDeliveryEnabled] = useState<boolean | null>(null);

  const travelTokenInputRef = useRef<HTMLInputElement | null>(null);
  const { login } = useAuth();
  const updater = useUpdater();
  const { data: authConfig } = useAuthConfigQuery();

  useEffect(() => {
    if (!authConfig) return;
    setEmailDeliveryEnabled(authConfig.emailDeliveryEnabled === true);
  }, [authConfig]);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  useEffect(() => {
    const syncTravelIntent = () => {
      if (!hasTravelIntentInHash()) {
        return;
      }

      setAuthFlow("travel-token");
      setErrorMessage("");
      setTravelError("");
      setVerificationFeedback(null);
    };

    syncTravelIntent();
    window.addEventListener("hashchange", syncTravelIntent);
    return () => window.removeEventListener("hashchange", syncTravelIntent);
  }, []);

  useEffect(() => {
    if (authFlow !== "travel-token") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      travelTokenInputRef.current?.focus();
      travelTokenInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [authFlow]);

  const pageSubtitle =
    authFlow === "travel-token"
      ? t("login.subtitle.travel")
      : t("login.subtitle.credentials");

  const handleBackToCredentials = () => {
    clearTravelIntentFromHash();
    setAuthFlow("credentials");
    setTravelToken("");
    setTravelError("");
    setErrorMessage("");
    setVerificationFeedback(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setTravelError("");
    setVerificationFeedback(null);

    if (authFlow === "travel-token") {
      if (!email.trim() || !password.trim()) {
        setTravelError(t("login.error.missingCredentials"));
        return;
      }

      if (!travelToken.trim()) {
        setTravelError(t("login.error.missingTravelToken"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await login(
        email,
        password,
        undefined,
        rememberMe,
        authFlow === "travel-token" ? travelToken.trim() : undefined,
      );

      clearTravelIntentFromHash();

      if (rememberMe) {
        localStorage.setItem(LOGIN_REMEMBER_EMAIL_KEY, "true");
        localStorage.setItem(LOGIN_SAVED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(LOGIN_REMEMBER_EMAIL_KEY);
        localStorage.removeItem(LOGIN_SAVED_EMAIL_KEY);
      }
      setFailedAttempts(0);
      onLoginSuccess();
    } catch (error) {
      const authError = error as LoginActionError;
      const message = error instanceof Error ? error.message : t("login.error.generic");

      if (authError.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED") {
        setAuthFlow("travel-token");
        setTravelToken("");
        setTravelError("");
        setErrorMessage("");
        return;
      }

      if (authError.code === "DESKTOP_TRAVEL_TOKEN_INVALID") {
        setAuthFlow("travel-token");
        setTravelToken("");
        setTravelError(message);
        setErrorMessage("");
        return;
      }

      if (authFlow === "travel-token") {
        setTravelError(message);
      } else {
        setErrorMessage(message);
      }

      if (authError.requiresVerification) {
        const retryAfterSeconds = Math.max(1, authError.retryAfterSeconds ?? 600);
        setRetryCountdown(retryAfterSeconds);
        setVerificationFeedback({
          retryAfterSeconds,
          verificationHint:
            authError.verificationHint ?? t("login.verification.retrySameDevice"),
        });
      } else if (authFlow === "credentials") {
        setFailedAttempts((value) => value + 1);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      activeTab="login"
      onSelectLogin={handleSelectLogin}
      onSelectRegister={onNavigateRegister}
      subtitle={pageSubtitle}
    >
      {authFlow === "credentials" && errorMessage && (
        <div className="auth-alert auth-alert--error" role="alert">
          {errorMessage}
        </div>
      )}

      {updater.blocking && (
        <div className="auth-alert auth-alert--warning" role="alert">
          <p className="auth-alert__title">{t("login.warning.mandatoryUpdateTitle")}</p>
          <p>
            {t("login.warning.mandatoryUpdateBody", {
              version: updater.newVersion
                ? t("login.warning.versionPrefix", { version: updater.newVersion })
                : t("login.warning.latestVersion"),
            })}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            {(updater.status === "available" || updater.status === "downloading") && (
              <button
                type="button"
                onClick={() => void updater.downloadUpdate()}
                className="auth-submit"
                disabled={updater.status === "downloading"}
              >
                {updater.status === "downloading"
                  ? t("login.warning.downloadingUpdate")
                  : t("login.warning.downloadUpdate")}
              </button>
            )}
            {updater.status === "downloaded" && (
              <button type="button" onClick={() => void updater.installUpdate()} className="auth-submit">
                {t("login.warning.installUpdateNow")}
              </button>
            )}
          </div>
        </div>
      )}

      {verificationFeedback && (
        <div className="auth-alert auth-alert--warning" role="status">
          <p className="auth-alert__title">{t("login.verification.title")}</p>
          <p>{t("login.verification.wait", { seconds: retryCountdown || verificationFeedback.retryAfterSeconds })}</p>
          <p>{t("login.verification.retrySameDevice")}</p>
          <p>{t("login.verification.avoidVpn")}</p>
          <p>{verificationFeedback.verificationHint}</p>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        {authFlow === "credentials" ? (
          <>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="login-email">
                {t("login.email")}
              </label>
              <div className="auth-field__input-wrap">
                <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t("login.emailPlaceholder")}
                  className="auth-field__input auth-field__input--icon"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <span className="auth-field__label-row">
                <label className="auth-field__label" htmlFor="login-password">
                  {t("login.password")}
                </label>
                {onNavigateForgotPassword && (
                  <button className="auth-link" onClick={onNavigateForgotPassword} type="button">
                    {t("login.forgotPassword")}
                  </button>
                )}
              </span>
              <div className="auth-field__input-wrap">
                <svg className="auth-field__icon" viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder={t("login.passwordPlaceholder")}
                  className="auth-field__input auth-field__input--icon"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            <label className="auth-check">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>{t("login.rememberMe")}</span>
            </label>
          </>
        ) : (
          <div className="auth-travel-gate">
            <span className="auth-travel-gate__eyebrow">{t("login.travel.eyebrow")}</span>
            <h2 className="auth-travel-gate__title">{t("login.travel.title")}</h2>
            <p className="auth-travel-gate__copy">
              {t("login.travel.copy")}
            </p>

            <div className="auth-travel-gate__meta">
              <span>{email.trim() ? t("login.travel.accountInUse", { email: email.trim() }) : t("login.travel.sameAccount")}</span>
              <span>
                {emailDeliveryEnabled === false
                  ? t("login.travel.emailDisabled")
                  : t("login.travel.emailEnabled")}
              </span>
            </div>

            <ol className="auth-travel-gate__steps">
              <li>{t("login.travel.step1")}</li>
              <li>{t("login.travel.step2")}</li>
              <li>{t("login.travel.step3")}</li>
            </ol>

            {travelError && (
              <div className="auth-alert auth-alert--error" role="alert">
                {travelError}
              </div>
            )}

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="login-travel-token">
                {t("login.travel.tokenLabel")}
              </label>
              <input
                id="login-travel-token"
                ref={travelTokenInputRef}
                type="text"
                inputMode="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t("login.travel.tokenPlaceholder")}
                className="auth-field__input"
                value={travelToken}
                onChange={(event) => setTravelToken(event.target.value)}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || retryCountdown > 0 || updater.blocking}
          className="auth-submit"
        >
          {isSubmitting ? (
            <span className="auth-submit__loading">
              <span className="auth-spinner" />
              {authFlow === "travel-token" ? t("login.button.authorizing") : t("login.button.validating")}
            </span>
          ) : updater.blocking ? (
            t("login.button.updateRequired")
          ) : retryCountdown > 0 ? (
            t("login.button.retryIn", { seconds: retryCountdown })
          ) : authFlow === "travel-token" ? (
            t("login.button.authorizeComputer")
          ) : (
            t("login.button.login")
          )}
        </button>

        {authFlow === "travel-token" && (
          <div className="auth-travel-gate__actions">
            <button
              type="button"
              className="auth-submit auth-submit--outline"
              onClick={handleBackToCredentials}
              disabled={isSubmitting}
            >
              {t("login.button.changeAccount")}
            </button>
          </div>
        )}
      </form>

      {authFlow === "credentials" && (
        <>
          <div className="auth-divider" aria-hidden="true">
            <span className="auth-divider__line" />
            <span className="auth-divider__text">{t("login.newHere")}</span>
            <span className="auth-divider__line" />
          </div>

          <p className="auth-switch">
            <button className="auth-link" onClick={onNavigateRegister} type="button">
              {t("login.createFreeAccount")}
            </button>
          </p>
        </>
      )}
    </AuthShell>
  );
};
