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
  /** Demande d'un lien de réinitialisation (saisie de l'e-mail). */
  forgotPassword: "/mot-de-passe-oublie",
  /** Choix du nouveau mot de passe — atterrissage du lien reçu par e-mail. */
  resetPassword: "/nouveau-mot-de-passe",
  account: "/compte",
  /**
   * L'aiguillage d'après-identification. Il n'affiche rien : il regarde l'état
   * du compte et renvoie au bon endroit. Sert de `callbackURL` à Google, qui
   * ne sait pas distinguer une inscription d'une reconnexion.
   */
  afterAuth: "/bienvenue",
  /** Le tunnel d'accueil, ouvert juste après le paiement ou l'essai. */
  onboarding: "/accueil",
  onboardingStep: (step: string) => `/accueil/${step}`,
  /** Le tableau de bord et ses sections. */
  dashboard: "/tableau-de-bord",
  dashboardContent: "/tableau-de-bord/contenu",
  dashboardArchitecture: "/tableau-de-bord/architecture",
  dashboardArticles: "/tableau-de-bord/articles",
  dashboardArticle: (id: string) => `/tableau-de-bord/articles/${id}`,
  dashboardPresence: "/tableau-de-bord/presence",
  dashboardMaps: "/tableau-de-bord/google-maps",
  dashboardSettings: "/tableau-de-bord/reglages",
  /**
   * L'écran d'appairage d'un agent IA. L'agent affiche un code dans le
   * terminal, le client le confirme ici — c'est le seul endroit où le
   * rattachement se décide.
   */
  agentLink: "/agent",
  agentLinkWithCode: (code: string) => `/agent?code=${encodeURIComponent(code)}`,
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
 * `/connexion?motdepasse=1` — le retour d'une réinitialisation réussie. Le mot
 * de passe vient de changer et toutes les sessions ont été fermées : la page
 * de connexion doit dire pourquoi elle redemande de s'identifier.
 */
export const PASSWORD_RESET_PARAM = "motdepasse";

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

/**
 * `/bienvenue?suite=…` — l'aiguillage d'après-identification, destination
 * souhaitée en poche. Google ne peut pas rendre la main ailleurs : c'est le
 * navigateur qui suit `callbackURL`, sans savoir à qui il a affaire.
 */
export const afterAuthWithNext = (next: string) =>
  `${ROUTES.afterAuth}?${NEXT_PARAM}=${encodeURIComponent(next)}`;

/** Raisons de redirection véhiculées en query string. */
export const REDIRECT_REASONS = {
  quota: "quota",
} as const;

/** `/tarifs?raison=quota` — redirection après quota dépassé. */
export const pricingWithReason = (reason: keyof typeof REDIRECT_REASONS) =>
  `${ROUTES.pricing}?raison=${REDIRECT_REASONS[reason]}`;
