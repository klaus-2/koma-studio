import { useCallback } from 'react';

interface EnhanceModelLike {
  id: string;
  name: string;
}

interface UseEnhanceInstallActionArgs {
  selectedEnhanceModel: EnhanceModelLike | null;
  installTranslationModel: (modelId: string) => Promise<void>;
  refreshModelState: () => Promise<void>;
  setEnhanceActionBusy: (value: boolean) => void;
  setStatusMessage: (value: string) => void;
}

export function useEnhanceInstallAction({
  selectedEnhanceModel,
  installTranslationModel,
  refreshModelState,
  setEnhanceActionBusy,
  setStatusMessage,
}: UseEnhanceInstallActionArgs) {
  return useCallback(async () => {
    if (!selectedEnhanceModel) return;
    setEnhanceActionBusy(true);
    try {
      await installTranslationModel(selectedEnhanceModel.id);
      await refreshModelState();
      setStatusMessage(`Model "${selectedEnhanceModel.name}" installed successfully.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to install the enhancement model.');
    } finally {
      setEnhanceActionBusy(false);
    }
  }, [
    installTranslationModel,
    refreshModelState,
    selectedEnhanceModel,
    setEnhanceActionBusy,
    setStatusMessage,
  ]);
}
