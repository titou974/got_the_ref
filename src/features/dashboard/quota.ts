import "server-only";

import { prisma } from "@/lib/prisma";
import { ARTICLE_QUOTAS, BOOST, ON_PAGE_REWRITE_QUOTA, type OnPageElementKey } from "@/constants/plans";
import { FREE_CONTENT_REWRITES, tierAtLeast, type AccessTier } from "@/constants/access";
import { getAccess } from "@/features/billing/access";
import { startOfDay } from "./queries";

/**
 * La réservation d'une passe payante, avant l'appel au modèle.
 *
 * Lire le compteur puis écrire la ligne des secondes plus tard — le temps que le
 * modèle réponde — laisse passer deux clics simultanés : les deux lisent « il
 * reste une passe », les deux la consomment. Le quota gratuit, qui vaut une
 * seule réécriture, se double alors d'un simple double-clic.
 *
 * La place est donc prise **avant** l'appel, sous un verrou consultatif propre
 * au compte : deux réservations du même client s'attendent, celles de deux
 * clients différents ne se voient pas. Si le modèle échoue ensuite, la place est
 * rendue (`release*`) — une passe qui n'a rien produit ne doit rien coûter.
 */

/** Refus : le compteur est à zéro. Le niveau sert à formuler la réponse. */
export type QuotaDenied = { ok: false; tier: AccessTier };

/** Accord : la ligne est écrite, il reste `remaining` passes après celle-ci. */
export type QuotaGranted = { ok: true; id: string; remaining: number };

export type QuotaReservation = QuotaDenied | QuotaGranted;

/**
 * Clé du verrou consultatif Postgres. `hashtext` en fait l'entier attendu par
 * `pg_advisory_xact_lock`, qui se relâche à la fin de la transaction — il n'y a
 * donc rien à libérer à la main, même si la transaction échoue.
 */
function lockKey(userId: string, scope: string): string {
  return `quota:${scope}:${userId}`;
}

/** Réserve une réécriture on-page, ou refuse si le compteur est épuisé. */
export async function reserveOnPageRewrite(
  userId: string,
  element: OnPageElementKey,
): Promise<QuotaReservation> {
  const { tier } = await getAccess(userId);
  const paid = tierAtLeast(tier, "boost");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(userId, "onpage")}))`;

    // Le compte gratuit a un crédit unique, tous éléments confondus ; au-delà,
    // le plafond est journalier et propre à chaque élément.
    const used = paid
      ? await tx.onPageRewrite.count({
          where: { userId, element, createdAt: { gte: startOfDay() } },
        })
      : await tx.onPageRewrite.count({ where: { userId } });

    const limit = paid ? ON_PAGE_REWRITE_QUOTA.daily : FREE_CONTENT_REWRITES;
    if (used >= limit) return { ok: false as const, tier };

    const row = await tx.onPageRewrite.create({ data: { userId, element } });
    return { ok: true as const, id: row.id, remaining: limit - used - 1 };
  });
}

/** Rend la place : le modèle n'a rien produit. */
export async function releaseOnPageRewrite(id: string): Promise<void> {
  await prisma.onPageRewrite.delete({ where: { id } }).catch(() => {});
}

/**
 * Réserve une rédaction d'article.
 *
 * Deux régimes, comme à la lecture du quota : le Coup de Boost ouvre un volume
 * fixe sur une semaine qui ne se renouvelle pas, l'abonnement un rythme
 * hebdomadaire glissant.
 */
export async function reserveArticleGeneration(
  userId: string,
  articleId: string,
): Promise<QuotaReservation> {
  const access = await getAccess(userId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(userId, "article")}))`;

    if (access.tier === "boost") {
      const until = access.boostArticlesUntil;
      // Semaine close : il ne reste rien à réserver, et rien à attendre.
      if (!until || until.getTime() <= Date.now()) return { ok: false as const, tier: access.tier };

      const since = new Date(until.getTime() - ARTICLE_QUOTAS.windowMs);
      const used = await tx.articleGeneration.count({
        where: { userId, createdAt: { gte: since } },
      });
      if (used >= BOOST.articles) return { ok: false as const, tier: access.tier };

      const row = await tx.articleGeneration.create({ data: { userId, articleId } });
      return { ok: true as const, id: row.id, remaining: BOOST.articles - used - 1 };
    }

    const since = new Date(Date.now() - ARTICLE_QUOTAS.windowMs);
    const used = await tx.articleGeneration.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (used >= ARTICLE_QUOTAS.weekly) return { ok: false as const, tier: access.tier };

    const row = await tx.articleGeneration.create({ data: { userId, articleId } });
    return { ok: true as const, id: row.id, remaining: ARTICLE_QUOTAS.weekly - used - 1 };
  });
}

/** Rend la place : la rédaction n'a rien produit. */
export async function releaseArticleGeneration(id: string): Promise<void> {
  await prisma.articleGeneration.delete({ where: { id } }).catch(() => {});
}
