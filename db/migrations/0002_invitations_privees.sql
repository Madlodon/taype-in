CREATE TABLE "lobby_invites" (
	"token" text PRIMARY KEY NOT NULL,
	"lobby_id" uuid NOT NULL,
	"used_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lobby_invites" ADD CONSTRAINT "lobby_invites_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lobby_invites" ADD CONSTRAINT "lobby_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lobby_invites_lobby_id_idx" ON "lobby_invites" USING btree ("lobby_id");