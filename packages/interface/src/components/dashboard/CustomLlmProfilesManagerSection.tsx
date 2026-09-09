import type { CustomLlmProfile, CustomLlmProfileDraft, CustomLlmStage } from '../../utils/customLlm';
import { useI18n } from '../../i18n';
import styles from './CustomLlmProfilesManagerSection.module.css';

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
  onUseExisting: () => void;
  onResetDraft: () => void;
  onRemoveDraft: () => Promise<void> | void;
  onSaveDraft: () => Promise<void> | void;
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

  if (!draft) {
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
            value={draft.id ?? ''}
            onChange={(event) => onLoadProfile(event.target.value)}
            className="koma-select"
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
          <button type="button" className={styles.secondaryButton} onClick={onUseExisting}>
            {useLabel}
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
            value={draft.label}
            onChange={(event) => onUpdateDraft({ label: event.target.value })}
            className="koma-input"
            placeholder={namePlaceholder}
          />
        </div>
        <div className="koma-field">
          <label className="koma-field__label">{t('dashboard.aio.customAi.model')}</label>
          <input
            type="text"
            value={draft.model}
            onChange={(event) => onUpdateDraft({ model: event.target.value })}
            className="koma-input"
            placeholder={modelPlaceholder}
          />
        </div>
        <div className={`${styles.fullRow} koma-field`}>
          <label className="koma-field__label">{t('dashboard.aio.customAi.apiBase')}</label>
          <input
            type="text"
            value={draft.apiBase}
            onChange={(event) => onUpdateDraft({ apiBase: event.target.value })}
            className="koma-input"
            placeholder={t('dashboard.aio.customAi.apiBasePlaceholder')}
          />
        </div>
        <div className={`${styles.fullRow} koma-field`}>
          <label className="koma-field__label">{t('dashboard.aio.customAi.apiKey')}</label>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(event) => onUpdateDraft({ apiKey: event.target.value })}
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
        <button type="button" className={styles.primaryButton} onClick={() => void onSaveDraft()}>
          {t('dashboard.aio.customAi.save')}
        </button>
      </div>
    </div>
  );
}
