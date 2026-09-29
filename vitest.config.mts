import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Rend DATABASE_URL disponible aux tests d'intégration de la base.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
