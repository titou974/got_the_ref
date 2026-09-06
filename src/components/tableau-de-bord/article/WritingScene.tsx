"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

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
 * Sous la feuille, un clavier. La touche qui s'enfonce est celle de la lettre en
 * train d'être tapée — c'est tout l'intérêt du dispositif : sans cette
 * correspondance, un clavier qui clignote au hasard n'est qu'un décor de plus.
 * Il est en AZERTY, comme celui du client.
 *
 * Mouvement réduit : le titre est posé d'un coup, le clavier reste au repos, et
 * la ligne d'état dit ce qui se passe. Personne ne perd d'information.
 */

/** Les trois rangées de lettres d'un clavier français, telles qu'on les voit. */
const ROWS = [
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["w", "x", "c", "v", "b", "n", "'", ",", "."],
] as const;

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

/**
 * La touche correspondant à un caractère.
 *
 * Les accents sont ramenés à leur lettre : sur un clavier, « é » se tape sur une
 * touche que cette rangée-là n'a pas, et faire clignoter la mauvaise touche
 * serait pire que n'en éclairer aucune.
 */
function keyFor(char: string): string | null {
  const lower = char
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (lower === " ") return " ";
  return ROWS.some((row) => row.includes(lower as never)) ? lower : null;
}

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
   * écrit le mois. Le client n'a rien lancé, il faut donc lui dire pourquoi son
   * article s'écrit tout seul.
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

  const pressed = typed.length > 0 ? keyFor(typed[typed.length - 1]) : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-6 py-8">
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
      <div aria-hidden className="flex w-full max-w-[26rem] flex-col items-center gap-1.5">
        {ROWS.map((row, index) => (
          <div key={index} className="flex justify-center gap-1.5">
            {row.map((key) => (
              <Key key={key} label={key} down={pressed === key} />
            ))}
          </div>
        ))}
        <Key label=" " down={pressed === " "} wide />
      </div>

      {/* --------------------------- Ce qui se passe ----------------------- */}
      <p role="status" className="max-w-sm text-center text-sm leading-relaxed text-muted">
        {auto ? t("auto") : t("asked")}
      </p>
    </div>
  );
}

/**
 * Une touche.
 *
 * Au repos elle est de la couleur de la feuille, avec un liseré et une ombre
 * d'un pixel qui lui donne son épaisseur ; enfoncée, elle passe au noir du
 * système, descend d'un pixel et perd son ombre. C'est le mouvement d'un vrai
 * capuchon, et il suffit : ni couleur nouvelle, ni halo.
 */
function Key({ label, down, wide = false }: { label: string; down: boolean; wide?: boolean }) {
  return (
    <span
      className={`flex h-7 items-center justify-center rounded-md border text-[11px] font-medium uppercase transition-all duration-100 ${
        wide ? "w-40" : "w-7"
      } ${
        down
          ? "translate-y-px border-obsidian bg-obsidian text-white shadow-none"
          : "border-fog bg-snow text-ash shadow-[rgba(9,9,11,0.06)_0_1px_0]"
      }`}
    >
      {label.trim()}
    </span>
  );
}
