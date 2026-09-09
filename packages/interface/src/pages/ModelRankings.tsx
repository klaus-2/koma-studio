import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BarChart3, Crown, Gauge, ShieldCheck, Trophy } from 'lucide-react';

import { ModelDetailPanel } from '../components/model-rankings/ModelDetailPanel';
import { LeaderboardTable } from '../components/model-rankings/LeaderboardTable';
import { RankingFilters } from '../components/model-rankings/RankingFilters';
import { ReviewComposer } from '../components/model-rankings/ReviewComposer';
import {
  findOfficialModelCatalogEntry,
  listOfficialCatalogLanguages,
  OFFICIAL_MODEL_CATALOG,
  officialModelMatchesLanguage,
  type OfficialModelCatalogEntry,
} from '../models/officialModelCatalog';
import { useAuth } from '../hooks/useAuth';
import {
  createModelReviewsClient,
  type ModelLeaderboardFilters,
  type ModelReviewFormPayload,
  type RankingMetric,
} from '../services/modelReviews';
import {
  useModelReviewDetailQuery,
  useModelReviewMutations,
  useModelReviewsLeaderboardQuery,
} from '../query/modelReviews';
import { useI18n } from '../i18n';

import './ModelRankings.css';

interface ModelRankingsPageProps {
  onBackDashboard: () => void;
}

const DEFAULT_FILTERS: ModelLeaderboardFilters = {
  ranking: 'overall',
  stage: 'all',
  source: 'all',
  language: 'all',
  search: '',
  minReviews: 2,
  limit: 25,
};

const readSelectedModelFromHash = (): string | null => {
  if (typeof window === 'undefined') return null;
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(hashQuery).get('model')?.trim() || null;
};

const writeSelectedModelToHash = (modelId: string | null): void => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  if (modelId) params.set('model', modelId);
  else params.delete('model');
  const query = params.toString();
  window.location.hash = query ? `/model-rankings?${query}` : '/model-rankings';
};

const matchesCatalogFilters = (
  model: OfficialModelCatalogEntry,
  filters: ModelLeaderboardFilters,
  search: string,
): boolean => {
  if (filters.stage !== 'all' && model.stage !== filters.stage) return false;
  if (filters.source !== 'all' && model.sourceType !== filters.source)
    return false;
  if (
    filters.language !== 'all' &&
    !officialModelMatchesLanguage(model, filters.language)
  )
    return false;
  if (search.length > 0) {
    const haystack =
      `${model.name} ${model.description} ${model.id}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
};

export const ModelRankingsPage = ({
  onBackDashboard,
}: ModelRankingsPageProps) => {
  const { user, getAuthToken, refreshSession, sendVerificationEmail } =
    useAuth();
  const { t } = useI18n();
  const client = useMemo(
    () => createModelReviewsClient({ getAuthToken, refreshSession }),
    [getAuthToken, refreshSession],
  );

  const [filters, setFilters] =
    useState<ModelLeaderboardFilters>(DEFAULT_FILTERS);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(() =>
    readSelectedModelFromHash(),
  );
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reviewMutationError, setReviewMutationError] = useState<string | null>(
    null,
  );
  const [verificationSending, setVerificationSending] = useState(false);
  const [composerMode, setComposerMode] = useState<
    'closed' | 'create' | 'edit'
  >('closed');
  const [detailPage, setDetailPage] = useState(1);

  const deferredSearch = useDeferredValue(filters.search);
  const languageOptions = useMemo(() => listOfficialCatalogLanguages(), []);

  const effectiveFilters = useMemo(
    () => ({ ...filters, search: deferredSearch }),
    [deferredSearch, filters],
  );
  const filtersKey = useMemo(
    () => JSON.stringify(effectiveFilters),
    [effectiveFilters],
  );

  const selectedModel = useMemo(
    () =>
      selectedModelId ? findOfficialModelCatalogEntry(selectedModelId) : null,
    [selectedModelId],
  );

  const leaderboardQuery = useModelReviewsLeaderboardQuery(
    client,
    effectiveFilters,
    filtersKey,
  );

  const detailQuery = useModelReviewDetailQuery(
    client,
    selectedModelId,
    detailPage,
    10,
  );

  const leaderboardData = leaderboardQuery.data ?? null;
  const detailData = detailQuery.data ?? null;
  const leaderboardLoading = leaderboardQuery.isLoading || leaderboardQuery.isFetching;
  const detailLoading = detailQuery.isLoading || detailQuery.isFetching;

  useEffect(() => {
    if (!leaderboardQuery.error) {
      setLeaderboardError(null);
      return;
    }
    setLeaderboardError(
      leaderboardQuery.error instanceof Error
        ? leaderboardQuery.error.message
        : t('ranking.error.loadFailed'),
    );
  }, [leaderboardQuery.error, t]);

  useEffect(() => {
    if (!detailQuery.error) {
      setDetailError(null);
      return;
    }
    setDetailError(
      detailQuery.error instanceof Error
        ? detailQuery.error.message
        : t('ranking.error.loadDetailFailed'),
    );
  }, [detailQuery.error, t]);

  useEffect(() => {
    if (!leaderboardData) return;
    const hashSelected = readSelectedModelFromHash();
    const preferredId =
      (hashSelected && findOfficialModelCatalogEntry(hashSelected)
        ? hashSelected
        : null) ??
      (selectedModelId && findOfficialModelCatalogEntry(selectedModelId)
        ? selectedModelId
        : null) ??
      leaderboardData.leaderboard[0]?.modelId ??
      OFFICIAL_MODEL_CATALOG[0]?.id ??
      null;
    setSelectedModelId(preferredId);
  }, [leaderboardData, selectedModelId]);

  useEffect(() => {
    const sync = () => {
      const id = readSelectedModelFromHash();
      if (id && findOfficialModelCatalogEntry(id)) {
        setSelectedModelId(id);
        setDetailPage(1);
        setComposerMode('closed');
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    setDetailPage(1);
    setComposerMode('closed');
    setReviewMutationError(null);
  }, [selectedModelId]);

  const reviewedModelIds = useMemo(
    () => new Set(leaderboardData?.reviewedModelIds ?? []),
    [leaderboardData?.reviewedModelIds],
  );

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const modelsWithoutReviews = useMemo(
    () =>
      OFFICIAL_MODEL_CATALOG.filter(
        (m) =>
          !reviewedModelIds.has(m.id) &&
          matchesCatalogFilters(m, filters, normalizedSearch),
      ),
    [filters, normalizedSearch, reviewedModelIds],
  );

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setDetailPage(1);
    setComposerMode('closed');
    writeSelectedModelToHash(modelId);
  };

  const {
    upsertReviewMutation,
    deleteReviewMutation,
    refreshCurrentModel,
  } = useModelReviewMutations(
    client,
    selectedModelId,
    filtersKey,
  );

  const handleSubmitReview = async (payload: ModelReviewFormPayload) => {
    if (!selectedModelId) return;
    setReviewMutationError(null);
    try {
      await upsertReviewMutation.mutateAsync(payload);
      await refreshCurrentModel(selectedModelId, 1);
      setDetailPage(1);
      setComposerMode('closed');
    } catch (error) {
      setReviewMutationError(
        error instanceof Error ? error.message : t('ranking.error.saveReviewFailed'),
      );
    }
  };

  const handleDeleteReview = async () => {
    if (!selectedModelId) return;
    setReviewMutationError(null);
    try {
      await deleteReviewMutation.mutateAsync();
      await refreshCurrentModel(selectedModelId, 1);
      setDetailPage(1);
      setComposerMode('closed');
    } catch (error) {
      setReviewMutationError(
        error instanceof Error ? error.message : t('ranking.error.deleteReviewFailed'),
      );
    }
  };

  const handleSendVerification = async () => {
    setVerificationSending(true);
    try {
      await sendVerificationEmail();
    } finally {
      setVerificationSending(false);
    }
  };

  const bestOverall = leaderboardData?.globalStats.bestOverallModelId
    ? findOfficialModelCatalogEntry(
        leaderboardData.globalStats.bestOverallModelId,
      )
    : null;
  const bestCost = leaderboardData?.globalStats.bestCostBenefitModelId
    ? findOfficialModelCatalogEntry(
        leaderboardData.globalStats.bestCostBenefitModelId,
      )
    : null;

  return (
    <div className="koma-rank-page">
      <div className="koma-rank-page__bg" aria-hidden="true" />
      <div className="koma-rank-page__halftone" aria-hidden="true" />
      <div
        className="koma-rank-page__orb koma-rank-page__orb--purple"
        aria-hidden="true"
      />
      <div
        className="koma-rank-page__orb koma-rank-page__orb--cyan"
        aria-hidden="true"
      />
      <span className="koma-rank-sfx koma-rank-sfx--tl" aria-hidden="true">
        쾅
      </span>
      <span className="koma-rank-sfx koma-rank-sfx--br" aria-hidden="true">
        휙
      </span>

      <div className="koma-rank-page__container">
        <button
          type="button"
          className="koma-rank-back"
          onClick={onBackDashboard}
        >
          ← {t('ranking.backToDashboard')}
        </button>

        {/* ── Hero ── */}
        <section className="koma-rank-hero">
          <div className="koma-rank-hero__left">
            <div className="koma-rank-hero__icon" aria-hidden="true">
              <Trophy size={20} />
            </div>
            <div>
              <h1 className="koma-rank-hero__title">{t('ranking.hero.title')}</h1>
              <p className="koma-rank-hero__subtitle">
                {t('ranking.hero.subtitle')}
              </p>
            </div>
          </div>

          <div className="koma-rank-stats" aria-label={t('ranking.hero.globalStatsAria')}>
            <div className="koma-rank-stat">
              <div className="koma-rank-stat__icon koma-rank-stat__icon--purple">
                <BarChart3 size={13} />
              </div>
              <div className="koma-rank-stat__text">
                <span className="koma-rank-stat__value">
                  {leaderboardData?.globalStats.reviewedModelCount ?? 0}
                </span>
                <span className="koma-rank-stat__label">{t('ranking.hero.models')}</span>
              </div>
            </div>
            <div className="koma-rank-stat">
              <div className="koma-rank-stat__icon koma-rank-stat__icon--cyan">
                <Gauge size={13} />
              </div>
              <div className="koma-rank-stat__text">
                <span className="koma-rank-stat__value">
                  {leaderboardData?.globalStats.totalReviewCount ?? 0}
                </span>
                <span className="koma-rank-stat__label">{t('ranking.hero.reviews')}</span>
              </div>
            </div>
            <div className="koma-rank-stat">
              <div className="koma-rank-stat__icon koma-rank-stat__icon--amber">
                <Crown size={13} />
              </div>
              <div className="koma-rank-stat__text">
                <span className="koma-rank-stat__value">
                  {bestOverall?.name ?? '—'}
                </span>
                <span className="koma-rank-stat__label">{t('ranking.hero.bestOverall')}</span>
              </div>
            </div>
            <div className="koma-rank-stat">
              <div className="koma-rank-stat__icon koma-rank-stat__icon--emerald">
                <ShieldCheck size={13} />
              </div>
              <div className="koma-rank-stat__text">
                <span className="koma-rank-stat__value">
                  {bestCost?.name ?? '—'}
                </span>
                <span className="koma-rank-stat__label">{t('ranking.hero.costBenefit')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Filters ── */}
        <RankingFilters
          ranking={filters.ranking}
          filters={filters}
          languageOptions={languageOptions}
          onRankingChange={(metric: RankingMetric) =>
            setFilters((c) => ({ ...c, ranking: metric }))
          }
          onFiltersChange={(patch) => setFilters((c) => ({ ...c, ...patch }))}
        />

        {leaderboardError ? (
          <div className="koma-rank-error" role="alert">
            {leaderboardError}
          </div>
        ) : null}
        {leaderboardLoading ? (
          <div className="koma-rank-loading" role="status">
            <div className="koma-rank-loading__spinner" />
            {t('ranking.loading')}
          </div>
        ) : null}

        {/* ── Main layout ── */}
        <div className="koma-rank-layout">
          <LeaderboardTable
            rows={leaderboardData?.leaderboard ?? []}
            ranking={filters.ranking}
            selectedModelId={selectedModelId}
            viewerReviewedModelIds={
              leaderboardData?.viewerReviewedModelIds ?? []
            }
            onSelectModel={handleSelectModel}
          />

          <ModelDetailPanel
            model={selectedModel}
            detail={detailData}
            loading={detailLoading}
            errorMessage={detailError}
            emailVerified={Boolean(user?.emailVerified)}
            verificationSending={verificationSending}
            onStartReview={() => setComposerMode('create')}
            onEditReview={() => setComposerMode('edit')}
            onSendVerificationEmail={handleSendVerification}
            onPageChange={setDetailPage}
            composer={
              composerMode !== 'closed' && selectedModel ? (
                <ReviewComposer
                  modelId={selectedModel.id}
                  modelName={selectedModel.name}
                  initialReview={
                    composerMode === 'edit'
                      ? (detailData?.currentUserReview ?? null)
                      : null
                  }
                  loading={upsertReviewMutation.isPending || deleteReviewMutation.isPending}
                  errorMessage={reviewMutationError}
                  disabledReason={
                    user?.emailVerified
                      ? null
                      : t('ranking.error.emailVerificationRequired')
                  }
                  onSubmit={handleSubmitReview}
                  onDelete={handleDeleteReview}
                  onClose={() => setComposerMode('closed')}
                />
              ) : null
            }
          />
        </div>

        {/* ── Discover ── */}
        <section className="koma-rank-discover">
          <div className="koma-rank-discover__header">
            <div>
              <h2 className="koma-rank-discover__title">
                <ShieldCheck size={17} />
                {t('ranking.discover.title')}
              </h2>
              <p className="koma-rank-discover__subtitle">
                {t('ranking.discover.subtitle')}
              </p>
            </div>
            <span className="koma-rank-discover__count">
              {t('ranking.discover.available', { count: modelsWithoutReviews.length })}
            </span>
          </div>

          <div className="koma-rank-discover__scroll">
            {modelsWithoutReviews.length === 0 ? (
              <div className="koma-rank-discover__empty">
                {t('ranking.discover.empty')}
              </div>
            ) : (
              modelsWithoutReviews.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className="koma-rank-discover__card"
                  onClick={() => handleSelectModel(model.id)}
                >
                  <p className="koma-rank-discover__card-name">{model.name}</p>
                  <p className="koma-rank-discover__card-desc">
                    {model.description}
                  </p>
                  <div className="koma-rank-discover__card-pills">
                    <span className="koma-rank-discover__card-pill">
                      {model.stageLabel}
                    </span>
                    <span className="koma-rank-discover__card-pill">
                      {model.sourceType === 'local' ? t('ranking.discover.local') : t('ranking.discover.cloud')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
