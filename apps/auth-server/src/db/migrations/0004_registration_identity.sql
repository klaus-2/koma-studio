CREATE TABLE "registrationIdentity" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"identityType" text NOT NULL,
	"identityHash" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registrationIdentity" ADD CONSTRAINT "registrationIdentity_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "registration_identity_type_hash_unique" ON "registrationIdentity" USING btree ("identityType","identityHash");
--> statement-breakpoint
CREATE UNIQUE INDEX "registration_identity_user_type_unique" ON "registrationIdentity" USING btree ("userId","identityType");
--> statement-breakpoint
CREATE INDEX "registration_identity_user_idx" ON "registrationIdentity" USING btree ("userId");
