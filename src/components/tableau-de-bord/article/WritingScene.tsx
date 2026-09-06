"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Keyboard } from "@/components/Keyboard";

/**
 * L'article en train de s'écrire, posé sur la feuille.
 *
 * Une rédaction prend de trente secondes à deux minutes. Pendant ce temps-là, la
 * feuille était blanche et une pastille disait « Rédaction… » : la seule chose
 * qui bougeait à l'écran était un point de suspension, et une attente muette de
 * deux minutes se lit comme une panne.
 *
 * On montre donc ce qui se passe. Le titre de l'article et les titres de son
 * plan — les vrais, ceux que le client a sous les yeux — se tapent lettre à
 * lettre dans la serif du document, et le texte déjà frappé reste au-dessus,
 * comme sur une page qui se remplit. Rien n'est inventé : on n'écrit à l'écran
 * que ce qui est déjà décidé, jamais des phrases d'article factices qui
 * mentiraient sur le texte à venir.
 *
 * Sous la feuille, le clavier du produit (cf. `Keyboard`), celui de l'écran
 * d'analyse, en plus petit : ici il accompagne un texte, là-bas il est le sujet.
 * La touche qui s'enfonce est celle de la lettre en train d'être tapée, et c'est
 * tout l'intérêt du dispositif — sans cette correspondance, un clavier qui
 * clignote au hasard n'est qu'un décor. Les touches des moteurs ne viennent pas
 * avec : on n'interroge personne, on écrit.
 *
 * Mouvement réduit : le titre est posé d'un coup, le clavier reste au repos, et
 * la ligne d'état dit ce qui se passe. Personne ne perd d'information.
 */

/**
 * Le rythme de la frappe, en millisecondes par caractère.
 *
 * Quarante, c'est une main rapide sans être une machine. Le tirage aléatoire
 * autour de cette valeur fait le reste : une frappe parfaitement régulière
 * s'entend comme un métronome et trahit l'animation.
 */
const KEY_MS = 40;
const KEY_JITTER_MS = 55;

/** Le temps de respiration en fin de ligne, avant de passer à la suivante. */
const LINE_PAUSE_MS = 900;

/** Lignes gardées à l'écran. Au-delà, la plus ancienne sort par le haut. */
const VISIBLE_LINES = 4;

export function WritingScene({
  title,
  outline,
  auto,
}: {
  title: string;
  /** Les titres de sections du plan : ce qui se tape après le titre. */
  outline: string[];
  /**
   * La rédaction n'a pas été demandée à l'écran : elle vient de la file qui
   * écrit les deux semaines à venir. Le client n'a rien lancé, il faut donc lui
   * dire pourquoi son article s'écrit tout seul.
   */
  auto: boolean;
}) {
  const t = useTranslations("dashboard.article.writingScene");
  const reduced = useReducedMotion();

  const lines = useMemo(
    () => [title, ...outline].map((line) => line.trim()).filter(Boolean),
    [title, outline],
  );

  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (reduced || lines.length === 0) return;

    const line = lines[lineIndex % lines.length];

    if (typed.length < line.length) {
      timer.current = setTimeout(
        () => setTyped(line.slice(0, typed.length + 1)),
        KEY_MS + Math.random() * KEY_JITTER_MS,
      );
    } else {
      timer.current = setTimeout(() => {
        setDone((current) => [...current, line].slice(-VISIBLE_LINES));
        setTyped("");
        setLineIndex((index) => index + 1);
      }, LINE_PAUSE_MS);
    }

    return () => clearTimeout(timer.current);
  }, [typed, lineIndex, lines, reduced]);

  /**
   * Le caractère en cours, ramené à sa touche.
   *
   * Les accents tombent : sur un clavier, « é » se tape sur une touche que ces
   * trois rangées n'ont pas, et en éclairer une autre serait pire que n'en
   * éclairer aucune. La ponctuation n'allume rien non plus.
   */
  const last = typed.length > 0 ? typed[typed.length - 1] : "";
  const key = last
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-8">
      {/* ---------------------------- La feuille --------------------------- */}
      <div aria-hidden className="w-full max-w-[34rem]">
        {/* Les lignes déjà frappées s'éteignent vers le haut : la ligne vive est
            toujours la dernière, celle qu'on regarde. */}
        {done.map((line, index) => (
          <p
            key={`${line}-${index}`}
            className="article-voice truncate text-ash"
            style={{ opacity: 0.25 + (index + 1) * (0.5 / VISIBLE_LINES) }}
          >
            {line}
          </p>
        ))}

        <p className="article-voice text-ink">
          {reduced ? lines[0] : typed}
          {/* Le curseur : un bloc plein, comme celui d'un traitement de texte,
              et non une barre de un pixel qui disparaîtrait à cette taille. */}
          <span
            className={`ml-0.5 inline-block h-[1.05em] w-[3px] translate-y-[3px] rounded-[1px] bg-obsidian ${
              reduced ? "" : "animate-caret"
            }`}
          />
        </p>
      </div>

      {/* ---------------------------- Le clavier --------------------------- */}
      <Keyboard size="compact" pressed={reduced ? "" : key} spacePressed={!reduced && last === " "} />

      {/* --------------------------- Ce qui se passe ----------------------- */}
      <p role="status" className="max-w-sm text-center text-sm leading-relaxed text-muted">
        {auto ? t("auto") : t("asked")}
      </p>
    </div>
  );
}
