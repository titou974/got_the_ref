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
 * `recurring: false` = paiement unique (offre transactionnelle), `true` = abonnement.
 * `amount: null` = pas de prix public (offre agence, uniquement sur contact).
 */
export const PLAN_PRICING: Record<PlanKey, { amount: number | null; recurring: boolean }> = {
  free: { amount: 0, recurring: true },
  /** Offre transactionnelle : paiement unique pour débloquer une analyse. */
  pro: { amount: 79, recurring: false },
  /** Offre agence : sur devis, aucun prix affiché — prise de rendez-vous uniquement. */
  agency: { amount: null, recurring: true },
};

/** Prix public d'une analyse complète, en euros. */
export const ANALYSIS_PRICE = PLAN_PRICING.pro.amount as number;

/** Quotas d'analyses **gratuites** (l'aperçu partiel). `null` = illimité. */
export const ANALYSIS_QUOTAS = {
  /** Visiteur anonyme : quota par IP sur une fenêtre glissante. */
  anon: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  /** Compte gratuit : quota glissant sur 30 jours. */
  free: { monthly: 10 },
  /** Compte ayant déjà payé : mêmes aperçus, quota plus large. */
  pro: { monthly: 50 },
  /** Plan agence : illimité. */
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
  /** Déblocage d'une analyse : paiement unique (produit/price « UNIT »). */
  pro: { mode: "payment", env: "STRIPE_PRICE_UNIT" },
  /** Offre agence : abonnement mensuel, activé manuellement (hors self-service). */
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
