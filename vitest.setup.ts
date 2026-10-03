import { vi } from "vitest";

// Hors de Next, les composants serveur reçoivent les textes français.
vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } = await import("next-intl");
  const messages = (await import("./messages/fr.json")).default;
  return {
    getLocale: async () => "fr",
    getFormatter: async () => createFormatter({ locale: "fr", timeZone: "America/Toronto" }),
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: "fr", messages, namespace: namespace as never }),
  };
});
