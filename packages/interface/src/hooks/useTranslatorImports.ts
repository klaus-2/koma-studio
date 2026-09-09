import { useCallback } from 'react';

import { isDirectImageUploadFile } from '../utils/dashboard.utils';

interface UseTranslatorImportsArgs {
  onDrop: (files: File[]) => Promise<void>;
  setTranslatorDraftText: React.Dispatch<React.SetStateAction<string>>;
  setTranslatorTextDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setTranslatorWorkspaceMode: React.Dispatch<React.SetStateAction<'text' | 'visual'>>;
  setStatusMessage: (message: string) => void;
}

export function useTranslatorImports({
  onDrop,
  setTranslatorDraftText,
  setTranslatorTextDirty,
  setTranslatorWorkspaceMode,
  setStatusMessage,
}: UseTranslatorImportsArgs) {
  const handleTranslatorTextImport = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      setTranslatorDraftText(content);
      setTranslatorTextDirty(true);
      setStatusMessage(`Text "${file.name}" imported into the Translator.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to import the text into the Translator.');
    }
  }, [setStatusMessage, setTranslatorDraftText, setTranslatorTextDirty]);

  const handleTranslatorImageUpload = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []).filter(isDirectImageUploadFile);
    event.target.value = '';
    if (files.length === 0) {
      setStatusMessage('Select at least one PNG/JPG/WEBP image for the visual Translator.');
      return;
    }
    setTranslatorWorkspaceMode('visual');
    await onDrop(files);
  }, [onDrop, setStatusMessage, setTranslatorWorkspaceMode]);

  return {
    handleTranslatorTextImport,
    handleTranslatorImageUpload,
  };
}
