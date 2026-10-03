import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { GarageForm } from "../components/garage-form";
import { DEFAULT_LOADOUT } from "../lib/garage-items";
import en from "../messages/en.json";

function garage(guest = false) {
  render(<NextIntlClientProvider locale="en" messages={en}>
    <GarageForm action={vi.fn()} initial={DEFAULT_LOADOUT} guest={guest} />
  </NextIntlClientProvider>);
}

afterEach(cleanup);

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

test("Should_ShowPlaceholder_When_CarModelIsNotDrawnYet", () => {
  garage();
  expect(screen.queryByText(en.Garage.placeholder)).toBeNull();

  fireEvent.click(screen.getByLabelText("Fennec"));

  expect(screen.getByText(en.Garage.placeholder)).toBeTruthy();
  expect(document.querySelector("[data-item=placeholder]")).toBeTruthy();
});

test("Should_HideSaveButtonAndInviteToSignUp_When_UserIsGuest", () => {
  garage(true);

  expect(screen.queryByRole("button", { name: "Save my garage" })).toBeNull();
  expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup");
});
