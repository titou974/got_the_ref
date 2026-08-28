import "server-only";

import { unstable_cache } from "next/cache";
import {
  isDataForSeoConfigured,
  DataForSeoError,
} from "@/lib/dataforseo/client";
import {
  locationCodeOf,
  searchLlmMentions,
  type LlmMentionItem,
} from "@/lib/dataforseo/llm-mentions";

/**
 * Les mentions du commerce dans les IA, rangées par modèle.
 *
 * La question posée par le client est simple — « combien de fois chaque IA me
 * cite ? » — et la réponse tient dans un décompte par `model_name` : DataForSEO
 * rend une ligne par réponse d'IA où son domaine apparaît, et chaque ligne dit
 * quel modèle l'a écrite. On compte donc les lignes, modèle par modèle.
 *
 * Deux chiffres accompagnent chaque barre, parce qu'ils ne disent pas la même
 * chose : le nombre de mentions (combien de réponses différentes vous citent)
 * et le volume de recherche cumulé (combien de fois par mois ces questions-là
 * sont posées). Dix mentions sur des questions que personne ne pose valent
 * moins qu'une seule sur la question centrale du métier.
 */

/** Le relevé est facturé à l'appel : une fois par jour et par domaine suffit. */
const CACHE_SECONDS = 60 * 60 * 24;

export type LlmModelMentions = {
  /** Le `model_name` brut renvoyé par l'API, ex. « google_ai_overview ». */
  id: string;
  /** La plateforme : « google » ou « chat_gpt ». */
  platform: string;
  label: string;
  /** Logo servi depuis `public/`. */
  logo: string;
  /** Nombre de réponses d'IA distinctes où le domaine est cité. */
  mentions: number;
  /** Volume de recherche mensuel cumulé des questions concernées. */
  searchVolume: number;
  /** La question la plus demandée où le commerce apparaît. */
  topQuestion: string | null;
};

export type LlmMentionsReport = {
  domain: string;
  /** Total des mentions, pages non lues comprises. */
  totalMentions: number;
  /** Vrai quand l'archive dépasse ce que le relevé a ramené. */
  truncated: boolean;
  models: LlmModelMentions[];
  fetchedAt: string;
};

/**
 * Ce qu'on sait nommer, et sous quel logo.
 *
 * La liste des modèles n'est pas figée chez DataForSEO : ChatGPT change de
 * version sans prévenir, et un `model_name` inconnu doit rester affichable.
 * D'où la reconnaissance par préfixe puis le repli sur le nom brut embelli —
 * une barre étiquetée « gpt-5.2 » vaut mieux qu'une barre disparue.
 */
const KNOWN_MODELS: {
  match: (model: string, platform: string) => boolean;
  label: (model: string) => string;
  logo: string;
}[] = [
  {
    match: (model) => model === "google_ai_overview",
    label: () => "Aperçus IA de Google",
    logo: "/gemini.webp",
  },
  {
    match: (model) => model.startsWith("gemini"),
    label: (model) => `Gemini ${model.replace(/^gemini[-_]?/, "")}`.trim(),
    logo: "/gemini.webp",
  },
  {
    match: (model, platform) => platform === "chat_gpt" || model.startsWith("gpt"),
    label: (model) => `ChatGPT ${model}`,
    logo: "/chatgpt.png",
  },
  {
    match: (model) => model.startsWith("claude"),
    label: (model) => `Claude ${model.replace(/^claude[-_]?/, "")}`.trim(),
    logo: "/claude.svg",
  },
  {
    match: (model) => model.startsWith("perplexity") || model.startsWith("sonar"),
    label: (model) => `Perplexity ${model}`,
    logo: "/perplexity.png",
  },
];

function describeModel(model: string, platform: string) {
  const known = KNOWN_MODELS.find((entry) => entry.match(model, platform));
  if (known) return { label: known.label(model), logo: known.logo };

  // Repli : « gpt-4o-mini » devient « Gpt 4o mini », lisible sans être inventé.
  const pretty = model.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { label: pretty, logo: "/chatgpt.png" };
}

/** Regroupe les réponses par modèle, la plus citée en tête. */
export function groupByModel(items: LlmMentionItem[]): LlmModelMentions[] {
  const byModel = new Map<string, LlmModelMentions>();
  /** Le volume de la question retenue, gardé à part : il ne sort pas d'ici. */
  const topVolumes = new Map<string, number>();

  for (const item of items) {
    const model = item.model_name || item.platform || "inconnu";
    const platform = item.platform || "";
    const volume = item.ai_search_volume ?? 0;

    let current = byModel.get(model);
    if (!current) {
      const { label, logo } = describeModel(model, platform);
      current = {
        id: model,
        platform,
        label,
        logo,
        mentions: 0,
        searchVolume: 0,
        topQuestion: null,
      };
      byModel.set(model, current);
      topVolumes.set(model, -1);
    }

    current.mentions += 1;
    current.searchVolume += volume;
    if (volume > (topVolumes.get(model) ?? -1)) {
      topVolumes.set(model, volume);
      current.topQuestion = item.question || null;
    }
  }

  return [...byModel.values()].sort((a, b) => b.mentions - a.mentions);
}

/**
 * Le relevé complet d'un domaine, mémorisé une journée.
 *
 * `null` a trois causes possibles — pas d'identifiants, pas de domaine, appel
 * en échec — et la carte les traite pareil : elle montre l'exemple plutôt qu'un
 * graphique vide. Une panne DataForSEO ne doit pas emporter l'accueil du
 * tableau de bord avec elle, d'où l'erreur avalée après journalisation.
 */
export async function fetchLlmMentions(
  domain: string | null,
  country?: string | null,
): Promise<LlmMentionsReport | null> {
  if (!domain || !isDataForSeoConfigured()) return null;

  const clean = domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!clean) return null;

  const locationCode = locationCodeOf(country);

  const load = unstable_cache(
    async () => {
      const page = await searchLlmMentions({ domain: clean, locationCode });
      return {
        domain: clean,
        totalMentions: page.totalCount,
        truncated: page.truncated,
        models: groupByModel(page.items),
        fetchedAt: new Date().toISOString(),
      } satisfies LlmMentionsReport;
    },
    ["llm-mentions", clean, String(locationCode)],
    { revalidate: CACHE_SECONDS, tags: [`llm-mentions:${clean}`] },
  );

  try {
    return await load();
  } catch (error) {
    const detail =
      error instanceof DataForSeoError
        ? `${error.statusCode} — ${error.message}`
        : String(error);
    console.error(`[llm-mentions] relevé impossible pour ${clean} : ${detail}`);
    return null;
  }
}
