import "server-only";

import { prisma } from "@/lib/prisma";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import {
  DASHBOARD_ENGINES,
  type AiEngine,
  type CategoryKey,
  type GeoAnalysisResult,
} from "@/lib/geo/types";
import { startOfDay } from "./queries";

/**
 * La mémoire de l'analyse : ce qui permet de dire « voilà ce qui a bougé ».
 *
 * L'analyse d'un compte est réécrite sur place à chaque reprise — l'identifiant
 * reste stable, rien ne pointe vers un rapport orphelin. Sans trace écrite
 * ailleurs, la reprise effacerait donc exactement ce qu'elle sert à montrer.
 * Une ligne `AnalysisSnapshot` est posée à chaque version, la première comprise :
 * la comparaison se fait entre les deux dernières, et l'écart depuis le premier
 * jour se lit sur la plus ancienne.
 */

/** Un correctif réduit à ce qui permet de le reconnaître d'une reprise à l'autre. */
export type SnapshotRecommendation = {
  title: string;
  category: string;
  priority: string;
  impact: number;
};

/** Ce qu'un moteur valait au moment de la mesure : sa note, et le rang relevé. */
export type SnapshotEngine = {
  score: number;
  /** Rang sur la requête directe. `null` quand le commerce est hors classement. */
  position: number | null;
};

export type AnalysisSnapshot = {
  id: string;
  createdAt: Date;
  overallScore: number;
  architectureScore: number;
  contentScore: number;
  categories: Partial<Record<CategoryKey, number>>;
  engines: Partial<Record<AiEngine, SnapshotEngine>>;
  recommendations: SnapshotRecommendation[];
  reason: string;
};

/** L'écart d'une note entre deux relevés. */
export type ScoreDelta = {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
};

/** Ce qu'un moteur a gagné ou perdu depuis la mesure précédente. */
export type EngineProgress = {
  engine: AiEngine;
  before: number;
  after: number;
  delta: number;
  positionBefore: number | null;
  positionAfter: number | null;
};

export type AnalysisProgress = {
  /** La reprise la plus récente : celle que le tableau de bord affiche. */
  current: AnalysisSnapshot;
  /** La version d'avant. Absente à la toute première analyse. */
  previous: AnalysisSnapshot;
  /** La toute première mesure du compte, pour l'écart « depuis le début ». */
  first: AnalysisSnapshot;
  overall: ScoreDelta;
  sinceStart: ScoreDelta;
  /** Un moteur par carte : ChatGPT, Gemini, Perplexity, Claude. */
  engines: EngineProgress[];
};

function parseCategories(raw: string): Partial<Record<CategoryKey, number>> {
  try {
    return JSON.parse(raw) as Partial<Record<CategoryKey, number>>;
  } catch {
    return {};
  }
}

function parseEngines(raw: string | null): Partial<Record<AiEngine, SnapshotEngine>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<Record<AiEngine, SnapshotEngine>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseRecommendations(raw: string): SnapshotRecommendation[] {
  try {
    const parsed = JSON.parse(raw) as SnapshotRecommendation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Le rang du commerce sur la requête directe du moteur, s'il en a un. */
function directPosition(result: GeoAnalysisResult, engine: AiEngine): number | null {
  const found = result.engines.find((e) => e.engine === engine);
  const direct = found?.rankings.find((r) => r.scope === "direct") ?? found?.rankings[0];
  return direct?.targetRank ?? null;
}

/**
 * Écrit l'état d'une analyse au moment où elle vient d'être enregistrée.
 *
 * Appelée derrière chaque écriture d'analyse — la mise en route, la reprise
 * après achat, la reprise quotidienne. Son échec ne remet jamais en cause
 * l'analyse elle-même, qui est déjà en base : un historique manquant coûte une
 * comparaison, pas un rapport.
 */
export async function recordAnalysisSnapshot(params: {
  userId: string;
  analysisId: string;
  result: GeoAnalysisResult;
  reason: "initial" | "refresh";
}): Promise<void> {
  const { userId, analysisId, result, reason } = params;
  const diagnostic = buildDiagnostic(result);

  const categories = Object.fromEntries(
    result.categories.map((category) => [category.key, Math.round(category.score)]),
  );

  const engines = Object.fromEntries(
    DASHBOARD_ENGINES.filter((engine) => result.engines.some((e) => e.engine === engine)).map(
      (engine) => [
        engine,
        {
          score: Math.round(result.engines.find((e) => e.engine === engine)?.score ?? 0),
          position: directPosition(result, engine),
        } satisfies SnapshotEngine,
      ],
    ),
  );

  const recommendations: SnapshotRecommendation[] = result.recommendations.map((r) => ({
    title: r.title,
    category: r.category,
    priority: r.priority,
    impact: r.impact,
  }));

  try {
    await prisma.analysisSnapshot.create({
      data: {
        analysisId,
        userId,
        domain: result.domain,
        overallScore: Math.round(result.overallScore),
        categories: JSON.stringify(categories),
        architectureScore: diagnostic.architecture.score,
        contentScore: diagnostic.content.score,
        engines: JSON.stringify(engines),
        recommendations: JSON.stringify(recommendations),
        reason,
      },
    });
  } catch (err) {
    console.error("Instantané d'analyse non écrit :", err);
  }
}

/** Convertit une ligne de base en relevé exploitable. */
function toSnapshot(row: {
  id: string;
  createdAt: Date;
  overallScore: number;
  architectureScore: number;
  contentScore: number;
  categories: string;
  engines: string | null;
  recommendations: string;
  reason: string;
}): AnalysisSnapshot {
  return {
    id: row.id,
    createdAt: row.createdAt,
    overallScore: row.overallScore,
    architectureScore: row.architectureScore,
    contentScore: row.contentScore,
    categories: parseCategories(row.categories),
    engines: parseEngines(row.engines),
    recommendations: parseRecommendations(row.recommendations),
    reason: row.reason,
  };
}

function delta(key: string, label: string, before: number, after: number): ScoreDelta {
  return { key, label, before, after, delta: after - before };
}

/**
 * Ce qui a bougé depuis la reprise précédente.
 *
 * `null` tant qu'il n'y a pas deux relevés : à la première analyse, il n'y a
 * pas de progression à raconter, et une carte pleine de « +0 » ferait croire à
 * un échec plutôt qu'à un début.
 *
 * Seuls deux chiffres sortent d'ici : la note de visibilité, et son écart
 * moteur par moteur. Le détail — quelle catégorie, quel correctif — vit dans le
 * plan d'action, qui est fait pour ça. La carte de progression répond à une
 * seule question : est-ce que ça monte, et où.
 */
export async function getAnalysisProgress(userId: string): Promise<AnalysisProgress | null> {
  // Deux relevés suffisent à la comparaison du jour ; la toute première mesure
  // se demande à part. La prendre au fond d'une page de trente lignes la faisait
  // disparaître au bout d'un mois de reprises, et « depuis le début » se mettait
  // alors à compter depuis trente jours.
  const [rows, oldest] = await Promise.all([
    prisma.analysisSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    prisma.analysisSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (rows.length < 2 || !oldest) return null;

  const current = toSnapshot(rows[0]);
  const previous = toSnapshot(rows[1]);
  const first = toSnapshot(oldest);

  // Un moteur n'entre dans la comparaison que s'il a été relevé aux deux
  // dates. Le comparer à un zéro par défaut inventerait une chute le jour où le
  // relevé hebdomadaire n'a pas eu lieu.
  const engines: EngineProgress[] = DASHBOARD_ENGINES.filter(
    (engine) => current.engines[engine] && previous.engines[engine],
  ).map((engine) => {
    const after = current.engines[engine] as SnapshotEngine;
    const before = previous.engines[engine] as SnapshotEngine;
    return {
      engine,
      before: before.score,
      after: after.score,
      delta: after.score - before.score,
      positionBefore: before.position,
      positionAfter: after.position,
    };
  });

  return {
    current,
    previous,
    first,
    overall: delta("overall", "Note globale", previous.overallScore, current.overallScore),
    sinceStart: delta("start", "Depuis le début", first.overallScore, current.overallScore),
    engines,
  };
}

/**
 * L'état de la reprise quotidienne : quand elle a eu lieu, et si le compte y a
 * encore droit aujourd'hui.
 *
 * Le compte se fait par journée civile (fuseau du produit), pas par tranche de
 * vingt-quatre heures : une reprise lancée à 23 h ne doit pas fermer la porte
 * jusqu'au lendemain soir.
 */
export type RefreshState = {
  lastRefreshedAt: Date | null;
  availableToday: boolean;
};

export async function getRefreshState(
  userId: string,
  domain: string | null,
): Promise<RefreshState> {
  const record = await prisma.analysis.findFirst({
    where: { userId, ...(domain ? { domain } : {}) },
    orderBy: { createdAt: "desc" },
    select: { refreshedAt: true, createdAt: true },
  });

  if (!record) return { lastRefreshedAt: null, availableToday: false };

  // Faute de reprise, c'est la date de l'analyse elle-même qui compte : une
  // analyse née ce matin n'a pas à être refaite ce soir.
  const last = record.refreshedAt ?? record.createdAt;
  return { lastRefreshedAt: record.refreshedAt, availableToday: last < startOfDay() };
}
