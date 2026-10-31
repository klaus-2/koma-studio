import { desktopCommandChannels } from "../../../../packages/types/src/desktop-api.ts";

const channels = desktopCommandChannels;

const authUnavailable = (): unknown => ({
  ok: false,
  status: 503,
  payload: null,
  error: "Authentication is disabled in the E2E harness.",
});

/**
 * Fixed responses for channels the harness answers without touching host
 * state. Every entry is a factory so each call returns a fresh object,
 * matching the previous switch-based dispatch.
 */
export const stubHandlers: Record<string, () => unknown> = {
  // runtime
  [channels.runtime.getMiniBackendRuntimeState]: () => null,
  [channels.runtime.listMiniBackendRuntimeArtifacts]: () => [],
  [channels.runtime.installRecommendedMiniBackendRuntime]: () => ({
    installed: false,
  }),
  [channels.runtime.installMiniBackendRuntimeProfile]: () => ({
    installed: false,
  }),
  [channels.runtime.resetLocalSettings]: () => undefined,
  [channels.runtime.restartApp]: () => undefined,

  // locale / local backend / logging / links
  [channels.locale.getPreferences]: () => ({ locale: "en" }),
  [channels.localBackend.check]: () => true,
  [channels.localBackend.restart]: () => true,
  [channels.logging.sessionLog]: () => undefined,
  [channels.links.openExternal]: () => undefined,
  [channels.links.openCommunityLink]: () => undefined,

  // api.auth (authentication is disabled in the harness)
  [channels.api.auth.config]: () => ({
    ok: true,
    status: 200,
    payload: {
      captchaEnabled: false,
      emailDeliveryEnabled: false,
      desktopClientEnforced: false,
    },
  }),
  [channels.api.auth.session]: () => ({ ok: true, status: 200, payload: null }),
  [channels.api.auth.refreshSession]: () => ({
    ok: true,
    status: 200,
    payload: { refreshed: false },
  }),
  [channels.api.auth.login]: () => authUnavailable(),
  [channels.api.auth.register]: () => authUnavailable(),
  [channels.api.auth.verifyEmail]: () => authUnavailable(),
  [channels.api.auth.confirmEmail]: () => authUnavailable(),
  [channels.api.auth.forgotPassword]: () => authUnavailable(),
  [channels.api.auth.resetPassword]: () => authUnavailable(),
  [channels.api.auth.setTravelToken]: () => authUnavailable(),
  [channels.api.auth.createTravelToken]: () => authUnavailable(),
  [channels.api.auth.signOut]: () => undefined,

  // api.fonts
  [channels.api.fonts.list]: () => ({ system: [], custom: [] }),
  [channels.api.fonts.import]: () => ({}),
  [channels.api.fonts.install]: () => ({}),
  [channels.api.fonts.uninstall]: () => ({}),

  // api.llmProfiles
  [channels.api.llmProfiles.list]: () => [],
  [channels.api.llmProfiles.save]: () => ({}),
  [channels.api.llmProfiles.remove]: () => ({}),
  [channels.api.llmProfiles.resolve]: () => ({}),

  // api.blogger
  [channels.api.blogger.loadConfig]: () => ({ config: {}, secureStorage: false }),
  [channels.api.blogger.saveConfig]: () => ({ config: {}, secureStorage: false }),
  [channels.api.blogger.testConnection]: () => ({
    ok: false,
    message: "Blogger is not configured in E2E.",
  }),
  [channels.api.blogger.uploadImages]: () => ({
    items: [],
    optimizerApplied: false,
  }),
  [channels.api.blogger.publishPost]: () => ({}),

  // api.imgur
  [channels.api.imgur.loadConfig]: () => ({
    config: {},
    secureStorage: false,
    rateLimit: { remaining: 0, resetAt: null },
  }),
  [channels.api.imgur.saveConfig]: () => ({
    config: {},
    secureStorage: false,
    rateLimit: { remaining: 0, resetAt: null },
  }),
  [channels.api.imgur.uploadImages]: () => ({
    items: [],
    rateLimit: { remaining: 0, resetAt: null },
  }),

  // api.misc
  [channels.api.discordWebhook.send]: () => ({ ok: false }),
  [channels.api.bugReport.prepare]: () => ({}),
  [channels.api.bugReport.submit]: () => ({}),
  [channels.api.identity.hardwareId]: () => "e2e-hardware-id",
  [channels.api.identity.machineFingerprint]: () => "e2e-machine-fingerprint",
  [channels.api.integrations.deepLinkExtract]: () => null,
  [channels.api.integrations.deepLinkRoute]: () => null,
  [channels.api.integrations.deepLinkFormat]: () => "",
  [channels.api.integrations.deepLinkNavigate]: () => undefined,
  [channels.api.security.certPinningSnapshot]: () => ({}),

  // images
  [channels.images.listFolder]: () => ({ files: [], nextCursor: null }),
  [channels.images.allowPaths]: () => [],

  // discordRPC connection stubs (activity channels are no-oped by the
  // dispatcher's discord-rpc fallback)
  [channels.discordRPC.setEnabled]: () => false,
  [channels.discordRPC.isConnected]: () => false,
  [channels.discordRPC.isEnabled]: () => false,
  [channels.discordRPC.getPresetAssets]: () => ({}),
};
