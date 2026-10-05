ALTER TABLE "users" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Tout le monde part de 0 XP : les objets du garage autres que ceux par défaut sont verrouillés (#35).
UPDATE "users" SET "car" = 'octane', "boost" = 'standard', "hat" = 'none', "ball" = 'none';
