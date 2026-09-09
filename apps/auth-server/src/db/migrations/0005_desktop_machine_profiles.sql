ALTER TABLE "desktopAuthDevice"
ADD COLUMN IF NOT EXISTS "machineProfile" jsonb DEFAULT null,
ADD COLUMN IF NOT EXISTS "machineProfileHash" text,
ADD COLUMN IF NOT EXISTS "machineProfileSchemaVersion" integer,
ADD COLUMN IF NOT EXISTS "machineProfileLastSyncedAt" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "machineProfileLastChangedAt" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desktop_auth_device_machine_profile_hash_idx" ON "desktopAuthDevice" USING btree ("machineProfileHash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "desktopMachineSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"deviceId" text NOT NULL,
	"userId" text NOT NULL,
	"slot" text NOT NULL,
	"reason" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"snapshotHash" text NOT NULL,
	"changedFields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "desktopMachineSnapshot"
ADD COLUMN IF NOT EXISTS "deviceId" text,
ADD COLUMN IF NOT EXISTS "userId" text,
ADD COLUMN IF NOT EXISTS "slot" text,
ADD COLUMN IF NOT EXISTS "reason" text,
ADD COLUMN IF NOT EXISTS "snapshot" jsonb,
ADD COLUMN IF NOT EXISTS "snapshotHash" text,
ADD COLUMN IF NOT EXISTS "changedFields" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone DEFAULT now();
--> statement-breakpoint
ALTER TABLE "desktopMachineSnapshot"
ALTER COLUMN "deviceId" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "slot" SET NOT NULL,
ALTER COLUMN "reason" SET NOT NULL,
ALTER COLUMN "snapshot" SET NOT NULL,
ALTER COLUMN "snapshotHash" SET NOT NULL,
ALTER COLUMN "changedFields" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'desktopMachineSnapshot_deviceId_desktopAuthDevice_id_fk'
	) THEN
		ALTER TABLE "desktopMachineSnapshot"
		ADD CONSTRAINT "desktopMachineSnapshot_deviceId_desktopAuthDevice_id_fk"
		FOREIGN KEY ("deviceId")
		REFERENCES "public"."desktopAuthDevice"("id")
		ON DELETE cascade
		ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'desktopMachineSnapshot_userId_user_id_fk'
	) THEN
		ALTER TABLE "desktopMachineSnapshot"
		ADD CONSTRAINT "desktopMachineSnapshot_userId_user_id_fk"
		FOREIGN KEY ("userId")
		REFERENCES "public"."user"("id")
		ON DELETE cascade
		ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desktop_machine_snapshot_device_idx" ON "desktopMachineSnapshot" USING btree ("deviceId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desktop_machine_snapshot_user_idx" ON "desktopMachineSnapshot" USING btree ("userId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "desktop_machine_snapshot_hash_idx" ON "desktopMachineSnapshot" USING btree ("snapshotHash");
