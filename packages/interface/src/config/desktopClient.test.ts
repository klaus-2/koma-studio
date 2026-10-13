import { afterEach, describe, expect, it, vi } from "vitest";

import { getDesktopAppVersion, getDesktopUpdatePolicyHeaders } from "./desktopClient";

const APP_VERSION_GLOBAL = "__KOMA_APP_VERSION__";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDesktopAppVersion", () => {
  it("returns the version injected by the shell build", () => {
    vi.stubGlobal(APP_VERSION_GLOBAL, "1.1.0");
    expect(getDesktopAppVersion()).toBe("1.1.0");
  });

  it("trims the injected version", () => {
    vi.stubGlobal(APP_VERSION_GLOBAL, "  1.1.0  ");
    expect(getDesktopAppVersion()).toBe("1.1.0");
  });

  it("returns null when no shell injects a version", () => {
    expect(getDesktopAppVersion()).toBeNull();
  });

  it("returns null when the injected version is blank", () => {
    vi.stubGlobal(APP_VERSION_GLOBAL, "   ");
    expect(getDesktopAppVersion()).toBeNull();
  });
});

describe("getDesktopUpdatePolicyHeaders", () => {
  it("sends the injected version when a shell provides one", () => {
    vi.stubGlobal(APP_VERSION_GLOBAL, "1.1.0");
    expect(getDesktopUpdatePolicyHeaders()).toEqual({
      "x-desktop-app-version": "1.1.0",
      "x-desktop-update-channel": "stable",
    });
  });

  it("omits the version header when no shell provides one", () => {
    const headers = getDesktopUpdatePolicyHeaders();
    expect(Object.keys(headers)).not.toContain("x-desktop-app-version");
    expect(headers["x-desktop-update-channel"]).toBe("stable");
  });
});
