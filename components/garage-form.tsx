"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { GarageFormState } from "@/app/actions/garage";
import { Car } from "@/components/arena";
import { BALLS, BOOSTS, CARS, HATS, STADIUMS, STADIUM_IMAGES, unlockLevel, type Loadout } from "@/lib/garage-items";

type Props = {
  action: (state: GarageFormState, formData: FormData) => Promise<GarageFormState>;
  initial: Loadout;
  // Un invité voit le garage mais ne peut pas l'enregistrer.
  guest: boolean;
  // Niveau du joueur : les objets plus hauts sont verrouillés (#35).
  level: number;
};

const CATEGORIES = [["car", CARS], ["boost", BOOSTS], ["hat", HATS], ["ball", BALLS]] as const;

export function GarageForm({ action, initial, guest, level }: Props) {
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
              {items.map((item) => {
                const required = unlockLevel(category, item);
                return (
                  <label key={item} className="radio-option">
                    <input
                      type="radio"
                      name={category}
                      value={item}
                      checked={loadout[category] === item}
                      disabled={required > level}
                      onChange={() => setLoadout({ ...loadout, [category]: item })}
                    />
                    <span>
                      {t(`items.${category}.${item}`)}
                      {required > level && <span className="lock-level">{t("lockedAt", { level: required })}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className="text-sm font-semibold">{t("categories.stadium")}</legend>
          <div className="stadium-options">
            {STADIUMS.map(stadium => <label key={stadium} className="stadium-option">
              <input type="radio" name="stadium" value={stadium} checked={loadout.stadium === stadium}
                onChange={() => setLoadout({ ...loadout, stadium })} />
              <Image src={STADIUM_IMAGES[stadium]} alt="" width={280} height={180} sizes="(max-width: 640px) 30vw, 160px" />
              <span>{t(`items.stadium.${stadium}`)}</span>
            </label>)}
          </div>
        </fieldset>
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
        <section role="group" aria-label={t("stadiumPreview")}>
          <h3 className="text-sm font-semibold">{t(`items.stadium.${loadout.stadium}`)}</h3>
          <Image className="stadium-preview" src={STADIUM_IMAGES[loadout.stadium]} alt="" width={1400} height={900} sizes="(max-width: 900px) 100vw, 600px" />
        </section>
      </aside>
    </div>
  );
}
