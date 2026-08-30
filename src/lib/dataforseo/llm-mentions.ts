import "server-only";

import { dataForSeoLive } from "./client";

/**
 * L'évolution des mentions du commerce dans les IA, relevée par DataForSEO
 * (« AI Optimization » → « LLM Mentions » → `timeseries_delta`).
 *
 * Le principe du jeu de données : DataForSEO rejoue en continu des millions de
 * questions grand public sur ChatGPT et sur les aperçus IA de Google, puis
 * garde la réponse entière — le texte, ses sources, son volume de recherche. On
 * interroge cette archive avec un domaine pour cible, et la route rend, mois par
 * mois, ce que ce domaine a gagné ou perdu en citations.
 *
 * C'est cette route et elle seule qui alimente la carte. `search_mentions`, qui
 * liste les réponses une à une, a été retiré : sur un commerce local il rend le
 * plus souvent une liste vide — l'archive garde les réponses détaillées bien
 * plus parcimonieusement qu'elle ne compte les mentions — et une carte qui
 * affiche « aucune mention » alors que le mouvement mensuel existe ment sur la
 * mesure.
 *
 * C'est une mesure d'archive, pas une interrogation en direct : elle dit ce que
 * les modèles ont répondu à d'autres, ce qu'aucun relevé fait au nom du client
 * ne peut montrer.
 *
 * https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/timeseries_delta/live/
 */

const TIMESERIES_DELTA_PATH =
  "/v3/ai_optimization/llm_mentions/timeseries_delta/live";

/**
 * Le premier jour couvert par l'archive DataForSEO. Toute date antérieure est
 * refusée : la collecte a commencé là.
 */
const ARCHIVE_START = "2025-08-01";

/** La fenêtre affichée : le mois en cours et les onze qui le précèdent. */
const WINDOW_MONTHS = 12;

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
 * La liste est fermée chez DataForSEO : `platform` ne prend que `google` ou
 * `chat_gpt`. Sans ce champ, la route mélangerait les deux dans une seule
 * série — or la carte veut une case de couleur par modèle d'IA, donc un appel
 * chacun.
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
 * une boutique sur `shop.exemple.fr` étant le même établissement, et
 * `search_filter: "include"` est écrit explicitement : l'API exige qu'au moins
 * une cible le porte, et s'appuyer sur sa valeur par défaut rendrait la requête
 * fragile pour rien.
 *
 * Ce que rend l'API, c'est `delta_mentions` : l'écart avec le mois précédent,
 * pas un total. La série est donc une variation, et la carte l'écrit ainsi
 * plutôt que d'appeler « nombre de mentions » un chiffre qui n'en est pas un.
 *
 * La fenêtre glisse sur douze mois plutôt que de suivre l'année civile : en
 * janvier, cette dernière ne montrerait qu'une seule barre. Elle ne descend
 * jamais sous le premier jour de l'archive, une date antérieure étant refusée.
 *
 * Les mois absents de la réponse sont rétablis à zéro : un axe qui saute de
 * mars à juin ment sur l'allure.
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
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (WINDOW_MONTHS - 1), 1),
  )
    .toISOString()
    .slice(0, 10);
  const dateFrom = windowStart < ARCHIVE_START ? ARCHIVE_START : windowStart;
  const dateTo = now.toISOString().slice(0, 10);

  return Promise.all(
    TIMESERIES_PLATFORMS.map(async (entry) => {
      const askedLocation = entry.forcedLocation ?? locationCode;
      const askedLanguage = entry.forcedLanguage ?? languageCode;

      const results = await dataForSeoLive<DeltaResult>(TIMESERIES_DELTA_PATH, {
        target: [
          { domain, include_subdomains: true, search_filter: "include" },
        ],
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
        points.push(
          byMonth.get(key) ?? { month: key, delta: 0, deltaSearchVolume: 0 },
        );
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }

      return { platform: entry.platform, locationCode: askedLocation, points };
    }),
  );
}
