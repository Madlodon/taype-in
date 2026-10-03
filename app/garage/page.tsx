import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { saveLoadoutAction } from "@/app/actions/garage";
import { GarageForm } from "@/components/garage-form";
import { getLoadout } from "@/lib/garage";
import { getCurrentUser } from "@/lib/session-cookie";

export default async function GaragePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/garage");
  const t = await getTranslations("Garage");
  return (
    <main id="main" className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("tag")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="description">{t("description")}</p>
        </div>
      </div>
      <GarageForm action={saveLoadoutAction} initial={await getLoadout(user.id)} guest={user.isGuest} />
    </main>
  );
}
