/**
 * Vérifie le branchement DataForSEO et montre les mentions d'un domaine,
 * modèle par modèle — le même décompte que la carte du tableau de bord.
 *
 *   node scripts/check-dataforseo.mjs exemple.fr [code_localisation]
 *
 * Le code de localisation vaut 2250 (France) par défaut ; 2840 pour les
 * États-Unis, 2056 pour la Belgique. L'appel est facturé par DataForSEO :
 * une exécution = une requête « live » sur l'archive des réponses d'IA.
 *
 * Identifiants lus dans .env : DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD, ou
 * DATAFORSEO_AUTH (base64 de « login:password »).
 */

import "dotenv/config";

const domain = process.argv[2];
const locationCode = Number(process.argv[3] ?? 2250);

if (!domain) {
  console.error("Usage : node scripts/check-dataforseo.mjs exemple.fr [code_localisation]");
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

const res = await fetch(
  "https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live",
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        target: [{ domain, include_subdomains: true }],
        location_code: locationCode,
        language_code: "fr",
        order_by: ["ai_search_volume,desc"],
        limit: 1000,
      },
    ]),
  },
);

if (!res.ok) {
  console.error(`HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

const payload = await res.json();
const task = payload.tasks?.[0];

if (payload.status_code !== 20000 || !task || task.status_code !== 20000) {
  console.error(
    `Erreur DataForSEO ${task?.status_code ?? payload.status_code} — ${
      task?.status_message ?? payload.status_message
    }`,
  );
  process.exit(1);
}

const result = task.result?.[0];
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
