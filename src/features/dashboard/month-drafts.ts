import "server-only";

import { prisma } from "@/lib/prisma";
import { tierAtLeast } from "@/constants/access";
import { getAccess } from "@/features/billing/access";
import { contextForWriting } from "./brand-tone";
import { parseOutline } from "./outline";
import { writeArticle } from "./service";

/**
 * Le mois écrit d'avance, pour l'abonnement Tout-en-un.
 *
 * La mise en route pose vingt-deux sujets au calendrier et n'en rédige que
 * trois : ces rédactions partent en parallèle derrière l'écran d'attente, et
 * cinq appels lancés ensemble en dépassaient déjà le budget. C'est tenable pour
 * le Coup de Boost, qui vend une semaine de rédaction et dont la semaine est
 * précisément là. Ça ne l'est pas pour un abonnement : le client ouvre son
 * onglet Articles, y trouve dix-neuf lignes de titres sans texte, et rien ne lui
 * dit qu'elles s'écriront un jour. Il a payé pour un mois publié, pas pour un
 * sommaire.
 *
 * Le reste du mois s'écrit donc ici, en tâche de fond, à chaque retour du client
 * dans son interface — jamais devant lui : `after()` rend la main à la page,
 * puis les rédactions partent. Une passe s'arrête avant la fin du temps alloué à
 * la route, et la visite suivante reprend là où celle-ci s'est arrêtée. Le
 * client voit donc son mois se remplir d'une ouverture à l'autre, sans jamais
 * attendre devant un écran figé.
 *
 * Rien n'est décompté du quota hebdomadaire : ces articles-là sont ce que
 * l'abonnement vend, au même titre que les trois de la mise en route. Le quota
 * borne ce que le client redemande — une reprise, une réécriture —, pas ce qui
 * lui est dû.
 */

/**
 * Rédactions lancées ensemble.
 *
 * Trois, le nombre déjà retenu à la mise en route : il tient dans les limites de
 * débit du fournisseur et laisse le reste du produit répondre pendant ce
 * temps-là. Au-delà, les appels se mettent à attendre les uns derrière les
 * autres et la passe n'écrit pas un article de plus.
 */
const BATCH = 3;

/**
 * Le temps qu'une passe s'autorise, en millisecondes.
 *
 * Les routes du tableau de bord sont plafonnées à cinq minutes, et le travail
 * d'`after()` vit dans ce même plafond. On s'arrête à trois minutes : le lot en
 * cours a le temps de finir et d'écrire ses articles en base, plutôt que d'être
 * coupé au milieu et de perdre un appel au grand modèle déjà payé.
 */
const BUDGET_MS = 3 * 60 * 1000;

/**
 * Les comptes dont une passe tourne déjà, dans cette instance.
 *
 * Deux onglets ouverts, c'est deux passes lancées sur les mêmes articles : la
 * même rédaction serait payée deux fois. Le verrou est en mémoire — il ne
 * protège que d'un doublon simultané dans le même processus, ce qui est le cas
 * qui arrive vraiment ; la reprise après redémarrage, elle, ne trouvera de toute
 * façon que les articles restés sans texte.
 */
const running = new Set<string>();

/** Un sujet posé au calendrier qui attend encore son texte. */
type Planned = { id: string; title: string; keyword: string | null; outline: string | null };

/**
 * Écrit les sujets du mois qui n'ont pas encore de texte.
 *
 * Réservé à l'abonnement — et à la démonstration, qui montre l'abonnement. Le
 * Coup de Boost garde sa semaine : il vend trois rédactions, elles sont faites à
 * la mise en route, et lui en écrire vingt-deux reviendrait à lui offrir
 * l'abonnement.
 *
 * Best-effort de bout en bout : un article dont la rédaction échoue reste un
 * sujet, la passe suivante le reprendra, et rien de ce qui se passe ici ne
 * remonte au client — il a déjà sa page.
 */
export async function backfillMonthDrafts(userId: string): Promise<void> {
  if (running.has(userId)) return;

  try {
    const { tier } = await getAccess(userId);
    if (!tierAtLeast(tier, "allin")) return;

    const planned = await prisma.article.findMany({
      where: { userId, status: "planned", body: "" },
      orderBy: { scheduledFor: "asc" },
      select: { id: true, title: true, keyword: true, outline: true },
    });
    if (planned.length === 0) return;

    running.add(userId);
    try {
      // Le contexte est lu une fois pour toute la passe : il ne change pas d'un
      // article à l'autre, et le relire vingt-deux fois ferait vingt-deux fois
      // les six requêtes du tableau de bord.
      const context = await contextForWriting(userId);
      const until = Date.now() + BUDGET_MS;

      for (let index = 0; index < planned.length; index += BATCH) {
        if (Date.now() >= until) break;
        await Promise.allSettled(planned.slice(index, index + BATCH).map(draft(context)));
      }
    } finally {
      running.delete(userId);
    }
  } catch (err) {
    console.error("Rédaction du mois en tâche de fond échouée :", err);
  }
}

/** Rédige un sujet et le passe en brouillon. */
function draft(context: Awaited<ReturnType<typeof contextForWriting>>) {
  return async (article: Planned) => {
    const written = await writeArticle(context, {
      title: article.title,
      keyword: article.keyword,
      outline: parseOutline(article.outline),
    });

    // `status` conditionné à l'état lu à l'instant : si le client a ouvert
    // l'article et lancé la rédaction lui-même pendant que la passe tournait,
    // c'est son texte qui reste, pas celui-ci.
    await prisma.article.updateMany({
      where: { id: article.id, status: "planned", body: "" },
      data: {
        title: written.title,
        excerpt: written.excerpt,
        body: written.body,
        status: "drafted",
      },
    });
  };
}

/**
 * Reste-t-il des sujets du mois à écrire pour ce compte ?
 *
 * Lu par l'atelier d'article : un article vide dont le sujet est encore au
 * planning n'est pas un article vide, c'est un article dont c'est le tour qui
 * n'est pas venu. L'écran le dit alors — et montre la rédaction en cours —
 * plutôt que de laisser le client devant une page blanche.
 */
export async function monthDraftsPending(userId: string): Promise<boolean> {
  const { tier } = await getAccess(userId);
  if (!tierAtLeast(tier, "allin")) return false;

  const remaining = await prisma.article.count({
    where: { userId, status: "planned", body: "" },
  });
  return remaining > 0;
}
