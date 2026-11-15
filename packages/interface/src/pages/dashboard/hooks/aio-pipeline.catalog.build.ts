import { useEffect } from 'react';

import { buildUrl } from '@/config/api';
import { useI18n } from '@/i18n';
import {
  buildAioStageCatalog,
  mergeStageOptions,
  ocrStageOptionSupportsLanguage,
  parseTranslationServiceAvailability,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
} from '@/models/aioStageCatalog';
import type {
  AioStageOption,
  AioStageOptionMap,
} from '@/models/aioStageCatalog';
import type { ModelInstallState } from '@/models/types';
import {
  equalCatalogData,
  reconcileCatalog,
  reconcileSelections,
} from '@/pages/dashboard/hooks/aio-catalog.reconcile';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useLlmProvidersStore } from '@/pages/dashboard/stores/llm-providers-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import { isCustomModelSelectionKey } from '@/utils/customLlm';

interface UseAioStageCatalogBuildArgs {
  readonly customOcrStageOptions: readonly AioStageOption[];
  readonly customTranslationStageOptions: readonly AioStageOption[];
  readonly modelEntries: Readonly<Record<string, ModelInstallState>>;
}

function appendPendingOption(
  options: AioStageOption[],
  key: string | null | undefined,
  name: string,
  description: string,
): AioStageOption[] {
  if (
    !key ||
    !isCustomModelSelectionKey(key) ||
    options.some((option) => option.key === key)
  ) {
    return options;
  }

  return [
    ...options,
    {
      key,
      name,
      device: 'cloud',
      use_case: description,
      languages: ['multi'],
      available: false,
      implemented: true,
    },
  ];
}

// The backend is the only honest source for service-engine availability
// (a DeepL key or LibreTranslate URL configured in Settings → Integrations),
// so the store is hydrated once per session and every later catalog rebuild
// re-applies it. The static `available: false` stays the pre-fetch default.
let translationServiceAvailabilityHydrated = false;

function useAioTranslationServiceAvailabilitySync(mode: string): void {
  useEffect(() => {
    if (mode !== 'aio' || translationServiceAvailabilityHydrated) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(buildUrl('localUrl', '/translate/models'));
        if (!response.ok) {
          throw new Error(`translate models HTTP ${response.status}`);
        }
        const payload: unknown = await response.json();
        const availability = parseTranslationServiceAvailability(payload);
        if (!cancelled && availability !== null) {
          useAioPipelineStore
            .getState()
            .setAioTranslationServiceAvailability(availability);
        }
      } catch {
        // Fetch failure keeps the static defaults (engines stay unselectable).
      } finally {
        translationServiceAvailabilityHydrated = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);
}

export function useAioStageCatalogBuild({
  customOcrStageOptions,
  customTranslationStageOptions,
  modelEntries,
}: UseAioStageCatalogBuildArgs): void {
  const { t } = useI18n();
  const mode = useUiShellStore((state) => state.mode);
  const sourceLanguage = useAioPipelineStore((state) => state.aioSrcLang);
  const targetLanguage = useAioPipelineStore((state) => state.aioTgtLang);
  const customProfiles = useLlmProvidersStore(
    (state) => state.customLlmProfiles,
  );
  const pendingOcr = useLlmProvidersStore(
    (state) => state.pendingCustomSelections.ocr,
  );
  const pendingTranslation = useLlmProvidersStore(
    (state) => state.pendingCustomSelections.translation,
  );
  const translationServiceAvailability = useAioPipelineStore(
    (state) => state.aioTranslationServiceAvailability,
  );

  useAioTranslationServiceAvailabilitySync(mode);

  useEffect(() => {
    if (mode !== 'aio') return;

    try {
      const nextSourceLanguage = SOURCE_LANGUAGE_OPTIONS.some(
        (option) => option.value === sourceLanguage,
      )
        ? sourceLanguage
        : (SOURCE_LANGUAGE_OPTIONS[0]?.value ?? 'ja');

      const nextTargetLanguage = TARGET_LANGUAGE_OPTIONS.some(
        (option) => option.value === targetLanguage,
      )
        ? targetLanguage
        : (TARGET_LANGUAGE_OPTIONS[0]?.value ?? 'en');

      const built = buildAioStageCatalog({
        sourceLanguage: nextSourceLanguage,
        localModelEntries: modelEntries,
        customProfiles,
        translationServiceAvailability,
      });

      const options: AioStageOptionMap = {
        ...built,
        recognizeText: appendPendingOption(
          mergeStageOptions(
            built.recognizeText,
            customOcrStageOptions,
          ).filter((option) =>
            ocrStageOptionSupportsLanguage(option, nextSourceLanguage),
          ),
          pendingOcr,
          t('dashboard.status.pendingCustomOcrName'),
          t('dashboard.status.customProfileOcrPendingSync'),
        ),
        getTranslations: appendPendingOption(
          mergeStageOptions(
            built.getTranslations,
            customTranslationStageOptions,
          ),
          pendingTranslation,
          t('dashboard.status.pendingCustomTranslationName'),
          t('dashboard.status.customProfilePendingSync'),
        ),
      };

      const languageOptions = {
        source: [...SOURCE_LANGUAGE_OPTIONS],
        target: [...TARGET_LANGUAGE_OPTIONS],
      };

      useAioPipelineStore.setState((state) => {
        const nextOptions = reconcileCatalog(state.aioStageOptions, options);
        const nextLanguages = equalCatalogData(
          state.aioLanguageOptions,
          languageOptions,
        )
          ? state.aioLanguageOptions
          : languageOptions;
        const nextSelection = reconcileSelections(
          state.aioStageSelection,
          nextOptions,
          modelEntries,
        );

        if (
          nextOptions === state.aioStageOptions &&
          nextLanguages === state.aioLanguageOptions &&
          nextSelection === state.aioStageSelection &&
          nextSourceLanguage === state.aioSrcLang &&
          nextTargetLanguage === state.aioTgtLang &&
          !state.aioOptionsLoading
        ) {
          return state;
        }

        return {
          aioStageOptions: nextOptions,
          aioLanguageOptions: nextLanguages,
          aioStageSelection: nextSelection,
          aioSrcLang: nextSourceLanguage,
          aioTgtLang: nextTargetLanguage,
          aioOptionsLoading: false,
        };
      });
    } catch {
      useAioPipelineStore.setState({ aioOptionsLoading: false });

      throw new Error('AIO_CATALOG_BUILD_FAILED');
    }
  }, [
    customOcrStageOptions,
    customProfiles,
    customTranslationStageOptions,
    mode,
    modelEntries,
    pendingOcr,
    pendingTranslation,
    sourceLanguage,
    t,
    targetLanguage,
    translationServiceAvailability,
  ]);
}
