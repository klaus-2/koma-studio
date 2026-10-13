export const getDesktopAppVersion = (): string | null =>
  typeof __KOMA_APP_VERSION__ === "string" && __KOMA_APP_VERSION__.trim().length > 0
    ? __KOMA_APP_VERSION__.trim()
    : null;

export const getDesktopUpdatePolicyHeaders = (): Record<string, string> => {
  const appVersion = getDesktopAppVersion();

  return {
    "x-desktop-update-channel": "stable",
    ...(appVersion ? { "x-desktop-app-version": appVersion } : {}),
  };
};
