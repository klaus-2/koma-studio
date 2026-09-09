import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "./client";
import type {
  FeedApplication,
  FeedBan,
  FeedPost,
  FeedProfile,
  FeedReport,
} from "../services/scanlationFeed";

interface ScanlationFeedClientLike {
  getProfile: () => Promise<FeedProfile>;
  listPosts: (params?: { type?: "recruitment" | "showcase" | "all"; mine?: boolean }) => Promise<{ posts: FeedPost[] }>;
  listSentApplications: () => Promise<{ applications: FeedApplication[] }>;
  listReceivedApplications: () => Promise<{ applications: FeedApplication[] }>;
  listModerationReports: () => Promise<{ reports: FeedReport[] }>;
  listModerationPosts: (params?: { type?: "recruitment" | "showcase" | "all" }) => Promise<{ posts: FeedPost[] }>;
  listBans: () => Promise<{ bans: FeedBan[] }>;
  saveProfile: (payload: {
    rulesAccepted?: boolean;
    authorNotificationWebhookEnabled?: boolean;
    authorNotificationWebhookUrl?: string;
  }) => Promise<FeedProfile>;
  createPost: (payload: Record<string, unknown>) => Promise<FeedPost>;
  applyToPost: (postId: string, payload: Record<string, unknown>) => Promise<FeedApplication>;
  createReport: (payload: { postId: string; reasonCode: string; details?: string }) => Promise<FeedReport>;
  updateModerationPost: (payload: Record<string, unknown>) => Promise<FeedPost>;
  updateModerationReport: (payload: Record<string, unknown>) => Promise<FeedReport>;
  createBan: (payload: Record<string, unknown>) => Promise<FeedBan>;
}

export interface ScanlationFeedQueryData {
  profile: FeedProfile;
  posts: FeedPost[];
  sentApplications: FeedApplication[];
  receivedApplications: FeedApplication[];
  reports: FeedReport[];
  bans: FeedBan[];
}

export const useScanlationFeedQuery = (
  client: ScanlationFeedClientLike,
  tab: string,
  canModerate: boolean,
) =>
  useQuery({
    queryKey: appQueryKeys.scanlationFeed.data(tab, canModerate),
    queryFn: async (): Promise<ScanlationFeedQueryData> => {
      const [prof, postsPl, sentPl, recvPl] = await Promise.all([
        client.getProfile(),
        client.listPosts({
          type: tab === "showcase" ? "showcase" : "recruitment",
        }),
        client.listSentApplications(),
        client.listReceivedApplications(),
      ]);

      if (canModerate && tab === "moderation") {
        const [rptPl, modPl, bansPl] = await Promise.all([
          client.listModerationReports(),
          client.listModerationPosts(),
          client.listBans(),
        ]);
        return {
          profile: prof,
          posts: modPl.posts,
          sentApplications: sentPl.applications,
          receivedApplications: recvPl.applications,
          reports: rptPl.reports,
          bans: bansPl.bans,
        };
      }

      return {
        profile: prof,
        posts: postsPl.posts,
        sentApplications: sentPl.applications,
        receivedApplications: recvPl.applications,
        reports: [],
        bans: [],
      };
    },
  });

const optimisticFeedPost = (payload: Record<string, unknown>, currentUser: {
  id?: string;
  name?: string;
  email?: string;
}): FeedPost => ({
  id: `temp-post-${Date.now()}`,
  type: (payload.type as FeedPost["type"]) ?? "recruitment",
  title: String(payload.title ?? ""),
  summary: typeof payload.summary === "string" ? payload.summary : null,
  body: String(payload.body ?? ""),
  status: "published",
  moderationStatus: "clean",
  riskScore: 0,
  riskReasons: [],
  externalLinks: [],
  media: Array.isArray(payload.media) ? (payload.media as FeedPost["media"]) : [],
  recruitment: (payload.recruitment as FeedPost["recruitment"]) ?? null,
  showcase: (payload.showcase as FeedPost["showcase"]) ?? null,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: {
    id: currentUser.id ?? "me",
    name: currentUser.name ?? "",
    email: currentUser.email ?? "",
  },
});

export const useScanlationFeedMutations = (
  client: ScanlationFeedClientLike,
  tab: string,
  canModerate: boolean,
  currentUser: { id?: string; name?: string; email?: string },
) => {
  const queryClient = useQueryClient();
  const queryKey = appQueryKeys.scanlationFeed.data(tab, canModerate);

  const saveProfileMutation = useMutation({
    mutationFn: (payload: Parameters<ScanlationFeedClientLike["saveProfile"]>[0]) =>
      client.saveProfile(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous) {
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          profile: {
            ...previous.profile,
            rulesAcceptedAt: payload.rulesAccepted ? previous.profile.rulesAcceptedAt ?? new Date().toISOString() : previous.profile.rulesAcceptedAt,
            authorNotificationWebhookEnabled:
              payload.authorNotificationWebhookEnabled ?? previous.profile.authorNotificationWebhookEnabled,
            authorNotificationWebhookConfigured:
              typeof payload.authorNotificationWebhookUrl === "string"
                ? payload.authorNotificationWebhookUrl.trim().length > 0
                : previous.profile.authorNotificationWebhookConfigured,
          },
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.createPost(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous) {
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          posts: [optimisticFeedPost(payload, currentUser), ...previous.posts],
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const applyToPostMutation = useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: Record<string, unknown> }) =>
      client.applyToPost(postId, payload),
    onMutate: async ({ postId, payload }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous) {
        const optimistic: FeedApplication = {
          id: `temp-application-${Date.now()}`,
          postId,
          postTitle: previous.posts.find((post) => post.id === postId)?.title ?? "Post",
          applicantUserId: currentUser.id ?? "me",
          applicantName: currentUser.name ?? "",
          applicantEmail: currentUser.email ?? "",
          status: "submitted",
          message: String(payload.message ?? ""),
          experience: typeof payload.experience === "string" ? payload.experience : null,
          availabilityHoursPerWeek: typeof payload.availabilityHoursPerWeek === "number" ? payload.availabilityHoursPerWeek : null,
          availabilityDays: Array.isArray(payload.availabilityDays) ? (payload.availabilityDays as string[]) : [],
          preferredContact: (payload.preferredContact as FeedApplication["preferredContact"]) ?? null,
          portfolioLinks: Array.isArray(payload.portfolioLinks) ? (payload.portfolioLinks as string[]) : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          sentApplications: [optimistic, ...previous.sentApplications],
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const createReportMutation = useMutation({
    mutationFn: (payload: { postId: string; reasonCode: string; details?: string }) => client.createReport(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous) {
        const nextPosts = previous.posts.map((post) =>
          post.id === payload.postId && post.moderationStatus === "clean"
            ? { ...post, moderationStatus: "flagged" as const }
            : post,
        );
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          posts: nextPosts,
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateModerationPostMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.updateModerationPost(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous && typeof payload.id === "string") {
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          posts: previous.posts.map((post) =>
            post.id === payload.id ? { ...post, ...payload } as FeedPost : post,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateModerationReportMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.updateModerationReport(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous && typeof payload.id === "string") {
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          reports: previous.reports.map((report) =>
            report.id === payload.id ? { ...report, ...payload } as FeedReport : report,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const createBanMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => client.createBan(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ScanlationFeedQueryData>(queryKey);
      if (previous) {
        const optimistic: FeedBan = {
          banId: `temp-ban-${Date.now()}`,
          activeBan: {
            title: "Acesso bloqueado",
            detail: `${String(payload.reason ?? "")} Escopo: ${String(payload.scope ?? "account_only")}.`,
            temporary: false,
            reason: String(payload.reason ?? ""),
            scope: String(payload.scope ?? "account_only") as FeedBan["activeBan"]["scope"],
            expiresAt: null,
          },
          matchedTargets: [],
        };
        queryClient.setQueryData<ScanlationFeedQueryData>(queryKey, {
          ...previous,
          bans: [optimistic, ...previous.bans],
        });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    saveProfileMutation,
    createPostMutation,
    applyToPostMutation,
    createReportMutation,
    updateModerationPostMutation,
    updateModerationReportMutation,
    createBanMutation,
  };
};
