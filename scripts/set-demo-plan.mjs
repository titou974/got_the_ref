/**
 * Bascule des comptes sur l'offre « demo » : accès complet, aucune facturation.
 *
 *   node scripts/set-demo-plan.mjs                        # liste, n'écrit rien
 *   node scripts/set-demo-plan.mjs --apply                # bascule les candidats
 *   node scripts/set-demo-plan.mjs a@x.fr b@y.fr --apply
 *   node scripts/set-demo-plan.mjs --essais               # essais en cours
 *   node scripts/set-demo-plan.mjs --essais=2026-09-30 --apply
 *
 * Trois sélections, une seule écriture.
 *
 * Sans argument, le script propose les comptes de démonstration tels qu'ils
 * existent aujourd'hui : ceux qui portent un abonnement actif **sans identifiant
 * d'abonnement Stripe**. Ce sont ceux ouverts à la main (cf.
 * `create-subscriber.mjs`) ou posés en base pour une présentation — personne n'a
 * jamais payé pour eux, et un événement Stripe ne viendra jamais les corriger.
 *
 * Avec `--essais`, il prend les abonnés encore en période d'essai dont
 * l'échéance tombe avant la date de bascule (fin septembre 2026 par défaut,
 * `--essais=AAAA-MM-JJ` pour une autre). Ceux-là ont un abonnement Stripe bien
 * réel, mais ils n'ont encore rien réglé : à la mise en production du nouveau
 * découpage des offres, leur essai se termine et ils retomberaient au gratuit,
 * amputés de ce qu'on leur avait ouvert. Les passer en « demo » leur laisse
 * l'accès complet. Un abonnement `active` — donc payé — n'est jamais concerné :
 * son offre doit continuer de suivre ce que Stripe en dit.
 *
 * L'offre « demo » les met à l'abri : elle passe devant l'abonnement dans
 * `resolveTier`, et le webhook refuse de l'écraser. Un compte de démonstration
 * ne retombera donc plus au gratuit parce qu'un essai a expiré. La bascule est
 * définitive : rien ne repasse un compte en « free » tout seul.
 *
 * Rien n'est écrit sans `--apply` : la liste s'affiche, et on décide.
 */

import "dotenv/config";
import pg from "pg";

/** Fin de la période d'essai des abonnés à reprendre, si `--essais` ne dit rien. */
const DEFAULT_TRIAL_CUTOFF = "2026-09-30";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const trialArg = args.find((arg) => arg === "--essais" || arg.startsWith("--essais="));
const emails = args.filter((arg) => !arg.startsWith("--")).map((e) => e.toLowerCase());

// `--essais` seul vaut la date par défaut ; `--essais=AAAA-MM-JJ` la remplace.
// La borne est la fin de la journée indiquée, sinon un essai qui expire ce
// jour-là à midi passerait à travers.
let trialCutoff = null;
if (trialArg) {
  const raw = trialArg.includes("=") ? trialArg.split("=")[1] : DEFAULT_TRIAL_CUTOFF;
  trialCutoff = new Date(`${raw}T23:59:59.999Z`);
  if (Number.isNaN(trialCutoff.getTime())) {
    console.error(`Date d'échéance illisible : « ${raw} ». Attendu : --essais=AAAA-MM-JJ.`);
    process.exit(1);
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL manquant : renseignez-le dans .env avant de lancer le script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  let rows;
  if (emails.length) {
    ({ rows } = await client.query(
      `SELECT u.id, u.email, u.plan, s.status, s."stripeSubscriptionId", s."currentPeriodEnd"
         FROM "User" u
         LEFT JOIN "Subscription" s ON s."userId" = u.id
        WHERE lower(u.email) = ANY($1)`,
      [emails],
    ));
  } else if (trialCutoff) {
    // Un essai sans échéance connue est pris lui aussi : il vient d'un
    // abonnement posé à la main, et il expirera sans que personne ne l'ait payé.
    ({ rows } = await client.query(
      `SELECT u.id, u.email, u.plan, s.status, s."stripeSubscriptionId", s."currentPeriodEnd"
         FROM "User" u
         JOIN "Subscription" s ON s."userId" = u.id
        WHERE s.status = 'trialing'
          AND (s."currentPeriodEnd" IS NULL OR s."currentPeriodEnd" <= $1)
        ORDER BY u.email`,
      [trialCutoff],
    ));
  } else {
    ({ rows } = await client.query(
      `SELECT u.id, u.email, u.plan, s.status, s."stripeSubscriptionId", s."currentPeriodEnd"
         FROM "User" u
         JOIN "Subscription" s ON s."userId" = u.id
        WHERE s.status IN ('active', 'trialing')
          AND (s."stripeSubscriptionId" IS NULL OR s."stripeSubscriptionId" = '')
        ORDER BY u.email`,
    ));
  }

  if (trialCutoff) {
    console.log(`Essais arrivant à échéance jusqu'au ${trialCutoff.toISOString().slice(0, 10)} :`);
  }

  if (rows.length === 0) {
    console.log("Aucun compte candidat.");
    process.exit(0);
  }

  console.log(`${rows.length} compte(s) :`);
  for (const row of rows) {
    const end = row.currentPeriodEnd
      ? row.currentPeriodEnd.toISOString().slice(0, 10)
      : "sans échéance";
    console.log(
      `  ${row.email.padEnd(36)} plan=${row.plan.padEnd(7)} abonnement=${row.status ?? "—"}` +
        ` fin=${end}${row.stripeSubscriptionId ? ` (${row.stripeSubscriptionId})` : ""}`,
    );
  }

  // Un abonnement Stripe réel ne doit pas être maquillé en démonstration : le
  // client paie, et son offre doit continuer de suivre ce que Stripe en dit.
  // La réserve tombe pour `--essais` : un essai n'a rien encaissé, et c'est
  // précisément ce qu'on vient reprendre.
  const targets = trialCutoff ? rows : rows.filter((row) => !row.stripeSubscriptionId);
  const ignored = rows.length - targets.length;
  if (ignored > 0) {
    console.log(`\n⚠️  ${ignored} compte(s) portent un abonnement Stripe réel : ils sont ignorés.`);
  }

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
