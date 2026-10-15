import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Chaque test crée ses propres comptes et salons : ils peuvent rouler en parallèle, même dans un fichier.
  fullyParallel: true,
  // Les runners GitHub ont 4 cœurs.
  workers: process.env.CI ? 4 : undefined,
  use: {
    baseURL: "http://localhost:3000",
    // Le navigateur demande le français : les tests lisent les textes français.
    locale: "fr-CA",
    // L'arène animée redessine le stade à chaque image : trop lent pour les machines de la CI.
    reducedMotion: "reduce",
  },
  // Le site vise l'ordinateur, mais chaque page doit aussi marcher sur téléphone et tablette (UI-2).
  // La CI n'installe que Chromium : la tablette garde son format mais roule dans Chromium.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // 360 px : le plus petit téléphone visé (DES-06).
    {
      name: "mobile",
      testMatch: "responsive.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
    },
    {
      name: "tablet",
      testMatch: "responsive.spec.ts",
      use: { ...devices["iPad Mini"], browserName: "chromium" },
    },
  ],
  webServer: {
    // En CI, le build de production évite de compiler chaque page à la première visite.
    command: process.env.CI ? "bun run start" : "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Un but retire un mot au hasard : les tests tapent tout le texte lu au départ,
    // d'un coup, plus vite que la limite anti-triche.
    env: { GOAL_CHANCE: "0", MAX_WPM: "Infinity" },
  },
});
