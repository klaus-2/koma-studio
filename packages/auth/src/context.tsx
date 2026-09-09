import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { resolveDesktopSessionRecoveryAction } from "@koma/types/desktopSessionRecovery";
import type { RegistrationLegalAcceptancePayload } from "@koma/types/legal";
import { appQueryKeys } from "./query/client";
import { fetchWithTimeoutAndRetry } from "./utils/http";
import { useUiI18n } from "@koma/ui/i18n-port";
import { getRuntimeAdapter } from "./runtime-adapter";

type TranslationFn = ReturnType<typeof useUiI18n>["t"];

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  locale?: string;
  appRole?: "user" | "moderator" | "admin" | "owner";
  feedProfileStatus?: "pending_setup" | "active" | "suspended";
  authorNotificationWebhookConfigured?: boolean;
}

export interface ActiveBanInfo {
  title: string;
  detail: string;
  temporary: boolean;
  reason: string;
  scope: string;
  expiresAt: string | null;
}

interface AuthContextValue {
  isAuthDisabled: boolean;
  user: AuthUser | null;
  activeBan: ActiveBanInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    captchaToken?: string,
    rememberMe?: boolean,
    travelToken?: string,
  ) => Promise<void>;
  register: (
    email: string,
    password: string,
    name?: string,
    captchaToken?: string,
    legalAcceptance?: RegistrationLegalAcceptancePayload,
  ) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  markEmailVerified: () => void;
  getAuthToken: () => string | null;
  hydrateSession: (nextUser: AuthUser, accessToken: string) => void;
  clearBanState: () => void;
}

interface AuthErrorPayload {
  message: string;
  code?: string;
  requiresVerification?: boolean;
  retryAfterSeconds?: number;
  verificationHint?: string;
  activeBan?: ActiveBanInfo;
}

interface DesktopApiEnvelope<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  payload: T | null;
}

interface AuthSessionSnapshot {
  user: AuthUser;
  accessToken: string;
}

const extractErrorPayloadFromEnvelope = <TPayload,>(
  envelope: DesktopApiEnvelope<TPayload> | null,
  t: TranslationFn,
): AuthErrorPayload => {
  const payload = envelope?.payload as Record<string, unknown> | null;
  const message =
    (typeof payload?.error === "string" && payload.error) ||
    (typeof payload?.detail === "string" && payload.detail) ||
    t('auth.error.generic', { status: envelope?.status ?? 500 });

  return {
    message,
    code: typeof payload?.code === "string" ? payload.code : undefined,
    requiresVerification: payload?.requiresVerification === true,
    retryAfterSeconds:
      typeof payload?.retryAfterSeconds === "number" ? payload.retryAfterSeconds : undefined,
    verificationHint:
      typeof payload?.verificationHint === "string" ? payload.verificationHint : undefined,
    activeBan:
      payload?.activeBan && typeof payload.activeBan === "object"
        ? (payload.activeBan as ActiveBanInfo)
        : undefined,
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);

const extractDetailsMessage = (details: unknown): string | null => {
  if (!Array.isArray(details) || details.length === 0) {
    return null;
  }

  const first = details[0];
  if (typeof first === "string" && first.length > 0) {
    return first;
  }

  if (first && typeof first === "object" && "msg" in first) {
    const msg = (first as { msg?: unknown }).msg;
    if (typeof msg === "string" && msg.length > 0) {
      return msg;
    }
  }

  return null;
};

const AUTH_SESSION_KEEPALIVE_MS = 4 * 60 * 1000;
const PRODUCTION_BROWSER_SESSION_TIMEOUT_MS = 250;

const buildFallbackBanInfo = (message: string): ActiveBanInfo => ({
  title: "Acesso bloqueado",
  detail: message,
  temporary: false,
  reason: message,
  scope: "account_only",
  expiresAt: null,
});

const parseError = async (response: Response, t: TranslationFn): Promise<AuthErrorPayload> => {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const detailsMessage = extractDetailsMessage(payload.details);
    if (detailsMessage) {
      return { message: detailsMessage };
    }

    const errorMessage = payload.error;
    if (typeof errorMessage === "string" && errorMessage.length > 0) {
      return {
        message: errorMessage,
        code: typeof payload.code === "string" ? payload.code : undefined,
        requiresVerification: payload.requiresVerification === true,
        retryAfterSeconds:
          typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : undefined,
        verificationHint:
          typeof payload.verificationHint === "string" ? payload.verificationHint : undefined,
        activeBan:
          payload.activeBan && typeof payload.activeBan === "object"
            ? (payload.activeBan as ActiveBanInfo)
            : undefined,
      };
    }
  } catch {
    // fallthrough to default message
  }

  return { message: t('auth.error.generic', { status: response.status }) };
};

const asDesktopEnvelopePayload = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const extractAuthSessionSnapshot = (payload: unknown): AuthSessionSnapshot | null => {
  const root = asDesktopEnvelopePayload(payload);
  const user = root?.user;
  const accessToken = typeof root?.accessToken === "string" ? root.accessToken.trim() : "";
  if (!user || typeof user !== "object" || !accessToken) {
    return null;
  }

  return {
    user: user as AuthUser,
    accessToken,
  };
};

const getDesktopEnvelopeCode = (value: unknown): string | null => {
  const payload = asDesktopEnvelopePayload(value);
  if (!payload || typeof payload.code !== "string") {
    return null;
  }

  const code = payload.code.trim();
  return code.length > 0 ? code : null;
};

const shouldClearLocalSessionForDesktopFailure = (
  status: number,
  payload: unknown,
): boolean => {
  if (status === 426) {
    return true;
  }

  const recoveryAction = resolveDesktopSessionRecoveryAction(status, payload);
  if (recoveryAction !== null) {
    return false;
  }

  const code = getDesktopEnvelopeCode(payload);
  if (code === "AUTH_BANNED") {
    return true;
  }

  if (code === "AUTH_SESSION_REQUIRED" || code === "AUTH_INVALID_TOKEN") {
    return true;
  }

  return status === 401;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const adapter = getRuntimeAdapter();
  const updaterBlocking = adapter.useUpdaterBlocking();
  const { t, locale } = useUiI18n();
  const authDisabled = adapter.isAuthDisabled();
  const [activeBan, setActiveBan] = useState<ActiveBanInfo | null>(null);
  const isDesktopRuntime = adapter.isDesktopRuntime();
  const previousLocaleRef = useRef(locale);
  const localeSyncRef = useRef<{ locale: string | null; inFlight: boolean }>({
    locale: null,
    inFlight: false,
  });

  const clearLocalSession = useCallback(() => {
    queryClient.setQueryData<AuthSessionSnapshot | null>(appQueryKeys.auth.session, null);
  }, [queryClient]);

  const clearBanState = useCallback(() => {
    setActiveBan(null);
  }, []);

  const fetchSessionSnapshot = useCallback(async (): Promise<AuthSessionSnapshot | null> => {
    const currentSnapshot =
      queryClient.getQueryData<AuthSessionSnapshot | null>(appQueryKeys.auth.session) ?? null;

    try {
      const desktopAuthApi = adapter.getDesktopAuthApi();
      if (desktopAuthApi) {
        const envelope = (await desktopAuthApi.session()) as DesktopApiEnvelope<{
          user?: AuthUser;
          accessToken?: string;
        }>;

        if (!envelope.ok) {
          const payload = extractErrorPayloadFromEnvelope(envelope, t);
          if (payload.code === "AUTH_BANNED") {
            clearLocalSession();
            setActiveBan(payload.activeBan ?? buildFallbackBanInfo(payload.message));
            return null;
          }
          if (shouldClearLocalSessionForDesktopFailure(envelope.status, envelope.payload)) {
            clearLocalSession();
            return null;
          }

          // Keep the current desktop session during transient bridge/auth hiccups.
          return currentSnapshot;
        }

        const payload = envelope.payload;
        if (!payload?.user || !payload?.accessToken) {
          // Avoid forcing logout on malformed/transient desktop payloads.
          return currentSnapshot;
        }

        setActiveBan(null);
        return {
          user: payload.user,
          accessToken: payload.accessToken,
        };
      }
      if (isDesktopRuntime) {
        return currentSnapshot;
      }

      const response = await fetchWithTimeoutAndRetry(
        adapter.buildUrl("authUrl", "/api/auth/session"),
        {
          method: "GET",
          headers: {
            "X-Koma-Locale": locale,
            ...adapter.getDesktopUpdatePolicyHeaders(),
          },
          credentials: "include",
        },
        {
          timeoutMs:
            import.meta.env.PROD && !isDesktopRuntime
              ? PRODUCTION_BROWSER_SESSION_TIMEOUT_MS
              : 1_000,
          retryCount: 0,
        },
      );

      if (!response.ok) {
        const payload = await parseError(response, t);
        if (payload.code === "AUTH_BANNED") {
          clearLocalSession();
          setActiveBan(payload.activeBan ?? buildFallbackBanInfo(payload.message));
          return null;
        }
        if (response.status === 401 || response.status === 426) {
          clearLocalSession();
          return null;
        }

        // Keep the current session during transient server hiccups (500, 502, 429, etc.).
        return currentSnapshot;
      }

      const payload = (await response.json()) as {
        user: AuthUser;
        accessToken: string;
      };

      setActiveBan(null);
      return {
        user: payload.user,
        accessToken: payload.accessToken,
      };
    } catch {
      // Keep the current session during transient network errors.
      return currentSnapshot;
    }
  }, [clearLocalSession, isDesktopRuntime, locale, queryClient]);

  const sessionQuery = useQuery({
    queryKey: appQueryKeys.auth.session,
    queryFn: fetchSessionSnapshot,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const user = sessionQuery.data?.user ?? null;
  const token = sessionQuery.data?.accessToken ?? null;
  const isLoading = authDisabled ? false : sessionQuery.isLoading;

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const snapshot = await fetchSessionSnapshot();
    queryClient.setQueryData<AuthSessionSnapshot | null>(appQueryKeys.auth.session, snapshot);
    return snapshot?.accessToken ?? null;
  }, [fetchSessionSnapshot, queryClient]);

  const refreshSessionAfterAuthChange = useCallback(
    async (): Promise<string | null> => {
      const attempts = isDesktopRuntime ? 4 : 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const sessionToken = await refreshSession();
        if (sessionToken) {
          return sessionToken;
        }

        if (attempt < attempts - 1) {
          await sleep(150 * (attempt + 1));
        }
      }

      return null;
    },
    [isDesktopRuntime, refreshSession],
  );

  useEffect(() => {
    const previousLocale = previousLocaleRef.current;
    previousLocaleRef.current = locale;

    if (previousLocale === locale) {
      return;
    }

    if (!user || !token || user.locale === locale) {
      return;
    }

    if (localeSyncRef.current.inFlight && localeSyncRef.current.locale === locale) {
      return;
    }

    localeSyncRef.current = {
      locale,
      inFlight: true,
    };

    void fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/locale"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Koma-Locale": locale,
      },
      credentials: "include",
      body: JSON.stringify({ locale }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("locale-sync-failed");
        }

        const payload = (await response.json()) as { locale?: string };
        queryClient.setQueryData<AuthSessionSnapshot | null>(
          appQueryKeys.auth.session,
          (current) =>
            current
              ? {
                  ...current,
                  user: {
                    ...current.user,
                    locale: typeof payload.locale === "string" ? payload.locale : locale,
                  },
                }
              : current,
        );
      })
      .catch(() => {
        localeSyncRef.current = {
          locale: null,
          inFlight: false,
        };
      })
      .finally(() => {
        if (localeSyncRef.current.locale === locale) {
          localeSyncRef.current = {
            locale,
            inFlight: false,
          };
        }
      });
  }, [locale, queryClient, token, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let keepaliveFailureCount = 0;
    let lastUserActivityAt = Date.now();

    const trackActivity = () => {
      lastUserActivityAt = Date.now();
    };

    window.addEventListener("mousemove", trackActivity, { passive: true });
    window.addEventListener("keydown", trackActivity, { passive: true });
    window.addEventListener("scroll", trackActivity, { passive: true });
    window.addEventListener("touchstart", trackActivity, { passive: true });

    const refreshKeepalive = () => {
      const timeSinceActivity = Date.now() - lastUserActivityAt;
      const isUserActive = timeSinceActivity < AUTH_SESSION_KEEPALIVE_MS * 2;

      if (!isUserActive) {
        return;
      }

      void refreshSession()
        .then((token) => {
          if (token) {
            keepaliveFailureCount = 0;
          } else {
            keepaliveFailureCount += 1;
          }
        })
        .catch(() => {
          keepaliveFailureCount += 1;
        });
    };

    const intervalId = window.setInterval(refreshKeepalive, AUTH_SESSION_KEEPALIVE_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastUserActivityAt = Date.now();
        void refreshSession().then((token) => {
          if (token) {
            keepaliveFailureCount = 0;
          }
        });
      }
    };
    const onFocus = () => {
      lastUserActivityAt = Date.now();
      void refreshSession().then((token) => {
        if (token) {
          keepaliveFailureCount = 0;
        }
      });
    };
    const onOnline = () => {
      lastUserActivityAt = Date.now();
      void refreshSession().then((token) => {
        if (token) {
          keepaliveFailureCount = 0;
        }
      });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("mousemove", trackActivity);
      window.removeEventListener("keydown", trackActivity);
      window.removeEventListener("scroll", trackActivity);
      window.removeEventListener("touchstart", trackActivity);
    };
  }, [refreshSession, user]);

  // Ban state is checked naturally during session refresh (every keepalive cycle)
  // and on visibility/focus changes — no separate heartbeat needed.

  const login = useCallback(
    async (
      email: string,
      password: string,
      captchaToken?: string,
      rememberMe = false,
      travelToken?: string,
    ) => {
      if (updaterBlocking) {
        const error = new Error(t("auth.error.mandatoryUpdate")) as Error & AuthErrorPayload;
        error.code = "MANDATORY_UPDATE_REQUIRED";
        throw error;
      }

      const desktopAuthApi = adapter.getDesktopAuthApi();
      if (desktopAuthApi) {
        const envelope = (await desktopAuthApi.login({
          email,
          password,
          captchaToken,
          rememberMe,
          travelToken,
          locale,
        })) as DesktopApiEnvelope<AuthSessionSnapshot>;

        if (!envelope.ok) {
          const payload = extractErrorPayloadFromEnvelope(envelope, t);
          const shouldKeepLocalSession =
            payload.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
            payload.code === "DESKTOP_TRAVEL_TOKEN_INVALID";
          if (!shouldKeepLocalSession) {
            clearLocalSession();
          }
          if (payload.code === "AUTH_BANNED") {
            setActiveBan(payload.activeBan ?? buildFallbackBanInfo(payload.message));
          }
          const error = new Error(payload.message) as Error & AuthErrorPayload;
          error.code = payload.code;
          error.requiresVerification = payload.requiresVerification;
          error.retryAfterSeconds = payload.retryAfterSeconds;
          error.verificationHint = payload.verificationHint;
          error.activeBan = payload.activeBan;
          throw error;
        }

        // Seed the session snapshot directly from the login envelope so
        // we do not depend on the follow-up `session()` Tauri command
        // (which also re-runs `refresh_session_token` / device registration
        // and can fail with a transient 5xx that the frontend would
        // otherwise mis-translate as "Internet access is required").
        const loginPayload = envelope.payload;
        if (loginPayload?.user && loginPayload.accessToken) {
          setActiveBan(null);
          // Typed local first: react-query's deferred InferDataFromTag/NoInfer
          // updater type mis-rejects fresh object literals here.
          const snapshot: AuthSessionSnapshot = {
            user: loginPayload.user,
            accessToken: loginPayload.accessToken,
          };
          queryClient.setQueryData<AuthSessionSnapshot | null>(
            appQueryKeys.auth.session,
            snapshot,
          );
          return;
        }

        const sessionToken = await refreshSessionAfterAuthChange();
        if (!sessionToken) {
          clearLocalSession();
          throw new Error(updaterBlocking ? t("auth.error.mandatoryUpdate") : t("auth.error.internetRequired"));
        }
        return;
      }
      if (isDesktopRuntime) {
        throw new Error(t('auth.error.desktopBridgeUnavailable'));
      }

      const response = await fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Koma-Locale": locale,
          ...adapter.getDesktopUpdatePolicyHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          captchaToken,
          rememberMe,
          travelToken,
          locale,
        }),
      });

      if (!response.ok) {
        const payload = await parseError(response, t);
        const shouldKeepLocalSession =
          payload.code === "DESKTOP_TRAVEL_TOKEN_REQUIRED" ||
          payload.code === "DESKTOP_TRAVEL_TOKEN_INVALID";
        if (!shouldKeepLocalSession) {
          clearLocalSession();
        }
        if (payload.code === "AUTH_BANNED") {
          setActiveBan(payload.activeBan ?? buildFallbackBanInfo(payload.message));
        }
        const error = new Error(payload.message) as Error & AuthErrorPayload;
        error.code = payload.code;
        error.requiresVerification = payload.requiresVerification;
        error.retryAfterSeconds = payload.retryAfterSeconds;
        error.verificationHint = payload.verificationHint;
        error.activeBan = payload.activeBan;
        throw error;
      }

      const loginSnapshot = extractAuthSessionSnapshot(await response.json().catch(() => null));
      if (loginSnapshot) {
        queryClient.setQueryData<AuthSessionSnapshot | null>(appQueryKeys.auth.session, loginSnapshot);
        setActiveBan(null);
        return;
      }

      const sessionToken = await refreshSessionAfterAuthChange();
      if (!sessionToken) {
        clearLocalSession();
        throw new Error(updaterBlocking ? t("auth.error.mandatoryUpdate") : t("auth.error.internetRequired"));
      }
    },
    [
      clearLocalSession,
      locale,
      queryClient,
      refreshSessionAfterAuthChange,
      t,
      updaterBlocking,
    ],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      name?: string,
      captchaToken?: string,
      legalAcceptance?: RegistrationLegalAcceptancePayload,
    ) => {
      const desktopAuthApi = adapter.getDesktopAuthApi();
      if (desktopAuthApi) {
        const envelope = (await desktopAuthApi.register({
          email,
          password,
          name,
          captchaToken,
          legalAcceptance,
          locale,
        })) as DesktopApiEnvelope;

        if (!envelope.ok) {
          const payload = extractErrorPayloadFromEnvelope(envelope, t);
          if (payload.code === "AUTH_BANNED") {
            setActiveBan(payload.activeBan ?? buildFallbackBanInfo(payload.message));
          }
          const error = new Error(payload.message) as Error & AuthErrorPayload;
          error.code = payload.code;
          error.requiresVerification = payload.requiresVerification;
          error.retryAfterSeconds = payload.retryAfterSeconds;
          error.verificationHint = payload.verificationHint;
          error.activeBan = payload.activeBan;
          throw error;
        }

        await refreshSessionAfterAuthChange();
        return;
      }
      if (isDesktopRuntime) {
        throw new Error(t('auth.error.desktopBridgeUnavailable'));
      }

      const response = await fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Koma-Locale": locale },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          name,
          captchaToken,
          legalAcceptance,
          locale,
        }),
      });

      if (!response.ok) {
        const payload = await parseError(response, t);
        if (payload.code === "AUTH_BANNED") {
          setActiveBan(payload.activeBan ?? buildFallbackBanInfo(payload.message));
        }
        const error = new Error(payload.message) as Error & AuthErrorPayload;
        error.code = payload.code;
        error.requiresVerification = payload.requiresVerification;
        error.retryAfterSeconds = payload.retryAfterSeconds;
        error.verificationHint = payload.verificationHint;
        error.activeBan = payload.activeBan;
        throw error;
      }

      await refreshSessionAfterAuthChange();
    },
    [isDesktopRuntime, locale, refreshSessionAfterAuthChange, t],
  );

  const sendVerificationEmail = useCallback(async () => {
    const tokenValue = token ?? (await refreshSession());
    if (!tokenValue) {
      throw new Error("Session expired. Please sign in again.");
    }

    const desktopAuthApi = adapter.getDesktopAuthApi();
    if (desktopAuthApi) {
      const envelope = (await desktopAuthApi.verifyEmail(tokenValue)) as DesktopApiEnvelope;
      if (!envelope.ok) {
        const payload = extractErrorPayloadFromEnvelope(envelope, t);
        throw new Error(payload.message);
      }
      return;
    }
    if (isDesktopRuntime) {
      throw new Error(t('auth.error.desktopBridgeUnavailable'));
    }

    const response = await fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/verify-email"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenValue}`,
        "X-Koma-Locale": locale,
        ...adapter.getDesktopUpdatePolicyHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ locale }),
    });

    if (!response.ok) {
      const payload = await parseError(response, t);
      throw new Error(payload.message);
    }
  }, [isDesktopRuntime, locale, refreshSession, t, token]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const desktopAuthApi = adapter.getDesktopAuthApi();
    if (desktopAuthApi) {
      const envelope = (await desktopAuthApi.forgotPassword(email)) as DesktopApiEnvelope;
      if (!envelope.ok) {
        const payload = extractErrorPayloadFromEnvelope(envelope, t);
        throw new Error(payload.message);
      }
      return;
    }
    if (isDesktopRuntime) {
      throw new Error(t('auth.error.desktopBridgeUnavailable'));
    }

    const response = await fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Koma-Locale": locale },
      credentials: "include",
      body: JSON.stringify({ email, locale }),
    });

    if (!response.ok) {
      const payload = await parseError(response, t);
      throw new Error(payload.message);
    }
  }, [isDesktopRuntime, locale, t]);

  const resetPassword = useCallback(async (resetToken: string, password: string) => {
    const desktopAuthApi = adapter.getDesktopAuthApi();
    if (desktopAuthApi) {
      const envelope = (await desktopAuthApi.resetPassword(resetToken, password)) as DesktopApiEnvelope;
      if (!envelope.ok) {
        const payload = extractErrorPayloadFromEnvelope(envelope, t);
        throw new Error(payload.message);
      }
      return;
    }
    if (isDesktopRuntime) {
      throw new Error(t('auth.error.desktopBridgeUnavailable'));
    }

    const response = await fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Koma-Locale": locale },
      credentials: "include",
      body: JSON.stringify({
        token: resetToken,
        password,
        locale,
      }),
    });

    if (!response.ok) {
      const payload = await parseError(response, t);
      throw new Error(payload.message);
    }
  }, [isDesktopRuntime, locale, t]);

  const logout = useCallback(async () => {
    const desktopAuthApi = adapter.getDesktopAuthApi();
    if (desktopAuthApi) {
      try {
        await desktopAuthApi.signOut();
      } finally {
        clearLocalSession();
        clearBanState();
      }
      return;
    }
    if (isDesktopRuntime) {
      throw new Error(t('auth.error.desktopBridgeUnavailable'));
    }

    await fetchWithTimeoutAndRetry(adapter.buildUrl("authUrl", "/api/auth/sign-out"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });

    clearLocalSession();
    clearBanState();
  }, [clearBanState, clearLocalSession, isDesktopRuntime]);

  const markEmailVerified = useCallback(() => {
    // Optimistic update after a successful confirm-email: the server state is
    // known-good, but the follow-up session refresh can fail transiently (see
    // fetchSessionSnapshot), which left the dashboard banner claiming
    // verification was still pending until a full reload.
    queryClient.setQueryData<AuthSessionSnapshot | null>(
      appQueryKeys.auth.session,
      (current) =>
        current && !current.user.emailVerified
          ? { ...current, user: { ...current.user, emailVerified: true } }
          : current,
    );
  }, [queryClient]);

  const hydrateSession = useCallback((nextUser: AuthUser, accessToken: string) => {
    const snapshot: AuthSessionSnapshot = { user: nextUser, accessToken };
    queryClient.setQueryData<AuthSessionSnapshot | null>(
      appQueryKeys.auth.session,
      snapshot,
    );
    setActiveBan(null);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      activeBan,
      isAuthenticated: authDisabled ? true : user !== null,
      isAuthDisabled: authDisabled,
      isLoading,
      login,
      register,
      sendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      logout,
      refreshSession,
      markEmailVerified,
      getAuthToken: () => token,
      hydrateSession,
      clearBanState,
    }),
    [
      user,
      activeBan,
      isLoading,
      login,
      register,
      sendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      logout,
      refreshSession,
      markEmailVerified,
      token,
      hydrateSession,
      clearBanState,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider");
  }

  return context;
};
