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

/**
 * Paramètre qui transporte la page à rejoindre une fois identifié.
 * Exemple : `/connexion?suite=/tarifs` — on entre par la connexion mais on
 * ressort dans le tunnel d'abonnement, là où le visiteur allait.
 */
export const NEXT_PARAM = "suite";

/**
 * N'accepte qu'un chemin interne à l'application.
 *
 * Sans ce filtre, `?suite=https://ailleurs.example` transformerait la page de
 * connexion en tremplin de redirection ouverte : une adresse d'apparence
 * légitime qui dépose le visiteur, fraîchement identifié, chez un tiers. Un
 * chemin commençant par `//` ou `/\` est également écarté — les navigateurs
 * l'interprètent comme un domaine externe.
 */
export const safeNextPath = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
};

/** `/connexion?suite=…` — connexion qui rend la main à la page visée. */
export const signInWithNext = (next: string) =>
  `${ROUTES.signIn}?${NEXT_PARAM}=${encodeURIComponent(next)}`;

/** `/inscription?suite=…` — inscription qui rend la main à la page visée. */
export const signUpWithNext = (next: string) =>
  `${ROUTES.signUp}?${NEXT_PARAM}=${encodeURIComponent(next)}`;

/** Raisons de redirection véhiculées en query string. */
export const REDIRECT_REASONS = {
  quota: "quota",
} as const;

/** `/tarifs?raison=quota` — redirection après quota dépassé. */
export const pricingWithReason = (reason: keyof typeof REDIRECT_REASONS) =>
  `${ROUTES.pricing}?raison=${REDIRECT_REASONS[reason]}`;
