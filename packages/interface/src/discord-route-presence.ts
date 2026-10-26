import type { RoutePath } from "./app-router";
import type { DiscordActivityPreset } from "./types";

export type RoutePresence =
  | { kind: "preset"; preset: DiscordActivityPreset }
  | { kind: "dashboard" }
  | { kind: "idle" };

const ROUTE_PRESENCE_PRESETS: Partial<Record<RoutePath, DiscordActivityPreset>> = {
  login: "login_register",
  register: "login_register",
  "forgot-password": "login_register",
  "reset-password": "login_register",
  "verify-email": "login_register",
  "confirm-email": "login_register",
  settings: "settings",
  "model-rankings": "rankings",
  "scanlation-feed": "scanlation_feed",
};

export const resolveRoutePresence = (
  route: RoutePath,
  isAuthenticated: boolean,
): RoutePresence => {
  const preset = ROUTE_PRESENCE_PRESETS[route];

  if (preset) {
    return { kind: "preset", preset };
  }

  return isAuthenticated ? { kind: "dashboard" } : { kind: "idle" };
};
