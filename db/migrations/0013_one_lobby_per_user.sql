-- Garde seulement le lobby le plus récent de chaque personne avant d'ajouter la contrainte.
DELETE FROM "lobby_participants" AS "older" USING "lobby_participants" AS "newer" WHERE "older"."user_id" = "newer"."user_id" AND ("older"."joined_at", "older"."lobby_id") < ("newer"."joined_at", "newer"."lobby_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lobby_participants_user_id_idx" ON "lobby_participants" USING btree ("user_id");
