import { useCallback, useEffect, useState } from 'react';

import { buildUrl } from '../../../config/api';
import type { useI18n } from '../../../i18n';
import { parseTranslationServiceAvailability } from '../../../models/aioStageCatalog';
import { useAioPipelineStore } from '../../../pages/dashboard/stores/aio-pipeline-store';
import type { BloggerFeedbackState } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export interface TranslationProviderSettings {
  libretranslateUrl: string;
  libretranslateApiKey: string;
  deeplApiKey: string;
}

const EMPTY_PROVIDERS: TranslationProviderSettings = {
  libretranslateUrl: '',
  libretranslateApiKey: '',
  deeplApiKey: '',
};

export interface UseSettingsTranslationProvidersArgs {
  t: TranslationFn;
}

/**
 * The dashboard hydrates service availability once per session, so a key
 * saved here would otherwise leave DeepL/LibreTranslate unselectable in the
 * AIO picker until restart. Best-effort: on failure the backend still holds
 * the truth and the next session rehydrates from it, so the save-success
 * flow is kept intact.
 */
async function refreshTranslationServiceAvailability(): Promise<void> {
  try {
    const response = await fetch(buildUrl('localUrl', '/translate/models'));
    if (!response.ok) {
      throw new Error(`translate models HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    const availability = parseTranslationServiceAvailability(payload);
    if (availability !== null) {
      useAioPipelineStore
        .getState()
        .setAioTranslationServiceAvailability(availability);
    }
  } catch {
    // Availability refresh is silent by design; the save was already reported.
  }
}

/**
 * Loads and persists the backend-side translation provider configuration
 * (`/translate/provider-config`); the session header is injected by the
 * shell's fetch wrapper. Values live in the mini-backend store, so both
 * desktop shells share them.
 */
export const useSettingsTranslationProviders = ({ t }: UseSettingsTranslationProvidersArgs) => {
  // Lazy defaults: a mount effect fills this after the backend answers.
  const [providers, setProviders] = useState<TranslationProviderSettings>(() => EMPTY_PROVIDERS);
  const [providersSaved, setProvidersSaved] = useState(false);
  const [providersFeedback, setProvidersFeedback] = useState<BloggerFeedbackState>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(buildUrl('localUrl', '/translate/provider-config'));
        if (!response.ok) {
          throw new Error(`provider config HTTP ${response.status}`);
        }
        const data: unknown = await response.json();
        if (!isRecord(data) || !isRecord(data.providerConfig)) {
          throw new Error('invalid provider config payload');
        }
        if (cancelled) {
          return;
        }
        setProviders({
          libretranslateUrl: asString(data.providerConfig.libretranslate_url),
          libretranslateApiKey: asString(data.providerConfig.libretranslate_api_key),
          deeplApiKey: asString(data.providerConfig.deepl_api_key),
        });
      } catch {
        if (!cancelled) {
          setProvidersFeedback({
            type: 'error',
            message: t('settings.integrations.translation.loadError'),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const updateTranslationProvider = useCallback(
    <K extends keyof TranslationProviderSettings>(key: K, value: string) => {
      setProviders((prev) => ({ ...prev, [key]: value }));
      setProvidersSaved(false);
      setProvidersFeedback(null);
    },
    [],
  );

  const saveTranslationProviders = useCallback(async () => {
    try {
      const response = await fetch(buildUrl('localUrl', '/translate/provider-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libretranslate_url: providers.libretranslateUrl.trim() || null,
          libretranslate_api_key: providers.libretranslateApiKey.trim() || null,
          deepl_api_key: providers.deeplApiKey.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error(`provider config HTTP ${response.status}`);
      }
      setProvidersSaved(true);
      setProvidersFeedback({
        type: 'success',
        message: t('settings.integrations.saved'),
      });
      setTimeout(() => setProvidersSaved(false), 3000);
      void refreshTranslationServiceAvailability();
    } catch {
      setProvidersSaved(false);
      setProvidersFeedback({
        type: 'error',
        message: t('settings.integrations.translation.saveError'),
      });
    }
  }, [providers, t]);

  return {
    providers,
    providersSaved,
    providersFeedback,
    updateTranslationProvider,
    saveTranslationProviders,
  };
};
