"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Editor } from "@tiptap/react";
import { answerState, ANSWER_MAX, ANSWER_MIN } from "@/lib/article-doc";
import { AutoTextarea } from "../AutoTextarea";
import { useDocumentStructure } from "./useDocumentStructure";

/**
 * Le rail de citabilité : le plan de l'article, et ce qu'il vaut pour une IA.
 *
 * Le plan n'est plus une liste tenue à côté du texte, qu'il fallait
 * resynchroniser à la main : il est lu dans le document, à chaque frappe. Ce
 * que le rail ajoute, un sommaire ordinaire ne le dit pas — la longueur de la
 * réponse qui ouvre chaque section. C'est le contrat donné à la rédaction
 * (« ouvre chaque section par une réponse directe de 40 à 60 mots, autonome,
 * citable telle quelle »), et c'est la première chose qu'une retouche casse :
 * on ajoute deux phrases d'introduction, et le passage cesse d'être extractible.
 *
 * La consigne de section reste attachée au titre : c'est elle qui permet de
 * faire reprendre un passage sans faire réécrire l'article entier.
 */

const DOT: Record<ReturnType<typeof answerState>, string> = {
  ok: "bg-success",
  short: "bg-ember",
  long: "bg-ember",
  missing: "bg-pebble",
};

export function OutlineRail({
  editor,
  instructions,
  onInstruction,
  onJump,
  onAddSection,
}: {
  editor: Editor;
  instructions: Record<string, string>;
  onInstruction: (heading: string, value: string) => void;
  onJump: (pos: number) => void;
  onAddSection: () => void;
}) {
  const t = useTranslations("dashboard.article");
  const [open, setOpen] = useState<string | null>(null);
  const { headings, activeIndex } = useDocumentStructure(editor);

  const offContract = headings.filter((h) => answerState(h) !== "ok").length;

  return (
    <section className="rounded-card-compact border border-border bg-surface p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("outline")}</h2>
        <span className="text-[11px] tabular-nums text-muted">
          {t("sections", { count: headings.length })}
        </span>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        {offContract
          ? t("citableOff", { count: offContract, min: ANSWER_MIN, max: ANSWER_MAX })
          : t("citableAll", { min: ANSWER_MIN, max: ANSWER_MAX })}
      </p>

      {headings.length === 0 ? (
        <p className="rounded-2xl bg-mist px-4 py-6 text-center text-sm text-muted">
          {t("noOutline")}
        </p>
      ) : (
        <ol className="space-y-0.5">
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
                  {/* Le trait de section active : il suit le curseur dans le
                      texte, pour retrouver où l'on écrit dans un long article. */}
                  <span
                    aria-hidden
                    className={`absolute top-2 bottom-2 left-0 w-0.5 rounded-pill bg-obsidian transition-opacity duration-200 ${
                      index === activeIndex ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onJump(heading.pos)}
                    className="flex w-full cursor-pointer items-start gap-2 text-left"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-1.5 shrink-0 rounded-pill ${DOT[state]}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[13px] leading-snug ${
                          heading.level === 3 ? "pl-3 font-medium text-steel" : "font-semibold"
                        }`}
                      >
                        {heading.text || t("untitledSection")}
                      </span>
                      {/* L'orange ne sort que pour une ouverture qui existe mais
                          tombe hors du contrat : une section qui enchaîne sur une
                          liste est un choix d'écriture, pas une erreur. */}
                      <span
                        className={`mt-0.5 block text-[11px] tabular-nums ${
                          state === "short" || state === "long" ? "text-ember" : "text-muted"
                        }`}
                      >
                        {state === "missing"
                          ? t("answerMissing")
                          : t("answerWords", { count: heading.answerWords })}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : key)}
                    aria-expanded={expanded}
                    className={`mt-1 ml-3.5 cursor-pointer text-[11px] underline decoration-pebble underline-offset-4 transition-colors duration-200 hover:text-text ${
                      instruction ? "text-text" : "text-muted"
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
                    <p className="mt-1 ml-3.5 line-clamp-2 text-[11px] text-muted">{instruction}</p>
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
        className="mt-3 w-full cursor-pointer rounded-2xl border border-dashed border-pebble px-4 py-2.5 text-[13px] text-muted transition-colors duration-200 hover:border-graphite hover:text-text"
      >
        {t("addSection")}
      </button>
    </section>
  );
}
