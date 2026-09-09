CREATE TABLE "modelReview" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"modelId" text NOT NULL,
	"stage" text NOT NULL,
	"sourceType" text NOT NULL,
	"tierRequired" text NOT NULL,
	"overallScore" integer NOT NULL,
	"qualityScore" integer NOT NULL,
	"speedScore" integer NOT NULL,
	"costBenefitScore" integer NOT NULL,
	"easeOfUseScore" integer NOT NULL,
	"title" text,
	"reviewText" text,
	"usageContext" text NOT NULL,
	"sourceLanguage" text,
	"targetLanguage" text,
	"deviceType" text,
	"status" text DEFAULT 'published' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modelReview" ADD CONSTRAINT "modelReview_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "model_review_user_model_unique" ON "modelReview" USING btree ("userId","modelId");
--> statement-breakpoint
CREATE INDEX "model_review_model_idx" ON "modelReview" USING btree ("modelId");
--> statement-breakpoint
CREATE INDEX "model_review_scope_idx" ON "modelReview" USING btree ("stage","sourceType","tierRequired");
--> statement-breakpoint
CREATE INDEX "model_review_status_idx" ON "modelReview" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "model_review_updated_idx" ON "modelReview" USING btree ("updatedAt");
