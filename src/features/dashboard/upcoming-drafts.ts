import "server-only";

import { prisma } from "@/lib/prisma";
import {
  BOOST_DRAFTED_ARTICLES,
  draftableArticles,
  tierAtLeast,
  type AccessTier,
} from "@/constants/access";
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
 * Le Coup de Boost passe par la même file, avec une autre borne : sa semaine.
 * Les cinq premiers articles du planning s'écrivent dès son arrivée, et s'y
 * arrêtent. Le mois entier reste posé au calendrier — c'est ce qui montre ce que
 * son site publierait dans la durée —, mais les sujets suivants gardent leurs
 * titres, avec l'abonnement en face.
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
    if (!tierAtLeast(tier, "boost")) return;

    const planned = await draftableQueue(userId, tier);
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
 * Les sujets que la file prend en charge, dans l'ordre du planning.
 *
 * Deux bornes selon l'offre, et une seule question au bout : cet article-là
 * est-il de ceux qu'on a vendus ?
 *
 * L'abonnement borne par la date — la fin de la semaine suivante — et la borne
 * avance à chaque visite. Le Coup de Boost borne par le compte : sa semaine, les
 * cinq premiers du planning, quelle que soit leur date. Un client qui achète un
 * jeudi aurait sinon deux articles pour une semaine vendue, la borne de date
 * tombant deux jours plus tard.
 *
 * Un sujet sans date reste dehors dans les deux cas. Le planning en date
 * toujours un ; s'il en restait un sans, il attendrait que le client le demande
 * depuis son atelier plutôt que de passer devant des articles qui, eux, ont une
 * date à tenir.
 */
async function draftableQueue(userId: string, tier: AccessTier): Promise<Planned[]> {
  const limit = draftableArticles(tier);

  // Le Coup de Boost : les N premiers du planning, écrits ou non. On compte
  // depuis le début, faute de quoi une reprise déjà rédigée décalerait la borne
  // et ferait entrer un sixième article dans la semaine vendue.
  if (limit !== null) {
    const firstWeek = await prisma.article.findMany({
      where: { userId, scheduledFor: { not: null } },
      orderBy: { scheduledFor: "asc" },
      take: limit,
      select: { id: true, title: true, keyword: true, outline: true, status: true, body: true },
    });
    return firstWeek
      .filter((article) => article.status === "planned" && article.body === "")
      .map(({ id, title, keyword, outline }) => ({ id, title, keyword, outline }));
  }

  return prisma.article.findMany({
    where: {
      userId,
      status: "planned",
      body: "",
      scheduledFor: { not: null, lte: draftHorizon() },
    },
    orderBy: { scheduledFor: "asc" },
    select: { id: true, title: true, keyword: true, outline: true },
  });
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
  article: { id: string; status: string; body: string; scheduledFor: Date | null },
): Promise<boolean> {
  if (article.status !== "planned" || article.body.trim().length > 0) return false;
  if (!article.scheduledFor) return false;

  const { tier } = await getAccess(userId);
  if (!tierAtLeast(tier, "boost")) return false;

  // Le Coup de Boost : sa semaine, et rien après. L'abonnement : ce qui tombe
  // d'ici la fin de la semaine suivante.
  return draftableArticles(tier) !== null
    ? withinBoostWeek(userId, article.id)
    : article.scheduledFor <= draftHorizon();
}

/**
 * L'offre du compte couvre-t-elle la rédaction de cet article ?
 *
 * La question que pose l'atelier avant d'ouvrir sa barre, et l'action serveur
 * avant d'appeler le modèle. Un Coup de Boost achète une semaine : les cinq
 * premiers articles du planning s'écrivent, les dix-sept suivants restent des
 * titres jusqu'à l'abonnement. Le reste du produit ne connaît que `canOpen`,
 * qui répond « oui » pour tout le mois — c'est vrai de l'onglet, pas de chaque
 * article.
 *
 * L'abonnement, lui, n'a pas de borne de ce genre : ce qui règle sa file est une
 * date, et un article plus lointain se rédige quand même si le client le demande
 * depuis son atelier. C'est son quota hebdomadaire qui l'arrête, pas le
 * calendrier.
 */
export async function canDraftArticle(userId: string, articleId: string): Promise<boolean> {
  const { tier } = await getAccess(userId);
  if (!tierAtLeast(tier, "boost")) return false;
  if (draftableArticles(tier) === null) return true;
  return withinBoostWeek(userId, articleId);
}

/**
 * L'article fait-il partie des premiers du planning, ceux que le Coup de Boost
 * rédige ?
 *
 * On lit les identifiants plutôt que de comparer des dates : le planning peut
 * être redaté par le client, et une borne de date laisserait alors entrer un
 * article qu'il aurait simplement avancé.
 */
async function withinBoostWeek(userId: string, articleId: string): Promise<boolean> {
  const first = await prisma.article.findMany({
    where: { userId, scheduledFor: { not: null } },
    orderBy: { scheduledFor: "asc" },
    take: BOOST_DRAFTED_ARTICLES,
    select: { id: true },
  });
  return first.some((article) => article.id === articleId);
}
