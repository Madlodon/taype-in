import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { AvatarForm } from "../components/avatar-form";
import fr from "../messages/fr.json";

const MAX = 2 * 1024 * 1024;

function renderForm(hasPhoto = false) {
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AvatarForm upload={vi.fn()} remove={vi.fn()} hasPhoto={hasPhoto} maxBytes={MAX} />
    </NextIntlClientProvider>,
  );
}

function choose(size: number) {
  const file = new File(["x"], "photo.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: size });
  fireEvent.change(screen.getByLabelText(/Photo de profil/), { target: { files: [file] } });
}

beforeEach(() => {
  cleanup();
});

test("Should_OfferUploadOnly_When_OwnerHasNoPhoto", () => {
  renderForm();

  expect(screen.getByRole("button", { name: "Téléverser" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Retirer la photo" })).toBeNull();
});

test("Should_OfferReplaceAndRemove_When_OwnerHasPhoto", () => {
  renderForm(true);

  expect(screen.getByRole("button", { name: "Remplacer" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Retirer la photo" })).toBeDefined();
});

test("Should_AcceptOnlyPngJpegAndWebp_When_ChoosingAFile", () => {
  renderForm();

  expect(screen.getByLabelText(/Photo de profil/).getAttribute("accept")).toBe("image/png,image/jpeg,image/webp");
});

test("Should_ShowErrorAndBlockUpload_When_FileIsOverTwoMegabytes", () => {
  renderForm();

  choose(MAX + 1);

  expect(screen.getByRole("alert").textContent).toBe("Ce fichier dépasse 2 Mo.");
  expect((screen.getByRole("button", { name: "Téléverser" }) as HTMLButtonElement).disabled).toBe(true);
});

test("Should_AllowUpload_When_FileIsExactlyTwoMegabytes", () => {
  renderForm();

  choose(MAX);

  expect(screen.queryByRole("alert")).toBeNull();
  expect((screen.getByRole("button", { name: "Téléverser" }) as HTMLButtonElement).disabled).toBe(false);
});
