import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { useUpdater } from "../hooks/useUpdater";
import { useI18n } from "../i18n";
import { useThemeStore } from "@koma/ui/stores/theme-store";

import { desktopBridge } from "@/lib/desktop-bridge";
import { renderSettingsAppTab } from "./settings/SettingsAppTabFacade";
import { renderSettingsIntegrationsTab } from "./settings/SettingsIntegrationsTabFacade";
import { renderSettingsPresetsTab } from "./settings/SettingsPresetsTabFacade";
import { renderSettingsGeneralTab } from "./settings/SettingsGeneralTabFacade";
import { SettingsPageShellClassic } from "./settings/SettingsPageShellClassic";
import { SettingsPageShellNoir } from "./settings/noir/SettingsPageShellNoir";
import { useAioPresets } from "./settings/hooks/use-aio-presets";
import { useRenderFontCatalog } from "./settings/hooks/use-render-font-catalog";
import { useRenderModePresets } from "./settings/hooks/use-render-mode-presets";
import { useTextFillSwatches } from "./settings/hooks/use-text-fill-swatches";
import { useTypographyPresets } from "./settings/hooks/use-typography-presets";
import { useSettingsAppPreferences } from "./settings/hooks/use-settings-app-preferences";
import { useSettingsBlogger } from "./settings/hooks/use-settings-blogger";
import { useSettingsImgur } from "./settings/hooks/use-settings-imgur";
import { useSettingsProfileVerification } from "./settings/hooks/use-settings-profile-verification";
import { useSettingsRuntimeInstall } from "./settings/hooks/use-settings-runtime-install";
import { useSettingsTravelToken } from "./settings/hooks/use-settings-travel-token";
import { useSettingsUpdaterControls } from "./settings/hooks/use-settings-updater-controls";
import { useSettingsWebhook } from "./settings/hooks/use-settings-webhook";
import type { SettingsPageProps, SettingsTab } from "./settings/settings.types";
import {
  SETTINGS_REQUESTED_TAB_STORAGE_KEY,
  formatRuntimeProfileLabel,
} from "./settings/settings.constants";
import './SettingsPresets.css';
import './SettingsIntegrations.css';

/* ─── Component ─────────────────────────────────────────── */

export const SettingsPage = ({ onBackDashboard }: SettingsPageProps) => {
  const { locale, localeLabels, setLocale, supportedLocales, systemLocales, t } = useI18n();
  const updater = useUpdater();
  const { user, isLoading: authLoading, sendVerificationEmail } = useAuth();
  const isDesktop = desktopBridge.isDesktopRuntime();

  /* state — core */
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  /* state — theme */
  const currentTheme = useThemeStore((s) => s.theme);
  const setCurrentTheme = useThemeStore((s) => s.setTheme);
  const currentFamily = useThemeStore((s) => s.family);
  const setCurrentFamily = useThemeStore((s) => s.setFamily);

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

  const dateLocale = locale.toLowerCase() === 'pt-br' ? 'pt-BR' : 'en-US';

  const fmtDate = useCallback((v: number | string | null): string => {
    if (!v) return "—";
    return new Date(v).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" });
  }, [dateLocale]);

  const travelDaysLabel = useCallback((v: number | null): string => {
    if (!v) return t("settings.travel.definedOnSend");
    return `${v} ${v === 1 ? t("settings.plan.day") : t("settings.plan.days")}`;
  }, [t]);

  const profileVerification = useSettingsProfileVerification({ sendVerificationEmail, t });
  const travelToken = useSettingsTravelToken({ user, isDesktop, t, fmtDate, travelDaysLabel });
  const updaterControls = useSettingsUpdaterControls({ updater, t });
  const appPreferences = useSettingsAppPreferences({ t });
  const runtimeInstall = useSettingsRuntimeInstall({ t });
  const webhook = useSettingsWebhook({ t });
  const blogger = useSettingsBlogger({ t });
  const imgur = useSettingsImgur({ t });
  const { presetFontOptions } = useRenderFontCatalog();
  const aio = useAioPresets({ t, userId: user?.id ?? null });
  const textFill = useTextFillSwatches({ t });
  const renderModePresets = useRenderModePresets({ t });
  const typographyPresets = useTypographyPresets({ t });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: GENERAL
     ═══════════════════════════════════════════════════════ */

  const renderGeneralTab = () =>
    renderSettingsGeneralTab({
      t,
      user,
      authLoading,
      isDesktop,
      ...profileVerification,
      ...travelToken,
      fmtDate,
      travelDaysLabel,
    });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: PRESETS
     ═══════════════════════════════════════════════════════ */

  const renderPresetsTab = () =>
    renderSettingsPresetsTab({
      t,
      aio,
      textFill,
      renderMode: {
        ...renderModePresets,
        renderModePresetFontOptions: presetFontOptions,
      },
      typography: {
        ...typographyPresets,
        typographyPresetFontOptions: presetFontOptions,
      },
    });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: INTEGRATIONS
     ═══════════════════════════════════════════════════════ */

  const renderIntegrationsTab = () =>
    renderSettingsIntegrationsTab({
      t,
      ...webhook,
      user,
      ...blogger,
      ...imgur,
      fmtDate,
    });

  /* ═══════════════════════════════════════════════════════
     RENDER — TAB: APP
     ═══════════════════════════════════════════════════════ */

  const renderAppTab = () =>
    renderSettingsAppTab({
      t,
      currentTheme,
      setCurrentTheme,
      currentFamily,
      setCurrentFamily,
      locale,
      localeLabels,
      setLocale,
      supportedLocales,
      systemLocales,
      updater,
      ...updaterControls,
      fmtDate,
      ...appPreferences,
      ...runtimeInstall,
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

  if (currentFamily === 'noir') {
    return (
      <SettingsPageShellNoir
        onBackDashboard={onBackDashboard}
        user={user}
        t={t}
        updater={updater}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabContent={tabContent}
      />
    );
  }

  return (
    <SettingsPageShellClassic
      onBackDashboard={onBackDashboard}
      initials={initials}
      user={user}
      t={t}
      updater={updater}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabContent={tabContent}
    />
  );
};

export default SettingsPage;
