"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import type { AvatarFormState } from "@/app/actions/avatar";

type Props = {
  upload: (state: AvatarFormState, formData: FormData) => Promise<AvatarFormState>;
  remove: () => Promise<void>;
  // Adresse de la photo actuelle (ou des initiales).
  src: string;
  hasPhoto: boolean;
  maxBytes: number;
};

// Le propriétaire téléverse, remplace ou retire sa photo (PROF-1).
// Le cercle ouvre le choix de fichier (#259) ; l'image choisie se cadre ensuite dans le
// recadreur rond (glisser + zoom) et seule la zone gardée est envoyée avec le fichier (#262).
export function AvatarForm({ upload, remove, src, hasPhoto, maxBytes }: Props) {
  const t = useTranslations("Profile.photo");
  const [state, formAction, pending] = useActionState(upload, undefined);
  // Vérifié avant l'envoi : un fichier trop gros dépasserait la limite des actions serveur.
  const [tooLarge, setTooLarge] = useState(false);
  // L'aperçu ne vaut que pour la photo et le résultat affichés quand on l'a choisi :
  // après un envoi, React vide le champ, donc l'aperçu disparaît avec lui.
  const [picked, setPicked] = useState<{ url: string; src: string; state: AvatarFormState } | null>(null);
  const preview = picked && picked.src === src && picked.state === state ? picked.url : null;
  const error = tooLarge ? "tooLarge" : state?.error;
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // En pixels de l'image d'origine ; donné par le recadreur une fois l'image chargée.
  const [area, setArea] = useState<Area | null>(null);

  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  function choose(file: File | undefined) {
    const large = (file?.size ?? 0) > maxBytes;
    setTooLarge(large);
    setPicked(file && !large ? { url: URL.createObjectURL(file), src, state } : null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }

  return (
    <form action={formAction} className="panel form-stack avatar-form">
      <label className="field">
        {t("label")}
        <span className="avatar-picker">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local ou image servie par notre route */}
          <img src={src} alt="" width={112} height={112} className="avatar" />
          <span className="avatar-picker-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          <input
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp"
            required
            className="sr-only"
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </span>
      </label>
      <p className="description">{t(preview ? "cropHint" : "hint")}</p>
      {preview && (
        <>
          <div className="avatar-cropper">
            <Cropper
              image={preview}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <label className="field">
            {t("zoom")}
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          {/* Arrondi vers le bas : x + largeur ne dépasse jamais l'image. */}
          {area && (
            <>
              <input type="hidden" name="cropX" value={Math.floor(area.x)} />
              <input type="hidden" name="cropY" value={Math.floor(area.y)} />
              <input type="hidden" name="cropWidth" value={Math.floor(area.width)} />
              <input type="hidden" name="cropHeight" value={Math.floor(area.height)} />
            </>
          )}
        </>
      )}
      {error && <p role="alert" className="form-error">{t(`errors.${error}`)}</p>}
      <div className="avatar-form-actions">
        <button type="submit" disabled={pending || !preview} className="btn btn-primary">
          {t("save")}
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
