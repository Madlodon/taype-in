"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/actions/auth";

type Props = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
};

export function AuthForm({ action, submitLabel, passwordAutoComplete }: Props) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-4">
      <label className="flex flex-col gap-1">
        {t("username")}
        <input
          name="username"
          required
          autoComplete="username"
          defaultValue={state?.username}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("password")}
        <input
          name="password"
          type="password"
          required
          autoComplete={passwordAutoComplete}
          className="rounded border px-2 py-1"
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
        {submitLabel}
      </button>
    </form>
  );
}
