"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { answerState } from "@/lib/article-doc";
import { AutoTextarea } from "../AutoTextarea";
import { BrandToneCard } from "./BrandToneCard";
import { useDocumentStructure } from "./useDocumentStructure";

/**
 * Le sommaire de l'atelier : le plan de l'article, et ce qu'il vaut pour une IA.
 *
 * Il tient toute la hauteur de la colonne de gauche. En haut le plan, lu dans le
 * document à chaque frappe — ce n'est plus une liste tenue à côté du texte qu'il
 * fallait resynchroniser à la main. En bas, la marque du client : sa couleur,
 * puis le ton sous lequel l'article a été écrit.
 *
 * Le plan est seul à défiler. Tant que le rail entier défilait, un article de
 * vingt sections poussait le pied de colonne hors de l'écran, et il fallait
 * faire défiler une barre latérale pour retrouver deux cartes qui n'ont
 * d'intérêt qu'à portée de regard.
 *
 * Une entrée ne porte de note que lorsqu'elle sort du contrat. Le compte de mots
 * affiché sous chaque titre disait la même chose de toutes les sections, y
 * compris des dix-neuf qui allaient bien : le rail se lisait comme un tableau de
 * chiffres au lieu de signaler les deux endroits à reprendre. C'est aussi ce qui
 * a fini par emporter la carte de citabilité qui occupait le pied : elle
 * recomptait en gros ce que ces notes-là disent déjà, une section à la fois.
 *
 * La consigne de section reste attachée au titre : c'est elle qui permet de
 * faire reprendre un passage sans faire réécrire l'article entier.
 */

export function OutlineRail({
  editor,
  instructions,
  onInstruction,
  onJump,
  onAddSection,
  keyword,
  tone = null,
  voice = null,
}: {
  editor: Editor;
  instructions: Record<string, string>;
  onInstruction: (heading: string, value: string) => void;
  onJump: (pos: number) => void;
  onAddSection: () => void;
  /** Le mot-clé visé, rappelé sous le titre du rail. */
  keyword?: string | null;
  /**
   * Le ton relevé sur le site du client, et les consignes qui l'amendent.
   *
   * Nul sur les offres qui ne font pas écrire : le relevé n'y est pas lancé, et
   * une carte vide ne dirait au client qu'une chose, qu'il lui manque quelque
   * chose qu'on ne lui a pas vendu.
   */
  tone?: { summary: string | null; color: string | null; sampleUrl: string | null } | null;
  voice?: { instructions: string; banned: string[] } | null;
}) {
  const t = useTranslations("dashboard.article");
  const [open, setOpen] = useState<string | null>(null);
  const { headings, activeIndex } = useDocumentStructure(editor);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-5 py-6">
      <div className="flex shrink-0 items-baseline justify-between gap-3">
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
        <p className="-mt-2 shrink-0 truncate text-[13px] text-steel" title={keyword}>
          {keyword}
        </p>
      ) : null}

      {/* Le plan est seul à défiler. Le rail entier défilait, et un article de
          vingt sections emportait le pied de colonne hors de l'écran : ce qui
          s'y trouve n'a d'intérêt qu'à portée de regard. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
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
      </div>

      {/* La marque, au pied du rail. Elle y remplace la citabilité : celle-ci
          comptait en gros ce que chaque entrée du plan signale déjà, section par
          section, et ni la couleur ni la voix sous lesquelles l'article est
          écrit ne se lisaient nulle part. On les consulte au même moment —
          après avoir écrit, en relisant — et au même endroit d'un article à
          l'autre. */}
      {tone ? <BrandToneCard tone={tone} voice={voice} /> : null}
    </div>
  );
}
