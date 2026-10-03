"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { GarageFormState } from "@/app/actions/garage";
import { Car } from "@/components/arena";
import { BALLS, BOOSTS, CARS, HATS, type Loadout } from "@/lib/garage-items";

type Props = {
  action: (state: GarageFormState, formData: FormData) => Promise<GarageFormState>;
  initial: Loadout;
  // Un invité voit le garage mais ne peut pas l'enregistrer.
  guest: boolean;
};

const CATEGORIES = [["car", CARS], ["boost", BOOSTS], ["hat", HATS], ["ball", BALLS]] as const;

export function GarageForm({ action, initial, guest }: Props) {
  const t = useTranslations("Garage");
  const [state, formAction, pending] = useActionState(action, undefined);
  const [loadout, setLoadout] = useState(initial);

  return (
    <div className="split-layout">
      <form action={formAction} className="panel panel-accent form-stack">
        {CATEGORIES.map(([category, items]) => (
          <fieldset key={category}>
            <legend className="text-sm font-semibold">{t(`categories.${category}`)}</legend>
            <div className="garage-options">
              {items.map((item) => (
                <label key={item} className="radio-option">
                  <input
                    type="radio"
                    name={category}
                    value={item}
                    checked={loadout[category] === item}
                    onChange={() => setLoadout({ ...loadout, [category]: item })}
                  />
                  {t(`items.${category}.${item}`)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {state?.error && <p role="alert" className="form-error">{t(`errors.${state.error}`)}</p>}
        {state?.saved && <p role="status">{t("saved")}</p>}
        {guest
          ? <p className="description">{t("guestNotice")} <Link href="/signup">{t("signUp")}</Link></p>
          : <button type="submit" disabled={pending} className="btn btn-primary">{t("save")}</button>}
      </form>
      <aside className="panel side-stack garage-preview-panel">
        <h2>{t("preview")}</h2>
        <svg className="garage-preview" viewBox="-140 -62 230 97" role="img" aria-label={t("previewLabel", {
          car: t(`items.car.${loadout.car}`),
          boost: t(`items.boost.${loadout.boost}`),
          hat: t(`items.hat.${loadout.hat}`),
          ball: t(`items.ball.${loadout.ball}`),
        })}>
          <Car x={0} y={0} body={loadout.car} boost={loadout.boost} hat={loadout.hat} ball={loadout.ball} />
        </svg>
      </aside>
    </div>
  );
}
