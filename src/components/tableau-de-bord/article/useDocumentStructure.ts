"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { countWords, readHeadings, type DocHeading } from "@/lib/article-doc";

/**
 * Ce que l'écran lit dans le document ouvert : le plan, la longueur, la section
 * où se trouve le curseur.
 *
 * Le hook exige un éditeur déjà créé. `useEditor` ne rend rien tant que le
 * client n'a pas pris la main (`immediatelyRender: false`) : un abonnement posé
 * pendant ce temps-là resterait sur la valeur vide, et le rail annoncerait un
 * article de zéro mot sur un texte affiché à l'écran. Les composants qui
 * appellent ce hook ne sont donc montés qu'une fois l'éditeur prêt.
 */
export type DocumentStructure = {
  headings: DocHeading[];
  words: number;
  /** Index de la section où est le curseur, -1 avant le premier titre. */
  activeIndex: number;
};

export function useDocumentStructure(editor: Editor): DocumentStructure {
  return useEditorState({
    editor,
    selector: ({ editor }): DocumentStructure => {
      const doc = editor.getJSON();
      const headings = readHeadings(doc);
      const caret = editor.state.selection.from;

      let activeIndex = -1;
      headings.forEach((heading, index) => {
        if (heading.pos <= caret) activeIndex = index;
      });

      return { headings, words: countWords(doc), activeIndex };
    },
  });
}
