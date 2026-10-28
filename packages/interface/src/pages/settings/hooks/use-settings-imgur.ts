import { useCallback, useEffect, useState } from 'react';

import type { useI18n } from '../../../i18n';
import { loadImgurConfig, saveImgurConfig } from '../../../services/imgur';
import { DEFAULT_IMGUR_CONFIG, type ImgurConfig, type ImgurRateLimitStatus } from '../../../types';
import type { BloggerFeedbackState } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseSettingsImgurArgs {
  t: TranslationFn;
}

export const useSettingsImgur = ({ t }: UseSettingsImgurArgs) => {
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

  return {
    imgurConfig,
    imgurSecureStorage,
    imgurSaved,
    imgurFeedback,
    imgurRateLimit,
    updateImgurConfig,
    addImgurKey,
    updateImgurKey,
    removeImgurKey,
    handleSaveImgurConfig,
  };
};
