import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareQuote,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useI18n } from '../../i18n';

import type { OfficialModelCatalogEntry } from '../../models/officialModelCatalog';
import type { ModelReviewDetailResponse } from '../../services/modelReviews';

interface ModelDetailPanelProps {
  model: OfficialModelCatalogEntry | null;
  detail: ModelReviewDetailResponse | null;
  loading: boolean;
  errorMessage: string | null;
  emailVerified: boolean;
  verificationSending: boolean;
  onStartReview: () => void;
  onEditReview: () => void;
  onSendVerificationEmail: () => Promise<void>;
  onPageChange: (page: number) => void;
  composer: ReactNode;
}

const fmt = (v: number | null): string => (v === null ? '—' : v.toFixed(1));

export const ModelDetailPanel = ({
  model,
  detail,
  loading,
  errorMessage,
  emailVerified,
  verificationSending,
  onStartReview,
  onEditReview,
  onSendVerificationEmail,
  onPageChange,
  composer,
}: ModelDetailPanelProps) => {
  const { t } = useI18n();

  const fmtDate = (v: string | null): string => {
    if (!v) return '—';
    return new Date(v).toLocaleString(t('settings.language.label') === 'Language' ? 'en-US' : 'pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const USAGE_LABELS: Record<string, string> = {
    balanced: t('modelDetail.usage.balanced'),
    quality_first: t('modelDetail.usage.quality_first'),
    speed_first: t('modelDetail.usage.speed_first'),
    low_vram: t('modelDetail.usage.low_vram'),
    offline_local: t('modelDetail.usage.offline_local'),
    cloud_pipeline: t('modelDetail.usage.cloud_pipeline'),
  };

  const METRICS: Array<{
    key: 'quality' | 'speed' | 'costBenefit' | 'easeOfUse';
    label: string;
  }> = [
    { key: 'quality', label: t('modelDetail.metrics.quality') },
    { key: 'speed', label: t('modelDetail.metrics.speed') },
    { key: 'costBenefit', label: t('modelDetail.metrics.costBenefit') },
    { key: 'easeOfUse', label: t('modelDetail.metrics.easeOfUse') },
  ];

  if (!model) {
    return (
      <aside className="koma-rank-detail">
        <div className="koma-rank-detail__empty">
          {t('modelDetail.empty')}
        </div>
      </aside>
    );
  }

  const agg = detail?.aggregate ?? null;
  const currentReview = detail?.currentUserReview ?? null;
  const overallScore = agg?.weightedScores.overall ?? null;
  const trend = agg?.trend30d ?? null;

  return (
    <aside
      className="koma-rank-detail"
      style={{ animation: 'koma-rank-detail-in 0.25s ease forwards' }}
    >
      {/* Header */}
      <div className="koma-rank-detail__header">
        <div className="koma-rank-detail__header-top">
          <h2 className="koma-rank-detail__model-name">{model.name}</h2>
          <span className="koma-rank-detail__source-badge">
            {model.sourceType === 'local' ? t('modelDetail.source.local') : t('modelDetail.source.cloud')}
          </span>
        </div>
        <p className="koma-rank-detail__desc">{model.description}</p>
      </div>

      {/* Score hero */}
      <div className="koma-rank-score-hero">
        <div
          className="koma-rank-score-hero__ring"
          aria-label={t('modelDetail.score.aria', { score: fmt(overallScore) })}
        >
          <div className="koma-rank-score-hero__ring-bg" aria-hidden="true" />
          <div className="koma-rank-score-hero__ring-fill" aria-hidden="true" />
          <div className="koma-rank-score-hero__number">
            <span className="koma-rank-score-hero__value">
              {fmt(overallScore)}
            </span>
            <span className="koma-rank-score-hero__label">{t('modelDetail.score.label')}</span>
          </div>
        </div>
        <div className="koma-rank-score-hero__side">
          <span className="koma-rank-score-hero__reviews">
            {(agg?.reviewCount ?? 0) === 1 ? t('modelDetail.reviews.count_one', { count: agg?.reviewCount ?? 0 }) : t('modelDetail.reviews.count_other', { count: agg?.reviewCount ?? 0 })}
          </span>
          {trend !== null && trend !== 0 ? (
            <span
              className={`koma-rank-score-hero__trend ${
                trend > 0
                  ? 'koma-rank-score-hero__trend--up'
                  : 'koma-rank-score-hero__trend--down'
              }`}
            >
              {trend > 0 ? (
                <TrendingUp size={13} />
              ) : (
                <TrendingDown size={13} />
              )}
              {trend > 0 ? t('modelDetail.trend.up', { trend: trend.toFixed(1) }) : t('modelDetail.trend.down', { trend: trend.toFixed(1) })}
            </span>
          ) : (
            <span className="koma-rank-score-hero__trend">
              {t('modelDetail.trend.neutral')}
            </span>
          )}
          <div className="koma-rank-score-hero__pills">
            <span className="koma-rank-score-hero__pill">
              {model.stageLabel}
            </span>
            <span className="koma-rank-score-hero__pill">
              {model.runtimeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Metric bars */}
      <div className="koma-rank-metrics">
        {METRICS.map((m) => {
          const val = agg?.weightedScores[m.key] ?? null;
          const pct = val !== null ? `${(val / 5) * 100}%` : '0%';
          return (
            <div key={m.key} className="koma-rank-metric">
              <span className="koma-rank-metric__label">{m.label}</span>
              <div className="koma-rank-metric__bar">
                <div
                  className="koma-rank-metric__fill"
                  style={{ width: pct }}
                />
              </div>
              <span className="koma-rank-metric__value">{fmt(val)}</span>
            </div>
          );
        })}
      </div>

      {/* Distribution */}
      <div className="koma-rank-distro">
        <h3 className="koma-rank-info__section-title">{t('modelDetail.distro.title')}</h3>
        <div className="koma-rank-distro__rows">
          {(['5', '4', '3', '2', '1'] as const).map((key) => {
            const total = agg?.reviewCount ?? 0;
            const count = agg?.distribution[key] ?? 0;
            const w = total > 0 ? `${(count / total) * 100}%` : '0%';
            return (
              <div key={key} className="koma-rank-distro__row">
                <span className="koma-rank-distro__star">{key}★</span>
                <div className="koma-rank-distro__bar">
                  <span
                    className="koma-rank-distro__fill"
                    style={{ width: w }}
                  />
                </div>
                <span className="koma-rank-distro__count">{count}</span>
              </div>
            );
          })}
        </div>
        <div className="koma-rank-distro__footer">
          <span>{t('modelDetail.distro.lastReview', { date: fmtDate(agg?.lastReviewedAt ?? null) })}</span>
        </div>
      </div>

      {/* Info */}
      <div className="koma-rank-info">
        <h3 className="koma-rank-info__section-title">{t('modelDetail.info.title')}</h3>
        <p className="koma-rank-info__notes">
          {model.notes ?? t('modelDetail.info.noNotes')}
        </p>
        <div className="koma-rank-info__langs">
          <div className="koma-rank-info__lang-group">
            <strong>{t('modelDetail.info.source')}</strong>
            <span>{model.sourceLanguages.join(', ')}</span>
          </div>
          <div className="koma-rank-info__lang-group">
            <strong>{t('modelDetail.info.target')}</strong>
            <span>{model.targetLanguages.join(', ')}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="koma-rank-actions">
        <button
          type="button"
          className="koma-rank-btn-primary"
          onClick={currentReview ? onEditReview : onStartReview}
        >
          <Star size={14} />
          {currentReview ? t('modelDetail.actions.editReview') : t('modelDetail.actions.startReview')}
        </button>
        {!emailVerified ? (
          <button
            type="button"
            className="koma-rank-btn-ghost"
            disabled={verificationSending}
            onClick={() => void onSendVerificationEmail()}
          >
            <ShieldAlert size={14} />
            {verificationSending ? t('modelDetail.actions.sending') : t('modelDetail.actions.verifyEmail')}
          </button>
        ) : null}
      </div>

      {/* Warning */}
      {!emailVerified ? (
        <div className="koma-rank-warning" role="alert">
          <ShieldAlert size={15} />
          <p>{t('modelDetail.warning.verifyEmail')}</p>
        </div>
      ) : null}

      {/* Composer slot */}
      {composer}

      {/* Reviews */}
      <div className="koma-rank-reviews">
        <div className="koma-rank-reviews__header">
          <h3 className="koma-rank-reviews__title">{t('modelDetail.recentReviews.title')}</h3>
        </div>

        {loading ? (
          <div className="koma-rank-loading" role="status">
            <div className="koma-rank-loading__spinner" />
            {t('modelDetail.recentReviews.loading')}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="koma-rank-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {!loading && !errorMessage && detail?.reviews.length === 0 ? (
          <div className="koma-rank-empty">
            <p>{t('modelDetail.recentReviews.empty')}</p>
          </div>
        ) : null}

        <div className="koma-rank-reviews__list">
          {!loading && detail
            ? detail.reviews.map((review) => (
                <article key={review.id} className="koma-rank-review">
                  <div className="koma-rank-review__head">
                    <div>
                      <h4 className="koma-rank-review__author">
                        {review.title ?? review.reviewerLabel}
                      </h4>
                      <p className="koma-rank-review__context">
                        {review.reviewerLabel} ·{' '}
                        {USAGE_LABELS[review.usageContext] ??
                          review.usageContext}
                      </p>
                    </div>
                    <span className="koma-rank-review__score">
                      {review.overallScore}/5
                    </span>
                  </div>
                  {review.reviewText ? (
                    <p className="koma-rank-review__body">
                      {review.reviewText}
                    </p>
                  ) : null}
                  <div className="koma-rank-review__meta">
                    <span className="koma-rank-review__meta-tag">
                      {review.sourceLanguage
                        ? review.sourceLanguage.toUpperCase()
                        : '—'}{' '}
                      →{' '}
                      {review.targetLanguage
                        ? review.targetLanguage.toUpperCase()
                        : '—'}
                    </span>
                    <span className="koma-rank-review__meta-tag">
                      {review.deviceType
                        ? review.deviceType.toUpperCase()
                        : 'N/A'}
                    </span>
                    <span className="koma-rank-review__meta-tag">
                      {fmtDate(review.updatedAt)}
                    </span>
                  </div>
                </article>
              ))
            : null}
        </div>

        {detail && detail.pagination.totalPages > 1 ? (
          <div className="koma-rank-pagination">
            <button
              type="button"
              className="koma-rank-btn-ghost"
              disabled={detail.pagination.page <= 1}
              onClick={() => onPageChange(detail.pagination.page - 1)}
              aria-label={t('modelDetail.pagination.prev')}
            >
              <ChevronLeft size={13} />
              {t('modelDetail.pagination.prev')}
            </button>
            <span className="koma-rank-pagination__info">
              <MessageSquareQuote size={13} />
              {detail.pagination.page} / {detail.pagination.totalPages}
            </span>
            <button
              type="button"
              className="koma-rank-btn-ghost"
              disabled={detail.pagination.page >= detail.pagination.totalPages}
              onClick={() => onPageChange(detail.pagination.page + 1)}
              aria-label={t('modelDetail.pagination.next')}
            >
              {t('modelDetail.pagination.next')}
              <ChevronRight size={13} />
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
