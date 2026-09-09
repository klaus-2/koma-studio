import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { toNodeHandler } from "better-auth/node";

import { auth } from "../auth/config.js";
import { normalizeAuthErrorPayload } from "../auth/error-normalization.js";
import { buildAuthForwardHeaders } from "../auth/forward-headers.js";
import { authenticateBearerToken, issueAccessToken } from "../auth/middleware.js";
import { normalizeEmail, sanitizeName } from "../auth/validators.js";
import { env, validateEnv } from "../config/env.js";
import { db } from "../db/client.js";
import {
  desktopAuthDevice,
  desktopTravelToken,
  legalAcceptance,
  session,
  type FeedReportEvidence,
  user,
} from "../db/schema.js";
import { parseLegalAcceptancePayload } from "../legal/acceptance.js";
import {
  clearFailedLoginAttempts,
  clearUserLock,
  detectLoginAnomaly,
  findUserByEmail,
  getFailedLoginAttempts,
  increaseFailedLoginAttempts,
  isUserLocked,
  lockUserForBruteForce,
  recordSecurityLog,
  updateUserLoginMeta,
} from "../security/anomaly.js";
import { getClientIp } from "../security/client-ip.js";
import { validatePassword } from "../security/password.js";
import {
  assertRegistrationAllowed,
  extractDesktopRegistrationSignals,
  isRegistrationIdentityConflictError,
  persistRegistrationIdentity,
} from "../security/registration-guard.js";
import {
  dashboardLaunchLimiter,
  desktopBootstrapLimiter,
  forgotPasswordLimiter,
  generalLimiter,
  loginLimiter,
  modelReviewMutationLimiter,
  registerLimiter,
  resetPasswordLimiter,
} from "../security/rate-limiter.js";
import {
  forgotPasswordValidation,
  handleValidationErrors,
  loginValidation,
  preventPathTraversal,
  resetPasswordValidation,
  registerValidation,
  wafHelmet,
} from "../security/waf.js";
import { applySensitiveResponseHeaders } from "../security/response-headers.js";
import { closeRedis, connectRedis } from "../services/redis.js";
import { isEmailDeliveryEnabled, sendDesktopTravelTokenEmail } from "../services/email.js";
import {
  detectLocaleFromAcceptLanguage,
  normalizeEmailLocale,
  resolvePreferredEmailLocale,
} from "../services/locale.js";
import { resolveLocaleFromHeaders, tServer } from "../services/server-i18n.js";
import { isMandatoryUpdatePending, type DesktopUpdateRequirement } from "../services/update-policy.js";
import {
  deleteModelReview,
  getModelReviewDetail,
  listModelReviewLeaderboard,
  parseModelReviewInput,
  upsertModelReview,
  type ModelReviewQueryFilters,
  type ModelReviewRankingMetric,
} from "../services/model-reviews.js";
import {
  canAccessAdminPanel,
  canManageBans,
  canManageContent,
  canManageUsers,
  isOwnerRole,
  normalizeAppRole,
  type AppRole,
} from "../services/app-roles.js";
import {
  buildBanCheckSignalsForRequest,
  createBanForUser,
  deleteAuthSessionsForUser,
  findActiveBanForSignals,
  listModerationBans,
  updateBanState,
  type ActiveBanMatch,
} from "../services/ban-enforcement.js";
import {
  buildApplicationNotificationWebhookPayload,
  buildReportModerationWebhookPayload,
  createFeedApplication,
  createFeedPost,
  createFeedReport,
  getFeedAuthorNotificationWebhookUrl,
  getFeedPostDetail,
  getFeedProfile,
  listFeedPosts,
  listFeedReports,
  listReceivedFeedApplications,
  listSentFeedApplications,
  updateFeedApplication,
  updateFeedPost,
  updateFeedReport,
  upsertFeedProfile,
  type FeedViewerContext,
} from "../services/feed.js";
import {
  createGuideCategory,
  createGuideEntry,
  createResourceCategory,
  createResourceEntry,
  deleteGuideCategory,
  deleteGuideEntry,
  deleteResourceCategory,
  deleteResourceEntry,
  ensureContentCatalogSeeded,
  getAdminGuideCatalog,
  getAdminResourceCatalog,
  getPublishedGuideCatalog,
  getPublishedResourceCatalog,
  updateGuideCategory,
  updateGuideEntry,
  updateResourceCategory,
  updateResourceEntry,
} from "../services/content-catalog.js";
import {
  buildAdminPermissions,
  getAdminOverview,
  getAdminUserDetail,
  listAdminFeedApplications,
  listAdminFeedProfiles,
  listAdminUsers,
  updateAdminUser,
} from "../services/admin-panel.js";
import { sendDiscordWebhook } from "../services/discord-webhooks.js";
import { logger } from "../utils/logger.js";

export const jsonParser = express.json({ limit: "1mb" });
export const urlEncodedParser = express.urlencoded({ extended: false, limit: "1mb" });
export const betterAuthHandler = toNodeHandler(auth);

export const BRUTE_FORCE_LOCK_THRESHOLD = 8;
export const BRUTE_FORCE_LOCK_MINUTES = 30;

export interface AuthSessionUser {
  id: string;
  email: string;
  name?: string;
}

export type UserRow = typeof user.$inferSelect;

export interface AuthUserResponsePayload {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  locale: string;
  appRole: AppRole;
  feedProfileStatus: string;
  authorNotificationWebhookConfigured: boolean;
  activeBan: null;
}

export const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

export const parseJsonSafely = async (response: globalThis.Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const appendHeaders = (source: Headers, target: Response): void => {
  source.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      target.append("set-cookie", value);
      return;
    }

    target.setHeader(key, value);
  });
};

export const AUTH_ERROR_RESPONSE_KEYS = [
  "details",
  "requiresCaptcha",
  "requiresVerification",
  "retryAfterSeconds",
  "retryAt",
  "verificationHint",
] as const;

export const pickAuthErrorResponseExtras = (payload: unknown): Record<string, unknown> => {
  const source = asObject(payload);
  if (!source) {
    return {};
  }

  const extras: Record<string, unknown> = {};
  for (const key of AUTH_ERROR_RESPONSE_KEYS) {
    if (source[key] !== undefined) {
      extras[key] = source[key];
    }
  }

  return extras;
};

export const buildNormalizedAuthErrorBody = (
  payload: unknown,
  options: {
    fallbackError: string;
    fallbackCode?: string;
    locale?: import("../services/locale.js").EmailLocale;
  },
): Record<string, unknown> => ({
  ...pickAuthErrorResponseExtras(payload),
  ...normalizeAuthErrorPayload(payload, options),
});

export const sendAuthError = (
  res: Response,
  status: number,
  body: Record<string, unknown>,
): Response => res.status(status).json(body);

export const sendNormalizedAuthApiError = async (
  res: Response,
  response: globalThis.Response,
  options: {
    fallbackError: string;
    fallbackCode?: string;
    locale?: import("../services/locale.js").EmailLocale;
  },
): Promise<Response> => {
  const payload = await parseJsonSafely(response);
  return sendAuthError(res, response.status, buildNormalizedAuthErrorBody(payload, options));
};

export const shouldEnforceCaptcha = async (email: string, ipAddress: string): Promise<boolean> => {
  const failedAttempts = await getFailedLoginAttempts(email, ipAddress);
  return failedAttempts >= 3;
};

export const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return numberValue;
};

export const parseTrimmedQuery = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value.trim() : fallback;

export const parseModelReviewRankingMetric = (value: unknown): ModelReviewRankingMetric => {
  const normalized = parseTrimmedQuery(value).toLowerCase();
  if (
    normalized === "overall" ||
    normalized === "quality" ||
    normalized === "speed" ||
    normalized === "costbenefit" ||
    normalized === "easeofuse"
  ) {
    if (normalized === "costbenefit") {
      return "costBenefit";
    }
    if (normalized === "easeofuse") {
      return "easeOfUse";
    }
    return normalized;
  }

  return "overall";
};

export const parseModelReviewStage = (value: unknown): ModelReviewQueryFilters["stage"] => {
  const normalized = parseTrimmedQuery(value).toLowerCase();
  if (
    normalized === "translation" ||
    normalized === "detecttext" ||
    normalized === "recognizetext" ||
    normalized === "segmenttext" ||
    normalized === "cleanimage"
  ) {
    if (normalized === "detecttext") return "detectText";
    if (normalized === "recognizetext") return "recognizeText";
    if (normalized === "segmenttext") return "segmentText";
    if (normalized === "cleanimage") return "cleanImage";
    return "translation";
  }

  return "all";
};

export const parseModelReviewSource = (value: unknown): ModelReviewQueryFilters["source"] => {
  const normalized = parseTrimmedQuery(value).toLowerCase();
  if (normalized === "local" || normalized === "cloud") {
    return normalized;
  }

  return "all";
};

export const resolveSessionUser = (sessionPayload: unknown): AuthSessionUser | null => {
  const root = asObject(sessionPayload);
  const data = asObject(root?.data) ?? root;
  const userData = asObject(data?.user);

  const userId = typeof userData?.id === "string" ? userData.id : null;
  const email = typeof userData?.email === "string" ? userData.email : null;
  if (!userId || !email) {
    return null;
  }

  return {
    id: userId,
    email,
    name: typeof userData?.name === "string" ? userData.name : undefined,
  };
};

export const resolveSessionId = (sessionPayload: unknown): string | null => {
  const root = asObject(sessionPayload);
  const data = asObject(root?.data) ?? root;
  const sessionData = asObject(data?.session);
  const sessionId = typeof sessionData?.id === "string" ? sessionData.id.trim() : "";
  return sessionId || null;
};

export const getUserById = async (userId: string): Promise<UserRow | null> => {
  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return row ?? null;
};

export const readLocaleHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.trim().length > 0)?.trim() ?? null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
};

export const detectRequestLocale = (
  req: Request,
  body?: Record<string, unknown> | null,
): string | null => {
  const explicitLocale =
    (typeof body?.locale === "string" ? body.locale : null) ??
    (typeof req.query.locale === "string" ? req.query.locale : null) ??
    readLocaleHeaderValue(req.headers["x-koma-locale"]);

  return resolvePreferredEmailLocale({
    explicitLocale,
    acceptLanguage: readLocaleHeaderValue(req.headers["accept-language"]),
  });
};

export const syncUserLocaleIfNeeded = async (
  row: UserRow,
  locale: string | null | undefined,
): Promise<UserRow> => {
  const normalizedLocale = normalizeEmailLocale(locale);
  if (!normalizedLocale || row.locale === normalizedLocale) {
    return row;
  }

  const [updated] = await db
    .update(user)
    .set({
      locale: normalizedLocale,
      updatedAt: new Date(),
    })
    .where(eq(user.id, row.id))
    .returning();

  return updated ?? { ...row, locale: normalizedLocale };
};

export const ensureFeedViewerContext = async (userId: string): Promise<FeedViewerContext & { user: UserRow }> => {
  const userRow = await getUserById(userId);
  if (!userRow) {
    throw new Error(tServer("en", "auth.error.userNotFound"));
  }

  return {
    userId: userRow.id,
    appRole: normalizeAppRole(userRow.appRole),
    emailVerified: userRow.emailVerified,
    locale: userRow.locale ?? null,
    user: userRow,
  };
};

export const bootstrapOwnerRoleIfNeeded = async (userId: string): Promise<void> => {
  const [staffUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.appRole, ["owner", "admin"]))
    .limit(1);

  if (staffUser) {
    return;
  }

  await db
    .update(user)
    .set({
      appRole: "owner",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
};

export const getRequestDesktopDeviceId = (_req: Request, _body?: Record<string, unknown> | null): string | null =>
  null;

export const getRequestDesktopMacFingerprint = (_body?: Record<string, unknown> | null): string | null =>
  null;

export const activeBanToPayload = (activeBan: ActiveBanMatch) => activeBan.presentation;

export const sendActiveBanResponse = (
  res: Response,
  route: string,
  activeBan: ActiveBanMatch,
): Response =>
  sendAuthError(
    res,
    403,
    {
      error: tServer(resolveLocaleFromHeaders(res.req.headers), "auth.error.permissionDenied"),
      code: "AUTH_BANNED",
      activeBan: activeBanToPayload(activeBan),
    }
  );

export const requireNoActiveBan = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.tokenMissing"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  if (authUser.sessionId && authUser.sessionId !== "cookie-session") {
    const [activeSession] = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.id, authUser.sessionId), eq(session.userId, authUser.sub)))
      .limit(1);
    if (!activeSession) {
      return res.status(401).json({
        error: tServer(locale, "auth.error.sessionRequired"),
        code: "AUTH_SESSION_REQUIRED",
      });
    }
  }

  const body = asObject(req.body);
  const activeBan = await findActiveBanForSignals(
    buildBanCheckSignalsForRequest(req, {
      userId: authUser.sub,
      desktopDeviceId: getRequestDesktopDeviceId(req, body),
      desktopMacFingerprint: getRequestDesktopMacFingerprint(body),
    }),
  );
  if (activeBan) {
    return sendActiveBanResponse(res, req.path, activeBan);
  }

  next();
};

export const requireModerationAccess = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.notAuthenticated"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const viewer = await ensureFeedViewerContext(authUser.sub);
  if (!canManageBans(viewer.appRole)) {
    return res.status(403).json({
      error: tServer(locale, "auth.error.permissionDenied"),
      code: "AUTH_FORBIDDEN",
    });
  }

  next();
};

export const requireBanManagementAccess = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.notAuthenticated"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const viewer = await ensureFeedViewerContext(authUser.sub);
  if (!canManageBans(viewer.appRole)) {
    return res.status(403).json({
      error: tServer(locale, "auth.error.permissionDenied"),
      code: "AUTH_FORBIDDEN",
    });
  }

  next();
};

export const requireAdminPanelAccess = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.notAuthenticated"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const viewer = await ensureFeedViewerContext(authUser.sub);
  if (!canAccessAdminPanel(viewer.appRole)) {
    return res.status(403).json({
      error: tServer(locale, "auth.error.permissionDenied"),
      code: "AUTH_FORBIDDEN",
    });
  }

  next();
};

export const requireManageUsersAccess = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.notAuthenticated"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const viewer = await ensureFeedViewerContext(authUser.sub);
  if (!canManageUsers(viewer.appRole)) {
    return res.status(403).json({
      error: tServer(locale, "auth.error.permissionDenied"),
      code: "AUTH_FORBIDDEN",
    });
  }

  next();
};

export const requireManageContentAccess = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.notAuthenticated"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const viewer = await ensureFeedViewerContext(authUser.sub);
  if (!canManageContent(viewer.appRole)) {
    return res.status(403).json({
      error: tServer(locale, "auth.error.permissionDenied"),
      code: "AUTH_FORBIDDEN",
    });
  }

  next();
};

export const requireVerifiedEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> => {
  const locale = resolveLocaleFromHeaders(req.headers);
  const authUser = req.authUser;
  if (!authUser?.sub) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.notAuthenticated"),
      code: "AUTH_SESSION_REQUIRED",
    });
  }

  const userRow = await getUserById(authUser.sub);
  if (!userRow) {
    return res.status(401).json({
      error: tServer(locale, "auth.error.userNotFound"),
      code: "AUTH_INVALID_TOKEN",
    });
  }

  if (!userRow.emailVerified) {
    return res.status(403).json({
      error: tServer(locale, "auth.error.verifyEmailRequired"),
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  req.authUser = {
    ...authUser,
    emailVerified: true,
  };
  next();
};

export const makeAuthUserResponse = (row: UserRow) => ({
  id: row.id,
  email: row.email,
  emailVerified: row.emailVerified,
  name: row.name,
  locale: row.locale,
  appRole: normalizeAppRole(row.appRole),
});

export const buildAuthenticatedUserResponse = async (
  row: UserRow,
): Promise<AuthUserResponsePayload> => {
  const base = makeAuthUserResponse(row);
  const feedState = await getFeedProfile(row.id);

  return {
    ...base,
    feedProfileStatus: feedState.status,
    authorNotificationWebhookConfigured: feedState.authorNotificationWebhookConfigured,
    activeBan: null,
  };
};

export const DESKTOP_CLIENT_TOKEN_HEADER = "x-desktop-client-token";
export const DESKTOP_SESSION_ID_HEADER = "x-desktop-session-id";
export const DESKTOP_DEVICE_ID_HEADER = "x-desktop-device-id";
export const DESKTOP_APP_VERSION_HEADER = "x-desktop-app-version";
export const DESKTOP_UPDATE_CHANNEL_HEADER = "x-desktop-update-channel";
export const DESKTOP_BOOTSTRAP_SECRET_HEADER = "x-desktop-bootstrap-secret";
export const DESKTOP_DEVICE_KEY_HEADER = "x-desktop-device-key";
export const DESKTOP_TRAVEL_TOKEN_HEADER = "x-desktop-travel-token";

export const DESKTOP_TOKEN_MIN_TTL_SEC = 300;
export const DESKTOP_TOKEN_MAX_TTL_SEC = 900;
export const DESKTOP_TRAVEL_TOKEN_MIN_TTL_MINUTES = 5;
export const DESKTOP_TRAVEL_TOKEN_MAX_TTL_MINUTES = 180;
export const DESKTOP_TRAVEL_DEVICE_MIN_DAYS = 1;
export const DESKTOP_TRAVEL_DEVICE_MAX_DAYS = 60;
export const DESKTOP_PRIMARY_SLOT = "primary";
export const DESKTOP_TRAVEL_SLOT = "travel";

export type DesktopDeviceSlot = typeof DESKTOP_PRIMARY_SLOT | typeof DESKTOP_TRAVEL_SLOT;
export type DesktopTravelTokenDeliveryMode = "copy" | "email";
export type DesktopAuthDeviceRow = typeof desktopAuthDevice.$inferSelect;
export type DesktopTravelTokenRow = typeof desktopTravelToken.$inferSelect;

export interface DesktopClientSessionRecord {
  sessionId: string;
  deviceId: string;
  userId: string | null;
  tokenHash: string;
  previousTokenHash: string | null;
  previousTokenValidUntilMs: number;
  expiresAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export const desktopClientSessions = new Map<string, DesktopClientSessionRecord>();
export let lastDesktopSessionCleanupAtMs = 0;

export const readHeaderValue = (value: string | string[] | undefined): string | null => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== "string") {
    return null;
  }

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const ADMIN_WEB_CLIENT_HEADER = "x-koma-admin-client";

export const isAdminWebRequest = (req: Request): boolean =>
  readHeaderValue(req.headers[ADMIN_WEB_CLIENT_HEADER]) === "web-admin";

export const getDesktopClientVersion = (req: Request): string | null =>
  readHeaderValue(req.headers[DESKTOP_APP_VERSION_HEADER]);

export const isDesktopCaptchaBypassRequest = (req: Request, body: unknown): boolean => {
  const bodyRecord = asObject(body);
  const desktopSignalValidation = extractDesktopRegistrationSignals(req, body);
  const hasDesktopIdentityPayload = Boolean(
    getRequestDesktopDeviceId(req, bodyRecord) || getRequestDesktopMacFingerprint(bodyRecord),
  );
  return hasDesktopIdentityPayload && (Boolean(getDesktopClientVersion(req)) || desktopSignalValidation.ok);
};

export const getDesktopUpdateChannel = (req: Request): "stable" | "beta" =>
  readHeaderValue(req.headers[DESKTOP_UPDATE_CHANNEL_HEADER])?.toLowerCase() === "beta"
    ? "beta"
    : "stable";

export const sendMandatoryUpdateRequired = (
  res: Response,
  requirement: DesktopUpdateRequirement,
  route: string,
): Response =>
  sendAuthError(
    res,
    426,
    {
      error: tServer(resolveLocaleFromHeaders(res.req.headers), "auth.error.mandatoryUpdateRequired"),
      code: "MANDATORY_UPDATE_REQUIRED",
      update: {
        version: requirement.version,
        mandatory: true,
        channel: requirement.channel,
      },
    }
  );

export const sendDesktopAppVersionRequired = (
  res: Response,
  route: string,
): Response =>
  sendAuthError(
    res,
    400,
    {
      error: tServer(resolveLocaleFromHeaders(res.req.headers), "auth.error.desktopVersionMissing"),
      code: "DESKTOP_APP_VERSION_REQUIRED",
    }
  );

export const enforceMandatoryUpdateIfNeeded = async (
  req: Request,
  res: Response,
  route: string,
): Promise<boolean> => {
  if (isAdminWebRequest(req)) {
    return false;
  }

  const appVersion = getDesktopClientVersion(req);
  if (!appVersion) {
    sendDesktopAppVersionRequired(res, route);
    return true;
  }

  try {
    const requirement = await isMandatoryUpdatePending({
      updateServerUrl: env.updateServerUrl,
      channel: getDesktopUpdateChannel(req),
      appVersion,
      cacheTtlMs: env.updateManifestCacheTtlMs,
    });
    if (!requirement) {
      return false;
    }

    sendMandatoryUpdateRequired(res, requirement, route);
    return true;
  } catch (error) {
    logger.error("Mandatory update policy lookup failed", {
      route,
      message: error instanceof Error ? error.message : String(error),
    });
    sendAuthError(
      res,
      503,
      {
        error: tServer(resolveLocaleFromHeaders(req.headers), "auth.error.updatePolicyUnavailable"),
        code: "UPDATE_POLICY_UNAVAILABLE",
      }
    );
    return true;
  }
};

export const safeTokenEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const clampDesktopTokenTtlSec = (value: unknown, fallback: number): number => {
  const ttl = parsePositiveInteger(value, fallback);
  return Math.max(DESKTOP_TOKEN_MIN_TTL_SEC, Math.min(DESKTOP_TOKEN_MAX_TTL_SEC, ttl));
};

export const clampDesktopTravelTokenTtlMinutes = (value: unknown, fallback: number): number => {
  const ttl = parsePositiveInteger(value, fallback);
  return Math.max(
    DESKTOP_TRAVEL_TOKEN_MIN_TTL_MINUTES,
    Math.min(DESKTOP_TRAVEL_TOKEN_MAX_TTL_MINUTES, ttl),
  );
};

export const clampDesktopTravelDurationDays = (value: unknown, fallback: number): number => {
  const days = parsePositiveInteger(value, fallback);
  return Math.max(DESKTOP_TRAVEL_DEVICE_MIN_DAYS, Math.min(DESKTOP_TRAVEL_DEVICE_MAX_DAYS, days));
};

export const normalizeDesktopTravelTokenDeliveryMode = (
  value: unknown,
): DesktopTravelTokenDeliveryMode => (value === "email" ? "email" : "copy");

export const maskEmailAddress = (value: string): string => {
  const [localPartRaw, domainRaw] = value.split("@");
  const localPart = localPartRaw?.trim() ?? "";
  const domain = domainRaw?.trim() ?? "";
  if (!localPart || !domain) {
    return value;
  }

  const maskedLocalPart =
    localPart.length <= 2
      ? `${localPart[0] ?? "*"}*`
      : `${localPart.slice(0, 2)}${"*".repeat(Math.max(2, localPart.length - 2))}`;
  return `${maskedLocalPart}@${domain}`;
};

export const isSafeDesktopIdentifier = (value: string): boolean =>
  /^[A-Za-z0-9:_-]{12,128}$/.test(value);

export const normalizeDesktopSlot = (value: string | null | undefined): DesktopDeviceSlot | null => {
  if (value === DESKTOP_PRIMARY_SLOT || value === DESKTOP_TRAVEL_SLOT) {
    return value;
  }
  return null;
};


export const isDesktopTravelDeviceActive = (
  device: DesktopAuthDeviceRow | null | undefined,
  nowMs: number = Date.now(),
): boolean => {
  if (!device || normalizeDesktopSlot(device.slot) !== DESKTOP_TRAVEL_SLOT) {
    return false;
  }
  if (!device.expiresAt) {
    return false;
  }
  return device.expiresAt.getTime() > nowMs;
};

export const getDesktopDeviceByUserAndSlot = async (
  userId: string,
  slot: DesktopDeviceSlot,
): Promise<DesktopAuthDeviceRow | null> => {
  const [device] = await db
    .select()
    .from(desktopAuthDevice)
    .where(and(eq(desktopAuthDevice.userId, userId), eq(desktopAuthDevice.slot, slot)))
    .limit(1);
  return device ?? null;
};

export const getDesktopDeviceByUserAndHwid = async (
  userId: string,
  deviceHmac: string,
  nowMs: number = Date.now(),
): Promise<DesktopAuthDeviceRow | null> => {
  const primaryDevice = await getDesktopDeviceByUserAndSlot(userId, DESKTOP_PRIMARY_SLOT);
  if (primaryDevice && safeTokenEquals(primaryDevice.hwidHmac, deviceHmac)) {
    return primaryDevice;
  }

  const travelDevice = await getDesktopDeviceByUserAndSlot(userId, DESKTOP_TRAVEL_SLOT);
  if (isDesktopTravelDeviceActive(travelDevice, nowMs) && travelDevice && safeTokenEquals(travelDevice.hwidHmac, deviceHmac)) {
    return travelDevice;
  }

  return null;
};

export const upsertDesktopDevice = async (params: {
  userId: string;
  slot: DesktopDeviceSlot;
  deviceHmac: string;
  deviceKeyHash: string;
  expiresAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<DesktopAuthDeviceRow> => {
  const now = new Date();
  const existing = await getDesktopDeviceByUserAndSlot(params.userId, params.slot);
  const values = {
    hwidHmac: params.deviceHmac,
    deviceKeyHash: params.deviceKeyHash,
    expiresAt: params.slot === DESKTOP_TRAVEL_SLOT ? params.expiresAt ?? null : null,
    lastSeenAt: now,
    lastSeenIp: params.ipAddress ?? null,
    lastSeenUserAgent: params.userAgent ?? null,
    updatedAt: now,
  };

  if (!existing) {
    const [created] = await db
      .insert(desktopAuthDevice)
      .values({
        id: randomUUID(),
        userId: params.userId,
        slot: params.slot,
        createdAt: now,
        ...values,
      })
      .returning();
    if (!created) {
      throw new Error(tServer("en", "auth.desktop.linkCreateFailed"));
    }
    return created;
  }

  const [updated] = await db
    .update(desktopAuthDevice)
    .set(values)
    .where(eq(desktopAuthDevice.id, existing.id))
    .returning();
  if (!updated) {
    throw new Error(tServer("en", "auth.desktop.linkUpdateFailed"));
  }
  return updated;
};

export const sha256Hex = (payload: string | Buffer): string =>
  createHash("sha256").update(payload).digest("hex");

export const consumeDesktopTravelToken = async (params: {
  userId: string;
  token: string;
  consumedByHwidHmac: string;
}): Promise<DesktopTravelTokenRow | null> => {
  const tokenHash = sha256Hex(params.token);
  const now = new Date();
  const [row] = await db
    .select()
    .from(desktopTravelToken)
    .where(
      and(
        eq(desktopTravelToken.userId, params.userId),
        eq(desktopTravelToken.tokenHash, tokenHash),
        isNull(desktopTravelToken.consumedAt),
        gt(desktopTravelToken.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [consumed] = await db
    .update(desktopTravelToken)
    .set({
      consumedAt: now,
      consumedByHwidHmac: params.consumedByHwidHmac,
      updatedAt: now,
    })
    .where(eq(desktopTravelToken.id, row.id))
    .returning();

  return consumed ?? null;
};

export const findDesktopDeviceByCredential = async (params: {
  deviceHmac: string;
  deviceKeyHash: string;
  nowMs: number;
}): Promise<DesktopAuthDeviceRow | null> => {
  const [device] = await db
    .select()
    .from(desktopAuthDevice)
    .where(
      and(
        eq(desktopAuthDevice.hwidHmac, params.deviceHmac),
        eq(desktopAuthDevice.deviceKeyHash, params.deviceKeyHash),
      ),
    )
    .limit(1);
  if (!device) {
    return null;
  }

  const slot = normalizeDesktopSlot(device.slot);
  if (slot === DESKTOP_TRAVEL_SLOT && !isDesktopTravelDeviceActive(device, params.nowMs)) {
    return null;
  }

  return device;
};

export const cleanupExpiredDesktopClientSessions = (nowMs: number = Date.now()): void => {
  for (const [sessionId, record] of desktopClientSessions.entries()) {
    if (record.expiresAtMs <= nowMs) {
      desktopClientSessions.delete(sessionId);
    }
  }
  lastDesktopSessionCleanupAtMs = nowMs;
};

export const cleanupDesktopClientSessionsIfNeeded = (nowMs: number = Date.now()): void => {
  if (nowMs - lastDesktopSessionCleanupAtMs > 60_000) {
    cleanupExpiredDesktopClientSessions(nowMs);
  }
};

export const purgeDesktopClientSessionsForUser = (userId: string): void => {
  for (const [sessionId, record] of desktopClientSessions.entries()) {
    if (record.userId === userId) {
      desktopClientSessions.delete(sessionId);
    }
  }
};

export const DESKTOP_ENFORCEMENT_BYPASS_AUTH_PATHS = new Set<string>([
  "/api/auth/config",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/session",
  "/api/auth/verify",
  "/api/auth/confirm-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
]);

export const SENSITIVE_RESPONSE_EXACT_PATHS = new Set<string>([
  "/api/auth/config",
  "/api/auth/session",
  "/api/auth/verify",
  "/api/auth/verify-email",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/confirm-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

export const shouldApplySensitiveResponseHeaders = (requestPath: string): boolean =>
  SENSITIVE_RESPONSE_EXACT_PATHS.has(requestPath) ||
  requestPath.startsWith("/api/admin/") ||
  requestPath.startsWith("/api/internal/desktop-client");

export const shouldBypassDesktopClientEnforcement = (requestPath: string): boolean => {
  if (!requestPath.startsWith("/api/")) {
    return true;
  }

  if (DESKTOP_ENFORCEMENT_BYPASS_AUTH_PATHS.has(requestPath)) {
    return true;
  }

  if (requestPath.startsWith("/api/internal/desktop-client/bootstrap")) {
    return true;
  }
  if (requestPath.startsWith("/api/internal/desktop-client/register")) {
    return true;
  }

  if (requestPath.startsWith("/api/admin/")) {
    return true;
  }
  if (requestPath.startsWith("/api/content/")) {
    return true;
  }

  return false;
};
