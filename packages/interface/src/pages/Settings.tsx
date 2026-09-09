import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { useModelManager } from "../hooks/useModelManager";
import { useUpdater } from "../hooks/useUpdater";
import type {
  BloggerConfig,
  DesktopMiniBackendRuntimeArtifactOption,
  DesktopMiniBackendRuntimeState,
  DesktopRuntimeConfig,
  ImgurConfig,
  ImgurRateLimitStatus,
  IDesktopFontEntry,
  UpdaterChannel,
} from "../types";
import { DEFAULT_BLOGGER_CONFIG, DEFAULT_IMGUR_CONFIG } from "../types";
import {
  buildAioStageCatalog,
  buildCustomStageOption,
  DEFAULT_AIO_STAGE_OPTIONS,
  mergeStageOptions,
  ocrStageOptionSupportsLanguage as ocrOptionSupportsLanguage,
  SOURCE_LANGUAGE_OPTIONS,
  type AioLanguageOption,
  type AioStageOption,
  type AioStageOptionMap,
} from "../models/aioStageCatalog";
import { LOCAL_AIO_MODELS_BY_ID } from "../models/translation-models-registry";
import type {
  AioLanguageModelPreset,
  AioModelPresetStateV2,
} from "../types/aioModelPresets";
import {
  createPreset as createAioPreset,
  deletePreset as deleteAioPreset,
  loadPresetState,
  setActivePresetForLanguage,
  updatePreset as updateAioPreset,
} from "../utils/aioModelPresets";
import {
  addTextFillSwatch,
  DEFAULT_SOLID_TEXT_FILL_SWATCHES,
  loadTextFillSwatchState,
  removeTextFillSwatch,
  resetTextFillSwatches,
  saveTextFillSwatchState,
  type TextFillSwatchStateV1,
} from "../utils/textFillPicker";
import {
  loadRenderModePresetState,
  resetAllRenderModePresets,
  resetRenderModePreset,
  setRenderModePreset,
  type RenderModePresetMode,
  type RenderModePresetStateV1,
  type RenderModeStylePreset,
} from "../utils/renderModePresets";
import {
  loadCustomLlmProfiles,
  type CustomLlmProfile,
} from "../utils/customLlm";
import {
  bindTypographyPresetToMode,
  createTypographyFolder,
  createTypographyPreset,
  deleteTypographyFolder,
  deleteTypographyPreset,
  duplicateTypographyPreset,
  loadTypographyPresetState,
  renameTypographyFolder,
  setDefaultTypographyPreset,
  updateTypographyPreset,
} from "../typography/presets";
import type {
  TypographyPresetStateV1,
  TypographyStyleFolder,
  TypographyStylePreset,
} from "../typography/types";
import {
  DEFAULT_WEBHOOK_CONFIG,
  loadWebhookConfig,
  normalizeWebhookConfig,
  saveWebhookConfig,
  sendDiscordWebhookTest,
  validateDiscordWebhookUrl,
  type DiscordWebhookConfig,
  type DiscordWebhookEventKey,
} from "../services/discordWebhook";
import {
  deserializeBloggerLabels,
  loadBloggerConfig,
  saveBloggerConfig,
  serializeBloggerLabels,
  testBloggerConnection,
} from "../services/blogger";
import {
  loadImgurConfig,
  saveImgurConfig,
} from "../services/imgur";
import { useAuthConfigQuery } from "../query/authConfig";
import {
  loadWorkspaceAutosaveSettings,
  saveWorkspaceAutosaveSettings,
  type WorkspaceAutosaveSettings,
} from "../utils/workspaceAutosaveSettings";
import { clearRendererStoredAppState } from "../utils/resetLocalAppState";
import { useToolTips } from "../hooks/useToolTips";
import './SettingsPresets.css';
import './SettingsIntegrations.css';
import { useI18n } from "../i18n";
import { useThemeStore } from "@koma/ui/stores/theme-store";
import type { RenderTextStyle } from "../utils/renderText";

import { desktopBridge } from "@/lib/desktop-bridge";
import { SettingsTabIcon as TabIcon } from "./settings/SettingsTabIcon";
import { renderSettingsAppTab } from "./settings/SettingsAppTab";
import { renderSettingsIntegrationsTab } from "./settings/SettingsIntegrationsTab";
import { renderSettingsPresetsTab } from "./settings/SettingsPresetsTab";
import { renderSettingsGeneralTab } from "./settings/SettingsGeneralTab";
import type {
  BloggerFeedbackState,
  LocalResetFeedbackState,
  PresetFormData,
  RenderFontCatalog,
  RenderModePresetFormData,
  SettingsPageProps,
  SettingsTab,
  TravelTokenMetadata,
  TypographyPresetFormData,
  WebhookFeedbackState,
  WebhookTestStatus,
  WorkspaceAutosaveFeedbackState,
} from "./settings/settings.types";
import {
  AIO_STAGE_KEYS,
  DEFAULT_RENDER_FONT_FAMILIES,
  RENDER_MODE_PRESET_OPTIONS,
  SETTINGS_REQUESTED_TAB_STORAGE_KEY,
  TABS,
  createEmptyTypographyPresetFormData,
  createPresetForm,
  formatRuntimeProfileLabel,
  getFallbackStageSelection,
  maskEmail,
  normalizeLanguageCode,
  resolveRenderModePresetFormData,
  sanitizeStageSelection,
  statusCfg,
} from "./settings/settings.constants";

/* ─── Component ─────────────────────────────────────────── */

export const SettingsPage = ({ onBackDashboard }: SettingsPageProps) => {
  const { locale, localeLabels, setLocale, supportedLocales, systemLocales, t } = useI18n();
  const updater = useUpdater();
  const { user, isLoading: authLoading, sendVerificationEmail } = useAuth();
  const { data: authConfig } = useAuthConfigQuery();
  const isDesktop = desktopBridge.isDesktopRuntime();
  const runtimeConfig = useMemo<DesktopRuntimeConfig | null>(() => {
    if (typeof window === "undefined" || !desktopBridge.desktop) {
      return null;
    }

    return desktopBridge.desktop.getRuntimeConfig();
  }, []);

  /* state — core */
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [busy, setBusy] = useState(false);
  const [runtimeState, setRuntimeState] = useState<DesktopMiniBackendRuntimeState | null>(null);
  const [runtimeInstallBusy, setRuntimeInstallBusy] = useState(false);
  const [runtimeInstallMode, setRuntimeInstallMode] = useState<"manual" | null>(null);
  const [runtimeInstallFeedback, setRuntimeInstallFeedback] = useState<string | null>(null);
  const [runtimeInstallError, setRuntimeInstallError] = useState<string | null>(null);
  const [runtimeArtifactOptions, setRuntimeArtifactOptions] = useState<DesktopMiniBackendRuntimeArtifactOption[]>([]);
  const [selectedRuntimeArtifactProfile, setSelectedRuntimeArtifactProfile] = useState<string>("cpu");

  /* state — theme */
  const currentTheme = useThemeStore((s) => s.theme);
  const setCurrentTheme = useThemeStore((s) => s.setTheme);

  /* state — profile */
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [workspaceAutosaveSettings, setWorkspaceAutosaveSettings] =
    useState<WorkspaceAutosaveSettings>(() =>
      loadWorkspaceAutosaveSettings(),
    );
  const [localResetBusy, setLocalResetBusy] = useState(false);
  const [localResetFeedback, setLocalResetFeedback] =
    useState<LocalResetFeedbackState>(null);
  const [workspaceAutosaveFeedback, setWorkspaceAutosaveFeedback] =
    useState<WorkspaceAutosaveFeedbackState>(null);
  const { enabled: toolTipsEnabled, setEnabled: setToolTipsEnabled } =
    useToolTips();

  /* state — travel token */
  const [emailDeliveryEnabled, setEmailDeliveryEnabled] = useState<boolean | null>(null);
  const [travelBusy, setTravelBusy] = useState(false);
  const [travelFeedback, setTravelFeedback] = useState<string | null>(null);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [travelMeta, setTravelMeta] = useState<TravelTokenMetadata | null>(null);

  /* state — presets */
  const [presetState, setPresetState] = useState<AioModelPresetStateV2>(() => loadPresetState());
  const [presetForm, setPresetForm] = useState<PresetFormData | null>(null);
  const [presetCatalogByLanguage, setPresetCatalogByLanguage] = useState<Record<string, AioStageOptionMap>>({});
  const [presetLanguageOptions, setPresetLanguageOptions] = useState<AioLanguageOption[]>(SOURCE_LANGUAGE_OPTIONS);
  const [customLlmProfiles, setCustomLlmProfiles] = useState<CustomLlmProfile[]>([]);
  const [presetCatalogLoading, setPresetCatalogLoading] = useState(false);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [renderModePresetState, setRenderModePresetState] = useState<RenderModePresetStateV1>(() => loadRenderModePresetState());
  const [renderModePresetForm, setRenderModePresetForm] = useState<RenderModePresetFormData>(() =>
    resolveRenderModePresetFormData(RENDER_MODE_PRESET_OPTIONS[0]?.[0] ?? "text_bubble", loadRenderModePresetState()),
  );
  const [renderModePresetFeedback, setRenderModePresetFeedback] = useState<string | null>(null);
  const [renderModePresetError, setRenderModePresetError] = useState<string | null>(null);
  const [typographyPresetState, setTypographyPresetState] = useState<TypographyPresetStateV1>(() => loadTypographyPresetState());
  const [typographyPresetForm, setTypographyPresetForm] = useState<TypographyPresetFormData | null>(null);
  const [typographyPresetFeedback, setTypographyPresetFeedback] = useState<string | null>(null);
  const [typographyPresetError, setTypographyPresetError] = useState<string | null>(null);
  const [typographyNewFolderName, setTypographyNewFolderName] = useState("");
  const [typographyNewFolderParentId, setTypographyNewFolderParentId] = useState<string | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [folderRenameId, setFolderRenameId] = useState<string | null>(null);
  const [folderRenameName, setFolderRenameName] = useState("");
  const [renderFontCatalog, setRenderFontCatalog] = useState<RenderFontCatalog>({ system: [], custom: [] });
  const [textFillSwatches, setTextFillSwatches] = useState<TextFillSwatchStateV1>(() => loadTextFillSwatchState());
  const [textFillDraftValue, setTextFillDraftValue] = useState<string>(DEFAULT_SOLID_TEXT_FILL_SWATCHES[0] ?? "#111111");
  const [textFillFeedback, setTextFillFeedback] = useState<string | null>(null);
  const [textFillError, setTextFillError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const requestedTab = window.sessionStorage.getItem(SETTINGS_REQUESTED_TAB_STORAGE_KEY);
    if (requestedTab === "general" || requestedTab === "presets" || requestedTab === "integrations" || requestedTab === "app") {
      setActiveTab(requestedTab);
    }
    window.sessionStorage.removeItem(SETTINGS_REQUESTED_TAB_STORAGE_KEY);
  }, []);

  /* state — webhook */
  const [webhook, setWebhook] = useState<DiscordWebhookConfig>(DEFAULT_WEBHOOK_CONFIG);
  const [webhookTestStatus, setWebhookTestStatus] = useState<WebhookTestStatus>("idle");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookFeedback, setWebhookFeedback] = useState<WebhookFeedbackState>(null);
  const [bloggerConfig, setBloggerConfig] = useState<BloggerConfig>(DEFAULT_BLOGGER_CONFIG);
  const [bloggerLabelsInput, setBloggerLabelsInput] = useState("");
  const [bloggerTesting, setBloggerTesting] = useState(false);
  const [bloggerSaved, setBloggerSaved] = useState(false);
  const [bloggerSecureStorage, setBloggerSecureStorage] = useState(false);
  const [bloggerFeedback, setBloggerFeedback] = useState<BloggerFeedbackState>(null);
  const [imgurConfig, setImgurConfig] = useState<ImgurConfig>(DEFAULT_IMGUR_CONFIG);
  const [imgurSecureStorage, setImgurSecureStorage] = useState(false);
  const [imgurSaved, setImgurSaved] = useState(false);
  const [imgurFeedback, setImgurFeedback] = useState<BloggerFeedbackState>(null);
  const [imgurRateLimit, setImgurRateLimit] = useState<ImgurRateLimitStatus>({
    limitPerHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
    usedThisHour: 0,
    remainingThisHour: DEFAULT_IMGUR_CONFIG.rateLimitPerHour,
    resetsAt: null,
  });

  /* ─── Derived ─────────────────────────────────────────── */

  const initials = useMemo(() => {
    if (!user?.name) return "K";
    const p = user.name.trim().split(/\s+/);
    const first = p[0] ?? "";
    const second = p[1] ?? "";
    return p.length >= 2
      ? `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase()
      : first.slice(0, 2).toUpperCase();
  }, [user?.name]);

  const statusInfo = useMemo(() => statusCfg(updater.status), [updater.status]);
  const runtimeInstallInProgress = runtimeState
    ? ["resolving", "checking", "downloading", "verifying", "extracting"].includes(runtimeState.status)
    : false;
  const runtimeInstallButtonLabel = (() => {
    if (!runtimeInstallBusy && !runtimeInstallInProgress) {
      return "Install selected profile";
    }

    if (runtimeState?.status === "downloading" && runtimeState.progress) {
      return `Downloading ${Math.round(runtimeState.progress.percent)}%`;
    }

    return runtimeState?.statusMessage ?? "Preparing runtime artifact...";
  })();
  const runtimeArtifactsAvailable = Boolean(runtimeConfig?.appPackaged && runtimeConfig.runtimeArtifactsUrl);
  const runtimeArtifactsAvailabilityLabel = runtimeConfig?.appPackaged
    ? (runtimeConfig.runtimeArtifactsUrl
      ? "Packaged app with runtime artifacts available"
      : "Packaged app without runtime artifact source configured")
    : "Unavailable in development mode";
  const recommendedRuntimeArtifact = runtimeArtifactOptions.find((entry) => entry.recommended) ?? null;
  const recommendedRuntimeProfile = recommendedRuntimeArtifact?.profile ?? runtimeState?.requestedProfile ?? "cpu";
  const loadRuntimeArtifactOptions = useCallback(async () => {
    if (!desktopBridge.desktop?.listMiniBackendRuntimeArtifacts || !runtimeConfig?.appPackaged || !runtimeConfig.runtimeArtifactsUrl) {
      setRuntimeArtifactOptions([]);
      return;
    }

    try {
      const options = await desktopBridge.desktop.listMiniBackendRuntimeArtifacts();
      setRuntimeArtifactOptions(options);
      setSelectedRuntimeArtifactProfile((currentValue) => {
        if (options.some((entry) => entry.profile === currentValue)) {
          return currentValue;
        }
        const recommended = options.find((entry) => entry.recommended);
        return recommended?.profile ?? options[0]?.profile ?? "cpu";
      });
    } catch {
      setRuntimeArtifactOptions([]);
    }
  }, [runtimeConfig?.appPackaged, runtimeConfig?.runtimeArtifactsUrl]);
  const channelLabel =
    updater.channel === "beta"
      ? t("settings.updates.channelBeta")
      : t("settings.updates.channelStable");
  const { state: modelManagerState } = useModelManager({
    sourceLanguage: SOURCE_LANGUAGE_OPTIONS[0]?.value ?? "ja",
    targetLanguage: "pt-br",
  });

  const languageLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    SOURCE_LANGUAGE_OPTIONS.forEach((option) => {
      map.set(normalizeLanguageCode(option.value), t(option.label as any));
    });
    presetLanguageOptions.forEach((option) => {
      map.set(normalizeLanguageCode(option.value), t(option.label as any));
    });
    return map;
  }, [presetLanguageOptions, t]);

  const groupedPresets = useMemo(() => {
    const buckets = new Map<string, AioLanguageModelPreset[]>();
    presetState.presets.forEach((preset) => {
      const lang = normalizeLanguageCode(preset.sourceLanguage);
      const bucket = buckets.get(lang);
      if (bucket) {
        bucket.push(preset);
      } else {
        buckets.set(lang, [preset]);
      }
    });

    return Array.from(buckets.entries())
      .map(([language, items]) => {
        const activePresetId = presetState.activePresetBySourceLanguage[language] ?? null;
        const sortedItems = [...items].sort((left, right) => {
          const leftActive = left.id === activePresetId ? 0 : 1;
          const rightActive = right.id === activePresetId ? 0 : 1;
          if (leftActive !== rightActive) {
            return leftActive - rightActive;
          }
          return left.name.localeCompare(right.name, "pt-BR");
        });
        return {
          language,
          label: languageLabelByCode.get(language) ?? language.toUpperCase(),
          activePresetId,
          presets: sortedItems,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  }, [languageLabelByCode, presetState.activePresetBySourceLanguage, presetState.presets]);

  const renderModePresetFontOptions = useMemo(() => {
    const bucket = new Set<string>(DEFAULT_RENDER_FONT_FAMILIES);
    renderFontCatalog.system.forEach((family) => {
      const normalizedFamily = family.trim();
      if (normalizedFamily.length > 0) {
        bucket.add(normalizedFamily);
      }
    });
    renderFontCatalog.custom.forEach((fontEntry) => {
      const normalizedFamily = fontEntry.family.trim();
      if (normalizedFamily.length > 0) {
        bucket.add(normalizedFamily);
      }
    });
    const currentFont = renderModePresetForm.style.fontFamily.trim();
    if (currentFont.length > 0) {
      bucket.add(currentFont);
    }
    return Array.from(bucket.values()).sort((left, right) => left.localeCompare(right, "pt-BR"));
  }, [renderFontCatalog.custom, renderFontCatalog.system, renderModePresetForm.style.fontFamily]);
  const typographyPresetFontOptions = useMemo(() => {
    const bucket = new Set<string>(DEFAULT_RENDER_FONT_FAMILIES);
    renderFontCatalog.system.forEach((family) => {
      const normalized = family.trim();
      if (normalized.length > 0) bucket.add(normalized);
    });
    renderFontCatalog.custom.forEach((fontEntry) => {
      const normalized = fontEntry.family.trim();
      if (normalized.length > 0) bucket.add(normalized);
    });
    const currentFont = typographyPresetForm?.style.fontFamily.trim();
    if (currentFont) {
      bucket.add(currentFont);
    }
    return Array.from(bucket.values()).sort((left, right) => left.localeCompare(right, "pt-BR"));
  }, [renderFontCatalog.custom, renderFontCatalog.system, typographyPresetForm?.style.fontFamily]);
  const typographyPresetsByFolder = useMemo(() => {
    const map = new Map<string | null, TypographyStylePreset[]>();
    typographyPresetState.presets.forEach((preset) => {
      const bucket = map.get(preset.folderId ?? null);
      if (bucket) {
        bucket.push(preset);
      } else {
        map.set(preset.folderId ?? null, [preset]);
      }
    });
    map.forEach((value) => {
      value.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    });
    return map;
  }, [typographyPresetState.presets]);

  const loadRenderFontCatalog = useCallback(async () => {
    const desktopFontsApi = desktopBridge.desktop?.api?.fonts;
    if (!desktopFontsApi) {
      setRenderFontCatalog({ system: [], custom: [] });
      return;
    }
    try {
      const payload = await desktopFontsApi.list();
      const normalizedCatalog: RenderFontCatalog = {
        system: Array.isArray(payload?.system) ? payload.system.filter((item): item is string => typeof item === "string") : [],
        custom: Array.isArray(payload?.custom) ? payload.custom.filter((item): item is IDesktopFontEntry => (
          Boolean(item)
          && typeof item.id === "string"
          && typeof item.family === "string"
          && typeof item.fileName === "string"
          && typeof item.dataUrl === "string"
        )) : [],
      };
      setRenderFontCatalog(normalizedCatalog);
    } catch {
      setRenderFontCatalog({ system: [], custom: [] });
    }
  }, []);

  const customTranslationStageOptions = useMemo(
    () =>
      customLlmProfiles
        .filter((profile) => profile.stage === "translation")
        .map((profile) => buildCustomStageOption(profile)),
    [buildCustomStageOption, customLlmProfiles],
  );

  const customOcrStageOptions = useMemo(
    () =>
      customLlmProfiles
        .filter((profile) => profile.stage === "ocr")
        .map((profile) => buildCustomStageOption(profile)),
    [buildCustomStageOption, customLlmProfiles],
  );

  const isInstalledLocalAioEntry = useCallback((modelKey: string): boolean => {
    const entry = modelManagerState.entries[modelKey];
    if (!entry) {
      return false;
    }
    return entry.status === "installed" || entry.status === "update_available";
  }, [modelManagerState.entries]);

  const isPresetStageOptionSelectable = useCallback((option: AioStageOption): boolean => {
    if (option.key === "custom" || option.key === "custom_ocr") {
      return false;
    }
    if (!option.implemented || !option.available) {
      return false;
    }
    if (LOCAL_AIO_MODELS_BY_ID[option.key]) {
      return isInstalledLocalAioEntry(option.key);
    }
    return true;
  }, [isInstalledLocalAioEntry]);

  const mergePresetCatalogWithCustomOptions = useCallback((catalog: AioStageOptionMap): AioStageOptionMap => ({
    detectText: catalog.detectText,
    recognizeText: mergeStageOptions(
      catalog.recognizeText.filter((option) => option.key !== "custom_ocr"),
      customOcrStageOptions,
    ),
    getTranslations: mergeStageOptions(
      catalog.getTranslations.filter((option) => option.key !== "custom"),
      customTranslationStageOptions,
    ),
    segmentText: catalog.segmentText,
    cleanImage: catalog.cleanImage,
  }), [customOcrStageOptions, customTranslationStageOptions]);

  const filterSelectableStageCatalog = useCallback((catalog: AioStageOptionMap): AioStageOptionMap => ({
    detectText: catalog.detectText.filter((option) => isPresetStageOptionSelectable(option)),
    recognizeText: catalog.recognizeText.filter((option) => isPresetStageOptionSelectable(option)),
    getTranslations: catalog.getTranslations.filter((option) => isPresetStageOptionSelectable(option)),
    segmentText: catalog.segmentText.filter((option) => isPresetStageOptionSelectable(option)),
    cleanImage: catalog.cleanImage.filter((option) => isPresetStageOptionSelectable(option)),
  }), [isPresetStageOptionSelectable]);

  const getSelectableStageCatalog = useCallback((sourceLanguage: string): AioStageOptionMap => {
    const normalizedLanguage = normalizeLanguageCode(sourceLanguage);
    const catalog = presetCatalogByLanguage[normalizedLanguage] ?? DEFAULT_AIO_STAGE_OPTIONS;
    const mergedCatalog = mergePresetCatalogWithCustomOptions(catalog);
    return filterSelectableStageCatalog(mergedCatalog);
  }, [filterSelectableStageCatalog, mergePresetCatalogWithCustomOptions, presetCatalogByLanguage]);

  const dateLocale = locale.toLowerCase() === 'pt-br' ? 'pt-BR' : 'en-US';

  const fmtDate = useCallback((v: number | string | null): string => {
    if (!v) return "—";
    return new Date(v).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" });
  }, [dateLocale]);

  const travelDaysLabel = useCallback((v: number | null): string => {
    if (!v) return t("settings.travel.definedOnSend");
    return `${v} ${v === 1 ? t("settings.plan.day") : t("settings.plan.days")}`;
  }, [t]);


  useEffect(() => {
    setWebhook(loadWebhookConfig());
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadBloggerConfig()
      .then(({ config, secureStorage }) => {
        if (cancelled) {
          return;
        }
        setBloggerConfig(config);
        setBloggerLabelsInput(serializeBloggerLabels(config.defaultLabels));
        setBloggerSecureStorage(secureStorage);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setBloggerConfig(DEFAULT_BLOGGER_CONFIG);
        setBloggerLabelsInput("");
        setBloggerSecureStorage(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadImgurConfig()
      .then(({ config, secureStorage, rateLimit }) => {
        if (cancelled) {
          return;
        }
        setImgurConfig(config);
        setImgurSecureStorage(secureStorage);
        setImgurRateLimit(rateLimit);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setImgurConfig(DEFAULT_IMGUR_CONFIG);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      try {
        const payload = await loadCustomLlmProfiles(user?.id ?? null);
        if (!cancelled) {
          setCustomLlmProfiles(payload.profiles);
        }
      } catch {
        if (!cancelled) {
          setCustomLlmProfiles([]);
        }
      }
    };

    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    void loadRenderFontCatalog();
  }, [loadRenderFontCatalog]);

  useEffect(() => {
    saveTextFillSwatchState(textFillSwatches);
  }, [textFillSwatches]);

  /* ─── Effects ─────────────────────────────────────────── */

  useEffect(() => {
    if (!authConfig) {
      setEmailDeliveryEnabled(false);
      return;
    }
    setEmailDeliveryEnabled(authConfig.emailDeliveryEnabled === true);
  }, [authConfig]);

  useEffect(() => {
    if (!desktopBridge.desktop) {
      return;
    }

    let cancelled = false;
    const listener = (payload: DesktopMiniBackendRuntimeState) => {
      if (!cancelled) {
        setRuntimeState(payload);
      }
    };

    void desktopBridge.desktop.getMiniBackendRuntimeState()
      .then((payload) => {
        if (!cancelled) {
          setRuntimeState(payload ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeState(null);
        }
      });

    desktopBridge.desktop.onMiniBackendRuntimeState(listener);
    return () => {
      cancelled = true;
      desktopBridge.desktop?.offMiniBackendRuntimeState(listener);
    };
  }, []);

  useEffect(() => {
    void loadRuntimeArtifactOptions();
  }, [loadRuntimeArtifactOptions]);

  /* ─── Handlers — Updater ──────────────────────────────── */

  const handleCheck = useCallback(async () => {
    setBusy(true);
    try { await updater.checkForUpdates(); } finally { setBusy(false); }
  }, [updater]);

  const handleChannel = useCallback(async (ch: UpdaterChannel) => {
    setBusy(true);
    try { await updater.setChannel(ch); } finally { setBusy(false); }
  }, [updater]);

  const handleAutoInstall = useCallback(async (v: boolean) => {
    setBusy(true);
    try { await updater.setAutoInstall(v); } finally { setBusy(false); }
  }, [updater]);

  const handleSaveWorkspaceAutosaveSettings = useCallback(() => {
    const saved = saveWorkspaceAutosaveSettings(workspaceAutosaveSettings);
    setWorkspaceAutosaveSettings(saved);
    setWorkspaceAutosaveFeedback({
      type: "success",
      message: t("settings.app.autosave.success"),
    });
  }, [t, workspaceAutosaveSettings]);

  const handleResetLocalAppSettings = useCallback(async () => {
    const confirmed = window.confirm(t("settings.app.reset.confirm"));
    if (!confirmed) {
      return;
    }

    setLocalResetBusy(true);
    setLocalResetFeedback(null);

    try {
      clearRendererStoredAppState();

      if (desktopBridge.desktop?.resetLocalSettings) {
        await desktopBridge.desktop.resetLocalSettings();
      }

      setLocalResetFeedback({
        type: "success",
        message: t("settings.app.reset.success"),
      });

      if (desktopBridge.desktop?.restartApp) {
        await desktopBridge.desktop.restartApp();
        return;
      }

      window.setTimeout(() => {
        window.location.reload();
      }, 80);
    } catch (error) {
      setLocalResetFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.app.autosave.error"),
      });
    } finally {
      setLocalResetBusy(false);
    }
  }, [t]);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    try { await updater.downloadUpdate(); } finally { setBusy(false); }
  }, [updater]);

  const handleInstall = useCallback(async () => {
    setBusy(true);
    try { await updater.installUpdate(); } finally { setBusy(false); }
  }, [updater]);

  const handleUseRecommendedRuntimeProfile = useCallback((profile: string) => {
    setSelectedRuntimeArtifactProfile(profile);
    setRuntimeInstallFeedback(`Selected ${formatRuntimeProfileLabel(profile)} for manual installation.`);
    setRuntimeInstallError(null);
  }, [formatRuntimeProfileLabel]);

  const handleInstallSelectedRuntimeProfile = useCallback(async () => {
    setRuntimeInstallFeedback(null);
    setRuntimeInstallError(null);
    setRuntimeInstallMode("manual");

    if (!desktopBridge.desktop?.installMiniBackendRuntimeProfile) {
      setRuntimeInstallError(t("settings.app.updater.desktopOnly"));
      setRuntimeInstallMode(null);
      return;
    }

    if (!runtimeConfig?.appPackaged) {
      setRuntimeInstallError("Manual runtime artifact install is only available in the packaged app.");
      setRuntimeInstallMode(null);
      return;
    }

    if (!selectedRuntimeArtifactProfile) {
      setRuntimeInstallError("Select a runtime profile before installing.");
      setRuntimeInstallMode(null);
      return;
    }

    setRuntimeInstallBusy(true);
    try {
      const result = await desktopBridge.desktop.installMiniBackendRuntimeProfile(selectedRuntimeArtifactProfile);
      if (result.ok) {
        setRuntimeInstallFeedback(`${formatRuntimeProfileLabel(result.profile)} runtime installed and activated.`);
        await loadRuntimeArtifactOptions();
        return;
      }

      setRuntimeInstallError(result.reason || "Failed to install the selected runtime artifact.");
    } catch (error) {
      setRuntimeInstallError(error instanceof Error ? error.message : "Failed to install the selected runtime artifact.");
    } finally {
      setRuntimeInstallBusy(false);
      setRuntimeInstallMode(null);
    }
  }, [loadRuntimeArtifactOptions, runtimeConfig?.appPackaged, selectedRuntimeArtifactProfile, t]);

  /* ─── Handlers — Profile ──────────────────────────────── */

  const handleVerify = useCallback(async () => {
    setProfileFeedback(null);
    setProfileError(null);
    setVerificationBusy(true);
    try {
      await sendVerificationEmail();
      setProfileFeedback(t("settings.general.profile.verifySuccess"));
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : t("settings.general.profile.verifyError"));
    } finally {
      setVerificationBusy(false);
    }
  }, [sendVerificationEmail, t]);

  /* ─── Handlers — Travel Token ─────────────────────────── */

  const handleTravel = useCallback(async () => {
    setTravelFeedback(null);
    setTravelError(null);
    setTravelMeta(null);
    const api = desktopBridge.desktop?.api?.auth;
    if (!api) {
      setTravelError(t("settings.app.updater.desktopOnly"));
      return;
    }
    setTravelBusy(true);
    try {
      const env = await api.createTravelToken({ deliveryMode: "email" });
      if (!env.ok) {
        const msg =
          env.payload?.code === "AUTH_EMAIL_DELIVERY_UNAVAILABLE"
            ? t("login.travel.emailDisabled")
            : (env.payload?.error ?? `Error ${env.status}`);
        setTravelError(msg);
        return;
      }
      const p = env.payload;
      if (!p?.emailSent || !p.expiresAt || typeof p.travelDays !== "number") {
        setTravelError(t("login.error.missingTravelToken"));
        return;
      }
      setTravelMeta({
        destinationMasked: p.destinationMasked ?? maskEmail(user?.email),
        expiresAt: p.expiresAt,
        travelDays: p.travelDays,
      });
      setTravelFeedback(t("settings.general.travel.success"));
    } catch (e) {
      setTravelError(e instanceof Error ? e.message : t("settings.general.travel.error"));
    } finally {
      setTravelBusy(false);
    }
  }, [t, user?.email]);

  /* ─── Handlers — Presets ──────────────────────────────── */

  const loadPresetCatalogForLanguage = useCallback(async (
    sourceLanguage: string,
  ): Promise<AioStageOptionMap> => {
    const normalizedLanguage = normalizeLanguageCode(sourceLanguage) || "ja";

    setPresetCatalogLoading(true);
    try {
      const nextCatalog = buildAioStageCatalog({
        sourceLanguage: normalizedLanguage,
        localModelEntries: modelManagerState.entries,
        customProfiles: customLlmProfiles,
      });
      setPresetLanguageOptions(SOURCE_LANGUAGE_OPTIONS);
      setPresetCatalogByLanguage((prev) => ({ ...prev, [normalizedLanguage]: nextCatalog }));
      return nextCatalog;
    } catch {
      const fallback: AioStageOptionMap = {
        detectText: DEFAULT_AIO_STAGE_OPTIONS.detectText
          .filter((option) => option.implemented && option.available),
        recognizeText: DEFAULT_AIO_STAGE_OPTIONS.recognizeText
          .filter((option) => option.implemented && option.available)
          .filter((option) => ocrOptionSupportsLanguage(option, normalizedLanguage)),
        getTranslations: DEFAULT_AIO_STAGE_OPTIONS.getTranslations
          .filter((option) => option.implemented && option.available),
        segmentText: DEFAULT_AIO_STAGE_OPTIONS.segmentText
          .filter((option) => option.implemented && option.available),
        cleanImage: DEFAULT_AIO_STAGE_OPTIONS.cleanImage
          .filter((option) => option.implemented && option.available),
      };
      setPresetError(t("settings.presets.aio.error"));
      setPresetCatalogByLanguage((prev) => ({ ...prev, [normalizedLanguage]: fallback }));
      return fallback;
    } finally {
      setPresetCatalogLoading(false);
    }
  }, [
    customLlmProfiles,
    modelManagerState.entries,
    t,
  ]);

  useEffect(() => {
    void loadPresetCatalogForLanguage(SOURCE_LANGUAGE_OPTIONS[0]?.value ?? "ja");
  }, [loadPresetCatalogForLanguage]);

  const closePresetForm = useCallback(() => {
    setPresetForm(null);
  }, []);

  const openCreatePresetForm = useCallback(() => {
    const sourceLanguage = normalizeLanguageCode(presetLanguageOptions[0]?.value ?? SOURCE_LANGUAGE_OPTIONS[0]?.value ?? "ja");
    const stageCatalog = getSelectableStageCatalog(sourceLanguage);
    setPresetError(null);
    setPresetFeedback(null);
    setPresetForm(createPresetForm(sourceLanguage, getFallbackStageSelection(stageCatalog)));
    void loadPresetCatalogForLanguage(sourceLanguage).then((catalog) => {
      setPresetForm((prev) => {
        if (!prev || prev.sourceLanguage !== sourceLanguage || prev.presetId) return prev;
        return {
          ...prev,
          stageModels: sanitizeStageSelection(
            prev.stageModels,
            filterSelectableStageCatalog(mergePresetCatalogWithCustomOptions(catalog)),
          ),
        };
      });
    });
  }, [
    filterSelectableStageCatalog,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    mergePresetCatalogWithCustomOptions,
    presetLanguageOptions,
  ]);

  const openEditPresetForm = useCallback((preset: AioLanguageModelPreset) => {
    const sourceLanguage = normalizeLanguageCode(preset.sourceLanguage);
    const stageCatalog = getSelectableStageCatalog(sourceLanguage);
    setPresetError(null);
    setPresetFeedback(null);
    setPresetForm({
      presetId: preset.id,
      sourceLanguage,
      name: preset.name,
      description: preset.description,
      stageModels: sanitizeStageSelection(preset.stageModels, stageCatalog),
      setAsActive: (presetState.activePresetBySourceLanguage[sourceLanguage] ?? null) === preset.id,
    });
    void loadPresetCatalogForLanguage(sourceLanguage).then((catalog) => {
      setPresetForm((prev) => {
        if (!prev || prev.presetId !== preset.id) return prev;
        return {
          ...prev,
          stageModels: sanitizeStageSelection(
            prev.stageModels,
            filterSelectableStageCatalog(mergePresetCatalogWithCustomOptions(catalog)),
          ),
        };
      });
    });
  }, [
    filterSelectableStageCatalog,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    mergePresetCatalogWithCustomOptions,
    presetState.activePresetBySourceLanguage,
  ]);

  const handlePresetSourceLanguageChange = useCallback((sourceLanguage: string) => {
    const normalizedLanguage = normalizeLanguageCode(sourceLanguage);
    const stageCatalog = getSelectableStageCatalog(normalizedLanguage);
    setPresetForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sourceLanguage: normalizedLanguage,
        stageModels: sanitizeStageSelection(prev.stageModels, stageCatalog),
      };
    });
    void loadPresetCatalogForLanguage(normalizedLanguage).then((catalog) => {
      setPresetForm((prev) => {
        if (!prev || prev.sourceLanguage !== normalizedLanguage) return prev;
        return {
          ...prev,
          stageModels: sanitizeStageSelection(
            prev.stageModels,
            filterSelectableStageCatalog(mergePresetCatalogWithCustomOptions(catalog)),
          ),
        };
      });
    });
  }, [
    filterSelectableStageCatalog,
    getSelectableStageCatalog,
    loadPresetCatalogForLanguage,
    mergePresetCatalogWithCustomOptions,
  ]);

  const handleSavePreset = useCallback(() => {
    if (!presetForm) return;
    const trimmedName = presetForm.name.trim();
    if (!trimmedName) {
      setPresetError(t("settings.presets.aio.error"));
      return;
    }

    const normalizedLanguage = normalizeLanguageCode(presetForm.sourceLanguage);
    const stageCatalog = getSelectableStageCatalog(normalizedLanguage);
    const normalizedSelection = sanitizeStageSelection(presetForm.stageModels, stageCatalog);
    const missingStage = AIO_STAGE_KEYS.find((stageKey) => !normalizedSelection[stageKey]);
    if (missingStage) {
      setPresetError(t("settings.presets.aio.error"));
      return;
    }
    let nextState = presetState;
    let presetId: string | null = null;

    if (presetForm.presetId) {
      const updated = updateAioPreset(
        presetForm.presetId,
        {
          name: trimmedName,
          description: presetForm.description,
          sourceLanguage: normalizedLanguage,
          stageModels: normalizedSelection,
        },
        presetState,
      );
      if (!updated.preset) {
        setPresetError(t("settings.presets.aio.error"));
        return;
      }
      nextState = updated.state;
      presetId = updated.preset.id;
    } else {
      const created = createAioPreset(
        {
          name: trimmedName,
          description: presetForm.description,
          sourceLanguage: normalizedLanguage,
          stageModels: normalizedSelection,
        },
        presetState,
      );
      nextState = created.state;
      presetId = created.preset.id;
    }

    if (presetForm.setAsActive && presetId) {
      nextState = setActivePresetForLanguage(normalizedLanguage, presetId, nextState);
    }

    setPresetState(nextState);
    setPresetError(null);
    setPresetFeedback(t("settings.presets.aio.success"));
    setPresetForm(null);
  }, [getSelectableStageCatalog, presetForm, presetState, t]);

  const handleDeletePreset = useCallback((presetId: string, presetName: string) => {
    const confirmed = window.confirm(t("settings.presets.aio.delete") + ` "${presetName}"?`);
    if (!confirmed) return;
    const nextState = deleteAioPreset(presetId, presetState);
    setPresetState(nextState);
    setPresetFeedback(t("settings.presets.aio.success"));
    setPresetError(null);
    setPresetForm((prev) => (prev?.presetId === presetId ? null : prev));
  }, [presetState, t]);

  const handleSetActivePreset = useCallback((sourceLanguage: string, presetId: string | null) => {
    const nextState = setActivePresetForLanguage(sourceLanguage, presetId, presetState);
    setPresetState(nextState);
    setPresetFeedback(t("settings.presets.aio.success"));
    setPresetError(null);
  }, [presetState, t]);


  const handleRenderModePresetModeChange = useCallback((mode: RenderModePresetMode) => {
    setRenderModePresetForm(resolveRenderModePresetFormData(mode, renderModePresetState));
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, [renderModePresetState]);

  const handleRenderModePresetFieldChange = useCallback(<K extends keyof RenderModeStylePreset>(key: K, value: RenderModeStylePreset[K]) => {
    setRenderModePresetForm((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    }));
    setRenderModePresetFeedback(null);
    setRenderModePresetError(null);
  }, []);

  const handleSaveRenderModePreset = useCallback(() => {
    const nextState = setRenderModePreset(renderModePresetForm.mode, renderModePresetForm.style, renderModePresetState);
    setRenderModePresetState(nextState);
    setRenderModePresetForm(resolveRenderModePresetFormData(renderModePresetForm.mode, nextState));
    setRenderModePresetFeedback(t("settings.presets.render.desc"));
    setRenderModePresetError(null);
  }, [renderModePresetForm, renderModePresetState, t]);

  const handleResetRenderModePreset = useCallback(() => {
    const nextState = resetRenderModePreset(renderModePresetForm.mode, renderModePresetState);
    setRenderModePresetState(nextState);
    setRenderModePresetForm(resolveRenderModePresetFormData(renderModePresetForm.mode, nextState));
    setRenderModePresetFeedback(t("settings.presets.render.desc"));
    setRenderModePresetError(null);
  }, [renderModePresetForm.mode, renderModePresetState, t]);

  const handleResetAllRenderModePreset = useCallback(() => {
    const confirmed = window.confirm(t("settings.app.reset.confirm"));
    if (!confirmed) return;
    const nextState = resetAllRenderModePresets();
    setRenderModePresetState(nextState);
    setRenderModePresetForm((prev) => resolveRenderModePresetFormData(prev.mode, nextState));
    setRenderModePresetFeedback(t("settings.app.reset.success"));
    setRenderModePresetError(null);
  }, [t]);

  const openCreateTypographyPresetForm = useCallback(() => {
    setTypographyPresetForm(createEmptyTypographyPresetFormData());
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const openEditTypographyPresetForm = useCallback((preset: TypographyStylePreset) => {
    setTypographyPresetForm({
      presetId: preset.id,
      folderId: preset.folderId,
      name: preset.name,
      description: preset.description,
      defaultShapeKind: preset.defaultShapeKind,
      padding: preset.padding,
      style: { ...preset.style },
    });
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const handleTypographyPresetFieldChange = useCallback(<K extends keyof TypographyPresetFormData>(key: K, value: TypographyPresetFormData[K]) => {
    setTypographyPresetForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const handleTypographyPresetStyleChange = useCallback(<K extends keyof RenderTextStyle>(key: K, value: RenderTextStyle[K]) => {
    setTypographyPresetForm((prev) => (prev ? {
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    } : prev));
    setTypographyPresetFeedback(null);
    setTypographyPresetError(null);
  }, []);

  const handleAddTextFillSwatch = useCallback(() => {
    const nextState = addTextFillSwatch(textFillSwatches, textFillDraftValue);
    if (nextState === textFillSwatches) {
      setTextFillError(t("settings.pickerPalette.reset"));
      setTextFillFeedback(null);
      return;
    }
    setTextFillSwatches(nextState);
    setTextFillError(null);
    setTextFillFeedback(t("settings.pickerPalette.add"));
  }, [textFillDraftValue, textFillSwatches, t]);

  const handleRemoveTextFillSwatch = useCallback((value: string) => {
    const nextState = removeTextFillSwatch(textFillSwatches, value);
    setTextFillSwatches(nextState);
    setTextFillError(null);
    setTextFillFeedback(t("settings.pickerPalette.reset"));
  }, [textFillSwatches, t]);

  const handleResetTextFillSwatches = useCallback(() => {
    const confirmed = window.confirm(t("settings.pickerPalette.reset"));
    if (!confirmed) return;
    const nextState = resetTextFillSwatches();
    setTextFillSwatches(nextState);
    setTextFillDraftValue(DEFAULT_SOLID_TEXT_FILL_SWATCHES[0] ?? "#111111");
    setTextFillError(null);
    setTextFillFeedback(t("settings.pickerPalette.reset"));
  }, [t]);

  const handleSaveTypographyPreset = useCallback(() => {
    if (!typographyPresetForm) return;
    const trimmedName = typographyPresetForm.name.trim();
    if (!trimmedName) {
      setTypographyPresetError(t("settings.presets.typo.title"));
      return;
    }
    if (typographyPresetForm.presetId) {
      const updated = updateTypographyPreset(typographyPresetForm.presetId, typographyPresetForm, typographyPresetState);
      if (!updated.preset) {
        setTypographyPresetError(t("settings.presets.typo.title"));
        return;
      }
      setTypographyPresetState(updated.state);
      setTypographyPresetFeedback(t("settings.presets.typo.title"));
    } else {
      const created = createTypographyPreset(typographyPresetForm, typographyPresetState);
      setTypographyPresetState(created.state);
      setTypographyPresetFeedback(t("settings.presets.typo.title"));
    }
    setTypographyPresetForm(null);
    setTypographyPresetError(null);
  }, [typographyPresetForm, typographyPresetState, t]);

  const handleDeleteTypographyPreset = useCallback((preset: TypographyStylePreset) => {
    const confirmed = window.confirm(t("settings.presets.typo.title") + ` "${preset.name}"?`);
    if (!confirmed) return;
    const nextState = deleteTypographyPreset(preset.id, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyPresetFeedback(t("settings.presets.typo.title"));
    setTypographyPresetError(null);
    setTypographyPresetForm((prev) => (prev?.presetId === preset.id ? null : prev));
  }, [typographyPresetState, t]);

  const handleDuplicateTypographyPreset = useCallback((preset: TypographyStylePreset) => {
    const duplicated = duplicateTypographyPreset(preset.id, typographyPresetState);
    if (!duplicated.preset) return;
    setTypographyPresetState(duplicated.state);
    setTypographyPresetFeedback(t("settings.presets.typo.title"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  const handleCreateTypographyFolder = useCallback(() => {
    const trimmedName = typographyNewFolderName.trim();
    if (!trimmedName) return;
    const nextState = createTypographyFolder(trimmedName, typographyNewFolderParentId, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyNewFolderName("");
    setTypographyNewFolderParentId(null);
    setTypographyPresetFeedback(t("settings.typographerLibrary.newFolder"));
    setTypographyPresetError(null);
  }, [typographyNewFolderName, typographyNewFolderParentId, typographyPresetState, t]);

  const handleDeleteTypographyFolder = useCallback((folder: TypographyStyleFolder) => {
    const childCount = typographyPresetState.folders.filter((f) => f.parentId === folder.id).length;
    const presetCount = typographyPresetState.presets.filter((p) => p.folderId === folder.id).length;
    const extra = childCount > 0 || presetCount > 0
      ? ` (${[childCount > 0 ? `${childCount} subfolder(s)` : "", presetCount > 0 ? `${presetCount} preset(s)` : ""].filter(Boolean).join(", ")} will be moved out of the folder)`
      : "";
    const confirmed = window.confirm(`Delete folder "${folder.name}"?${extra}`);
    if (!confirmed) return;
    const nextState = deleteTypographyFolder(folder.id, typographyPresetState);
    setTypographyPresetState(nextState);
    setCollapsedFolderIds((prev) => { const next = new Set(prev); next.delete(folder.id); return next; });
    setTypographyPresetFeedback(t("settings.typographerLibrary.newFolder"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  const handleStartFolderRename = useCallback((folder: TypographyStyleFolder) => {
    setFolderRenameId(folder.id);
    setFolderRenameName(folder.name);
  }, []);

  const handleCommitFolderRename = useCallback((folderId: string) => {
    const trimmed = folderRenameName.trim();
    if (trimmed) {
      const nextState = renameTypographyFolder(folderId, trimmed, typographyPresetState);
      setTypographyPresetState(nextState);
    }
    setFolderRenameId(null);
    setFolderRenameName("");
  }, [folderRenameName, typographyPresetState]);

  const handleToggleFolderCollapse = useCallback((folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleBindTypographyPreset = useCallback((modeKey: string, presetId: string | null) => {
    const nextState = bindTypographyPresetToMode(modeKey, presetId, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyPresetFeedback(t("settings.typography.bindingsTitle"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);


  const handleSetDefaultTypographyPreset = useCallback((presetId: string | null) => {
    const nextState = setDefaultTypographyPreset(presetId, typographyPresetState);
    setTypographyPresetState(nextState);
    setTypographyPresetFeedback(t("settings.typographerLibrary.defaultPreset"));
    setTypographyPresetError(null);
  }, [typographyPresetState, t]);

  /* ─── Handlers — Webhook ──────────────────────────────── */

  const updateWebhook = useCallback(<K extends keyof DiscordWebhookConfig>(key: K, val: DiscordWebhookConfig[K]) => {
    setWebhook((prev) => ({ ...prev, [key]: val }));
    setWebhookSaved(false);
    setWebhookFeedback(null);
  }, []);

  const updateWebhookEvent = useCallback((key: DiscordWebhookEventKey, val: boolean) => {
    setWebhook((prev) => ({
      ...prev,
      events: { ...prev.events, [key]: val },
    }));
    setWebhookSaved(false);
    setWebhookFeedback(null);
  }, []);

  const saveWebhook = useCallback(() => {
    const normalized = normalizeWebhookConfig(webhook);
    const shouldValidateUrl = normalized.enabled || normalized.url.trim().length > 0;
    if (shouldValidateUrl) {
      const validation = validateDiscordWebhookUrl(normalized.url);
      if (!validation.valid) {
        setWebhookFeedback({ type: "error", message: validation.error ? t(validation.error as any) : t("settings.integrations.discord.error") });
        setWebhookSaved(false);
        return;
      }

      normalized.url = validation.normalizedUrl;
    }

    const savedConfig = saveWebhookConfig(normalized);
    setWebhook(savedConfig);
    setWebhookSaved(true);
    setWebhookFeedback({ type: "success", message: t("settings.integrations.discord.success") });
    setTimeout(() => setWebhookSaved(false), 3000);
  }, [webhook, t]);


  const testWebhook = useCallback(async () => {
    const normalized = normalizeWebhookConfig(webhook);
    const validation = validateDiscordWebhookUrl(normalized.url);
    if (!validation.valid) {
      setWebhookTestStatus("error");
      setWebhookFeedback({ type: "error", message: validation.error ? t(validation.error as any) : t("settings.integrations.discord.invalidUrl") });
      setTimeout(() => setWebhookTestStatus("idle"), 5000);
      return;
    }

    setWebhook((prev) => ({ ...prev, url: validation.normalizedUrl }));
    setWebhookTestStatus("testing");
    const result = await sendDiscordWebhookTest({ ...normalized, url: validation.normalizedUrl });
    if (result.ok) {
      setWebhookTestStatus("success");
      setWebhookFeedback({
        type: "success",
        message: t("settings.integrations.discord.success"),
      });
    } else {
      setWebhookTestStatus("error");
      setWebhookFeedback({
        type: "error",
        message: result.error ?? t("settings.integrations.discord.error"),
      });
    }

    setTimeout(() => setWebhookTestStatus("idle"), 5000);
  }, [webhook, t]);

  const updateBloggerConfig = useCallback(<K extends keyof BloggerConfig>(key: K, value: BloggerConfig[K]) => {
    setBloggerConfig((prev) => ({ ...prev, [key]: value }));
    setBloggerSaved(false);
    setBloggerFeedback(null);
  }, []);

  const updateBloggerNestedConfig = useCallback(
    <K extends "optimizer" | "preprocess", F extends keyof BloggerConfig[K]>(
      group: K,
      field: F,
      value: BloggerConfig[K][F],
    ) => {
      setBloggerConfig((prev) => ({
        ...prev,
        [group]: {
          ...prev[group],
          [field]: value,
        },
      }));
      setBloggerSaved(false);
      setBloggerFeedback(null);
    },
    [],
  );

  const buildBloggerDraftConfig = useCallback((): BloggerConfig => ({
    ...bloggerConfig,
    defaultLabels: deserializeBloggerLabels(bloggerLabelsInput),
  }), [bloggerConfig, bloggerLabelsInput]);

  const handleSaveBloggerConfig = useCallback(async () => {
    try {
      const result = await saveBloggerConfig(buildBloggerDraftConfig());
      setBloggerConfig(result.config);
      setBloggerLabelsInput(serializeBloggerLabels(result.config.defaultLabels));
      setBloggerSecureStorage(result.secureStorage);
      setBloggerSaved(true);
      setBloggerFeedback({
        type: "success",
        message: result.secureStorage
          ? t("settings.integrations.blogger.successSecure")
          : t("settings.integrations.blogger.successLocal"),
      });
      setTimeout(() => setBloggerSaved(false), 3000);
    } catch (error) {
      setBloggerSaved(false);
      setBloggerFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.integrations.blogger.saveError"),
      });
    }
  }, [buildBloggerDraftConfig, t]);

  const handleTestBloggerConnection = useCallback(async () => {
    setBloggerTesting(true);
    setBloggerFeedback(null);

    try {
      const result = await testBloggerConnection(buildBloggerDraftConfig());
      setBloggerFeedback({
        type: "success",
        message: result.message,
      });
    } catch (error) {
      setBloggerFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.integrations.blogger.testError"),
      });
    } finally {
      setBloggerTesting(false);
    }
  }, [buildBloggerDraftConfig, t]);

  const updateImgurConfig = useCallback(<K extends keyof ImgurConfig>(key: K, value: ImgurConfig[K]) => {
    setImgurConfig((prev) => ({ ...prev, [key]: value }));
    setImgurSaved(false);
    setImgurFeedback(null);
  }, []);

  const addImgurKey = useCallback(() => {
    setImgurConfig((prev) => ({
      ...prev,
      keys: [
        ...prev.keys,
        {
          id: `imgur-key-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          label: `${t('settings.integrations.imgur.clientIdPlaceholder')} ${prev.keys.length + 1}`,
          clientId: "",
          enabled: true,
        },
      ],
    }));
    setImgurSaved(false);
    setImgurFeedback(null);
  }, [t]);

  const updateImgurKey = useCallback((keyId: string, field: "label" | "clientId" | "enabled", value: string | boolean) => {
    setImgurConfig((prev) => ({
      ...prev,
      keys: prev.keys.map((item) => (item.id === keyId ? { ...item, [field]: value } : item)),
    }));
    setImgurSaved(false);
    setImgurFeedback(null);
  }, []);

  const removeImgurKey = useCallback((keyId: string) => {
    setImgurConfig((prev) => ({
      ...prev,
      keys: prev.keys.filter((item) => item.id !== keyId),
    }));
    setImgurSaved(false);
    setImgurFeedback(null);
  }, []);

  const handleSaveImgurConfig = useCallback(async () => {
    try {
      const result = await saveImgurConfig(imgurConfig);
      setImgurConfig(result.config);
      setImgurSecureStorage(result.secureStorage);
      setImgurRateLimit(result.rateLimit);
      setImgurSaved(true);
      setImgurFeedback({
        type: "success",
        message: result.secureStorage
          ? t("settings.integrations.imgur.successSecure")
          : t("settings.integrations.imgur.successLocal"),
      });
      setTimeout(() => setImgurSaved(false), 3000);
    } catch (error) {
      setImgurSaved(false);
      setImgurFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("settings.integrations.imgur.saveError"),
      });
    }
  }, [imgurConfig, t]);

  /* ─── Computed helpers ────────────────────────────────── */

  const maskedDest = travelMeta?.destinationMasked ?? maskEmail(user?.email);
  const travelExpires = travelMeta ? fmtDate(travelMeta.expiresAt) : t("settings.travel.definedOnSend");
  const travelDuration = travelDaysLabel(travelMeta?.travelDays ?? null);
  const travelBlocked = !isDesktop
    ? t("settings.travel.blocked.notDesktop")
    : emailDeliveryEnabled === false
      ? t("settings.travel.blocked.noEmail")
      : emailDeliveryEnabled === null
        ? t("settings.travel.blocked.validating")
        : null;


  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: GENERAL
     ═══════════════════════════════════════════════════════ */

  const renderGeneralTab = () =>
    renderSettingsGeneralTab({
      t,
      user,
      authLoading,
      isDesktop,
      verificationBusy,
      handleVerify,
      profileFeedback,
      profileError,
      maskedDest,
      travelExpires,
      travelDuration,
      travelBusy,
      emailDeliveryEnabled,
      handleTravel,
      travelBlocked,
      travelFeedback,
      travelMeta,
      fmtDate,
      travelDaysLabel,
      travelError,
    });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: PRESETS
     ═══════════════════════════════════════════════════════ */

     const renderPresetsTab = () =>
      renderSettingsPresetsTab({
        t,
        aio: {
          openCreatePresetForm,
          presetCatalogLoading,
          presetFeedback,
          presetError,
          presetForm,
          setPresetForm,
          presetLanguageOptions,
          handlePresetSourceLanguageChange,
          languageLabelByCode,
          closePresetForm,
          handleSavePreset,
          groupedPresets,
          handleSetActivePreset,
          openEditPresetForm,
          handleDeletePreset,
          getSelectableStageCatalog,
        },
        textFill: {
          textFillFeedback,
          textFillError,
          textFillDraftValue,
          setTextFillDraftValue,
          setTextFillError,
          setTextFillFeedback,
          textFillSwatches,
          handleAddTextFillSwatch,
          handleRemoveTextFillSwatch,
          handleResetTextFillSwatches,
        },
        renderMode: {
          renderModePresetFeedback,
          renderModePresetError,
          renderModePresetForm,
          handleRenderModePresetModeChange,
          handleRenderModePresetFieldChange,
          handleSaveRenderModePreset,
          handleResetAllRenderModePreset,
          handleResetRenderModePreset,
          renderModePresetFontOptions,
        },
        typography: {
          typographyPresetState,
          typographyPresetForm,
          setTypographyPresetForm,
          typographyPresetFeedback,
          typographyPresetError,
          typographyNewFolderName,
          setTypographyNewFolderName,
          typographyNewFolderParentId,
          setTypographyNewFolderParentId,
          collapsedFolderIds,
          folderRenameId,
          setFolderRenameId,
          folderRenameName,
          setFolderRenameName,
          typographyPresetFontOptions,
          typographyPresetsByFolder,
          openCreateTypographyPresetForm,
          openEditTypographyPresetForm,
          handleTypographyPresetFieldChange,
          handleTypographyPresetStyleChange,
          handleSaveTypographyPreset,
          handleCreateTypographyFolder,
          handleDeleteTypographyFolder,
          handleStartFolderRename,
          handleCommitFolderRename,
          handleToggleFolderCollapse,
          handleDuplicateTypographyPreset,
          handleDeleteTypographyPreset,
          handleBindTypographyPreset,
          handleSetDefaultTypographyPreset,
        },
      });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: INTEGRATIONS
     ═══════════════════════════════════════════════════════ */

     const renderIntegrationsTab = () =>
      renderSettingsIntegrationsTab({
        t,
        webhook,
        webhookTestStatus,
        updateWebhook,
        testWebhook,
        updateWebhookEvent,
        webhookSaved,
        saveWebhook,
        webhookFeedback,
        user,
        bloggerConfig,
        updateBloggerConfig,
        updateBloggerNestedConfig,
        bloggerLabelsInput,
        setBloggerLabelsInput,
        setBloggerSaved,
        setBloggerFeedback,
        bloggerSecureStorage,
        bloggerTesting,
        handleTestBloggerConnection,
        handleSaveBloggerConfig,
        bloggerSaved,
        bloggerFeedback,
        imgurConfig,
        imgurRateLimit,
        fmtDate,
        updateImgurConfig,
        addImgurKey,
        updateImgurKey,
        removeImgurKey,
        imgurSecureStorage,
        handleSaveImgurConfig,
        imgurSaved,
        imgurFeedback,
      });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: APP
     ═══════════════════════════════════════════════════════ */

  const renderAppTab = () =>
    renderSettingsAppTab({
      t,
      currentTheme,
      setCurrentTheme,
      locale,
      localeLabels,
      setLocale,
      supportedLocales,
      systemLocales,
      updater,
      statusInfo,
      channelLabel,
      fmtDate,
      busy,
      handleChannel,
      handleAutoInstall,
      workspaceAutosaveSettings,
      setWorkspaceAutosaveSettings,
      setWorkspaceAutosaveFeedback,
      workspaceAutosaveFeedback,
      handleSaveWorkspaceAutosaveSettings,
      toolTipsEnabled,
      setToolTipsEnabled,
      localResetBusy,
      handleResetLocalAppSettings,
      localResetFeedback,
      handleCheck,
      handleDownload,
      handleInstall,
      runtimeState,
      recommendedRuntimeProfile,
      runtimeArtifactsAvailable,
      runtimeArtifactsAvailabilityLabel,
      runtimeInstallBusy,
      runtimeInstallInProgress,
      runtimeInstallMode,
      runtimeInstallButtonLabel,
      runtimeInstallFeedback,
      runtimeInstallError,
      runtimeArtifactOptions,
      selectedRuntimeArtifactProfile,
      setSelectedRuntimeArtifactProfile,
      handleUseRecommendedRuntimeProfile,
      handleInstallSelectedRuntimeProfile,
      formatRuntimeProfileLabel,
    });

  /* ═══════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════ */

  const tabContent: Record<SettingsTab, () => JSX.Element> = {
    general: renderGeneralTab,
    presets: renderPresetsTab,
    integrations: renderIntegrationsTab,
    app: renderAppTab,
  };

  return (
    <div className="koma-stg">
      {/* ── Background layers ── */}
      <div className="koma-stg__bg" aria-hidden="true" />
      <div className="koma-stg__halftone" aria-hidden="true" />
      <div className="auth-orb auth-orb--purple koma-stg__orb-1" aria-hidden="true" />
      <div className="auth-orb auth-orb--cyan koma-stg__orb-2" aria-hidden="true" />

      <div className="koma-stg__scroll">
        <div className="koma-stg__container">
          {/* ── Back button ── */}
          <button type="button" onClick={onBackDashboard} className="koma-back-btn">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            {t("settings.backToDashboard")}
          </button>

          {/* ── Profile header card ── */}
          <div className="koma-stg-header">
            <div className="koma-stg-header__row">
              <div className="koma-stg-avatar" aria-hidden="true">
                <span>{initials}</span>
              </div>
              <div className="koma-stg-header__info">
                <h1 className="koma-stg-header__name">{user?.name?.trim() || t('settings.profile.defaultUser')}</h1>
                <p className="koma-stg-header__email">{user?.email || "—"}</p>
              </div>
            </div>

            <div className="koma-stg-stats">
              <div className="koma-stg-stat">
                <span className="koma-stg-stat__value">v{updater.currentVersion}</span>
                <span className="koma-stg-stat__label">{t("settings.stats.version")}</span>
              </div>
            </div>
          </div>

          {/* ── Tab navigation ── */}
          <div className="koma-stg-tabs" role="tablist" aria-label={t("settings.tabs.ariaLabel")}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`koma-stg-tab ${activeTab === tab.id ? "koma-stg-tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <TabIcon id={tab.icon} />
                <span className="koma-stg-tab__label">
                  {tab.id === "general"
                    ? t("settings.tabs.general")
                    : tab.id === "presets"
                      ? t("settings.tabs.presets")
                      : tab.id === "integrations"
                        ? t("settings.tabs.integrations")
                        : t("settings.tabs.app")}
                </span>
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="koma-stg-body" role="tabpanel">
            {tabContent[activeTab]()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
