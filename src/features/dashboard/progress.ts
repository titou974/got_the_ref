import "server-only";

import { prisma } from "@/lib/prisma";
import { buildDiagnostic } from "@/lib/geo/diagnostic";
import { CATEGORY_META, type CategoryKey, type GeoAnalysisResult } from "@/lib/geo/types";
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

export type AnalysisSnapshot = {
  id: string;
  createdAt: Date;
  overallScore: number;
  architectureScore: number;
  contentScore: number;
  categories: Partial<Record<CategoryKey, number>>;
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

export type AnalysisProgress = {
  /** La reprise la plus récente : celle que le tableau de bord affiche. */
  current: AnalysisSnapshot;
  /** La version d'avant. Absente à la toute première analyse. */
  previous: AnalysisSnapshot;
  /** La toute première mesure du compte, pour l'écart « depuis le début ». */
  first: AnalysisSnapshot;
  overall: ScoreDelta;
  sinceStart: ScoreDelta;
  /** Architecture et contenu : les deux volets du diagnostic. */
  sections: ScoreDelta[];
  /** Les six catégories GEO. */
  categories: ScoreDelta[];
  /** Les correctifs disparus depuis la version précédente : le travail fait. */
  resolved: SnapshotRecommendation[];
  /** Ceux apparus depuis : ce que la nouvelle mesure a trouvé en plus. */
  appeared: SnapshotRecommendation[];
  /** La courbe de la note, du plus ancien au plus récent (30 relevés au plus). */
  history: { date: string; score: number }[];
};

/** Une clé de correctif stable : le titre, sans casse ni accents ni ponctuation. */
function fingerprint(recommendation: SnapshotRecommendation): string {
  return recommendation.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCategories(raw: string): Partial<Record<CategoryKey, number>> {
  try {
    return JSON.parse(raw) as Partial<Record<CategoryKey, number>>;
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
        recommendations: JSON.stringify(recommendations),
        reason,
      },
    });
  } catch (err) {
    console.error("Instantané d'analyse non écrit :", err);
  }
}

/** Trente relevés : un mois de reprises quotidiennes, de quoi tracer la courbe. */
const HISTORY_LIMIT = 30;

/** Convertit une ligne de base en relevé exploitable. */
function toSnapshot(row: {
  id: string;
  createdAt: Date;
  overallScore: number;
  architectureScore: number;
  contentScore: number;
  categories: string;
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
 */
export async function getAnalysisProgress(userId: string): Promise<AnalysisProgress | null> {
  const rows = await prisma.analysisSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });

  if (rows.length < 2) return null;

  const snapshots = rows.map(toSnapshot);
  const current = snapshots[0];
  const previous = snapshots[1];
  const first = snapshots[snapshots.length - 1];

  const categories = (Object.keys(CATEGORY_META) as CategoryKey[])
    .filter(
      (key) =>
        current.categories[key] !== undefined && previous.categories[key] !== undefined,
    )
    .map((key) =>
      delta(
        key,
        CATEGORY_META[key].short,
        previous.categories[key] ?? 0,
        current.categories[key] ?? 0,
      ),
    );

  // Un correctif « résolu » est un correctif que la nouvelle mesure ne relève
  // plus. C'est la seule preuve dont on dispose : le produit ne sait pas qui a
  // appliqué quoi, il sait ce que le site montre aujourd'hui.
  const before = new Map(previous.recommendations.map((r) => [fingerprint(r), r]));
  const after = new Map(current.recommendations.map((r) => [fingerprint(r), r]));

  const resolved = [...before.entries()]
    .filter(([key]) => !after.has(key))
    .map(([, recommendation]) => recommendation)
    .sort((a, b) => b.impact - a.impact);

  const appeared = [...after.entries()]
    .filter(([key]) => !before.has(key))
    .map(([, recommendation]) => recommendation)
    .sort((a, b) => b.impact - a.impact);

  return {
    current,
    previous,
    first,
    overall: delta("overall", "Note globale", previous.overallScore, current.overallScore),
    sinceStart: delta("start", "Depuis le début", first.overallScore, current.overallScore),
    sections: [
      delta(
        "architecture",
        "Architecture",
        previous.architectureScore,
        current.architectureScore,
      ),
      delta("content", "Contenu", previous.contentScore, current.contentScore),
    ],
    categories,
    resolved,
    appeared,
    history: [...snapshots].reverse().map((snapshot) => ({
      date: snapshot.createdAt.toISOString(),
      score: snapshot.overallScore,
    })),
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
