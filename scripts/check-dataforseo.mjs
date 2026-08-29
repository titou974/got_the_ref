/**
 * Vérifie le branchement DataForSEO et montre les mentions d'un domaine,
 * modèle par modèle — le même décompte que la carte du tableau de bord.
 *
 *   node scripts/check-dataforseo.mjs exemple.fr [code_localisation]
 *
 * Le code de localisation vaut 2250 (France) par défaut ; 2840 pour les
 * États-Unis, 2056 pour la Belgique.
 *
 * Suit l'évolution mensuelle depuis le 1er janvier, une série par plateforme,
 * relevée sur le domaine seul — jamais sur le nom de la marque, dont
 * l'orthographe varie d'une source à l'autre.
 *
 * Les appels sont facturés par DataForSEO : une exécution = un appel
 * « search_mentions » plus un appel « timeseries_delta » par plateforme.
 *
 * Identifiants lus dans .env : DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD, ou
 * DATAFORSEO_AUTH (base64 de « login:password »).
 */

import "dotenv/config";

const domain = process.argv[2];
const locationCode = Number(process.argv[3] ?? 2250);

if (!domain) {
  console.error(
    "Usage : node scripts/check-dataforseo.mjs exemple.fr [code_localisation]",
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

// L'évolution mensuelle, une série par plateforme, depuis le 1er janvier.
// L'archive DataForSEO ne remonte pas avant août 2025.
const now = new Date();
const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
const dateFrom = yearStart < "2025-08-01" ? "2025-08-01" : yearStart;
const dateTo = now.toISOString().slice(0, 10);

// ChatGPT n'est historisé qu'aux États-Unis et en anglais : lui envoyer la
// localisation du client rendrait une série vide, qu'on lirait à tort comme une
// absence de mentions.
const platforms = [
  { platform: "google", location: locationCode, language: "fr" },
  { platform: "chat_gpt", location: 2840, language: "en" },
];

for (const entry of platforms) {
  const series = await call("/v3/ai_optimization/llm_mentions/timeseries_delta/live", {
    target: [{ domain, include_subdomains: true }],
    location_code: entry.location,
    language_code: entry.language,
    platform: entry.platform,
    date_from: dateFrom,
    date_to: dateTo,
    group_range: "month",
  });

  console.log("");
  console.log(
    `Évolution      : ${entry.platform} (localisation ${entry.location}), depuis le ${dateFrom}`,
  );
  console.log(`Coût de l'appel: ${series.cost} $`);
  console.log("");

  const months = series.result?.items ?? [];
  if (months.length === 0) {
    console.log("Aucune évolution relevée pour cette plateforme.");
    continue;
  }

  for (const month of months) {
    const delta = month.delta_mentions ?? 0;
    const volume = month.delta_ai_search_volume ?? 0;
    console.log(
      `${String(month.date).slice(0, 7)}   ${String(delta).padStart(6)} mentions  ${String(
        volume,
      ).padStart(8)} recherches/mois`,
    );
  }
}
