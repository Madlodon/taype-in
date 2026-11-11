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
      <ConfirmDialog title="Fermer la course ?" message="Tous les participants partiront."
        confirmLabel="Fermer la course" onConfirm={onConfirm} onCancel={onCancel} />
    </NextIntlClientProvider>,
  );
  return { onConfirm, onCancel };
}

test("Should_OpenAsModalNamedByTitleAndDescribedByMessage_When_Rendered", () => {
  renderDialog();

  const dialog = screen.getByRole("dialog", {
    name: "Fermer la course ?",
    description: "Tous les participants partiront.",
  }) as HTMLDialogElement;

  expect(dialog.open).toBe(true);
  expect(screen.getByRole("heading", { name: "Fermer la course ?" })).toBeTruthy();
});

test("Should_CallOnConfirmOnly_When_ConfirmButtonIsClicked", () => {
  const { onConfirm, onCancel } = renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
});

test("Should_CallOnCancelOnly_When_CancelButtonIsClicked", () => {
  const { onConfirm, onCancel } = renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

test("Should_CallOnCancelOnly_When_CloseIconIsClicked", () => {
  const { onConfirm, onCancel } = renderDialog();

  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

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

test("Should_TranslateButtons_When_LocaleIsEnglish", () => {
  renderDialog("en");

  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
});
