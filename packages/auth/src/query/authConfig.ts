import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "./client";
import { fetchWithTimeoutAndRetry } from "../utils/http";
import { getRuntimeAdapter } from "../runtime-adapter";

export interface AuthConfigResponse {
  captchaEnabled: boolean;
  turnstileSiteKey: string | null;
  emailDeliveryEnabled?: boolean;
  desktopClientEnforced?: boolean;
}

const fetchAuthConfig = async (): Promise<AuthConfigResponse | null> => {
  const adapter = getRuntimeAdapter();
  if (adapter.isAuthDisabled()) {
    return null;
  }

  const desktopAuthApi = adapter.isDesktopRuntime()
    ? adapter.getDesktopAuthApi()
    : null;

  if (adapter.isDesktopRuntime() && !desktopAuthApi) {
    return null;
  }

  if (desktopAuthApi) {
    const envelope = (await desktopAuthApi.config()) as {
      ok: boolean;
      payload: AuthConfigResponse | null;
    };
    return envelope.ok ? envelope.payload : null;
  }

  const response = await fetchWithTimeoutAndRetry(
    adapter.buildUrl("authUrl", "/api/auth/config"),
    { method: "GET" },
    { timeoutMs: 1_000, retryCount: 0 },
  ).catch(() => null);
  if (!response?.ok) {
    return null;
  }
  return (await response.json()) as AuthConfigResponse;
};

export const useAuthConfigQuery = () =>
  useQuery({
    queryKey: appQueryKeys.authConfig,
    queryFn: fetchAuthConfig,
    staleTime: 10 * 60_000,
  });
