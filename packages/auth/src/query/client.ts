import { QueryClient } from "@tanstack/react-query";

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const appQueryKeys = {
  auth: {
    session: ["auth", "session"] as const,
  },
  authConfig: ["auth-config"] as const,
  modelReviews: {
    leaderboard: (filtersKey: string) => ["model-reviews", "leaderboard", filtersKey] as const,
    detail: (modelId: string, page: number, pageSize: number) =>
      ["model-reviews", "detail", modelId, page, pageSize] as const,
  },
  scanlationFeed: {
    data: (tab: string, canModerate: boolean) => ["scanlation-feed", "data", tab, canModerate] as const,
  },
};
