import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  isDataForSeoConfigured,
  DataForSeoError,
} from "@/lib/dataforseo/client";
import { dataForSeoLog } from "@/lib/dataforseo/log";
import {
  fetchDomainTimeseries,
  locationCodeOf,
  TIMESERIES_PLATFORMS,
  type MonthlyDelta,
  type PlatformSeries,
} from "@/lib/dataforseo/llm-mentions";

/**
 * Les mentions du commerce dans les IA, modèle par modèle et mois par mois.
 *
 * La question posée par le client est simple — « est-ce que les IA parlent de
 * moi, et est-ce que ça monte ? » — et la réponse tient dans une série par
 * modèle : DataForSEO rend, pour un domaine, ce qu'il a gagné ou perdu en
 * citations chaque mois, séparément sur les aperçus IA de Google et sur
 * ChatGPT.
 *
 * Ce sont des écarts, pas des totaux : « +18 » veut dire dix-huit citations de
 * plus que le mois précédent. L'interface l'écrit ainsi partout, signe compris,
 * plutôt que de laisser lire un nombre de mentions là où il n'y en a pas.
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

/** Une plateforme et son évolution mensuelle, prête pour le graphique. */
export type LlmPlatformSeries = {
  /** « google », « chat_gpt » : la clé rendue par DataForSEO. */
  platform: string;
  label: string;
  /** Logo servi depuis `public/`. */
  logo: string;
  /** La localisation réellement interrogée — ChatGPT n'existe qu'en archive US. */
  locationCode: number;
  points: MonthlyDelta[];
  /** Somme des écarts de la fenêtre : le mouvement net sur douze mois. */
  netDelta: number;
  /** Même somme, côté volume de recherche des questions concernées. */
  netSearchVolume: number;
};

export type LlmMentionsReport = {
  domain: string;
  /** Une série par modèle d'IA suivi, sur les douze derniers mois. */
  platforms: LlmPlatformSeries[];
  /** Le mouvement net toutes plateformes confondues, sur la fenêtre entière. */
  netDelta: number;
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
 * DataForSEO nomme ses plateformes en interne (« chat_gpt ») ; la légende du
 * graphique, elle, s'adresse à un commerçant. Une plateforme que DataForSEO
 * ajouterait garde son nom brut embelli plutôt que de disparaître de la carte.
 */
const PLATFORM_META: Record<string, { label: string; logo: string }> = {
  google: { label: "Aperçus IA de Google", logo: "/gemini.webp" },
  chat_gpt: { label: "ChatGPT", logo: "/chatgpt.png" },
};

function describePlatform(platform: string): { label: string; logo: string } {
  return (
    PLATFORM_META[platform] ?? {
      label: platform.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      logo: "/chatgpt.png",
    }
  );
}

/** Habille les séries brutes du nom, du logo et des totaux que la carte affiche. */
export function describeSeries(series: PlatformSeries[]): LlmPlatformSeries[] {
  return series.map((entry) => {
    const { label, logo } = describePlatform(entry.platform);
    return {
      platform: entry.platform,
      label,
      logo,
      locationCode: entry.locationCode,
      points: entry.points,
      netDelta: entry.points.reduce((total, point) => total + point.delta, 0),
      netSearchVolume: entry.points.reduce(
        (total, point) => total + point.deltaSearchVolume,
        0,
      ),
    };
  });
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

/**
 * Le relevé gardé en base, s'il a la forme attendue.
 *
 * La vérification porte sur `platforms` : un relevé écrit par une version
 * antérieure de cet écran a une autre forme, et vaut mieux être traité comme
 * absent — la carte repasse à l'exemple — que rendu à moitié.
 */
function parseReport(payload: string | null): LlmMentionsReport | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as LlmMentionsReport;
    return Array.isArray(parsed?.platforms) &&
      parsed.platforms.every((entry) => Array.isArray(entry?.points))
      ? parsed
      : null;
  } catch {
    // Une ligne illisible vaut une absence de relevé — mais elle ne rouvre pas
    // le droit d'appel pour autant : `attemptedAt` reste la seule porte.
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
 * Tout part du domaine, jamais du nom de la marque : c'est le site du commerce
 * qu'on suit, et lui seul s'écrit sans ambiguïté d'orthographe.
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
    dataForSeoLog("✗ compteur illisible — aucun appel", {
      userId,
      erreur: String(error),
    });
    return null;
  }

  const stored = parseReport(snapshot?.payload ?? null);
  const sameQuestion =
    snapshot?.domain === clean && snapshot?.locationCode === locationCode;
  // La porte se ferme pour le reste du mois dès qu'une tentative y a eu lieu.
  const nextRefreshAt = snapshot ? nextMonthStart(snapshot.attemptedAt) : null;
  const doorClosed = Boolean(
    snapshot && monthKeyOf(snapshot.attemptedAt) === currentMonthKey(),
  );

  /** Le relevé gardé, redaté de la prochaine ouverture de la porte. */
  const compose = (report: LlmMentionsReport): LlmMentionsReport => ({
    ...report,
    nextRefreshAt: nextRefreshAt?.toISOString(),
  });

  if (doorClosed) {
    dataForSeoLog("⏸ relevé du mois déjà fait — lu en base, aucun appel", {
      domaine: clean,
      dernier_releve: snapshot?.fetchedAt?.toISOString() ?? "(aucun)",
      prochain_appel: nextRefreshAt?.toISOString(),
      series_en_base: stored?.platforms.length ?? 0,
    });
    return sameQuestion && stored ? compose(stored) : null;
  }

  if (!isDataForSeoConfigured()) {
    dataForSeoLog("⏸ identifiants absents — aucun appel");
    return sameQuestion && stored ? compose(stored) : null;
  }

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
    location_code: locationCode,
    // Une série d'évolution par plateforme suivie, donc un appel chacune.
    appels_prevus: TIMESERIES_PLATFORMS.length,
    premier_releve: snapshot ? "non" : "oui — compte jamais relevé",
  });

  try {
    const platforms = describeSeries(
      await fetchDomainTimeseries({ domain: clean, locationCode }),
    );

    const report: LlmMentionsReport = {
      domain: clean,
      platforms,
      netDelta: platforms.reduce((total, entry) => total + entry.netDelta, 0),
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

    dataForSeoLog("✓ relevé du mois — écrit en base", {
      domaine: clean,
      series: platforms.length,
      mois_par_serie: platforms[0]?.points.length ?? 0,
      evolution_nette: report.netDelta,
      prochain_appel: nextMonthStart(attemptedAt).toISOString(),
    });

    return {
      ...report,
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
          nextRefreshAt: nextMonthStart(attemptedAt).toISOString(),
        }
      : null;
  }
});
