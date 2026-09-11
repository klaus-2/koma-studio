import type { ProcessableMode } from '../../../types/dashboard.types';
import { copyTextToClipboardSafe } from '../../../utils/dashboard.utils';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import TranslatorTextStage from '../../../components/dashboard/TranslatorTextStage';

interface TranslatorTextStageSectionProps {
  /* ── Refs + page callbacks (not store-backed) ── */
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  runTranslatorText: () => void | Promise<void>;
  handleDownload: (scope?: ProcessableMode | null) => Promise<void> | void;
  handleTranslatorTextImport: React.ChangeEventHandler<HTMLInputElement>;
}

/**
 * Translator text stage view (the `translator && translatorWorkspaceMode ===
 * 'text'` stage branch). Reads the translator/shell/status stores and
 * forwards the same-name props the page previously passed.
 */
export default function TranslatorTextStageSection({
  translatorTextImportRef,
  runTranslatorText,
  handleDownload,
  handleTranslatorTextImport,
}: TranslatorTextStageSectionProps) {
  const translatorDraftText = useTranslatorStore((s) => s.translatorDraftText);
  const setTranslatorDraftText = useTranslatorStore(
    (s) => s.setTranslatorDraftText,
  );
  const setTranslatorTranslatedText = useTranslatorStore(
    (s) => s.setTranslatorTranslatedText,
  );
  const setTranslatorTextDirty = useTranslatorStore(
    (s) => s.setTranslatorTextDirty,
  );
  const translatorTextRunning = useTranslatorStore(
    (s) => s.translatorTextRunning,
  );
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const translatorTextDirty = useTranslatorStore((s) => s.translatorTextDirty);
  const setTranslatorLastTextModelUsed = useTranslatorStore(
    (s) => s.setTranslatorLastTextModelUsed,
  );
  const translatorLastTextModelUsed = useTranslatorStore(
    (s) => s.translatorLastTextModelUsed,
  );
  const processing = useUiShellStore((s) => s.processing);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return (
    <TranslatorTextStage
      translatorDraftText={translatorDraftText}
      setTranslatorDraftText={setTranslatorDraftText}
      setTranslatorTranslatedText={setTranslatorTranslatedText}
      setTranslatorTextDirty={setTranslatorTextDirty}
      translatorTextImportRef={translatorTextImportRef}
      translatorTextRunning={translatorTextRunning}
      processing={processing}
      runTranslatorText={async () => {
        await runTranslatorText();
      }}
      translatorTranslatedText={translatorTranslatedText ?? ''}
      translatorTextDirty={translatorTextDirty ?? false}
      copyTextToClipboardSafe={(text) => {
        void copyTextToClipboardSafe(text);
      }}
      setStatusMessage={setStatusMessage}
      handleDownload={(scope) => {
        void handleDownload(scope as ProcessableMode | null);
      }}
      setTranslatorLastTextModelUsed={setTranslatorLastTextModelUsed}
      translatorLastTextModelUsed={translatorLastTextModelUsed}
      handleTranslatorTextImport={handleTranslatorTextImport}
    />
  );
}
