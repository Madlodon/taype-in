import { expect, test } from "@playwright/test";

// Les pages et les photos refusent d'être affichées dans l'iframe d'un autre site (#272).
for (const path of ["/", "/login", "/zzz-page-inconnue"]) {
  test(`Should_SendSecurityHeaders_When_Loading_${path}`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();

    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toBe("max-age=31536000");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

test("Should_RefuseToShowSite_When_FramedByAnotherPage", async ({ page, baseURL }) => {
  const blocked = page.waitForEvent("console", (message) => /frame-ancestors|Refused to display/i.test(message.text()));
  await page.setContent(`<iframe src="${baseURL}/login"></iframe>`);

  await blocked;
});
