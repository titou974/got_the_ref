/**
 * Les tests A/B en cours, et rien d'autre : pas de lecture, pas d'écriture, pas
 * de base — seulement les noms et les valeurs, pour qu'un composant client
 * puisse les importer sans traîner le serveur derrière lui.
 */

/**
 * Le test du parcours d'entrée : que voit quelqu'un qui vient d'ouvrir un
 * compte ?
 *
 * — `pricing-first` (la branche témoin, celle d'aujourd'hui) : la grille
 *   tarifaire, avec son essai de trois jours. Le tunnel d'accueil reste fermé
 *   tant que rien n'a été pris ; la démonstration, elle, passe par le
 *   formulaire d'analyse de la page d'accueil, qui ouvre le compte et remplit
 *   la fiche d'un coup (cf. `features/analysis/demo.ts`).
 *
 * — `demo-first` (la branche testée) : le questionnaire d'accueil, tout de
 *   suite. Le compte lance son analyse dans la foulée, arrive sur son tableau de
 *   bord, et ce sont les voiles des sections fermées qui vendent l'abonnement.
 *   Les tarifs n'ont alors plus d'essai à proposer : la démonstration a déjà eu
 *   lieu, gratuitement et sans carte bancaire.
 *
 * L'hypothèse est simple : ce qui donne envie de payer, c'est de voir sa propre
 * visibilité mesurée, pas une grille de prix. Reste à savoir si le compte qui
 * n'a rien payé revient — d'où le test plutôt qu'une bascule.
 */
export const PATH_EXPERIMENT = "parcours-entree" as const;

export const PATH_VARIANTS = ["pricing-first", "demo-first"] as const;
export type PathVariant = (typeof PATH_VARIANTS)[number];

/**
 * La branche servie quand on ne sait pas : robot d'indexation, cookie refusé,
 * rendu statique. C'est le parcours d'aujourd'hui — un test se juge contre ce
 * qui tourne déjà, et une part d'inconnus doit tomber du côté connu.
 */
export const DEFAULT_PATH_VARIANT: PathVariant = "pricing-first";

/** Le cookie qui retient la branche tirée au sort, posé par `proxy.ts`. */
export const PATH_VARIANT_COOKIE = "visia_parcours";

/**
 * Un an. La branche doit tenir plus longtemps que le test lui-même : un visiteur
 * qui revient trois mois plus tard et changerait de parcours en route fausserait
 * la mesure autant qu'il abîmerait son expérience.
 */
export const PATH_VARIANT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Vrai si la valeur lue (cookie, colonne) est une branche connue. */
export function isPathVariant(value: unknown): value is PathVariant {
  return typeof value === "string" && (PATH_VARIANTS as readonly string[]).includes(value);
}
