/**
 * Métadonnées globales du site (non traduisibles : identité, contacts, URLs).
 * Les libellés et phrases marketing vivent dans les messages i18n.
 */

export const SITE = {
  name: "got_the_ref",
  /** Baseline de marque : un logiciel, pas une agence, pour les commerces français. */
  tagline: "Le premier logiciel de GEO pour les commerces français, physiques et en ligne",
  /** URL publique de l'app, surchargée par l'environnement. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  contactEmail: "titouanhirsch@gmail.com",
  /**
   * Créneau de démonstration (Cal), surchargeable par l'environnement.
   *
   * ⚠️ Le compte Cal s'écrit « gotheref », avec un seul « t » : ce n'est pas une
   * faute de frappe de `got_the_ref`. La variante « gottheref » n'existe pas et
   * renvoie une 404 — c'est l'ancienne valeur, qui menait chaque bouton de
   * démonstration sur une page d'erreur.
   */
  calUrl: process.env.NEXT_PUBLIC_CAL_URL ?? "https://cal.com/gotheref/30min",
  /**
   * Identifiant du site Crisp, qui porte la bulle de discussion.
   *
   * Public par nature : Crisp l'expose dans le script client de tous ses
   * clients, il n'ouvre aucun accès à la boîte de réception. Surchargeable pour
   * qu'un environnement de test n'envoie pas ses messages dans la vraie file.
   */
  crispWebsiteId:
    process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID ?? "f8f9ed32-6051-4c90-8c84-6ab97f03a07e",
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
