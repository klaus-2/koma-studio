import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuthContext, type AuthUser } from "./context";
import { setRuntimeAdapter, type KomaRuntimeAdapter } from "./runtime-adapter";
import { setUiI18n } from "@koma/ui/i18n-port";
import type {
  DesktopApiEnvelope,
  DesktopAuthApiPort,
  DesktopAuthSessionSnapshot,
} from "@koma/types/desktop-api";

const SESSION_USER: AuthUser = {
  id: "user-1",
  email: "user@example.test",
  emailVerified: true,
};

// A fresh, deep-equal snapshot per call — exactly what a session endpoint
// returns: same fields, new object identities every time.
const sessionEnvelope = (
  accessToken: string,
): DesktopApiEnvelope<DesktopAuthSessionSnapshot | null> => ({
  ok: true,
  status: 200,
  payload: { user: { ...SESSION_USER }, accessToken },
});

const buildDesktopAuthApi = (
  sessionImpl: () => Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot | null>>,
): DesktopAuthApiPort => ({
  config: async () => ({ ok: true, status: 200, payload: null }),
  session: sessionImpl,
  refreshSession: async () => ({ ok: true, status: 200, payload: { refreshed: false } }),
  login: async () => ({
    ok: true,
    status: 200,
    payload: { user: { ...SESSION_USER }, accessToken: "" },
  }),
  register: async () => ({
    ok: true,
    status: 200,
    payload: { user: { ...SESSION_USER }, accessToken: "" },
  }),
  setTravelToken: async () => ({ ok: true, status: 200, payload: null }),
  createTravelToken: async () => ({ ok: true, status: 200, payload: null }),
  verifyEmail: async () => ({ ok: true, status: 200, payload: null }),
  confirmEmail: async () => ({ ok: true, status: 200, payload: null }),
  forgotPassword: async () => ({ ok: true, status: 200, payload: null }),
  resetPassword: async () => ({ ok: true, status: 200, payload: null }),
  signOut: async () => undefined,
});

const buildAdapter = (desktopAuthApi: DesktopAuthApiPort): KomaRuntimeAdapter => ({
  isDesktopRuntime: () => true,
  getDesktopAuthApi: () => desktopAuthApi,
  isAuthDisabled: () => false,
  buildUrl: (_base, routePath) => `https://auth.test${routePath}`,
  getDesktopUpdatePolicyHeaders: () => ({}),
  useUpdaterBlocking: () => false,
});

let probeRenders = 0;
let latestUser: AuthUser | null = null;
let latestRefresh: (() => Promise<string | null>) | null = null;
let latestGetToken: (() => string | null) | null = null;

const Probe = () => {
  probeRenders += 1;
  const { user, refreshSession, getAuthToken } = useAuthContext();
  latestUser = user;
  latestRefresh = refreshSession;
  latestGetToken = getAuthToken;
  return null;
};

const renderProbe = (sessionImpl: () => Promise<DesktopApiEnvelope<DesktopAuthSessionSnapshot | null>>) => {
  setRuntimeAdapter(buildAdapter(buildDesktopAuthApi(sessionImpl)));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe("AuthProvider session snapshot identity", () => {
  beforeEach(() => {
    setUiI18n(() => ({ t: (key: string) => key, locale: "en" }));
    probeRenders = 0;
    latestUser = null;
    latestRefresh = null;
    latestGetToken = null;
  });

  it("keeps the user identity across structurally equal refreshes", async () => {
    const sessionImpl = vi.fn(async () => sessionEnvelope("token-1"));
    renderProbe(sessionImpl);

    await waitFor(() => expect(latestUser).not.toBeNull());
    const settledRenders = probeRenders;
    const firstUser = latestUser;
    expect(firstUser).not.toBeNull();

    await act(async () => {
      await latestRefresh?.();
    });

    expect(latestUser).toBe(firstUser);
    expect(probeRenders).toBe(settledRenders);
  });

  it("shares the user branch when only the access token rotates", async () => {
    const sessionImpl = vi.fn(async () => sessionEnvelope("token-1"));
    renderProbe(sessionImpl);

    await waitFor(() => expect(latestUser).not.toBeNull());
    const firstUser = latestUser;
    expect(latestGetToken?.()).toBe("token-1");

    sessionImpl.mockImplementation(async () => sessionEnvelope("token-2"));
    await act(async () => {
      await latestRefresh?.();
    });

    await waitFor(() => expect(latestGetToken?.()).toBe("token-2"));
    expect(latestUser).toBe(firstUser);
  });
});
