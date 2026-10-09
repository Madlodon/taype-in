"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/actions/auth";

type Props = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  // Sans mot de passe pour un compte Discord ou GitHub : seulement le nom.
  passwordAutoComplete?: "current-password" | "new-password";
  // Page où revenir après la connexion (ex. un lien d'invitation).
  next?: string;
  defaultUsername?: string;
};

export function AuthForm({ action, submitLabel, passwordAutoComplete, next, defaultUsername }: Props) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="form-stack">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="field">
        {t("username")}
        <input
          name="username"
          required
          autoComplete="username"
          defaultValue={state?.username ?? defaultUsername}

        />
      </label>
      {passwordAutoComplete && <label className="field">
        {t("password")}
        <input
          name="password"
          type="password"
          required
          autoComplete={passwordAutoComplete}

        />
      </label>}
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
