import { useI18n } from '../../i18n';
import { useUiShellStore } from '../../pages/dashboard/stores/ui-shell-store';

interface CleanerProcessingLabelProps {
  isAutomaticAi: boolean;
  isAiSfx: boolean;
}

/**
 * Self-subscribing progress leaf for the cleaner execute button: only this
 * label re-renders per cleaner progress tick, not the whole tools panel
 * (same pattern as the AIO panel's self-subscribing execute label).
 */
export const CleanerProcessingLabel = ({
  isAutomaticAi,
  isAiSfx,
}: CleanerProcessingLabelProps) => {
  const { t } = useI18n();
  const progress = useUiShellStore((s) => s.progress);

  return (
    <>
      <span className="auth-spinner" style={{ width: 14, height: 14 }} />
      {t('dashboard.cleaner.action.processing', {
        value: isAutomaticAi || isAiSfx
          ? (isAiSfx ? t('dashboard.cleaner.ai.sfxCleaner') : t('dashboard.cleaner.ai.automaticClean'))
          : t('dashboard.cleaner.modeTag'),
        percent: Math.round(progress),
      })}
    </>
  );
};

export default CleanerProcessingLabel;
