DROP TABLE IF EXISTS "paymentWebhookEvent";
DROP TABLE IF EXISTS "desktopMachineSnapshot";

ALTER TABLE "user" DROP COLUMN IF EXISTS "subscriptionTier";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "subscriptionPlanCode";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "subscriptionBillingInterval";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "pagesProcessedThisMonth";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "usageMonth";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "stripeSubscriptionId";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "stripePriceId";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "billingStatus";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "billingProvider";
ALTER TABLE IF EXISTS "user" DROP COLUMN IF EXISTS "mercadoPagoLastPaymentId";

ALTER TABLE IF EXISTS "model_review" DROP COLUMN IF EXISTS "tierRequired";

ALTER TABLE IF EXISTS "desktopAuthDevice" DROP COLUMN IF EXISTS "machineProfile";
ALTER TABLE IF EXISTS "desktopAuthDevice" DROP COLUMN IF EXISTS "machineProfileHash";
ALTER TABLE IF EXISTS "desktopAuthDevice" DROP COLUMN IF EXISTS "machineProfileSchemaVersion";
ALTER TABLE IF EXISTS "desktopAuthDevice" DROP COLUMN IF EXISTS "machineProfileLastSyncedAt";
ALTER TABLE IF EXISTS "desktopAuthDevice" DROP COLUMN IF EXISTS "machineProfileLastChangedAt";
