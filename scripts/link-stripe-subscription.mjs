/**
 * Crée à la main le compte d'un client qui a bien payé sur Stripe mais dont le
 * compte n'a jamais été créé sur la plateforme, puis le relie à son abonnement
 * Stripe en cours.
 *
 *   node scripts/link-stripe-subscription.mjs --subscription=sub_123
 *   node scripts/link-stripe-subscription.mjs --customer=cus_456 --apply
 *   node scripts/link-stripe-subscription.mjs --email=client@exemple.fr --apply
 *
 * Contre la production, chargez les variables de production — le `.env` local
 * pointe la base et la clé Stripe de test :
 *
 *   vercel env pull .env.production
 *   node --env-file=.env.production scripts/link-stripe-subscription.mjs --subscription=sub_123
 *
 * Le script ne modifie **rien** sans `--apply`.
 *
 * Ce qu'il fait, en une transaction :
 *   1. `User` — créé (ou mis à jour) avec l'e-mail du client Stripe, le plan
 *      déduit du tarif de l'abonnement, et `stripeCustomerId` renseigné ;
 *   2. `account` — identifiants e-mail/mot de passe au format Better Auth, pour
 *      que le client puisse se connecter comme n'importe quel autre ;
 *   3. `Subscription` — la ligne miroir de l'abonnement Stripe (statut, tarif,
 *      fin de période) ;
 *   4. côté Stripe, `metadata.userId` est posé sur l'abonnement et sur le client,
 *      pour que les prochains webhooks retrouvent le compte sans ambiguïté.
 *
 * Options :
 *   --subscription=sub_…  l'abonnement à rattacher (le plus sûr).
 *   --customer=cus_…      le client Stripe : son abonnement actif est retenu.
 *   --email=…             l'adresse du client Stripe, à défaut d'identifiant.
 *   --name="…"            nom affiché du compte (défaut : la partie avant @).
 *   --password=…          mot de passe imposé (défaut : un mot de passe tiré au sort).
 *   --apply               exécute réellement.
 *
 * Idempotent : relancer met le compte à jour sans le dupliquer.
 */

import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import Stripe from "stripe";
import { hashPassword } from "better-auth/crypto";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")));
const options = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--") && a.includes("="))
    .map((a) => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    }),
);

const APPLY = flags.has("--apply");

const key = process.env.STRIPE_SECRET_KEY;
const connectionString = process.env.DATABASE_URL;
if (!key) {
  console.error("✗ STRIPE_SECRET_KEY manquant dans l'environnement.");
  process.exit(1);
}
if (!connectionString) {
  console.error("✗ DATABASE_URL manquant dans l'environnement.");
  process.exit(1);
}
if (!options.subscription && !options.customer && !options.email) {
  console.error(
    "Usage : node scripts/link-stripe-subscription.mjs " +
      "(--subscription=sub_… | --customer=cus_… | --email=…) [--name=…] [--password=…] [--apply]",
  );
  process.exit(1);
}

const stripeMode = key.startsWith("sk_live_") ? "Live" : "Test";
const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });

const fmt = (unix) =>
  unix
    ? new Date(unix * 1000).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : "—";

console.log(`Clé Stripe : mode ${stripeMode}`);
console.log(`Base       : ${connectionString.replace(/:\/\/[^@]*@/, "://***@")}\n`);

// ── L'abonnement Stripe ───────────────────────────────────────────────────────

/** Les abonnements d'un client, le plus récent d'abord. */
async function subscriptionsOfCustomer(customerId) {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  });
  return list.data.sort((a, b) => b.created - a.created);
}

/** L'abonnement retenu : en cours de préférence, sinon le plus récent. */
function pickSubscription(subs) {
  const live = subs.filter((s) => s.status === "trialing" || s.status === "active");
  return live[0] ?? subs[0] ?? null;
}

let subscription = null;

if (options.subscription) {
  subscription = await stripe.subscriptions.retrieve(options.subscription, {
    expand: ["customer"],
  });
} else if (options.customer) {
  subscription = pickSubscription(await subscriptionsOfCustomer(options.customer));
} else {
  const email = options.email.toLowerCase();
  let customers = (await stripe.customers.list({ email, limit: 100 })).data;
  if (customers.length === 0) {
    try {
      customers = (
        await stripe.customers.search({ query: `email:'${email.replace(/'/g, "\\'")}'`, limit: 100 })
      ).data;
    } catch {
      customers = [];
    }
  }
  if (customers.length === 0) {
    console.error(`✗ Aucun client Stripe pour ${email}.`);
    process.exit(1);
  }
  if (customers.length > 1) {
    console.error(
      `✗ ${customers.length} clients Stripe portent ${email} : ` +
        customers.map((c) => c.id).join(", ") +
        "\n  Relancez avec --customer=cus_… pour lever l'ambiguïté.",
    );
    process.exit(1);
  }
  subscription = pickSubscription(await subscriptionsOfCustomer(customers[0].id));
}

if (!subscription) {
  console.error("✗ Aucun abonnement Stripe trouvé pour cette cible.");
  process.exit(1);
}

const customer =
  typeof subscription.customer === "string"
    ? await stripe.customers.retrieve(subscription.customer)
    : subscription.customer;

if (customer.deleted) {
  console.error(`✗ Le client Stripe ${customer.id} est supprimé.`);
  process.exit(1);
}

const email = (options.email ?? customer.email ?? "").toLowerCase();
if (!email) {
  console.error(
    `✗ Le client Stripe ${customer.id} n'a pas d'e-mail. Passez-le avec --email=…`,
  );
  process.exit(1);
}

const item = subscription.items.data[0];
const priceId = item?.price?.id;
const periodEnd = item?.current_period_end ?? null;

// ── Le plan, déduit du tarif ──────────────────────────────────────────────────

/**
 * Résout la valeur d'une variable d'environnement de tarif en Price ID : elle
 * peut porter un `price_…` (utilisé tel quel) ou un `prod_…` (on prend alors le
 * tarif par défaut du produit) — même règle que `resolvePriceId` côté serveur.
 */
async function envPriceId(envName) {
  const raw = process.env[envName];
  if (!raw) return null;
  try {
    if (raw.startsWith("prod_")) {
      const product = await stripe.products.retrieve(raw, { expand: ["default_price"] });
      const def = product.default_price;
      return def && typeof def !== "string" ? def.id : null;
    }
    return (await stripe.prices.retrieve(raw)).id;
  } catch {
    return null;
  }
}

/** L'offre correspondant au tarif de l'abonnement, comme le fait le webhook. */
async function planFromPriceId(id) {
  if (!id) return null;
  const table = [
    ["pro", "STRIPE_PRICE_PRO_MONTHLY"],
    ["pro", "STRIPE_PRICE_PRO_YEARLY"],
    ["agency", "STRIPE_PRICE_AGENCY"],
  ];
  for (const [plan, envName] of table) {
    if ((await envPriceId(envName)) === id) return plan;
  }
  return null;
}

const active = subscription.status === "trialing" || subscription.status === "active";
const matchedPlan = await planFromPriceId(priceId);
const plan = active && matchedPlan ? matchedPlan : "free";

if (active && !matchedPlan) {
  console.log(
    `⚠ Le tarif ${priceId} ne correspond à aucune variable STRIPE_PRICE_… de cet environnement.\n` +
      "  Le compte serait donc créé en plan « free » — et le prochain webhook l'y ramènerait.\n" +
      "  Vérifiez que vous tournez bien avec les variables de production avant --apply.\n",
  );
}

const name = options.name ?? email.split("@")[0];
const password = options.password ?? `Gtr-${randomBytes(9).toString("base64url")}!`;

// ── Récapitulatif ─────────────────────────────────────────────────────────────

console.log("Abonnement Stripe :");
console.log(`  abonnement  : ${subscription.id} (${subscription.status})`);
console.log(`  client      : ${customer.id}`);
console.log(`  tarif       : ${priceId ?? "—"}`);
console.log(`  fin d'essai : ${fmt(subscription.trial_end)}`);
console.log(`  fin période : ${fmt(periodEnd)}`);
console.log("\nCompte à créer :");
console.log(`  e-mail      : ${email}`);
console.log(`  nom         : ${name}`);
console.log(`  plan        : ${plan}`);
console.log(`  mot de passe: ${options.password ? "(fourni)" : password}`);

if (!APPLY) {
  console.log("\nSimulation — aucune écriture. Relancez avec --apply pour exécuter.");
  process.exit(0);
}

// ── Écriture ──────────────────────────────────────────────────────────────────

const client = new pg.Client({ connectionString });
await client.connect();

let userId;

try {
  await client.query("BEGIN");

  const existing = await client.query('SELECT id FROM "User" WHERE lower(email) = $1', [email]);
  userId = existing.rows[0]?.id;

  if (userId) {
    await client.query(
      `UPDATE "User"
         SET plan = $2, "emailVerified" = true, name = COALESCE(name, $3),
             "stripeCustomerId" = $4, "updatedAt" = now()
       WHERE id = $1`,
      [userId, plan, name, customer.id],
    );
    console.log(`\n✓ Utilisateur existant mis à jour : ${email}`);
  } else {
    userId = randomUUID();
    await client.query(
      `INSERT INTO "User" (id, email, name, "emailVerified", plan, "stripeCustomerId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, $5, now(), now())`,
      [userId, email, name, plan, customer.id],
    );
    console.log(`\n✓ Utilisateur créé : ${email}`);
  }

  // Identifiants e-mail/mot de passe (provider « credential » de Better Auth).
  const hash = await hashPassword(password);
  const account = await client.query(
    `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`,
    [userId],
  );
  if (account.rows[0]?.id) {
    await client.query('UPDATE account SET password = $2, "updatedAt" = now() WHERE id = $1', [
      account.rows[0].id,
      hash,
    ]);
    console.log("✓ Mot de passe réinitialisé sur l'identifiant existant.");
  } else {
    await client.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), userId, hash],
    );
    console.log("✓ Identifiant e-mail/mot de passe créé.");
  }

  // La ligne miroir de l'abonnement Stripe.
  const sub = await client.query('SELECT id FROM "Subscription" WHERE "userId" = $1', [userId]);
  const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;
  if (sub.rows[0]?.id) {
    await client.query(
      `UPDATE "Subscription"
         SET "stripeCustomerId" = $2, "stripeSubscriptionId" = $3, "stripePriceId" = $4,
             status = $5, "currentPeriodEnd" = $6, "updatedAt" = now()
       WHERE id = $1`,
      [sub.rows[0].id, customer.id, subscription.id, priceId, subscription.status, periodEndDate],
    );
    console.log("✓ Abonnement mis à jour en base.");
  } else {
    await client.query(
      `INSERT INTO "Subscription" (id, "userId", "stripeCustomerId", "stripeSubscriptionId",
                                   "stripePriceId", status, "currentPeriodEnd", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
      [
        randomUUID(),
        userId,
        customer.id,
        subscription.id,
        priceId,
        subscription.status,
        periodEndDate,
      ],
    );
    console.log("✓ Abonnement enregistré en base.");
  }

  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("✗ Échec — rien n'a été écrit :", err.message);
  await client.end();
  process.exit(1);
}

await client.end();

// Côté Stripe : le webhook retrouve le compte par `metadata.userId` avant même
// de regarder `stripeCustomerId`. On le pose, sur l'abonnement et sur le client.
try {
  await stripe.subscriptions.update(subscription.id, {
    metadata: { ...(subscription.metadata ?? {}), userId },
  });
  await stripe.customers.update(customer.id, {
    metadata: { ...(customer.metadata ?? {}), userId },
  });
  console.log("✓ metadata.userId posé sur l'abonnement et le client Stripe.");
} catch (err) {
  console.log(
    `⚠ metadata.userId non posé côté Stripe (${err.message}). ` +
      "Le rattachement tient quand même par User.stripeCustomerId.",
  );
}

console.log("\nCompte prêt :");
console.log(`  e-mail       : ${email}`);
console.log(`  mot de passe : ${password}`);
console.log(`  plan         : ${plan}`);
console.log("\nTransmettez ces identifiants au client et invitez-le à changer son mot de passe.");
