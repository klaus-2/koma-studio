import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyDeepLinkHash, useDesktopDeepLink } from "./useDesktopDeepLink";

const deepLinkRouteMock = vi.fn<(payload: { url: string }) => Promise<string | null>>();

// O hook consome o port runtime-neutro; o mock registra o provider de teste.
let onOpenUrlHandler: ((urls: string[]) => void) | null = null;
let currentDeepLink: string | string[] | null = null;

vi.mock("@/lib/desktop-bridge", () => ({
  desktopBridge: {
    isDesktopRuntime: () => true,
    getLaunchUrl: () => Promise.resolve(currentDeepLink),
    onOpenUrl: (handler: (urls: string[]) => void) => {
      onOpenUrlHandler = handler;
      return () => {
        onOpenUrlHandler = null;
      };
    },
    desktop: {
      api: {
        integrations: {
          deepLinkRoute: (payload: { url: string }) => deepLinkRouteMock(payload),
        },
      },
    },
  },
}));

const waitForMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useDesktopDeepLink", () => {
  beforeEach(() => {
    onOpenUrlHandler = null;
    currentDeepLink = null;
    deepLinkRouteMock.mockReset();
    deepLinkRouteMock.mockImplementation(
      (payload: { url: string }) =>
        Promise.resolve(
          payload.url.replace("komastudio://", "/").replace("komastudio:/", "/"),
        ),
    );
    window.location.hash = "";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("applies the launch deep link captured by getCurrent on mount", async () => {
    currentDeepLink = "komastudio://confirm-email?token=abc";
    renderHook(() => useDesktopDeepLink());
    await waitForMicrotasks();
    expect(window.location.hash).toBe("#/confirm-email?token=abc");
  });

  it("routes warm-start deep links delivered through onOpenUrl", async () => {
    renderHook(() => useDesktopDeepLink());
    await waitForMicrotasks();
    expect(onOpenUrlHandler).not.toBeNull();
    onOpenUrlHandler?.(["komastudio://confirm-email?token=def"]);
    await waitForMicrotasks();
    expect(window.location.hash).toBe("#/confirm-email?token=def");
  });

  it("ignores re-delivery of the link already applied", async () => {
    currentDeepLink = "komastudio://confirm-email?token=abc";
    renderHook(() => useDesktopDeepLink());
    await waitForMicrotasks();
    const hash = window.location.hash;
    expect(hash).toBe("#/confirm-email?token=abc");
    onOpenUrlHandler?.(["komastudio://confirm-email?token=abc"]);
    await waitForMicrotasks();
    // Re-delivery is a no-op: the hash must not churn (which would re-run
    // route effects like the ConfirmEmailPage token verification).
    expect(window.location.hash).toBe(hash);
  });

  it("accepts the single-slash variant Windows protocol handlers emit", () => {
    applyDeepLinkHash("/confirm-email?token=x");
    expect(window.location.hash).toBe("#/confirm-email?token=x");
  });
});
