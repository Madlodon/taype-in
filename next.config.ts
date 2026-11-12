import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// En-têtes de sécurité sur toutes les pages (#272) : pas d'affichage dans l'iframe d'un autre
// site (clickjacking), pas de devinette du type des fichiers, HTTPS seulement une fois visité.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Ne dit pas quel framework tourne.
  poweredByHeader: false,
  experimental: {
    // Photo de profil de 2 Mo max, plus l'enveloppe du formulaire (PROF-1).
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin()(nextConfig);
