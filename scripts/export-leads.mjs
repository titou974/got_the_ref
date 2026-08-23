/**
 * Exporte la liste de diffusion en CSV, prête à importer dans une audience
 * Resend (ou à relire depuis un envoi en lot).
 *
 *   node scripts/export-leads.mjs [fichier.csv]
 *
 * Seules les adresses encore consentantes sortent : `marketingOptIn = true` et
 * aucune désinscription. Sans argument, le CSV part sur la sortie standard —
 * pratique pour un `| pbcopy` ou un `> leads.csv`.
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import pg from "pg";

const outFile = process.argv[2] ?? null;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL manquant : renseignez-le dans .env avant de lancer le script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const { rows } = await client.query(
    `SELECT email, domain, "analysisCount", "lastAnalysisAt", "createdAt"
       FROM "Lead"
      WHERE "marketingOptIn" = true AND "unsubscribedAt" IS NULL
      ORDER BY "createdAt" DESC`,
  );

  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = [
    "email,domain,analysisCount,lastAnalysisAt,createdAt",
    ...rows.map((r) =>
      [r.email, r.domain, r.analysisCount, r.lastAnalysisAt, r.createdAt].map(escape).join(","),
    ),
  ].join("\n");

  if (outFile) {
    writeFileSync(outFile, csv + "\n");
    console.log(`${rows.length} adresse(s) écrite(s) dans ${outFile}`);
  } else {
    console.log(csv);
  }
} finally {
  await client.end();
}
