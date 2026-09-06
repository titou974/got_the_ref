/**
 * Les deux questions de l'accueil client, dans l'ordre où elles se posent.
 *
 * Il y en a eu six, puis une seule. Deux est le bon compte, et l'ordre n'est pas
 * cosmétique : la forme du commerce commande ce qu'on demande ensuite. Un
 * commerce qui reçoit du public a une fiche Google Maps à donner et des villes à
 * chercher dans le crawl ; un commerce en ligne n'a ni l'une ni les autres, et
 * lui réclamer une fiche revient à lui demander une adresse qu'il n'a pas.
 *
 * Tout le reste — le marché, l'activité, les concurrents, le ton — est resté
 * dehors : le crawl le donne déjà, et ce qu'il rate se corrige dans les réglages,
 * devant un tableau de bord déjà rempli.
 */
export const ONBOARDING_STEPS = ["activite", "site"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const FIRST_STEP: OnboardingStep = ONBOARDING_STEPS[0];

/** La dernière étape : la valider referme le tunnel. */
export const LAST_STEP: OnboardingStep = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];

export const isOnboardingStep = (value: unknown): value is OnboardingStep =>
  typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);

/**
 * Les étapes retirées, et l'étape vivante qui en tient lieu.
 *
 * Une fiche laissée à mi-parcours par un ancien tunnel doit reprendre sur une
 * question qui existe encore, pas tomber sur une étape inconnue. Celles qui
 * suivaient le site y ramènent : leurs réponses sont désormais tirées du crawl.
 */
const RETIRED_STEPS: Record<string, OnboardingStep> = {
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

/** Rang affiché — « ÉTAPE 01 / 02 ». */
export const stepNumber = (step: OnboardingStep): number => ONBOARDING_STEPS.indexOf(step) + 1;

/** L'étape suivante, ou `null` si l'on vient de terminer la dernière. */
export const nextStep = (step: OnboardingStep): OnboardingStep | null =>
  ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;

/** L'étape précédente, ou `null` sur la première. */
export const previousStep = (step: OnboardingStep): OnboardingStep | null =>
  ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) - 1] ?? null;

/**
 * Les formes de commerce enregistrables.
 *
 * Le tunnel n'en propose que deux — une adresse, ou pas d'adresse : c'est la
 * seule distinction dont l'analyse a besoin, et une troisième case « les deux »
 * fait hésiter sur une question qui doit se répondre sans réfléchir. Les
 * réglages, eux, gardent le choix mixte pour les fiches qui le portent déjà.
 */
export const BUSINESS_KINDS = ["physical", "online", "both"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

/** Ce que la première étape met en tuiles. */
export const ONBOARDING_BUSINESS_KINDS = ["physical", "online"] as const;

/**
 * Vrai si le commerce a une adresse : la fiche Maps et les villes ont un sens.
 *
 * Une fiche sans réponse est traitée comme une adresse. C'est le cas le plus
 * fréquent chez nos clients, et c'est le seul sens où se tromper n'enlève rien :
 * un onglet Google Maps de trop, que les réglages referment en un choix.
 */
export const hasPhysicalPresence = (kind: string | null | undefined): boolean =>
  kind !== "online";
