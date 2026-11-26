import { useCallback, useMemo, useState, type MouseEvent } from 'react';

import { desktopBridge } from "@/lib/desktop-bridge";
import { SETTINGS_REQUESTED_TAB_STORAGE_KEY } from '../constants/dashboard.constants';
import { KOMA_GITHUB_REPO_URL } from '../components/onboarding/onboardingSteps';
import type { SettingsTab } from '../pages/settings/settings.types';

interface UseDashboardExternalActionsArgs {
  onOpenSettings?: () => void;
}

export function useDashboardExternalActions({ onOpenSettings }: UseDashboardExternalActionsArgs) {
  const [shortcutCenterOpen, setShortcutCenterOpen] = useState(false);
  const [bugReportModalOpen, setBugReportModalOpen] = useState(false);

  const openSettingsOnTab = useCallback(
    (tab: SettingsTab) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SETTINGS_REQUESTED_TAB_STORAGE_KEY, tab);
      }
      onOpenSettings?.();
    },
    [onOpenSettings],
  );

  const openSettingsOnPresetsTab = useCallback(() => {
    openSettingsOnTab('presets');
  }, [openSettingsOnTab]);

  const openSettingsOnIntegrationsTab = useCallback(() => {
    openSettingsOnTab('integrations');
  }, [openSettingsOnTab]);

  const openSettingsOnRuntimeTab = useCallback(() => {
    openSettingsOnTab('runtime');
  }, [openSettingsOnTab]);

  const toExternalUrl = useCallback((rawUrl: string): string => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }, []);

  const projectWebsiteUrl = useMemo(
    () => toExternalUrl((import.meta.env.VITE_PROJECT_WEBSITE_URL as string | undefined)?.trim() || 'https://koma-studio.site'),
    [toExternalUrl],
  );

  const projectDiscordUrl = useMemo(
    () => toExternalUrl((import.meta.env.VITE_PROJECT_DISCORD_URL as string | undefined)?.trim() || 'https://discord.gg/tzaV2efD4e'),
    [toExternalUrl],
  );

  const projectGithubUrl = useMemo(
    () => toExternalUrl((import.meta.env.VITE_PROJECT_GITHUB_URL as string | undefined)?.trim() || KOMA_GITHUB_REPO_URL),
    [toExternalUrl],
  );

  const projectBugReportUrl = useMemo(
    () =>
      toExternalUrl((import.meta.env.VITE_PROJECT_BUG_URL as string | undefined)?.trim() || '')
      || `${projectWebsiteUrl.replace(/\/+$/, '')}/support`,
    [projectWebsiteUrl, toExternalUrl],
  );

  const openExternalInBrowser = useCallback((targetUrl: string): void => {
    const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    popup?.focus();
  }, []);

  const openProjectExternalLink = useCallback(async (event: MouseEvent<HTMLElement>, targetUrl: string) => {
    event.preventDefault();
    const normalizedUrl = toExternalUrl(targetUrl);
    if (!normalizedUrl) return;

    try {
      const openExternal = desktopBridge.desktop?.openExternal;
      if (typeof openExternal === 'function') {
        await openExternal(normalizedUrl);
        return;
      }
      openExternalInBrowser(normalizedUrl);
    } catch {
      openExternalInBrowser(normalizedUrl);
    }
  }, [openExternalInBrowser, toExternalUrl]);

  const openBugReportModal = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    const hasDesktopBugReportBridge =
      typeof window !== 'undefined' &&
      typeof desktopBridge.desktop?.api?.bugReport?.prepare === 'function' &&
      typeof desktopBridge.desktop?.api?.bugReport?.submit === 'function';

    if (hasDesktopBugReportBridge) {
      setBugReportModalOpen(true);
      return;
    }

    void openProjectExternalLink(event, projectBugReportUrl);
  }, [openProjectExternalLink, projectBugReportUrl]);

  const openShortcutCenter = useCallback(() => {
    setShortcutCenterOpen(true);
  }, []);

  const closeShortcutCenter = useCallback(() => {
    setShortcutCenterOpen(false);
  }, []);

  return {
    shortcutCenterOpen,
    bugReportModalOpen,
    setBugReportModalOpen,
    openSettingsOnTab,
    openSettingsOnPresetsTab,
    openSettingsOnIntegrationsTab,
    openSettingsOnRuntimeTab,
    projectWebsiteUrl,
    projectDiscordUrl,
    projectGithubUrl,
    projectBugReportUrl,
    openProjectExternalLink,
    openBugReportModal,
    openShortcutCenter,
    closeShortcutCenter,
  };
}
