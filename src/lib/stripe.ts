import Stripe from "stripe";
import {
  DEFAULT_BILLING_CYCLE,
  PLAN_BILLING,
  stripePriceEnvName,
  stripePriceEnvValue,
  type BillingCycle,
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

const priceIdCache = new Map<string, string>();


/**
 * Résout le Price ID Stripe d'une offre pour un cycle de facturation donné.
 * L'environnement peut contenir soit un Price ID (`price_…`) utilisé tel quel,
 * soit un Product ID (`prod_…`) — dans ce cas on récupère le `default_price` du
 * produit. Résultat mémoïsé par couple offre/cycle.
 *
 * Les offres du site s'ouvrent toutes en `mode: "subscription"` : un tarif
 * ponctuel est refusé par Stripe au moment du checkout, avec un message qui ne
 * dit pas quelle variable est en cause. On vérifie donc ici, une fois, que le
 * price est bien récurrent — et on nomme la variable fautive.
 */
export async function resolvePriceId(
  plan: PaidPlanKey,
  cycle: BillingCycle = DEFAULT_BILLING_CYCLE,
): Promise<string> {
  const cacheKey = `plan:${plan}:${cycle}`;
  const cached = priceIdCache.get(cacheKey);
  if (cached) return cached;

  const envName = stripePriceEnvName(plan, cycle);
  const raw = stripePriceEnvValue(plan, cycle);
  if (!raw) {
    throw new Error(`${envName} manquant dans l'environnement.`);
  }

  const stripe = getStripe();

  let price: Stripe.Price;
  if (raw.startsWith("prod_")) {
    const product = await stripe.products.retrieve(raw, { expand: ["default_price"] });
    const def = product.default_price;
    if (!def || typeof def === "string") {
      throw new Error(`Le produit Stripe ${raw} (${envName}) n'a pas de tarif par défaut.`);
    }
    price = def;
  } else {
    price = await stripe.prices.retrieve(raw);
  }

  if (PLAN_BILLING[plan].mode === "subscription" && !price.recurring) {
    throw new Error(
      `Le tarif Stripe ${price.id} (${envName}) est ponctuel : l'abonnement exige un tarif récurrent.`,
    );
  }

  priceIdCache.set(cacheKey, price.id);
  return price.id;
}
