"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import {
  approveArticleAction,
  publishArticleAction,
  rejectArticleAction,
  updateArticleAction,
  writeArticleAction,
} from "@/features/dashboard/actions";
import type { OutlineSection } from "@/features/dashboard/outline";
import { buildArticlePublishPrompt } from "@/lib/geo/article-publish-prompt";
import { readHeadings } from "@/lib/article-doc";
import { BrandToneBar } from "../BrandToneBar";
import { PublishPromptPanel } from "../PublishPromptPanel";
import { SearchLoader } from "@/components/SearchLoader";
import { DocumentCanvas } from "./DocumentCanvas";
import { OutlineRail } from "./OutlineRail";
import { useDocumentStructure } from "./useDocumentStructure";

/**
 * L'atelier d'un article.
 *
 * Le corps reste stocké en Markdown — c'est ce que les connecteurs déposent sur
 * le site du client, et la structure que les moteurs de réponse lisent. Mais on
 * n'édite plus des blocs de texte brut alignés dans des zones de saisie : le
 * document est ouvert dans Tiptap, avec l'extension Markdown qui traduit dans
 * les deux sens. Ce que le modèle rend (titres de niveau 2 et 3, listes,
 * citations, gras, liens) arrive donc mis en forme, et ressort à
 * l'enregistrement dans le même Markdown, sans passe de reformatage.
 *
 * L'écran tient en trois pièces : la barre de commande, qui dit l'état de
 * l'article et porte les décisions ; le rail de citabilité à gauche, qui lit le
 * plan dans le document et signale les ouvertures de section trop courtes ou
 * trop longues pour être citées ; la feuille à droite, à la mesure de l'article
 * publié.
 */

export type EditorArticle = {
  id: string;
  title: string;
  keyword: string | null;
  outline: OutlineSection[];
  body: string;
  excerpt: string | null;
  status: string;
  revisions: number;
  scheduledFor: string | null;
  externalUrl: string | null;
};

/** L'état d'un article, dit par une couleur du système plutôt qu'un mot de plus. */
const STATUS_CLASS: Record<string, string> = {
  planned: "bg-mist text-steel",
  drafted: "bg-obsidian text-white",
  approved: "bg-success/12 text-success",
  published: "bg-success text-white",
  rejected: "bg-mist text-ash line-through",
};

export function ArticleWorkspace({
  article,
  tone,
  voice,
  canPublish,
  quotaRemaining,
  domain,
  platform,
}: {
  article: EditorArticle;
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
  voice: { instructions: string; banned: string[] } | null;
  canPublish: boolean;
  /** Rédactions encore disponibles cette semaine, lues à l'ouverture de la page. */
  quotaRemaining: number;
  /** Le domaine suivi, nommé dans le prompt de publication. */
  domain: string | null;
  /** Plateforme reconnue sur le site : elle change les consignes de dépôt. */
  platform: string | null;
}) {
  const t = useTranslations("dashboard.article");
  const router = useRouter();

  const [title, setTitle] = useState(article.title);
  const [dirty, setDirty] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [remaining, setRemaining] = useState(quotaRemaining);

  // Les consignes de section sont classées par titre : c'est la seule clé que
  // le document et le plan enregistré ont en commun une fois le texte retouché.
  const [briefs, setBriefs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      article.outline.filter((s) => s.instruction).map((s) => [s.heading, s.instruction]),
    ),
  );

  // Le prompt de publication n'existe qu'après le clic : l'assembler à
  // l'ouverture recopierait l'article entier dans le HTML envoyé au navigateur,
  // pour un bouton que la plupart des visites ne touchent pas.
  const [publishPrompt, setPublishPrompt] = useState<string | null>(null);

  const editor = useEditor({
    // Le rendu part du client : côté serveur, ProseMirror n'a pas de DOM et la
    // page casserait avant la première frappe.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Le titre de l'article est le seul H1 et vit hors du document : le
        // corps commence donc au niveau 2, comme la rédaction le produit.
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener" } },
      }),
      Markdown.configure({ markedOptions: { gfm: true } }),
      Placeholder.configure({ placeholder: () => t("bodyPlaceholder") }),
    ],
    content: article.body,
    contentType: "markdown",
    onUpdate: () => setDirty(true),
    editorProps: {
      attributes: { class: "tiptap", spellcheck: "true" },
    },
  });

  /* ------------------------------- Actions -------------------------------- */

  const save = useAction(updateArticleAction, {
    onSuccess: () => {
      setDirty(false);
      router.refresh();
    },
  });
  const approve = useAction(approveArticleAction, { onSuccess: () => router.refresh() });
  const publish = useAction(publishArticleAction, { onSuccess: () => router.refresh() });
  const reject = useAction(rejectArticleAction, { onSuccess: () => router.refresh() });

  const write = useAction(writeArticleAction, {
    onSuccess: ({ data }) => {
      if (typeof data?.remaining === "number") setRemaining(data.remaining);
      // La version rédigée remplace ce qui est à l'écran sans attendre un
      // aller-retour serveur : sinon le client verrait son ancien texte pendant
      // que la page se recharge, et croirait la demande perdue.
      if (data?.title) setTitle(data.title);
      if (data?.body) editor?.commands.setContent(data.body, { contentType: "markdown" });
      setInstruction("");
      setDirty(false);
      router.refresh();
    },
  });

  const busy =
    write.isPending || save.isPending || approve.isPending || publish.isPending || reject.isPending;

  const error =
    write.result.serverError ??
    save.result.serverError ??
    approve.result.serverError ??
    publish.result.serverError ??
    reject.result.serverError;

  // Le plan enregistré est celui du document : les titres tels qu'ils sont
  // écrits au moment de l'enregistrement, chacun avec sa consigne. Il est relu
  // ici plutôt que suivi dans un état : le document fait foi.
  const outlineOf = useCallback(
    (): OutlineSection[] =>
      readHeadings(editor?.getJSON())
        .filter((heading) => heading.text)
        .map((heading) => ({
          heading: heading.text,
          level: heading.level,
          instruction: briefs[heading.text] ?? "",
        })),
    [editor, briefs],
  );

  // La sauvegarde est appelée depuis un raccourci clavier : la référence doit
  // rester à jour sans réabonner l'écouteur à chaque frappe.
  const persist = useCallback(() => {
    if (!editor) return;
    save.execute({
      id: article.id,
      title,
      body: editor.getMarkdown() || " ",
      outline: outlineOf(),
    });
  }, [editor, save, article.id, title, outlineOf]);

  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        persistRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Un article retouché puis quitté par erreur est perdu : le navigateur pose
  // la question à notre place tant que rien n'est enregistré.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const jump = (pos: number) => {
    editor?.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  };

  const addSection = () => {
    editor
      ?.chain()
      .focus("end")
      .insertContent([{ type: "heading", attrs: { level: 2 } }, { type: "paragraph" }])
      .run();
    setDirty(true);
  };

  /* -------------------------------- Rendu --------------------------------- */

  return (
    <div className="space-y-4">
      <BrandToneBar tone={tone} voice={voice} />

      {/* Barre de commande : l'état de l'article à gauche, ce qu'on peut en
          décider à droite. Elle ne bouge pas quand on descend dans le texte. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card-compact border border-border bg-surface px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
              STATUS_CLASS[article.status] ?? "bg-mist text-steel"
            }`}
          >
            {t(`status.${article.status}`)}
          </span>
          {editor ? <WordCount editor={editor} /> : null}
          <span
            className={`flex items-center gap-1.5 text-[12px] ${dirty ? "text-warning" : "text-muted"}`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-pill ${dirty ? "bg-warning" : "bg-success"}`}
            />
            {dirty ? t("unsaved") : t("savedState")}
          </span>
          {article.revisions > 0 ? (
            <span className="text-[12px] text-muted">
              {t("revisions")} : {article.revisions}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !editor}
            onClick={persist}
            className="cursor-pointer rounded-pill border border-graphite px-4 py-2 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60"
          >
            {save.isPending ? t("saving") : t("save")}
          </button>

          {article.status === "drafted" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => approve.execute({ id: article.id })}
              className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
            >
              {t("approve")}
            </button>
          ) : null}

          {article.status === "approved" && canPublish ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => publish.execute({ id: article.id })}
              className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
            >
              {publish.isPending ? t("publishing") : t("publish")}
            </button>
          ) : null}

          {/* Site non rattaché : « publier maintenant » ne dépose pas, il écrit
              le prompt qui dépose. Le geste reste le même pour le client. */}
          {article.status === "approved" && !canPublish ? (
            <button
              type="button"
              disabled={busy || !editor}
              onClick={() =>
                setPublishPrompt(
                  buildArticlePublishPrompt({
                    title,
                    keyword: article.keyword,
                    excerpt: article.excerpt,
                    body: editor?.getMarkdown() ?? article.body,
                    scheduledFor: article.scheduledFor,
                    domain,
                    platform,
                  }),
                )
              }
              className="cursor-pointer rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
            >
              {t("publishNow")}
            </button>
          ) : null}

          {article.status !== "published" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => reject.execute({ id: article.id })}
              className="cursor-pointer text-sm text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-danger"
            >
              {t("drop")}
            </button>
          ) : null}
        </div>
      </div>

      {publishPrompt ? <PublishPromptPanel prompt={publishPrompt} /> : null}

      {error ? (
        <p className="rounded-card-compact border border-danger/30 bg-danger/5 px-5 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
        {/* --------------------------- Rail de gauche --------------------- */}
        <div className="order-2 space-y-4 lg:sticky lg:top-3 lg:order-1">
          {editor ? (
            <OutlineRail
              editor={editor}
              instructions={briefs}
              onInstruction={(heading, value) => {
                setBriefs((current) => ({ ...current, [heading]: value }));
                setDirty(true);
              }}
              onJump={jump}
              onAddSection={addSection}
            />
          ) : (
            <div className="h-52 rounded-card-compact border border-border bg-surface" />
          )}

          <section className="rounded-card-compact border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">{t("rewrite")}</h2>
            <p className="mt-0.5 mb-3 text-[13px] leading-relaxed text-muted">{t("rewriteHint")}</p>

            <textarea
              value={instruction}
              rows={3}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={t("instructionPlaceholder")}
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm focus:ring-2 focus:ring-obsidian/20 focus:outline-none"
            />

            {article.keyword ? (
              <p className="mt-3 text-[13px]">
                <span className="text-[11px] font-semibold tracking-wider text-steel uppercase">
                  {t("keyword")}
                </span>
                <span className="mt-0.5 block">{article.keyword}</span>
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy || remaining <= 0}
              onClick={() =>
                write.execute({ id: article.id, instruction: instruction.trim() || undefined })
              }
              className="mt-3 w-full cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {write.isPending
                ? t("writing")
                : article.body.trim()
                  ? t("rewriteCta")
                  : t("writeCta")}
            </button>

            {/* Le budget de la semaine, sous le bouton qui le consomme : c'est
                là qu'il pèse dans la décision de relancer une reprise. */}
            <p className="mt-2 text-xs text-muted">
              {remaining > 0
                ? `${remaining} rédaction${remaining > 1 ? "s" : ""} restante${
                    remaining > 1 ? "s" : ""
                  } cette semaine. Une reprise en consomme une.`
                : "Rédactions de la semaine épuisées. Votre brouillon reste modifiable à la main."}
            </p>

            {write.isPending ? (
              <SearchLoader kind="writing" compact title={t("writing")} className="mt-3" />
            ) : null}
          </section>

          {article.externalUrl ? (
            <a
              href={article.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block cursor-pointer rounded-card-compact border border-border bg-surface px-5 py-3.5 text-sm font-medium underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:decoration-obsidian"
            >
              {t("seeOnline")}
            </a>
          ) : null}
        </div>

        {/* ------------------------------ La feuille ---------------------- */}
        <div className="order-1 min-w-0 lg:order-2">
          {editor ? (
            <DocumentCanvas
              editor={editor}
              title={title}
              onTitleChange={(value) => {
                setTitle(value);
                setDirty(true);
              }}
            />
          ) : (
            <div className="h-[60vh] rounded-card border border-border bg-surface" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * La longueur du document, dans la barre de commande.
 *
 * Séparée du reste de l'écran : elle change à chaque frappe, et redessiner la
 * page entière pour un compteur ferait ramer un article de mille mots.
 */
function WordCount({ editor }: { editor: Editor }) {
  const t = useTranslations("dashboard.article");
  const { words } = useDocumentStructure(editor);

  return <span className="text-[12px] tabular-nums text-muted">{t("words", { count: words })}</span>;
}
