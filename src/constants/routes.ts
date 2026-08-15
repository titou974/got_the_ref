/**
 * Routes de l'application — source unique de vérité pour les chemins.
 * Aucune URL en dur dans les composants : on importe depuis ici.
 */

export const ROUTES = {
  home: "/",
  demo: "/demo",
  contact: "/contact",
  pricing: "/tarifs",
  signIn: "/connexion",
  signUp: "/inscription",
  account: "/compte",
  analysis: (id: string) => `/analyse/${id}`,
  /** Retour de Stripe après paiement d'une analyse (création de compte). */
  checkoutSuccess: "/paiement/succes",
  legal: {
    mentions: "/mentions-legales",
    terms: "/cgv-cgu",
    privacy: "/politique-de-confidentialite",
  },
} as const;

/** Raisons de redirection véhiculées en query string. */
export const REDIRECT_REASONS = {
  quota: "quota",
} as const;

/** `/tarifs?raison=quota` — redirection après quota dépassé. */
export const pricingWithReason = (reason: keyof typeof REDIRECT_REASONS) =>
  `${ROUTES.pricing}?raison=${REDIRECT_REASONS[reason]}`;
