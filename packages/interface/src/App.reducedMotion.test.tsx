import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import App from "./App";
import { I18nProvider } from "./i18n";
import { useEconomicUiStore } from "./pages/dashboard/stores/economic-ui-store";
import { useAioPipelineStore } from "./pages/dashboard/stores/aio-pipeline-store";
import type { AioExecutionStatus } from "./utils/dashboardRenderUtils";
import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";

setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });

const motionCapture = vi.hoisted(() => ({ reducedMotion: null as string | null }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { Fragment, createElement } = await import("react");
  return {
    ...actual,
    m: actual.motion,
    LazyMotion: ({ children }: { children?: ReactNode }) =>
      createElement(Fragment, null, children),
    MotionConfig: (props: { children?: ReactNode; reducedMotion?: string }) => {
      motionCapture.reducedMotion = props.reducedMotion ?? null;
      return createElement(Fragment, null, props.children);
    },
  };
});

vi.mock("./contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuthContext: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    refreshSession: async () => null,
    markEmailVerified: () => undefined,
    activeBan: null,
    clearBanState: () => undefined,
  }),
}));

vi.mock("@koma/auth/SessionTimeout", () => ({ SessionTimeout: () => null }));
vi.mock("./components/runtime/RuntimeStartupToast", () => ({
  RuntimeStartupToast: () => null,
}));
vi.mock("./components/updater/UpdateToast", () => ({ UpdateToast: () => null }));
vi.mock("./components/CustomCursor", () => ({ CustomCursor: () => null }));
vi.mock("./hooks/useUpdater", () => ({
  UpdaterProvider: ({ children }: { children: ReactNode }) => children,
}));

const ACTIVE_AIO_STATUS: AioExecutionStatus = {
  scope: "auto",
  stageKey: null,
  imageName: null,
  imageIndex: null,
  totalImages: 1,
  label: "reduced-motion-test",
};

const resetStores = (): void => {
  useEconomicUiStore.setState({ hidden: false });
  useAioPipelineStore.setState({ aioExecutionStatus: null });
};

beforeEach(() => {
  resetStores();
  motionCapture.reducedMotion = null;
});

afterEach(() => {
  resetStores();
});

describe("App MotionConfig reducedMotion", () => {
  const renderApp = (): void => {
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );
  };

  it("keeps animations enabled while the dashboard is idle", () => {
    renderApp();

    expect(motionCapture.reducedMotion).toBe("never");
  });

  it("disables motion while an AIO pipeline run is active and re-enables it after", () => {
    renderApp();

    act(() => {
      useAioPipelineStore.setState({ aioExecutionStatus: ACTIVE_AIO_STATUS });
    });
    expect(motionCapture.reducedMotion).toBe("always");

    act(() => {
      useAioPipelineStore.setState({ aioExecutionStatus: null });
    });
    expect(motionCapture.reducedMotion).toBe("never");
  });

  it("disables motion while the economic UI is hidden", () => {
    renderApp();

    act(() => {
      useEconomicUiStore.setState({ hidden: true });
    });
    expect(motionCapture.reducedMotion).toBe("always");
  });
});
