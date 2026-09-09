CREATE TABLE IF NOT EXISTS "legalAcceptance" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "source" text DEFAULT 'register' NOT NULL,
  "termsVersion" text NOT NULL,
  "privacyVersion" text NOT NULL,
  "cookiesVersion" text,
  "contentVersion" text,
  "ipAddress" text,
  "userAgent" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "acceptedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legalAcceptance_userId_user_id_fk'
  ) THEN
    ALTER TABLE "legalAcceptance"
    ADD CONSTRAINT "legalAcceptance_userId_user_id_fk"
    FOREIGN KEY ("userId")
    REFERENCES "public"."user"("id")
    ON DELETE cascade
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_acceptance_user_idx" ON "legalAcceptance" USING btree ("userId","acceptedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "legal_acceptance_source_idx" ON "legalAcceptance" USING btree ("source","acceptedAt");
