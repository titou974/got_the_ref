/**
 * Plans, quotas et mapping Stripe.
 * Données numériques / techniques uniquement — les libellés sont dans l'i18n.
 */

export type PlanKey = "free" | "pro" | "agency";

/** Plans payants (exclut le gratuit). */
export type PaidPlanKey = Exclude<PlanKey, "free">;

export const PLAN_KEYS: readonly PlanKey[] = ["free", "pro", "agency"] as const;

export const PAID_PLAN_KEYS: readonly PaidPlanKey[] = ["pro", "agency"] as const;

/**
 * Tarif affiché par plan (donnée chiffrée, hors i18n).
 * `recurring: true` = abonnement mensuel.
 * `amount: null` = pas de prix public.
 */
export const PLAN_PRICING: Record<PlanKey, { amount: number | null; recurring: boolean }> = {
  free: { amount: 0, recurring: true },
  /** Offre unique : abonnement mensuel, accès total à Visia. */
  pro: { amount: 79, recurring: true },
  /** Ancien plan agence : conservé pour les comptes existants, plus commercialisé. */
  agency: { amount: null, recurring: true },
};

/** Prix public de l'abonnement Visia, en euros par mois. */
export const SUBSCRIPTION_PRICE = PLAN_PRICING.pro.amount as number;

/** Périodicité de facturation choisie à la souscription. */
export type BillingCycle = "monthly" | "annual";

export const BILLING_CYCLES: readonly BillingCycle[] = ["monthly", "annual"] as const;

/**
 * Les deux formules d'abonnement. Même accès, même produit : seule la
 * périodicité change. `perMonth` est le montant ramené au mois — c'est lui qu'on
 * affiche, la comparaison entre formules devant se faire à unité égale.
 */
export const SUBSCRIPTION_PRICING: Record<
  BillingCycle,
  { charged: number; perMonth: number; env: string }
> = {
  monthly: { charged: 79, perMonth: 79, env: "STRIPE_PRICE_UNIT" },
  annual: { charged: 619, perMonth: 51, env: "STRIPE_PRICE_ANNUAL" },
};

/**
 * Économie de la formule annuelle face au mensuel, en pourcentage entier.
 * Arrondi vers le bas : une remise annoncée doit toujours être au moins tenue.
 */
export const ANNUAL_SAVING_PERCENT = Math.floor(
  (1 - SUBSCRIPTION_PRICING.annual.charged / (SUBSCRIPTION_PRICING.monthly.charged * 12)) * 100,
);

/** Économie de la formule annuelle face au mensuel, en euros sur l'année. */
export const ANNUAL_SAVING_AMOUNT =
  SUBSCRIPTION_PRICING.monthly.charged * 12 - SUBSCRIPTION_PRICING.annual.charged;

/**
 * Essai : accès complet quelques jours contre des frais d'activation.
 * Le montant est facturé immédiatement (prix ponctuel joint au checkout), la
 * facturation récurrente ne démarre qu'à la fin de l'essai.
 */
export const TRIAL = { days: 3, activationPrice: 1 } as const;

/**
 * Budget annuel d'une agence SEO / référencement IA classique.
 * Sert uniquement de repère comparatif sur la page tarifs.
 */
export const AGENCY_BENCHMARK_YEARLY = { min: 20000, max: 24000 } as const;

/**
 * Note maximale d'une analyse gratuite. L'aperçu ne mesure que l'architecture :
 * sans classements moteurs, sans audit éditorial et sans analyse de mots-clés, la
 * notation reste volontairement sévère — et le constat, un point de départ.
 *
 * La valeur est calée sous le seuil « correct » de l'échelle de couleurs
 * (`scoreColor`, vert à partir de 55) : aucun score de l'aperçu ne peut donc
 * s'afficher en vert.
 */
export const FREE_SCORE_CAP = 49;

/** Quotas d'analyses **gratuites** (l'aperçu partiel). `null` = illimité. */
export const ANALYSIS_QUOTAS = {
  /** Visiteur anonyme : quota par IP sur une fenêtre glissante. */
  anon: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  /** Compte gratuit : quota glissant sur 30 jours. */
  free: { monthly: 10 },
  /** Abonné : illimité. */
  pro: { monthly: null },
  /** Ancien plan agence : illimité. */
  agency: { monthly: null },
} as const;

/** Mode de facturation Stripe d'une offre. */
export type BillingMode = "payment" | "subscription";

/**
 * Facturation par offre payante : mode Stripe + variable d'environnement.
 * La variable peut contenir un Price ID (`price_…`) **ou** un Product ID (`prod_…`) —
 * dans ce dernier cas, on résout le `default_price` du produit (cf. `resolvePriceId`).
 */
export const PLAN_BILLING: Record<PaidPlanKey, { mode: BillingMode; env: string }> = {
  /** Abonnement Visia : accès total, mensuel (produit/price « UNIT »). */
  pro: { mode: "subscription", env: "STRIPE_PRICE_UNIT" },
  /** Ancien plan agence : conservé pour les abonnements déjà en cours. */
  agency: { mode: "subscription", env: "STRIPE_PRICE_AGENCY" },
} as const;

/** Rétro-compat : noms des variables d'environnement Stripe par offre payante. */
export const STRIPE_PRICE_ENV: Record<PaidPlanKey, string> = {
  pro: PLAN_BILLING.pro.env,
  agency: PLAN_BILLING.agency.env,
} as const;

/** Valeur brute de l'env d'une offre (Price ID ou Product ID), côté serveur. */
export function stripePriceEnvValue(plan: PaidPlanKey): string | undefined {
  return process.env[PLAN_BILLING[plan].env];
}

/** Statuts d'abonnement Stripe considérés comme actifs. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
