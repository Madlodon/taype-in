import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { AvatarForm } from "../components/avatar-form";
import fr from "../messages/fr.json";

const MAX = 2 * 1024 * 1024;
const SRC = "/avatars/user-1";

function renderForm(hasPhoto = false) {
  const { container } = render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <AvatarForm upload={vi.fn()} remove={vi.fn()} src={SRC} hasPhoto={hasPhoto} maxBytes={MAX} />
    </NextIntlClientProvider>,
  );
  return container.querySelector("img")!;
}

function choose(size: number) {
  const file = new File(["x"], "photo.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: size });
  fireEvent.change(screen.getByLabelText("Photo de profil"), { target: { files: [file] } });
}

function saveButton() {
  return screen.getByRole("button", { name: "Enregistrer la photo" }) as HTMLButtonElement;
}

beforeEach(() => {
  cleanup();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

test("Should_ShowCurrentPhotoAndDisableSave_When_NoFileIsChosen", () => {
  const img = renderForm();

  expect(img.getAttribute("src")).toBe(SRC);
  expect(saveButton().disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Retirer la photo" })).toBeNull();
});

test("Should_OfferRemove_When_OwnerHasPhoto", () => {
  renderForm(true);

  expect(screen.getByRole("button", { name: "Retirer la photo" })).toBeDefined();
});

test("Should_AcceptOnlyPngJpegAndWebp_When_ChoosingAFile", () => {
  renderForm();

  expect(screen.getByLabelText("Photo de profil").getAttribute("accept")).toBe("image/png,image/jpeg,image/webp");
});

test("Should_PreviewImageAndEnableSave_When_FileIsExactlyTwoMegabytes", () => {
  const img = renderForm();

  choose(MAX);

  expect(img.getAttribute("src")).toBe("blob:preview");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(saveButton().disabled).toBe(false);
});

test("Should_ShowErrorKeepPhotoAndBlockSave_When_FileIsOverTwoMegabytes", () => {
  const img = renderForm();

  choose(MAX + 1);

  expect(screen.getByRole("alert").textContent).toBe("Ce fichier dépasse 2 Mo.");
  expect(img.getAttribute("src")).toBe(SRC);
  expect(saveButton().disabled).toBe(true);
});
