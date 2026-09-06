import "server-only";

import { prisma } from "@/lib/prisma";
import { tierAtLeast } from "@/constants/access";
import { getAccess } from "@/features/billing/access";
import { contextForWriting } from "./brand-tone";
import { parseOutline } from "./outline";
import { writeArticle } from "./service";

/**
 * Les articles à venir, écrits d'avance pour l'abonnement Tout-en-un.
 *
 * La mise en route pose vingt-deux sujets au calendrier et n'en rédige que
 * trois : ces rédactions partent en parallèle derrière l'écran d'attente, et
 * cinq appels lancés ensemble en dépassaient déjà le budget. C'est tenable pour
 * le Coup de Boost, qui vend une semaine de rédaction et dont la semaine est
 * précisément là. Ça ne l'est pas pour un abonnement : le client ouvre son
 * onglet Articles, y trouve dix-neuf lignes de titres sans texte, et rien ne lui
 * dit qu'elles s'écriront un jour.
 *
 * L'abonné a donc toujours deux semaines d'avance : celle qui court et la
 * suivante. Pas le mois entier — vingt-deux rédactions lancées sur un compte qui
 * vient d'ouvrir coûtent cher pour des textes qui ne partiront que dans trois
 * semaines, et que le client aura eu le temps de faire reprendre dix fois d'ici
 * là. Deux semaines, c'est ce qu'il faut pour qu'il ait toujours de la lecture
 * d'avance et que rien ne parte sans avoir été relu.
 *
 * La fenêtre avance avec lui. À chaque retour dans son interface, les sujets
 * qui viennent d'y entrer sont écrits, et jamais devant lui : `after()` rend la
 * main à la page, puis les rédactions partent. Une passe s'arrête avant la fin
 * du temps alloué à la route, et la visite suivante reprend là où celle-ci s'est
 * arrêtée.
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
 * Le dernier instant couvert par la rédaction d'avance : la fin de la semaine
 * suivante, dimanche soir.
 *
 * Des semaines de calendrier, et non quatorze jours glissants. Le planning est
 * posé du lundi au vendredi, le client le lit par semaines, et une fenêtre
 * glissante lui aurait fait entrer les articles un par jour au lieu d'une
 * semaine d'un coup. Le lundi il a donc quatorze jours d'avance, le vendredi
 * neuf : dans les deux cas, tout ce qui doit partir avant son prochain lundi
 * est déjà écrit.
 */
export function draftHorizon(now: Date = new Date()): Date {
  const end = new Date(now);
  // `getDay()` compte le dimanche comme zéro. On le ramène en fin de semaine,
  // à sa place dans un calendrier français.
  const weekday = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - weekday) + 7);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Écrit les sujets des deux semaines qui viennent, quand ils n'ont pas de texte.
 *
 * Réservé à l'abonnement — et à la démonstration, qui montre l'abonnement. Le
 * Coup de Boost garde sa semaine : il vend trois rédactions, elles sont faites à
 * la mise en route, et lui en écrire d'autres reviendrait à lui offrir
 * l'abonnement.
 *
 * Les sujets en retard sont pris avec les autres : une date passée sans texte
 * est un article qui aurait dû partir, et c'est le plus urgent de la liste.
 *
 * Best-effort de bout en bout : un article dont la rédaction échoue reste un
 * sujet, la passe suivante le reprendra, et rien de ce qui se passe ici ne
 * remonte au client — il a déjà sa page.
 */
export async function backfillUpcomingDrafts(userId: string): Promise<void> {
  if (running.has(userId)) return;

  try {
    const { tier } = await getAccess(userId);
    if (!tierAtLeast(tier, "allin")) return;

    const planned = await prisma.article.findMany({
      where: { userId, ...pendingWhere() },
      orderBy: { scheduledFor: "asc" },
      select: { id: true, title: true, keyword: true, outline: true },
    });
    if (planned.length === 0) return;

    running.add(userId);
    try {
      // Le contexte est lu une fois pour toute la passe : il ne change pas d'un
      // article à l'autre, et le relire dix fois ferait dix fois les six
      // requêtes du tableau de bord.
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
    console.error("Rédaction des articles à venir échouée :", err);
  }
}

/**
 * Les sujets que la file prend en charge : sans texte, et datés d'ici la fin de
 * la semaine suivante.
 *
 * Un sujet sans date n'en fait pas partie. Le planning en date toujours un ;
 * s'il en restait un sans, il attendrait que le client le demande depuis son
 * atelier, plutôt que de passer devant des articles qui, eux, ont une date à
 * tenir.
 */
function pendingWhere() {
  return {
    status: "planned",
    body: "",
    scheduledFor: { not: null, lte: draftHorizon() },
  } as const;
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
 * Cet article attend-il son tour dans la file ?
 *
 * Lu par l'atelier : un article vide dont le sujet tombe dans les deux semaines
 * couvertes n'est pas un article vide, c'est un article dont le tour n'est pas
 * venu. L'écran le dit alors — et montre la rédaction en cours — plutôt que de
 * laisser le client devant une page blanche.
 *
 * Un sujet plus lointain, lui, ne promet rien : son atelier propose de le faire
 * écrire, ce qui est exactement ce qui l'attend.
 */
export async function isQueuedForDrafting(
  userId: string,
  article: { status: string; body: string; scheduledFor: Date | null },
): Promise<boolean> {
  if (article.status !== "planned" || article.body.trim().length > 0) return false;
  if (!article.scheduledFor || article.scheduledFor > draftHorizon()) return false;

  const { tier } = await getAccess(userId);
  return tierAtLeast(tier, "allin");
}
