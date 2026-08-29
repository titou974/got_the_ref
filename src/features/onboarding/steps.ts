/**
 * L'accueil client tient désormais en une seule question : l'adresse du site.
 *
 * Il y en avait six. Chacune se défendait — la forme du commerce, le marché,
 * l'activité, les concurrents, le ton — mais toutes se dressaient entre
 * quelqu'un qui vient d'ouvrir un compte et le premier écran qui lui montre
 * quelque chose. Or ces réponses, le crawl les donne déjà : la lecture du site
 * en tire la langue, le pays, les villes, un résumé de l'offre et la niche.
 *
 * Ce qui reste à corriger à la main se corrige donc **après**, dans les
 * réglages, devant un tableau de bord déjà rempli — là où le client voit à quoi
 * sert la question qu'on lui pose.
 */
export const ONBOARDING_STEPS = ["site"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const FIRST_STEP: OnboardingStep = ONBOARDING_STEPS[0];

/** La dernière étape : la valider referme le tunnel. */
export const LAST_STEP: OnboardingStep = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];

export const isOnboardingStep = (value: unknown): value is OnboardingStep =>
  typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);

/**
 * Les étapes retirées, et l'étape vivante qui en tient lieu.
 *
 * Une fiche laissée à mi-parcours par l'ancien tunnel doit reprendre sur la
 * seule question qui reste, pas tomber sur une étape inconnue. Elles y mènent
 * donc toutes — celles d'avant comme le rattachement Search Console, sorti du
 * tunnel bien plus tôt.
 */
const RETIRED_STEPS: Record<string, OnboardingStep> = {
  activite: "site",
  marche: "site",
  description: "site",
  concurrents: "site",
  tonalite: "site",
  "search-console": "site",
};

/** L'étape enregistrée, ramenée sur le tunnel actuel — `null` si illisible. */
export const normalizeStep = (value: unknown): OnboardingStep | null => {
  if (isOnboardingStep(value)) return value;
  return typeof value === "string" ? (RETIRED_STEPS[value] ?? null) : null;
};

/** Les trois formes de commerce, telles que les réglages les proposent. */
export const BUSINESS_KINDS = ["physical", "online", "both"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

/**
 * Vrai si le commerce a une adresse : la fiche Maps et les villes ont un sens.
 *
 * La colonne n'est plus renseignée par le tunnel — personne ne pose la question
 * à l'arrivée. Tant qu'elle est vide, on suppose une adresse : c'est le cas le
 * plus fréquent chez nos clients, et c'est le seul sens où se tromper n'enlève
 * rien (un onglet Google Maps de trop, que les réglages referment en un choix).
 */
export const hasPhysicalPresence = (kind: string | null | undefined): boolean =>
  kind !== "online";
