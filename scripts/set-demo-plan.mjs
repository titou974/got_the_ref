/**
 * Bascule des comptes sur l'offre « demo » : accès complet, aucune facturation.
 *
 *   node scripts/set-demo-plan.mjs                      # liste, n'écrit rien
 *   node scripts/set-demo-plan.mjs --apply              # bascule les candidats
 *   node scripts/set-demo-plan.mjs a@x.fr b@y.fr --apply
 *
 * Sans adresse, le script propose les comptes de démonstration tels qu'ils
 * existent aujourd'hui : ceux qui portent un abonnement actif **sans identifiant
 * d'abonnement Stripe**. Ce sont ceux ouverts à la main (cf.
 * `create-subscriber.mjs`) ou posés en base pour une présentation — personne n'a
 * jamais payé pour eux, et un événement Stripe ne viendra jamais les corriger.
 *
 * L'offre « demo » les met à l'abri : elle passe devant l'abonnement dans
 * `resolveTier`, et le webhook refuse de l'écraser. Un compte de démonstration
 * ne retombera donc plus au gratuit parce qu'un abonnement fantôme a expiré.
 *
 * Rien n'est écrit sans `--apply` : la liste s'affiche, et on décide.
 */

import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const emails = args.filter((arg) => !arg.startsWith("--")).map((e) => e.toLowerCase());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL manquant : renseignez-le dans .env avant de lancer le script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const { rows } = emails.length
    ? await client.query(
        `SELECT u.id, u.email, u.plan, s.status, s."stripeSubscriptionId"
           FROM "User" u
           LEFT JOIN "Subscription" s ON s."userId" = u.id
          WHERE lower(u.email) = ANY($1)`,
        [emails],
      )
    : await client.query(
        `SELECT u.id, u.email, u.plan, s.status, s."stripeSubscriptionId"
           FROM "User" u
           JOIN "Subscription" s ON s."userId" = u.id
          WHERE s.status IN ('active', 'trialing')
            AND (s."stripeSubscriptionId" IS NULL OR s."stripeSubscriptionId" = '')
          ORDER BY u.email`,
      );

  if (rows.length === 0) {
    console.log("Aucun compte candidat.");
    process.exit(0);
  }

  console.log(`${rows.length} compte(s) :`);
  for (const row of rows) {
    console.log(
      `  ${row.email.padEnd(36)} plan=${row.plan.padEnd(7)} abonnement=${row.status ?? "—"}` +
        `${row.stripeSubscriptionId ? ` (${row.stripeSubscriptionId})` : ""}`,
    );
  }

  // Un abonnement Stripe réel ne doit pas être maquillé en démonstration : le
  // client paie, et son offre doit continuer de suivre ce que Stripe en dit.
  const payers = rows.filter((row) => row.stripeSubscriptionId);
  if (payers.length) {
    console.log(
      `\n⚠️  ${payers.length} compte(s) portent un abonnement Stripe réel : ils sont ignorés.`,
    );
  }

  const targets = rows.filter((row) => !row.stripeSubscriptionId);
  if (targets.length === 0) {
    console.log("Rien à basculer.");
    process.exit(0);
  }

  if (!apply) {
    console.log(`\nRelancez avec --apply pour basculer ${targets.length} compte(s) sur « demo ».`);
    process.exit(0);
  }

  await client.query(`UPDATE "User" SET plan = 'demo', "updatedAt" = now() WHERE id = ANY($1)`, [
    targets.map((row) => row.id),
  ]);

  console.log(`\n${targets.length} compte(s) basculé(s) sur l'offre « demo ».`);
} finally {
  await client.end();
}
