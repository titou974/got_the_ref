import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
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
