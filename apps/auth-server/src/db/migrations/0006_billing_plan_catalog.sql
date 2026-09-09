ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "subscriptionPlanCode" text DEFAULT 'free' NOT NULL;

ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "subscriptionBillingInterval" text DEFAULT 'monthly' NOT NULL;

UPDATE "user"
SET
  "subscriptionPlanCode" = CASE
    WHEN "subscriptionTier" = 'studio' THEN 'legacy_studio'
    WHEN "subscriptionTier" = 'pro' THEN 'legacy_pro'
    ELSE 'free'
  END,
  "subscriptionBillingInterval" = COALESCE(NULLIF("subscriptionBillingInterval", ''), 'monthly')
WHERE "subscriptionPlanCode" = 'free'
  OR "subscriptionPlanCode" IS NULL;
