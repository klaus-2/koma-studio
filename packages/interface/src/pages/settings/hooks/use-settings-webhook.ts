import { useCallback, useState } from 'react';

import type { TranslationKey } from '../../../i18n/messages';
import type { useI18n } from '../../../i18n';
import {
  loadWebhookConfig,
  normalizeWebhookConfig,
  saveWebhookConfig,
  sendDiscordWebhookTest,
  validateDiscordWebhookUrl,
  type DiscordWebhookConfig,
  type DiscordWebhookEventKey,
} from '../../../services/discordWebhook';
import type { WebhookFeedbackState, WebhookTestStatus } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsWebhookArgs {
  t: TranslationFn;
}

export const useSettingsWebhook = ({ t }: UseSettingsWebhookArgs) => {
  // Lazy read: a mount effect filled this after paint, flashing the empty form
  // for one frame (react-doctor rendering-hydration-no-flicker).
  const [webhook, setWebhook] = useState<DiscordWebhookConfig>(() => loadWebhookConfig());
  const [webhookTestStatus, setWebhookTestStatus] = useState<WebhookTestStatus>("idle");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookFeedback, setWebhookFeedback] = useState<WebhookFeedbackState>(null);

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
        setWebhookFeedback({ type: "error", message: validation.error ? t(validation.error as TranslationKey) : t("settings.integrations.discord.error") });
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
      setWebhookFeedback({ type: "error", message: validation.error ? t(validation.error as TranslationKey) : t("settings.integrations.discord.invalidUrl") });
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

  return {
    webhook,
    webhookTestStatus,
    webhookSaved,
    webhookFeedback,
    updateWebhook,
    updateWebhookEvent,
    saveWebhook,
    testWebhook,
  };
};
