import "server-only";

import type { Prisma } from "../../../prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptJson } from "@/lib/crypto";
import { publishArticle, type Credentials } from "./connectors";

/**
 * La publication des articles arrivés à échéance, sans personne devant l'écran.
 *
 * Un planning éditorial n'a de valeur que s'il se déroule tout seul : le client
 * a validé ses articles une fois, il ne doit pas avoir à ouvrir le tableau de
 * bord le jour dit pour appuyer sur un bouton. Cette passe tourne donc côté
 * serveur, déclenchée par la tâche planifiée (`/api/cron/publish`), et ne
 * dépend d'aucune session ouverte.
 *
 * Deux garde-fous, volontaires :
 *
 * - par défaut, seuls les articles **validés** partent. Un texte écrit par un
 *   modèle et jamais relu ne s'affiche pas sur le site d'un commerçant parce
 *   qu'une date est passée : la validation est le consentement, la date n'est
 *   que l'heure. Le client qui veut le pilote automatique complet lève
 *   `autoPublish` sur son rattachement, et les articles rédigés partent aussi.
 * - un échec n'arrête pas la file et ne perd pas l'article : il est noté sur le
 *   rattachement (`lastError`) et le sujet repartira au prochain passage.
 */

/** Plafond par passage : au-delà, la tâche planifiée dépasserait son budget. */
const BATCH = 25;

/**
 * Le temps que la passe s'autorise avant de rendre la main.
 *
 * L'hébergeur coupe la route au bout de 300 secondes. Vingt-cinq sites qui
 * mettent chacun quinze secondes à répondre dépasseraient largement : la
 * coupure tomberait au milieu d'une publication, sans que rien ne soit écrit
 * ni noté. Mieux vaut s'arrêter de soi-même.
 *
 * Ce qui n'est pas parti reste dû : la date est déjà passée, un jour de plus ne
 * change rien — un article perdu, si.
 */
const BUDGET_MS = 240_000;

export type PublishOutcome = {
  articleId: string;
  userId: string;
  ok: boolean;
  url?: string | null;
  error?: string;
};

export type PublishRun = {
  due: number;
  published: number;
  failed: number;
  /** Arrivés à échéance mais non traités faute de temps : au prochain passage. */
  skipped: number;
  outcomes: PublishOutcome[];
};

/**
 * Ce qu'un article doit être pour partir tout seul.
 *
 * Sorti de la passe pour que le tableau de bord puisse poser exactement la même
 * question : « qu'est-ce qui va partir, et quand ? ». Le quai de départ de la
 * page Articles annonce une date au client — si sa règle et celle-ci se
 * séparaient d'une ligne, il annoncerait un départ qui n'arrive jamais.
 *
 * `userId` restreint au compte quand on interroge pour un écran ; la passe, qui
 * balaie tout le parc, l'omet.
 */
export function departureFilter(userId?: string): Prisma.ArticleWhereInput {
  return {
    ...(userId ? { userId } : {}),
    publishedAt: null,
    scheduledFor: { not: null },
    // Un sujet sans corps n'a rien à déposer : il attend sa rédaction.
    body: { not: "" },
    OR: [
      // Validé par le client : il part, quel que soit le réglage.
      {
        status: "approved",
        user: { siteConnection: { status: "connected", capabilities: { has: "publish" } } },
      },
      // Rédigé mais jamais ouvert : seulement si le client a demandé le pilote
      // automatique complet.
      {
        status: "drafted",
        user: {
          siteConnection: {
            status: "connected",
            capabilities: { has: "publish" },
            autoPublish: true,
          },
        },
      },
    ],
  };
}

export async function publishDueArticles(now: Date = new Date()): Promise<PublishRun> {
  const due = await prisma.article.findMany({
    where: {
      ...departureFilter(),
      // La passe ne prend que ce qui est arrivé à échéance ; le tableau de bord,
      // lui, regarde aussi devant.
      scheduledFor: { not: null, lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: BATCH,
    include: {
      user: { select: { siteConnection: true } },
    },
  });

  const outcomes: PublishOutcome[] = [];
  const startedAt = Date.now();

  for (const article of due) {
    // On s'arrête avant la coupure, pas pendant : un article à moitié déposé
    // serait publié chez le client sans que la base le sache.
    if (Date.now() - startedAt > BUDGET_MS) break;

    const link = article.user.siteConnection;
    if (!link) continue;

    const credentials = decryptJson<Credentials>(link.credentials);
    if (!credentials) {
      outcomes.push({
        articleId: article.id,
        userId: article.userId,
        ok: false,
        error: "Identifiants illisibles : le rattachement est à refaire.",
      });
      continue;
    }

    try {
      const published = await publishArticle(link.platform, credentials, {
        title: article.title,
        body: article.body,
        excerpt: article.excerpt,
        slug: article.slug,
      });

      await prisma.$transaction([
        prisma.article.update({
          where: { id: article.id },
          data: {
            status: "published",
            publishedAt: new Date(),
            externalUrl: published.url,
            externalId: published.externalId,
          },
        }),
        prisma.siteConnection.update({
          where: { userId: article.userId },
          data: { lastSyncAt: new Date(), lastError: null },
        }),
      ]);

      outcomes.push({
        articleId: article.id,
        userId: article.userId,
        ok: true,
        url: published.url,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // L'erreur se lit sur le rattachement, là où le client la verra à sa
      // prochaine visite. L'article, lui, reste validé et non publié : il
      // repartira au prochain passage, sans intervention.
      await prisma.siteConnection.update({
        where: { userId: article.userId },
        data: { lastError: `Publication du ${article.title} : ${message}`.slice(0, 500) },
      });
      outcomes.push({ articleId: article.id, userId: article.userId, ok: false, error: message });
    }
  }

  return {
    due: due.length,
    published: outcomes.filter((outcome) => outcome.ok).length,
    failed: outcomes.filter((outcome) => !outcome.ok).length,
    skipped: due.length - outcomes.length,
    outcomes,
  };
}
