"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Mesure la largeur du mot le plus long **sans l'écrire dans la page** : on
 * dessine chaque mot dans un canvas hors écran, avec la police effective du
 * titre. Aucun mot fantôme ne traîne donc dans le DOM — le H1 lu par un moteur
 * ne contient qu'un seul nom de moteur à la fois — et la réservation colle au
 * pixel près, là où une estimation en `em` gaspillait assez de largeur pour
 * pousser le mot sur une ligne à lui seul.
 */
function useWidestWordPx(words: string[], target: HTMLElement | null): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!target) return;

    let cancelled = false;

    const measure = () => {
      const style = getComputedStyle(target);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx || cancelled) return;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const widest = words.reduce((max, word) => Math.max(max, ctx.measureText(word).width), 0);
      setWidth(Math.ceil(widest));
    };

    measure();
    // La police du titre arrive après le premier rendu : sans cette seconde
    // mesure, la réservation resterait calée sur la police de secours.
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [words, target]);

  return width;
}

/**
 * Le mot qui change dans le titre : chaque moteur passe à son tour, précédé de
 * son logo, si bien que la promesse se lit quatre fois sans que la phrase bouge.
 *
 * Rien ne doit sauter — ni en largeur ni à la ligne :
 * — la largeur est réservée sur le mot le plus long, logo compris, si bien que
 *   le retour à la ligne du titre est calculé une fois pour toutes ;
 * — logo et mot forment un bloc insécable, jamais coupé en fin de ligne.
 *
 * Sous `prefers-reduced-motion`, le premier moteur reste affiché : la phrase
 * garde son sens sans aucun mouvement.
 */
export function RotatingWord({
  words,
  marks,
  intervalMs = 2200,
}: {
  words: string[];
  /** Logo affiché devant chaque mot, dans le même ordre que `words`. */
  marks?: ReactNode[];
  intervalMs?: number;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [host, setHost] = useState<HTMLSpanElement | null>(null);
  const measured = useWidestWordPx(words, host);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (reduce || words.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [reduce, words.length, intervalMs]);

  // Avant la mesure (premier rendu, rendu serveur), on retombe sur une estimation
  // large : mieux vaut réserver un peu trop que voir la phrase se recomposer.
  const widestChars = words.reduce((a, b) => Math.max(a, b.length), 0);
  const reserved =
    measured !== null ? `calc(${measured}px + ${marks ? "1.2em" : "0em"})` : `${widestChars * 0.62 + (marks ? 1.2 : 0)}em`;

  const mark = marks?.[index];

  return (
    <span className="relative inline-block align-bottom">
      <span
        ref={setHost}
        className="block overflow-hidden text-center lg:text-left"
        style={{ minWidth: reserved }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={words[index]}
            initial={reduce ? false : { y: "0.9em", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: "-0.9em", opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center gap-[0.3em] whitespace-nowrap lg:justify-start"
          >
            {mark && (
              <span
                className="flex h-[0.9em] w-[0.9em] shrink-0 items-center justify-center [&>*]:h-full [&>*]:w-full [&_img]:object-contain"
                aria-hidden
              >
                {mark}
              </span>
            )}
            <span className="text-gradient">{words[index]}</span>
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
