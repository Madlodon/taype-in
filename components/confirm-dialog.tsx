"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Remplace window.confirm : même look que le site, et le navigateur ne peut pas le bloquer.
// showModal() bloque l'arrière-plan, garde le focus dans la boîte et ferme avec Échap.
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const t = useTranslations("ConfirmDialog");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog panel panel-accent"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="confirm-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="confirm-dialog-close" aria-label={t("close")} onClick={onCancel}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <p id={messageId}>{message}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
