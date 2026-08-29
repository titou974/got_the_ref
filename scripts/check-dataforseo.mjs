/**
 * Vérifie le branchement DataForSEO et montre les mentions d'un domaine,
 * modèle par modèle — le même décompte que la carte du tableau de bord.
 *
 *   node scripts/check-dataforseo.mjs exemple.fr [code_localisation] [marque]
 *
 * Le code de localisation vaut 2250 (France) par défaut ; 2840 pour les
 * États-Unis, 2056 pour la Belgique. Avec un nom de marque en troisième
 * argument, les douze derniers mois de mentions sont affichés en plus.
 *
 * Les appels sont facturés par DataForSEO : une exécution = une requête
 * « live » sur l'archive, deux si la marque est donnée.
 *
 * Identifiants lus dans .env : DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD, ou
 * DATAFORSEO_AUTH (base64 de « login:password »).
 */

import "dotenv/config";

const domain = process.argv[2];
const locationCode = Number(process.argv[3] ?? 2250);
const brand = process.argv[4] ?? null;

if (!domain) {
  console.error(
    "Usage : node scripts/check-dataforseo.mjs exemple.fr [code_localisation] [marque]",
  );
  process.exit(1);
}

const auth =
  process.env.DATAFORSEO_AUTH?.trim() ||
  (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD
    ? Buffer.from(
        `${process.env.DATAFORSEO_LOGIN.trim()}:${process.env.DATAFORSEO_PASSWORD.trim()}`,
      ).toString("base64")
    : null);

if (!auth) {
  console.error(
    "Identifiants absents : renseignez DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD dans .env.",
  );
  process.exit(1);
}

/** Une tâche « live », avec les deux niveaux d'état vérifiés. */
async function call(path, task) {
  const res = await fetch(`https://api.dataforseo.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([task]),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status} — ${await res.text()}`);
    process.exit(1);
  }

  const body = await res.json();
  const first = body.tasks?.[0];

  if (body.status_code !== 20000 || !first || first.status_code !== 20000) {
    console.error(
      `Erreur DataForSEO ${first?.status_code ?? body.status_code} — ${
        first?.status_message ?? body.status_message
      }`,
    );
    process.exit(1);
  }

  return { cost: body.cost, result: first.result?.[0] ?? null };
}

const payload = await call(
  "/v3/ai_optimization/llm_mentions/search_mentions/live",
  {
    target: [{ domain, include_subdomains: true }],
    location_code: locationCode,
    language_code: "fr",
    order_by: ["ai_search_volume,desc"],
    limit: 1000,
  },
);

const result = payload.result;
const items = result?.items ?? [];

const perModel = new Map();
for (const item of items) {
  const key = `${item.platform} · ${item.model_name}`;
  const current = perModel.get(key) ?? { mentions: 0, volume: 0 };
  current.mentions += 1;
  current.volume += item.ai_search_volume ?? 0;
  perModel.set(key, current);
}

console.log(`Domaine        : ${domain} (localisation ${locationCode})`);
console.log(`Coût de l'appel: ${payload.cost} $`);
console.log(`Mentions       : ${result?.total_count ?? 0} au total, ${items.length} lues`);
console.log("");

if (perModel.size === 0) {
  console.log("Aucune mention dans l'archive pour ce domaine.");
} else {
  for (const [model, stats] of [...perModel].sort((a, b) => b[1].mentions - a[1].mentions)) {
    console.log(
      `${model.padEnd(34)} ${String(stats.mentions).padStart(5)} mentions  ${String(
        stats.volume,
      ).padStart(8)} recherches/mois`,
    );
  }
}

if (brand) {
  // Douze mois calendaires, l'archive DataForSEO ne remontant pas avant août 2025.
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const dateFrom = from.toISOString().slice(0, 10);

  const history = await call("/v3/ai_optimization/llm_mentions/historical/live", {
    target: [{ keyword: brand }],
    location_code: locationCode,
    language_code: "fr",
    date_from: dateFrom < "2025-08-01" ? "2025-08-01" : dateFrom,
    date_to: now.toISOString().slice(0, 10),
    // Hors États-Unis, seul Google est historisé chez DataForSEO.
    ...(locationCode === 2840 ? {} : { platform: "google" }),
  });

  console.log("");
  console.log(`Marque         : « ${brand} », 12 derniers mois`);
  console.log(`Coût de l'appel: ${history.cost} $`);
  console.log("");

  const months = history.result?.items ?? [];
  if (months.length === 0) {
    console.log("Aucun historique pour cette marque.");
  } else {
    for (const month of months) {
      const mentions = month.metrics?.mentions ?? month.mentions ?? 0;
      const volume = month.metrics?.ai_search_volume ?? month.ai_search_volume ?? 0;
      console.log(
        `${String(month.year)}-${String(month.month).padStart(2, "0")}   ${String(
          mentions,
        ).padStart(6)} mentions  ${String(volume).padStart(8)} recherches/mois`,
      );
    }
  }
}
