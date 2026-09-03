"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { answerState, type DocHeading } from "@/lib/article-doc";
import { AutoTextarea } from "../AutoTextarea";
import { useDocumentStructure } from "./useDocumentStructure";

/**
 * Le sommaire de l'atelier : le plan de l'article, et ce qu'il vaut pour une IA.
 *
 * Il tient toute la hauteur de la colonne de gauche. En haut le plan, lu dans le
 * document à chaque frappe — ce n'est plus une liste tenue à côté du texte qu'il
 * fallait resynchroniser à la main. En bas, calée au pied du rail, la mesure que
 * ce produit est seul à donner : combien de sections ouvrent sur une réponse
 * qu'une IA peut citer telle quelle.
 *
 * Une entrée ne porte de note que lorsqu'elle sort du contrat. Le compte de mots
 * affiché sous chaque titre disait la même chose de toutes les sections, y
 * compris des dix-neuf qui allaient bien : le rail se lisait comme un tableau de
 * chiffres au lieu de signaler les deux endroits à reprendre.
 *
 * La consigne de section reste attachée au titre : c'est elle qui permet de
 * faire reprendre un passage sans faire réécrire l'article entier.
 */

/** La section à nommer dans la carte du bas : la première qui sort du contrat. */
function firstIssue(headings: DocHeading[]): DocHeading | null {
  return headings.find((heading) => answerState(heading) !== "ok") ?? null;
}

export function OutlineRail({
  editor,
  instructions,
  onInstruction,
  onJump,
  onAddSection,
  keyword,
}: {
  editor: Editor;
  instructions: Record<string, string>;
  onInstruction: (heading: string, value: string) => void;
  onJump: (pos: number) => void;
  onAddSection: () => void;
  /** Le mot-clé visé, rappelé sous le titre du rail. */
  keyword?: string | null;
}) {
  const t = useTranslations("dashboard.article");
  const [open, setOpen] = useState<string | null>(null);
  const { headings, activeIndex } = useDocumentStructure(editor);

  const citable = headings.filter((heading) => answerState(heading) === "ok").length;
  const issue = firstIssue(headings);
  const ratio = headings.length ? citable / headings.length : 0;
  const issueKey = issue
    ? answerState(issue) === "missing"
      ? "issueMissing"
      : answerState(issue) === "long"
        ? "issueLong"
        : "issueShort"
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-5 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-steel">
          {t("outline")}
        </h2>
        <span className="shrink-0 text-[11px] tabular-nums text-ash">
          {t("sections", { count: headings.length })}
        </span>
      </div>

      {/* Le mot-clé visé, une ligne sous le titre du rail : c'est la promesse
          que l'article doit tenir, et elle se relit en écrivant. */}
      {keyword ? (
        <p className="-mt-2 truncate text-[13px] text-steel" title={keyword}>
          {keyword}
        </p>
      ) : null}

      {headings.length === 0 ? (
        <p className="rounded-2xl bg-mist px-4 py-6 text-center text-[13px] leading-relaxed text-muted">
          {t("noOutline")}
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {headings.map((heading, index) => {
            const state = answerState(heading);
            const key = `${index}-${heading.text}`;
            const expanded = open === key;
            const instruction = instructions[heading.text] ?? "";

            return (
              <li key={key}>
                <div
                  className={`group relative rounded-2xl px-2.5 py-2 transition-colors duration-200 ${
                    index === activeIndex ? "bg-mist" : "hover:bg-mist/60"
                  }`}
                >
                  {/* Le trait de section active suit le curseur dans le texte :
                      c'est ainsi qu'on retrouve où l'on écrit dans un long
                      article, sans relire les titres un par un. */}
                  <span
                    aria-hidden
                    className={`absolute bottom-2 left-0 top-2 w-0.5 rounded-pill bg-obsidian transition-opacity duration-200 ${
                      index === activeIndex ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => onJump(heading.pos)}
                    className="block w-full cursor-pointer text-left"
                  >
                    <span
                      className={`block truncate text-[13px] leading-snug ${
                        heading.level === 3 ? "pl-3 font-medium text-steel" : "font-medium text-text"
                      }`}
                    >
                      {heading.text || t("untitledSection")}
                    </span>

                    {/* L'orange ne sort que pour une ouverture hors contrat :
                        ailleurs, une ligne de plus dirait « tout va bien » vingt
                        fois pour le cacher deux fois. */}
                    {state === "ok" ? null : (
                      <span className="mt-0.5 block text-[11px] leading-snug text-ember">
                        {state === "missing"
                          ? t("answerMissing")
                          : t("answerWords", { count: heading.answerWords })}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : key)}
                    aria-expanded={expanded}
                    className={`mt-1 cursor-pointer text-[11px] underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text ${
                      instruction || expanded
                        ? "text-text"
                        : "text-ash opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    }`}
                  >
                    {instruction ? t("editBrief") : t("addBrief")}
                  </button>

                  {expanded ? (
                    <AutoTextarea
                      autoFocus
                      value={instruction}
                      onValueChange={(value) => onInstruction(heading.text, value)}
                      placeholder={t("sectionInstructionPlaceholder")}
                      className="mt-2 w-full resize-none rounded-xl border border-border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-muted focus:ring-2 focus:ring-obsidian/20 focus:outline-none"
                    />
                  ) : instruction ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted">{instruction}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={onAddSection}
        className="w-full shrink-0 cursor-pointer rounded-2xl border border-dashed border-pebble px-4 py-2.5 text-center text-[13px] text-muted transition-colors duration-200 hover:border-graphite hover:text-text"
      >
        {t("addSection")}
      </button>

      <span aria-hidden className="flex-1" />

      {/* La citabilité, au pied du rail. Elle n'a pas sa place en tête : on la
          consulte après avoir écrit, pas avant. */}
      <div className="shrink-0 rounded-3xl border border-border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold">{t("citableCard")}</span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums">
            {citable}/{headings.length}
          </span>
        </div>

        <span aria-hidden className="mt-2.5 block h-1.5 overflow-hidden rounded-pill bg-mist">
          <span
            className="block h-full rounded-pill bg-success transition-[width] duration-300"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </span>

        <p className="mt-2.5 text-xs leading-relaxed text-steel">
          {!headings.length
            ? t("citableNone")
            : issue && issueKey
              ? t(issueKey, { section: issue.text || t("untitledSection") })
              : t("issueAll")}
        </p>
      </div>
    </div>
  );
}
