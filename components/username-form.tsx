"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { UsernameFormState } from "@/app/actions/username";

type Props = {
  change: (state: UsernameFormState, formData: FormData) => Promise<UsernameFormState>;
  revert: () => Promise<void>;
  username: string;
  // Dates déjà formatées par la page ; null quand elles ne s'appliquent pas.
  nextChange: string | null;
  previousUsername: string | null;
  reservedUntil: string | null;
};

// Le propriétaire change son nom une fois par 30 jours, ou revient à l'ancien tant qu'il est réservé (#67).
export function UsernameForm({ change, revert, username, nextChange, previousUsername, reservedUntil }: Props) {
  const t = useTranslations("Profile.username");
  const authErrors = useTranslations("Auth.errors");
  const [state, formAction, pending] = useActionState(change, undefined);
  const error = state?.error;

  return (
    <form action={formAction} className="panel form-stack username-form">
      <label className="field">
        {t("label")}
        <input
          name="username"
          defaultValue={state?.username ?? username}
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          autoComplete="username"
          disabled={nextChange !== null}
        />
      </label>
      <p className="description">{nextChange ? t("cooldown", { date: nextChange }) : t("hint")}</p>
      {error && (
        <p role="alert" className="form-error">
          {authErrors.has(error) ? authErrors(error) : t(`errors.${error}`)}
        </p>
      )}
      <div className="avatar-form-actions">
        <button type="submit" disabled={pending || nextChange !== null} className="btn btn-primary">
          {t("submit")}
        </button>
        {previousUsername && reservedUntil && (
          <button type="submit" formAction={revert} formNoValidate disabled={pending} className="btn btn-secondary">
            {t("revert", { name: previousUsername })}
          </button>
        )}
      </div>
      {previousUsername && reservedUntil && (
        <p className="description">{t("reserved", { name: previousUsername, date: reservedUntil })}</p>
      )}
    </form>
  );
}
