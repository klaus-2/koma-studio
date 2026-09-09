import { type FormEvent, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Send, Trash2 } from 'lucide-react';

import type {
  ModelReviewFormPayload,
  ModelReviewItem,
  ModelReviewUsageContext,
} from '../../services/modelReviews';
import { useI18n } from '../../i18n';

interface ReviewComposerProps {
  modelId: string;
  modelName: string;
  initialReview: ModelReviewItem | null;
  loading: boolean;
  errorMessage: string | null;
  disabledReason: string | null;
  onSubmit: (payload: ModelReviewFormPayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

const ReviewComposer = ({
  modelId,
  modelName,
  initialReview,
  loading,
  errorMessage,
  disabledReason,
  onSubmit,
  onDelete,
  onClose,
}: ReviewComposerProps) => {
  const { t } = useI18n();

  const USAGE_OPTIONS: Array<{ value: ModelReviewUsageContext; label: string }> =
    [
      { value: 'balanced', label: t('ranking.composer.usage.balanced') },
      { value: 'quality_first', label: t('ranking.composer.usage.qualityFirst') },
      { value: 'speed_first', label: t('ranking.composer.usage.speedFirst') },
      { value: 'low_vram', label: t('ranking.composer.usage.lowVram') },
      { value: 'offline_local', label: t('ranking.composer.usage.offlineLocal') },
      { value: 'cloud_pipeline', label: t('ranking.composer.usage.cloudPipeline') },
    ];

  const SCORE_FIELDS: Array<{
    key: keyof Pick<
      ModelReviewFormPayload,
      | 'overallScore'
      | 'qualityScore'
      | 'speedScore'
      | 'costBenefitScore'
      | 'easeOfUseScore'
    >;
    label: string;
  }> = [
    { key: 'overallScore', label: t('ranking.metric.overall') },
    { key: 'qualityScore', label: t('ranking.metric.quality') },
    { key: 'speedScore', label: t('ranking.metric.speed') },
    { key: 'costBenefitScore', label: t('ranking.metric.costBenefit') },
    { key: 'easeOfUseScore', label: t('ranking.metric.easeOfUse') },
  ];

  const defaults = (r: ModelReviewItem | null): ModelReviewFormPayload => ({
    overallScore: r?.overallScore ?? 4,
    qualityScore: r?.qualityScore ?? 4,
    speedScore: r?.speedScore ?? 4,
    costBenefitScore: r?.costBenefitScore ?? 4,
    easeOfUseScore: r?.easeOfUseScore ?? 4,
    title: r?.title ?? '',
    reviewText: r?.reviewText ?? '',
    usageContext: r?.usageContext ?? 'balanced',
    sourceLanguage: r?.sourceLanguage ?? '',
    targetLanguage: r?.targetLanguage ?? '',
    deviceType: r?.deviceType ?? null,
  });

  const [form, setForm] = useState<ModelReviewFormPayload>(() =>
    defaults(initialReview),
  );
  useEffect(() => {
    setForm(defaults(initialReview));
  }, [initialReview, modelId]);

  const readOnly = disabledReason !== null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) return;
    await onSubmit({
      ...form,
      title: form.title?.trim() || null,
      reviewText: form.reviewText?.trim() || null,
      sourceLanguage: form.sourceLanguage?.trim() || null,
      targetLanguage: form.targetLanguage?.trim() || null,
    });
  };

  return (
    <form className="koma-rank-composer" onSubmit={handleSubmit}>
      <div className="koma-rank-composer__head">
        <div>
          <p className="koma-rank-composer__eyebrow">
            {initialReview ? t('ranking.composer.title.edit') : t('ranking.composer.title.new')}
          </p>
          <h3 className="koma-rank-composer__title">{modelName}</h3>
        </div>
        <button type="button" className="koma-rank-btn-ghost" onClick={onClose}>
          {t('ranking.composer.action.close')}
        </button>
      </div>

      {disabledReason ? (
        <div className="koma-rank-composer__notice" role="alert">
          {disabledReason}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="koma-rank-composer__error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {/* Score grid */}
      <div className="koma-rank-scores">
        {SCORE_FIELDS.map((field) => (
          <div key={field.key} className="koma-rank-score-field">
            <span className="koma-rank-score-field__label">{field.label}</span>
            <div className="koma-rank-score-btns">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={readOnly || loading}
                  className={`koma-rank-score-btn ${form[field.key] === s ? 'koma-rank-score-btn--active' : ''}`}
                  onClick={() => setForm((c) => ({ ...c, [field.key]: s }))}
                  aria-label={`${field.label}: ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Form fields */}
      <div className="koma-rank-form-grid">
        <label className="koma-rank-field">
          <span className="koma-rank-field__label">{t('ranking.composer.field.title')}</span>
          <input
            className="koma-rank-field__input"
            type="text"
            maxLength={80}
            value={form.title ?? ''}
            disabled={readOnly || loading}
            onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
            placeholder={t('ranking.composer.field.titlePlaceholder')}
          />
        </label>

        <label className="koma-rank-field">
          <span className="koma-rank-field__label">{t('ranking.composer.field.context')}</span>
          <select
            className="koma-rank-field__select"
            value={form.usageContext}
            disabled={readOnly || loading}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                usageContext: e.target.value as ModelReviewUsageContext,
              }))
            }
          >
            {USAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="koma-rank-field">
          <span className="koma-rank-field__label">{t('ranking.composer.field.sourceLang')}</span>
          <input
            className="koma-rank-field__input"
            type="text"
            value={form.sourceLanguage ?? ''}
            disabled={readOnly || loading}
            onChange={(e) =>
              setForm((c) => ({ ...c, sourceLanguage: e.target.value }))
            }
            placeholder={t('ranking.composer.field.sourceLangPlaceholder')}
          />
        </label>

        <label className="koma-rank-field">
          <span className="koma-rank-field__label">{t('ranking.composer.field.targetLang')}</span>
          <input
            className="koma-rank-field__input"
            type="text"
            value={form.targetLanguage ?? ''}
            disabled={readOnly || loading}
            onChange={(e) =>
              setForm((c) => ({ ...c, targetLanguage: e.target.value }))
            }
            placeholder={t('ranking.composer.field.targetLangPlaceholder')}
          />
        </label>

        <label className="koma-rank-field">
          <span className="koma-rank-field__label">{t('ranking.composer.field.device')}</span>
          <select
            className="koma-rank-field__select"
            value={form.deviceType ?? ''}
            disabled={readOnly || loading}
            onChange={(e) =>
              setForm((c) => ({
                ...c,
                deviceType: e.target.value
                  ? (e.target.value as 'cpu' | 'gpu' | 'cloud')
                  : null,
              }))
            }
          >
            <option value="">{t('ranking.composer.device.none')}</option>
            <option value="cpu">{t('modelCard.hardware.cpu')}</option>
            <option value="gpu">{t('modelCard.hardware.gpu')}</option>
            <option value="cloud">{t('ranking.discover.cloud')}</option>
          </select>
        </label>
      </div>

      <label className="koma-rank-field koma-rank-field--full">
        <span className="koma-rank-field__label">{t('ranking.composer.field.comment')}</span>
        <textarea
          className="koma-rank-field__textarea"
          rows={4}
          maxLength={1200}
          value={form.reviewText ?? ''}
          disabled={readOnly || loading}
          onChange={(e) =>
            setForm((c) => ({ ...c, reviewText: e.target.value }))
          }
          placeholder={t('ranking.composer.field.commentPlaceholder')}
        />
      </label>

      <div className="koma-rank-composer__actions">
        <button
          type="button"
          className="koma-rank-btn-ghost"
          disabled={loading}
          onClick={() => setForm(defaults(initialReview))}
        >
          <RotateCcw size={13} />
          {t('ranking.composer.action.reset')}
        </button>
        {initialReview ? (
          <button
            type="button"
            className="koma-rank-btn-danger"
            disabled={loading || readOnly}
            onClick={() => void onDelete()}
          >
            <Trash2 size={13} />
            {t('ranking.composer.action.delete')}
          </button>
        ) : null}
        <button
          type="submit"
          className="koma-rank-btn-primary"
          disabled={loading || readOnly}
        >
          {loading ? (
            <Loader2 size={14} className="koma-rank-spin" />
          ) : (
            <Send size={14} />
          )}
          {initialReview ? t('ranking.composer.action.save') : t('ranking.composer.action.publish')}
        </button>
      </div>
    </form>
  );
};

export { ReviewComposer };
