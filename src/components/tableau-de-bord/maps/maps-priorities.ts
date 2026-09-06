import type { GooglePlace, MapsAdvice, MapsAttributeAdvice } from "@/lib/apify/place-types";
import { placeChecks } from "./PlaceInsights";

/**
 * Ce qu'il y a à corriger sur la fiche, dans l'ordre, et où ça se corrige.
 *
 * La page Google Maps a longtemps ouvert sur la fiche : le commerçant la
 * reconnaissait, puis descendait six cartes pour trouver le geste à faire. On
 * inverse — la page n'est plus qu'une liste de chantiers, et chaque chantier
 * s'ouvre là où on a cliqué, dans un tiroir qui porte la correction. Rien ne
 * traîne plus au bas de l'écran « au cas où ».
 *
 * Deux exceptions gardent leur carte sur la page : les avis et les posts. Ce
 * sont des ateliers, pas des corrections — on y revient plusieurs fois, on y
 * relit, on copie au fil de la semaine. Les enfermer dans un tiroir ferait
 * rouvrir le tiroir dix fois.
 *
 * L'ordre n'est pas un réglage : il suit ce qui rapporte le plus vite sur une
 * fiche Google. Les avis d'abord — Google mesure le délai de réponse, et un
 * client qui lit une réponse revient. Les trois textes ensuite, parce qu'ils
 * portent le mot-clé sur lequel la fiche se classe, du nom vers la
 * présentation. Les cases après : trois minutes de cases valent mieux qu'un
 * post de plus. Les champs vides, puis les contradictions avec le site, qui ne
 * se corrigent pas ici mais sur le site. Les posts ferment la marche, parce
 * qu'ils entretiennent plutôt qu'ils ne réparent.
 *
 * Rien n'est tronqué : la liste montre tous les chantiers ouverts. Un compte de
 * gestes qu'on ne voit pas est un compte auquel on ne croit pas.
 */

/** Où se fait la correction : dans le tiroir, ou sur une carte de la page. */
export type MapsTaskTarget = { kind: "drawer" } | { kind: "anchor"; anchor: string };

export type MapsTask = {
  id: MapsTaskId;
  /** Le geste, à l'infinitif : « Répondre à 7 avis ». */
  title: string;
  /** Où il en est, en une ligne — ce qui est prêt, ce qui manque. */
  detail: string;
  target: MapsTaskTarget;
  /** Le verbe du bouton, celui de ce qui s'ouvre. */
  cta: string;
};

export type MapsTaskId =
  | "reviews"
  | "name"
  | "description"
  | "about"
  | "attributes"
  | "fields"
  | "coherence"
  | "posts";

export const MAPS_ANCHORS = {
  reviews: "avis",
  posts: "posts",
} as const;

const drawer: MapsTaskTarget = { kind: "drawer" };

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
      target: { kind: "anchor", anchor: MAPS_ANCHORS.reviews },
      cta: draftedReplies > 0 ? "Ouvrir" : "Écrire les réponses",
    });
  }

  // Les trois textes, un chantier chacun : ils se corrigent séparément dans
  // Google Business Profile, à trois endroits différents du back-office.
  const nameChanged = advice !== null && advice.title.trim() !== place.title.trim();
  if (nameChanged || advice === null) {
    tasks.push({
      id: "name",
      title: nameChanged ? "Changer le nom de la fiche" : "Relire le nom de la fiche",
      detail: nameChanged
        ? `Nom proposé, aligné sur « ${advice.keyword ?? "votre mot-clé"} ».`
        : "Le nom que Google affiche en tête, et sur lequel il vous classe.",
      target: drawer,
      cta: nameChanged ? "Voir le nom" : "Proposer un nom",
    });
  }

  pushText({
    tasks,
    id: "description",
    label: "la description courte",
    hint: "Les deux lignes sous le nom, dans les résultats et en tête de fiche.",
    current: place.description,
    proposed: advice?.description ?? null,
  });

  pushText({
    tasks,
    id: "about",
    label: "la présentation « À propos »",
    hint: "Le texte que vous écrivez vous-même dans Google Business Profile.",
    current: place.ownerDescription,
    proposed: advice?.about ?? null,
  });

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
      target: drawer,
      cta: "Voir la liste",
    });
  }

  const missingFields = placeChecks(place).filter((check) => !check.ok);
  if (missingFields.length > 0) {
    tasks.push({
      id: "fields",
      title: `Remplir ${missingFields.length} champ${missingFields.length > 1 ? "s" : ""} de la fiche`,
      detail: `${missingFields
        .slice(0, 3)
        .map((check, index) => (index === 0 ? check.label : check.label.toLowerCase()))
        .join(", ")}${missingFields.length > 3 ? "…" : ""}`,
      target: drawer,
      cta: "Voir les champs",
    });
  }

  if (input.coherenceMismatches > 0) {
    tasks.push({
      id: "coherence",
      title: `Aligner ${input.coherenceMismatches} ligne${input.coherenceMismatches > 1 ? "s" : ""} entre la fiche et le site`,
      detail: "Google recoupe les deux : ce qui se contredit lui fait douter des deux.",
      target: drawer,
      cta: "Voir l'écart",
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
          : "Un seul post en attente : la fiche retombe dans deux semaines.",
      target: { kind: "anchor", anchor: MAPS_ANCHORS.posts },
      cta: "Ouvrir le calendrier",
    });
  }

  return tasks;
}

/**
 * Un texte de fiche devient un chantier dans deux cas : le champ est vide, ou
 * la réécriture proposée ne dit pas la même chose que ce qui est en ligne. Un
 * texte écrit et conforme à la proposition n'a plus rien à demander.
 */
function pushText({
  tasks,
  id,
  label,
  hint,
  current,
  proposed,
}: {
  tasks: MapsTask[];
  id: "description" | "about";
  label: string;
  hint: string;
  current: string | null;
  proposed: string | null;
}): void {
  const empty = current === null || current.trim().length === 0;
  const differs = proposed !== null && !empty && proposed.trim() !== current.trim();

  if (!empty && !differs) return;

  tasks.push({
    id,
    title: empty ? `Écrire ${label}` : `Réécrire ${label}`,
    detail: empty
      ? proposed
        ? `Le champ est vide sur votre fiche. Texte de ${proposed.length} signes prêt à copier.`
        : `Le champ est vide sur votre fiche. ${hint}`
      : "Une version alignée sur votre mot-clé vous attend.",
    target: drawer,
    cta: proposed ? "Voir le texte" : "Proposer un texte",
  });
}

/** Le compte de cases de la fiche : coché sur proposé, ce que dit l'en-tête. */
export function boxCount(attributes: MapsAttributeAdvice[]): { checked: number; total: number } {
  const checked = attributes.reduce((sum, group) => sum + group.present.length, 0);
  const missing = attributes.reduce((sum, group) => sum + group.suggested.length, 0);
  return { checked, total: checked + missing };
}

/**
 * La même liste, pour un compte gratuit : un chantier par élément de la fiche.
 *
 * La liste payante ne montre que ce qui cloche — c'est ce qu'on attend d'un
 * plan de travail. Un compte gratuit, lui, vient d'apprendre que sa fiche
 * existe chez nous : lui rendre trois lignes parce que sa description est déjà
 * écrite ne lui apprend pas ce que le produit fait de sa fiche. Il reçoit donc
 * les huit chantiers, dans le même ordre, avec les comptes réels là où ils
 * existent — sept avis sans réponse, quatre cases vides — et l'annonce du geste
 * là où il n'y a rien à compter.
 *
 * Rien n'est rédigé pour autant : aucun de ces chantiers n'appelle un modèle.
 * Ils disent ce qui va être écrit, et leur tiroir montre la place de la
 * correction sous voile (cf. `MapsVeil`). C'est la promesse tenue à l'envers de
 * l'habitude : on montre l'emplacement exact du travail, pas le travail.
 */
export function buildMapsPreviewTasks(input: {
  place: GooglePlace;
  attributes: MapsAttributeAdvice[];
  /** Avis relevés sans réponse du commerce. */
  pendingReviews: number;
  coherenceMismatches: number;
}): MapsTask[] {
  const { place, attributes, pendingReviews } = input;

  const missingBoxes = attributes.reduce((sum, group) => sum + group.suggested.length, 0);
  const missingFields = placeChecks(place).filter((check) => !check.ok);
  const mismatches = input.coherenceMismatches;

  return [
    {
      id: "reviews",
      title: pendingReviews > 0 ? `Répondre à ${pendingReviews} avis` : "Répondre à vos avis",
      detail:
        pendingReviews > 0
          ? "Google mesure votre délai de réponse, et un client qui lit une réponse revient."
          : "Chaque nouvel avis reçoit sa réponse, écrite dans le ton relevé sur votre site.",
      target: { kind: "anchor", anchor: MAPS_ANCHORS.reviews },
      cta: "Ouvrir",
    },
    {
      id: "name",
      title: "Renforcer le nom de la fiche",
      detail: "Le nom que Google affiche en tête, et sur lequel il vous classe.",
      target: drawer,
      cta: "Voir la correction",
    },
    {
      id: "description",
      title: place.description ? "Réécrire la description courte" : "Écrire la description courte",
      detail: place.description
        ? "Les deux lignes sous le nom, alignées sur le mot-clé de votre site."
        : "Le champ est vide sur votre fiche : ce sont les deux lignes sous votre nom.",
      target: drawer,
      cta: "Voir la correction",
    },
    {
      id: "about",
      title: place.ownerDescription
        ? "Réécrire la présentation « À propos »"
        : "Écrire la présentation « À propos »",
      detail: place.ownerDescription
        ? "Le texte que les assistants citent quand on demande ce que vous faites."
        : "Le champ est vide : c'est le seul texte de la fiche que vous écrivez vous-même.",
      target: drawer,
      cta: "Voir la correction",
    },
    {
      id: "attributes",
      title: missingBoxes > 0 ? `Cocher ${missingBoxes} case${missingBoxes > 1 ? "s" : ""}` : "Revoir vos cases",
      detail:
        missingBoxes > 0
          ? "Les cases que Google propose à votre catégorie, et que votre fiche n'a pas cochées."
          : "Ce que Google propose de cocher pour votre catégorie, trié pour votre commerce.",
      target: drawer,
      cta: "Voir la correction",
    },
    {
      id: "fields",
      title:
        missingFields.length > 0
          ? `Remplir ${missingFields.length} champ${missingFields.length > 1 ? "s" : ""} de la fiche`
          : "Relire les champs de la fiche",
      detail:
        missingFields.length > 0
          ? "Ce que Google vous laisse remplir et que vous n'avez pas rempli."
          : "Photos, horaires, téléphone, site : ce que Google attend d'une fiche tenue.",
      target: drawer,
      cta: "Voir la correction",
    },
    {
      id: "coherence",
      title:
        mismatches > 0
          ? `Aligner ${mismatches} ligne${mismatches > 1 ? "s" : ""} entre la fiche et le site`
          : "Comparer la fiche et le site",
      detail: "Google recoupe les deux : ce qui se contredit lui fait douter des deux.",
      target: drawer,
      cta: "Voir la correction",
    },
    {
      id: "posts",
      title: "Préparer les posts du mois",
      detail: "Quatre posts suffisent à tenir un mois. Ils s'écrivent d'après vos avis et vos photos.",
      target: { kind: "anchor", anchor: MAPS_ANCHORS.posts },
      cta: "Ouvrir le calendrier",
    },
  ];
}
