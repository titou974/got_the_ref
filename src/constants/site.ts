/**
 * Métadonnées globales du site (non traduisibles : identité, contacts, URLs).
 * Les libellés et phrases marketing vivent dans les messages i18n.
 */

export const SITE = {
  name: "GEOBoost",
  /** Baseline de marque : la première agence de GEO française. */
  tagline: "La première agence de GEO française",
  /** URL publique de l'app, surchargée par l'environnement. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  contactEmail: "titouanhirsch@gmail.com",
  /** Lien de prise de rendez-vous (Cal). À remplacer par le vrai lien Cal. */
  calUrl: "https://cal.com/geoboost",
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

/** Logos des moteurs IA affichés sur la home (chemins dans /public). */
export const AI_ENGINE_LOGOS = [
  { src: "/logoopenai1.png", key: "openai" },
  { src: "/logogemini1.webp", key: "gemini" },
  { src: "/logoperplexity1.png", key: "perplexity" },
] as const;
