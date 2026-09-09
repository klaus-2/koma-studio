import { buildUrl } from "../config/api";
import { fetchWithTimeoutAndRetry } from "../utils/http";

export type RankingMetric = "overall" | "quality" | "speed" | "costBenefit" | "easeOfUse";

export type ModelReviewStage =
  | "translation"
  | "detectText"
  | "recognizeText"
  | "segmentText"
  | "cleanImage";

export type ModelReviewSourceType = "local" | "cloud";


export type ModelReviewUsageContext =
  | "balanced"
  | "quality_first"
  | "speed_first"
  | "low_vram"
  | "offline_local"
  | "cloud_pipeline";

export type ModelReviewDeviceType = "cpu" | "gpu" | "cloud";

export interface ModelReviewScoreSet {
  overall: number | null;
  quality: number | null;
  speed: number | null;
  costBenefit: number | null;
  easeOfUse: number | null;
}

export interface ModelReviewAggregate {
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

export interface ModelReviewItem {
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

export interface ModelLeaderboardRow extends ModelReviewAggregate {
  isNew: boolean;
}

export interface ModelLeaderboardFilters {
  ranking: RankingMetric;
  stage: "all" | ModelReviewStage;
  source: "all" | ModelReviewSourceType;
  language: string;
  search: string;
  minReviews: number;
  limit: number;
}

export interface ModelLeaderboardResponse {
  leaderboard: ModelLeaderboardRow[];
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
  aggregate: ModelReviewAggregate;
  currentUserReview: ModelReviewItem | null;
  reviews: ModelReviewItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ModelReviewFormPayload {
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

interface ModelReviewsClientAuth {
  getAuthToken: () => string | null;
  refreshSession: () => Promise<string | null>;
}

const toQueryString = (filters: ModelLeaderboardFilters): string => {
  const params = new URLSearchParams({
    ranking: filters.ranking,
    stage: filters.stage,
    source: filters.source,
    language: filters.language || "all",
    search: filters.search,
    minReviews: String(filters.minReviews),
    limit: String(filters.limit),
  });

  return params.toString();
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string; detail?: string } | null;
    return payload?.error ?? payload?.detail ?? `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
};

const createAuthorizedRequest = ({ getAuthToken, refreshSession }: ModelReviewsClientAuth) => {
  return async <TPayload>(path: string, init: RequestInit = {}): Promise<TPayload> => {
    const doRequest = async (token: string): Promise<Response> =>
      fetchWithTimeoutAndRetry(buildUrl("authUrl", path), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });

    let token = getAuthToken();
    if (!token) {
      token = await refreshSession();
    }
    if (!token) {
      throw new Error("Session expired. Please sign in again.");
    }

    let response = await doRequest(token);
    if (response.status === 401) {
      const refreshedToken = await refreshSession();
      if (!refreshedToken) {
        throw new Error("Session expired. Please sign in again.");
      }
      response = await doRequest(refreshedToken);
    }

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    return (await response.json()) as TPayload;
  };
};

export const createModelReviewsClient = (auth: ModelReviewsClientAuth) => {
  const authorizedRequest = createAuthorizedRequest(auth);

  return {
    fetchLeaderboard: (filters: ModelLeaderboardFilters): Promise<ModelLeaderboardResponse> =>
      authorizedRequest<ModelLeaderboardResponse>(`/api/model-reviews/leaderboard?${toQueryString(filters)}`),
    fetchModelDetail: (
      modelId: string,
      page = 1,
      pageSize = 10,
    ): Promise<ModelReviewDetailResponse> =>
      authorizedRequest<ModelReviewDetailResponse>(
        `/api/model-reviews/models/${encodeURIComponent(modelId)}?page=${page}&pageSize=${pageSize}`,
      ),
    upsertMyReview: (
      modelId: string,
      payload: ModelReviewFormPayload,
    ): Promise<{
      currentUserReview: ModelReviewItem;
      aggregate: ModelReviewAggregate;
    }> =>
      authorizedRequest(`/api/model-reviews/models/${encodeURIComponent(modelId)}/my-review`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    deleteMyReview: (
      modelId: string,
    ): Promise<{
      success: true;
      aggregate: ModelReviewAggregate;
    }> =>
      authorizedRequest(`/api/model-reviews/models/${encodeURIComponent(modelId)}/my-review`, {
        method: "DELETE",
      }),
  };
};
