import { useCallback, useMemo } from 'react';

import { useI18n } from '../i18n';
import { getModeLabels } from '../constants/dashboard.constants';
import type { DashboardUser, WebhookMetrics, ToolMode } from '../types/dashboard.types';
import type { DiscordActivityPreset } from '../types';
import { sanitizeWebhookErrorMessage } from '../utils/dashboard.utils';
import { sendDiscordWebhookEvent } from '../services/discordWebhook';

interface AuthLikeUser {
  name?: string | null;
  email?: string | null;
  emailVerified?: boolean;
}

interface UseDashboardUsageAndPresenceArgs {
  authUser: AuthLikeUser | null;
  authLoading: boolean;
  user: DashboardUser;
  mode: ToolMode;
  processing: boolean;
  activeImageFileName?: string;
  imagesLength: number;
  translatorWorkspaceMode: 'text' | 'visual';
  srcLang: string;
  tgtLang: string;
  setStatusMessage: (message: string) => void;
  setDiscordPreset: (preset: DiscordActivityPreset, overrides?: Record<string, unknown>) => Promise<void>;
}

export function useDashboardUsageAndPresence({
  authUser,
  authLoading,
  user,
  mode,
  processing,
  activeImageFileName,
  imagesLength,
  translatorWorkspaceMode,
  srcLang,
  tgtLang,
  setStatusMessage,
  setDiscordPreset,
}: UseDashboardUsageAndPresenceArgs) {
  const { t } = useI18n();
  const modeLabels = useMemo(() => getModeLabels(t), [t]);

  const userDisplayName = useMemo(() => {
    if (authUser?.name && authUser.name.trim().length > 0) return authUser.name;
    if (authUser?.email) return authUser.email.split('@')[0];
    if (user.name) return user.name;
    return authLoading ? t('app.transition.loading') : t('dashboard.user.defaultName');
  }, [authLoading, authUser?.email, authUser?.name, t, user.name]);

  const userDisplayEmail = useMemo(() => {
    if (authUser?.email) return authUser.email;
    if (user.email) return user.email;
    return authLoading ? t('app.transition.loading').toLowerCase() : t('verify.noEmail');
  }, [authLoading, authUser?.email, t, user.email]);

  const emailVerificationRequired = useMemo(
    () => Boolean(authUser && !authUser.emailVerified),
    [authUser],
  );

  const ensureVerifiedEmailOrNotify = useCallback((): boolean => {
    if (!emailVerificationRequired) return true;
    setStatusMessage(t('dashboard.status.verifyEmailRequired'));
    return false;
  }, [emailVerificationRequired, setStatusMessage, t]);

  const emitProcessStartWebhook = useCallback((processMode: string, pages: number, metrics: WebhookMetrics = {}) => {
    void sendDiscordWebhookEvent('processStart', {
      mode: processMode,
      pages,
      metrics,
    });
  }, []);

  const emitProcessCompleteWebhook = useCallback((processMode: string, pages: number, metrics: WebhookMetrics = {}) => {
    void sendDiscordWebhookEvent('processComplete', {
      mode: processMode,
      pages,
      metrics,
    });
  }, []);

  const emitProcessErrorWebhook = useCallback(
    (processMode: string, pages: number, error: unknown, metrics: WebhookMetrics = {}) => {
      void sendDiscordWebhookEvent('processError', {
        mode: processMode,
        pages,
        error: sanitizeWebhookErrorMessage(error),
        metrics,
      });
    },
    [],
  );

  const syncDiscordForTab = useCallback(async () => {
    if (!authUser || processing) return;
    const currentFileName =
      activeImageFileName ??
      (imagesLength > 0
        ? t('dashboard.status.imagesCount', { count: imagesLength })
        : t('dashboard.status.noImage'));
    if (mode === 'organize') {
      await setDiscordPreset('workspace_organize_mode', {
        details: t('discord.presence.workspace.details' as any),
        state: userDisplayName,
      });
      return;
    }
    if (mode === 'guides') {
      await setDiscordPreset('guides_tutorials');
      return;
    }
    if (mode === 'resources') {
      await setDiscordPreset('resources_materials');
      return;
    }
    if (mode === 'cleaner') {
      await setDiscordPreset('cleaner_redraw_mode', {
        details: t('discord.presence.cleaner.details' as any),
        state: t('discord.presence.cleaner.state.basic' as any),
      });
      return;
    }
    if (mode === 'translator') {
      await setDiscordPreset('translator_mode', {
        details: t('discord.presence.translator.fileDetails' as any, {
          fileName:
            translatorWorkspaceMode === 'text' ? t('dashboard.status.freeText') : currentFileName,
        }),
        state: `${srcLang} -> ${tgtLang}`,
      });
      return;
    }
    const presetByMode: Partial<Record<ToolMode, DiscordActivityPreset>> = {
      aio: 'aio_pipeline_automatic',
      typesetter: 'typesetter_mode',
      raw: 'raw_provider_mode',
      proofreader: 'proofreader_qc_mode',
      stitch: 'stitcher_mode',
      split: 'splitter_mode',
      watermark: 'watermark_mode',
      enhance: 'enhance_mode',
      optimizer: 'chapter_optimizer_mode',
      blogger: 'blogger_cdn_mode',
      imgur: 'image_upload_mode',
    };
    const preset = presetByMode[mode] ?? 'batch_mode';
    const tabLabel = modeLabels[mode];
    await setDiscordPreset(preset, {
      details: `${tabLabel} - ${currentFileName}`,
      state: tabLabel,
    });
  }, [
    activeImageFileName,
    authUser,
    imagesLength,
    mode,
    processing,
    setDiscordPreset,
    srcLang,
    tgtLang,
    t,
    translatorWorkspaceMode,
    modeLabels,
    userDisplayName,
  ]);

  return {
    userDisplayName,
    userDisplayEmail,
    emailVerificationRequired,
    ensureVerifiedEmailOrNotify,
    emitProcessStartWebhook,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    syncDiscordForTab,
  };
}
