import { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';

import type {
  ModelLeaderboardFilters,
  RankingMetric,
} from '../../services/modelReviews';
import { useI18n } from '../../i18n';

interface RankingFiltersProps {
  ranking: RankingMetric;
  filters: ModelLeaderboardFilters;
  languageOptions: string[];
  onRankingChange: (metric: RankingMetric) => void;
  onFiltersChange: (patch: Partial<ModelLeaderboardFilters>) => void;
}

export const RankingFilters = ({
  ranking,
  filters,
  languageOptions,
  onRankingChange,
  onFiltersChange,
}: RankingFiltersProps) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const RANKING_TABS: Array<{ value: RankingMetric; label: string }> = [
    { value: 'overall', label: t('ranking.metric.overall') },
    { value: 'quality', label: t('ranking.metric.quality') },
    { value: 'speed', label: t('ranking.metric.speed') },
    { value: 'costBenefit', label: t('ranking.metric.costBenefit') },
    { value: 'easeOfUse', label: t('ranking.metric.easeOfUse') },
  ];

  const STAGE_OPTIONS: Array<{
    value: ModelLeaderboardFilters['stage'];
    label: string;
  }> = [
    { value: 'all', label: t('ranking.filters.allStages') },
    { value: 'translation', label: t('aio.stage.getTranslations') },
    { value: 'detectText', label: t('aio.stage.detectText') },
    { value: 'recognizeText', label: t('aio.stage.recognizeText') },
    { value: 'segmentText', label: t('aio.stage.segmentText') },
    { value: 'cleanImage', label: t('aio.stage.cleanImage') },
  ];

  const SOURCE_OPTIONS: Array<{
    value: ModelLeaderboardFilters['source'];
    label: string;
  }> = [
    { value: 'all', label: t('ranking.filters.allSources') },
    { value: 'local', label: t('ranking.filters.onlyLocal') },
    { value: 'cloud', label: t('ranking.filters.onlyCloud') },
  ];

  const countActiveFilters = (f: ModelLeaderboardFilters): number => {
    let count = 0;
    if (f.stage !== 'all') count++;
    if (f.source !== 'all') count++;
    if (f.language !== 'all') count++;
    if (f.minReviews !== 2) count++;
    return count;
  };

  const activeCount = countActiveFilters(filters);

  return (
    <section className="koma-rank-toolbar-wrap">
      <div className="koma-rank-toolbar">
        {/* Segmented tabs */}
        <div
          className="koma-rank-tabs"
          role="tablist"
          aria-label={t('ranking.filters.metricAria')}
        >
          {RANKING_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={ranking === tab.value}
              className={`koma-rank-tab ${ranking === tab.value ? 'koma-rank-tab--active' : ''}`}
              onClick={() => onRankingChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="koma-rank-search">
          <Search
            size={14}
            className="koma-rank-search__icon"
            aria-hidden="true"
          />
          <input
            type="search"
            className="koma-rank-search__input"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            placeholder={t('ranking.filters.searchPlaceholder')}
            aria-label={t('ranking.filters.searchAria')}
          />
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          className={`koma-rank-filter-toggle ${expanded ? 'koma-rank-filter-toggle--active' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={t('ranking.filters.advancedAria')}
        >
          <SlidersHorizontal size={14} />
          {t('ranking.filters.button')}
          {activeCount > 0 ? (
            <span className="koma-rank-filter-toggle__count">
              {activeCount}
            </span>
          ) : (
            <ChevronDown
              size={12}
              style={{
                transition: 'transform 0.2s ease',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          )}
        </button>
      </div>

      {/* Advanced filters */}
      <div
        className={`koma-rank-filters ${expanded ? '' : 'koma-rank-filters--hidden'}`}
      >
        <div className="koma-rank-filter">
          <span className="koma-rank-filter__label">{t('ranking.filters.stageLabel')}</span>
          <select
            className="koma-rank-filter__select"
            value={filters.stage}
            onChange={(e) =>
              onFiltersChange({
                stage: e.target.value as ModelLeaderboardFilters['stage'],
              })
            }
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="koma-rank-filter">
          <span className="koma-rank-filter__label">{t('ranking.filters.sourceLabel')}</span>
          <select
            className="koma-rank-filter__select"
            value={filters.source}
            onChange={(e) =>
              onFiltersChange({
                source: e.target.value as ModelLeaderboardFilters['source'],
              })
            }
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="koma-rank-filter">
          <span className="koma-rank-filter__label">{t('ranking.filters.languageLabel')}</span>
          <select
            className="koma-rank-filter__select"
            value={filters.language}
            onChange={(e) => onFiltersChange({ language: e.target.value })}
          >
            <option value="all">{t('ranking.filters.allLanguages')}</option>
            {languageOptions.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="koma-rank-filter">
          <span className="koma-rank-filter__label">{t('ranking.filters.minReviewsLabel')}</span>
          <select
            className="koma-rank-filter__select"
            value={String(filters.minReviews)}
            onChange={(e) =>
              onFiltersChange({ minReviews: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 5].map((v) => (
              <option key={v} value={v}>
                {v === 1 ? t('ranking.filters.reviews_one', { count: v }) : t('ranking.filters.reviews_other', { count: v })}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};
