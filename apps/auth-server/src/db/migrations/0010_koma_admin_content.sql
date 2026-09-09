CREATE TABLE "guideCategory" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "description" text NOT NULL,
  "accentColor" text NOT NULL,
  "iconName" text DEFAULT 'BookOpen' NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guideEntry" (
  "id" text PRIMARY KEY NOT NULL,
  "categoryId" text NOT NULL,
  "title" text NOT NULL,
  "subtitle" text NOT NULL,
  "accentColor" text NOT NULL,
  "difficulty" text NOT NULL,
  "estimatedTime" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "iconName" text DEFAULT 'BookOpen' NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resourceCategory" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "description" text NOT NULL,
  "accentColor" text NOT NULL,
  "iconName" text DEFAULT 'BookOpen' NOT NULL,
  "itemCount" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resourceEntry" (
  "id" text PRIMARY KEY NOT NULL,
  "categoryId" text NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "iconName" text,
  "status" text DEFAULT 'published' NOT NULL,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guideEntry" ADD CONSTRAINT "guideEntry_categoryId_guideCategory_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."guideCategory"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resourceEntry" ADD CONSTRAINT "resourceEntry_categoryId_resourceCategory_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."resourceCategory"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "guide_category_status_idx" ON "guideCategory" USING btree ("status","sortOrder");
--> statement-breakpoint
CREATE INDEX "guide_entry_category_idx" ON "guideEntry" USING btree ("categoryId","sortOrder");
--> statement-breakpoint
CREATE INDEX "guide_entry_status_idx" ON "guideEntry" USING btree ("status","updatedAt");
--> statement-breakpoint
CREATE INDEX "resource_category_status_idx" ON "resourceCategory" USING btree ("status","sortOrder");
--> statement-breakpoint
CREATE INDEX "resource_entry_category_idx" ON "resourceEntry" USING btree ("categoryId","sortOrder");
--> statement-breakpoint
CREATE INDEX "resource_entry_status_idx" ON "resourceEntry" USING btree ("status","updatedAt");
