import { useMemo } from 'react';

import type { useI18n } from '../../../i18n';
import { SOURCE_LANGUAGE_OPTIONS, type AioLanguageOption } from '../../../models/aioStageCatalog';
import type {
  AioLanguageModelPreset,
  AioModelPresetStateV2,
} from '../../../types/aioModelPresets';
import { normalizeLanguageCode } from '../settings.constants';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseAioPresetGroupsArgs {
  t: TranslationFn;
  presetState: AioModelPresetStateV2;
  presetLanguageOptions: AioLanguageOption[];
}

export const useAioPresetGroups = ({
  t,
  presetState,
  presetLanguageOptions,
}: UseAioPresetGroupsArgs) => {
  const languageLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    SOURCE_LANGUAGE_OPTIONS.forEach((option) => {
      map.set(normalizeLanguageCode(option.value), t(option.label));
    });
    presetLanguageOptions.forEach((option) => {
      map.set(normalizeLanguageCode(option.value), t(option.label));
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

  return { languageLabelByCode, groupedPresets };
};
