import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  isDataForSeoConfigured,
  DataForSeoError,
} from "@/lib/dataforseo/client";
import { dataForSeoLog } from "@/lib/dataforseo/log";
import {
  fetchBrandHistory,
  locationCodeOf,
  searchLlmMentions,
  type LlmMentionItem,
  type MonthlyMentions,
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
 * Le rythme du relevé : une fois par mois calendaire et par compte.
 *
 * Mensuel et non quotidien, parce que la donnée l'est : l'archive DataForSEO
 * agrège par mois, et sur douze barres onze ne bougeront plus jamais. Repayer
 * chaque jour revenait à acheter onze chiffres figés pour en rafraîchir un.
 *
 * Le mois calendaire plutôt qu'un délai de trente jours : c'est ce qui fait
 * apparaître la barre du mois neuf le 1er, et non le 12 parce que le relevé
 * précédent tombait un 12.
 *
 * Un compte qui n'a jamais été relevé n'a pas de ligne en base : sa porte est
 * donc ouverte, et le relevé part à sa première ouverture du tableau de bord.
 * C'est ce qui rattrape les clients arrivés avant cet écran — ils n'ont rien à
 * refaire, leur retour suffit.
 */

/** Le premier jour du mois d'une date, « 2026-08-01 » : la clé de comparaison. */
function monthKeyOf(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/** Le mois en cours, dans la même forme que les points de la série. */
function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

/** Le 1er du mois suivant : la date à laquelle un nouvel appel redevient possible. */
function nextMonthStart(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

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

/** Un mois de l'historique, écart avec le mois précédent compris. */
export type MonthlyMentionsPoint = MonthlyMentions & {
  /**
   * Mentions gagnées ou perdues depuis le mois précédent. Calculée ici plutôt
   * que lue chez `timeseries_delta` : une soustraction ne vaut pas un appel
   * facturé, et le premier mois de la série n'a rien à quoi se comparer.
   */
  delta: number | null;
};

export type LlmMentionsReport = {
  domain: string;
  /** Total des mentions, pages non lues comprises. */
  totalMentions: number;
  /** Vrai quand l'archive dépasse ce que le relevé a ramené. */
  truncated: boolean;
  models: LlmModelMentions[];
  /**
   * La marque suivie sur douze mois — son nom, tel qu'il est cité. Facultatifs,
   * ces deux champs : un relevé écrit en base avant l'arrivée de l'historique
   * ne les porte pas, et il doit rester lisible.
   */
  brand?: string | null;
  /** Les douze derniers mois, du plus ancien au plus récent. */
  history?: MonthlyMentionsPoint[];
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

/** Pose l'écart mois par mois sur une série de niveaux mensuels. */
export function withMonthlyDeltas(series: MonthlyMentions[]): MonthlyMentionsPoint[] {
  return series.map((point, index) => ({
    ...point,
    delta: index === 0 ? null : point.mentions - series[index - 1].mentions,
  }));
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

function parseHistory(payload: string | null): MonthlyMentionsPoint[] | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as MonthlyMentionsPoint[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Le relevé du compte, appelé au plus une fois par mois calendaire.
 *
 * Trois situations, dans cet ordre :
 *
 *   1. une tentative a déjà eu lieu ce mois-ci — on rend ce qui est en base,
 *      sans toucher à l'API, même si cette tentative avait échoué ;
 *   2. la porte est ouverte — jamais relevé, ou mois neuf — les appels partent
 *      et le résultat est écrit en base ;
 *   3. l'appel échoue — l'échec est daté lui aussi, et le relevé précédent, s'il
 *      existe, reprend l'écran. Réessayer à chaque rechargement consommerait le
 *      mois en appels perdus.
 *
 * Un compte sans ligne en base a donc la porte ouverte : les clients arrivés
 * avant cet écran sont relevés à leur première ouverture du tableau de bord,
 * sans rien avoir à refaire de leur accueil.
 *
 * La porte ne dépend que de la date : changer de domaine ne la rouvre pas,
 * sinon un aller-retour entre deux domaines suffirait à appeler sans limite.
 * Le relevé en base ne ressort alors que s'il porte sur la même question —
 * domaine et localisation identiques ; sinon la carte repasse à l'exemple, le
 * temps que le mois suivant rende l'appel possible.
 *
 * `null` — pas d'identifiants, pas de domaine, aucun relevé jamais réussi — est
 * traité par la carte comme une absence de mesure : elle montre l'exemple.
 */
export const fetchLlmMentions = cache(async function fetchLlmMentions(
  userId: string,
  domain: string | null,
  /** Le nom de la marque, cible de la courbe sur douze mois. */
  brand?: string | null,
  country?: string | null,
): Promise<LlmMentionsReport | null> {
  if (!domain) return null;

  const clean = cleanDomain(domain);
  if (!clean) return null;

  const locationCode = locationCodeOf(country);
  const brandName = brand?.trim() || null;

  // La table est le compteur : sans elle (migration pas encore poussée), on
  // s'abstient plutôt que d'appeler une API facturée sans garde-fou.
  let snapshot;
  try {
    snapshot = await prisma.llmMentionSnapshot.findUnique({ where: { userId } });
  } catch (error) {
    dataForSeoLog("✗ compteur illisible — aucun appel", {
      userId,
      erreur: String(error),
    });
    return null;
  }

  const stored = parseReport(snapshot?.payload ?? null);
  const storedHistory = parseHistory(snapshot?.historyPayload ?? null);
  const sameQuestion =
    snapshot?.domain === clean && snapshot?.locationCode === locationCode;
  // La porte se ferme pour le reste du mois dès qu'une tentative y a eu lieu.
  const nextRefreshAt = snapshot ? nextMonthStart(snapshot.attemptedAt) : null;
  const doorClosed = Boolean(
    snapshot && monthKeyOf(snapshot.attemptedAt) === currentMonthKey(),
  );

  /** Le relevé rendu à l'écran : le décompte par modèle et l'historique gardé. */
  const compose = (report: LlmMentionsReport, history: MonthlyMentionsPoint[] | null) => ({
    ...report,
    brand: snapshot?.historyBrand ?? brandName,
    history: history ?? [],
    nextRefreshAt: nextRefreshAt?.toISOString(),
  });

  if (doorClosed) {
    dataForSeoLog("⏸ relevé du mois déjà fait — lu en base, aucun appel", {
      domaine: clean,
      dernier_releve: snapshot?.fetchedAt?.toISOString() ?? "(aucun)",
      prochain_appel: nextRefreshAt?.toISOString(),
      historique_en_base: storedHistory?.length ?? 0,
    });
    return sameQuestion && stored ? compose(stored, storedHistory) : null;
  }

  if (!isDataForSeoConfigured()) {
    dataForSeoLog("⏸ identifiants absents — aucun appel");
    return sameQuestion && stored ? compose(stored, storedHistory) : null;
  }

  // L'historique garde ses colonnes à lui : quand son appel échoue, le relevé
  // du mois précédent reste affiché au lieu de laisser un graphique vide.
  const historyFresh =
    storedHistory !== null &&
    storedHistory.length > 0 &&
    snapshot?.historyBrand === brandName &&
    storedHistory.at(-1)?.month === currentMonthKey();

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
    dataForSeoLog("✗ compteur non inscriptible — aucun appel", {
      userId,
      erreur: String(error),
    });
    return null;
  }

  dataForSeoLog("▶ relevé du mois — départ", {
    domaine: clean,
    marque: brandName ?? "(aucune)",
    location_code: locationCode,
    appels_prevus: historyFresh || !brandName ? 1 : 2,
    historique: historyFresh
      ? `déjà à jour en base (${storedHistory?.length ?? 0} mois)`
      : "à relever",
    premier_releve: snapshot ? "non" : "oui — compte jamais relevé",
  });

  try {
    // L'historique a le droit d'échouer seul : une marque absente de l'archive
    // ne doit pas emporter le graphique des modèles avec elle.
    const [page, history] = await Promise.all([
      searchLlmMentions({ domain: clean, locationCode }),
      brandName && !historyFresh
        ? fetchBrandHistory({ brand: brandName, locationCode })
            .then(withMonthlyDeltas)
            .catch((error) => {
              dataForSeoLog("✗ historique impossible — on garde celui de la base", {
                marque: brandName,
                erreur: String(error),
              });
              return null;
            })
        : Promise.resolve(null),
    ]);

    const report: LlmMentionsReport = {
      domain: clean,
      totalMentions: page.totalCount,
      truncated: page.truncated,
      models: groupByModel(page.items),
      fetchedAt: new Date().toISOString(),
    };

    const freshHistory = history ?? storedHistory;

    await prisma.llmMentionSnapshot.update({
      where: { userId },
      data: {
        payload: JSON.stringify(report),
        fetchedAt: new Date(),
        lastError: null,
        // L'historique n'est réécrit que s'il vient d'être relevé : sa date de
        // fraîcheur doit rester celle de l'appel qui l'a produit.
        ...(history
          ? {
              historyBrand: brandName,
              historyPayload: JSON.stringify(history),
              historyFetchedAt: new Date(),
            }
          : {}),
      },
    });

    dataForSeoLog("✓ relevé du mois — écrit en base", {
      domaine: clean,
      mentions: report.totalMentions,
      modeles: report.models.length,
      historique_mois: freshHistory?.length ?? 0,
      historique_source: history ? "appel" : "base",
      prochain_appel: nextMonthStart(attemptedAt).toISOString(),
    });

    return {
      ...report,
      brand: brandName,
      history: freshHistory ?? [],
      nextRefreshAt: nextMonthStart(attemptedAt).toISOString(),
    };
  } catch (error) {
    const detail =
      error instanceof DataForSeoError
        ? `${error.statusCode} — ${error.message}`
        : String(error);
    dataForSeoLog("✗ relevé du mois — échoué", { domaine: clean, erreur: detail });

    await prisma.llmMentionSnapshot
      .update({ where: { userId }, data: { lastError: detail.slice(0, 500) } })
      .catch(() => undefined);

    // Le relevé du mois passé vaut mieux qu'une carte d'exemple : il a été mesuré.
    return sameQuestion && stored
      ? {
          ...stored,
          brand: snapshot?.historyBrand ?? brandName,
          history: storedHistory ?? [],
          nextRefreshAt: nextMonthStart(attemptedAt).toISOString(),
        }
      : null;
  }
});
