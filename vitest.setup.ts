import { vi } from "vitest";

// Hors de Next, les composants serveur reçoivent les textes français.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = (await import("./messages/fr.json")).default;
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: "fr", messages, namespace: namespace as never }),
  };
});
