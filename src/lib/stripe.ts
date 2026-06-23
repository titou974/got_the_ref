import Stripe from "stripe";
import { stripePriceId, STRIPE_PRICE_ENV, type PaidPlanKey } from "@/constants/plans";

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

export function getPriceId(plan: PaidPlanKey): string {
  const id = stripePriceId(plan);
  if (!id) {
    throw new Error(`${STRIPE_PRICE_ENV[plan]} manquant dans l'environnement.`);
  }
  return id;
}
