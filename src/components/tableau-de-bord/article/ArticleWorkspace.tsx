"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { useEditor } from "@tiptap/react";
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
import {
  PUBLISH_HOUR_IS_CHOSEN,
  formatPublishTime,
  preferredPassOnDay,
  splitPublishInstant,
} from "@/constants/publishing";
import { ROUTES } from "@/constants/routes";
import { PublishPromptPanel } from "../PublishPromptPanel";
import { SearchLoader } from "@/components/SearchLoader";
import { ArticleActionBar } from "./ArticleActionBar";
import { DocumentCanvas } from "./DocumentCanvas";
import { OutlineRail } from "./OutlineRail";

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
 * L'écran tient en trois pièces. En haut, une barre qui ne pose que deux
 * questions : quel jour l'article part, et enregistre-t-on ce qui vient d'être
 * écrit. Elle en portait huit — état, compteur de mots, versions, valider,
 * publier, planifier, préparer, écarter — et le client devait lire une rangée
 * de boutons avant de lire son texte. Les décisions de départ sont descendues
 * dans la barre d'action du bas (`ArticleActionBar`), où elles se prennent le
 * document sous les yeux.
 *
 * À gauche, le rail de citabilité, qui lit le plan dans le document et signale
 * les ouvertures de section trop courtes ou trop longues pour être citées. À
 * droite, la feuille, à la mesure de l'article publié.
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

export function ArticleWorkspace({
  article,
  canPublish,
  locked = false,
  quotaRemaining,
  domain,
  platform,
}: {
  article: EditorArticle;
  canPublish: boolean;
  /**
   * L'offre du compte n'ouvre pas la rédaction.
   *
   * Le sujet reste lisible — titre, mot-clé, plan : c'est ce qu'on a préparé
   * pour ce client, et le lui cacher n'aurait rien vendu. Ce qui disparaît,
   * c'est ce qui fait partir l'article : la barre du bas mène alors aux tarifs,
   * et le bouton de rédaction avec elle. Les actions correspondantes sont de toute façon
   * refusées côté serveur (`requireSection`) ; ce verrou-ci évite au client de
   * les découvrir par un message d'erreur.
   */
  locked?: boolean;
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
  const [day, setDay] = useState(
    () => (article.scheduledFor ? splitPublishInstant(article.scheduledFor).day : ""),
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
      {/* La barre du haut : le jour de départ, et l'enregistrement. Rien
          d'autre. Publier et valider se décident en bas de l'écran, une fois le
          texte lu — les poser ici demandait de trancher avant d'avoir lu. */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-card-compact border border-border bg-surface px-5 py-4">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">
            {t("departureDay")}
          </span>
          <input
            type="date"
            value={day}
            disabled={locked}
            onChange={(event) => {
              setDay(event.target.value);
              setDirty(true);
            }}
            className="h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          {/* L'heure est annoncée, pas demandée : la file ne repasse qu'une
              fois par jour, et un sélecteur d'heure promettrait une maîtrise
              que le service n'a pas. */}
          {PUBLISH_HOUR_IS_CHOSEN ? null : (
            <p className="text-[13px] text-muted">
              {t("fixedHour", { time: formatPublishTime(new Date(preferredPassOnDay(day || todayInParis()))) })}
            </p>
          )}

          {locked ? (
            <Link
              href={ROUTES.pricing}
              className="inline-flex cursor-pointer items-center rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
            >
              {t("unlockToPublish")}
            </Link>
          ) : (
            /* Un seul bouton, dont l'état dit tout : « Enregistrer » tant qu'il
               reste quelque chose à garder, « Enregistré » sinon. La pastille
               de couleur et la phrase « modifications non enregistrées »
               disaient la même chose une deuxième fois. */
            <button
              type="button"
              disabled={busy || !editor || !dirty}
              onClick={persist}
              className="cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-default disabled:bg-mist disabled:text-steel disabled:shadow-none"
            >
              {save.isPending ? t("saving") : dirty ? t("save") : t("savedState")}
            </button>
          )}
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

            {/* Rédiger est le travail vendu : sur une offre qui ne l'ouvre
                pas, le bouton mène aux tarifs plutôt qu'à un refus du
                serveur. Le sujet, lui, reste entier au-dessus. */}
            {locked ? (
              <Link
                href={ROUTES.pricing}
                className="mt-3 block w-full cursor-pointer rounded-pill bg-cta px-5 py-2.5 text-center text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
              >
                {t("unlockToWrite")}
              </Link>
            ) : (
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
            )}

            {/* Le budget de la semaine, sous le bouton qui le consomme : c'est
                là qu'il pèse dans la décision de relancer une reprise. */}
            {locked ? (
              <p className="mt-2 text-xs text-muted">{t("lockedQuota")}</p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                {remaining > 0
                  ? `${remaining} rédaction${remaining > 1 ? "s" : ""} restante${
                      remaining > 1 ? "s" : ""
                    } cette semaine. Une reprise en consomme une.`
                  : "Rédactions de la semaine épuisées. Votre brouillon reste modifiable à la main."}
              </p>
            )}

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

      {/* La barre d'action, au bas de l'écran : ce que devient cet article. Elle
          prend la place de « résoudre avec les agents IA », qui parle du site
          entier — sur un article ouvert, la question est celle de cet
          article-là. */}
      <ArticleActionBar
        articleId={article.id}
        status={article.status}
        scheduledFor={day ? preferredPassOnDay(day) : article.scheduledFor}
        hasBody={Boolean(editor ? editor.getText().trim() : article.body.trim())}
        canPublish={canPublish}
        locked={locked}
        domain={domain}
        onDrop={() => reject.execute({ id: article.id })}
        dropPending={busy}
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
  );
}

/** Aujourd'hui dans le fuseau de publication, au format du champ de date. */
function todayInParis(): string {
  return splitPublishInstant(new Date().toISOString()).day;
}
