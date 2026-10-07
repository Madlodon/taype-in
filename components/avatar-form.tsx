"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { AvatarFormState } from "@/app/actions/avatar";

type Props = {
  upload: (state: AvatarFormState, formData: FormData) => Promise<AvatarFormState>;
  remove: () => Promise<void>;
  hasPhoto: boolean;
  maxBytes: number;
};

// Le propriétaire téléverse, remplace ou retire sa photo (PROF-1).
export function AvatarForm({ upload, remove, hasPhoto, maxBytes }: Props) {
  const t = useTranslations("Profile.photo");
  const [state, formAction, pending] = useActionState(upload, undefined);
  // Vérifié avant l'envoi : un fichier trop gros dépasserait la limite des actions serveur.
  const [tooLarge, setTooLarge] = useState(false);
  const error = tooLarge ? "tooLarge" : state?.error;

  return (
    <form action={formAction} className="panel avatar-form">
      <label className="text-sm font-semibold">
        {t("label")}
        <input
          type="file"
          name="photo"
          accept="image/png,image/jpeg,image/webp"
          required
          onChange={(event) => setTooLarge((event.target.files?.[0]?.size ?? 0) > maxBytes)}
        />
      </label>
      {error && <p role="alert" className="form-error">{t(`errors.${error}`)}</p>}
      <div className="avatar-form-actions">
        <button type="submit" disabled={pending || tooLarge} className="btn btn-primary">
          {hasPhoto ? t("replace") : t("upload")}
        </button>
        {hasPhoto && (
          <button type="submit" formAction={remove} formNoValidate disabled={pending} className="btn btn-secondary">
            {t("remove")}
          </button>
        )}
      </div>
    </form>
  );
}
