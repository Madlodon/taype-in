// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { setLocaleAction } from "../app/actions/locale";

const cookieStore = { set: vi.fn() };

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

function form(locale: string) {
  const data = new FormData();
  data.set("locale", locale);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("Should_SaveLocaleInCookie_When_LocaleIsKnown", async () => {
  await setLocaleAction(form("en"));

  expect(cookieStore.set).toHaveBeenCalledWith(
    "NEXT_LOCALE",
    "en",
    expect.objectContaining({ path: "/", maxAge: 365 * 24 * 60 * 60 }),
  );
});

test("Should_IgnoreRequest_When_LocaleIsUnknown", async () => {
  await setLocaleAction(form("de"));

  expect(cookieStore.set).not.toHaveBeenCalled();
});
