import Stripe from "stripe";
import {
  PLAN_BILLING,
  stripePriceEnvValue,
  type BillingMode,
  type PaidPlanKey,
} from "@/constants/plans";

let stripeClient: Stripe | null = null;

/** Client Stripe paresseux — n'échoue pas au build si la clé est absente. */
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant dans l'environnement.");
  stripeClient = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return stripeClient;
}

/** Alias rétro-compatible : un plan payant. */
export type PlanId = PaidPlanKey;

/** Mode de facturation Stripe (`payment` = paiement unique, `subscription` = abonnement). */
export function getCheckoutMode(plan: PaidPlanKey): BillingMode {
  return PLAN_BILLING[plan].mode;
}

const priceIdCache = new Map<PaidPlanKey, string>();

/**
 * Résout le Price ID Stripe d'une offre. L'environnement peut contenir soit un
 * Price ID (`price_…`) utilisé tel quel, soit un Product ID (`prod_…`) — dans ce
 * cas on récupère le `default_price` du produit. Résultat mémoïsé par offre.
 */
export async function resolvePriceId(plan: PaidPlanKey): Promise<string> {
  const cached = priceIdCache.get(plan);
  if (cached) return cached;

  const raw = stripePriceEnvValue(plan);
  if (!raw) {
    throw new Error(`${PLAN_BILLING[plan].env} manquant dans l'environnement.`);
  }

  let priceId = raw;
  if (raw.startsWith("prod_")) {
    const product = await getStripe().products.retrieve(raw);
    const def = product.default_price;
    const id = typeof def === "string" ? def : def?.id;
    if (!id) throw new Error(`Le produit Stripe ${raw} n'a pas de tarif par défaut.`);
    priceId = id;
  }

  priceIdCache.set(plan, priceId);
  return priceId;
}
