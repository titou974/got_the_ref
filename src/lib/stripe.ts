import Stripe from "stripe";
import {
  BOOST,
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

/** `live` ou `test`, lu sur le préfixe de la clé secrète. */
export function stripeKeyMode(): "live" | "test" {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test";
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
 * Les offres à plan s'ouvrent en `mode: "subscription"` : un tarif ponctuel est
 * refusé par Stripe au moment du checkout, avec un message qui ne dit pas quelle
 * variable est en cause. On vérifie donc ici, une fois, que le price est bien
 * récurrent — et on nomme la variable fautive. Le « Coup de Boost » suit le
 * chemin inverse (cf. `resolveBoostPriceId`).
 *
 * Toutes les erreurs levées ici nomment la variable, la valeur et le mode de la
 * clé. Le visiteur, lui, ne lit qu'un message générique (cf. `handleServerError`)
 * : ces phrases ne vivent que dans les logs, et ce sont elles qui disent
 * pourquoi le paiement refuse de s'ouvrir. Le cas le plus courant est un produit
 * créé en mode Live alors que la clé du déploiement est en Test (ou l'inverse) :
 * Stripe répond alors « No such product », sans plus d'explication.
 */
export async function resolvePriceId(
  plan: PaidPlanKey,
  cycle: BillingCycle = DEFAULT_BILLING_CYCLE,
): Promise<string> {
  return resolveEnvPriceId(stripePriceEnvName(plan, cycle), PLAN_BILLING[plan].mode, {
    cacheKey: `plan:${plan}:${cycle}`,
    rawValue: stripePriceEnvValue(plan, cycle),
  });
}

/** Tarif ponctuel du « Coup de Boost » (checkout en `mode: "payment"`). */
export async function resolveBoostPriceId(): Promise<string> {
  return resolveEnvPriceId(BOOST.env, "payment");
}

/**
 * Le résolveur commun : lit la variable, récupère le tarif Stripe, vérifie
 * qu'il correspond bien au mode de checkout attendu, mémoïse.
 *
 * `expected` est le mode dans lequel le tarif sera utilisé : un abonnement
 * exige un tarif récurrent, un paiement unique exige l'inverse. Stripe refuse
 * le mauvais couple au moment du checkout, sans dire quelle variable est en
 * cause — d'où la vérification ici, une fois, en nommant la variable.
 */
async function resolveEnvPriceId(
  envName: string,
  expected: BillingMode,
  options: { cacheKey?: string; rawValue?: string } = {},
): Promise<string> {
  const cacheKey = options.cacheKey ?? `env:${envName}`;
  const cached = priceIdCache.get(cacheKey);
  if (cached) return cached;

  const raw = options.rawValue ?? process.env[envName];
  if (!raw) {
    throw new Error(`${envName} manquant dans l'environnement.`);
  }

  const stripe = getStripe();
  const mode = stripeKeyMode();

  let price: Stripe.Price;
  try {
    if (raw.startsWith("prod_")) {
      const product = await stripe.products.retrieve(raw, { expand: ["default_price"] });
      const def = product.default_price;
      if (!def || typeof def === "string") {
        throw new Error(
          `Le produit Stripe ${raw} (${envName}) n'a pas de tarif par défaut. ` +
            "Ouvrez le produit dans Stripe et cochez un tarif par défaut, ou renseignez " +
            "directement un identifiant de tarif (price_…) dans la variable.",
        );
      }
      price = def;
    } else {
      price = await stripe.prices.retrieve(raw);
    }
  } catch (err) {
    // Un objet d'un mode reste invisible depuis l'autre : c'est la panne la plus
    // fréquente au premier déploiement, et Stripe n'en dit rien de plus que
    // « No such product ».
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      throw new Error(
        `${envName}=${raw} est introuvable avec une clé Stripe en mode ${mode}. ` +
          `Cet objet appartient probablement à l'autre mode : alignez STRIPE_SECRET_KEY ` +
          `et les identifiants de tarif sur le même mode (${mode === "live" ? "Live" : "Test"}).`,
      );
    }
    throw err;
  }

  if (expected === "subscription" && !price.recurring) {
    throw new Error(
      `Le tarif Stripe ${price.id} (${envName}) est ponctuel : l'abonnement exige un tarif récurrent.`,
    );
  }
  if (expected === "payment" && price.recurring) {
    throw new Error(
      `Le tarif Stripe ${price.id} (${envName}) est récurrent : le paiement unique exige un tarif ponctuel.`,
    );
  }

  priceIdCache.set(cacheKey, price.id);
  return price.id;
}
