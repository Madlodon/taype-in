import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocaleSwitcher } from "../components/locale-switcher";

vi.mock("../app/actions/locale", () => ({ setLocaleAction: vi.fn() }));

beforeEach(() => {
  cleanup();
});

test("Should_OfferFrenchAndEnglish_When_Rendered", async () => {
  render(await LocaleSwitcher());

  expect(screen.getByRole("button", { name: "Français" }).getAttribute("value")).toBe("fr");
  expect(screen.getByRole("button", { name: "English" }).getAttribute("value")).toBe("en");
});

test("Should_MarkCurrentLocaleAsPressed_When_Rendered", async () => {
  render(await LocaleSwitcher());

  expect(screen.getByRole("button", { name: "Français", pressed: true })).toBeDefined();
  expect(screen.getByRole("button", { name: "English", pressed: false })).toBeDefined();
});
