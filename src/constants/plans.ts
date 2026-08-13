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
  /** Offre unique : abonnement mensuel, accès total à got_the_ref. */
  pro: { amount: 79, recurring: true },
  /** Ancien plan agence : conservé pour les comptes existants, plus commercialisé. */
  agency: { amount: null, recurring: true },
};

/** Prix public de l'abonnement got_the_ref, en euros par mois. */
export const SUBSCRIPTION_PRICE = PLAN_PRICING.pro.amount as number;

/**
 * Essai : accès complet quelques jours contre des frais d'activation.
 * Le montant est facturé immédiatement (prix ponctuel joint au checkout), la
 * facturation récurrente ne démarre qu'à la fin de l'essai.
 */
export const TRIAL = { days: 3, activationPrice: 1 } as const;

/**
 * Tarif mensuel de l'abonnement engagé à l'année. Toujours affiché **par mois**
 * (jamais le total annuel) : c'est la seule unité que le visiteur compare d'un
 * onglet à l'autre.
 *
 * ⚠️ Affichage seul pour l'instant : aucun price Stripe annuel n'est branché,
 * le checkout part sur le price mensuel (`STRIPE_PRICE_UNIT`). Créez le price
 * annuel côté Stripe avant d'ouvrir la souscription à l'année.
 */
export const YEARLY_MONTHLY_PRICE = 59;

/** Remise de l'engagement annuel, arrondie à l'entier (badge de l'onglet). */
export const YEARLY_DISCOUNT_PCT = Math.round(
  (1 - YEARLY_MONTHLY_PRICE / SUBSCRIPTION_PRICE) * 100,
);

/** Cycles de facturation proposés par la carte d'abonnement. */
export type BillingCycle = "monthly" | "yearly";

/** Durée de la garantie « visibilité en progrès ou remboursé », en jours. */
export const GUARANTEE_DAYS = 90;

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
  /** Abonnement got_the_ref : accès total, mensuel (produit/price « UNIT »). */
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
