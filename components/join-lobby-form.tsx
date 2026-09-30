"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { joinLobbyAction } from "@/app/actions/lobbies";

export function JoinLobbyForm() {
  const t = useTranslations("Lobbies");
  const [state, formAction, pending] = useActionState(joinLobbyAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        {t("code")}
        <input
          name="code"
          required
          maxLength={16}
          autoComplete="off"
          defaultValue={state?.code}
          className="rounded border px-2 py-1 uppercase"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {t("join")}
      </button>
    </form>
  );
}
