import { ArrowUpRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import type { ModelLeaderboardRow, RankingMetric } from "../../services/modelReviews";
import { useI18n } from "../../i18n";

interface LeaderboardTableProps {
  rows: ModelLeaderboardRow[];
  ranking: RankingMetric;
  selectedModelId: string | null;
  viewerReviewedModelIds: string[];
  onSelectModel: (modelId: string) => void;
}

export const LeaderboardTable = ({
  rows,
  ranking,
  selectedModelId,
  viewerReviewedModelIds,
  onSelectModel,
}: LeaderboardTableProps) => {
  const { t } = useI18n();

  const METRIC_LABELS: Record<RankingMetric, string> = {
    overall: t('ranking.metric.overall'),
    quality: t('ranking.metric.quality'),
    speed: t('ranking.metric.speed'),
    costBenefit: t('ranking.metric.costBenefit'),
    easeOfUse: t('ranking.metric.easeOfUse'),
  };

  const STAGE_LABELS: Record<ModelLeaderboardRow["stage"], string> = {
    translation: t('aio.stage.getTranslations'),
    detectText: t('aio.stage.detectText'),
    recognizeText: t('aio.stage.recognizeText'),
    segmentText: t('aio.stage.segmentText'),
    cleanImage: t('aio.stage.cleanImage'),
  };

  const formatScore = (value: number | null): string => (value === null ? "—" : `${value.toFixed(1)}`);

  const formatTrend = (value: number | null): string => {
    if (value === null || value === 0) {
      return t('ranking.trend.neutral');
    }

    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)} ${t('ranking.trend.points')}`;
  };

  return (
    <section className="koma-ranking-board koma-card koma-card--wide">
      <div className="koma-page-header">
        <div className="koma-page-header__info">
          <h2 className="koma-page-header__title">
            <Sparkles size={20} />
            {t('ranking.table.title')}
          </h2>
          <p className="koma-page-header__subtitle">
            {t('ranking.table.sortedBy', { metric: METRIC_LABELS[ranking].toLowerCase() })}
          </p>
        </div>
        <span className="koma-page-header__badge">
          {t('ranking.table.modelsCount', { count: rows.length })}
        </span>
      </div>

      <div className="koma-ranking-list" role="list">
        {rows.length === 0 ? (
          <div className="koma-ranking-empty">
            <p>{t('ranking.table.empty')}</p>
          </div>
        ) : (
          rows.map((row, index) => {
            const isSelected = row.modelId === selectedModelId;
            const isReviewedByViewer = viewerReviewedModelIds.includes(row.modelId);
            const trendIcon =
              row.trend30d === null || row.trend30d === 0 ? null : row.trend30d > 0 ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              );

            return (
              <button
                key={row.modelId}
                type="button"
                className={`koma-ranking-row ${isSelected ? "koma-ranking-row--active" : ""}`}
                onClick={() => onSelectModel(row.modelId)}
              >
                <div className="koma-ranking-row__rank">{index + 1}</div>

                <div className="koma-ranking-row__content">
                  <div className="koma-ranking-row__topline">
                    <div>
                      <h3>{row.modelName}</h3>
                      <div className="koma-ranking-row__badges">
                        <span>{STAGE_LABELS[row.stage]}</span>
                        <span>{row.sourceType === "local" ? t('ranking.discover.local') : t('ranking.discover.cloud')}</span>
                        {row.isNew ? <span className="koma-ranking-row__badge--new">{t('ranking.table.newLabel')}</span> : null}
                      </div>
                    </div>

                    <div className="koma-ranking-row__scoreblock">
                      <strong>{formatScore(row.weightedScores[ranking])}</strong>
                      <span>{METRIC_LABELS[ranking]}</span>
                    </div>
                  </div>

                  <div className="koma-ranking-row__meta">
                    <span>{t('ranking.table.reviewsCount', { count: row.reviewCount })}</span>
                    <span>{t('ranking.metric.quality')} {formatScore(row.averages.quality)}</span>
                    <span>{t('ranking.metric.speed')} {formatScore(row.averages.speed)}</span>
                    <span>{t('ranking.metric.costBenefit')} {formatScore(row.averages.costBenefit)}</span>
                  </div>

                  <div className="koma-ranking-row__footer">
                    <span className="koma-ranking-row__trend">
                      {trendIcon}
                      {formatTrend(row.trend30d)}
                    </span>
                    {isReviewedByViewer ? (
                      <span className="koma-ranking-row__mine">
                        {t('ranking.table.reviewedByYou')}
                      </span>
                    ) : null}
                    <span className="koma-ranking-row__cta">
                      {t('ranking.table.viewDetails')}
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};
