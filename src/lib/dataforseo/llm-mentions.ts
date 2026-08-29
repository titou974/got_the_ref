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

const TIMESERIES_DELTA_PATH =
  "/v3/ai_optimization/llm_mentions/timeseries_delta/live";

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
 * L'évolution mensuelle, plateforme par plateforme, depuis le début de l'année.
 */

type DeltaItem = {
  /** Premier jour de la période, « 2026-03-01 » en regroupement mensuel. */
  date: string;
  delta_mentions: number | null;
  delta_ai_search_volume: number | null;
};

type DeltaResult = {
  items: DeltaItem[] | null;
};

/** Un mois d'une série : ce que la plateforme a gagné ou perdu ce mois-là. */
export type MonthlyDelta = {
  /** Premier jour du mois, « 2026-08-01 » : trie et s'affiche sans ambiguïté. */
  month: string;
  /** Écart de mentions avec le mois précédent, tel que l'API le rend. */
  delta: number;
  /** Écart du volume de recherche IA, même période. */
  deltaSearchVolume: number;
};

/** Une plateforme suivie et sa série mensuelle. */
export type PlatformSeries = {
  /** « google » ou « chat_gpt », tels que DataForSEO les nomme. */
  platform: string;
  /** La localisation réellement interrogée pour cette plateforme. */
  locationCode: number;
  points: MonthlyDelta[];
};

/**
 * Les plateformes interrogées, et ce que DataForSEO accepte pour chacune.
 *
 * ChatGPT n'est historisé qu'aux États-Unis et en anglais : lui envoyer la
 * localisation du client reviendrait à demander une série qui n'existe pas, et
 * à lire le vide comme une absence de mentions. Sa case est donc toujours
 * relevée sur l'archive américaine, ce que la carte annonce.
 */
export const TIMESERIES_PLATFORMS = [
  { platform: "google", forcedLocation: null, forcedLanguage: null },
  { platform: "chat_gpt", forcedLocation: 2840, forcedLanguage: "en" },
] as const;

/**
 * L'évolution mensuelle des mentions d'un domaine, une série par plateforme.
 *
 * La cible est le domaine seul — aucun mot-clé : c'est le site du commerce que
 * l'on suit, pas l'orthographe de son nom. `include_subdomains` reste actif,
 * une boutique sur `shop.exemple.fr` étant le même établissement.
 *
 * Ce que rend l'API, c'est `delta_mentions` : l'écart avec le mois précédent,
 * pas un total. La série est donc une variation, et la carte l'écrit ainsi
 * plutôt que d'appeler « nombre de mentions » un chiffre qui n'en est pas un.
 *
 * Un appel par plateforme, parce que `platform` ne prend qu'une valeur par
 * requête et que la carte veut une case par modèle d'IA. Les mois absents de la
 * réponse sont rétablis à zéro : un axe qui saute de mars à juin ment sur
 * l'allure.
 *
 * https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/timeseries_delta/live/
 */
export async function fetchDomainTimeseries({
  domain,
  locationCode = DEFAULT_LOCATION_CODE,
  languageCode = DEFAULT_LANGUAGE_CODE,
  now = new Date(),
}: {
  domain: string;
  locationCode?: number;
  languageCode?: string;
  now?: Date;
}): Promise<PlatformSeries[]> {
  // Depuis le 1er janvier de l'année en cours, sans descendre sous le premier
  // jour couvert par l'archive.
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    .toISOString()
    .slice(0, 10);
  const dateFrom = yearStart < ARCHIVE_START ? ARCHIVE_START : yearStart;
  const dateTo = now.toISOString().slice(0, 10);

  const series = await Promise.all(
    TIMESERIES_PLATFORMS.map(async (entry) => {
      const askedLocation = entry.forcedLocation ?? locationCode;
      const askedLanguage = entry.forcedLanguage ?? languageCode;

      const results = await dataForSeoLive<DeltaResult>(TIMESERIES_DELTA_PATH, {
        target: [{ domain, include_subdomains: true }],
        location_code: askedLocation,
        language_code: askedLanguage,
        platform: entry.platform,
        date_from: dateFrom,
        date_to: dateTo,
        group_range: "month",
      });

      const byMonth = new Map<string, MonthlyDelta>();
      for (const item of results[0]?.items ?? []) {
        if (!item?.date) continue;
        const key = item.date.slice(0, 8) + "01";
        const current = byMonth.get(key) ?? {
          month: key,
          delta: 0,
          deltaSearchVolume: 0,
        };
        current.delta += item.delta_mentions ?? 0;
        current.deltaSearchVolume += item.delta_ai_search_volume ?? 0;
        byMonth.set(key, current);
      }

      const points: MonthlyDelta[] = [];
      const cursor = new Date(`${dateFrom}T00:00:00Z`);
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      while (cursor <= last) {
        const key = cursor.toISOString().slice(0, 10);
        points.push(byMonth.get(key) ?? { month: key, delta: 0, deltaSearchVolume: 0 });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }

      return { platform: entry.platform, locationCode: askedLocation, points };
    }),
  );

  return series;
}
