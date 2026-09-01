import { z } from "zod";

import { DEFAULT_BILLING_CYCLE } from "@/constants/plans";

/**
 * Cycle de facturation choisi sur la carte tarif. Optionnel côté client : un
 * appel sans cycle (ancien lien, bouton hors carte) part sur le mensuel.
 */
export const billingCycleSchema = z.enum(["monthly", "yearly"]).default(DEFAULT_BILLING_CYCLE);

export const checkoutSchema = z.object({
  plan: z.enum(["pro", "agency"]),
  cycle: billingCycleSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Souscription depuis une analyse précise (visiteur connecté ou non). */
export const analysisCheckoutSchema = z.object({
  analysisId: z.string().min(1),
  cycle: billingCycleSchema,
});

export type AnalysisCheckoutInput = z.infer<typeof analysisCheckoutSchema>;

/** Souscription à l'abonnement depuis la carte tarif, sans analyse rattachée. */
export const subscriptionCheckoutSchema = z.object({
  cycle: billingCycleSchema,
});

export type SubscriptionCheckoutInput = z.infer<typeof subscriptionCheckoutSchema>;

/**
 * Ouverture de l'essai de trois jours. Même forme que la souscription — c'est
 * le même abonnement, ouvert avec `trial_period_days` : le cycle choisi sur la
 * carte décide du tarif prélevé à la fin de l'essai.
 */
export const trialCheckoutSchema = z.object({
  cycle: billingCycleSchema,
});

export type TrialCheckoutInput = z.infer<typeof trialCheckoutSchema>;

/**
 * « Coup de Boost » : paiement unique, sans cycle de facturation. L'analyse est
 * facultative — la carte vit sur la page tarifs comme au bas d'un rapport.
 */
export const boostCheckoutSchema = z.object({
  analysisId: z.string().min(1).optional(),
});

export type BoostCheckoutInput = z.infer<typeof boostCheckoutSchema>;
