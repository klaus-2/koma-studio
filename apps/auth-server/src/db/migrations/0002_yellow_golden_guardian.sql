CREATE TABLE "desktopAuthDevice" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"slot" text DEFAULT 'primary' NOT NULL,
	"hwidHmac" text NOT NULL,
	"deviceKeyHash" text NOT NULL,
	"expiresAt" timestamp with time zone,
	"lastSeenAt" timestamp with time zone,
	"lastSeenIp" text,
	"lastSeenUserAgent" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desktopTravelToken" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"travelDays" integer DEFAULT 14 NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	"consumedByHwidHmac" text,
	"issuedBySlot" text DEFAULT 'primary' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "desktopAuthDevice" ADD CONSTRAINT "desktopAuthDevice_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktopTravelToken" ADD CONSTRAINT "desktopTravelToken_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_auth_device_user_slot_unique" ON "desktopAuthDevice" USING btree ("userId","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_auth_device_key_hash_unique" ON "desktopAuthDevice" USING btree ("deviceKeyHash");--> statement-breakpoint
CREATE INDEX "desktop_auth_device_user_idx" ON "desktopAuthDevice" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "desktop_auth_device_hwid_idx" ON "desktopAuthDevice" USING btree ("hwidHmac");--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_travel_token_hash_unique" ON "desktopTravelToken" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "desktop_travel_token_user_idx" ON "desktopTravelToken" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "desktop_travel_token_expires_idx" ON "desktopTravelToken" USING btree ("expiresAt");