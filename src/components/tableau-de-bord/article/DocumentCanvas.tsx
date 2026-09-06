"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useTranslations } from "next-intl";
import { AutoTextarea } from "../AutoTextarea";

/**
 * La feuille : le titre, le texte, et les outils posés en marge.
 *
 * Tout ce qui est écrit ici reste du Markdown — l'extension `@tiptap/markdown`
 * fait la traduction dans les deux sens. Le client ne voit ni dièse ni
 * astérisque, mais ce qui part en base est exactement le format que les
 * connecteurs déposent sur son site et que les moteurs de réponse relisent.
 *
 * La feuille est en serif, l'interface en sans : on écrit dans la forme de
 * l'article publié, pas dans une zone de formulaire. Elle n'a plus de carte
 * autour d'elle — dans un atelier plein écran, un cadre blanc posé sur fond
 * clair dessinait une boîte là où il n'y a qu'une page.
 *
 * Les outils ont quitté le bandeau horizontal pour un rail vertical en marge
 * droite. Une barre en tête de colonne prenait toute la largeur de lecture pour
 * dix boutons, et repoussait le titre de l'article sous la ligne de flottaison ;
 * en marge, le rail tient hors de la mesure du texte et reste à portée de
 * curseur. Sur téléphone il disparaît : la mise en forme s'y prend à la
 * sélection, dans la bulle, et un rail aurait mangé un sixième de l'écran.
 *
 * Les états actifs passent par `useEditorState` : depuis la v3, le composant ne
 * se redessine plus à chaque transaction, et un `isActive()` lu pendant le rendu
 * resterait figé sur la première frappe.
 */

type CommandId =
  | "p"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "quote"
  | "code"
  | "bold"
  | "italic"
  | "link";

/** Le rail : la structure d'abord, puis la mise en forme, puis l'historique. */
const RAIL_BLOCKS: CommandId[] = ["p", "h2", "h3"];
const RAIL_MARKS: CommandId[] = ["bold", "italic", "quote", "ul"];
/** Ce qui sert vraiment sur une sélection : la mise en forme, puis la structure. */
const BUBBLE: CommandId[] = ["bold", "italic", "link", "h2", "h3", "ul"];

export function DocumentCanvas({
  editor,
  title,
  onTitleChange,
  preview = false,
  children,
}: {
  editor: Editor;
  title: string;
  onTitleChange: (value: string) => void;
  /** L'aperçu : la page telle qu'elle sera lue, sans outil autour. */
  preview?: boolean;
  /** Ce qui précède le titre dans la mesure de la feuille — les pastilles du
   *  téléphone, un message d'erreur, le prompt de dépôt. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("dashboard.article");

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      p: editor.isActive("paragraph"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      ul: editor.isActive("bulletList"),
      ol: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      code: editor.isActive("codeBlock"),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      link: editor.isActive("link"),
    }),
  });

  /** Pose un lien sur la sélection, ou le retire si l'adresse est vidée. */
  const setLink = useCallback(() => {
    const current = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("linkPrompt"), current ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  }, [editor, t]);

  const run = useCallback(
    (id: CommandId) => {
      const chain = editor.chain().focus();
      switch (id) {
        case "p":
          return chain.setParagraph().run();
        case "h2":
          return chain.toggleHeading({ level: 2 }).run();
        case "h3":
          return chain.toggleHeading({ level: 3 }).run();
        case "ul":
          return chain.toggleBulletList().run();
        case "ol":
          return chain.toggleOrderedList().run();
        case "quote":
          return chain.toggleBlockquote().run();
        case "code":
          return chain.toggleCodeBlock().run();
        case "bold":
          return chain.toggleBold().run();
        case "italic":
          return chain.toggleItalic().run();
        case "link":
          return setLink();
      }
    },
    [editor, setLink],
  );

  return (
    <div className="relative min-h-0 flex-1">
      {/* La colonne de lecture défile seule : la barre du haut et le rail de
          gauche restent en place, comme dans un traitement de texte. La réserve
          du bas dégage la pilule de décision, qui flotte au-dessus. */}
      <div className="h-full overflow-y-auto px-5 pb-56 pt-8 sm:px-8 lg:pb-32 lg:pt-10">
        <div className="mx-auto max-w-[42rem]">
          {children}

          <AutoTextarea
            value={title}
            onValueChange={onTitleChange}
            placeholder={t("titlePlaceholder")}
            aria-label={t("titlePlaceholder")}
            readOnly={preview}
            className="article-title w-full resize-none bg-transparent focus:outline-none"
          />
          <div aria-hidden className="mb-6 mt-3.5 h-px w-14 bg-obsidian/15 lg:mb-8 lg:mt-4 lg:w-16" />

          <EditorContent editor={editor} className="article-canvas" />
        </div>
      </div>

      {/* Le rail d'outils, en marge droite de la feuille. Il ne défile pas avec
          le texte : il est posé sur la colonne, pas dedans. */}
      {preview ? null : (
        <div className="absolute right-6 top-10 z-10 hidden flex-col gap-0.5 rounded-pill border border-border bg-surface p-1.5 shadow-[var(--shadow-md)] lg:flex">
          {RAIL_BLOCKS.map((id) => (
            <RailButton key={id} label={t(`toolbar.${id}`)} on={active[id]} onClick={() => run(id)}>
              <Glyph id={id} />
            </RailButton>
          ))}

          <span aria-hidden className="mx-2 my-1 h-px bg-fog" />

          {RAIL_MARKS.map((id) => (
            <RailButton key={id} label={t(`toolbar.${id}`)} on={active[id]} onClick={() => run(id)}>
              <Glyph id={id} />
            </RailButton>
          ))}

          <span aria-hidden className="mx-2 my-1 h-px bg-fog" />

          <RailButton
            label={t("toolbar.undo")}
            on={false}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Icon path="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 0 14h-3" />
          </RailButton>
          <RailButton
            label={t("toolbar.redo")}
            on={false}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Icon path="M15 14l5-5-5-5m5 5h-9a7 7 0 0 0 0 14h3" />
          </RailButton>
        </div>
      )}

      {preview ? null : (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 10 }}
          className="flex items-center gap-0.5 rounded-pill border border-graphite/60 bg-obsidian px-1.5 py-1 shadow-md"
        >
          {BUBBLE.map((id) => (
            <button
              key={`bubble-${id}`}
              type="button"
              title={t(`toolbar.${id}`)}
              aria-label={t(`toolbar.${id}`)}
              aria-pressed={active[id]}
              onClick={() => run(id)}
              className={`cursor-pointer rounded-pill px-2.5 py-1 text-[12px] font-semibold transition-colors duration-200 ${
                active[id] ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
              }`}
            >
              <Glyph id={id} />
            </button>
          ))}
        </BubbleMenu>
      )}
    </div>
  );
}

/** Un bouton du rail : un rond de trente-quatre pixels, la commande dedans. */
function RailButton({
  label,
  on,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${
        on ? "bg-mist text-obsidian" : "text-steel hover:bg-mist hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Chaque commande se nomme par ce qu'elle produit, pas par une icône passe-partout. */
function Glyph({ id }: { id: CommandId }) {
  switch (id) {
    case "h2":
      return <span className="article-glyph text-[14px]">H2</span>;
    case "h3":
      return <span className="article-glyph text-[14px]">H3</span>;
    case "p":
      return <span className="article-glyph text-[14px]">P</span>;
    case "ul":
      return <Icon path="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />;
    case "ol":
      return <span className="tabular-nums">1.</span>;
    case "quote":
      return <span className="text-[13px] font-medium">«»</span>;
    case "code":
      return <span>{"</>"}</span>;
    case "bold":
      return <span className="text-[14px] font-extrabold">G</span>;
    case "italic":
      return <span className="article-glyph text-[15px] font-normal italic">I</span>;
    case "link":
      return (
        <Icon path="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
      );
  }
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="inline-block">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
