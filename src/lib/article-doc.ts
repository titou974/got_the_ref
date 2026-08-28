/**
 * Ce qu'on lit dans le document ouvert dans l'éditeur.
 *
 * L'atelier n'a plus de plan tenu à la main à côté du texte : le plan **est**
 * le document. Ces fonctions relisent le JSON Tiptap pour en tirer la structure
 * (les titres, dans l'ordre, avec leur position) et la seule mesure qui compte
 * pour un article destiné à être cité : la longueur de la réponse d'ouverture
 * de chaque section.
 *
 * Cette mesure n'est pas décorative. La rédaction reçoit une consigne précise —
 * « ouvre chaque section par une réponse directe de 40 à 60 mots, autonome,
 * citable telle quelle » (`features/dashboard/service.ts`). Le rail de gauche
 * affiche donc, section par section, si le texte tient encore ce contrat après
 * les retouches du client. C'est la seule chose qu'un éditeur de texte ordinaire
 * ne saurait pas dire ici.
 */

import type { JSONContent } from "@tiptap/core";

/** Le contrat de rédaction, en mots, pour la réponse qui ouvre une section. */
export const ANSWER_MIN = 35;
export const ANSWER_MAX = 70;

export type DocHeading = {
  /** Position du titre dans le document, pour y placer le curseur. */
  pos: number;
  level: 2 | 3;
  text: string;
  /** Mots de la réponse d'ouverture — le premier paragraphe de la section. */
  answerWords: number;
};

function textOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

function words(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Les titres du document, dans l'ordre, avec la longueur de leur ouverture.
 *
 * Les positions sont calculées comme ProseMirror les compte : le premier nœud
 * de premier niveau commence à 1, et chaque nœud occupe sa taille plus les deux
 * jetons d'ouverture et de fermeture. Sans cela, cliquer une entrée du rail
 * placerait le curseur à côté de la section visée.
 */
export function readHeadings(doc: JSONContent | null | undefined): DocHeading[] {
  const nodes = doc?.content ?? [];
  const headings: DocHeading[] = [];
  let pos = 1;

  nodes.forEach((node, index) => {
    if (node.type === "heading") {
      const next = nodes[index + 1];
      headings.push({
        pos,
        level: node.attrs?.level === 3 ? 3 : 2,
        text: textOf(node).trim(),
        answerWords: next && next.type === "paragraph" ? words(textOf(next)) : 0,
      });
    }
    pos += nodeSize(node);
  });

  return headings;
}

/** Taille d'un nœud au sens ProseMirror : contenu + les deux jetons de bornes. */
function nodeSize(node: JSONContent): number {
  if (node.type === "text") return (node.text ?? "").length;
  const inner = (node.content ?? []).reduce((total, child) => total + nodeSize(child), 0);
  return inner + 2;
}

/** Mots du corps, blocs de code exclus : c'est la longueur de lecture. */
export function countWords(doc: JSONContent | null | undefined): number {
  const walk = (node: JSONContent): number => {
    if (node.type === "codeBlock") return 0;
    if (node.type === "text") return words(node.text ?? "");
    return (node.content ?? []).reduce((total, child) => total + walk(child), 0);
  };
  return (doc?.content ?? []).reduce((total, node) => total + walk(node), 0);
}

/** L'ouverture est-elle citable telle quelle ? */
export function answerState(heading: DocHeading): "ok" | "short" | "long" | "missing" {
  if (!heading.answerWords) return "missing";
  if (heading.answerWords < ANSWER_MIN) return "short";
  if (heading.answerWords > ANSWER_MAX) return "long";
  return "ok";
}
