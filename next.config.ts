import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    // Photo de profil de 2 Mo max, plus l'enveloppe du formulaire (PROF-1).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default createNextIntlPlugin()(nextConfig);
