import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

import type { CustomLlmProfile, CustomLlmProfileDraft, CustomLlmStage } from '../../utils/customLlm';
import { useI18n } from '../../i18n';
import styles from './CustomLlmProfilesManagerSection.module.css';

const FLASH_RESET_MS = 1800;

const draftsEqual = (
  left: CustomLlmProfileDraft | null | undefined,
  right: CustomLlmProfileDraft | null,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.id === right.id &&
    left.label === right.label &&
    left.apiBase === right.apiBase &&
    left.apiKey === right.apiKey &&
    left.model === right.model
  );
};

interface CustomLlmProfilesManagerSectionProps {
  stage: CustomLlmStage;
  profiles: CustomLlmProfile[];
  draft: CustomLlmProfileDraft | undefined;
  loading: boolean;
  error: string | null;
  persistenceHint: string;
  providerNotice: string | null;
  titleOverride?: string;
  emptyLabelOverride?: string;
  namePlaceholderOverride?: string;
  modelPlaceholderOverride?: string;
  useLabelOverride?: string;
  onLoadProfile: (profileId: string) => void;
  onUpdateDraft: (patch: Partial<CustomLlmProfileDraft>) => void;
  onUseExisting: () => boolean | void;
  onResetDraft: () => void;
  onRemoveDraft: () => Promise<void> | void;
  onSaveDraft: () => Promise<boolean> | boolean | void;
  onApplyOllamaPreset?: () => void;
}

export default function CustomLlmProfilesManagerSection({
  stage,
  profiles,
  draft,
  loading,
  error,
  persistenceHint,
  providerNotice,
  titleOverride,
  emptyLabelOverride,
  namePlaceholderOverride,
  modelPlaceholderOverride,
  useLabelOverride,
  onLoadProfile,
  onUpdateDraft,
  onUseExisting,
  onResetDraft,
  onRemoveDraft,
  onSaveDraft,
  onApplyOllamaPreset,
}: CustomLlmProfilesManagerSectionProps) {
  const { t } = useI18n();
  const isTranslation = stage === 'translation';
  const title = titleOverride ?? (isTranslation ? t('dashboard.aio.customAi.titleTranslation') : t('dashboard.aio.customAi.titleOcr'));
  const emptyLabel = emptyLabelOverride ?? (isTranslation ? t('dashboard.aio.customAi.newTranslation') : t('dashboard.aio.customAi.newOcr'));
  const namePlaceholder = namePlaceholderOverride ?? (isTranslation ? t('dashboard.aio.customAi.placeholderTranslation') : t('dashboard.aio.customAi.placeholderOcr'));
  const modelPlaceholder = modelPlaceholderOverride ?? (isTranslation ? t('dashboard.aio.customAi.modelPlaceholderTranslation') : t('dashboard.aio.customAi.modelPlaceholderOcr'));
  const useLabel = useLabelOverride ?? (isTranslation ? t('dashboard.aio.customAi.useTranslation') : t('dashboard.aio.customAi.useOcr'));

  const [savePending, setSavePending] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [usedFlash, setUsedFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);

  // The draft lives locally: keystrokes never touch the llm-providers store
  // (and therefore never re-render the Dashboard page). The store only sees
  // the draft at commit points — save/use — and on external loads, which the
  // effect below adopts unless it is the echo of our own commit.
  const [localDraft, setLocalDraft] = useState<CustomLlmProfileDraft | null>(draft ?? null);
  const lastPushedRef = useRef<CustomLlmProfileDraft | null>(null);

  useEffect(() => {
    if (draftsEqual(draft, lastPushedRef.current)) {
      return;
    }
    lastPushedRef.current = null;
    setLocalDraft(draft ?? null);
  }, [draft]);

  const commitLocalDraft = (): void => {
    if (!localDraft || draftsEqual(localDraft, lastPushedRef.current)) {
      return;
    }
    onUpdateDraft(localDraft);
    lastPushedRef.current = localDraft;
  };

  useEffect(() => () => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
  }, []);

  const scheduleFlashReset = () => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setSavedFlash(false);
      setUsedFlash(false);
    }, FLASH_RESET_MS);
  };

  const handleSave = async () => {
    if (savePending) return;
    setSavePending(true);
    try {
      commitLocalDraft();
      const ok = await onSaveDraft();
      if (ok !== false) {
        setSavedFlash(true);
        scheduleFlashReset();
      }
    } finally {
      setSavePending(false);
    }
  };

  const handleUseExisting = () => {
    commitLocalDraft();
    const ok = onUseExisting();
    if (ok !== false) {
      setUsedFlash(true);
      scheduleFlashReset();
    }
  };

  if (!localDraft) {
    return (
      <div className="mb-3 space-y-2">
        <p className="koma-field__label">{title}</p>
        <p className="koma-field__hint">Draft not initialized for this stage.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <p className="koma-field__label">{title}</p>
          <p className={styles.hint}>{persistenceHint}</p>
        </div>
        <button type="button" className={styles.newButton} onClick={onResetDraft}>
          {emptyLabel}
        </button>
      </div>

      {loading ? <p className={styles.hint}>{t('dashboard.aio.customAi.loading')}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.profileRow}>
        <div className="koma-field">
          <label className="koma-field__label">{t('dashboard.aio.customAi.savedProfile')}</label>
          <select
            value={localDraft.id ?? ''}
            onChange={(event) => onLoadProfile(event.target.value)}
            className="panel-cut-sm w-full appearance-none border border-paper/12 bg-ink px-2.5 py-1.5 font-mono text-[11px] uppercase text-paper/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson"
          >
            <option value="">{emptyLabel}</option>
            {profiles.map((profile) => (
              <option key={`${stage}-profile-${profile.id}`} value={profile.id}>
                {profile.label} ({profile.model})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.profileRowActions}>
          <button
            type="button"
            className={usedFlash ? `${styles.secondaryButton} ${styles.secondaryButtonFlash}` : styles.secondaryButton}
            onClick={handleUseExisting}
          >
            {usedFlash ? <Check size={12} aria-hidden /> : null}
            {usedFlash ? t('dashboard.aio.customAi.inUse') : useLabel}
          </button>
          <button type="button" className={styles.dangerButton} onClick={() => void onRemoveDraft()}>
            {t('dashboard.aio.customAi.remove')}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className="koma-field">
          <label className="koma-field__label">{t('dashboard.aio.customAi.name')}</label>
          <input
            type="text"
            value={localDraft.label}
            onChange={(event) => setLocalDraft((prev) => (prev ? { ...prev, label: event.target.value } : prev))}
            className="koma-input"
            placeholder={namePlaceholder}
          />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('dashboard.aio.customAi.model')}</label>
          <input
            type="text"
            value={localDraft.model}
            onChange={(event) => setLocalDraft((prev) => (prev ? { ...prev, model: event.target.value } : prev))}
            className="koma-input"
            placeholder={modelPlaceholder}
          />
        </div>
        <div className={`${styles.fullRow} koma-field`}>
          <label className="koma-field__label">{t('dashboard.aio.customAi.apiBase')}</label>
          <input
            type="text"
            value={localDraft.apiBase}
            onChange={(event) => setLocalDraft((prev) => (prev ? { ...prev, apiBase: event.target.value } : prev))}
            className="koma-input"
            placeholder={t('dashboard.aio.customAi.apiBasePlaceholder')}
          />
        </div>
        <div className={`${styles.fullRow} koma-field`}>
          <label className="koma-field__label">{t('dashboard.aio.customAi.apiKey')}</label>
          <input
            type="password"
            value={localDraft.apiKey}
            onChange={(event) => setLocalDraft((prev) => (prev ? { ...prev, apiKey: event.target.value } : prev))}
            className="koma-input"
            placeholder={t('dashboard.aio.customAi.apiKeyPlaceholder')}
          />
        </div>
      </div>

      {providerNotice ? <p className={styles.hint}>{providerNotice}</p> : null}

      <div className={styles.actions}>
        {onApplyOllamaPreset ? (
          <button type="button" className={styles.secondaryButton} onClick={onApplyOllamaPreset}>
            {t('dashboard.aio.customAi.ollamaPreset')}
          </button>
        ) : null}
        <button type="button" className={styles.secondaryButton} onClick={onResetDraft}>
          {t('dashboard.aio.customAi.clear')}
        </button>
        <button
          type="button"
          className={savedFlash ? `${styles.primaryButton} ${styles.primaryButtonFlash}` : styles.primaryButton}
          onClick={() => void handleSave()}
          disabled={savePending}
        >
          {savePending
            ? t('customProvider.action.saving')
            : savedFlash
              ? t('dashboard.aio.customAi.saved')
              : t('dashboard.aio.customAi.save')}
          {savedFlash && !savePending ? <Check size={12} aria-hidden /> : null}
        </button>
      </div>
    </div>
  );
}
