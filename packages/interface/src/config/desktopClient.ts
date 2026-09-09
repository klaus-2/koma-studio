const APP_VERSION =
  typeof __KOMA_APP_VERSION__ === "string" && __KOMA_APP_VERSION__.trim().length > 0
    ? __KOMA_APP_VERSION__.trim()
    : "2.0.0-alpha.0";

export const getDesktopUpdatePolicyHeaders = (): Record<string, string> => ({
  "x-desktop-app-version": APP_VERSION,
  "x-desktop-update-channel": "stable",
});
