CREATE TABLE "paymentWebhookEvent" (
	"provider" text NOT NULL,
	"eventId" text NOT NULL,
	"payloadHash" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_webhook_event_pk" PRIMARY KEY("provider","eventId")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "billingProvider" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mercadoPagoLastPaymentId" text;--> statement-breakpoint
CREATE INDEX "payment_webhook_event_created_idx" ON "paymentWebhookEvent" USING btree ("createdAt");