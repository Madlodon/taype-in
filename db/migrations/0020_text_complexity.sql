CREATE TYPE "public"."text_complexity" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_complexity" text_complexity DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_punctuation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_numbers" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_capitals" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_accents" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "texts" ADD COLUMN "complexity" text_complexity DEFAULT 'medium' NOT NULL;