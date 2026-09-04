/**
 * Le relevé du test A/B sur le parcours d'entrée.
 *
 *   node scripts/ab-parcours.mjs                 # depuis le début du test
 *   node scripts/ab-parcours.mjs --depuis=2026-09-01
 *
 * Deux branches, comparées sur ce qui compte vraiment — la conversion payante :
 *
 *   — `pricing-first` : la grille tarifaire après l'inscription, essai de trois
 *     jours compris. C'est le parcours d'avant le test, la branche témoin.
 *   — `demo-first` : le questionnaire d'accueil tout de suite, l'analyse
 *     gratuite dans la foulée, et les tarifs atteints depuis les voiles du
 *     tableau de bord.
 *
 * Les chiffres sortent de la base, pas d'un outil de mesure côté navigateur :
 * un bloqueur de publicité ne fausse pas une ligne `Subscription`, et la branche
 * est figée sur le compte (`User.pathVariant`), donc elle suit la personne d'un
 * appareil à l'autre.
 *
 * Trois taux, dans l'ordre de l'entonnoir. « Analysé » dit si le parcours mène
 * bien à la démonstration ; « payant » dit si la démonstration se transforme.
 * C'est le second qui tranche le test — une branche peut très bien faire lancer
 * plus d'analyses et vendre moins.
 *
 * Un compte sans branche (`pathVariant` nul) est antérieur au test : il est
 * compté à part et n'entre dans aucune moyenne.
 */

import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const sinceArg = args.find((arg) => arg.startsWith("--depuis="));

let since = null;
if (sinceArg) {
  const raw = sinceArg.split("=")[1];
  since = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(since.getTime())) {
    console.error(`Date illisible : « ${raw} ». Attendu : --depuis=AAAA-MM-JJ.`);
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
  // Un compte est dit « payant » dès qu'il a réglé quelque chose : l'abonnement
  // (`active` — l'essai, lui, n'a rien débité) ou le Coup de Boost, qui ne
  // laisse aucune ligne d'abonnement derrière lui mais pose `boostGrantedAt`.
  const { rows } = await client.query(
    `SELECT COALESCE(u."pathVariant", '(avant le test)') AS variante,
            COUNT(*)::int AS comptes,
            COUNT(*) FILTER (WHERE a.total > 0)::int AS analyses,
            COUNT(*) FILTER (
              WHERE s.status = 'active' OR u."boostGrantedAt" IS NOT NULL
            )::int AS payants
       FROM "User" u
       LEFT JOIN "Subscription" s ON s."userId" = u.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total FROM "Analysis" an WHERE an."userId" = u.id
       ) a ON TRUE
      WHERE ($1::timestamptz IS NULL OR u."createdAt" >= $1)
      GROUP BY 1
      ORDER BY 1`,
    [since],
  );

  if (rows.length === 0) {
    console.log("Aucun compte sur la période.");
  } else {
    const pct = (part, whole) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)} %`);

    console.log(since ? `Comptes ouverts depuis le ${since.toISOString().slice(0, 10)}` : "Tous les comptes");
    console.log("");
    console.table(
      rows.map((r) => ({
        Branche: r.variante,
        Comptes: r.comptes,
        Analysé: `${r.analyses} (${pct(r.analyses, r.comptes)})`,
        Payant: `${r.payants} (${pct(r.payants, r.comptes)})`,
      })),
    );

    const branches = rows.filter((r) => r.variante !== "(avant le test)");
    if (branches.length === 2) {
      const [a, b] = branches;
      const rate = (r) => (r.comptes === 0 ? 0 : r.payants / r.comptes);
      const total = branches.reduce((sum, r) => sum + r.comptes, 0);

      // Trente comptes par branche : en dessous, un seul abonnement de plus d'un
      // côté déplace le taux de plusieurs points. Le seuil ne remplace pas un
      // vrai test de significativité, il évite juste de conclure sur trois
      // clients.
      if (branches.some((r) => r.comptes < 30)) {
        console.log(
          `\n⚠ ${total} comptes en tout, dont une branche sous 30 : trop tôt pour conclure.`,
        );
      } else {
        const winner = rate(a) >= rate(b) ? a : b;
        const loser = winner === a ? b : a;
        const gap = Math.round((rate(winner) - rate(loser)) * 100);
        console.log(
          gap === 0
            ? "\nLes deux branches convertissent pareil."
            : `\n« ${winner.variante} » convertit ${gap} point(s) au-dessus de « ${loser.variante} ».`,
        );
      }
    }
  }
} finally {
  await client.end();
}
