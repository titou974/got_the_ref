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
 * Le price Stripe correspondant est facturé une seule fois par an
 * (`YEARLY_TOTAL_PRICE`) : les deux montants doivent rester cohérents.
 */
export const YEARLY_MONTHLY_PRICE = 59;

/** Montant réellement débité, une fois par an, pour l'engagement annuel. */
export const YEARLY_TOTAL_PRICE = YEARLY_MONTHLY_PRICE * 12;

/** Remise de l'engagement annuel, arrondie à l'entier (badge de l'onglet). */
export const YEARLY_DISCOUNT_PCT = Math.round(
  (1 - YEARLY_MONTHLY_PRICE / SUBSCRIPTION_PRICE) * 100,
);

/** Cycles de facturation proposés par la carte d'abonnement. */
export type BillingCycle = "monthly" | "yearly";

export const BILLING_CYCLES: readonly BillingCycle[] = ["monthly", "yearly"] as const;

/** Cycle retenu quand l'appelant n'en précise aucun (anciens liens, API). */
export const DEFAULT_BILLING_CYCLE: BillingCycle = "monthly";

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
 * Facturation par offre payante : mode Stripe + variables d'environnement.
 * Une variable peut contenir un Price ID (`price_…`) **ou** un Product ID (`prod_…`) —
 * dans ce dernier cas, on résout le `default_price` du produit (cf. `resolvePriceId`).
 *
 * `envByCycle` donne un price par cycle de facturation : c'est ce qui permet aux
 * onglets mensuel / annuel de la carte tarif de partir sur deux prices distincts.
 * Une offre sans déclinaison annuelle retombe sur `env`.
 *
 * ⚠️ Ces prices doivent être **récurrents** côté Stripe : le checkout s'ouvre en
 * `mode: "subscription"`, qui refuse un tarif ponctuel.
 */
export const PLAN_BILLING: Record<
  PaidPlanKey,
  { mode: BillingMode; env: string; envByCycle?: Record<BillingCycle, string> }
> = {
  /** Abonnement got_the_ref : accès total, au mois ou à l'année. */
  pro: {
    mode: "subscription",
    env: "STRIPE_PRICE_PRO_MONTHLY",
    envByCycle: {
      monthly: "STRIPE_PRICE_PRO_MONTHLY",
      yearly: "STRIPE_PRICE_PRO_YEARLY",
    },
  },
  /** Ancien plan agence : conservé pour les abonnements déjà en cours. */
  agency: { mode: "subscription", env: "STRIPE_PRICE_AGENCY" },
} as const;

/** Nom de la variable d'environnement portant le price d'une offre, par cycle. */
export function stripePriceEnvName(
  plan: PaidPlanKey,
  cycle: BillingCycle = DEFAULT_BILLING_CYCLE,
): string {
  const billing = PLAN_BILLING[plan];
  return billing.envByCycle?.[cycle] ?? billing.env;
}

/** Rétro-compat : noms des variables d'environnement Stripe par offre payante. */
export const STRIPE_PRICE_ENV: Record<PaidPlanKey, string> = {
  pro: PLAN_BILLING.pro.env,
  agency: PLAN_BILLING.agency.env,
} as const;

/** Valeur brute de l'env d'une offre (Price ID ou Product ID), côté serveur. */
export function stripePriceEnvValue(
  plan: PaidPlanKey,
  cycle: BillingCycle = DEFAULT_BILLING_CYCLE,
): string | undefined {
  return process.env[stripePriceEnvName(plan, cycle)];
}

/** Statuts d'abonnement Stripe considérés comme actifs. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
