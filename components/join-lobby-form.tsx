"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { joinLobbyAction } from "@/app/actions/lobbies";

export function JoinLobbyForm() {
  const t = useTranslations("Lobbies");
  const [state, formAction, pending] = useActionState(joinLobbyAction, undefined);

  return (
    <form action={formAction} className="form-stack">
      <label className="field">
        {t("code")}
        <input
          name="code"
          required
          maxLength={16}
          autoComplete="off"
          defaultValue={state?.code}
          className="uppercase font-mono tracking-widest"
        />
      </label>
      {state?.error && (
        <p role="alert" className="form-error">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {t("join")}
      </button>
    </form>
  );
}
