CREATE TYPE "public"."oauth_provider" AS ENUM('discord', 'github');--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"provider" "oauth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "oauth_accounts_provider_provider_user_id_pk" PRIMARY KEY("provider","provider_user_id")
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;