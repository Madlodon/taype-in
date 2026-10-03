import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
    // Le navigateur demande le français : les tests lisent les textes français.
    locale: "fr-CA",
  },
  // Le site vise l'ordinateur, mais chaque page doit aussi marcher sur téléphone et tablette (UI-2).
  // La CI n'installe que Chromium : la tablette garde son format mais roule dans Chromium.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: "responsive.spec.ts", use: { ...devices["Pixel 7"] } },
    {
      name: "tablet",
      testMatch: "responsive.spec.ts",
      use: { ...devices["iPad Mini"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
