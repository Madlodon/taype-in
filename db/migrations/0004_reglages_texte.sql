ALTER TABLE "lobbies" ADD COLUMN "text_language" "language" DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "lobbies" ADD COLUMN "text_length" integer DEFAULT 100 NOT NULL;