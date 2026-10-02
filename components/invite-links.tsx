import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { createInvitesAction } from "@/app/actions/lobbies";
import { listInvites, MAX_INVITES, type Lobby } from "@/lib/lobbies";

// Panneau de l'hôte d'une course privée : générer et copier les liens (LOB-3).
export async function InviteLinks({ lobby }: { lobby: Lobby }) {
  const t = await getTranslations("Invites");
  const invites = await listInvites(lobby.id);
  const unused = invites.filter((invite) => !invite.used);
  // Derrière Caddy, le protocole d'origine arrive dans x-forwarded-proto.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <section className="panel panel-accent">
      <h2>{t("title")}</h2>
      <p className="description mb-6">{t("description")}</p>
      <form action={createInvitesAction} className="form-stack">
        <input type="hidden" name="code" value={lobby.code} />
        <label className="field">
          {t("count")}
          <input name="count" type="number" min={1} max={MAX_INVITES} defaultValue={1} required />
        </label>
        <button type="submit" className="btn btn-primary">{t("generate")}</button>
      </form>
      {invites.length === 0 ? <p className="room-info">{t("none")}</p> : <>
        <p className="room-info">{t("usage", { used: invites.length - unused.length, total: invites.length })}</p>
        {unused.length > 0 && <label className="field mt-5">
          {t("unusedLinks")}
          <textarea
            readOnly
            rows={Math.min(unused.length, 8)}
            value={unused.map((invite) => `${origin}/invite/${invite.token}`).join("\n")}
            className="font-mono"
          />
        </label>}
      </>}
    </section>
  );
}
