import type { ReactNode } from 'react';

import { useI18n } from '../../../i18n';
import { useCleanerStore } from '../stores/cleaner-store';
import { useStatusStore } from '../stores/status-store';
import CleanerAiRecognizeTextModelManagerModal from '../../../components/ModelManagerModal/CleanerAiRecognizeTextModelManagerModal';

interface CleanerAiRecognizeTextModelManagerModalSectionProps {
  /* ── Manager section memos (multi-store derived; selector candidates in T12) ── */
  freeProviderSection: ReactNode;
  customProfilesSection: ReactNode;
  defaultLanguageFilter: string;

  /* ── Cleaner hook (not yet migrated) ── */
  selectCleanerAiModel: (modelKey: string) => void;
}

/**
 * Automatic AI Clean model manager modal view (the block after
 * DashboardModelManagers). Reads the cleaner/status stores and forwards the
 * manager section memos the page computes.
 */
export default function CleanerAiRecognizeTextModelManagerModalSection({
  freeProviderSection,
  customProfilesSection,
  defaultLanguageFilter,
  selectCleanerAiModel,
}: CleanerAiRecognizeTextModelManagerModalSectionProps) {
  const { t } = useI18n();
  const cleanerAiModelManagerOpen = useCleanerStore(
    (s) => s.cleanerAiModelManagerOpen,
  );
  const setCleanerAiModelManagerOpen = useCleanerStore(
    (s) => s.setCleanerAiModelManagerOpen,
  );
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  return (
    <CleanerAiRecognizeTextModelManagerModal
      open={cleanerAiModelManagerOpen}
      entries={{}}
      freeProviderSection={freeProviderSection}
      customProfilesSection={customProfilesSection}
      diskSpace={null}
      installedCount={0}
      totalCount={0}
      updatesCount={0}
      installedSizeBytes={0}
      checkingRemoteUpdates={false}
      lastRemoteCheckAt={null}
      defaultLanguageFilter={defaultLanguageFilter}
      focusedModelId={null}
      selectedModelId={cleanerAiModelKey}
      batch={{ active: false, total: 0, completed: 0, cancelled: false }}
      installAllSummary={{ totalBytes: 0, requiredBytes: 0, eligibleModelIds: [] }}
      onClose={() => setCleanerAiModelManagerOpen(false)}
      onSetLanguageFilter={() => {}}
      onInstallModel={async () => {}}
      onUpdateModel={async () => {}}
      onUninstallModel={async () => {}}
      onRetryModel={async () => {}}
      onCancelModel={async () => {}}
      onSelectModel={(modelKey) => {
        selectCleanerAiModel(modelKey);
        setStatusMessage(t('dashboard.status.aiCleanModelSelected', { model: modelKey }));
      }}
      onInstallAll={async () => {}}
      onCancelAll={async () => {}}
      onCheckUpdatesNow={async () => {}}
    />
  );
}
