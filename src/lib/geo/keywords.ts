import "server-only";

import type {
  BusinessProfile,
  KeywordPlacement,
  SiteSignals,
  TrendingKeyword,
  TrendingKeywordsInsight,
} from "./types";
import { postJson } from "./providers";
import { geoLog } from "./log";

/**
 * Mots-clés tendances de la niche, à placer dans le title, la meta description
 * et le H1.
 *
 * Version payante : Gemini avec grounding Google Search — c'est le moteur qui
 * voit les requêtes du moment, donc celui à qui on les demande. Version
 * gratuite (ou clé absente) : un repli déterministe construit la même structure
 * à partir de la niche et de la ville, de sorte que l'aperçu montre CE QU'ON
 * livre, flouté, sans jamais facturer un appel API à un visiteur qui ne paie pas.
 */

const PLACEMENTS: KeywordPlacement[] = ["title", "metaDescription", "h1"];
const MAX_KEYWORDS = 10;

/** Fenêtre de tendance annoncée : le mois courant, en français. */
function currentPeriod(): string {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function clean(s: unknown, max = 200): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Ne garde que les emplacements connus ; à défaut, les trois. */
function normalizePlacements(raw: unknown): KeywordPlacement[] {
  const list = Array.isArray(raw)
    ? raw
        .map((p) => clean(p, 30))
        .map((p) => (p === "meta" || p === "metadescription" ? "metaDescription" : p))
        .filter((p): p is KeywordPlacement => PLACEMENTS.includes(p as KeywordPlacement))
    : [];
  const unique = [...new Set(list)];
  return unique.length ? unique : PLACEMENTS;
}

function normalizeTrend(raw: unknown): TrendingKeyword["trend"] {
  const v = clean(raw, 20).toLowerCase();
  if (v.startsWith("mont")) return "montant";
  if (v.startsWith("émerg") || v.startsWith("emerg")) return "émergent";
  return "stable";
}

function normalizeKeywords(raw: unknown): TrendingKeyword[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => {
      const o = (k ?? {}) as Record<string, unknown>;
      return {
        keyword: clean(o.keyword, 80),
        intent: clean(o.intent, 80),
        trend: normalizeTrend(o.trend),
        placements: normalizePlacements(o.placements),
      };
    })
    .filter((k) => k.keyword.length > 1)
    .slice(0, MAX_KEYWORDS);
}

/** Extrait le premier objet JSON d'une réponse de modèle (souvent en ```json). */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* --------------------------------- Repli ---------------------------------- */

/**
 * Repli déterministe : combine la niche, la catégorie et la ville selon les
 * tournures que les internautes emploient réellement. Aucun appel réseau — c'est
 * ce que voit l'aperçu gratuit, sous le flou.
 */
export function fallbackTrendingKeywords(
  profile: BusinessProfile,
  signals: SiteSignals,
): TrendingKeywordsInsight {
  const niche = profile.niche.toLowerCase();
  const category = (profile.generalCategory || profile.niche).toLowerCase();
  const city = profile.location ?? null;
  const inCity = city ? ` ${city}` : "";
  const name = signals.title?.split(/[|\-–—]/)[0].trim() || signals.domain;

  const seeds: Array<[string, string, TrendingKeyword["trend"], KeywordPlacement[]]> = [
    [`${niche}${inCity}`, "recherche principale", "stable", ["title", "h1", "metaDescription"]],
    [`meilleur ${category}${inCity}`, "comparaison", "montant", ["title", "metaDescription"]],
    [`${category}${inCity} avis`, "réassurance", "montant", ["metaDescription"]],
    [`${niche} ouvert maintenant${inCity}`, "intention immédiate", "émergent", ["metaDescription"]],
    [`${category} pas cher${inCity}`, "budget", "stable", ["metaDescription"]],
    [`${niche} réservation${inCity}`, "conversion", "montant", ["title", "metaDescription"]],
    [`${category} recommandé par ChatGPT`, "recherche IA", "émergent", ["h1", "metaDescription"]],
    [`où trouver ${niche}${inCity}`, "question conversationnelle", "émergent", ["h1"]],
  ];

  const keywords: TrendingKeyword[] = seeds.map(([keyword, intent, trend, placements]) => ({
    keyword,
    intent,
    trend,
    placements,
  }));

  const cityLabel = city ? ` à ${city}` : "";
  return {
    measured: false,
    source: "heuristic",
    period: currentPeriod(),
    keywords,
    suggested: {
      title: `${name} — ${profile.niche}${cityLabel} | Avis & réservation`,
      metaDescription: `${profile.niche}${cityLabel} : ${name} vous accueille. Avis clients, horaires, adresse et réservation en ligne.`,
      h1: `${profile.niche}${cityLabel}`,
    },
    notes: [
      "Mots-clés déduits de la niche et de la zone : l'audit complet les remplace par les requêtes réellement en hausse, relevées sur Google.",
    ],
  };
}

/* --------------------------------- Gemini --------------------------------- */

function buildPrompt(profile: BusinessProfile, signals: SiteSignals): string {
  const city = profile.location ? `Zone : ${profile.location}.` : "Activité en ligne, sans zone géographique.";
  return [
    `Tu es consultant SEO/GEO. Niche : « ${profile.niche} ». Catégorie large : « ${profile.generalCategory} ». ${city}`,
    `Site analysé : ${signals.url}.`,
    `Title actuel : ${signals.title ?? "(absent)"}`,
    `Meta description actuelle : ${signals.metaDescription ?? "(absente)"}`,
    `H1 actuel : ${signals.h1[0] ?? "(absent)"}`,
    "",
    "Avec la recherche Google, identifie les requêtes RÉELLEMENT tendances de cette niche ce mois-ci (volume en hausse, formulations employées aujourd'hui, y compris les questions posées aux assistants IA).",
    "",
    "Réponds UNIQUEMENT par un objet JSON de cette forme, en français, sans commentaire :",
    "{",
    '  "period": "mois année",',
    '  "keywords": [{ "keyword": "…", "intent": "…", "trend": "montant|stable|émergent", "placements": ["title","metaDescription","h1"] }],',
    '  "suggested": { "title": "≤ 60 caractères", "metaDescription": "≤ 155 caractères", "h1": "≤ 70 caractères" },',
    '  "notes": ["…"]',
    "}",
    "",
    `Contraintes : 6 à ${MAX_KEYWORDS} mots-clés, du plus porteur au moins porteur ; les trois réécritures doivent intégrer les mots-clés les plus porteurs sans bourrage et rester lisibles par un humain.`,
  ].join("\n");
}

/**
 * Interroge Gemini (grounding Google Search) pour les mots-clés tendances.
 * Renvoie `null` si la clé manque ou si la réponse est inexploitable :
 * l'appelant retombe alors sur `fallbackTrendingKeywords`.
 */
export async function fetchTrendingKeywords(
  profile: BusinessProfile,
  signals: SiteSignals,
): Promise<TrendingKeywordsInsight | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    geoLog("Mots-clés tendances — ignoré (pas de clé GEMINI_API_KEY)");
    return null;
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  geoLog(`Mots-clés tendances — appel Gemini (${model}, google_search)…`);
  try {
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(profile, signals) }] }],
          tools: [{ google_search: {} }],
        }),
      },
      "Gemini mots-clés",
    )) as Record<string, unknown>;

    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    const parts =
      ((candidates?.[0]?.content as Record<string, unknown>)?.parts as Array<{ text?: string }>) ?? [];
    const text = parts.map((p) => p.text).filter(Boolean).join("\n");
    const json = extractJson(text);
    if (!json) {
      geoLog("Mots-clés tendances — réponse illisible", text.slice(0, 300));
      return null;
    }

    const keywords = normalizeKeywords(json.keywords);
    if (!keywords.length) {
      geoLog("Mots-clés tendances — aucun mot-clé exploitable");
      return null;
    }

    const suggested = (json.suggested ?? {}) as Record<string, unknown>;
    const fb = fallbackTrendingKeywords(profile, signals);
    const insight: TrendingKeywordsInsight = {
      measured: true,
      source: "gemini",
      period: clean(json.period, 40) || currentPeriod(),
      keywords,
      suggested: {
        title: clean(suggested.title, 120) || fb.suggested.title,
        metaDescription: clean(suggested.metaDescription, 220) || fb.suggested.metaDescription,
        h1: clean(suggested.h1, 120) || fb.suggested.h1,
      },
      notes: Array.isArray(json.notes)
        ? json.notes.map((n) => clean(n, 240)).filter(Boolean).slice(0, 4)
        : [],
    };
    geoLog("Mots-clés tendances — résultat", {
      période: insight.period,
      motsClés: insight.keywords.map((k) => k.keyword),
    });
    return insight;
  } catch (err) {
    geoLog("Mots-clés tendances — échec", String(err));
    return null;
  }
}
