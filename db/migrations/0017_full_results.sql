ALTER TABLE "results" ADD COLUMN "raw_wpm" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "gave_up" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "bonuses" integer DEFAULT 0 NOT NULL;