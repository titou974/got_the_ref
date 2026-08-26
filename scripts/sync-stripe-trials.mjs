/**
 * Réaligne la base sur Stripe pour les abonnements en période d'essai.
 *
 *   node scripts/sync-stripe-trials.mjs            # simulation, rien n'est écrit
 *   node scripts/sync-stripe-trials.mjs --apply    # écriture
 *
 * Contexte : des essais ont été prolongés à la main dans le tableau de bord
 * Stripe (un mois offert), sans que le webhook ne repasse — la base garde donc
 * l'ancienne date de fin, et l'accès se referme trop tôt. Stripe est ici la
 * seule source de vérité : pour chaque abonnement en essai, on recopie
 * `trial_end` dans `Subscription.currentPeriodEnd`, avec le statut, le tarif et
 * l'identifiant client, puis on remet l'offre du compte à jour.
 *
 * Le compte est retrouvé dans cet ordre : `metadata.userId` de l'abonnement,
 * puis `User.stripeCustomerId`, puis l'e-mail du client Stripe. Un abonnement
 * sans compte correspondant est listé en fin de rapport, jamais deviné.
 *
 * Options :
 *   --apply            écrit vraiment (sans ça : simulation)
 *   --status=<liste>   statuts Stripe à parcourir (défaut : trialing)
 *   --all              parcourt tous les statuts
 *   --default-plan=<offre>  offre à poser quand le tarif de l'abonnement n'est
 *                      pas dans le catalogue de l'environnement (typiquement des
 *                      price IDs Live absents d'un `.env` de développement) et
 *                      que le compte est encore en « free ». Sans ça, l'offre du
 *                      compte est laissée telle quelle.
 *   --key-env=<NOM>    variable portant la clé Stripe (défaut : STRIPE_SECRET_KEY).
 *                      Utile quand le `.env` de travail est en mode Test alors
 *                      que la base est celle de production : la clé Live vit
 *                      alors dans une variable à part, sans rien écraser.
 */

import "dotenv/config";
import Stripe from "stripe";
import pg from "pg";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const statusArg = args.find((a) => a.startsWith("--status="))?.slice("--status=".length);
const statuses = args.includes("--all")
  ? ["all"]
  : (statusArg ?? "trialing")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

const defaultPlan =
  args.find((a) => a.startsWith("--default-plan="))?.slice("--default-plan=".length) ?? null;
const keyEnv =
  args.find((a) => a.startsWith("--key-env="))?.slice("--key-env=".length) ?? "STRIPE_SECRET_KEY";
const key = process.env[keyEnv];
const connectionString = process.env.DATABASE_URL;
if (!key) {
  console.error(`${keyEnv} manquant dans l'environnement.`);
  process.exit(1);
}
if (!connectionString) {
  console.error("DATABASE_URL manquant dans l'environnement.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
const mode = key.startsWith("sk_live_") ? "Live" : "Test";

// Prisma écrit ses `DateTime` dans des colonnes `timestamp` sans fuseau, en UTC.
// `pg`, lui, lit ce type dans le fuseau de la machine : sans ce parseur, chaque
// date remonterait décalée de l'offset local (deux heures l'été à Paris), et le
// script croirait devoir réécrire des lignes déjà justes. Même convention à
// l'écriture : on envoie l'ISO en UTC (cf. `toSql`).
pg.types.setTypeParser(1114, (value) => (value === null ? null : new Date(`${value}Z`)));
const toSql = (date) => (date ? date.toISOString() : null);

/**
 * Price ID → offre. Une variable peut porter un `prod_` : on prend alors tous
 * les tarifs du produit, pas seulement celui par défaut, sinon l'abonné annuel
 * ne serait rattaché à aucune offre et retomberait en « free ».
 */
async function buildPlanByPrice() {
  const envs = [
    ["pro", "STRIPE_PRICE_PRO_MONTHLY"],
    ["pro", "STRIPE_PRICE_PRO_YEARLY"],
    ["pro", "STRIPE_PRICE_UNIT"],
    ["agency", "STRIPE_PRICE_AGENCY"],
  ];
  const map = new Map();

  for (const [plan, env] of envs) {
    const raw = process.env[env];
    if (!raw) continue;
    try {
      if (raw.startsWith("prod_")) {
        for await (const price of stripe.prices.list({ product: raw, limit: 100 })) {
          map.set(price.id, plan);
        }
      } else {
        map.set(raw, plan);
      }
    } catch (err) {
      console.warn(`⚠ ${env} illisible avec une clé en mode ${mode} : ${err.message}`);
    }
  }
  return map;
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—");
const sameInstant = (a, b) =>
  (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const planByPrice = await buildPlanByPrice();
  console.log(`Clé Stripe : mode ${mode} · statuts parcourus : ${statuses.join(", ")}`);
  console.log(apply ? "Mode ÉCRITURE\n" : "Simulation — ajoutez --apply pour écrire\n");

  const subs = [];
  for (const status of statuses) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      expand: ["data.customer"],
    })) {
      subs.push(sub);
    }
  }

  let updated = 0;
  let created = 0;
  let unchanged = 0;
  const orphans = [];

  /** La fin d'essai fait foi ; hors essai, on retombe sur la fin de période. */
  const endOf = (sub) => sub.trial_end ?? sub.items.data[0]?.current_period_end ?? 0;

  /** metadata.userId · stripeCustomerId · e-mail du client Stripe, dans cet ordre. */
  async function resolveUser(sub, customerId, email) {
    if (sub.metadata?.userId) {
      const byMeta = (
        await client.query('SELECT id, email, plan FROM "User" WHERE id = $1', [
          sub.metadata.userId,
        ])
      ).rows[0];
      if (byMeta) return byMeta;
    }
    const byCustomer = (
      await client.query('SELECT id, email, plan FROM "User" WHERE "stripeCustomerId" = $1', [
        customerId,
      ])
    ).rows[0];
    if (byCustomer) return byCustomer;

    if (!email) return null;
    return (
      await client.query('SELECT id, email, plan FROM "User" WHERE lower(email) = lower($1)', [
        email,
      ])
    ).rows[0];
  }

  // Un même compte peut porter plusieurs abonnements en essai, parfois sous des
  // clients Stripe différents (tunnel repris, second paiement). La base n'en
  // garde qu'un : on retient celui dont l'essai finit le plus tard, c'est-à-dire
  // l'accès réellement ouvert. Le rattachement au compte se fait donc avant le
  // dédoublonnage, sinon deux clients distincts s'écraseraient l'un l'autre.
  const byUser = new Map();
  for (const sub of subs) {
    const customer = sub.customer;
    const customerId = typeof customer === "string" ? customer : customer.id;
    const email = typeof customer === "string" ? null : (customer.email ?? null);
    const user = await resolveUser(sub, customerId, email);

    if (!user) {
      const end = endOf(sub) ? new Date(endOf(sub) * 1000) : null;
      orphans.push({ sub: sub.id, customerId, email, status: sub.status, end });
      continue;
    }

    const kept = byUser.get(user.id);
    if (!kept || endOf(sub) > endOf(kept.sub)) byUser.set(user.id, { user, sub, customerId });
  }
  const skipped = subs.length - orphans.length - byUser.size;

  for (const { user, sub, customerId } of byUser.values()) {
    const endTs = endOf(sub) || null;
    const end = endTs ? new Date(endTs * 1000) : null;
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const plan = priceId ? (planByPrice.get(priceId) ?? null) : null;
    const active = sub.status === "active" || sub.status === "trialing";

    const row = (
      await client.query(
        'SELECT id, status, "currentPeriodEnd" FROM "Subscription" WHERE "userId" = $1',
        [user.id],
      )
    ).rows[0];

    // Un tarif hors catalogue (offre sur mesure, ancien produit) ne doit pas
    // faire retomber le compte en « free » : on garde l'offre en place.
    const fallbackPlan = defaultPlan && user.plan === "free" ? defaultPlan : user.plan;
    const nextPlan = active ? (plan ?? fallbackPlan) : user.plan;
    if (active && !plan) {
      console.warn(
        `⚠ ${user.email} : tarif ${priceId} hors catalogue, offre posée à « ${nextPlan} ».`,
      );
    }

    const changed =
      !row ||
      row.status !== sub.status ||
      !sameInstant(row.currentPeriodEnd, end) ||
      user.plan !== nextPlan;

    if (!changed) {
      unchanged += 1;
      continue;
    }

    const label = `${user.email.padEnd(34)} ${sub.status.padEnd(9)} ${iso(row?.currentPeriodEnd)} → ${iso(end)}`;

    if (apply) {
      await client.query("BEGIN");
      try {
        if (row) {
          await client.query(
            `UPDATE "Subscription"
                SET "stripeCustomerId" = $2, "stripeSubscriptionId" = $3, "stripePriceId" = $4,
                    status = $5, "currentPeriodEnd" = $6, "updatedAt" = timezone('UTC', now())
              WHERE id = $1`,
            [row.id, customerId, sub.id, priceId, sub.status, toSql(end)],
          );
          updated += 1;
        } else {
          await client.query(
            `INSERT INTO "Subscription"
               (id, "userId", "stripeCustomerId", "stripeSubscriptionId", "stripePriceId",
                status, "currentPeriodEnd", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, timezone('UTC', now()), timezone('UTC', now()))`,
            [user.id, customerId, sub.id, priceId, sub.status, toSql(end)],
          );
          created += 1;
        }
        await client.query(
          `UPDATE "User" SET plan = $2, "stripeCustomerId" = $3, "updatedAt" = timezone('UTC', now())
            WHERE id = $1`,
          [user.id, nextPlan, customerId],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      console.log(`✓ ${label}`);
    } else {
      if (row) updated += 1;
      else created += 1;
      console.log(`· ${label}${row ? "" : "  (ligne à créer)"}`);
    }
  }

  console.log(
    `\n${subs.length} abonnement(s) Stripe · ${updated} mise(s) à jour · ${created} création(s) · ` +
      `${unchanged} déjà à jour · ${skipped} doublon(s) écarté(s) · ${orphans.length} sans compte en base`,
  );

  if (orphans.length) {
    console.log("\nAbonnements sans compte correspondant :");
    for (const o of orphans) {
      console.log(
        `  ${o.sub} · ${o.customerId} · ${o.email ?? "sans e-mail"} · ${o.status} · ${iso(o.end)}`,
      );
    }
  }

  if (!apply) console.log("\nRien n'a été écrit. Relancez avec --apply.");
} finally {
  await client.end();
}
