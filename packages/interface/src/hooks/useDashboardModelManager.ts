import { useCallback, useState } from 'react';

import type { AioStageKey } from '../types/aioModelPresets';

interface UseDashboardModelManagerArgs {
  sourceLanguage: string;
  openModelManager: (args?: { language?: string; focusedModelId?: string | null }) => void;
  closeModelManager: () => void;
}

export function useDashboardModelManager({
  sourceLanguage,
  openModelManager,
  closeModelManager,
}: UseDashboardModelManagerArgs) {
  const [activeModelManagerStage, setActiveModelManagerStage] = useState<AioStageKey>('getTranslations');
  const [enhanceModelManagerOpen, setEnhanceModelManagerOpen] = useState(false);

  const openModelManagerForStage = useCallback(
    (stage: AioStageKey, args?: { language?: string; focusedModelId?: string | null }) => {
      setActiveModelManagerStage(stage);
      openModelManager({
        language: args?.language ?? sourceLanguage,
        focusedModelId: args?.focusedModelId ?? null,
      });
    },
    [openModelManager, sourceLanguage],
  );

  const closeModelManagerForStage = useCallback(() => {
    closeModelManager();
    setActiveModelManagerStage('getTranslations');
  }, [closeModelManager]);

  return {
    activeModelManagerStage,
    enhanceModelManagerOpen,
    setEnhanceModelManagerOpen,
    openModelManagerForStage,
    closeModelManagerForStage,
  };
}
