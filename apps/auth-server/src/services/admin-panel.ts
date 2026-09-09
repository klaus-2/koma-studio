import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { db } from "../db/client.js";
import {
  feedApplication,
  feedPost,
  feedProfile,
  feedReport,
  guideCategory,
  guideEntry,
  resourceCategory,
  resourceEntry,
  session,
  user,
  userBan,
} from "../db/schema.js";
import { isBanActive } from "./bans.js";
import { canManageBans, canManageModeration, isOwnerRole, type AppRole, normalizeAppRole } from "./app-roles.js";
import type { EmailLocale } from "./locale.js";
import { tServer } from "./server-i18n.js";

const tAdmin = (locale: EmailLocale, key: string): string => tServer(locale, key);

const parsePositiveInteger = (value: unknown, fallback: number, max: number): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.round(numeric)));
};

const sanitizeQuery = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const sanitizeOptionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalized || null;
};

const getActiveBanForUser = async (userId: string): Promise<{ id: string; reason: string; expiresAt: string | null } | null> => {
  const rows = await db
    .select()
    .from(userBan)
    .where(eq(userBan.targetUserId, userId))
    .orderBy(desc(userBan.createdAt));

  const active = rows.find((row) =>
    isBanActive({
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      liftedAt: row.liftedAt,
    }),
  );

  if (!active) {
    return null;
  }

  return {
    id: active.id,
    reason: active.reason,
    expiresAt: active.expiresAt?.toISOString() ?? null,
  };
};

export const buildAdminPermissions = (role: AppRole) => ({
  accessPanel: role === "moderator" || role === "admin" || role === "owner",
  manageUsers: role === "admin" || role === "owner",
  manageRoles: isOwnerRole(role),
  manageContent: role === "admin" || role === "owner",
  moderateFeed: canManageModeration(role),
  manageBans: canManageBans(role),
});

export const getAdminOverview = async (): Promise<{
  metrics: {
    totalUsers: number;
    staffUsers: number;
    openReports: number;
    flaggedPosts: number;
    activeBans: number;
    publishedGuides: number;
    publishedResources: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    appRole: AppRole;
    createdAt: string;
    feedProfileStatus: string | null;
  }>;
}> => {
  const [
    users,
    reports,
    posts,
    bans,
    publishedGuideEntries,
    publishedResourceEntries,
    recentUsersRows,
  ] = await Promise.all([
    db.select().from(user),
    db.select({ id: feedReport.id }).from(feedReport).where(inArray(feedReport.status, ["open", "reviewing"])),
    db.select({ id: feedPost.id }).from(feedPost).where(inArray(feedPost.moderationStatus, ["flagged", "hidden"])),
    db.select().from(userBan).orderBy(desc(userBan.createdAt)),
    db.select({ id: guideEntry.id }).from(guideEntry).where(eq(guideEntry.status, "published")),
    db.select({ id: resourceEntry.id }).from(resourceEntry).where(eq(resourceEntry.status, "published")),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        appRole: user.appRole,
        createdAt: user.createdAt,
        feedProfileStatus: feedProfile.status,
      })
      .from(user)
      .leftJoin(feedProfile, eq(feedProfile.userId, user.id))
      .orderBy(desc(user.createdAt))
      .limit(8),
  ]);

  const activeBans = bans.filter((row) =>
    isBanActive({
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      liftedAt: row.liftedAt,
    }),
  );

  return {
    metrics: {
      totalUsers: users.length,
      staffUsers: users.filter((row) => normalizeAppRole(row.appRole) !== "user").length,
      openReports: reports.length,
      flaggedPosts: posts.length,
      activeBans: activeBans.length,
      publishedGuides: publishedGuideEntries.length,
      publishedResources: publishedResourceEntries.length,
    },
    recentUsers: recentUsersRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      appRole: normalizeAppRole(row.appRole),
      createdAt: row.createdAt.toISOString(),
      feedProfileStatus: row.feedProfileStatus ?? null,
    })),
  };
};

export const listAdminUsers = async (params: {
  query?: string;
  role?: string;
  emailVerified?: string;
  page?: number;
  pageSize?: number;
}) => {
  const page = parsePositiveInteger(params.page, 1, 999);
  const pageSize = parsePositiveInteger(params.pageSize, 20, 100);
  const query = sanitizeQuery(params.query);
  const filters = [];

  if (query) {
    filters.push(or(ilike(user.email, `%${query}%`), ilike(user.name, `%${query}%`)));
  }
  if (params.role && ["user", "moderator", "admin", "owner"].includes(params.role)) {
    filters.push(eq(user.appRole, params.role));
  }
  if (params.emailVerified === "true") {
    filters.push(eq(user.emailVerified, true));
  }
  if (params.emailVerified === "false") {
    filters.push(eq(user.emailVerified, false));
  }

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      appRole: user.appRole,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      feedProfileStatus: feedProfile.status,
    })
    .from(user)
    .leftJoin(feedProfile, eq(feedProfile.userId, user.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(user.createdAt));

  const total = rows.length;
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const activeBanLookups = await Promise.all(pagedRows.map((row) => getActiveBanForUser(row.id)));

  return {
    page,
    pageSize,
    total,
    users: pagedRows.map((row, index) => ({
      ...row,
      appRole: normalizeAppRole(row.appRole),
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      feedProfileStatus: row.feedProfileStatus ?? null,
      activeBan: activeBanLookups[index],
    })),
  };
};

export const getAdminUserDetail = async (userId: string, locale: EmailLocale = "en") => {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      appRole: user.appRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      failedLoginAttempts: user.failedLoginAttempts,
      feedProfileStatus: feedProfile.status,
      feedProfileUpdatedAt: feedProfile.updatedAt,
    })
    .from(user)
    .leftJoin(feedProfile, eq(feedProfile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) {
    throw new Error(tAdmin(locale, "auth.admin.userNotFound"));
  }

  const [activeBan, sessionRows] = await Promise.all([
    getActiveBanForUser(userId),
    db.select({ id: session.id, expiresAt: session.expiresAt, createdAt: session.createdAt }).from(session).where(eq(session.userId, userId)),
  ]);

  return {
    ...row,
    appRole: normalizeAppRole(row.appRole),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    feedProfileStatus: row.feedProfileStatus ?? null,
    feedProfileUpdatedAt: row.feedProfileUpdatedAt?.toISOString() ?? null,
    activeBan,
    sessions: sessionRows.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
    })),
  };
};

export const updateAdminUser = async (
  targetUserId: string,
  actorRole: AppRole,
  body: unknown,
  locale: EmailLocale = "en",
) => {
  const payload = asRecord(body);
  if (!payload) {
    throw new Error(tAdmin(locale, "auth.admin.userPayloadInvalid"));
  }

  const [current] = await db.select().from(user).where(eq(user.id, targetUserId)).limit(1);
  if (!current) {
    throw new Error(tAdmin(locale, "auth.admin.userNotFound"));
  }

  const nextRole =
    typeof payload.appRole === "string" && ["user", "moderator", "admin", "owner"].includes(payload.appRole)
      ? (payload.appRole as AppRole)
      : undefined;

  if (nextRole && !isOwnerRole(actorRole)) {
    throw new Error(tAdmin(locale, "auth.admin.roleChangeOwnerOnly"));
  }

  const [updated] = await db
    .update(user)
    .set({
      name: payload.name !== undefined ? sanitizeOptionalText(payload.name, 160) ?? current.name : undefined,
      emailVerified: payload.emailVerified !== undefined ? payload.emailVerified === true : undefined,
      appRole: nextRole,
      updatedAt: new Date(),
    })
    .where(eq(user.id, targetUserId))
    .returning();

  if (!updated) {
    throw new Error(tAdmin(locale, "auth.admin.userNotFound"));
  }

  return getAdminUserDetail(updated.id, locale);
};

export const listAdminFeedProfiles = async () => {
  const rows = await db
    .select({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      appRole: user.appRole,
      status: feedProfile.status,
      rulesAcceptedAt: feedProfile.rulesAcceptedAt,
      profileCompletedAt: feedProfile.profileCompletedAt,
      postingApprovedAt: feedProfile.postingApprovedAt,
      postingSuspendedUntil: feedProfile.postingSuspendedUntil,
      webhookEnabled: feedProfile.authorNotificationWebhookEnabled,
      updatedAt: feedProfile.updatedAt,
    })
    .from(feedProfile)
    .innerJoin(user, eq(user.id, feedProfile.userId))
    .orderBy(desc(feedProfile.updatedAt));

  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    appRole: normalizeAppRole(row.appRole),
    status: row.status,
    rulesAcceptedAt: row.rulesAcceptedAt?.toISOString() ?? null,
    profileCompletedAt: row.profileCompletedAt?.toISOString() ?? null,
    postingApprovedAt: row.postingApprovedAt?.toISOString() ?? null,
    postingSuspendedUntil: row.postingSuspendedUntil?.toISOString() ?? null,
    webhookEnabled: row.webhookEnabled,
    updatedAt: row.updatedAt.toISOString(),
  }));
};

export const listAdminFeedApplications = async () => {
  const rows = await db
    .select({
      id: feedApplication.id,
      status: feedApplication.status,
      message: feedApplication.message,
      createdAt: feedApplication.createdAt,
      updatedAt: feedApplication.updatedAt,
      postId: feedPost.id,
      postTitle: feedPost.title,
      applicantId: user.id,
      applicantName: user.name,
      applicantEmail: user.email,
    })
    .from(feedApplication)
    .innerJoin(feedPost, eq(feedPost.id, feedApplication.postId))
    .innerJoin(user, eq(user.id, feedApplication.applicantUserId))
    .orderBy(desc(feedApplication.createdAt));

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    postId: row.postId,
    postTitle: row.postTitle,
    applicantId: row.applicantId,
    applicantName: row.applicantName,
    applicantEmail: row.applicantEmail,
  }));
};
