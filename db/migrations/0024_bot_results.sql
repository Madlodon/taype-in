CREATE TYPE "public"."bot_level" AS ENUM('noob', 'beginner', 'intermediate', 'expert', 'impossible');--> statement-breakpoint
CREATE TABLE "bot_results" (
	"race_id" uuid NOT NULL,
	"bot_level" "bot_level" NOT NULL,
	"bot_number" integer NOT NULL,
	"rank" integer NOT NULL,
	"wpm" real NOT NULL,
	"raw_wpm" real NOT NULL,
	"accuracy" real NOT NULL,
	"duration_ms" integer NOT NULL,
	"error_count" integer NOT NULL,
	"finished" boolean NOT NULL,
	"gave_up" boolean NOT NULL,
	"bonuses" integer NOT NULL,
	"key_errors" jsonb NOT NULL,
	"wpm_series" jsonb NOT NULL,
	CONSTRAINT "bot_results_race_id_bot_level_bot_number_pk" PRIMARY KEY("race_id","bot_level","bot_number"),
	CONSTRAINT "bot_results_rank_positive" CHECK ("bot_results"."rank" >= 1),
	CONSTRAINT "bot_results_accuracy_range" CHECK ("bot_results"."accuracy" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "bot_results" ADD CONSTRAINT "bot_results_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;