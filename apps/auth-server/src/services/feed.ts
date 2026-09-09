import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db/client.js";
import {
  feedApplication,
  feedPost,
  feedProfile,
  feedReport,
  type FeedApplicationContact,
  type FeedContactEntry,
  type FeedPostMediaItem,
  type FeedRecruitmentCandidateRequirements,
  type FeedRecruitmentPayload,
  type FeedRecruitmentRoleOpening,
  type FeedReportEvidence,
  type FeedShowcasePayload,
  user,
} from "../db/schema.js";
import type { AppRole } from "./app-roles.js";
import { isStaffRole } from "./app-roles.js";
import { analyzeFeedPostRisk, normalizeCommunityUrl, validateDiscordWebhookUrl } from "./feed-security.js";
import { normalizeEmailLocale, type EmailLocale } from "./locale.js";
import { tServer } from "./server-i18n.js";

export type FeedProfileStatus = "pending_setup" | "active" | "suspended";
export type FeedPostType = "recruitment" | "showcase";
export type FeedPostStatus = "published" | "paused" | "closed" | "filled" | "archived";
export type FeedModerationStatus = "clean" | "flagged" | "hidden" | "removed";
export type FeedApplicationStatus = "submitted" | "reviewing" | "accepted" | "rejected" | "withdrawn";
export type FeedReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

const FEED_POST_ROLES = new Set(["RAW", "CL", "RD", "TL", "PR", "TS", "QC"]);
const FEED_CONTACT_TYPES = new Map<string, FeedRecruitmentPayload["contactTypes"][number]>([
  ["discord", "Discord"],
  ["twitter/x", "Twitter/X"],
  ["twitter_x", "Twitter/X"],
  ["telegram", "Telegram"],
  ["e-mail", "E-mail"],
  ["email", "E-mail"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
]);
const FEED_CONTACT_TYPES_INTERNAL = new Set<FeedApplicationContact["type"]>([
  "discord",
  "twitter_x",
  "telegram",
  "email",
  "whatsapp",
  "instagram",
]);
const ALLOWED_APPLICATION_STATUSES = new Set<FeedApplicationStatus>([
  "submitted",
  "reviewing",
  "accepted",
  "rejected",
  "withdrawn",
]);
const ALLOWED_REPORT_STATUSES = new Set<FeedReportStatus>(["open", "reviewing", "resolved", "dismissed"]);
const ALLOWED_POST_STATUSES = new Set<FeedPostStatus>(["published", "paused", "closed", "filled", "archived"]);
const ALLOWED_MODERATION_STATUSES = new Set<FeedModerationStatus>(["clean", "flagged", "hidden", "removed"]);

export interface FeedViewerContext {
  userId: string;
  appRole: AppRole;
  emailVerified: boolean;
  locale?: string | null;
}

const resolveFeedLocale = (locale?: string | null) =>
  normalizeEmailLocale(locale) ?? "en";

export interface FeedProfileResponse {
  userId: string;
  status: FeedProfileStatus;
  rulesAcceptedAt: string | null;
  profileCompletedAt: string | null;
  postingApprovedAt: string | null;
  postingSuspendedUntil: string | null;
  authorNotificationWebhookEnabled: boolean;
  authorNotificationWebhookConfigured: boolean;
}

export interface FeedPostResponse {
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

export interface FeedApplicationResponse {
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
  preferredContact: FeedApplicationContact | null;
  portfolioLinks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedReportResponse {
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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

const sanitizeText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
};

const sanitizeLongText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new Error(tServer("en", "feed.error.invalidTextField"));
  }

  const normalized = value.replace(/\r/g, "").trim().slice(0, maxLength);
  if (!normalized) {
    throw new Error(tServer("en", "feed.error.requiredTextField"));
  }
  return normalized;
};

const parseOptionalDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(tServer("en", "feed.error.invalidDate"));
  }
  return new Date(parsed);
};

const normalizeInternalContactType = (value: unknown): FeedApplicationContact["type"] | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return FEED_CONTACT_TYPES_INTERNAL.has(normalized as FeedApplicationContact["type"])
    ? (normalized as FeedApplicationContact["type"])
    : null;
};

const normalizeRecruitmentContactType = (
  value: unknown,
): FeedRecruitmentPayload["contactTypes"][number] | null => {
  if (typeof value !== "string") {
    return null;
  }

  return FEED_CONTACT_TYPES.get(value.trim().toLowerCase()) ?? null;
};

const parseStringArray = (value: unknown, maxItems: number, maxLength: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => sanitizeText(item, maxLength))
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, maxItems);
};

const parseUrlArray = (value: unknown, maxItems: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? normalizeCommunityUrl(item) : null))
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(normalized)).slice(0, maxItems);
};

const parseMediaItems = (value: unknown, maxItems: number): FeedPostMediaItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: FeedPostMediaItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const payload = asRecord(item);
    if (!payload) {
      continue;
    }

    const directUrl = typeof payload.directUrl === "string" ? normalizeCommunityUrl(payload.directUrl) : null;
    const fileName = sanitizeText(payload.fileName, 180);
    const mimeType = sanitizeText(payload.mimeType, 120);
    const altText = sanitizeText(payload.altText, 180) ?? fileName ?? tServer("en", "feed.media.altFallback");
    const id = sanitizeText(payload.id, 120) ?? randomUUID();
    if (!directUrl || !fileName || !mimeType) {
      continue;
    }

    items.push({
      id,
      fileName,
      mimeType,
      altText,
      directUrl,
      deleteHash: sanitizeText(payload.deleteHash, 180),
      width: typeof payload.width === "number" ? payload.width : undefined,
      height: typeof payload.height === "number" ? payload.height : undefined,
      byteLength: typeof payload.byteLength === "number" ? payload.byteLength : undefined,
    });
  }

  return items;
};

const parseContactEntries = (value: unknown, maxItems: number): FeedContactEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: FeedContactEntry[] = [];
  for (const item of value.slice(0, maxItems)) {
    const payload = asRecord(item);
    if (!payload) {
      continue;
    }

    const type = normalizeInternalContactType(payload.type);
    const contactValue = sanitizeText(payload.value, 180);
    if (!type || !contactValue) {
      continue;
    }

    const normalizedUrl =
      typeof payload.url === "string" && payload.url.trim()
        ? normalizeCommunityUrl(payload.url)
        : null;

    items.push({
      type,
      value: contactValue,
      url: normalizedUrl,
    });
  }

  return items;
};

const parseRoleOpenings = (value: unknown, paidWork: boolean): FeedRecruitmentRoleOpening[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: FeedRecruitmentRoleOpening[] = [];
  for (const item of value.slice(0, 12)) {
    const payload = asRecord(item);
    if (!payload) {
      continue;
    }
    const role = typeof payload.role === "string" && FEED_POST_ROLES.has(payload.role)
      ? (payload.role as FeedRecruitmentRoleOpening["role"])
      : null;
    if (!role) {
      continue;
    }

    items.push({
      role,
      compensationAmount: paidWork ? sanitizeText(payload.compensationAmount, 40) : null,
    });
  }

  return Array.from(new Map(items.map((entry) => [entry.role, entry])).values());
};

const parseCandidateRequirements = (value: unknown): FeedRecruitmentCandidateRequirements => {
  const payload = asRecord(value) ?? {};
  return {
    portfolio: payload.portfolio === true,
    experience: payload.experience === true,
    availability: payload.availability === true,
    availabilityHoursPerWeek:
      typeof payload.availabilityHoursPerWeek === "number" && Number.isFinite(payload.availabilityHoursPerWeek)
        ? Math.max(0, Math.min(168, Math.round(payload.availabilityHoursPerWeek)))
        : null,
    availabilityDays: parseStringArray(payload.availabilityDays, 7, 24),
    availabilityDescription: sanitizeText(payload.availabilityDescription, 500),
    contact: payload.contact === true,
  };
};

const parseRecruitmentPayload = (value: unknown): FeedRecruitmentPayload => {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error(tServer("en", "feed.error.invalidRecruitmentPayload"));
  }

  const scanlationName = sanitizeText(payload.scanlationName, 120);
  const paidWork = payload.paidWork === true;
  const roleOpenings = parseRoleOpenings(payload.roleOpenings, paidWork);
  const roles = roleOpenings.map((item) => item.role);
  const contactTypes = Array.isArray(payload.contactTypes)
    ? Array.from(
        new Set(
          payload.contactTypes
            .map((item) => normalizeRecruitmentContactType(item))
            .filter((item): item is FeedRecruitmentPayload["contactTypes"][number] => Boolean(item)),
        ),
      )
    : [];
  const candidateRequirements = parseCandidateRequirements(payload.candidateRequirements);

  if (!scanlationName || roles.length === 0 || contactTypes.length === 0) {
    throw new Error(tServer("en", "feed.error.invalidRecruitmentRequirements"));
  }

  return {
    scanlationName,
    workTitle: sanitizeText(payload.workTitle, 120),
    roles,
    roleOpenings,
    experience: sanitizeText(payload.experience, 240),
    availabilityHoursPerWeek:
      typeof payload.availabilityHoursPerWeek === "number" && Number.isFinite(payload.availabilityHoursPerWeek)
        ? Math.max(0, Math.min(168, Math.round(payload.availabilityHoursPerWeek)))
        : null,
    availabilityDays: parseStringArray(payload.availabilityDays, 7, 24),
    paidWork,
    compensation: sanitizeText(payload.compensation, 180),
    contactTypes,
    contacts: parseContactEntries(payload.contacts, 6),
    candidateRequirements,
  };
};

const parseShowcasePayload = (value: unknown): FeedShowcasePayload => {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error(tServer("en", "feed.error.invalidShowcasePayload"));
  }

  const scanlationName = sanitizeText(payload.scanlationName, 120);
  const workTitle = sanitizeText(payload.workTitle, 120);
  if (!scanlationName || !workTitle) {
    throw new Error(tServer("en", "feed.error.invalidShowcaseRequirements"));
  }

  return {
    scanlationName,
    workTitle,
    chapterLabel: sanitizeText(payload.chapterLabel, 80),
    description: sanitizeText(payload.description, 500),
    genres: parseStringArray(payload.genres, 10, 40),
  };
};

const mapFeedProfile = (
  row: typeof feedProfile.$inferSelect | null,
): FeedProfileResponse => ({
  userId: row?.userId ?? "",
  status: (row?.status as FeedProfileStatus | undefined) ?? "pending_setup",
  rulesAcceptedAt: toIso(row?.rulesAcceptedAt ?? null),
  profileCompletedAt: toIso(row?.profileCompletedAt ?? null),
  postingApprovedAt: toIso(row?.postingApprovedAt ?? null),
  postingSuspendedUntil: toIso(row?.postingSuspendedUntil ?? null),
  authorNotificationWebhookEnabled: row?.authorNotificationWebhookEnabled === true,
  authorNotificationWebhookConfigured: Boolean(row?.authorNotificationWebhookUrl),
});

const mapFeedPost = (
  row: typeof feedPost.$inferSelect,
  author: { id: string; name: string; email: string },
): FeedPostResponse => ({
  id: row.id,
  type: row.type as FeedPostType,
  title: row.title,
  summary: row.summary,
  body: row.body,
  status: row.status as FeedPostStatus,
  moderationStatus: row.moderationStatus as FeedModerationStatus,
  riskScore: row.riskScore,
  riskReasons: row.riskReasons as string[],
  externalLinks: row.externalLinks as string[],
  media: row.media as FeedPostMediaItem[],
  recruitment: (row.recruitment as FeedRecruitmentPayload | null | undefined) ?? null,
  showcase: (row.showcase as FeedShowcasePayload | null | undefined) ?? null,
  expiresAt: toIso(row.expiresAt),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  author,
});

export const getFeedProfile = async (userId: string): Promise<FeedProfileResponse> => {
  const [row] = await db.select().from(feedProfile).where(eq(feedProfile.userId, userId)).limit(1);
  return mapFeedProfile(row ?? null);
};

export const getFeedAuthorNotificationWebhookUrl = async (userId: string): Promise<string | null> => {
  const [row] = await db
    .select({
      authorNotificationWebhookUrl: feedProfile.authorNotificationWebhookUrl,
      authorNotificationWebhookEnabled: feedProfile.authorNotificationWebhookEnabled,
    })
    .from(feedProfile)
    .where(eq(feedProfile.userId, userId))
    .limit(1);

  if (!row?.authorNotificationWebhookEnabled || !row.authorNotificationWebhookUrl) {
    return null;
  }

  return row.authorNotificationWebhookUrl;
};

export const upsertFeedProfile = async (
  userId: string,
  body: unknown,
  locale: EmailLocale = "en",
): Promise<FeedProfileResponse> => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer(locale, "feed.error.invalidProfile"));
  }

  const rulesAccepted = payload.rulesAccepted === true;
  const webhookUrlRaw = sanitizeText(payload.authorNotificationWebhookUrl, 600);
  const webhookEnabled = payload.authorNotificationWebhookEnabled === true;
  const webhookValidation =
    webhookUrlRaw && webhookEnabled ? validateDiscordWebhookUrl(webhookUrlRaw, locale) : null;
  if (webhookValidation && !webhookValidation.valid) {
    throw new Error(webhookValidation.error ?? tServer(locale, "feed.error.invalidDiscordWebhook"));
  }

  const now = new Date();
  const [existing] = await db.select().from(feedProfile).where(eq(feedProfile.userId, userId)).limit(1);
  const nextStatus: FeedProfileStatus =
    existing?.postingSuspendedUntil && existing.postingSuspendedUntil.getTime() > now.getTime()
      ? "suspended"
      : rulesAccepted || existing?.rulesAcceptedAt
        ? "active"
        : "pending_setup";

  const [updated] = existing
    ? await db
        .update(feedProfile)
        .set({
          status: nextStatus,
          rulesAcceptedAt: rulesAccepted ? existing.rulesAcceptedAt ?? now : existing.rulesAcceptedAt,
          profileCompletedAt: rulesAccepted ? existing.profileCompletedAt ?? now : existing.profileCompletedAt,
          postingApprovedAt: rulesAccepted ? existing.postingApprovedAt ?? now : existing.postingApprovedAt,
          authorNotificationWebhookUrl:
            webhookValidation?.normalizedUrl ??
            (webhookEnabled ? existing.authorNotificationWebhookUrl : null),
          authorNotificationWebhookEnabled: webhookEnabled,
          updatedAt: now,
        })
        .where(eq(feedProfile.userId, userId))
        .returning()
    : await db
        .insert(feedProfile)
        .values({
          id: randomUUID(),
          userId,
          status: nextStatus,
          rulesAcceptedAt: rulesAccepted ? now : null,
          profileCompletedAt: rulesAccepted ? now : null,
          postingApprovedAt: rulesAccepted ? now : null,
          authorNotificationWebhookUrl: webhookValidation?.normalizedUrl ?? null,
          authorNotificationWebhookEnabled: webhookEnabled,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

  return mapFeedProfile(updated ?? existing ?? null);
};

export const assertCanCreateFeedPosts = async (viewer: FeedViewerContext): Promise<FeedProfileResponse> => {
  if (!viewer.emailVerified) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "auth.error.verifyEmailRequired"));
  }

  const profile = await getFeedProfile(viewer.userId);
  if (profile.status === "suspended") {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.profileSuspended"));
  }
  if (profile.status !== "active") {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.rulesNotAccepted"));
  }
  return profile;
};

export const createFeedPost = async (
  viewer: FeedViewerContext,
  body: unknown,
  options: { maxLinks: number; maxMediaItems: number; autoFlagScoreThreshold: number },
): Promise<FeedPostResponse> => {
  await assertCanCreateFeedPosts(viewer);
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidProfile"));
  }

  const type = sanitizeText(payload.type, 24) as FeedPostType | null;
  if (type !== "recruitment" && type !== "showcase") {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidPostType"));
  }

  const title = sanitizeLongText(payload.title, 120);
  const bodyText = sanitizeLongText(payload.body, 4_000);
  const summary = sanitizeText(payload.summary, 240);
  const externalLinks = parseUrlArray(payload.externalLinks, options.maxLinks);
  const media = parseMediaItems(payload.media, options.maxMediaItems);
  const recruitment = type === "recruitment" ? parseRecruitmentPayload(payload.recruitment) : null;
  const showcase = type === "showcase" ? parseShowcasePayload(payload.showcase) : null;
  const expiresAt = parseOptionalDate(payload.expiresAt);

  const risk = analyzeFeedPostRisk({
    title,
    body: bodyText,
    locale: resolveFeedLocale(viewer.locale),
    urls: [
      ...externalLinks,
      ...media.map((item) => item.directUrl),
      ...((recruitment?.contacts ?? []).flatMap((item) => (item.url ? [item.url] : []))),
    ],
  });
  if (risk.blocked) {
    throw new Error(risk.reasons[0] ?? tServer(resolveFeedLocale(viewer.locale), "feed.error.postBlocked"));
  }

  const now = new Date();
  const [author] = await db.select().from(user).where(eq(user.id, viewer.userId)).limit(1);
  if (!author) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.userNotFound"));
  }

  const [created] = await db
    .insert(feedPost)
    .values({
      id: randomUUID(),
      authorUserId: viewer.userId,
      type,
      title,
      summary,
      body: bodyText,
      status: "published",
      moderationStatus: risk.score >= options.autoFlagScoreThreshold ? "flagged" : "clean",
      riskScore: risk.score,
      riskReasons: risk.reasons,
      externalLinks,
      media,
      recruitment,
      showcase,
      flaggedAt: risk.score >= options.autoFlagScoreThreshold ? now : null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.createPostFailed"));
  }

  return mapFeedPost(created, {
    id: author.id,
    name: author.name,
    email: author.email,
  });
};

export const updateFeedPost = async (
  viewer: FeedViewerContext,
  body: unknown,
  options: { autoFlagScoreThreshold: number },
): Promise<FeedPostResponse> => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidProfile"));
  }

  const postId = sanitizeText(payload.id, 80);
  if (!postId) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.postIdRequired"));
  }

  const [existing] = await db.select().from(feedPost).where(eq(feedPost.id, postId)).limit(1);
  if (!existing) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.postNotFound"));
  }

  if (!isStaffRole(viewer.appRole) && existing.authorUserId !== viewer.userId) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "auth.error.permissionDenied"));
  }

  const status = sanitizeText(payload.status, 24) as FeedPostStatus | null;
  const moderationStatus = sanitizeText(payload.moderationStatus, 24) as FeedModerationStatus | null;
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  const nextTitle = sanitizeText(payload.title, 120);
  const nextSummary = payload.summary === null ? null : sanitizeText(payload.summary, 240);
  const nextBody = payload.body === undefined ? null : sanitizeText(payload.body, 4_000);
  const nextExternalLinks = payload.externalLinks === undefined ? null : parseUrlArray(payload.externalLinks, 8);
  const nextMedia = payload.media === undefined ? null : parseMediaItems(payload.media, 6);
  const nextExpiresAt = payload.expiresAt === undefined ? undefined : parseOptionalDate(payload.expiresAt);
  const nextRecruitment =
    payload.recruitment === undefined ? undefined : parseRecruitmentPayload(payload.recruitment);
  const nextShowcase =
    payload.showcase === undefined ? undefined : parseShowcasePayload(payload.showcase);

  if (existing.authorUserId === viewer.userId || isStaffRole(viewer.appRole)) {
    if (nextTitle) {
      updates.title = nextTitle;
    }
    if (payload.summary !== undefined) {
      updates.summary = nextSummary;
    }
    if (nextBody) {
      updates.body = nextBody;
    }
    if (nextExternalLinks) {
      updates.externalLinks = nextExternalLinks;
    }
    if (nextMedia) {
      updates.media = nextMedia;
    }
    if (payload.expiresAt !== undefined) {
      updates.expiresAt = nextExpiresAt ?? null;
    }
    if (nextRecruitment !== undefined) {
      updates.recruitment = nextRecruitment;
    }
    if (nextShowcase !== undefined) {
      updates.showcase = nextShowcase;
    }
  }

  const contentChanged =
    Boolean(nextTitle) ||
    payload.summary !== undefined ||
    Boolean(nextBody) ||
    nextExternalLinks !== null ||
    nextMedia !== null ||
    nextRecruitment !== undefined ||
    nextShowcase !== undefined;
  if (contentChanged) {
    const effectiveTitle = (updates.title as string | undefined) ?? existing.title;
    const effectiveBody = (updates.body as string | undefined) ?? existing.body;
    const effectiveLinks = (updates.externalLinks as string[] | undefined) ?? (existing.externalLinks as string[]);
    const effectiveMedia = (updates.media as FeedPostMediaItem[] | undefined) ?? (existing.media as FeedPostMediaItem[]);
    const effectiveRecruitment =
      (updates.recruitment as FeedRecruitmentPayload | undefined) ??
      ((existing.recruitment as FeedRecruitmentPayload | null | undefined) ?? null);
    const risk = analyzeFeedPostRisk({
      title: effectiveTitle,
      body: effectiveBody,
      locale: resolveFeedLocale(viewer.locale),
      urls: [
        ...effectiveLinks,
        ...effectiveMedia.map((item) => item.directUrl),
        ...((effectiveRecruitment?.contacts ?? []).flatMap((item) => (item.url ? [item.url] : []))),
      ],
    });
    if (risk.blocked) {
      throw new Error(risk.reasons[0] ?? tServer(resolveFeedLocale(viewer.locale), "feed.error.postBlocked"));
    }
    updates.riskScore = risk.score;
    updates.riskReasons = risk.reasons;
    if (!("moderationStatus" in updates)) {
      updates.moderationStatus = risk.score >= options.autoFlagScoreThreshold ? "flagged" : "clean";
      updates.flaggedAt = risk.score >= options.autoFlagScoreThreshold ? new Date() : null;
    }
  }

  if (status) {
    if (!ALLOWED_POST_STATUSES.has(status)) {
      throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidPostStatus"));
    }
    updates.status = status;
    updates.archivedAt = status === "archived" ? new Date() : null;
  }

  if (moderationStatus) {
    if (!isStaffRole(viewer.appRole)) {
      throw new Error(tServer(resolveFeedLocale(viewer.locale), "auth.error.permissionDenied"));
    }
    if (!ALLOWED_MODERATION_STATUSES.has(moderationStatus)) {
      throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidModerationStatus"));
    }
    updates.moderationStatus = moderationStatus;
    updates.hiddenAt = moderationStatus === "hidden" || moderationStatus === "removed" ? new Date() : null;
  }

  const [author] = await db.select().from(user).where(eq(user.id, existing.authorUserId)).limit(1);
  if (!author) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.userNotFound"));
  }

  const [updated] = await db
    .update(feedPost)
    .set(updates)
    .where(eq(feedPost.id, postId))
    .returning();

  return mapFeedPost(updated ?? existing, {
    id: author.id,
    name: author.name,
    email: author.email,
  });
};

export const listFeedPosts = async (params: {
  viewer: FeedViewerContext;
  type?: FeedPostType | "all";
  mine?: boolean;
}): Promise<FeedPostResponse[]> => {
  const filters = [];
  if (params.type && params.type !== "all") {
    filters.push(eq(feedPost.type, params.type));
  }
  if (params.mine) {
    filters.push(eq(feedPost.authorUserId, params.viewer.userId));
  }
  if (!isStaffRole(params.viewer.appRole)) {
    filters.push(inArray(feedPost.status, ["published", "paused", "closed", "filled"]));
    filters.push(inArray(feedPost.moderationStatus, ["clean", "flagged"]));
  }

  const rows = await db
    .select({
      post: feedPost,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(feedPost)
    .innerJoin(user, eq(user.id, feedPost.authorUserId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(feedPost.createdAt));

  return rows.map((row) =>
    mapFeedPost(row.post, {
      id: row.authorId,
      name: row.authorName,
      email: row.authorEmail,
    }),
  );
};

export const getFeedPostDetail = async (
  viewer: FeedViewerContext,
  postId: string,
): Promise<FeedPostResponse> => {
  const rows = await db
    .select({
      post: feedPost,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(feedPost)
    .innerJoin(user, eq(user.id, feedPost.authorUserId))
    .where(eq(feedPost.id, postId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.postNotFound"));
  }

  if (!isStaffRole(viewer.appRole)) {
    const visibleStatus = ["published", "paused", "closed", "filled"];
    const visibleModeration = ["clean", "flagged"];
    if (!visibleStatus.includes(row.post.status) || !visibleModeration.includes(row.post.moderationStatus)) {
      throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.postNotFound"));
    }
  }

  return mapFeedPost(row.post, {
    id: row.authorId,
    name: row.authorName,
    email: row.authorEmail,
  });
};

export const createFeedApplication = async (
  viewer: FeedViewerContext,
  postId: string,
  body: unknown,
): Promise<FeedApplicationResponse> => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidApplication"));
  }

  const [postRow] = await db.select().from(feedPost).where(eq(feedPost.id, postId)).limit(1);
  if (!postRow || postRow.type !== "recruitment") {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.recruitmentNotFound"));
  }
  if (postRow.authorUserId === viewer.userId) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.selfApplication"));
  }

  const message = sanitizeLongText(payload.message, 1_500);
  const experience = sanitizeText(payload.experience, 500);
  const availabilityHoursPerWeek =
    typeof payload.availabilityHoursPerWeek === "number" && Number.isFinite(payload.availabilityHoursPerWeek)
      ? Math.max(0, Math.min(168, Math.round(payload.availabilityHoursPerWeek)))
      : null;
  const availabilityDays = parseStringArray(payload.availabilityDays, 7, 24);
  const preferredContactPayload = asRecord(payload.preferredContact);
  const preferredContactType = normalizeInternalContactType(preferredContactPayload?.type);
  const preferredContactValue = sanitizeText(preferredContactPayload?.value, 180);
  const preferredContact =
    preferredContactType && preferredContactValue
      ? ({ type: preferredContactType, value: preferredContactValue } satisfies FeedApplicationContact)
      : null;
  const portfolioLinks = parseUrlArray(payload.portfolioLinks, 6);
  const now = new Date();
  const requirements =
    (postRow.recruitment as FeedRecruitmentPayload | null | undefined)?.candidateRequirements ?? null;

  if (requirements?.portfolio && portfolioLinks.length === 0) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.portfolioRequired"));
  }
  if (requirements?.experience && !experience) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.experienceRequired"));
  }
  if (requirements?.availability) {
    const hasAvailability =
      availabilityHoursPerWeek !== null ||
      availabilityDays.length > 0 ||
      Boolean(sanitizeText(payload.availabilityDescription, 500));
    if (!hasAvailability) {
      throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.availabilityRequired"));
    }
  }
  if (requirements?.contact && !preferredContact) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.contactRequired"));
  }

  const [applicant] = await db.select().from(user).where(eq(user.id, viewer.userId)).limit(1);
  if (!applicant) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.userNotFound"));
  }

  const [created] = await db
    .insert(feedApplication)
    .values({
      id: randomUUID(),
      postId,
      applicantUserId: viewer.userId,
      status: "submitted",
      message,
      experience,
      availabilityHoursPerWeek,
      availabilityDays,
      preferredContact,
      portfolioLinks,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.duplicateApplication"));
  }

  return {
    id: created.id,
    postId,
    postTitle: postRow.title,
    applicantUserId: applicant.id,
    applicantName: applicant.name,
    applicantEmail: applicant.email,
    status: created.status as FeedApplicationStatus,
    message: created.message,
    experience: created.experience,
    availabilityHoursPerWeek: created.availabilityHoursPerWeek,
    availabilityDays: created.availabilityDays as string[],
    preferredContact: (created.preferredContact as FeedApplicationContact | null | undefined) ?? null,
    portfolioLinks: created.portfolioLinks as string[],
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
};

const mapFeedApplicationRow = (
  row: {
    application: typeof feedApplication.$inferSelect;
    postTitle: string;
    applicantId: string;
    applicantName: string;
    applicantEmail: string;
  },
): FeedApplicationResponse => ({
  id: row.application.id,
  postId: row.application.postId,
  postTitle: row.postTitle,
  applicantUserId: row.applicantId,
  applicantName: row.applicantName,
  applicantEmail: row.applicantEmail,
  status: row.application.status as FeedApplicationStatus,
  message: row.application.message,
  experience: row.application.experience,
  availabilityHoursPerWeek: row.application.availabilityHoursPerWeek,
  availabilityDays: row.application.availabilityDays as string[],
  preferredContact: (row.application.preferredContact as FeedApplicationContact | null | undefined) ?? null,
  portfolioLinks: row.application.portfolioLinks as string[],
  createdAt: row.application.createdAt.toISOString(),
  updatedAt: row.application.updatedAt.toISOString(),
});

export const listSentFeedApplications = async (viewerUserId: string): Promise<FeedApplicationResponse[]> => {
  const rows = await db
    .select({
      application: feedApplication,
      postTitle: feedPost.title,
      applicantId: user.id,
      applicantName: user.name,
      applicantEmail: user.email,
    })
    .from(feedApplication)
    .innerJoin(feedPost, eq(feedPost.id, feedApplication.postId))
    .innerJoin(user, eq(user.id, feedApplication.applicantUserId))
    .where(eq(feedApplication.applicantUserId, viewerUserId))
    .orderBy(desc(feedApplication.createdAt));

  return rows.map(mapFeedApplicationRow);
};

export const listReceivedFeedApplications = async (
  viewer: FeedViewerContext,
): Promise<FeedApplicationResponse[]> => {
  const rows = await db
    .select({
      application: feedApplication,
      postTitle: feedPost.title,
      applicantId: user.id,
      applicantName: user.name,
      applicantEmail: user.email,
    })
    .from(feedApplication)
    .innerJoin(feedPost, eq(feedPost.id, feedApplication.postId))
    .innerJoin(user, eq(user.id, feedApplication.applicantUserId))
    .where(isStaffRole(viewer.appRole) ? undefined : eq(feedPost.authorUserId, viewer.userId))
    .orderBy(desc(feedApplication.createdAt));

  return rows.map(mapFeedApplicationRow);
};

export const updateFeedApplication = async (
  viewer: FeedViewerContext,
  applicationId: string,
  body: unknown,
): Promise<FeedApplicationResponse> => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidApplication"));
  }

  const status = sanitizeText(payload.status, 24) as FeedApplicationStatus | null;
  if (!status || !ALLOWED_APPLICATION_STATUSES.has(status)) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.invalidApplicationStatus"));
  }

  const rows = await db
    .select({
      application: feedApplication,
      postTitle: feedPost.title,
      postAuthorId: feedPost.authorUserId,
      applicantId: user.id,
      applicantName: user.name,
      applicantEmail: user.email,
    })
    .from(feedApplication)
    .innerJoin(feedPost, eq(feedPost.id, feedApplication.postId))
    .innerJoin(user, eq(user.id, feedApplication.applicantUserId))
    .where(eq(feedApplication.id, applicationId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "feed.error.applicationNotFound"));
  }

  const isApplicant = row.application.applicantUserId === viewer.userId;
  const isOwner = row.postAuthorId === viewer.userId;
  const isStaff = isStaffRole(viewer.appRole);
  if (!isStaff && !isOwner && !(isApplicant && status === "withdrawn")) {
    throw new Error(tServer(resolveFeedLocale(viewer.locale), "auth.error.permissionDenied"));
  }

  const [updated] = await db
    .update(feedApplication)
    .set({
      status,
      reviewerUserId: isOwner || isStaff ? viewer.userId : row.application.reviewerUserId,
      reviewedAt: isOwner || isStaff ? new Date() : row.application.reviewedAt,
      updatedAt: new Date(),
    })
    .where(eq(feedApplication.id, applicationId))
    .returning();

  return mapFeedApplicationRow({
    application: updated ?? row.application,
    postTitle: row.postTitle,
    applicantId: row.applicantId,
    applicantName: row.applicantName,
    applicantEmail: row.applicantEmail,
  });
};

export const createFeedReport = async (
  viewerUserId: string,
  postId: string,
  body: unknown,
): Promise<FeedReportResponse> => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer("en", "feed.error.invalidReport"));
  }

  const reasonCode = sanitizeLongText(payload.reasonCode, 40);
  const details = sanitizeText(payload.details, 800);
  const [postRow] = await db.select().from(feedPost).where(eq(feedPost.id, postId)).limit(1);
  if (!postRow) {
    throw new Error(tServer("en", "feed.error.postNotFound"));
  }

  const [reporter] = await db.select().from(user).where(eq(user.id, viewerUserId)).limit(1);
  if (!reporter) {
    throw new Error(tServer("en", "feed.error.userNotFound"));
  }

  const now = new Date();
  const evidence: FeedReportEvidence[] = [
    {
      source: "user",
      note: details ?? reasonCode,
      createdAt: now.toISOString(),
    },
  ];
  const [created] = await db
    .insert(feedReport)
    .values({
      id: randomUUID(),
      postId,
      reporterUserId: viewerUserId,
      reasonCode,
      details,
      status: "open",
      evidence,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(tServer("en", "feed.error.createReportFailed"));
  }

  await db
    .update(feedPost)
    .set({
      moderationStatus: postRow.moderationStatus === "clean" ? "flagged" : postRow.moderationStatus,
      flaggedAt: postRow.moderationStatus === "clean" ? now : postRow.flaggedAt,
      updatedAt: now,
    })
    .where(eq(feedPost.id, postId));

  return {
    id: created.id,
    postId,
    postTitle: postRow.title,
    reasonCode: created.reasonCode,
    details: created.details,
    status: created.status as FeedReportStatus,
    reporter: {
      id: reporter.id,
      name: reporter.name,
      email: reporter.email,
    },
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
};

export const listFeedReports = async (): Promise<FeedReportResponse[]> => {
  const rows = await db
    .select({
      report: feedReport,
      postTitle: feedPost.title,
      reporterId: user.id,
      reporterName: user.name,
      reporterEmail: user.email,
    })
    .from(feedReport)
    .innerJoin(feedPost, eq(feedPost.id, feedReport.postId))
    .innerJoin(user, eq(user.id, feedReport.reporterUserId))
    .orderBy(desc(feedReport.createdAt));

  return rows.map((row) => ({
    id: row.report.id,
    postId: row.report.postId,
    postTitle: row.postTitle,
    reasonCode: row.report.reasonCode,
    details: row.report.details,
    status: row.report.status as FeedReportStatus,
    reporter: {
      id: row.reporterId,
      name: row.reporterName,
      email: row.reporterEmail,
    },
    createdAt: row.report.createdAt.toISOString(),
    updatedAt: row.report.updatedAt.toISOString(),
  }));
};

export const updateFeedReport = async (
  moderatorUserId: string,
  reportId: string,
  body: unknown,
): Promise<FeedReportResponse> => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tServer("en", "feed.error.invalidReport"));
  }

  const status = sanitizeText(payload.status, 24) as FeedReportStatus | null;
  if (!status || !ALLOWED_REPORT_STATUSES.has(status)) {
    throw new Error(tServer("en", "feed.error.invalidReportStatus"));
  }

  const resolutionNotes = sanitizeText(payload.resolutionNotes, 800);
  const rows = await db
    .select({
      report: feedReport,
      postTitle: feedPost.title,
      reporterId: user.id,
      reporterName: user.name,
      reporterEmail: user.email,
    })
    .from(feedReport)
    .innerJoin(feedPost, eq(feedPost.id, feedReport.postId))
    .innerJoin(user, eq(user.id, feedReport.reporterUserId))
    .where(eq(feedReport.id, reportId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(tServer("en", "feed.error.reportNotFound"));
  }

  const [updated] = await db
    .update(feedReport)
    .set({
      status,
      resolutionNotes,
      resolvedByUserId: status === "resolved" || status === "dismissed" ? moderatorUserId : null,
      resolvedAt: status === "resolved" || status === "dismissed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(feedReport.id, reportId))
    .returning();

  return {
    id: (updated ?? row.report).id,
    postId: (updated ?? row.report).postId,
    postTitle: row.postTitle,
    reasonCode: (updated ?? row.report).reasonCode,
    details: (updated ?? row.report).details,
    status: (updated ?? row.report).status as FeedReportStatus,
    reporter: {
      id: row.reporterId,
      name: row.reporterName,
      email: row.reporterEmail,
    },
    createdAt: (updated ?? row.report).createdAt.toISOString(),
    updatedAt: (updated ?? row.report).updatedAt.toISOString(),
  };
};

export const buildApplicationNotificationWebhookPayload = (
  application: FeedApplicationResponse,
  post: FeedPostResponse,
): Record<string, unknown> => ({
  username: tServer("en", "feed.webhook.application.username"),
  embeds: [
    {
      title: tServer("en", "feed.webhook.application.title"),
      description: tServer("en", "feed.webhook.application.description", {
        applicantName: application.applicantName,
        postTitle: post.title,
      }),
      color: 0x06b6d4,
      timestamp: new Date().toISOString(),
      fields: [
        { name: tServer("en", "feed.webhook.application.field.post"), value: post.title, inline: false },
        {
          name: tServer("en", "feed.webhook.application.field.applicant"),
          value: `${application.applicantName} (${application.applicantEmail})`,
          inline: false,
        },
        { name: tServer("en", "feed.webhook.application.field.status"), value: application.status, inline: true },
      ],
    },
  ],
});

export const buildReportModerationWebhookPayload = (
  report: FeedReportResponse,
): Record<string, unknown> => ({
  username: tServer("en", "feed.webhook.report.username"),
  embeds: [
    {
      title: tServer("en", "feed.webhook.report.title"),
      description: tServer("en", "feed.webhook.report.description", {
        reporterName: report.reporter.name,
        postTitle: report.postTitle,
      }),
      color: 0xf59e0b,
      timestamp: new Date().toISOString(),
      fields: [
        { name: tServer("en", "feed.webhook.report.field.reason"), value: report.reasonCode, inline: true },
        { name: tServer("en", "feed.webhook.report.field.status"), value: report.status, inline: true },
        {
          name: tServer("en", "feed.webhook.report.field.details"),
          value: report.details ?? tServer("en", "feed.webhook.report.noDetails"),
          inline: false,
        },
      ],
    },
  ],
});
