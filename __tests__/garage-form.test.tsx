import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { GarageForm } from "../components/garage-form";
import { BALLS, BOOSTS, CARS, HATS, STADIUMS, STADIUM_IMAGES, DEFAULT_LOADOUT } from "../lib/garage-items";
import en from "../messages/en.json";

function garage(guest = false) {
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={DEFAULT_LOADOUT} guest={guest} />
  </NextIntlClientProvider>);
}

afterEach(cleanup);

test.each(STADIUMS)("Should_PreviewSubmitAndRestoreStadium_When_Selecting_%s", stadium => {
  garage();
  fireEvent.click(screen.getByLabelText(en.Garage.items.stadium[stadium]));
  expect(new FormData(document.querySelector("form")!).get("stadium")).toBe(stadium);
  const preview = screen.getByRole("group", { name: "Stadium preview" });
  expect(within(preview).getByRole("heading", { name: en.Garage.items.stadium[stadium] })).toBeTruthy();
  expect(decodeURIComponent(preview.querySelector("img")!.getAttribute("src")!)).toContain(STADIUM_IMAGES[stadium]);
  cleanup();
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={{ ...DEFAULT_LOADOUT, stadium }} guest={false} />
  </NextIntlClientProvider>);
  expect((screen.getByLabelText(en.Garage.items.stadium[stadium]) as HTMLInputElement).checked).toBe(true);
});

test("Should_AllowStadiumPreviewWithoutSaving_When_UserIsGuest", () => {
  garage(true);
  fireEvent.click(screen.getByLabelText("Top-down"));
  expect(within(screen.getByRole("group", { name: "Stadium preview" })).getByRole("heading", { name: "Top-down" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save my garage" })).toBeNull();
});

test("Should_UpdatePreview_When_ChoosingItems", () => {
  garage();
  fireEvent.click(screen.getByLabelText("Flames"));
  fireEvent.click(screen.getByLabelText("Traffic cone"));
  fireEvent.click(screen.getByLabelText("Beach ball"));

  expect(screen.getByRole("img", { name: "Octane with Flames boost, hat: Traffic cone, ball: Beach ball" })).toBeTruthy();
  expect(document.querySelector("[data-item=flames]")).toBeTruthy();
  expect(document.querySelector("[data-item=cone]")).toBeTruthy();
  expect(document.querySelector("[data-item=beach]")).toBeTruthy();
});

test("Should_OfferNoneForHatAndBall_But_NotForBoost", () => {
  garage();

  expect(within(screen.getByRole("group", { name: "Hat" })).getByLabelText("None")).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "Ball" })).getByLabelText("None")).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "Boost" })).queryByLabelText("None")).toBeNull();
});

test("Should_DrawDistinctBodies_When_ChoosingEachCar", () => {
  garage();
  const drawings = new Set<string>();
  for (const car of CARS) {
    const name = en.Garage.items.car[car];
    fireEvent.click(screen.getByLabelText(name));
    const preview = screen.getByRole("img", { name: `${name} with Standard boost, hat: None, ball: None` });
    const body = preview.querySelector(`[data-body="${car}"]`);
    expect(body).toBeTruthy();
    drawings.add(body!.innerHTML);
    expect(preview.querySelector("[data-item=placeholder]")).toBeNull();
    expect(new FormData(document.querySelector("form")!).get("car")).toBe(car);
  }
  expect(drawings.size).toBe(CARS.length);
});

test.each(CARS)("Should_KeepAccessories_When_Selecting_%s", (car) => {
  garage();
  for (const item of ["Flames", "Traffic cone", "Beach ball", en.Garage.items.car[car]]) {
    fireEvent.click(screen.getByLabelText(item));
  }
  const preview = screen.getByRole("img");
  for (const item of ["flames", "cone", "beach"]) {
    expect(preview.querySelector(`[data-item="${item}"]`)).toBeTruthy();
  }
  expect(preview.querySelector(`[data-body="${car}"]`)).toBeTruthy();
});

test.each(CARS)("Should_PreviewSavedBody_When_Loading_%s", (car) => {
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={{ ...DEFAULT_LOADOUT, car }} guest={false} />
  </NextIntlClientProvider>);
  expect((screen.getByLabelText(en.Garage.items.car[car]) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("img").querySelector(`[data-body="${car}"]`)).toBeTruthy();
});

test("Should_HideSaveButtonAndInviteToSignUp_When_UserIsGuest", () => {
  garage(true);

  expect(screen.queryByRole("button", { name: "Save my garage" })).toBeNull();
  expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup");
});

test.each(BOOSTS)("Should_PreviewAndSubmitBoost_When_Selecting_%s", (boost) => {
  garage();
  fireEvent.click(screen.getByLabelText(en.Garage.items.boost[boost]));
  expect(screen.getByRole("img").querySelector(`[data-item="${boost}"]`)).toBeTruthy();
  expect(new FormData(document.querySelector("form")!).get("boost")).toBe(boost);
});

test.each(BOOSTS)("Should_PreviewSavedBoost_When_Loading_%s", (boost) => {
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={{ ...DEFAULT_LOADOUT, boost }} guest={false} />
  </NextIntlClientProvider>);
  expect((screen.getByLabelText(en.Garage.items.boost[boost]) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("img").querySelector(`[data-item="${boost}"]`)).toBeTruthy();
});

test.each(HATS)("Should_PreviewSubmitAndRemoveHat_When_Selecting_%s", (hat) => {
  garage();
  const hats = within(screen.getByRole("group", { name: "Hat" }));
  fireEvent.click(hats.getByLabelText(en.Garage.items.hat[hat]));
  expect(new FormData(document.querySelector("form")!).get("hat")).toBe(hat);
  for (const car of CARS) {
    fireEvent.click(screen.getByLabelText(en.Garage.items.car[car]));
    const preview = screen.getByRole("img");
    if (hat !== "none") expect(preview.querySelector(`[data-item="${hat}"]`)).toBeTruthy();
    expect(preview.getAttribute("aria-label")).toContain(`hat: ${en.Garage.items.hat[hat]}`);
  }
  fireEvent.click(hats.getByLabelText("None"));
  for (const item of HATS) expect(screen.getByRole("img").querySelector(`[data-item="${item}"]`)).toBeNull();
});

test.each(HATS)("Should_PreviewSavedHat_When_Loading_%s", (hat) => {
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={{ ...DEFAULT_LOADOUT, hat }} guest={false} />
  </NextIntlClientProvider>);
  const hats = within(screen.getByRole("group", { name: "Hat" }));
  expect((hats.getByLabelText(en.Garage.items.hat[hat]) as HTMLInputElement).checked).toBe(true);
  if (hat !== "none") expect(screen.getByRole("img").querySelector(`[data-item="${hat}"]`)).toBeTruthy();
});


test.each(BALLS)("Should_PreviewSubmitAndRestoreBall_When_Selecting_%s", (ball) => {
  garage();
  const balls = within(screen.getByRole("group", { name: "Ball" }));
  fireEvent.click(balls.getByLabelText(en.Garage.items.ball[ball]));
  expect(new FormData(document.querySelector("form")!).get("ball")).toBe(ball);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain(`ball: ${en.Garage.items.ball[ball]}`);
  if (ball !== "none") expect(screen.getByRole("img").querySelector(`[data-item="${ball}"]`)).toBeTruthy();
  cleanup();
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={{ ...DEFAULT_LOADOUT, ball }} guest={false} />
  </NextIntlClientProvider>);
  expect((within(screen.getByRole("group", { name: "Ball" })).getByLabelText(en.Garage.items.ball[ball]) as HTMLInputElement).checked).toBe(true);
  if (ball !== "none") expect(screen.getByRole("img").querySelector(`[data-item="${ball}"]`)).toBeTruthy();
});
