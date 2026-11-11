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

// jsdom n'a pas encore showModal()/close() sur <dialog> : on ouvre et ferme simplement la boîte.
// Les tests en environnement Node n'ont pas de DOM du tout.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
