import type { GooglePlace, MapsAdvice, MapsAttributeAdvice } from "@/lib/apify/place-types";

/**
 * Ce qu'il y a à faire sur la fiche cette semaine, dans l'ordre.
 *
 * La page Google Maps a longtemps ouvert sur la fiche : le commerçant la
 * reconnaissait, puis devait descendre six cartes pour trouver le geste à
 * faire. On inverse — la page ouvre sur trois gestes datés, la fiche passe en
 * carte compacte à droite, et le détail se range dessous.
 *
 * L'ordre n'est pas un réglage : il suit ce qui rapporte le plus vite sur une
 * fiche Google. Les avis d'abord — Google mesure le délai de réponse, et un
 * client qui lit une réponse revient. Les textes ensuite, parce qu'ils portent
 * le mot-clé sur lequel la fiche se classe. Les cases après : trois minutes de
 * cases à cocher valent mieux qu'un post de plus. Les posts enfin, qui tiennent
 * la fiche vivante. La cohérence ferme la liste : elle ne se corrige pas ici,
 * elle se corrige sur le site.
 *
 * Trois au maximum. Une liste de sept gestes n'est plus une liste de priorités,
 * c'est le sommaire qu'on avait déjà.
 */

export type MapsTask = {
  id: string;
  /** Le geste, à l'infinitif : « Répondre à 7 avis ». */
  title: string;
  /** Où il en est, en une ligne — ce qui est prêt, ce qui manque. */
  detail: string;
  /** L'ancre de la carte qui porte le geste, plus bas dans la page. */
  anchor: string;
  /** Le verbe du bouton, celui de la carte où il mène. */
  cta: string;
};

export const MAPS_ANCHORS = {
  reviews: "avis",
  texts: "textes",
  attributes: "cases",
  posts: "posts",
  coherence: "coherence",
} as const;

export function buildMapsTasks(input: {
  place: GooglePlace;
  advice: MapsAdvice | null;
  attributes: MapsAttributeAdvice[];
  /** Avis relevés sans réponse du commerce et sans réponse rédigée ici. */
  pendingReviews: number;
  /** Réponses rédigées et pas encore marquées relues. */
  draftedReplies: number;
  posts: { status: string; scheduledFor: string | null }[];
  coherenceMismatches: number;
}): MapsTask[] {
  const { place, advice, attributes, pendingReviews, draftedReplies, posts } = input;

  const tasks: MapsTask[] = [];

  const toAnswer = pendingReviews + draftedReplies;
  if (toAnswer > 0) {
    tasks.push({
      id: "reviews",
      title: `Répondre à ${toAnswer} avis`,
      detail:
        draftedReplies > 0
          ? `${draftedReplies} réponse${draftedReplies > 1 ? "s sont écrites" : " est écrite"}, il reste à ${draftedReplies > 1 ? "les" : "la"} copier sur la fiche.`
          : "Aucune réponse n'est encore écrite. On les rédige dans votre ton.",
      anchor: MAPS_ANCHORS.reviews,
      cta: draftedReplies > 0 ? "Ouvrir" : "Écrire les réponses",
    });
  }

  const missingTexts = [
    place.ownerDescription === null ? "la présentation « À propos »" : null,
    place.description === null ? "la description courte" : null,
  ].filter((label): label is string => label !== null);

  if (missingTexts.length > 0) {
    tasks.push({
      id: "texts",
      title:
        missingTexts.length === 1
          ? `Écrire ${missingTexts[0]}`
          : "Écrire les deux textes de la fiche",
      detail: advice
        ? `Le champ est vide sur votre fiche. Texte de ${advice.about.length} signes prêt à copier.`
        : "Le champ est vide sur votre fiche. Nous pouvons l'écrire à partir de votre site.",
      anchor: MAPS_ANCHORS.texts,
      cta: advice ? "Voir le texte" : "Proposer un texte",
    });
  } else if (!advice) {
    tasks.push({
      id: "texts",
      title: "Relire les trois textes de la fiche",
      detail: "Le nom, la description et la présentation, alignés sur votre mot-clé.",
      anchor: MAPS_ANCHORS.texts,
      cta: "Proposer des textes",
    });
  }

  const missingBoxes = attributes.reduce((sum, group) => sum + group.suggested.length, 0);
  if (missingBoxes > 0) {
    const groups = attributes
      .filter((group) => group.suggested.length > 0)
      .slice(0, 2)
      .map((group) => group.group);
    tasks.push({
      id: "attributes",
      title: `Cocher ${missingBoxes} case${missingBoxes > 1 ? "s" : ""}`,
      detail: `${groups.join(" et ")} : quelques minutes dans Google Business Profile.`,
      anchor: MAPS_ANCHORS.attributes,
      cta: "Voir la liste",
    });
  }

  const upcoming = posts.filter(
    (post) => post.status !== "published" && post.scheduledFor !== null,
  ).length;
  if (upcoming < 2) {
    tasks.push({
      id: "posts",
      title: upcoming === 0 ? "Préparer les posts du mois" : "Prolonger le rythme des posts",
      detail:
        upcoming === 0
          ? "Aucun post en attente. Quatre suffisent à tenir un mois."
          : `Un seul post en attente : la fiche retombe dans deux semaines.`,
      anchor: MAPS_ANCHORS.posts,
      cta: "Ouvrir le calendrier",
    });
  }

  if (input.coherenceMismatches > 0) {
    tasks.push({
      id: "coherence",
      title: `Aligner ${input.coherenceMismatches} ligne${input.coherenceMismatches > 1 ? "s" : ""} entre la fiche et le site`,
      detail: "Google recoupe les deux : ce qui se contredit lui fait douter des deux.",
      anchor: MAPS_ANCHORS.coherence,
      cta: "Voir l'écart",
    });
  }

  return tasks.slice(0, 3);
}

/** Le compte de cases de la fiche : coché sur proposé, ce que dit l'en-tête. */
export function boxCount(attributes: MapsAttributeAdvice[]): { checked: number; total: number } {
  const checked = attributes.reduce((sum, group) => sum + group.present.length, 0);
  const missing = attributes.reduce((sum, group) => sum + group.suggested.length, 0);
  return { checked, total: checked + missing };
}
