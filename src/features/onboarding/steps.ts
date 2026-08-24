/**
 * Les sept étapes de l'accueil client, dans l'ordre où elles se présentent.
 *
 * L'ordre n'est pas cosmétique : chaque étape prépare la suivante. On demande
 * le type de commerce avant l'adresse du site (elle décide si la fiche Google
 * Maps a un sens), le site avant le marché (le crawl propose déjà langue, pays
 * et villes), l'activité avant les concurrents (la liste s'en déduit).
 *
 * Les trois dernières sont facultatives : un client pressé doit pouvoir entrer
 * dans son tableau de bord sans avoir choisi une couleur de marque.
 */
export const ONBOARDING_STEPS = [
  "activite",
  "site",
  "marche",
  "description",
  "concurrents",
  "tonalite",
  "search-console",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const FIRST_STEP: OnboardingStep = ONBOARDING_STEPS[0];

/** Étapes que l'on peut passer sans rien saisir. */
export const OPTIONAL_STEPS: readonly OnboardingStep[] = [
  "concurrents",
  "tonalite",
  "search-console",
];

export const isOnboardingStep = (value: unknown): value is OnboardingStep =>
  typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);

/** Rang affiché — « ÉTAPE 03 / 07 ». */
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
