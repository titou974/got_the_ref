import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { decryptJson } from "@/lib/crypto";
import type { SiteCapability } from "@/constants/site-platforms";
import { ARTICLE_QUOTAS } from "@/constants/plans";

/**
 * Tout ce que le tableau de bord relit avant d'afficher quoi que ce soit.
 *
 * Une seule fonction, appelée par chaque page de la section : les onglets
 * partagent la même fiche client, la même analyse et les mêmes rattachements.
 * Les découper en six requêtes par page ferait six fois le même travail pour un
 * rendu qui, de toute façon, montre la barre latérale complète.
 */

export type DashboardAnalysis = GeoAnalysisResult & { tier?: "free" | "paid" };

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
  analysisId: string | null;
  analysis: DashboardAnalysis | null;
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
  const [profile, googleLink, siteLink, voice] = await Promise.all([
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
    domain,
    siteUrl: profile?.siteUrl ?? null,
    businessName: record?.businessName ?? profile?.domain ?? "",
    isPhysical: profile?.businessKind !== "online",
    mapsUrl: profile?.mapsUrl ?? null,
    niche: profile?.niche ?? analysis?.profile.niche ?? null,
    cities: profile?.cities ?? [],
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

export async function listArticles(userId: string) {
  return prisma.article.findMany({
    where: { userId },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
  });
}

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
