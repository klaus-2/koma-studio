import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "./client";
import type {
  ModelLeaderboardFilters,
  ModelLeaderboardResponse,
  ModelReviewDetailResponse,
  ModelReviewFormPayload,
} from "../services/modelReviews";

interface ModelReviewsClientLike {
  fetchLeaderboard: (filters: ModelLeaderboardFilters) => Promise<ModelLeaderboardResponse>;
  fetchModelDetail: (modelId: string, page?: number, pageSize?: number) => Promise<ModelReviewDetailResponse>;
  upsertMyReview: (modelId: string, payload: ModelReviewFormPayload) => Promise<unknown>;
  deleteMyReview: (modelId: string) => Promise<unknown>;
}

export const useModelReviewsLeaderboardQuery = (
  client: ModelReviewsClientLike,
  filters: ModelLeaderboardFilters,
  filtersKey: string,
) =>
  useQuery({
    queryKey: appQueryKeys.modelReviews.leaderboard(filtersKey),
    queryFn: () => client.fetchLeaderboard(filters),
  });

export const useModelReviewDetailQuery = (
  client: ModelReviewsClientLike,
  modelId: string | null,
  page: number,
  pageSize: number,
) =>
  useQuery({
    queryKey: modelId
      ? appQueryKeys.modelReviews.detail(modelId, page, pageSize)
      : ["model-reviews", "detail", "idle"],
    queryFn: () => client.fetchModelDetail(modelId as string, page, pageSize),
    enabled: Boolean(modelId),
  });

export const useModelReviewMutations = (
  client: ModelReviewsClientLike,
  modelId: string | null,
  filtersKey: string,
) => {
  const queryClient = useQueryClient();

  const refreshCurrentModel = async (targetId: string, page = 1, pageSize = 10) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.modelReviews.leaderboard(filtersKey),
      }),
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.modelReviews.detail(targetId, page, pageSize),
      }),
    ]);
  };

  const upsertReviewMutation = useMutation({
    mutationFn: (payload: ModelReviewFormPayload) =>
      client.upsertMyReview(modelId as string, payload),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () => client.deleteMyReview(modelId as string),
  });

  return {
    upsertReviewMutation,
    deleteReviewMutation,
    refreshCurrentModel,
  };
};
