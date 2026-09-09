import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export interface LoginHistoryEntry {
  timestamp: string;
  ip: string;
  success: boolean;
  userAgent?: string;
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

export interface FeedPostRiskSnapshot {
  score: number;
  reasons: string[];
}

export interface FeedApplicationContact {
  type: "discord" | "twitter_x" | "telegram" | "email" | "whatsapp" | "instagram";
  value: string;
}

export interface FeedReportEvidence {
  source: "user" | "moderator" | "system";
  note: string;
  createdAt: string;
}

export interface ActiveBanMetadata {
  title: string;
  detail: string;
  temporary: boolean;
  reason: string;
  scope: string;
  expiresAt: string | null;
}

export interface SerializableGuideSection {
  id: string;
  title: string;
  description?: string;
  steps: unknown[];
}

export interface SerializableResourcePayload {
  [key: string]: unknown;
}

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    locale: text("locale").notNull().default("en"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),

    passwordChangedAt: timestamp("passwordChangedAt", { withTimezone: true }),
    failedLoginAttempts: integer("failedLoginAttempts").notNull().default(0),
    accountLockedUntil: timestamp("accountLockedUntil", { withTimezone: true }),
    lastLoginAt: timestamp("lastLoginAt", { withTimezone: true }),
    lastLoginIp: text("lastLoginIp"),
    loginHistory: jsonb("loginHistory").$type<LoginHistoryEntry[]>().default([]),
    appRole: text("appRole").notNull().default("user"),
  },
  (table) => ({
    userEmailUnique: uniqueIndex("user_email_unique").on(table.email),
    userAppRoleIdx: index("user_app_role_idx").on(table.appRole),
  }),
);

export const desktopAuthDevice = pgTable(
  "desktopAuthDevice",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slot: text("slot").notNull().default("primary"),
    hwidHmac: text("hwidHmac").notNull(),
    deviceKeyHash: text("deviceKeyHash").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    lastSeenAt: timestamp("lastSeenAt", { withTimezone: true }),
    lastSeenIp: text("lastSeenIp"),
    lastSeenUserAgent: text("lastSeenUserAgent"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    desktopAuthDeviceUserSlotUnique: uniqueIndex("desktop_auth_device_user_slot_unique").on(
      table.userId,
      table.slot,
    ),
    desktopAuthDeviceKeyHashUnique: uniqueIndex("desktop_auth_device_key_hash_unique").on(
      table.deviceKeyHash,
    ),
    desktopAuthDeviceUserIdx: index("desktop_auth_device_user_idx").on(table.userId),
    desktopAuthDeviceHwidIdx: index("desktop_auth_device_hwid_idx").on(table.hwidHmac),
  }),
);

export const desktopTravelToken = pgTable(
  "desktopTravelToken",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    travelDays: integer("travelDays").notNull().default(14),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumedAt", { withTimezone: true }),
    consumedByHwidHmac: text("consumedByHwidHmac"),
    issuedBySlot: text("issuedBySlot").notNull().default("primary"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    desktopTravelTokenHashUnique: uniqueIndex("desktop_travel_token_hash_unique").on(table.tokenHash),
    desktopTravelTokenUserIdx: index("desktop_travel_token_user_idx").on(table.userId),
    desktopTravelTokenExpiresIdx: index("desktop_travel_token_expires_idx").on(table.expiresAt),
  }),
);

export const registrationIdentity = pgTable(
  "registrationIdentity",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    identityType: text("identityType").notNull(),
    identityHash: text("identityHash").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    registrationIdentityTypeHashUnique: uniqueIndex("registration_identity_type_hash_unique").on(
      table.identityType,
      table.identityHash,
    ),
    registrationIdentityUserTypeUnique: uniqueIndex("registration_identity_user_type_unique").on(
      table.userId,
      table.identityType,
    ),
    registrationIdentityUserIdx: index("registration_identity_user_idx").on(table.userId),
  }),
);

export const legalAcceptance = pgTable(
  "legalAcceptance",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("register"),
    termsVersion: text("termsVersion").notNull(),
    privacyVersion: text("privacyVersion").notNull(),
    cookiesVersion: text("cookiesVersion"),
    contentVersion: text("contentVersion"),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    acceptedAt: timestamp("acceptedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    legalAcceptanceUserIdx: index("legal_acceptance_user_idx").on(table.userId, table.acceptedAt),
    legalAcceptanceSourceIdx: index("legal_acceptance_source_idx").on(table.source, table.acceptedAt),
  }),
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonatedBy"),
  },
  (table) => ({
    tokenUnique: uniqueIndex("session_token_unique").on(table.token),
    userIdIndex: index("session_user_id_idx").on(table.userId),
  }),
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountProviderUnique: uniqueIndex("account_provider_unique").on(table.accountId, table.providerId),
    accountUserIdIdx: index("account_user_id_idx").on(table.userId),
  }),
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
  }),
);

export const securityLog = pgTable(
  "securityLog",
  {
    id: text("id").primaryKey(),
    userId: text("userId").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    severity: text("severity").notNull().default("info"),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    securityLogUserIdx: index("security_log_user_idx").on(table.userId),
    securityLogActionIdx: index("security_log_action_idx").on(table.action),
  }),
);

export const modelReview = pgTable(
  "modelReview",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    modelId: text("modelId").notNull(),
    stage: text("stage").notNull(),
    sourceType: text("sourceType").notNull(),
    overallScore: integer("overallScore").notNull(),
    qualityScore: integer("qualityScore").notNull(),
    speedScore: integer("speedScore").notNull(),
    costBenefitScore: integer("costBenefitScore").notNull(),
    easeOfUseScore: integer("easeOfUseScore").notNull(),
    title: text("title"),
    reviewText: text("reviewText"),
    usageContext: text("usageContext").notNull(),
    sourceLanguage: text("sourceLanguage"),
    targetLanguage: text("targetLanguage"),
    deviceType: text("deviceType"),
    status: text("status").notNull().default("published"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    modelReviewUserModelUnique: uniqueIndex("model_review_user_model_unique").on(
      table.userId,
      table.modelId,
    ),
    modelReviewModelIdx: index("model_review_model_idx").on(table.modelId),
    modelReviewScopeIdx: index("model_review_scope_idx").on(
      table.stage,
      table.sourceType,
    ),
    modelReviewStatusIdx: index("model_review_status_idx").on(table.status),
    modelReviewUpdatedIdx: index("model_review_updated_idx").on(table.updatedAt),
  }),
);

export const feedProfile = pgTable(
  "feedProfile",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending_setup"),
    rulesAcceptedAt: timestamp("rulesAcceptedAt", { withTimezone: true }),
    profileCompletedAt: timestamp("profileCompletedAt", { withTimezone: true }),
    postingApprovedAt: timestamp("postingApprovedAt", { withTimezone: true }),
    postingSuspendedUntil: timestamp("postingSuspendedUntil", { withTimezone: true }),
    authorNotificationWebhookUrl: text("authorNotificationWebhookUrl"),
    authorNotificationWebhookEnabled: boolean("authorNotificationWebhookEnabled").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    feedProfileUserUnique: uniqueIndex("feed_profile_user_unique").on(table.userId),
    feedProfileStatusIdx: index("feed_profile_status_idx").on(table.status),
  }),
);

export const feedPost = pgTable(
  "feedPost",
  {
    id: text("id").primaryKey(),
    authorUserId: text("authorUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    status: text("status").notNull().default("published"),
    moderationStatus: text("moderationStatus").notNull().default("clean"),
    riskScore: integer("riskScore").notNull().default(0),
    riskReasons: jsonb("riskReasons").$type<string[]>().notNull().default([]),
    externalLinks: jsonb("externalLinks").$type<string[]>().notNull().default([]),
    media: jsonb("media").$type<FeedPostMediaItem[]>().notNull().default([]),
    recruitment: jsonb("recruitment").$type<FeedRecruitmentPayload | null>().default(null),
    showcase: jsonb("showcase").$type<FeedShowcasePayload | null>().default(null),
    flaggedAt: timestamp("flaggedAt", { withTimezone: true }),
    hiddenAt: timestamp("hiddenAt", { withTimezone: true }),
    archivedAt: timestamp("archivedAt", { withTimezone: true }),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    feedPostAuthorIdx: index("feed_post_author_idx").on(table.authorUserId, table.createdAt),
    feedPostTypeIdx: index("feed_post_type_idx").on(table.type, table.status, table.createdAt),
    feedPostModerationIdx: index("feed_post_moderation_idx").on(table.moderationStatus, table.createdAt),
  }),
);

export const feedApplication = pgTable(
  "feedApplication",
  {
    id: text("id").primaryKey(),
    postId: text("postId")
      .notNull()
      .references(() => feedPost.id, { onDelete: "cascade" }),
    applicantUserId: text("applicantUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("submitted"),
    message: text("message").notNull(),
    experience: text("experience"),
    availabilityHoursPerWeek: integer("availabilityHoursPerWeek"),
    availabilityDays: jsonb("availabilityDays").$type<string[]>().notNull().default([]),
    preferredContact: jsonb("preferredContact").$type<FeedApplicationContact | null>().default(null),
    portfolioLinks: jsonb("portfolioLinks").$type<string[]>().notNull().default([]),
    reviewerUserId: text("reviewerUserId").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    feedApplicationPostApplicantUnique: uniqueIndex("feed_application_post_applicant_unique").on(
      table.postId,
      table.applicantUserId,
    ),
    feedApplicationApplicantIdx: index("feed_application_applicant_idx").on(table.applicantUserId, table.createdAt),
    feedApplicationPostIdx: index("feed_application_post_idx").on(table.postId, table.status, table.createdAt),
  }),
);

export const feedReport = pgTable(
  "feedReport",
  {
    id: text("id").primaryKey(),
    postId: text("postId")
      .notNull()
      .references(() => feedPost.id, { onDelete: "cascade" }),
    reporterUserId: text("reporterUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reasonCode: text("reasonCode").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    evidence: jsonb("evidence").$type<FeedReportEvidence[]>().notNull().default([]),
    resolvedByUserId: text("resolvedByUserId").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
    resolutionNotes: text("resolutionNotes"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    feedReportPostIdx: index("feed_report_post_idx").on(table.postId, table.status, table.createdAt),
    feedReportReporterIdx: index("feed_report_reporter_idx").on(table.reporterUserId, table.createdAt),
  }),
);

export const userBan = pgTable(
  "userBan",
  {
    id: text("id").primaryKey(),
    targetUserId: text("targetUserId").references(() => user.id, { onDelete: "set null" }),
    actorUserId: text("actorUserId").references(() => user.id, { onDelete: "set null" }),
    scope: text("scope").notNull(),
    reason: text("reason").notNull(),
    evidence: jsonb("evidence").$type<FeedReportEvidence[]>().notNull().default([]),
    startsAt: timestamp("startsAt", { withTimezone: true }),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    liftedAt: timestamp("liftedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userBanTargetIdx: index("user_ban_target_idx").on(table.targetUserId, table.createdAt),
    userBanActiveIdx: index("user_ban_active_idx").on(table.startsAt, table.expiresAt, table.liftedAt),
  }),
);

export const banTarget = pgTable(
  "banTarget",
  {
    id: text("id").primaryKey(),
    banId: text("banId")
      .notNull()
      .references(() => userBan.id, { onDelete: "cascade" }),
    targetType: text("targetType").notNull(),
    targetHash: text("targetHash").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    banTargetBanIdx: index("ban_target_ban_idx").on(table.banId),
    banTargetLookupIdx: index("ban_target_lookup_idx").on(table.targetType, table.targetHash),
    banTargetUnique: uniqueIndex("ban_target_unique").on(table.banId, table.targetType, table.targetHash),
  }),
);

export const guideCategory = pgTable(
  "guideCategory",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    accentColor: text("accentColor").notNull(),
    iconName: text("iconName").notNull().default("BookOpen"),
    status: text("status").notNull().default("published"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    guideCategoryStatusIdx: index("guide_category_status_idx").on(table.status, table.sortOrder),
  }),
);

export const guideEntry = pgTable(
  "guideEntry",
  {
    id: text("id").primaryKey(),
    categoryId: text("categoryId")
      .notNull()
      .references(() => guideCategory.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    accentColor: text("accentColor").notNull(),
    difficulty: text("difficulty").notNull(),
    estimatedTime: text("estimatedTime").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    iconName: text("iconName").notNull().default("BookOpen"),
    status: text("status").notNull().default("published"),
    sortOrder: integer("sortOrder").notNull().default(0),
    sections: jsonb("sections").$type<SerializableGuideSection[]>().notNull().default([]),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    guideEntryCategoryIdx: index("guide_entry_category_idx").on(table.categoryId, table.sortOrder),
    guideEntryStatusIdx: index("guide_entry_status_idx").on(table.status, table.updatedAt),
  }),
);

export const resourceCategory = pgTable(
  "resourceCategory",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    accentColor: text("accentColor").notNull(),
    iconName: text("iconName").notNull().default("BookOpen"),
    itemCount: integer("itemCount").notNull().default(0),
    status: text("status").notNull().default("published"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    resourceCategoryStatusIdx: index("resource_category_status_idx").on(table.status, table.sortOrder),
  }),
);

export const resourceEntry = pgTable(
  "resourceEntry",
  {
    id: text("id").primaryKey(),
    categoryId: text("categoryId")
      .notNull()
      .references(() => resourceCategory.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    iconName: text("iconName"),
    status: text("status").notNull().default("published"),
    sortOrder: integer("sortOrder").notNull().default(0),
    payload: jsonb("payload").$type<SerializableResourcePayload>().notNull().default({}),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    resourceEntryCategoryIdx: index("resource_entry_category_idx").on(table.categoryId, table.sortOrder),
    resourceEntryStatusIdx: index("resource_entry_status_idx").on(table.status, table.updatedAt),
  }),
);
