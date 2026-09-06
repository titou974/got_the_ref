import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";
import { ROUTES } from "./src/constants/routes";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  /**
   * Alias d'entrée : `gotheref.com/analyse-gratuite` dépose le visiteur sur la
   * home, directement au champ d'analyse (`#analyser`). Une adresse propre à
   * coller dans une publicité, un mail ou un QR code — le fragment, lui, se
   * partage mal et se fait souvent avaler par les redirecteurs.
   *
   * Redirection temporaire (307) volontairement : un 308 se grave dans le cache
   * du navigateur, et l'ancre de destination peut encore bouger.
   */
  async redirects() {
    return [
      { source: ROUTES.freeAudit, destination: ROUTES.homeAudit, permanent: false },
    ];
  },
  images: {
    /**
     * Les photos des fiches Google Maps. Google les sert depuis son CDN
     * d'images (`lh3` à `lh6` pour les photos de lieux et les avatars,
     * `streetviewpixels` pour les vues de rue) ; sans ces hôtes, `next/image`
     * refuse de les charger.
     */
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      { protocol: "https", hostname: "streetviewpixels-pa.googleapis.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
