"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import {
  rejectArticleAction,
  updateArticleAction,
  writeArticleAction,
} from "@/features/dashboard/actions";
import type { OutlineSection } from "@/features/dashboard/outline";
import { buildArticlePublishPrompt } from "@/lib/geo/article-publish-prompt";
import { readHeadings } from "@/lib/article-doc";
import { lockScroll } from "@/lib/scroll-lock";
import {
  PUBLISH_HOUR_IS_CHOSEN,
  formatPublishDateShort,
  formatPublishTime,
  preferredPassOnDay,
  splitPublishInstant,
} from "@/constants/publishing";
import { ROUTES } from "@/constants/routes";
import { PublishPromptPanel } from "../PublishPromptPanel";
import { ArticleActionBar } from "./ArticleActionBar";
import { DocumentCanvas } from "./DocumentCanvas";
import { OutlineRail } from "./OutlineRail";
import { RewriteBar } from "./RewriteBar";
import { WritingScene } from "./WritingScene";
import { useDocumentStructure } from "./useDocumentStructure";

/**
 * L'atelier d'un article : un écran entier, rien d'autre dessus.
 *
 * Le corps reste stocké en Markdown — c'est ce que les connecteurs déposent sur
 * le site du client, et la structure que les moteurs de réponse lisent. Mais on
 * n'édite plus des blocs de texte brut alignés dans des zones de saisie : le
 * document est ouvert dans Tiptap, avec l'extension Markdown qui traduit dans
 * les deux sens. Ce que le modèle rend (titres de niveau 2 et 3, listes,
 * citations, gras, liens) arrive donc mis en forme, et ressort à
 * l'enregistrement dans le même Markdown, sans passe de reformatage.
 *
 * L'atelier sort du tableau de bord et prend l'écran. Il en occupait la colonne
 * de contenu, entre la navigation de gauche, le bandeau de titre et la barre des
 * agents : la feuille finissait à quarante pour cent de la largeur, et un
 * article de mille mots se lisait dans une fenêtre. Écrire est un travail à part
 * — le seul du produit qui demande de rester concentré sur un texte — et il
 * mérite qu'on ferme le reste. La sortie est nommée en haut à gauche, elle est
 * la première chose de l'écran.
 *
 * Trois zones, et une décision. En haut, une barre sombre : la sortie, l'état
 * d'enregistrement, le jour de départ au centre, la longueur du texte et
 * l'aperçu. À gauche, le sommaire, qui lit le plan dans le document et mesure la
 * citabilité de chaque ouverture. Au milieu, la feuille, à la mesure de
 * l'article publié, avec ses outils en marge. En bas, une seule pilule : ce que
 * devient cet article.
 *
 * Sur téléphone, la même chose sans le rail : la barre du haut se fait claire,
 * le sommaire passe dans un tiroir, et les gestes tiennent au pouce en bas de
 * l'écran.
 */

/** Rythme et durée du guet, quand la rédaction tourne en tâche de fond. */
const AUTO_WRITING_POLL_MS = 8_000;
const AUTO_WRITING_POLLS = 38;

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

export function ArticleWorkspace({
  article,
  canPublish,
  linked,
  locked = false,
  quotaRemaining,
  domain,
  platform,
  tone = null,
  voice = null,
  autoWriting = false,
}: {
  article: EditorArticle;
  canPublish: boolean;
  /** Un site est rattaché, même s'il n'accepte pas le dépôt automatique. */
  linked: boolean;
  /**
   * L'offre du compte n'ouvre pas la rédaction.
   *
   * Le sujet reste lisible — titre, mot-clé, plan : c'est ce qu'on a préparé
   * pour ce client, et le lui cacher n'aurait rien vendu. Ce qui disparaît,
   * c'est ce qui fait partir l'article : la barre du bas mène alors aux tarifs,
   * et le champ de reprise avec elle. Les actions correspondantes sont de toute
   * façon refusées côté serveur (`requireSection`) ; ce verrou-ci évite au
   * client de les découvrir par un message d'erreur.
   */
  locked?: boolean;
  /** Rédactions encore disponibles cette semaine, lues à l'ouverture de la page. */
  quotaRemaining: number;
  /** Le domaine suivi, nommé dans le prompt de publication. */
  domain: string | null;
  /** Plateforme reconnue sur le site : elle change les consignes de dépôt. */
  platform: string | null;
  /**
   * Le ton relevé sur le site du client, posé au pied du rail.
   *
   * Nul sur les offres qui ne font pas écrire : la page ne le passe que pour la
   * démo, l'abonnement et le Coup de Boost, les seules où il est relevé.
   */
  tone?: { summary: string | null; color: string | null; sampleUrl: string | null } | null;
  /** Les consignes de voix du client, lues sous le relevé. */
  voice?: { instructions: string; banned: string[] } | null;
  /**
   * L'article attend son tour dans la file de rédaction de l'abonnement.
   *
   * Le client n'a rien lancé : son texte s'écrit en tâche de fond, et sans ce
   * signal l'atelier lui montrerait une page blanche sans rien dire, comme si
   * l'article avait été oublié.
   */
  autoWriting?: boolean;
}) {
  const t = useTranslations("dashboard.article");
  const router = useRouter();

  const [title, setTitle] = useState(article.title);
  const [dirty, setDirty] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [remaining, setRemaining] = useState(quotaRemaining);

  /** L'aperçu : la feuille seule, sans outil ni sommaire, et non modifiable. */
  const [preview, setPreview] = useState(false);
  /** Le sommaire en tiroir, sur téléphone. */
  const [planOpen, setPlanOpen] = useState(false);
  /** La consigne de reprise, ouverte depuis la pilule du bas. */
  const [rewriteOpen, setRewriteOpen] = useState(false);

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

  /**
   * Le jour de départ, tel que la barre du haut le montre.
   *
   * Il vit dans le même enregistrement que le texte : un article se relit, se
   * corrige et se date d'un seul geste, et deux boutons « enregistrer » pour
   * une seule page auraient demandé au client de deviner lequel garde quoi.
   *
   * Vide tant que le sujet n'est pas daté — le champ reste alors vide plutôt
   * que de proposer aujourd'hui, ce qui daterait par inadvertance un sujet que
   * personne n'a encore programmé.
   */
  const [day, setDay] = useState(() =>
    article.scheduledFor ? splitPublishInstant(article.scheduledFor).day : "",
  );

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

  /* ------------------------------- L'écran -------------------------------- */

  // L'atelier couvre la page : ce qu'il y a derrière ne doit pas défiler sous
  // lui, sans quoi la fermeture rend le tableau de bord au milieu de nulle part.
  useEffect(() => lockScroll(), []);

  // La bulle de discussion se retire le temps de l'écriture. Elle est utile
  // partout ailleurs — quelqu'un répond — mais ici elle recouvre le coin où se
  // prennent les décisions, et interrompt le seul écran du produit qui demande
  // de ne pas être interrompu.
  useEffect(() => {
    window.$crisp?.push(["do", "chat:hide"]);
    return () => {
      window.$crisp?.push(["do", "chat:show"]);
    };
  }, []);

  // L'aperçu montre l'article, il ne le modifie pas : le curseur ne doit pas
  // pouvoir y écrire une lettre qu'on croirait enregistrée.
  useEffect(() => {
    editor?.setEditable(!preview);
  }, [editor, preview]);

  /* ------------------------------- Actions -------------------------------- */

  const save = useAction(updateArticleAction, {
    onSuccess: () => {
      setDirty(false);
      router.refresh();
    },
  });
  // Valider et publier sont portés par la barre du bas, qui tient leurs
  // fenêtres de confirmation. Écarter reste ici : c'est l'atelier qui sait si
  // une autre action est déjà en cours.
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
      setRewriteOpen(false);
      setDirty(false);
      router.refresh();
    },
  });

  const busy = write.isPending || save.isPending || reject.isPending;

  const error =
    write.result.serverError ?? save.result.serverError ?? reject.result.serverError;

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
      // Le jour choisi vaut le passage de ce jour-là : la file ne repasse
      // qu'une fois, et c'est elle qui fixe l'heure. Un champ laissé vide
      // n'efface pas la date déjà posée — il ne dit rien.
      scheduledFor: day ? preferredPassOnDay(day) : undefined,
    });
  }, [editor, save, article.id, title, outlineOf, day]);

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
    setPlanOpen(false);
  };

  const addSection = () => {
    editor
      ?.chain()
      .focus("end")
      .insertContent([{ type: "heading", attrs: { level: 2 } }, { type: "paragraph" }])
      .run();
    setDirty(true);
  };

  /**
   * L'article a-t-il un texte ?
   *
   * Lu dans l'éditeur tant qu'il est monté, dans la valeur enregistrée sinon.
   * Il décide de trois libellés au pied de l'écran : sur une page blanche,
   * l'agent rédige, il ne réécrit pas.
   */
  const hasBody = Boolean(editor ? editor.getText().trim() : article.body.trim());

  /**
   * Une rédaction est en cours pour cet article.
   *
   * Deux origines, une seule scène. Le client vient de la demander, ou la file
   * de l'abonnement n'est pas encore arrivée à cet article-là
   * (`autoWriting`) : dans les deux cas il attend le même texte, et une page
   * blanche muette ne dit ni que quelqu'un écrit, ni combien de temps ça prend.
   */
  const writing = write.isPending || (autoWriting && !hasBody);

  /**
   * Le texte écrit en tâche de fond n'arrive pas tout seul à l'écran.
   *
   * Une rédaction demandée à l'écran rend son texte dans la réponse ; celle qui
   * tourne en file, non — la page a été rendue avant, et rien ne la prévient.
   * On redemande donc la page à intervalles, tant que l'article est vide, et on
   * s'arrête au bout de quelques minutes : passé ce délai, la rédaction a
   * échoué, et interroger le serveur toute la journée n'y changera rien.
   */
  useEffect(() => {
    if (!autoWriting || hasBody) return;

    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > AUTO_WRITING_POLLS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, AUTO_WRITING_POLL_MS);

    return () => clearInterval(timer);
  }, [autoWriting, hasBody, router]);

  const rail = editor ? (
    <OutlineRail
      editor={editor}
      instructions={briefs}
      keyword={article.keyword}
      onInstruction={(heading, value) => {
        setBriefs((current) => ({ ...current, [heading]: value }));
        setDirty(true);
      }}
      onJump={jump}
      onAddSection={addSection}
      tone={tone}
      voice={voice}
    />
  ) : null;

  const saved = !dirty && !save.isPending;

  /* -------------------------------- Rendu --------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface lg:bg-mist">
      {/* --------------------- La barre du haut, grand écran -------------- */}
      {/* Sombre : elle borde l'écran d'écriture au lieu de s'y fondre, et les
          trois choses qu'elle porte — sortir, dater, relire — se retrouvent
          sans quitter le texte des yeux. */}
      <div className="hidden h-15 shrink-0 items-center gap-4 bg-obsidian px-5 lg:flex">
        <Link
          href={ROUTES.dashboardArticles}
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-pill border border-graphite px-3.5 py-[7px] text-[13px] font-medium text-white transition-colors duration-200 hover:bg-white/10"
        >
          <span aria-hidden>←</span>
          {t("backShort")}
        </Link>

        <SaveState
          saved={saved}
          pending={save.isPending}
          disabled={busy || !editor}
          onSave={persist}
          className="shrink-0"
        />

        <span aria-hidden className="flex-1" />

        <DeparturePill
          day={day}
          locked={locked}
          onDay={(value) => {
            setDay(value);
            setDirty(true);
          }}
        />

        {/* L'état de la validation, contre la date : c'est elle qu'il qualifie.
            Il vivait au pied de l'écran, dans la barre des boutons, à deux
            cents pixels de la date dont il parlait. */}
        <ApprovalState status={article.status} />

        <span aria-hidden className="flex-1" />

        {editor ? (
          <DocumentMeter editor={editor} className="shrink-0 text-[13px] tabular-nums text-ash" />
        ) : null}

        <button
          type="button"
          onClick={() => setPreview((on) => !on)}
          aria-pressed={preview}
          className={`shrink-0 cursor-pointer rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
            preview
              ? "border-white bg-white text-obsidian"
              : "border-graphite text-white hover:bg-white/10"
          }`}
        >
          {preview ? t("edit") : t("preview")}
        </button>
      </div>

      {/* ---------------------- La barre du haut, téléphone --------------- */}
      <div className="flex h-13 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <Link
          href={ROUTES.dashboardArticles}
          aria-label={t("back")}
          className="cursor-pointer text-[15px] font-medium text-graphite"
        >
          <span aria-hidden>←</span>
        </Link>

        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-steel"
        >
          <span aria-hidden>☰</span>
          {t("outline")}
        </button>

        <span aria-hidden className="flex-1" />

        <SaveState saved={saved} pending={save.isPending} disabled={busy || !editor} onSave={persist} />
      </div>

      {/* ----------------------------- Le corps --------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        {preview ? null : (
          <aside className="hidden w-72 shrink-0 border-r border-border bg-surface lg:block">
            {rail}
          </aside>
        )}

        {/* La rédaction en cours, posée par-dessus la feuille.
            En calque plutôt qu'à la place de l'éditeur : le démonter puis le
            remonter perdrait le document et la position du curseur, alors qu'il
            n'y a rien à perdre — on écrit par-dessus, on ne remplace rien. */}
        {writing ? (
          <div className={`absolute inset-0 z-30 bg-surface ${preview ? "" : "lg:left-72"}`}>
            <WritingScene
              title={title}
              outline={article.outline.map((section) => section.heading)}
              auto={!write.isPending}
            />
          </div>
        ) : null}

        {editor ? (
          <DocumentCanvas
            editor={editor}
            title={title}
            preview={preview}
            onTitleChange={(value) => {
              setTitle(value);
              setDirty(true);
            }}
          >
            {/* Les pastilles du téléphone : l'état de l'article et sa date, là
                où la barre du haut n'a pas la place de les porter. */}
            <div className="mb-3.5 flex flex-wrap items-center gap-2 lg:hidden">
              <span className="rounded-pill bg-mist px-3 py-1.5 text-[11px] font-semibold text-slate">
                {t(`status.${article.status}`)}
              </span>
              <MobileDeparture
                day={day}
                locked={locked}
                onDay={(value) => {
                  setDay(value);
                  setDirty(true);
                }}
              />
            </div>

            {error ? (
              <p className="mb-5 rounded-3xl border border-danger/30 bg-danger/5 px-5 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}

            {publishPrompt ? (
              <div className="mb-6">
                <PublishPromptPanel prompt={publishPrompt} />
              </div>
            ) : null}
          </DocumentCanvas>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* ------------------------ Le pied de l'écran ---------------------- */}
      {/* Une seule colonne d'actions : la consigne de reprise s'y glisse
          au-dessus de la décision, jamais à côté.

          Rien pendant que l'article s'écrit. Le pied flotte au-dessus du corps,
          et il retombait sur la scène de rédaction : le clavier passait sous une
          pilule de boutons qui, de toute façon, ne servaient à rien — on ne
          valide pas, on ne publie pas, on ne relance pas un texte qui est en
          train d'arriver. */}
      {preview || writing ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2.5 bg-[linear-gradient(to_top,var(--color-snow)_72%,transparent)] px-4 pb-5 pt-14 lg:bg-none lg:px-6 lg:pb-6 lg:pt-0">
          {/* Sur téléphone la consigne est toujours là — c'est le geste le plus
              fréquent, et un bouton pour l'ouvrir aurait coûté un tap de plus à
              chaque reprise. Sur grand écran, elle s'ouvre depuis la pilule. */}
          <div className={`w-full max-w-[43rem] ${rewriteOpen ? "block" : "block lg:hidden"}`}>
            <RewriteBar
              value={instruction}
              onChange={setInstruction}
              onSubmit={() =>
                write.execute({ id: article.id, instruction: instruction.trim() || undefined })
              }
              pending={write.isPending}
              disabled={busy && !write.isPending}
              remaining={remaining}
              hasBody={hasBody}
              locked={locked}
            />
          </div>

          <ArticleActionBar
            articleId={article.id}
            status={article.status}
            scheduledFor={day ? preferredPassOnDay(day) : article.scheduledFor}
            hasBody={hasBody}
            canPublish={canPublish}
            locked={locked}
            domain={domain}
            externalUrl={article.externalUrl}
            onDrop={() => reject.execute({ id: article.id })}
            dropPending={busy}
            onRewrite={() => setRewriteOpen((open) => !open)}
            rewriteOpen={rewriteOpen}
            linked={linked}
            // Le rattachement se fait dans les réglages, où vit le formulaire.
            // L'atelier ne monte pas la barre des agents — il prend l'écran
            // entier — et ouvrir sa modale ici demanderait de porter tout son
            // contexte jusque dans un écran qui n'a rien à voir.
            onConnectSite={() => router.push(ROUTES.dashboardSettings)}
            onPreparePublish={() =>
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
          />
        </div>
      )}

      {/* --------------------- Le sommaire, en tiroir --------------------- */}
      {planOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("closeOutline")}
            onClick={() => setPlanOpen(false)}
            className="absolute inset-0 cursor-pointer bg-obsidian/30"
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-80 bg-surface shadow-[rgba(0,0,0,0.18)_0_10px_40px]">
            {rail}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * L'enregistrement, en un mot.
 *
 * « Enregistré » tant qu'il n'y a rien à garder — un texte, pas un bouton, parce
 * qu'il n'y a rien à cliquer. Dès la première frappe, le même endroit devient le
 * bouton qui enregistre. Une pastille de couleur et une phrase « modifications
 * non enregistrées » disaient la même chose trois fois.
 */
function SaveState({
  saved,
  pending,
  disabled,
  onSave,
  className = "",
}: {
  saved: boolean;
  pending: boolean;
  disabled: boolean;
  onSave: () => void;
  className?: string;
}) {
  const t = useTranslations("dashboard.article");

  if (saved) {
    return (
      <span className={`flex items-center gap-2 text-[13px] text-ash lg:gap-0 ${className}`}>
        <span aria-hidden className="size-1.5 rounded-pill bg-success lg:hidden" />
        {t("savedState")}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSave}
      className={`cursor-pointer rounded-pill bg-white px-3.5 py-1.5 text-[13px] font-medium text-obsidian transition-opacity duration-200 hover:opacity-90 disabled:cursor-default disabled:opacity-60 max-lg:bg-obsidian max-lg:text-white ${className}`}
    >
      {pending ? t("saving") : t("save")}
    </button>
  );
}

/**
 * L'article part-il tout seul à sa date ?
 *
 * Une pastille et deux mots, posés contre la date de publication qu'ils
 * qualifient. Tant que l'article n'est pas validé, la date affichée à côté est
 * une intention, pas un départ : sans cette mention, elle se lit comme une
 * promesse que rien ne tient.
 *
 * Un article déjà publié ou écarté ne porte rien : sa date est derrière lui, et
 * l'état de la validation n'a plus de sens pour lui.
 */
function ApprovalState({ status }: { status: string }) {
  const t = useTranslations("dashboard.articleBar");

  if (status === "published" || status === "rejected") return null;

  const approved = status === "approved";

  return (
    <span className="flex shrink-0 items-center gap-2 text-[13px] text-ash">
      <span
        aria-hidden
        className={`size-[7px] shrink-0 rounded-pill ${approved ? "bg-success" : "bg-warning"}`}
      />
      {approved ? t("validated") : t("notValidated")}
    </span>
  );
}

/**
 * Le jour de départ, au centre de la barre.
 *
 * Il s'écrit comme on le dit — « mar. 8 sept. · 09:00 » — et se change dans un
 * petit panneau, sous la pilule. Le sélecteur de date nu occupait la même place
 * en affichant « 08/09/2026 » : c'est la même information, dans la langue de la
 * machine, et l'heure de départ n'y figurait pas du tout.
 */
function DeparturePill({
  day,
  locked,
  onDay,
}: {
  day: string;
  locked: boolean;
  onDay: (value: string) => void;
}) {
  const t = useTranslations("dashboard.article");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const departure = day ? new Date(preferredPassOnDay(day)) : null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={locked}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2.5 rounded-pill bg-white px-4 py-2 text-[13px] font-semibold text-obsidian transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="font-medium text-steel">{t("departure")}</span>
        {departure ? (
          <span className="tabular-nums">
            {formatPublishDateShort(departure)} · {formatPublishTime(departure)}
          </span>
        ) : (
          <span className="text-steel">{t("noDate")}</span>
        )}
      </button>

      {open ? (
        <div className="absolute left-1/2 top-[calc(100%+10px)] z-10 w-72 -translate-x-1/2 rounded-3xl border border-border bg-snow p-4 shadow-[rgba(0,0,0,0.12)_0_10px_28px]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
              {t("departureDay")}
            </span>
            <input
              type="date"
              value={day}
              autoFocus
              onChange={(event) => onDay(event.target.value)}
              className="h-11 w-full cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
            />
          </label>

          {/* L'heure est annoncée, pas demandée : la file ne repasse qu'une fois
              par jour, et un sélecteur d'heure promettrait une maîtrise que le
              service n'a pas. */}
          {PUBLISH_HOUR_IS_CHOSEN ? null : (
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              {t("fixedHour", {
                time: formatPublishTime(new Date(preferredPassOnDay(day || todayInParis()))),
              })}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** La même date, en pastille, au-dessus du titre sur téléphone. */
function MobileDeparture({
  day,
  locked,
  onDay,
}: {
  day: string;
  locked: boolean;
  onDay: (value: string) => void;
}) {
  const t = useTranslations("dashboard.article");
  const departure = day ? new Date(preferredPassOnDay(day)) : null;

  return (
    <label className="relative inline-flex items-center rounded-pill border border-border px-3 py-1.5 text-[11px] text-slate">
      {departure
        ? `${formatPublishDateShort(departure)} · ${formatPublishTime(departure)}`
        : t("noDate")}
      <input
        type="date"
        value={day}
        disabled={locked}
        aria-label={t("departureDay")}
        onChange={(event) => onDay(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </label>
  );
}

/** La longueur du texte : les mots, et le temps qu'il faut pour les lire. */
function DocumentMeter({ editor, className = "" }: { editor: Editor; className?: string }) {
  const t = useTranslations("dashboard.article");
  const { words } = useDocumentStructure(editor);

  return (
    <span className={className}>
      {t("meter", { words, minutes: Math.max(1, Math.round(words / 200)) })}
    </span>
  );
}

/** Aujourd'hui dans le fuseau de publication, au format du champ de date. */
function todayInParis(): string {
  return splitPublishInstant(new Date().toISOString()).day;
}
