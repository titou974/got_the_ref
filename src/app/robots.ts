import type { MetadataRoute } from "next";
import { SITE } from "@/constants/site";

/**
 * Pages sans valeur SEO ou strictement personnelles : comptes, paiement,
 * authentification, API, rapports d'analyse individuels (contenu dupliqué,
 * données propres à un visiteur).
 */
const PRIVATE_PATHS = [
  "/api/",
  "/compte",
  "/connexion",
  "/inscription",
  "/paiement",
  "/analyse/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Crawlers IA que got_the_ref veut citer par : bloquer l'un d'eux
      // reviendrait à s'interdire d'apparaître dans ce moteur.
      { userAgent: "GPTBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "ChatGPT-User", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "PerplexityBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "ClaudeBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "anthropic-ai", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "Google-Extended", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "Bingbot", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
