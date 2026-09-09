ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "appRole" text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_app_role_idx" ON "user" USING btree ("appRole");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feedProfile" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "status" text DEFAULT 'pending_setup' NOT NULL,
  "rulesAcceptedAt" timestamp with time zone,
  "profileCompletedAt" timestamp with time zone,
  "postingApprovedAt" timestamp with time zone,
  "postingSuspendedUntil" timestamp with time zone,
  "authorNotificationWebhookUrl" text,
  "authorNotificationWebhookEnabled" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedProfile_userId_user_id_fk'
  ) THEN
    ALTER TABLE "feedProfile"
    ADD CONSTRAINT "feedProfile_userId_user_id_fk"
    FOREIGN KEY ("userId")
    REFERENCES "public"."user"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feed_profile_user_unique" ON "feedProfile" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_profile_status_idx" ON "feedProfile" USING btree ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feedPost" (
  "id" text PRIMARY KEY NOT NULL,
  "authorUserId" text NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "body" text NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "moderationStatus" text DEFAULT 'clean' NOT NULL,
  "riskScore" integer DEFAULT 0 NOT NULL,
  "riskReasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "externalLinks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "media" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "recruitment" jsonb DEFAULT null,
  "showcase" jsonb DEFAULT null,
  "flaggedAt" timestamp with time zone,
  "hiddenAt" timestamp with time zone,
  "archivedAt" timestamp with time zone,
  "expiresAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedPost_authorUserId_user_id_fk'
  ) THEN
    ALTER TABLE "feedPost"
    ADD CONSTRAINT "feedPost_authorUserId_user_id_fk"
    FOREIGN KEY ("authorUserId")
    REFERENCES "public"."user"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_post_author_idx" ON "feedPost" USING btree ("authorUserId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_post_type_idx" ON "feedPost" USING btree ("type","status","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_post_moderation_idx" ON "feedPost" USING btree ("moderationStatus","createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feedApplication" (
  "id" text PRIMARY KEY NOT NULL,
  "postId" text NOT NULL,
  "applicantUserId" text NOT NULL,
  "status" text DEFAULT 'submitted' NOT NULL,
  "message" text NOT NULL,
  "experience" text,
  "availabilityHoursPerWeek" integer,
  "availabilityDays" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "preferredContact" jsonb DEFAULT null,
  "portfolioLinks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "reviewerUserId" text,
  "reviewedAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedApplication_postId_feedPost_id_fk'
  ) THEN
    ALTER TABLE "feedApplication"
    ADD CONSTRAINT "feedApplication_postId_feedPost_id_fk"
    FOREIGN KEY ("postId")
    REFERENCES "public"."feedPost"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedApplication_applicantUserId_user_id_fk'
  ) THEN
    ALTER TABLE "feedApplication"
    ADD CONSTRAINT "feedApplication_applicantUserId_user_id_fk"
    FOREIGN KEY ("applicantUserId")
    REFERENCES "public"."user"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedApplication_reviewerUserId_user_id_fk'
  ) THEN
    ALTER TABLE "feedApplication"
    ADD CONSTRAINT "feedApplication_reviewerUserId_user_id_fk"
    FOREIGN KEY ("reviewerUserId")
    REFERENCES "public"."user"("id")
    ON DELETE set null
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feed_application_post_applicant_unique" ON "feedApplication" USING btree ("postId","applicantUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_application_applicant_idx" ON "feedApplication" USING btree ("applicantUserId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_application_post_idx" ON "feedApplication" USING btree ("postId","status","createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feedReport" (
  "id" text PRIMARY KEY NOT NULL,
  "postId" text NOT NULL,
  "reporterUserId" text NOT NULL,
  "reasonCode" text NOT NULL,
  "details" text,
  "status" text DEFAULT 'open' NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "resolvedByUserId" text,
  "resolvedAt" timestamp with time zone,
  "resolutionNotes" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedReport_postId_feedPost_id_fk'
  ) THEN
    ALTER TABLE "feedReport"
    ADD CONSTRAINT "feedReport_postId_feedPost_id_fk"
    FOREIGN KEY ("postId")
    REFERENCES "public"."feedPost"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedReport_reporterUserId_user_id_fk'
  ) THEN
    ALTER TABLE "feedReport"
    ADD CONSTRAINT "feedReport_reporterUserId_user_id_fk"
    FOREIGN KEY ("reporterUserId")
    REFERENCES "public"."user"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedReport_resolvedByUserId_user_id_fk'
  ) THEN
    ALTER TABLE "feedReport"
    ADD CONSTRAINT "feedReport_resolvedByUserId_user_id_fk"
    FOREIGN KEY ("resolvedByUserId")
    REFERENCES "public"."user"("id")
    ON DELETE set null
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_report_post_idx" ON "feedReport" USING btree ("postId","status","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_report_reporter_idx" ON "feedReport" USING btree ("reporterUserId","createdAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "userBan" (
  "id" text PRIMARY KEY NOT NULL,
  "targetUserId" text,
  "actorUserId" text,
  "scope" text NOT NULL,
  "reason" text NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "startsAt" timestamp with time zone,
  "expiresAt" timestamp with time zone,
  "liftedAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'userBan_targetUserId_user_id_fk'
  ) THEN
    ALTER TABLE "userBan"
    ADD CONSTRAINT "userBan_targetUserId_user_id_fk"
    FOREIGN KEY ("targetUserId")
    REFERENCES "public"."user"("id")
    ON DELETE set null
    ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'userBan_actorUserId_user_id_fk'
  ) THEN
    ALTER TABLE "userBan"
    ADD CONSTRAINT "userBan_actorUserId_user_id_fk"
    FOREIGN KEY ("actorUserId")
    REFERENCES "public"."user"("id")
    ON DELETE set null
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_ban_target_idx" ON "userBan" USING btree ("targetUserId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_ban_active_idx" ON "userBan" USING btree ("startsAt","expiresAt","liftedAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "banTarget" (
  "id" text PRIMARY KEY NOT NULL,
  "banId" text NOT NULL,
  "targetType" text NOT NULL,
  "targetHash" text NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "banTarget"
ADD COLUMN IF NOT EXISTS "id" text,
ADD COLUMN IF NOT EXISTS "banId" text,
ADD COLUMN IF NOT EXISTS "targetType" text,
ADD COLUMN IF NOT EXISTS "targetHash" text,
ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone DEFAULT now();
--> statement-breakpoint
ALTER TABLE "banTarget"
ALTER COLUMN "id" SET NOT NULL,
ALTER COLUMN "banId" SET NOT NULL,
ALTER COLUMN "targetType" SET NOT NULL,
ALTER COLUMN "targetHash" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'banTarget_banId_userBan_id_fk'
  ) THEN
    ALTER TABLE "banTarget"
    ADD CONSTRAINT "banTarget_banId_userBan_id_fk"
    FOREIGN KEY ("banId")
    REFERENCES "public"."userBan"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ban_target_ban_idx" ON "banTarget" USING btree ("banId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ban_target_lookup_idx" ON "banTarget" USING btree ("targetType","targetHash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ban_target_unique" ON "banTarget" USING btree ("banId","targetType","targetHash");
