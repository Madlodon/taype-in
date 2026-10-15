CREATE TYPE "public"."text_type" AS ENUM('sentences', 'words');--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_type" text_type DEFAULT 'sentences' NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_targets" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_letters" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "custom_text" text;