/**
 * Métadonnées globales du site (non traduisibles : identité, contacts, URLs).
 * Les libellés et phrases marketing vivent dans les messages i18n.
 */

export const SITE = {
  name: "got_the_ref",
  /** Baseline de marque : la première agence de GEO française. */
  tagline: "La première agence de GEO française",
  /** URL publique de l'app, surchargée par l'environnement. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  contactEmail: "titouanhirsch@gmail.com",
  /** Créneau de démonstration (Cal), surchargeable par l'environnement. */
  calUrl: process.env.NEXT_PUBLIC_CAL_URL ?? "https://cal.com/gotheref/30min",
  /** Fondateur — profil public référencé pour l'E-E-A-T et le schema Person. */
  founder: {
    name: "Titouan Hirsch",
    alias: "bobodigital",
    url: "https://titouanhirsch.com",
  },
  /** Année de création — utilisée pour le copyright (avec l'année courante). */
  foundedYear: 2026,
  locale: "fr_FR",
  lang: "fr",
} as const;

/**
 * Nombre d'entreprises annoncé sous les titres (« Adopté par N entreprises
 * françaises »).
 *
 * ⚠️ Même régime que `PROOF_IS_ILLUSTRATIVE` dans `constants/testimonials.ts` :
 * un chiffre d'adoption est une allégation commerciale, contrôlée par la DGCCRF
 * (art. L121-2 du Code de la consommation). Alignez cette valeur sur le nombre
 * réel de comptes actifs avant toute mise en ligne publique.
 */
export const ADOPTERS_COUNT = 400;

/** Logos des moteurs IA affichés sur la home (chemins dans /public). */
export const AI_ENGINE_LOGOS = [
  { src: "/chatgpt.png", key: "openai" },
  { src: "/gemini.webp", key: "gemini" },
] as const;
