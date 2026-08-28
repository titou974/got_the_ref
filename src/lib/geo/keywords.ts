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
      title: `${name} : ${profile.niche}${cityLabel} | Avis & réservation`,
      metaDescription: `${profile.niche}${cityLabel} : ${name} vous accueille. Avis clients, horaires, adresse et réservation en ligne.`,
      h1: `${profile.niche}${cityLabel}`,
      firstParagraph: `${name}, ${profile.niche.toLowerCase()}${cityLabel}. Cette page réunit l'adresse, les horaires, ce qui est proposé et la marche à suivre pour réserver.`,
    },
    notes: [
      "Mots-clés déduits de la niche et de la zone : l'audit complet les remplace par les requêtes réellement en hausse, relevées sur Google.",
    ],
  };
}

/* --------------------------- Règles de rédaction --------------------------- */

/**
 * La forme du title : le nom de l'entreprise d'abord.
 *
 * Un title qui commence par les mots-clés et finit par la marque se fait
 * tronquer là où le nom se trouve, et l'internaute qui cherche l'enseigne ne la
 * voit pas. L'ordre inverse — « Reliance Paris | Parfum sans alcool & soins
 * naturels » — garde le nom lisible même coupé, et laisse les mots-clés dans la
 * partie qui reste indexée.
 */
const TITLE_SHAPE =
  "« title » : le nom de l'entreprise EN PREMIER, puis « | », puis les mots-clés porteurs. Forme attendue : « Reliance Paris | Parfum sans alcool & soins naturels ». Jamais le nom à la fin, jamais « Mots-clés | Nom ». 60 caractères au plus.";

/**
 * Ce qui distingue un texte écrit par le commerçant d'un texte de modèle.
 *
 * Ces phrases sont les premières que le client relit dans son tableau de bord,
 * et les seules qu'il colle telles quelles dans son CMS : un H1 qui sonne
 * comme un modèle ne sera pas publié, quelle que soit sa densité en mots-clés.
 */
const STYLE_RULES = [
  "Le H1 et le premier paragraphe doivent sonner comme le commerçant, jamais comme un texte de modèle :",
  "- verbes simples (« est », « propose », « ouvre », « répare ») plutôt que « se positionne comme » ou « constitue » ;",
  "- aucune promesse creuse (« votre partenaire de confiance », « au cœur de », « depuis toujours », « l'excellence au service de ») ;",
  "- aucune triade décorative (« qualité, proximité et savoir-faire ») : deux faits valent mieux que trois adjectifs ;",
  "- aucun participe présent d'analyse en fin de phrase (« soulignant… », « garantissant… », « permettant ainsi… ») ;",
  "- aucune tournure « non seulement… mais aussi » ni « ce n'est pas X, c'est Y » ;",
  "- aucun emoji, aucun gras, aucune majuscule à chaque mot ;",
  "- le premier paragraphe ne répète pas le H1 : il ajoute le fait que le H1 n'a pas la place de porter.",
].join("\n");

const PARAGRAPH_RULE =
  "Pour « firstParagraph » : réécris le premier paragraphe de la page d'accueil de sorte qu'un assistant IA puisse le citer tel quel. Il dit en une première phrase qui est ce commerce, ce qu'il fait et où ; les phrases suivantes ajoutent un fait vérifiable (spécialité, ancienneté, zone desservie, horaires). Aucun superlatif publicitaire, aucune formule d'ouverture creuse, aucun tiret cadratin, aucun chiffre ni nom propre absent des éléments ci-dessus.";

/* --------------------------------- Gemini --------------------------------- */

function buildPrompt(
  profile: BusinessProfile,
  signals: SiteSignals,
  tone: string | null,
): string {
  const city = profile.location ? `Zone : ${profile.location}.` : "Activité en ligne, sans zone géographique.";
  return [
    `Tu es consultant SEO/GEO. Niche : « ${profile.niche} ». Catégorie large : « ${profile.generalCategory} ». ${city}`,
    `Site analysé : ${signals.url}.`,
    `Title actuel : ${signals.title ?? "(absent)"}`,
    `Meta description actuelle : ${signals.metaDescription ?? "(absente)"}`,
    `H1 actuel : ${signals.h1[0] ?? "(absent)"}`,
    `Premier paragraphe actuel : ${signals.firstParagraph ?? "(absent)"}`,
    "",
    "Avec la recherche Google, identifie les requêtes RÉELLEMENT tendances de cette niche ce mois-ci (volume en hausse, formulations employées aujourd'hui, y compris les questions posées aux assistants IA).",
    "",
    "Réponds UNIQUEMENT par un objet JSON de cette forme, en français, sans commentaire :",
    "{",
    '  "period": "mois année",',
    '  "keywords": [{ "keyword": "…", "intent": "…", "trend": "montant|stable|émergent", "placements": ["title","metaDescription","h1"] }],',
    '  "suggested": { "title": "≤ 60 caractères", "metaDescription": "≤ 155 caractères", "h1": "≤ 70 caractères", "firstParagraph": "40 à 60 mots" },',
    '  "notes": ["…"]',
    "}",
    "",
    `Contraintes : 6 à ${MAX_KEYWORDS} mots-clés, du plus porteur au moins porteur ; les quatre réécritures doivent intégrer les mots-clés les plus porteurs sans bourrage et rester lisibles par un humain.`,
    TITLE_SHAPE,
    "",
    PARAGRAPH_RULE,
    "",
    STYLE_RULES,
    tone
      ? `Écris ces réécritures dans la tonalité relevée sur les textes du client, qui doit se reconnaître dans les deux :\n${tone}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------- Réécritures ------------------------------- */

type Suggested = TrendingKeywordsInsight["suggested"];

/** Les mots-clés tels qu'ils sont donnés au rédacteur, emplacement compris. */
function keywordBriefing(keywords: TrendingKeyword[]): string {
  const labels: Record<KeywordPlacement, string> = {
    title: "title",
    metaDescription: "meta description",
    h1: "H1",
  };
  return keywords
    .map(
      (k, i) =>
        `${i + 1}. « ${k.keyword} » — intention : ${k.intent} — à placer dans : ${k.placements
          .map((p) => labels[p])
          .join(", ")}`,
    )
    .join("\n");
}

function buildRewritePrompt(
  profile: BusinessProfile,
  signals: SiteSignals,
  keywords: TrendingKeyword[],
  tone: string | null,
): string {
  const city = profile.location
    ? `Zone : ${profile.location}.`
    : "Activité en ligne, sans zone géographique.";
  return [
    "Tu réécris quatre éléments on-page d'une page d'accueil. Tu ne cherches rien sur le web et tu n'inventes aucun fait : tu ne travailles qu'avec ce qui suit.",
    `Niche : « ${profile.niche} ». Catégorie large : « ${profile.generalCategory} ». ${city}`,
    `Site : ${signals.url}`,
    `Title actuel : ${signals.title ?? "(absent)"}`,
    `Meta description actuelle : ${signals.metaDescription ?? "(absente)"}`,
    `H1 actuel : ${signals.h1[0] ?? "(absent)"}`,
    `Premier paragraphe actuel : ${signals.firstParagraph ?? "(absent)"}`,
    "",
    "Mots-clés relevés sur la niche ce mois-ci, par ordre de valeur :",
    keywordBriefing(keywords),
    "",
    "Place ces mots-clés dans les réécritures, à l'emplacement indiqué pour chacun :",
    "- écris-les mot pour mot ; seuls l'accord en nombre et la majuscule initiale peuvent changer (« parfum sans alcool » → « parfums sans alcool » : accepté ; « fragrances sans alcool » : refusé, le mot-clé a disparu) ;",
    "- le H1 porte le mot-clé n° 1 en toutes lettres ;",
    "- la meta description en porte deux ou trois ;",
    "- le premier paragraphe en porte trois ou plus, répartis dans les phrases ;",
    "- jamais deux fois le même mot-clé dans un même élément, et aucune énumération de mots-clés collés les uns aux autres.",
    "",
    TITLE_SHAPE,
    "« metaDescription » : 155 caractères au plus. « h1 » : 70 caractères au plus. « firstParagraph » : 40 à 60 mots.",
    "",
    PARAGRAPH_RULE,
    "",
    STYLE_RULES,
    tone
      ? `Tonalité relevée sur les textes du client, à laquelle les quatre réécritures se tiennent :\n${tone}`
      : "",
    "",
    "Réponds UNIQUEMENT par un objet JSON, en français, sans commentaire :",
    '{ "brandName": "nom exact de l\'entreprise tel qu\'il apparaît sur le site", "title": "…", "metaDescription": "…", "h1": "…", "firstParagraph": "…" }',
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Réécrit les quatre éléments avec GPT-4o mini, la liste de mots-clés en main.
 *
 * La recherche des mots-clés reste chez Gemini, seul à voir les requêtes du
 * moment ; la rédaction part chez OpenAI, à qui l'on donne la liste déjà
 * arrêtée. Séparer les deux étapes rend la consigne exécutable : un modèle qui
 * découvre les mots-clés et rédige dans le même souffle place ce qu'il vient
 * d'inventer, pas ce que la liste affichée au client annonce.
 *
 * `null` si la clé manque ou si la réponse est inexploitable : l'appelant garde
 * alors les réécritures de Gemini.
 */
async function rewriteWithOpenAI(
  profile: BusinessProfile,
  signals: SiteSignals,
  keywords: TrendingKeyword[],
  tone: string | null,
): Promise<Suggested | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    geoLog("Réécritures on-page — ignoré (pas de clé OPENAI_API_KEY)");
    return null;
  }

  const model = process.env.OPENAI_REWRITE_MODEL || "gpt-4o-mini";
  geoLog(`Réécritures on-page — appel OpenAI (${model})…`, {
    motsClés: keywords.map((k) => k.keyword),
  });
  try {
    const data = (await postJson(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: buildRewritePrompt(profile, signals, keywords, tone),
            },
          ],
        }),
      },
      "OpenAI réécritures",
    )) as Record<string, unknown>;

    const choices = (data.choices as Array<Record<string, unknown>>) ?? [];
    const text = ((choices[0]?.message as Record<string, unknown>)?.content as string) ?? "";
    const json = extractJson(text);
    if (!json) {
      geoLog("Réécritures on-page — réponse illisible", text.slice(0, 300));
      return null;
    }

    const title = clean(json.title, 120);
    const metaDescription = clean(json.metaDescription, 220);
    const h1 = clean(json.h1, 120);
    const firstParagraph = clean(json.firstParagraph, 700);
    if (!title || !metaDescription || !h1 || !firstParagraph) {
      geoLog("Réécritures on-page — réponse incomplète", json);
      return null;
    }

    const brand = clean(json.brandName, 60) || brandFromSignals(signals);
    const suggested: Suggested = {
      title: ensureBrandFirst(title, brand),
      metaDescription,
      h1,
      firstParagraph,
    };
    geoLog("Réécritures on-page — résultat", { marque: brand, ...suggested });
    return suggested;
  } catch (err) {
    geoLog("Réécritures on-page — échec", String(err));
    return null;
  }
}

/** Le nom de l'enseigne, à défaut de réponse du modèle : premier segment du title. */
function brandFromSignals(signals: SiteSignals): string {
  return signals.title?.split(/[|·–—]/)[0].trim() || signals.domain;
}

/**
 * Remet le nom de l'entreprise en tête du title.
 *
 * Le modèle respecte la consigne la plupart du temps, mais pas toujours : quand
 * il range la marque en fin de ligne, on déplace le segment plutôt que de jeter
 * une réécriture par ailleurs bonne.
 */
function ensureBrandFirst(title: string, brand: string): string {
  if (!brand) return title;

  const key = foldCase(brand);
  if (foldCase(title).startsWith(key)) return title;

  const segments = title
    .split(/\s*[|·–—]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const brandIndex = segments.findIndex((s) => foldCase(s).includes(key));
  if (brandIndex === -1) return `${brand} | ${title}`;

  const [brandSegment] = segments.splice(brandIndex, 1);
  return [brandSegment, ...segments].join(" | ");
}

function foldCase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Interroge Gemini (grounding Google Search) pour les mots-clés tendances.
 * Renvoie `null` si la clé manque ou si la réponse est inexploitable :
 * l'appelant retombe alors sur `fallbackTrendingKeywords`.
 */
export async function fetchTrendingKeywords(
  profile: BusinessProfile,
  signals: SiteSignals,
  /** Le ton relevé à l'accueil, quand il existe : les réécritures s'y tiennent. */
  tone: string | null = null,
): Promise<TrendingKeywordsInsight | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    geoLog("Mots-clés tendances — ignoré (pas de clé GEMINI_API_KEY)");
    return null;
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  geoLog(`Mots-clés tendances — appel Gemini (${model}, google_search)…`, {
    tonalitéTransmise: Boolean(tone),
  });
  try {
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(profile, signals, tone) }] }],
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
    const brand = brandFromSignals(signals);
    const fromGemini: Suggested = {
      title: ensureBrandFirst(clean(suggested.title, 120) || fb.suggested.title, brand),
      metaDescription: clean(suggested.metaDescription, 220) || fb.suggested.metaDescription,
      h1: clean(suggested.h1, 120) || fb.suggested.h1,
      firstParagraph: clean(suggested.firstParagraph, 700) || fb.suggested.firstParagraph,
    };

    // Les réécritures repartent chez GPT-4o mini avec la liste de mots-clés
    // arrêtée ci-dessus : c'est elle que le tableau de bord affiche, donc c'est
    // elle que le rédacteur doit avoir sous les yeux. Gemini garde la main si
    // l'appel échoue ou si la clé OpenAI manque.
    const rewritten = await rewriteWithOpenAI(profile, signals, keywords, tone);

    const insight: TrendingKeywordsInsight = {
      measured: true,
      source: "gemini",
      period: clean(json.period, 40) || currentPeriod(),
      keywords,
      suggested: rewritten ?? fromGemini,
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
