import { useEffect, useMemo, useState } from "react";

import { AuthSimpleShell } from "../components/auth/AuthSimpleShell";
import { buildUrl } from "../config/api";
import { fetchWithTimeoutAndRetry } from "../utils/http";
import { useI18n } from "../i18n";

import { desktopBridge } from "@/lib/desktop-bridge";
interface ConfirmEmailPageProps {
  onNavigateLogin: () => void;
  onNavigateDashboard: () => void;
  onConfirmSuccess?: () => Promise<void> | void;
}

const readParam = (key: string): string | null => {
  const searchParams = new URLSearchParams(window.location.search);
  const fromSearch = searchParams.get(key);
  if (fromSearch) return fromSearch;
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(hashQuery).get(key);
};

export const ConfirmEmailPage = ({ onNavigateLogin, onNavigateDashboard, onConfirmSuccess }: ConfirmEmailPageProps) => {
  const { t } = useI18n();
  const token = useMemo(() => readParam("token"), []);
  const initialError = useMemo(() => readParam("error"), []);
  const [isVerifying, setIsVerifying] = useState<boolean>(Boolean(token));
  const [errorCode, setErrorCode] = useState<string | null>(initialError);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    const confirm = async (): Promise<void> => {
      setIsVerifying(true);
      try {
        const desktopAuthApi = desktopBridge.desktop?.api?.auth;
        if (desktopAuthApi?.confirmEmail) {
          const envelope = (await desktopAuthApi.confirmEmail(token)) as {
            ok: boolean;
            payload?: Record<string, unknown> | null;
          };
          if (!envelope.ok) {
            const payload = envelope.payload ?? {};
            const codeFromPayload =
              (typeof payload.code === "string" && payload.code) ||
              (typeof payload.error === "string" && payload.error) ||
              "CONFIRM_EMAIL_FAILED";
            if (isMounted) setErrorCode(codeFromPayload);
            return;
          }
        } else {
          const response = await fetchWithTimeoutAndRetry(buildUrl("authUrl", "/api/auth/confirm-email"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token }),
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
            const codeFromPayload =
              (typeof payload.code === "string" && payload.code) ||
              (typeof payload.error === "string" && payload.error) ||
              "CONFIRM_EMAIL_FAILED";
            if (isMounted) setErrorCode(codeFromPayload);
            return;
          }
        }
        if (isMounted) setErrorCode(null);
        await onConfirmSuccess?.();
      } catch {
        if (isMounted) setErrorCode("CONFIRM_EMAIL_FAILED");
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    };

    void confirm();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const isSuccess = !isVerifying && !errorCode;

  const title = isVerifying
    ? t("confirm.title.verifying")
    : isSuccess
      ? t("confirm.title.success")
      : t("confirm.title.error");

  const subtitle = isVerifying
    ? t("confirm.subtitle.verifying")
    : isSuccess
      ? t("confirm.subtitle.success")
      : t("confirm.subtitle.error");

  return (
    <AuthSimpleShell title={title} subtitle={subtitle}>
      {isVerifying && (
        <div className="auth-alert auth-alert--info" role="status">
          <span className="auth-spinner" />
          <span>{t("confirm.status.wait")}</span>
        </div>
      )}

      {!isVerifying && errorCode && (
        <div className="auth-alert auth-alert--error" role="alert">
          {t("confirm.errorCode")} <strong>{errorCode}</strong>
        </div>
      )}

      {isSuccess && (
        <div className="auth-alert auth-alert--success" role="status">
          ✓ {t("confirm.success")}
        </div>
      )}

      <div className="auth-form">
        <button type="button" onClick={onNavigateDashboard} className="auth-submit">
          {t("confirm.goDashboard")}
        </button>
        <button type="button" onClick={onNavigateLogin} className="auth-submit auth-submit--outline">
          {t("confirm.goLogin")}
        </button>
      </div>
    </AuthSimpleShell>
  );
};
