/**
 * Vérifie que la configuration Stripe permet vraiment d'ouvrir un paiement.
 *
 *   node scripts/check-stripe-prices.mjs
 *
 * Le checkout de got_the_ref s'ouvre en `mode: "subscription"` avec une période
 * d'essai et des frais d'activation. Trois conditions doivent être réunies, et
 * aucune n'est visible depuis le site : la clé et les tarifs doivent être dans
 * le même mode (Live ou Test — un objet Live est introuvable avec une clé Test),
 * chaque tarif doit être **récurrent**, et le montage complet doit être accepté
 * par Stripe. Le script les contrôle dans cet ordre, puis ouvre une vraie
 * session de test qu'il n'utilise pas : c'est le seul moyen de savoir que le
 * bouton fonctionnera.
 *
 * Pour contrôler la production, lancez-le avec les variables de production —
 * par exemple `vercel env pull .env.production` puis
 * `node --env-file=.env.production scripts/check-stripe-prices.mjs`.
 */

import "dotenv/config";
import Stripe from "stripe";

const TRIAL_DAYS = 3;
const ACTIVATION_CENTS = 100;

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("✗ STRIPE_SECRET_KEY manquant dans l'environnement.");
  process.exit(1);
}

const mode = key.startsWith("sk_live_") ? "Live" : "Test";
const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });

const targets = [
  { label: "mensuel", env: "STRIPE_PRICE_PRO_MONTHLY" },
  { label: "annuel", env: "STRIPE_PRICE_PRO_YEARLY" },
];

console.log(`Clé Stripe : mode ${mode}\n`);

let failed = false;

for (const { label, env } of targets) {
  const raw = process.env[env];
  console.log(`── ${label} · ${env}`);

  if (!raw) {
    console.log("   ✗ variable absente\n");
    failed = true;
    continue;
  }

  let price;
  try {
    if (raw.startsWith("prod_")) {
      const product = await stripe.products.retrieve(raw, { expand: ["default_price"] });
      console.log(`   produit « ${product.name} » actif=${product.active}`);
      if (!product.default_price || typeof product.default_price === "string") {
        console.log("   ✗ aucun tarif par défaut sur ce produit\n");
        failed = true;
        continue;
      }
      price = product.default_price;
    } else {
      price = await stripe.prices.retrieve(raw);
    }
  } catch (err) {
    const missing = err?.code === "resource_missing";
    console.log(`   ✗ ${err.message}`);
    if (missing) {
      console.log(`   → objet absent du mode ${mode} : il appartient sans doute à l'autre mode.`);
    }
    console.log();
    failed = true;
    continue;
  }

  const recurring = price.recurring
    ? `récurrent (${price.recurring.interval})`
    : "PONCTUEL — refusé en abonnement";
  console.log(
    `   tarif ${price.id} · ${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()} · ${recurring} · actif=${price.active}`,
  );

  if (!price.recurring) {
    failed = true;
    console.log();
    continue;
  }

  // Le montage réel : abonnement en essai + frais d'activation encaissés tout de
  // suite. Créer la session ne débite personne et n'engage rien.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        { price: price.id, quantity: 1 },
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: ACTIVATION_CENTS,
            product_data: { name: `Activation de l'essai got_the_ref (${TRIAL_DAYS} jours)` },
          },
        },
      ],
      success_url: "https://example.com/ok",
      cancel_url: "https://example.com/ko",
      subscription_data: { trial_period_days: TRIAL_DAYS },
    });
    console.log(
      `   ✓ session de test créée · dû aujourd'hui : ${(session.amount_total / 100).toFixed(2)} €\n`,
    );
  } catch (err) {
    console.log(`   ✗ checkout refusé : ${err.message}\n`);
    failed = true;
  }
}

if (failed) {
  console.error("Configuration incomplète : le paiement échouera.");
  process.exit(1);
}

console.log("Tout est en place : le paiement peut s'ouvrir dans les deux cycles.");
