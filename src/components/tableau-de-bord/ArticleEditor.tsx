"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import {
  approveArticleAction,
  publishArticleAction,
  rejectArticleAction,
  updateArticleAction,
  writeArticleAction,
} from "@/features/dashboard/actions";
import type { OutlineSection } from "@/features/dashboard/outline";
import {
  blockId,
  headingsOf,
  parseBlocks,
  serializeBlocks,
  wordCount,
  type Block,
  type BlockKind,
} from "@/lib/markdown-blocks";
import { Card, CardTitle } from "./Card";
import { AutoTextarea } from "./AutoTextarea";
import { BrandToneBar } from "./BrandToneBar";

/**
 * L'atelier d'un article : le ton en tête, le plan à gauche, le texte à droite.
 *
 * Le corps reste du Markdown en base — c'est ce que les connecteurs déposent, et
 * c'est la structure que les moteurs de réponse lisent. Mais le client n'écrit
 * pas de dièses : le texte est découpé en blocs typés, chacun édité pour ce
 * qu'il est, et le Markdown est recomposé à l'enregistrement. La marge de gauche
 * annonce le rôle de chaque bloc, parce que c'est cette hiérarchie, et non la
 * mise en forme, qui décide si un passage est citable.
 *
 * À gauche, le plan porte une consigne par section. C'est ce qui permet de faire
 * reprendre un seul passage : sans elle, toute correction repasse par une
 * réécriture complète de l'article.
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

/** Le libellé porté par la marge, pour chaque type de bloc. */
const GUTTER_LABEL: Record<BlockKind, string> = {
  h2: "H2",
  h3: "H3",
  p: "P",
  ul: "•",
  ol: "1.",
  quote: "«»",
  code: "</>",
};

const BLOCK_KINDS: BlockKind[] = ["p", "h2", "h3", "ul", "ol", "quote", "code"];

/** Classes d'affichage du bloc : ce qu'on lit doit ressembler à ce qui sera publié. */
const BLOCK_CLASS: Record<BlockKind, string> = {
  h2: "text-xl font-bold leading-snug",
  h3: "text-base font-semibold leading-snug",
  p: "text-[15px] leading-relaxed",
  ul: "text-[15px] leading-relaxed",
  ol: "text-[15px] leading-relaxed",
  quote: "text-[15px] italic leading-relaxed border-l-2 border-pebble pl-3",
  code: "font-mono text-[13px] leading-relaxed bg-mist rounded-xl px-3 py-2",
};

export function ArticleEditor({
  article,
  tone,
  voice,
  canPublish,
}: {
  article: EditorArticle;
  tone: { summary: string | null; color: string | null; sampleUrl: string | null };
  voice: { instructions: string; banned: string[] } | null;
  canPublish: boolean;
}) {
  const t = useTranslations("dashboard.article");
  const router = useRouter();

  const [title, setTitle] = useState(article.title);
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(article.body));
  const [sections, setSections] = useState<OutlineSection[]>(article.outline);
  const [instruction, setInstruction] = useState("");
  const [tab, setTab] = useState<"plan" | "instructions">("plan");
  const [focused, setFocused] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // La barre d'outils écrit dans la sélection du bloc actif : il faut donc
  // pouvoir atteindre la zone de saisie elle-même, pas seulement sa valeur.
  const fields = useRef(new Map<string, HTMLTextAreaElement>());

  const touch = useCallback(() => setDirty(true), []);

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
      // La version rédigée remplace ce qui est à l'écran sans attendre un aller
      // -retour serveur : sinon le client verrait son ancien texte pendant que
      // la page se recharge, et croirait la demande perdue.
      if (data?.title) setTitle(data.title);
      if (data?.body) setBlocks(parseBlocks(data.body));
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

  const words = useMemo(() => wordCount(blocks), [blocks]);

  /* ------------------------------ Édition des blocs ----------------------- */

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    touch();
  };

  const insertAfter = (id: string | null) => {
    const fresh: Block = { id: blockId(), kind: "p", text: "" };
    setBlocks((current) => {
      if (!id) return [...current, fresh];
      const index = current.findIndex((b) => b.id === id);
      if (index === -1) return [...current, fresh];
      return [...current.slice(0, index + 1), fresh, ...current.slice(index + 1)];
    });
    setFocused(fresh.id);
    touch();
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((b) => b.id !== id));
    touch();
  };

  /** Entoure la sélection du bloc actif (gras, italique, lien). */
  const wrapSelection = (before: string, after: string) => {
    if (!focused) return;
    const field = fields.current.get(focused);
    if (!field) return;
    const { selectionStart, selectionEnd, value } = field;
    const selected = value.slice(selectionStart, selectionEnd);
    const next =
      value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
    updateBlock(focused, { text: next });
    // On rend la main au champ, sélection replacée autour du texte entouré.
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
    });
  };

  /* ------------------------------ Édition du plan ------------------------- */

  const updateSection = (index: number, patch: Partial<OutlineSection>) => {
    setSections((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    touch();
  };

  const moveSection = (index: number, delta: number) => {
    setSections((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    touch();
  };

  const addSection = () => {
    setSections((current) => [...current, { heading: "", level: 2, instruction: "" }]);
    setTab("plan");
    touch();
  };

  const removeSection = (index: number) => {
    setSections((current) => current.filter((_, i) => i !== index));
    touch();
  };

  /** Reprend le plan depuis les titres réellement écrits dans le texte. */
  const syncFromBody = () => {
    const written = headingsOf(blocks).filter((h) => h.heading);
    if (!written.length) return;
    setSections((current) =>
      written.map((h) => ({
        ...h,
        // Une section déjà connue garde sa consigne : la resynchronisation
        // remet le plan d'accord avec le texte, elle n'efface pas le brief.
        instruction:
          current.find((s) => s.heading.toLowerCase() === h.heading.toLowerCase())?.instruction ??
          "",
      })),
    );
    touch();
  };

  /* --------------------------------- Rendu -------------------------------- */

  const persist = () =>
    save.execute({
      id: article.id,
      title,
      body: serializeBlocks(blocks) || " ",
      outline: sections.filter((s) => s.heading.trim()),
    });

  return (
    <div className="space-y-4">
      <BrandToneBar tone={tone} voice={voice} />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* ------------------------------ Colonne plan ---------------------- */}
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex gap-1 rounded-2xl bg-mist p-1">
              {(["plan", "instructions"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={tab === key}
                  className={`flex-1 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    tab === key ? "bg-surface text-obsidian shadow-sm" : "text-steel hover:text-ink"
                  }`}
                >
                  {t(`tabs.${key}`)}
                </button>
              ))}
            </div>

            {article.keyword ? (
              <p className="mb-4 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-steel">
                  {t("keyword")}
                </span>
                <span className="mt-0.5 block">{article.keyword}</span>
              </p>
            ) : null}

            {sections.length === 0 ? (
              <p className="rounded-2xl bg-mist px-4 py-6 text-center text-sm text-muted">
                {t("noOutline")}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {sections.map((section, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border-l-2 border-fog bg-mist/70 p-3"
                    style={{ borderLeftColor: section.level === 3 ? "#a1a1aa" : "#09090b" }}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(index, { level: section.level === 2 ? 3 : 2 })
                        }
                        title={t("toggleLevel")}
                        className="mt-0.5 shrink-0 cursor-pointer rounded-md bg-obsidian/[0.07] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-graphite transition-colors duration-200 hover:bg-obsidian/[0.12]"
                      >
                        H{section.level}
                      </button>
                      <AutoTextarea
                        value={section.heading}
                        onValueChange={(value) => updateSection(index, { heading: value })}
                        placeholder={t("headingPlaceholder")}
                        className="min-w-0 flex-1 resize-none bg-transparent text-sm font-semibold leading-snug focus:outline-none"
                      />
                      <span className="flex shrink-0 flex-col gap-0.5">
                        <IconButton label={t("moveUp")} onClick={() => moveSection(index, -1)}>
                          <path d="M6 14l6-6 6 6" />
                        </IconButton>
                        <IconButton label={t("moveDown")} onClick={() => moveSection(index, 1)}>
                          <path d="M6 10l6 6 6-6" />
                        </IconButton>
                      </span>
                    </div>

                    {tab === "instructions" ? (
                      <AutoTextarea
                        value={section.instruction}
                        onValueChange={(value) => updateSection(index, { instruction: value })}
                        placeholder={t("sectionInstructionPlaceholder")}
                        className="mt-2 w-full resize-none rounded-xl border border-border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-muted focus:outline-none focus:ring-2 focus:ring-obsidian/20"
                      />
                    ) : section.instruction ? (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted">{section.instruction}</p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => removeSection(index)}
                      className="mt-2 cursor-pointer text-[11px] text-muted underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-danger"
                    >
                      {t("removeSection")}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addSection}
                className="cursor-pointer text-sm font-medium text-text underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              >
                {t("addSection")}
              </button>
              <button
                type="button"
                onClick={syncFromBody}
                className="cursor-pointer text-sm text-muted underline decoration-pebble underline-offset-4 hover:text-text"
              >
                {t("syncFromBody")}
              </button>
            </div>
          </Card>

          <Card>
            <CardTitle title={t("rewrite")} hint={t("rewriteHint")} />
            <AutoTextarea
              value={instruction}
              onValueChange={setInstruction}
              placeholder={t("instructionPlaceholder")}
              className="min-h-[72px] w-full resize-none rounded-[14px] border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-obsidian/20"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                write.execute({ id: article.id, instruction: instruction.trim() || undefined })
              }
              className="mt-3 w-full cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
            >
              {write.isPending ? t("writing") : blocks.length ? t("rewriteCta") : t("writeCta")}
            </button>
            {article.revisions > 0 ? (
              <p className="mt-2 text-xs text-muted">
                {t("revisions")} : {article.revisions}
              </p>
            ) : null}
          </Card>
        </div>

        {/* --------------------------- Colonne document --------------------- */}
        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-mist px-2.5 py-1 text-[11px] font-semibold text-steel">
                {t(`status.${article.status}`)}
              </span>
              <span className="text-[11px] tabular-nums text-muted">
                {t("words", { count: words })}
              </span>
              <span className={`text-[11px] ${dirty ? "text-warning" : "text-success"}`}>
                {dirty ? t("unsaved") : t("savedState")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
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

          {article.status === "approved" && !canPublish ? (
            <p className="mb-3 rounded-2xl bg-mist px-4 py-3 text-sm text-muted">
              {t("noPublishLink")}
            </p>
          ) : null}

          {article.externalUrl ? (
            <p className="mb-3 text-sm">
              <a
                href={article.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-medium underline decoration-pebble underline-offset-4 hover:decoration-obsidian"
              >
                {t("seeOnline")}
              </a>
            </p>
          ) : null}

          {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

          {/* Barre d'outils : elle agit sur le bloc en cours d'édition. */}
          <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-surface/95 p-1.5 backdrop-blur">
            {BLOCK_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={!focused}
                onClick={() => focused && updateBlock(focused, { kind })}
                title={t(`toolbar.${kind}`)}
                className={`cursor-pointer rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                  focused && blocks.find((b) => b.id === focused)?.kind === kind
                    ? "bg-obsidian text-white"
                    : "text-steel hover:bg-mist"
                }`}
              >
                {GUTTER_LABEL[kind]}
              </button>
            ))}
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <ToolbarMark label={t("toolbar.bold")} disabled={!focused} onClick={() => wrapSelection("**", "**")}>
              <span className="font-bold">B</span>
            </ToolbarMark>
            <ToolbarMark label={t("toolbar.italic")} disabled={!focused} onClick={() => wrapSelection("_", "_")}>
              <span className="italic">I</span>
            </ToolbarMark>
            <ToolbarMark label={t("toolbar.link")} disabled={!focused} onClick={() => wrapSelection("[", "](https://)")}>
              <span>🔗</span>
            </ToolbarMark>
          </div>

          {/* Titre : le seul H1 du document. */}
          <div className="flex gap-3">
            <span className="w-8 shrink-0 pt-2 text-right text-[10px] font-semibold text-ash">
              H1
            </span>
            <AutoTextarea
              value={title}
              onValueChange={(value) => {
                setTitle(value);
                touch();
              }}
              placeholder={t("titlePlaceholder")}
              className="min-w-0 flex-1 resize-none border-b border-transparent bg-transparent pb-2 text-2xl font-bold leading-tight focus:border-fog focus:outline-none"
            />
          </div>

          <div className="mt-4 space-y-1">
            {blocks.map((block) => (
              <div key={block.id} className="group flex gap-3">
                <span className="w-8 shrink-0 pt-2 text-right text-[10px] font-semibold text-ash">
                  {GUTTER_LABEL[block.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <AutoTextarea
                    value={block.text}
                    onValueChange={(value) => updateBlock(block.id, { text: value })}
                    onFocus={() => setFocused(block.id)}
                    onRegister={(element) => {
                      if (element) fields.current.set(block.id, element);
                      else fields.current.delete(block.id);
                    }}
                    placeholder={t(`placeholders.${block.kind}`)}
                    className={`w-full resize-none rounded-lg bg-transparent px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-obsidian/15 ${BLOCK_CLASS[block.kind]}`}
                  />
                </div>
                <span className="flex shrink-0 flex-col gap-0.5 pt-1.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton label={t("addBlock")} onClick={() => insertAfter(block.id)}>
                    <path d="M12 5v14M5 12h14" />
                  </IconButton>
                  <IconButton label={t("removeBlock")} onClick={() => removeBlock(block.id)}>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </IconButton>
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => insertAfter(blocks.length ? blocks[blocks.length - 1].id : null)}
            className="mt-3 w-full cursor-pointer rounded-2xl border border-dashed border-pebble px-4 py-3 text-sm text-muted transition-colors duration-200 hover:border-graphite hover:text-text"
          >
            {t("addBlock")}
          </button>
        </Card>
      </div>
    </div>
  );
}

/** Petit bouton d'icône : ajouter, retirer, déplacer. */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="cursor-pointer rounded-md p-0.5 text-ash transition-colors duration-200 hover:bg-mist hover:text-ink"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </g>
      </svg>
    </button>
  );
}

/** Bouton de mise en forme du texte sélectionné. */
function ToolbarMark({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="cursor-pointer rounded-xl px-2.5 py-1.5 text-[13px] text-steel transition-colors duration-200 hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
