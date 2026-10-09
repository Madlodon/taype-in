import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OAuthButtons } from "../components/oauth-buttons";

vi.mock("../db/index.ts", () => ({ db: {} }));

beforeEach(() => {
  cleanup();
  vi.stubEnv("DISCORD_CLIENT_ID", "");
  vi.stubEnv("DISCORD_CLIENT_SECRET", "");
  vi.stubEnv("GITHUB_CLIENT_ID", "");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function configure(provider: "DISCORD" | "GITHUB") {
  vi.stubEnv(`${provider}_CLIENT_ID`, "id");
  vi.stubEnv(`${provider}_CLIENT_SECRET`, "secret");
}

test("Should_LinkToEachConfiguredProvider_When_KeysAreSet", async () => {
  configure("DISCORD");
  configure("GITHUB");

  render(await OAuthButtons({}));

  expect(screen.getByRole("link", { name: "Continuer avec Discord" }).getAttribute("href")).toBe("/auth/discord");
  expect(screen.getByRole("link", { name: "Continuer avec GitHub" }).getAttribute("href")).toBe("/auth/github");
});

test("Should_KeepNextPageInLink_When_LoginComesFromInvite", async () => {
  configure("GITHUB");

  render(await OAuthButtons({ next: "/invite/abc?x=1" }));

  expect(screen.getByRole("link", { name: "Continuer avec GitHub" }).getAttribute("href")).toBe(
    "/auth/github?next=%2Finvite%2Fabc%3Fx%3D1",
  );
  expect(screen.queryByRole("link", { name: /Discord/ })).toBeNull();
});

test("Should_RenderNothing_When_NoProviderIsConfigured", async () => {
  expect(await OAuthButtons({})).toBeNull();
});
