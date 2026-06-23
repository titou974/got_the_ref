/**
 * Plans, quotas et mapping Stripe.
 * Données numériques / techniques uniquement — les libellés sont dans l'i18n.
 */

export type PlanKey = "free" | "pro" | "agency";

/** Plans payants (exclut le gratuit). */
export type PaidPlanKey = Exclude<PlanKey, "free">;

export const PLAN_KEYS: readonly PlanKey[] = ["free", "pro", "agency"] as const;

export const PAID_PLAN_KEYS: readonly PaidPlanKey[] = ["pro", "agency"] as const;

/** Prix mensuel en euros par plan (donnée chiffrée, hors i18n). */
export const PLAN_PRICING: Record<PlanKey, { monthly: number }> = {
  free: { monthly: 0 },
  pro: { monthly: 29 },
  agency: { monthly: 99 },
};

/** Quotas d'analyses par plan. `null` = illimité. */
export const ANALYSIS_QUOTAS = {
  /** Visiteur anonyme : quota par IP sur une fenêtre glissante. */
  anon: { limit: 2, windowMs: 24 * 60 * 60 * 1000 },
  /** Plan gratuit : quota cumulé à vie. */
  free: { lifetime: 3 },
  /** Plan pro : quota mensuel glissant. */
  pro: { monthly: 50 },
  /** Plan agence : illimité. */
  agency: { monthly: null },
} as const;

/** Nom des variables d'environnement contenant les Price IDs Stripe. */
export const STRIPE_PRICE_ENV = {
  pro: "STRIPE_PRICE_PRO",
  agency: "STRIPE_PRICE_AGENCY",
} as const;

/** Résout le Price ID Stripe d'un plan depuis l'environnement (côté serveur). */
export function stripePriceId(plan: Exclude<PlanKey, "free">): string | undefined {
  return process.env[STRIPE_PRICE_ENV[plan]];
}

/** Statuts d'abonnement Stripe considérés comme actifs. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;
