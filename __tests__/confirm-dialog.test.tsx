import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ConfirmDialog } from "../components/confirm-dialog";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

afterEach(cleanup);

function renderDialog(locale: "fr" | "en" = "fr") {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <ConfirmDialog message="Fermer la course ?" confirmLabel="Fermer" onConfirm={onConfirm}
        onCancel={onCancel} />
    </NextIntlClientProvider>,
  );
  return { onConfirm, onCancel };
}

test("Should_OpenAsModalNamedByMessage_When_Rendered", () => {
  renderDialog();

  const dialog = screen.getByRole("dialog", { name: "Fermer la course ?" }) as HTMLDialogElement;

  expect(dialog.open).toBe(true);
});

test("Should_CallOnConfirmOnly_When_ConfirmButtonIsClicked", () => {
  const { onConfirm, onCancel } = renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
});

test("Should_CallOnCancelOnly_When_CancelButtonIsClicked", () => {
  const { onConfirm, onCancel } = renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

test("Should_CallOnCancelAndStayOpen_When_EscapeCancelsTheDialog", () => {
  const { onCancel } = renderDialog();
  const dialog = screen.getByRole("dialog") as HTMLDialogElement;

  // Échap déclenche l'événement « cancel » du <dialog> ; le parent décide de le retirer.
  const event = new Event("cancel", { cancelable: true });
  fireEvent(dialog, event);

  expect(onCancel).toHaveBeenCalledOnce();
  expect(event.defaultPrevented).toBe(true);
});

test("Should_TranslateCancelButton_When_LocaleIsEnglish", () => {
  renderDialog("en");

  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
});
