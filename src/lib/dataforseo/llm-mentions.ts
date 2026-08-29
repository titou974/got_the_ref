import "server-only";

import { dataForSeoLive } from "./client";

/**
 * Les mentions du commerce dans les réponses des modèles, relevées par
 * DataForSEO (« AI Optimization » → « LLM Mentions » → `search_mentions`).
 *
 * Le principe du jeu de données : DataForSEO rejoue en continu des millions de
 * questions grand public sur ChatGPT et sur les aperçus IA de Google, puis
 * garde la réponse entière — le texte, ses sources, son volume de recherche. On
 * interroge cette archive avec un domaine pour cible, et chaque ligne rendue est
 * une réponse d'IA où le commerce apparaît. Compter ces lignes par modèle donne
 * exactement ce que le tableau de bord montre : « combien de fois ChatGPT vous
 * cite, combien de fois l'aperçu IA de Google vous cite ».
 *
 * C'est une mesure d'archive, pas une interrogation en direct : elle dit ce que
 * les modèles ont répondu à d'autres, ce qu'aucun relevé fait au nom du client
 * ne peut montrer.
 *
 * https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live/
 */

const PATH = "/v3/ai_optimization/llm_mentions/search_mentions/live";

const HISTORY_PATH = "/v3/ai_optimization/llm_mentions/historical/live";

/**
 * Le premier jour couvert par l'archive DataForSEO. Toute date antérieure est
 * refusée : la collecte a commencé là.
 */
const ARCHIVE_START = "2025-08-01";

/** Le maximum accepté par l'API pour un appel. */
const PAGE_SIZE = 1000;

/**
 * Le nombre d'appels au plus par relevé.
 *
 * Chaque page est facturée. Trois pages couvrent 3 000 réponses, largement de
 * quoi couvrir un commerce local ; au-delà, le total exact reste lu dans
 * `total_count` et l'interface le signale comme un décompte partiel plutôt que
 * de continuer à payer pour affiner un graphique déjà lisible.
 */
const MAX_PAGES = 3;

/** France par défaut : c'est le marché de tous les commerces suivis ici. */
export const DEFAULT_LOCATION_CODE = 2250;
export const DEFAULT_LANGUAGE_CODE = "fr";

/** Les pays où les clients peuvent vendre, tels que l'accueil les détecte. */
const LOCATION_CODES: Record<string, number> = {
  fr: 2250,
  be: 2056,
  ch: 2756,
  ca: 2124,
  lu: 2442,
  us: 2840,
  gb: 2826,
  uk: 2826,
  es: 2724,
  it: 2380,
  de: 2276,
};

/** Le code de localisation DataForSEO d'un pays ISO, France à défaut. */
export function locationCodeOf(country: string | null | undefined): number {
  if (!country) return DEFAULT_LOCATION_CODE;
  return LOCATION_CODES[country.trim().toLowerCase()] ?? DEFAULT_LOCATION_CODE;
}

export type LlmMentionSource = {
  rank: number;
  title: string | null;
  url: string;
  domain: string;
};

/** Une réponse d'IA où le domaine cible apparaît. */
export type LlmMentionItem = {
  /** « google » ou « chat_gpt ». */
  platform: string;
  /** Le modèle exact, ex. « google_ai_overview », « gpt-4o ». */
  model_name: string;
  location_code: number;
  language_code: string;
  question: string;
  answer: string | null;
  sources: LlmMentionSource[] | null;
  /** Combien de fois la question est posée aux IA chaque mois. */
  ai_search_volume: number | null;
  first_response_at: string | null;
  last_response_at: string | null;
};

type SearchMentionsResult = {
  total_count: number;
  items_count: number;
  search_after_token: string | null;
  items: LlmMentionItem[] | null;
};

export type LlmMentionsPage = {
  items: LlmMentionItem[];
  /** Le nombre de réponses correspondant à la cible, pages non lues comprises. */
  totalCount: number;
  /** Vrai si l'archive contient plus de réponses que celles ramenées ici. */
  truncated: boolean;
};

/**
 * Toutes les mentions d'un domaine, pages rassemblées.
 *
 * `include_subdomains` est actif : un commerce qui héberge sa boutique sur
 * `shop.exemple.fr` compte pour le même établissement. La pagination passe par
 * `search_after_token` plutôt que par `offset` — c'est la voie recommandée
 * au-delà du premier millier, et la seule qui reste stable entre deux pages.
 */
export async function searchLlmMentions({
  domain,
  locationCode = DEFAULT_LOCATION_CODE,
  languageCode = DEFAULT_LANGUAGE_CODE,
  maxPages = MAX_PAGES,
}: {
  domain: string;
  locationCode?: number;
  languageCode?: string;
  maxPages?: number;
}): Promise<LlmMentionsPage> {
  const items: LlmMentionItem[] = [];
  let totalCount = 0;
  let token: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const task: Record<string, unknown> = {
      target: [{ domain, include_subdomains: true }],
      location_code: locationCode,
      language_code: languageCode,
      // Les plus demandées d'abord : si l'archive déborde du plafond de pages,
      // ce qui est gardé est ce qui pèse le plus dans la visibilité réelle.
      order_by: ["ai_search_volume,desc"],
      limit: PAGE_SIZE,
    };
    if (token) task.search_after_token = token;

    const results = await dataForSeoLive<SearchMentionsResult>(PATH, task);
    const result = results[0];
    if (!result) break;

    totalCount = result.total_count ?? totalCount;
    items.push(...(result.items ?? []));

    token = result.search_after_token ?? null;
    if (!token || (result.items?.length ?? 0) < PAGE_SIZE) break;
  }

  return {
    items,
    totalCount: Math.max(totalCount, items.length),
    truncated: totalCount > items.length,
  };
}

/**
 * L'historique mensuel, mois calendaire par mois calendaire.
 *
 * `historical` et non `timeseries_delta` : le second ne rend que `delta_mentions`,
 * l'écart avec la période précédente, quand la carte a besoin du nombre. L'écart,
 * lui, se recalcule d'une soustraction une fois les niveaux connus — un appel
 * facturé de moins pour la même information.
 *
 * https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/historical/live/
 */

type HistoryItem = {
  year: number;
  month: number;
  /** Selon les versions, les compteurs sont imbriqués ou posés à plat. */
  metrics?: { mentions?: number | null; ai_search_volume?: number | null } | null;
  mentions?: number | null;
  ai_search_volume?: number | null;
};

type HistoryResult = {
  items: HistoryItem[] | null;
};

export type MonthlyMentions = {
  /** Premier jour du mois, « 2026-08-01 » : trie et s'affiche sans ambiguïté. */
  month: string;
  mentions: number;
  searchVolume: number;
};

/** Le premier jour du mois, `n` mois en arrière, au format attendu par l'API. */
function monthStart(date: Date, monthsBack = 0): string {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1),
  );
  return start.toISOString().slice(0, 10);
}

/**
 * Les douze derniers mois de mentions d'une marque.
 *
 * La cible est le nom de la marque en mot-clé, pas le domaine : une IA qui
 * conseille le commerce le nomme bien plus souvent qu'elle ne cite son site.
 *
 * ChatGPT n'a d'historique qu'aux États-Unis et en anglais chez DataForSEO :
 * ailleurs, la plateforme est fixée à Google, sans quoi la requête reviendrait
 * vide. Sur ce marché-là, en revanche, les deux plateformes répondent et les
 * mois sont additionnés — deux lignes pour un même mois valent une somme, pas
 * un doublon.
 *
 * Les mois sans mention ne reviennent pas de l'API : ils sont rétablis à zéro,
 * sans quoi l'axe sauterait de juin à septembre et la courbe mentirait sur
 * l'allure.
 */
export async function fetchBrandHistory({
  brand,
  locationCode = DEFAULT_LOCATION_CODE,
  languageCode = DEFAULT_LANGUAGE_CODE,
  months = 12,
  now = new Date(),
}: {
  brand: string;
  locationCode?: number;
  languageCode?: string;
  months?: number;
  now?: Date;
}): Promise<MonthlyMentions[]> {
  const requested = monthStart(now, months - 1);
  const dateFrom = requested < ARCHIVE_START ? ARCHIVE_START : requested;

  const usEnglish = locationCode === 2840 && languageCode === "en";

  const task: Record<string, unknown> = {
    target: [{ keyword: brand.slice(0, 250) }],
    location_code: locationCode,
    language_code: languageCode,
    date_from: dateFrom,
    date_to: now.toISOString().slice(0, 10),
  };
  // Hors États-Unis, seul Google a un historique : le demander explicitement
  // évite une réponse vide où l'on croirait à une marque jamais citée.
  if (!usEnglish) task.platform = "google";

  const results = await dataForSeoLive<HistoryResult>(HISTORY_PATH, task);
  const items = results[0]?.items ?? [];

  const byMonth = new Map<string, MonthlyMentions>();
  for (const item of items) {
    if (!item?.year || !item?.month) continue;
    const key = `${item.year}-${String(item.month).padStart(2, "0")}-01`;
    const mentions = item.metrics?.mentions ?? item.mentions ?? 0;
    const volume = item.metrics?.ai_search_volume ?? item.ai_search_volume ?? 0;

    const current = byMonth.get(key) ?? { month: key, mentions: 0, searchVolume: 0 };
    current.mentions += mentions;
    current.searchVolume += volume;
    byMonth.set(key, current);
  }

  // L'axe complet, du premier mois couvert jusqu'au mois en cours.
  const series: MonthlyMentions[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    series.push(byMonth.get(key) ?? { month: key, mentions: 0, searchVolume: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return series.slice(-months);
}
