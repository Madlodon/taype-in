// @vitest-environment node
import { expect, test } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../proxy";

function matches(url: string, headers: Record<string, string> = {}) {
  return unstable_doesMiddlewareMatch({ config, url, headers });
}

test("Should_RunProxy_When_PageIsVisited", () => {
  expect(matches("/lobbies")).toBe(true);
});

test("Should_RunProxy_When_LinkIsFollowed", () => {
  expect(matches("/lobbies?_rsc=abc", { rsc: "1" })).toBe(true);
});

test("Should_SkipProxy_When_LinkIsPrefetched", () => {
  expect(matches("/lobbies?_rsc=abc", { rsc: "1", "next-router-prefetch": "1" })).toBe(false);
});

test("Should_SkipProxy_When_BrowserPrefetches", () => {
  expect(matches("/lobbies", { purpose: "prefetch" })).toBe(false);
});

test("Should_SkipProxy_When_AvatarIsRequested", () => {
  expect(matches("/avatars/8f14e45f-ceea-467f-a0e6-1d1b2c3d4e5f")).toBe(false);
});

test("Should_SkipProxy_When_OAuthProviderRedirectsBack", () => {
  expect(matches("/auth/github/callback?code=abc&state=xyz")).toBe(false);
});
