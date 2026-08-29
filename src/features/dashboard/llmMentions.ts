import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
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

/**
 * Le délai entre deux appels DataForSEO pour un même compte.
 *
 * Chaque appel est facturé et l'accueil du tableau de bord est rouvert plusieurs
 * fois par jour : la règle est donc « un relevé par client et par jour », tenue
 * en base (`LlmMentionSnapshot`) et non par un cache. Un cache s'évapore à
 * chaque déploiement — la facture, elle, resterait.
 */
export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
  /**
   * Quand le prochain appel deviendra possible. Écrit dans la carte : le client
   * doit savoir que le chiffre est daté et jusqu'à quand il le restera.
   */
  nextRefreshAt?: string;
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

/** Le domaine tel qu'on l'envoie à DataForSEO : sans protocole, sans www, sans chemin. */
function cleanDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function parseReport(payload: string | null): LlmMentionsReport | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as LlmMentionsReport;
  } catch {
    // Une ligne illisible vaut une absence de relevé — mais elle ne rouvre pas
    // le droit d'appel pour autant : `attemptedAt` reste la seule porte.
    return null;
  }
}

/**
 * Le relevé du compte, appelé au plus une fois par jour.
 *
 * Trois situations, dans cet ordre :
 *
 *   1. la dernière tentative a moins de 24 h — on rend ce qui est en base, sans
 *      toucher à l'API, même si cette tentative avait échoué ;
 *   2. la porte est ouverte — un appel part, le résultat est écrit en base ;
 *   3. l'appel échoue — l'échec est daté lui aussi, et le relevé précédent, s'il
 *      existe, reprend l'écran. Réessayer à chaque rechargement consommerait la
 *      journée en appels perdus.
 *
 * La porte ne dépend que de la date : changer de domaine ne la rouvre pas,
 * sinon un aller-retour entre deux domaines suffirait à appeler sans limite.
 * Le relevé en base ne ressort alors que s'il porte sur la même question —
 * domaine et localisation identiques ; sinon la carte repasse à l'exemple, le
 * temps que le lendemain rende l'appel possible.
 *
 * `null` — pas d'identifiants, pas de domaine, aucun relevé jamais réussi — est
 * traité par la carte comme une absence de mesure : elle montre l'exemple.
 */
export const fetchLlmMentions = cache(async function fetchLlmMentions(
  userId: string,
  domain: string | null,
  country?: string | null,
): Promise<LlmMentionsReport | null> {
  if (!domain) return null;

  const clean = cleanDomain(domain);
  if (!clean) return null;

  const locationCode = locationCodeOf(country);

  // La table est le compteur : sans elle (migration pas encore poussée), on
  // s'abstient plutôt que d'appeler une API facturée sans garde-fou.
  let snapshot;
  try {
    snapshot = await prisma.llmMentionSnapshot.findUnique({ where: { userId } });
  } catch (error) {
    console.error(`[llm-mentions] compteur illisible pour ${userId} : ${String(error)}`);
    return null;
  }

  const stored = parseReport(snapshot?.payload ?? null);
  const sameQuestion =
    snapshot?.domain === clean && snapshot?.locationCode === locationCode;
  const nextRefreshAt = snapshot
    ? new Date(snapshot.attemptedAt.getTime() + REFRESH_INTERVAL_MS)
    : null;
  const doorClosed = Boolean(nextRefreshAt && nextRefreshAt.getTime() > Date.now());

  if (doorClosed) {
    return sameQuestion && stored
      ? { ...stored, nextRefreshAt: nextRefreshAt?.toISOString() }
      : null;
  }

  if (!isDataForSeoConfigured()) return sameQuestion ? stored : null;

  // La tentative est datée avant l'appel : une requête qui n'aboutit jamais
  // (temps mort, instance recyclée) ne doit pas rouvrir la porte au rechargement
  // suivant. DataForSEO facture la requête partie, pas la réponse rendue.
  const attemptedAt = new Date();
  try {
    await prisma.llmMentionSnapshot.upsert({
      where: { userId },
      create: { userId, domain: clean, locationCode, attemptedAt },
      update: { domain: clean, locationCode, attemptedAt },
    });
  } catch (error) {
    console.error(`[llm-mentions] compteur non inscriptible pour ${userId} : ${String(error)}`);
    return null;
  }

  try {
    const page = await searchLlmMentions({ domain: clean, locationCode });
    const report: LlmMentionsReport = {
      domain: clean,
      totalMentions: page.totalCount,
      truncated: page.truncated,
      models: groupByModel(page.items),
      fetchedAt: new Date().toISOString(),
    };

    await prisma.llmMentionSnapshot.update({
      where: { userId },
      data: {
        payload: JSON.stringify(report),
        fetchedAt: new Date(),
        lastError: null,
      },
    });

    return {
      ...report,
      nextRefreshAt: new Date(attemptedAt.getTime() + REFRESH_INTERVAL_MS).toISOString(),
    };
  } catch (error) {
    const detail =
      error instanceof DataForSeoError
        ? `${error.statusCode} — ${error.message}`
        : String(error);
    console.error(`[llm-mentions] relevé impossible pour ${clean} : ${detail}`);

    await prisma.llmMentionSnapshot
      .update({ where: { userId }, data: { lastError: detail.slice(0, 500) } })
      .catch(() => undefined);

    // Le relevé de la veille vaut mieux qu'une carte d'exemple : il a été mesuré.
    return sameQuestion && stored
      ? {
          ...stored,
          nextRefreshAt: new Date(attemptedAt.getTime() + REFRESH_INTERVAL_MS).toISOString(),
        }
      : null;
  }
});
