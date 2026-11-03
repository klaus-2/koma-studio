import type { DesktopModelsApi, IDesktopBridge } from "@shared/desktop-api";

const unavailable = (member: string): never => {
  throw new Error(`desktop bridge member "${member}" is not stubbed for this test`);
};

export const createDesktopBridgeStub = (models: DesktopModelsApi): IDesktopBridge => ({
  getRuntimeConfig: () => unavailable("getRuntimeConfig"),
  getMiniBackendRuntimeState: async () => unavailable("getMiniBackendRuntimeState"),
  listMiniBackendRuntimeArtifacts: async () => unavailable("listMiniBackendRuntimeArtifacts"),
  installRecommendedMiniBackendRuntime: async () =>
    unavailable("installRecommendedMiniBackendRuntime"),
  installMiniBackendRuntimeProfile: async () => unavailable("installMiniBackendRuntimeProfile"),
  resetLocalSettings: async () => unavailable("resetLocalSettings"),
  restartApp: async () => unavailable("restartApp"),
  onMiniBackendRuntimeState: () => unavailable("onMiniBackendRuntimeState"),
  offMiniBackendRuntimeState: () => unavailable("offMiniBackendRuntimeState"),
  locale: {
    getPreferences: async () => unavailable("locale.getPreferences"),
  },
  checkLocalBackend: async () => unavailable("checkLocalBackend"),
  restartLocalBackend: async () => unavailable("restartLocalBackend"),
  sessionLog: async () => unavailable("sessionLog"),
  openExternal: async () => unavailable("openExternal"),
  openCommunityLink: async () => unavailable("openCommunityLink"),
  models,
  workspace: {
    loadAutosave: async () => unavailable("workspace.loadAutosave"),
    saveAutosave: async () => unavailable("workspace.saveAutosave"),
    sendAutosave: () => unavailable("workspace.sendAutosave"),
    clearAutosave: async () => unavailable("workspace.clearAutosave"),
    exportCurrent: async () => unavailable("workspace.exportCurrent"),
    importFile: async () => unavailable("workspace.importFile"),
  },
  files: {
    saveBlob: async () => unavailable("files.saveBlob"),
  },
  api: {
    auth: {
      config: async () => unavailable("api.auth.config"),
      session: async () => unavailable("api.auth.session"),
      refreshSession: async () => unavailable("api.auth.refreshSession"),
      login: async () => unavailable("api.auth.login"),
      register: async () => unavailable("api.auth.register"),
      setTravelToken: async () => unavailable("api.auth.setTravelToken"),
      createTravelToken: async () => unavailable("api.auth.createTravelToken"),
      verifyEmail: async () => unavailable("api.auth.verifyEmail"),
      confirmEmail: async () => unavailable("api.auth.confirmEmail"),
      forgotPassword: async () => unavailable("api.auth.forgotPassword"),
      resetPassword: async () => unavailable("api.auth.resetPassword"),
      signOut: async () => unavailable("api.auth.signOut"),
    },
    fonts: {
      list: async () => unavailable("api.fonts.list"),
      import: async () => unavailable("api.fonts.import"),
      install: async () => unavailable("api.fonts.install"),
      uninstall: async () => unavailable("api.fonts.uninstall"),
    },
    llmProfiles: {
      list: async () => unavailable("api.llmProfiles.list"),
      save: async () => unavailable("api.llmProfiles.save"),
      remove: async () => unavailable("api.llmProfiles.remove"),
    },
    blogger: {
      loadConfig: async () => unavailable("api.blogger.loadConfig"),
      saveConfig: async () => unavailable("api.blogger.saveConfig"),
      testConnection: async () => unavailable("api.blogger.testConnection"),
      uploadImages: async () => unavailable("api.blogger.uploadImages"),
      publishPost: async () => unavailable("api.blogger.publishPost"),
    },
    imgur: {
      loadConfig: async () => unavailable("api.imgur.loadConfig"),
      saveConfig: async () => unavailable("api.imgur.saveConfig"),
      uploadImages: async () => unavailable("api.imgur.uploadImages"),
    },
    discordWebhook: {
      send: async () => unavailable("api.discordWebhook.send"),
    },
    bugReport: {
      prepare: async () => unavailable("api.bugReport.prepare"),
      submit: async () => unavailable("api.bugReport.submit"),
    },
    identity: {
      hardwareId: async () => unavailable("api.identity.hardwareId"),
      machineFingerprint: async () => unavailable("api.identity.machineFingerprint"),
    },
    integrations: {
      deepLinkExtract: async () => unavailable("api.integrations.deepLinkExtract"),
      deepLinkRoute: async () => unavailable("api.integrations.deepLinkRoute"),
      deepLinkFormat: async () => unavailable("api.integrations.deepLinkFormat"),
      deepLinkNavigate: async () => unavailable("api.integrations.deepLinkNavigate"),
    },
    security: {
      certPinningSnapshot: async () => unavailable("api.security.certPinningSnapshot"),
    },
  },
  images: {
    listFolder: async () => unavailable("images.listFolder"),
  },
  discordRPC: {
    setEnabled: async () => unavailable("discordRPC.setEnabled"),
    setActivity: async () => unavailable("discordRPC.setActivity"),
    setPreset: async () => unavailable("discordRPC.setPreset"),
    setCleaning: async () => unavailable("discordRPC.setCleaning"),
    setTranslating: async () => unavailable("discordRPC.setTranslating"),
    setTyping: async () => unavailable("discordRPC.setTyping"),
    setRedrawing: async () => unavailable("discordRPC.setRedrawing"),
    setDashboard: async () => unavailable("discordRPC.setDashboard"),
    setBatchProcessing: async () => unavailable("discordRPC.setBatchProcessing"),
    setIdle: async () => unavailable("discordRPC.setIdle"),
    clearActivity: async () => unavailable("discordRPC.clearActivity"),
    isConnected: async () => unavailable("discordRPC.isConnected"),
    isEnabled: async () => unavailable("discordRPC.isEnabled"),
    getPresetAssets: async () => unavailable("discordRPC.getPresetAssets"),
  },
});
