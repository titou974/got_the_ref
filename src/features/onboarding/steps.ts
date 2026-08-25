/**
 * Les six étapes de l'accueil client, dans l'ordre où elles se présentent.
 *
 * L'ordre n'est pas cosmétique : chaque étape prépare la suivante. On demande
 * le type de commerce avant l'adresse du site (elle décide si la fiche Google
 * Maps a un sens), le site avant le marché (le crawl propose déjà langue, pays
 * et villes), l'activité avant les concurrents (la liste s'en déduit).
 *
 * Les deux dernières sont facultatives : un client pressé doit pouvoir entrer
 * dans son tableau de bord sans avoir choisi une couleur de marque.
 *
 * Le rattachement Google (Search Console et Analytics) ne fait plus partie du
 * tunnel : il se propose depuis le tableau de bord, où il n'est plus une porte
 * de plus entre le paiement et le premier écran utile.
 */
export const ONBOARDING_STEPS = [
  "activite",
  "site",
  "marche",
  "description",
  "concurrents",
  "tonalite",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const FIRST_STEP: OnboardingStep = ONBOARDING_STEPS[0];

/** Étapes que l'on peut passer sans rien saisir. */
export const OPTIONAL_STEPS: readonly OnboardingStep[] = ["concurrents", "tonalite"];

/** La dernière étape : la valider referme le tunnel. */
export const LAST_STEP: OnboardingStep = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];

export const isOnboardingStep = (value: unknown): value is OnboardingStep =>
  typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);

/**
 * Les étapes retirées, et l'étape vivante qui en tient lieu.
 *
 * Une fiche restée sur `search-console` doit reprendre à la tonalité, pas au
 * premier écran : sans cette table, un client à un pas de la fin repartirait
 * pour six questions auxquelles il a déjà répondu.
 */
const RETIRED_STEPS: Record<string, OnboardingStep> = {
  "search-console": LAST_STEP,
};

/** L'étape enregistrée, ramenée sur le tunnel actuel — `null` si illisible. */
export const normalizeStep = (value: unknown): OnboardingStep | null => {
  if (isOnboardingStep(value)) return value;
  return typeof value === "string" ? (RETIRED_STEPS[value] ?? null) : null;
};

/** Rang affiché — « ÉTAPE 03 / 06 ». */
export const stepNumber = (step: OnboardingStep): number =>
  ONBOARDING_STEPS.indexOf(step) + 1;

/** L'étape suivante, ou `null` si l'on vient de terminer la dernière. */
export const nextStep = (step: OnboardingStep): OnboardingStep | null =>
  ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;

/** L'étape précédente, ou `null` sur la première. */
export const previousStep = (step: OnboardingStep): OnboardingStep | null =>
  ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) - 1] ?? null;

/** Les trois formes de commerce proposées à la première étape. */
export const BUSINESS_KINDS = ["physical", "online", "both"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

/** Vrai si le commerce a une adresse : la fiche Maps et les villes ont un sens. */
export const hasPhysicalPresence = (kind: string | null | undefined): boolean =>
  kind === "physical" || kind === "both";
