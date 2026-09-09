import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db/client.js";
import { modelReview, user } from "../db/schema.js";
import {
  filterModelReviewCatalog,
  getModelReviewCatalogEntry,
  type ModelReviewCatalogEntry,
  type ModelReviewSourceType,
  type ModelReviewStage,
} from "./model-review-catalog.js";
import { tServer } from "./server-i18n.js";

export type ModelReviewRankingMetric =
  | "overall"
  | "quality"
  | "speed"
  | "costBenefit"
  | "easeOfUse";

export type ModelReviewUsageContext =
  | "balanced"
  | "quality_first"
  | "speed_first"
  | "low_vram"
  | "offline_local"
  | "cloud_pipeline";

export type ModelReviewDeviceType = "cpu" | "gpu" | "cloud";

export interface ModelReviewQueryFilters {
  ranking: ModelReviewRankingMetric;
  stage: "all" | ModelReviewStage;
  source: "all" | ModelReviewSourceType;
  language: string;
  search: string;
  minReviews: number;
  limit: number;
}

export interface ModelReviewMutationInput {
  overallScore: number;
  qualityScore: number;
  speedScore: number;
  costBenefitScore: number;
  easeOfUseScore: number;
  title: string | null;
  reviewText: string | null;
  usageContext: ModelReviewUsageContext;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  deviceType: ModelReviewDeviceType | null;
}

export interface ModelReviewScoreSet {
  overall: number | null;
  quality: number | null;
  speed: number | null;
  costBenefit: number | null;
  easeOfUse: number | null;
}

export interface ModelReviewAggregatePayload {
  modelId: string;
  modelName: string;
  stage: ModelReviewStage;
  sourceType: ModelReviewSourceType;
  reviewCount: number;
  averages: ModelReviewScoreSet;
  weightedScores: ModelReviewScoreSet;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  trend30d: number | null;
  lastReviewedAt: string | null;
}

export interface ModelReviewItemPayload {
  id: string;
  modelId: string;
  reviewerLabel: string;
  title: string | null;
  reviewText: string | null;
  usageContext: ModelReviewUsageContext;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  deviceType: ModelReviewDeviceType | null;
  overallScore: number;
  qualityScore: number;
  speedScore: number;
  costBenefitScore: number;
  easeOfUseScore: number;
  createdAt: string;
  updatedAt: string;
  isCurrentUser: boolean;
}

export interface ModelReviewLeaderboardRow extends ModelReviewAggregatePayload {
  isNew: boolean;
}

export interface ModelReviewLeaderboardResponse {
  leaderboard: ModelReviewLeaderboardRow[];
  globalStats: {
    reviewedModelCount: number;
    rankedModelCount: number;
    totalReviewCount: number;
    bestOverallModelId: string | null;
    bestCostBenefitModelId: string | null;
  };
  viewerReviewedModelIds: string[];
  reviewedModelIds: string[];
}

export interface ModelReviewDetailResponse {
  aggregate: ModelReviewAggregatePayload;
  currentUserReview: ModelReviewItemPayload | null;
  reviews: ModelReviewItemPayload[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type ModelReviewRow = typeof modelReview.$inferSelect;

type ModelReviewWithAuthorRow = {
  review: ModelReviewRow;
  reviewerName: string | null;
  reviewerEmail: string | null;
};

const WEIGHTED_PRIOR_REVIEW_COUNT = 5;
const GLOBAL_FALLBACK_AVERAGE = 3.5;
const RECENT_TREND_MIN_REVIEWS = 3;
const REVIEW_STATUS_PUBLISHED = "published";
const MODEL_REVIEW_TEXT_MAX = 1_200;
const MODEL_REVIEW_TITLE_MAX = 80;

const VALID_USAGE_CONTEXTS = new Set<ModelReviewUsageContext>([
  "balanced",
  "quality_first",
  "speed_first",
  "low_vram",
  "offline_local",
  "cloud_pipeline",
]);

const VALID_DEVICE_TYPES = new Set<ModelReviewDeviceType>(["cpu", "gpu", "cloud"]);
const MODEL_REVIEW_LOCALE = "en" as const;

const toIsoString = (value: Date | null): string | null => value?.toISOString() ?? null;

const roundToTwo = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100;

const roundToOne = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

const scoreToPercent = (value: number | null): number | null =>
  value === null ? null : roundToOne(value * 20);

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const stripHtmlTags = (value: string): string => value.replace(/<[^>]*>/g, " ");

const sanitizePlainText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = normalizeWhitespace(stripHtmlTags(value)).slice(0, maxLength);
  return sanitized.length > 0 ? sanitized : null;
};

const sanitizeLanguageCode = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  return normalized.length > 0 ? normalized : null;
};

const buildReviewerLabel = (reviewerName: string | null, reviewerEmail: string | null): string => {
  const sanitizedName = sanitizePlainText(reviewerName, 40);
  if (sanitizedName) {
    return sanitizedName;
  }

  const emailPrefix = reviewerEmail?.split("@")[0]?.trim() ?? "";
  const sanitizedPrefix = sanitizePlainText(emailPrefix, 40);
  if (sanitizedPrefix) {
    return sanitizedPrefix;
  }

  return tServer(MODEL_REVIEW_LOCALE, "auth.error.fallbackUserName");
};

const getModelReviewFieldLabel = (fieldName: string): string => {
  const label = tServer(MODEL_REVIEW_LOCALE, `modelReviews.field.${fieldName}`);
  return label === `modelReviews.field.${fieldName}` ? fieldName : label;
};

const averageScore = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const scoreAccessors: Record<ModelReviewRankingMetric, (review: ModelReviewRow) => number> = {
  overall: (review) => review.overallScore,
  quality: (review) => review.qualityScore,
  speed: (review) => review.speedScore,
  costBenefit: (review) => review.costBenefitScore,
  easeOfUse: (review) => review.easeOfUseScore,
};

const buildAverageScoreSet = (reviews: ModelReviewRow[]): ModelReviewScoreSet => ({
  overall: roundToTwo(averageScore(reviews.map((review) => review.overallScore))),
  quality: roundToTwo(averageScore(reviews.map((review) => review.qualityScore))),
  speed: roundToTwo(averageScore(reviews.map((review) => review.speedScore))),
  costBenefit: roundToTwo(averageScore(reviews.map((review) => review.costBenefitScore))),
  easeOfUse: roundToTwo(averageScore(reviews.map((review) => review.easeOfUseScore))),
});

const buildWeightedScoreSet = (
  averages: ModelReviewScoreSet,
  reviewCount: number,
  globalAverages: Record<ModelReviewRankingMetric, number>,
): ModelReviewScoreSet => {
  const weightedMetric = (metric: ModelReviewRankingMetric): number | null => {
    const averageValue = averages[metric];
    if (averageValue === null || reviewCount === 0) {
      return null;
    }

    const globalAverage = globalAverages[metric] ?? GLOBAL_FALLBACK_AVERAGE;
    const weighted =
      (averageValue * reviewCount + globalAverage * WEIGHTED_PRIOR_REVIEW_COUNT) /
      (reviewCount + WEIGHTED_PRIOR_REVIEW_COUNT);
    return scoreToPercent(weighted);
  };

  return {
    overall: weightedMetric("overall"),
    quality: weightedMetric("quality"),
    speed: weightedMetric("speed"),
    costBenefit: weightedMetric("costBenefit"),
    easeOfUse: weightedMetric("easeOfUse"),
  };
};

const buildDistribution = (
  reviews: ModelReviewRow[],
): Record<"1" | "2" | "3" | "4" | "5", number> => {
  const distribution: Record<"1" | "2" | "3" | "4" | "5", number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };

  reviews.forEach((review) => {
    const scoreKey = String(review.overallScore) as "1" | "2" | "3" | "4" | "5";
    distribution[scoreKey] += 1;
  });

  return distribution;
};

const buildTrend30d = (reviews: ModelReviewRow[]): number | null => {
  if (reviews.length === 0) {
    return null;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentReviews = reviews.filter((review) => review.updatedAt >= thirtyDaysAgo);
  if (recentReviews.length < RECENT_TREND_MIN_REVIEWS) {
    return null;
  }

  const recentAverage = averageScore(recentReviews.map((review) => review.overallScore));
  const overallAverage = averageScore(reviews.map((review) => review.overallScore));
  if (recentAverage === null || overallAverage === null) {
    return null;
  }

  return roundToOne((recentAverage - overallAverage) * 20);
};

const buildGlobalAverages = (
  reviews: ModelReviewRow[],
): Record<ModelReviewRankingMetric, number> => ({
  overall: averageScore(reviews.map((review) => review.overallScore)) ?? GLOBAL_FALLBACK_AVERAGE,
  quality: averageScore(reviews.map((review) => review.qualityScore)) ?? GLOBAL_FALLBACK_AVERAGE,
  speed: averageScore(reviews.map((review) => review.speedScore)) ?? GLOBAL_FALLBACK_AVERAGE,
  costBenefit:
    averageScore(reviews.map((review) => review.costBenefitScore)) ?? GLOBAL_FALLBACK_AVERAGE,
  easeOfUse:
    averageScore(reviews.map((review) => review.easeOfUseScore)) ?? GLOBAL_FALLBACK_AVERAGE,
});

const buildAggregatePayload = (
  entry: ModelReviewCatalogEntry,
  reviews: ModelReviewRow[],
  globalAverages: Record<ModelReviewRankingMetric, number>,
): ModelReviewAggregatePayload => {
  const averages = buildAverageScoreSet(reviews);
  const reviewCount = reviews.length;

  return {
    modelId: entry.modelId,
    modelName: entry.name,
    stage: entry.stage,
    sourceType: entry.sourceType,
    reviewCount,
    averages,
    weightedScores: buildWeightedScoreSet(averages, reviewCount, globalAverages),
    distribution: buildDistribution(reviews),
    trend30d: buildTrend30d(reviews),
    lastReviewedAt: toIsoString(reviews[0]?.updatedAt ?? null),
  };
};

const shapeReviewItem = (
  row: ModelReviewWithAuthorRow,
  viewerUserId: string | null,
): ModelReviewItemPayload => ({
  id: row.review.id,
  modelId: row.review.modelId,
  reviewerLabel: buildReviewerLabel(row.reviewerName, row.reviewerEmail),
  title: row.review.title,
  reviewText: row.review.reviewText,
  usageContext: row.review.usageContext as ModelReviewUsageContext,
  sourceLanguage: row.review.sourceLanguage,
  targetLanguage: row.review.targetLanguage,
  deviceType: row.review.deviceType as ModelReviewDeviceType | null,
  overallScore: row.review.overallScore,
  qualityScore: row.review.qualityScore,
  speedScore: row.review.speedScore,
  costBenefitScore: row.review.costBenefitScore,
  easeOfUseScore: row.review.easeOfUseScore,
  createdAt: row.review.createdAt.toISOString(),
  updatedAt: row.review.updatedAt.toISOString(),
  isCurrentUser: viewerUserId !== null && row.review.userId === viewerUserId,
});

const loadPublishedReviews = async (modelIds?: string[]): Promise<ModelReviewRow[]> => {
  if (modelIds && modelIds.length === 0) {
    return [];
  }

  const conditions = [eq(modelReview.status, REVIEW_STATUS_PUBLISHED)];
  if (modelIds) {
    conditions.push(inArray(modelReview.modelId, modelIds));
  }

  return db
    .select()
    .from(modelReview)
    .where(and(...conditions))
    .orderBy(desc(modelReview.updatedAt));
};

const loadModelReviewsWithAuthors = async (modelId: string): Promise<ModelReviewWithAuthorRow[]> =>
  db
    .select({
      review: modelReview,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(modelReview)
    .leftJoin(user, eq(modelReview.userId, user.id))
    .where(and(eq(modelReview.modelId, modelId), eq(modelReview.status, REVIEW_STATUS_PUBLISHED)))
    .orderBy(desc(modelReview.updatedAt));

export const parseModelReviewInput = (payload: unknown): ModelReviewMutationInput => {
  const body = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!body) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidPayload"));
  }

  const parseScore = (fieldName: string): number => {
    const raw = body[fieldName];
    const numeric = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
      throw new Error(
        tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidField", {
          fieldName: getModelReviewFieldLabel(fieldName),
        }),
      );
    }
    return numeric;
  };

  const rawUsageContext = typeof body.usageContext === "string" ? body.usageContext : "";
  if (!VALID_USAGE_CONTEXTS.has(rawUsageContext as ModelReviewUsageContext)) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidUsageContext"));
  }

  const rawDeviceType =
    typeof body.deviceType === "string" && body.deviceType.length > 0 ? body.deviceType : null;
  if (rawDeviceType && !VALID_DEVICE_TYPES.has(rawDeviceType as ModelReviewDeviceType)) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidDeviceType"));
  }

  return {
    overallScore: parseScore("overallScore"),
    qualityScore: parseScore("qualityScore"),
    speedScore: parseScore("speedScore"),
    costBenefitScore: parseScore("costBenefitScore"),
    easeOfUseScore: parseScore("easeOfUseScore"),
    title: sanitizePlainText(body.title, MODEL_REVIEW_TITLE_MAX),
    reviewText: sanitizePlainText(body.reviewText, MODEL_REVIEW_TEXT_MAX),
    usageContext: rawUsageContext as ModelReviewUsageContext,
    sourceLanguage: sanitizeLanguageCode(body.sourceLanguage),
    targetLanguage: sanitizeLanguageCode(body.targetLanguage),
    deviceType: rawDeviceType as ModelReviewDeviceType | null,
  };
};

export const listModelReviewLeaderboard = async (
  filters: ModelReviewQueryFilters,
  viewerUserId: string | null,
): Promise<ModelReviewLeaderboardResponse> => {
  const catalogEntries = filterModelReviewCatalog({
    stage: filters.stage,
    source: filters.source,
    language: filters.language,
    search: filters.search,
  });
  const catalogModelIds = catalogEntries.map((entry) => entry.modelId);
  const reviews = await loadPublishedReviews(catalogModelIds);
  const reviewsByModelId = new Map<string, ModelReviewRow[]>();

  reviews.forEach((review) => {
    const bucket = reviewsByModelId.get(review.modelId) ?? [];
    bucket.push(review);
    reviewsByModelId.set(review.modelId, bucket);
  });

  const globalAverages = buildGlobalAverages(reviews);
  const reviewedModelIds = catalogEntries
    .filter((entry) => (reviewsByModelId.get(entry.modelId)?.length ?? 0) > 0)
    .map((entry) => entry.modelId);

  const viewerReviewedModelIds =
    viewerUserId === null
      ? []
      : Array.from(
          new Set(
            reviews
              .filter((review) => review.userId === viewerUserId)
              .map((review) => review.modelId),
          ),
        );

  const rankedRows = catalogEntries
    .map((entry) => {
      const entryReviews = reviewsByModelId.get(entry.modelId) ?? [];
      return {
        ...buildAggregatePayload(entry, entryReviews, globalAverages),
        isNew: entryReviews.length === 1,
      };
    })
    .filter((entry) => entry.reviewCount >= filters.minReviews)
    .sort((left, right) => {
      const leftMetric = left.weightedScores[filters.ranking] ?? 0;
      const rightMetric = right.weightedScores[filters.ranking] ?? 0;

      if (rightMetric !== leftMetric) {
        return rightMetric - leftMetric;
      }

      if (right.reviewCount !== left.reviewCount) {
        return right.reviewCount - left.reviewCount;
      }

      return left.modelName.localeCompare(right.modelName);
    })
    .slice(0, filters.limit);

  const bestOverallRow = catalogEntries
    .map((entry) => buildAggregatePayload(entry, reviewsByModelId.get(entry.modelId) ?? [], globalAverages))
    .filter((entry) => entry.reviewCount > 0 && entry.weightedScores.overall !== null)
    .sort((left, right) => (right.weightedScores.overall ?? 0) - (left.weightedScores.overall ?? 0))[0];

  const bestCostBenefitRow = catalogEntries
    .map((entry) => buildAggregatePayload(entry, reviewsByModelId.get(entry.modelId) ?? [], globalAverages))
    .filter((entry) => entry.reviewCount > 0 && entry.weightedScores.costBenefit !== null)
    .sort((left, right) => (right.weightedScores.costBenefit ?? 0) - (left.weightedScores.costBenefit ?? 0))[0];

  return {
    leaderboard: rankedRows,
    globalStats: {
      reviewedModelCount: reviewedModelIds.length,
      rankedModelCount: rankedRows.length,
      totalReviewCount: reviews.length,
      bestOverallModelId: bestOverallRow?.modelId ?? null,
      bestCostBenefitModelId: bestCostBenefitRow?.modelId ?? null,
    },
    viewerReviewedModelIds,
    reviewedModelIds,
  };
};

export const getModelReviewDetail = async (
  modelId: string,
  viewerUserId: string | null,
  page: number,
  pageSize: number,
): Promise<ModelReviewDetailResponse> => {
  const catalogEntry = getModelReviewCatalogEntry(modelId);
  if (!catalogEntry) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidModel"));
  }

  const [allReviews, modelReviewRows] = await Promise.all([
    loadPublishedReviews(),
    loadModelReviewsWithAuthors(modelId),
  ]);
  const globalAverages = buildGlobalAverages(allReviews);
  const aggregate = buildAggregatePayload(
    catalogEntry,
    modelReviewRows.map((row) => row.review),
    globalAverages,
  );

  const total = modelReviewRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRows = modelReviewRows.slice(startIndex, startIndex + pageSize);
  const currentUserReview =
    viewerUserId === null
      ? null
      : modelReviewRows.find((row) => row.review.userId === viewerUserId) ?? null;

  return {
    aggregate,
    currentUserReview: currentUserReview ? shapeReviewItem(currentUserReview, viewerUserId) : null,
    reviews: paginatedRows.map((row) => shapeReviewItem(row, viewerUserId)),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
};

export const upsertModelReview = async (
  userId: string,
  modelId: string,
  input: ModelReviewMutationInput,
): Promise<{ currentUserReview: ModelReviewItemPayload; aggregate: ModelReviewAggregatePayload }> => {
  const catalogEntry = getModelReviewCatalogEntry(modelId);
  if (!catalogEntry) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidModel"));
  }

  const timestamp = new Date();
  await db
    .insert(modelReview)
    .values({
      id: randomUUID(),
      userId,
      modelId: catalogEntry.modelId,
      stage: catalogEntry.stage,
      sourceType: catalogEntry.sourceType,
      overallScore: input.overallScore,
      qualityScore: input.qualityScore,
      speedScore: input.speedScore,
      costBenefitScore: input.costBenefitScore,
      easeOfUseScore: input.easeOfUseScore,
      title: input.title,
      reviewText: input.reviewText,
      usageContext: input.usageContext,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      deviceType: input.deviceType,
      status: REVIEW_STATUS_PUBLISHED,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [modelReview.userId, modelReview.modelId],
      set: {
        stage: catalogEntry.stage,
        sourceType: catalogEntry.sourceType,
          overallScore: input.overallScore,
        qualityScore: input.qualityScore,
        speedScore: input.speedScore,
        costBenefitScore: input.costBenefitScore,
        easeOfUseScore: input.easeOfUseScore,
        title: input.title,
        reviewText: input.reviewText,
        usageContext: input.usageContext,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        deviceType: input.deviceType,
        status: REVIEW_STATUS_PUBLISHED,
        updatedAt: timestamp,
      },
    });

  const detail = await getModelReviewDetail(modelId, userId, 1, 10);
  if (!detail.currentUserReview) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.reloadAfterSaveFailed"));
  }

  return {
    currentUserReview: detail.currentUserReview,
    aggregate: detail.aggregate,
  };
};

export const deleteModelReview = async (
  userId: string,
  modelId: string,
): Promise<{ success: true; aggregate: ModelReviewAggregatePayload }> => {
  const catalogEntry = getModelReviewCatalogEntry(modelId);
  if (!catalogEntry) {
    throw new Error(tServer(MODEL_REVIEW_LOCALE, "modelReviews.error.invalidModel"));
  }

  await db
    .delete(modelReview)
    .where(and(eq(modelReview.userId, userId), eq(modelReview.modelId, modelId)));

  const detail = await getModelReviewDetail(modelId, userId, 1, 10);

  return {
    success: true,
    aggregate: detail.aggregate,
  };
};
