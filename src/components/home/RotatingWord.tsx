"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Le mot qui change dans le titre : chaque moteur passe à son tour, si bien que
 * la promesse se lit quatre fois sans que la phrase bouge. La largeur reste
 * réservée par un exemplaire invisible du mot le plus long — le titre ne saute
 * donc jamais d'une rotation à l'autre.
 *
 * Sous `prefers-reduced-motion`, le premier moteur reste affiché : la phrase
 * garde son sens sans aucun mouvement.
 */
export function RotatingWord({ words, intervalMs = 2200 }: { words: string[]; intervalMs?: number }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || words.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [reduce, words.length, intervalMs]);

  // Largeur réservée sur le mot le plus long, en `ch` : le titre ne saute pas
  // d'une rotation à l'autre, et aucun mot fantôme ne traîne dans le DOM — le
  // H1 lu par un moteur ne contient donc qu'un seul nom de moteur à la fois.
  const widest = words.reduce((a, b) => Math.max(a, b.length), 0);

  return (
    <span className="relative inline-block align-bottom">
      <span
        className="block overflow-hidden text-left"
        style={{ minWidth: `${widest * 0.62}em` }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={words[index]}
            initial={reduce ? false : { y: "0.9em", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: "-0.9em", opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="block text-gradient"
          >
            {words[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
