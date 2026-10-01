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
    <form action={formAction} className="form-stack">
      <label className="field">
        {t("username")}
        <input
          name="username"
          required
          autoComplete="username"
          defaultValue={state?.username}

        />
      </label>
      <label className="field">
        {t("password")}
        <input
          name="password"
          type="password"
          required
          autoComplete={passwordAutoComplete}

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
        {submitLabel}
      </button>
    </form>
  );
}
