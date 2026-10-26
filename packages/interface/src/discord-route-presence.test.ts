import { describe, expect, it } from "vitest";

import { resolveRoutePresence } from "./discord-route-presence";

describe("resolveRoutePresence", () => {
  it.each([
    ["login", "login_register"],
    ["register", "login_register"],
    ["forgot-password", "login_register"],
    ["reset-password", "login_register"],
    ["verify-email", "login_register"],
    ["confirm-email", "login_register"],
    ["settings", "settings"],
    ["model-rankings", "rankings"],
    ["scanlation-feed", "scanlation_feed"],
  ] as const)("maps %s to the %s preset", (route, preset) => {
    expect(resolveRoutePresence(route, true)).toEqual({ kind: "preset", preset });
    expect(resolveRoutePresence(route, false)).toEqual({ kind: "preset", preset });
  });

  it("falls back to the workspace presence for routes without a preset", () => {
    expect(resolveRoutePresence("dashboard", true)).toEqual({ kind: "dashboard" });
    expect(resolveRoutePresence("banned", true)).toEqual({ kind: "dashboard" });
    expect(resolveRoutePresence("legal-terms", true)).toEqual({ kind: "dashboard" });
  });

  it("falls back to idle for signed-out users", () => {
    expect(resolveRoutePresence("dashboard", false)).toEqual({ kind: "idle" });
    expect(resolveRoutePresence("banned", false)).toEqual({ kind: "idle" });
  });
});
