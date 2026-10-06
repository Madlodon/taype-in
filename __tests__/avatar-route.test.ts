// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "../app/avatars/[userId]/route";
import { getAvatarImage } from "../lib/avatars";

vi.mock("../lib/avatars", () => ({ getAvatarImage: vi.fn() }));

const USER_ID = "8f14e45f-ceea-467f-a0e6-1d1b2c3d4e5f";
const photo = { contentType: "image/png", body: new Uint8Array([1, 2, 3]), etag: '"123"' };

function get(userId: string, headers: Record<string, string> = {}) {
  return GET(new Request(`http://localhost/avatars/${userId}`, { headers }), {
    params: Promise.resolve({ userId }),
  });
}

beforeEach(() => {
  vi.mocked(getAvatarImage).mockReset().mockResolvedValue(photo);
});

test("Should_ServeImageWithItsType_When_UserExists", async () => {
  const response = await get(USER_ID);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(photo.body);
});

test("Should_AnswerNotModified_When_BrowserHasSameImage", async () => {
  const response = await get(USER_ID, { "If-None-Match": '"123"' });

  expect(response.status).toBe(304);
  expect(await response.text()).toBe("");
});

test("Should_Answer404_When_UserDoesNotExist", async () => {
  vi.mocked(getAvatarImage).mockResolvedValue(null);

  expect((await get(USER_ID)).status).toBe(404);
});

test("Should_Answer404WithoutQuery_When_IdIsNotAUuid", async () => {
  expect((await get("pas-un-id")).status).toBe(404);
  expect(getAvatarImage).not.toHaveBeenCalled();
});
