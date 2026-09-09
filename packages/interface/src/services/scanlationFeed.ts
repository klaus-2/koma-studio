import { buildUrl } from "../config/api";
import { fetchWithTimeoutAndRetry } from "../utils/http";

export type FeedProfileStatus = "pending_setup" | "active" | "suspended";
export type FeedPostType = "recruitment" | "showcase";
export type FeedPostStatus = "published" | "paused" | "closed" | "filled" | "archived";
export type FeedModerationStatus = "clean" | "flagged" | "hidden" | "removed";
export type FeedApplicationStatus = "submitted" | "reviewing" | "accepted" | "rejected" | "withdrawn";
export type FeedReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type FeedBanScope = "account_only" | "account_hwid" | "account_hwid_mac_ip";

export interface FeedProfile {
  userId: string;
  status: FeedProfileStatus;
  rulesAcceptedAt: string | null;
  profileCompletedAt: string | null;
  postingApprovedAt: string | null;
  postingSuspendedUntil: string | null;
  authorNotificationWebhookEnabled: boolean;
  authorNotificationWebhookConfigured: boolean;
  authorNotificationWebhookUrl?: string | null;
}

export interface FeedPostMediaItem {
  id: string;
  fileName: string;
  mimeType: string;
  altText: string;
  directUrl: string;
  deleteHash?: string | null;
  width?: number;
  height?: number;
  byteLength?: number;
}

export interface FeedContactEntry {
  type: "discord" | "twitter_x" | "telegram" | "email" | "whatsapp" | "instagram";
  value: string;
  url?: string | null;
}

export interface FeedRecruitmentRoleOpening {
  role: "RAW" | "CL" | "RD" | "TL" | "PR" | "TS" | "QC";
  compensationAmount: string | null;
}

export interface FeedRecruitmentCandidateRequirements {
  portfolio: boolean;
  experience: boolean;
  availability: boolean;
  availabilityHoursPerWeek: number | null;
  availabilityDays: string[];
  availabilityDescription: string | null;
  contact: boolean;
}

export interface FeedRecruitmentPayload {
  scanlationName: string;
  workTitle?: string | null;
  roles: Array<"RAW" | "CL" | "RD" | "TL" | "PR" | "TS" | "QC">;
  roleOpenings: FeedRecruitmentRoleOpening[];
  experience: string | null;
  availabilityHoursPerWeek: number | null;
  availabilityDays: string[];
  paidWork: boolean;
  compensation: string | null;
  contactTypes: Array<"Discord" | "Twitter/X" | "Telegram" | "E-mail" | "WhatsApp" | "Instagram">;
  contacts: FeedContactEntry[];
  candidateRequirements: FeedRecruitmentCandidateRequirements;
}

export interface FeedShowcasePayload {
  scanlationName: string;
  workTitle: string;
  chapterLabel: string | null;
  description: string | null;
  genres: string[];
}

export interface FeedPost {
  id: string;
  type: FeedPostType;
  title: string;
  summary: string | null;
  body: string;
  status: FeedPostStatus;
  moderationStatus: FeedModerationStatus;
  riskScore: number;
  riskReasons: string[];
  externalLinks: string[];
  media: FeedPostMediaItem[];
  recruitment: FeedRecruitmentPayload | null;
  showcase: FeedShowcasePayload | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FeedApplication {
  id: string;
  postId: string;
  postTitle: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  status: FeedApplicationStatus;
  message: string;
  experience: string | null;
  availabilityHoursPerWeek: number | null;
  availabilityDays: string[];
  preferredContact: FeedContactEntry | null;
  portfolioLinks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedReport {
  id: string;
  postId: string;
  postTitle: string;
  reasonCode: string;
  details: string | null;
  status: FeedReportStatus;
  reporter: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FeedBan {
  banId: string;
  activeBan: {
    title: string;
    detail: string;
    temporary: boolean;
    reason: string;
    scope: FeedBanScope;
    expiresAt: string | null;
  };
  matchedTargets?: Array<{ targetType: string; targetHash: string }>;
}

interface FeedClientAuth {
  getAuthToken: () => string | null;
  refreshSession: () => Promise<string | null>;
}

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string; detail?: string } | null;
    return payload?.error ?? payload?.detail ?? `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
};

const createAuthorizedRequest = ({ getAuthToken, refreshSession }: FeedClientAuth) => {
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
      const initialUnauthorizedMessage = await parseApiError(response.clone());
      const refreshedToken = await refreshSession();
      if (!refreshedToken) {
        throw new Error(initialUnauthorizedMessage);
      }
      response = await doRequest(refreshedToken);
    }

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    return (await response.json()) as TPayload;
  };
};

export const createScanlationFeedClient = (auth: FeedClientAuth) => {
  const authorizedRequest = createAuthorizedRequest(auth);

  return {
    getProfile: (): Promise<FeedProfile> => authorizedRequest("/api/feed/profile"),
    saveProfile: (payload: {
      rulesAccepted?: boolean;
      authorNotificationWebhookEnabled?: boolean;
      authorNotificationWebhookUrl?: string;
    }): Promise<FeedProfile> =>
      authorizedRequest("/api/feed/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    listPosts: (params: { type?: FeedPostType | "all"; mine?: boolean } = {}): Promise<{ posts: FeedPost[] }> => {
      const query = new URLSearchParams();
      if (params.type) {
        query.set("type", params.type);
      }
      if (params.mine) {
        query.set("mine", "true");
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return authorizedRequest(`/api/feed/posts${suffix}`);
    },
    getPost: (postId: string): Promise<FeedPost> =>
      authorizedRequest(`/api/feed/posts/${encodeURIComponent(postId)}`),
    createPost: (payload: Record<string, unknown>): Promise<FeedPost> =>
      authorizedRequest("/api/feed/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updatePost: (payload: Record<string, unknown>): Promise<FeedPost> =>
      authorizedRequest("/api/feed/posts", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    applyToPost: (postId: string, payload: Record<string, unknown>): Promise<FeedApplication> =>
      authorizedRequest(`/api/feed/posts/${encodeURIComponent(postId)}/applications`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listSentApplications: (): Promise<{ applications: FeedApplication[] }> =>
      authorizedRequest("/api/feed/applications/sent"),
    listReceivedApplications: (): Promise<{ applications: FeedApplication[] }> =>
      authorizedRequest("/api/feed/applications/received"),
    updateApplication: (applicationId: string, payload: Record<string, unknown>): Promise<FeedApplication> =>
      authorizedRequest(`/api/feed/applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    createReport: (payload: { postId: string; reasonCode: string; details?: string }): Promise<FeedReport> =>
      authorizedRequest("/api/feed/reports", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listModerationReports: (): Promise<{ reports: FeedReport[] }> =>
      authorizedRequest("/api/feed/mod/reports"),
    updateModerationReport: (payload: Record<string, unknown>): Promise<FeedReport> =>
      authorizedRequest("/api/feed/mod/reports", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    listModerationPosts: (params: { type?: FeedPostType | "all" } = {}): Promise<{ posts: FeedPost[] }> => {
      const query = new URLSearchParams();
      if (params.type) {
        query.set("type", params.type);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return authorizedRequest(`/api/feed/mod/posts${suffix}`);
    },
    updateModerationPost: (payload: Record<string, unknown>): Promise<FeedPost> =>
      authorizedRequest("/api/feed/mod/posts", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    listBans: (): Promise<{ bans: FeedBan[] }> => authorizedRequest("/api/feed/mod/bans"),
    createBan: (payload: Record<string, unknown>): Promise<FeedBan> =>
      authorizedRequest("/api/feed/mod/bans", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateBan: (payload: Record<string, unknown>): Promise<{ success: true; banId: string }> =>
      authorizedRequest("/api/feed/mod/bans", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  };
};
