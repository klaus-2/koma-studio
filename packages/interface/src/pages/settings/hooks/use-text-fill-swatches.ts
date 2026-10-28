import { useCallback, useEffect, useState } from 'react';

import type { useI18n } from '../../../i18n';
import {
  addTextFillSwatch,
  DEFAULT_SOLID_TEXT_FILL_SWATCHES,
  loadTextFillSwatchState,
  removeTextFillSwatch,
  resetTextFillSwatches,
  saveTextFillSwatchState,
  type TextFillSwatchStateV1,
} from '../../../utils/textFillPicker';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface UseTextFillSwatchesArgs {
  t: TranslationFn;
}

export const useTextFillSwatches = ({ t }: UseTextFillSwatchesArgs) => {
  const [textFillSwatches, setTextFillSwatches] = useState<TextFillSwatchStateV1>(() => loadTextFillSwatchState());
  const [textFillDraftValue, setTextFillDraftValue] = useState<string>(DEFAULT_SOLID_TEXT_FILL_SWATCHES[0] ?? "#111111");
  const [textFillFeedback, setTextFillFeedback] = useState<string | null>(null);
  const [textFillError, setTextFillError] = useState<string | null>(null);

  useEffect(() => {
    saveTextFillSwatchState(textFillSwatches);
  }, [textFillSwatches]);

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

  return {
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
  };
};
