import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { decryptJson } from "@/lib/crypto";
import type { SiteCapability } from "@/constants/site-platforms";
import {
  ARTICLE_QUOTAS,
  BOOST,
  ON_PAGE_ELEMENTS,
  ON_PAGE_REWRITE_QUOTA,
  type OnPageElementKey,
} from "@/constants/plans";
import {
  BOOST_ARTICLE_WINDOW_DAYS,
  FREE_CONTENT_REWRITES,
  tierAtLeast,
  type AccessTier,
} from "@/constants/access";
import { getAccess } from "@/features/billing/access";

/**
 * Tout ce que le tableau de bord relit avant d'afficher quoi que ce soit.
 *
 * Une seule fonction, appelée par chaque page de la section : les onglets
 * partagent la même fiche client, la même analyse et les mêmes rattachements.
 * Les découper en six requêtes par page ferait six fois le même travail pour un
 * rendu qui, de toute façon, montre la barre latérale complète.
 */

export type DashboardAnalysis = GeoAnalysisResult & {
  tier?: "free" | "paid";
  /**
   * Le niveau d'accès du compte au moment où l'analyse a été faite.
   *
   * Il ne dit pas ce que le compte a le droit de voir aujourd'hui — c'est
   * `DashboardContext.tier` qui le dit — mais quels appels sont réellement
   * partis ce jour-là. Une analyse faite en gratuit n'a interrogé qu'un moteur
   * et sauté les relevés hors-site ; comparer les deux niveaux est ce qui
   * déclenche la reprise après un achat (cf. `analysisNeedsUpgrade`).
   *
   * Absent sur les analyses d'avant cette règle : elles se lisent comme
   * gratuites, ce qui les fait rejouer une fois pour un compte payant.
   */
  accessTier?: AccessTier;
};

export type SiteLink = {
  platform: string;
  siteUrl: string | null;
  status: string;
  capabilities: SiteCapability[];
  connectedAt: Date | null;
  lastError: string | null;
};

export type GoogleLinkState = {
  /** Analytics rattaché : sans lui, aucun chiffre de trafic IA. */
  analytics: boolean;
  searchConsole: boolean;
  propertyName: string | null;
};

export type DashboardContext = {
  userId: string;
  domain: string | null;
  siteUrl: string | null;
  businessName: string;
  /** Commerce avec une adresse : ouvre l'onglet Google Maps. */
  isPhysical: boolean;
  mapsUrl: string | null;
  niche: string | null;
  cities: string[];
  /**
   * Le pays relevé pendant l'accueil, en code ISO à deux lettres. Il choisit la
   * localisation interrogée chez DataForSEO : les mentions d'un commerce belge
   * ne se cherchent pas dans l'archive française.
   */
  country: string | null;
  analysisId: string | null;
  analysis: DashboardAnalysis | null;
  /**
   * Ce que l'offre du compte ouvre. Porté par le contexte plutôt que relu page
   * par page : chaque écran du tableau de bord s'en sert, et la coque en a
   * besoin avant même de dessiner la colonne de gauche.
   */
  tier: AccessTier;
  /** Fin de la semaine de rédaction du Coup de Boost, si elle court encore. */
  boostArticlesUntil: Date | null;
  google: GoogleLinkState;
  site: SiteLink | null;
  brandVoice: { instructions: string; banned: string[] } | null;
  /**
   * Le ton relevé pendant l'accueil, à partir de l'article donné en exemple.
   * Il précède la voix de marque : celle-ci le corrige, elle ne le remplace pas.
   */
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
};

/** Relit l'analyse stockée. Une ligne illisible vaut une absence d'analyse. */
function parseAnalysis(raw: string): DashboardAnalysis | null {
  try {
    return JSON.parse(raw) as DashboardAnalysis;
  } catch {
    return null;
  }
}

/**
 * Mémorisé le temps d'une requête : la coque et la page appellent la même
 * fonction, et les six requêtes ne partent qu'une fois.
 */
export const getDashboardContext = cache(async function getDashboardContext(
  userId: string,
): Promise<DashboardContext> {
  const [access, profile, googleLink, siteLink, voice] = await Promise.all([
    getAccess(userId),
    prisma.onboardingProfile.findUnique({
      where: { userId },
      include: { competitors: { orderBy: { rank: "asc" } } },
    }),
    prisma.googleConnection.findUnique({
      where: { userId },
      select: { ga4PropertyId: true, ga4PropertyName: true, siteUrl: true },
    }),
    prisma.siteConnection.findUnique({ where: { userId } }),
    prisma.brandVoice.findUnique({ where: { userId } }),
  ]);

  const domain = profile?.domain ?? null;

  // L'analyse retenue est la plus récente du compte sur le domaine déclaré.
  // Sans domaine (fiche d'accueil incomplète), on prend la dernière tout court.
  const record = await prisma.analysis.findFirst({
    where: { userId, ...(domain ? { domain } : {}) },
    orderBy: { createdAt: "desc" },
  });

  const analysis = record ? parseAnalysis(record.data) : null;

  return {
    userId,
    tier: access.tier,
    boostArticlesUntil: access.boostArticlesUntil,
    domain,
    siteUrl: profile?.siteUrl ?? null,
    businessName: record?.businessName ?? profile?.domain ?? "",
    isPhysical: profile?.businessKind !== "online",
    mapsUrl: profile?.mapsUrl ?? null,
    niche: profile?.niche ?? analysis?.profile.niche ?? null,
    cities: profile?.cities ?? [],
    country: profile?.detectedCountry ?? null,
    analysisId: record?.id ?? null,
    analysis,
    google: {
      analytics: Boolean(googleLink?.ga4PropertyId),
      searchConsole: Boolean(googleLink?.siteUrl),
      propertyName: googleLink?.ga4PropertyName ?? null,
    },
    site: siteLink
      ? {
          platform: siteLink.platform,
          siteUrl: siteLink.siteUrl,
          status: siteLink.status,
          capabilities: siteLink.capabilities as SiteCapability[],
          connectedAt: siteLink.connectedAt,
          lastError: siteLink.lastError,
        }
      : null,
    brandVoice: voice ? { instructions: voice.instructions, banned: voice.banned } : null,
    tone: {
      summary: profile?.toneSummary ?? null,
      color: profile?.brandColor ?? null,
      sampleUrl: profile?.toneSampleUrl ?? null,
    },
  };
});

/** Les identifiants du lien, déchiffrés. Réservé aux appels sortants. */
export async function readSiteCredentials<T = Record<string, string>>(
  userId: string,
): Promise<T | null> {
  const link = await prisma.siteConnection.findUnique({
    where: { userId },
    select: { credentials: true },
  });
  return decryptJson<T>(link?.credentials);
}

/**
 * Le planning éditorial du compte, du plus proche au plus lointain.
 *
 * Mémorisé le temps de la requête : la coque du tableau de bord le lit pour
 * nourrir le prompt de la barre d'exécution, et l'accueil comme l'onglet
 * Articles le relisent pour leur calendrier. Sans cette mémoire, la même liste
 * partirait deux fois en base à chaque affichage de page.
 */
export const listArticles = cache(async function listArticles(userId: string) {
  return prisma.article.findMany({
    where: { userId },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
  });
});

export async function getArticle(userId: string, id: string) {
  return prisma.article.findFirst({ where: { id, userId } });
}

export async function listProspects(userId: string) {
  return prisma.outreachProspect.findMany({
    where: { userId },
    orderBy: [{ authority: "desc" }, { createdAt: "desc" }],
  });
}

export async function listGooglePosts(userId: string) {
  return prisma.googlePost.findMany({
    where: { userId },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
  });
}

/** Où en est le client de ses rédactions de la semaine. */
export type ArticleQuota = {
  /** Rédactions déjà consommées dans la fenêtre glissante. */
  used: number;
  /** Rédactions encore disponibles (jamais négatif). */
  remaining: number;
  /** Le plafond, repris des constantes pour l'affichage. */
  limit: number;
  /**
   * Quand la prochaine se libère : la plus ancienne passe de la fenêtre, plus
   * sept jours. `null` quand il reste des rédactions — il n'y a alors rien à
   * attendre.
   */
  renewsAt: Date | null;
};

/**
 * Le quota de rédaction sur les sept derniers jours.
 *
 * La fenêtre glisse : on ne remet pas un compteur à zéro le lundi, on regarde
 * ce qui a été consommé depuis sept jours. La date de renouvellement se déduit
 * donc de la plus ancienne passe encore dans la fenêtre — c'est elle qui en
 * sortira la première.
 */
export async function getArticleQuota(userId: string): Promise<ArticleQuota> {
  const access = await getAccess(userId);

  // Le Coup de Boost n'achète pas un rythme, il achète une semaine : les agents
  // écrivent le volume promis à partir du paiement, puis s'arrêtent. Passé ce
  // délai, il ne reste rien à attendre — d'où `renewsAt` à null, qui dit « c'est
  // fini » là où une date dirait « revenez lundi ».
  if (access.tier === "boost") {
    const until = access.boostArticlesUntil;
    if (!until || until.getTime() <= Date.now()) {
      return { used: BOOST.articles, remaining: 0, limit: BOOST.articles, renewsAt: null };
    }

    const since = new Date(until.getTime() - BOOST_ARTICLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const used = await prisma.articleGeneration.count({
      where: { userId, createdAt: { gte: since } },
    });
    return {
      used,
      remaining: Math.max(0, BOOST.articles - used),
      limit: BOOST.articles,
      renewsAt: null,
    };
  }

  const since = new Date(Date.now() - ARTICLE_QUOTAS.windowMs);
  const [used, oldest] = await Promise.all([
    prisma.articleGeneration.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.articleGeneration.findFirst({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const remaining = Math.max(0, ARTICLE_QUOTAS.weekly - used);
  return {
    used,
    remaining,
    limit: ARTICLE_QUOTAS.weekly,
    renewsAt:
      remaining > 0 || !oldest
        ? null
        : new Date(oldest.createdAt.getTime() + ARTICLE_QUOTAS.windowMs),
  };
}

/** Ce qu'il reste de réécritures aujourd'hui, élément par élément. */
export type OnPageRewriteQuota = Record<OnPageElementKey, number>;

/**
 * Minuit à Paris, exprimé en instant.
 *
 * Le serveur peut tourner n'importe où : compter « depuis minuit » sur son
 * horloge donnerait à un client une journée qui commence à 2 h du matin. On
 * relit donc la date du jour dans le fuseau annoncé, et on en refait un instant.
 */
export function startOfDay(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ON_PAGE_REWRITE_QUOTA.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  const elapsedMs =
    ((at("hour") % 24) * 60 * 60 + at("minute") * 60 + at("second")) * 1000;
  return new Date(Date.now() - elapsedMs);
}

/**
 * Le quota de réécriture du jour, par élément.
 *
 * Les trois compteurs sont lus d'un coup : la page affiche les trois boutons,
 * et trois requêtes pour trois nombres seraient trois allers-retours pour rien.
 *
 * Un compte gratuit sort de ce calcul : il n'a pas trois passes par jour et par
 * élément, mais **une seule** réécriture dans toute sa vie, sur l'élément de son
 * choix (cf. `FREE_CONTENT_REWRITES`). C'est l'échantillon — il voit un agent
 * réécrire son propre titre, et il décide. Le même crédit est donc affiché sur
 * les trois boutons : le premier consommé ferme les deux autres.
 */
export async function getOnPageRewriteQuota(userId: string): Promise<OnPageRewriteQuota> {
  const { tier } = await getAccess(userId);

  if (!tierAtLeast(tier, "boost")) {
    const used = await prisma.onPageRewrite.count({ where: { userId } });
    const left = Math.max(0, FREE_CONTENT_REWRITES - used);
    return Object.fromEntries(
      ON_PAGE_ELEMENTS.map((element) => [element, left]),
    ) as OnPageRewriteQuota;
  }

  const runs = await prisma.onPageRewrite.groupBy({
    by: ["element"],
    where: { userId, createdAt: { gte: startOfDay() } },
    _count: { _all: true },
  });

  const used = new Map(runs.map((run) => [run.element, run._count._all]));
  return Object.fromEntries(
    ON_PAGE_ELEMENTS.map((element) => [
      element,
      Math.max(0, ON_PAGE_REWRITE_QUOTA.daily - (used.get(element) ?? 0)),
    ]),
  ) as OnPageRewriteQuota;
}
