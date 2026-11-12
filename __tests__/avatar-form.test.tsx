import { beforeEach, expect, test, vi } from "vitest";
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { AvatarForm } from "../components/avatar-form";
import fr from "../messages/fr.json";

// Le vrai recadreur a besoin des dimensions de l'image, que jsdom ne donne pas :
// celui-ci annonce tout de suite une zone avec des décimales.
vi.mock("react-easy-crop", () => ({
  default: function FakeCropper(props: {
    image: string;
    zoom: number;
    onCropComplete: (area: object, pixels: object) => void;
  }) {
    // Une seule fois, comme le vrai quand l'image est chargée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => props.onCropComplete({}, { x: 10.6, y: 0, width: 79.7, height: 79.7 }), []);
    return <div data-testid="cropper" data-image={props.image} data-zoom={props.zoom} />;
  },
}));

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

function hidden(name: string) {
  return (document.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value;
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

test("Should_OpenCropperAndEnableSave_When_FileIsExactlyTwoMegabytes", () => {
  const img = renderForm();

  choose(MAX);

  expect(screen.getByTestId("cropper").getAttribute("data-image")).toBe("blob:preview");
  expect(img.getAttribute("src")).toBe(SRC);
  expect(screen.getByText("Glisse l’image pour la placer dans le cercle et zoome avec le curseur.")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(saveButton().disabled).toBe(false);
});

test("Should_SendWholePixelsInsideImage_When_CropperGivesDecimals", () => {
  renderForm();

  choose(MAX);

  expect([hidden("cropX"), hidden("cropY"), hidden("cropWidth"), hidden("cropHeight")]).toEqual(["10", "0", "79", "79"]);
});

test("Should_ZoomCropper_When_SliderMoves", () => {
  renderForm();
  choose(MAX);

  fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "2.5" } });

  expect(screen.getByTestId("cropper").getAttribute("data-zoom")).toBe("2.5");
});

test("Should_HideCropperAndSendNoArea_When_NoFileIsChosen", () => {
  renderForm();

  expect(screen.queryByTestId("cropper")).toBeNull();
  expect(screen.queryByLabelText("Zoom")).toBeNull();
  expect(hidden("cropWidth")).toBeUndefined();
});

test("Should_ShowErrorKeepPhotoAndBlockSave_When_FileIsOverTwoMegabytes", () => {
  const img = renderForm();

  choose(MAX + 1);

  expect(screen.getByRole("alert").textContent).toBe("Ce fichier dépasse 2 Mo.");
  expect(img.getAttribute("src")).toBe(SRC);
  expect(screen.queryByTestId("cropper")).toBeNull();
  expect(saveButton().disabled).toBe(true);
});
