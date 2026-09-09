import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "./hooks/useAuth";
import { useSession } from "./hooks/useSession";
import { useUiI18n } from "@koma/ui/i18n-port";

const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const IDLE_WARNING_MS = 5 * 60 * 1000;

export const SessionTimeout = () => {
  const { t } = useUiI18n();
  const { isAuthenticated, isAuthDisabled, logout, refreshSession } = useAuth();
  const sessionEnabled = isAuthenticated && !isAuthDisabled;
  const lastKeepAliveRef = useRef(0);
  const handleTimeout = useCallback(() => {
    void logout();
  }, [logout]);

  const handleActivity = useCallback(() => {
    if (!sessionEnabled) {
      return;
    }

    const now = Date.now();
    if (now - lastKeepAliveRef.current < KEEPALIVE_INTERVAL_MS) {
      return;
    }

    lastKeepAliveRef.current = now;
    void refreshSession();
  }, [refreshSession, sessionEnabled]);

  useEffect(() => {
    if (!sessionEnabled) {
      lastKeepAliveRef.current = 0;
      return;
    }

    lastKeepAliveRef.current = Date.now();
  }, [sessionEnabled]);

  const { secondsLeft, isWarning, stayActive } = useSession({
    enabled: isAuthenticated,
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onTimeout: handleTimeout,
    onActivity: handleActivity,
  });

  if (!isAuthenticated || !isWarning) return null;

  const pct = Math.max(0, Math.min(100, (secondsLeft / 60) * 100));

  return (
    <div className="koma-session-toast">
      <div className="koma-session-toast__bar" style={{ width: `${pct}%` }} />
      <div className="koma-session-toast__content">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-session-toast__icon">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          {t("session.expiresIn", { seconds: secondsLeft })}
        </span>
        <button type="button" className="koma-session-toast__action" onClick={stayActive}>
          {t("session.stayConnected")}
        </button>
      </div>
    </div>
  );
};
