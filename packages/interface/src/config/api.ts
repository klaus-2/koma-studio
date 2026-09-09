import "../types";

import { desktopBridge } from "@/lib/desktop-bridge";
export interface ApiConfig {
  authUrl: string;
  localUrl: string;
  environment: string;
}

const fromEnv = {
  authUrl: import.meta.env.VITE_AUTH_API_URL as string | undefined,
  localUrl: import.meta.env.VITE_LOCAL_API_URL as string | undefined,
};

const getRuntimeConfig = (): { authApiUrl?: string; localApiUrl?: string } | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return desktopBridge.getRuntimeConfig();
};

const isLocalhostUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
};

const enforceHttpsInProduction = (url: string, label: string): string => {
  const env = (import.meta.env.VITE_ENV as string | undefined) ?? "development";
  if (env !== "production") {
    return url;
  }
  if (isLocalhostUrl(url)) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      console.error(
        `[${label}] Insecure HTTP URL in production — expected HTTPS. ` +
        `Received: ${url}. Falling back to HTTPS.`,
      );
      parsed.protocol = "https:";
      return parsed.toString();
    }
  } catch {
    console.error(`[${label}] Invalid API URL: ${url}`);
  }
  return url;
};

export const getApiConfig = (): ApiConfig => {
  const runtimeConfig = getRuntimeConfig();

  const rawAuthUrl = runtimeConfig?.authApiUrl ?? fromEnv.authUrl ?? "http://127.0.0.1:3001";
  const rawLocalUrl = runtimeConfig?.localApiUrl ?? fromEnv.localUrl ?? "http://127.0.0.1:8001";

  return {
    authUrl: enforceHttpsInProduction(rawAuthUrl, "AUTH_API"),
    localUrl: enforceHttpsInProduction(rawLocalUrl, "LOCAL_API"),
    environment: (import.meta.env.VITE_ENV as string | undefined) ?? "development",
  };
};

// Lazy evaluation: the URL depends on the provider registered by the shell
// (getRuntimeConfig) — no config at module level.

export const buildUrl = (
  base: keyof Omit<ApiConfig, "environment">,
  routePath: string,
): string => {
  const api = getApiConfig();
  return `${api[base]}${routePath}`;
};
