"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Les trois touches des moteurs, enfoncées l'une après l'autre.
 *
 * C'est le geste que le produit mesure : quelqu'un tape sa question dans
 * ChatGPT, dans Perplexity, dans Gemini. Le montrer pendant l'attente vaut
 * mieux qu'un anneau qui tourne — l'anneau dit « ça charge », les touches
 * disent ce qui est demandé, et à qui.
 *
 * Les touches sont les visuels de marque, déjà dessinés en volume : on les
 * anime tels quels plutôt que de les poser dans un cadre de touche redessiné,
 * qui ferait une touche dans une touche. L'ombre portée suit le contour réel du
 * capuchon et se resserre à l'appui.
 *
 * Aucune touche n'est estompée au repos. Baisser l'opacité des deux autres les
 * délavait — un capuchon noir à moitié transparent devient gris, et on ne
 * reconnaît plus le logo. L'appui se lit à la descente et à l'ombre, ce qui est
 * exactement ce qui le rend lisible sur un vrai clavier.
 *
 * La touche enfoncée peut venir du dehors (`active`) : sur l'écran d'analyse,
 * c'est le moteur à qui la question est réellement posée qui s'enfonce, et il
 * change quand la question change. Sans cette consigne, les trois se relaient
 * d'elles-mêmes — c'est ce qu'il faut pendant un crawl, où l'on ne parle encore
 * à personne en particulier.
 */

const ENGINES = [
  { name: "ChatGPT", logo: "/logoopenai1.png" },
  { name: "Perplexity", logo: "/logoperplexity1.png" },
  { name: "Gemini", logo: "/logogemini1.webp" },
] as const;

/** Une frappe toutes les 820 ms : le rythme d'une main qui réfléchit entre deux mots. */
const STRIKE_MS = 820;

const SHADOW_UP = "drop-shadow(0 10px 16px rgba(9, 9, 11, 0.22))";
const SHADOW_DOWN = "drop-shadow(0 4px 6px rgba(9, 9, 11, 0.18))";

export function AiKeycaps({
  className = "",
  active,
}: {
  className?: string;
  /** Index de la touche enfoncée. Sans lui, les trois se relaient d'elles-mêmes. */
  active?: number;
}) {
  const reduced = useReducedMotion();
  const [cycled, setCycled] = useState(0);
  const driven = active !== undefined;

  useEffect(() => {
    if (reduced || driven) return;
    const timer = setInterval(() => setCycled((n) => (n + 1) % ENGINES.length), STRIKE_MS);
    return () => clearInterval(timer);
  }, [reduced, driven]);

  const pressedIndex = driven ? active % ENGINES.length : cycled;

  return (
    // L'écart appartient à la touche, pas à l'appelant : deux capuchons de
    // 96 px collés se lisent comme un seul bloc. Le passer en `className`
    // laissait deux `gap-*` se disputer la même règle, arbitrées par l'ordre de
    // la feuille Tailwind plutôt que par l'intention.
    <div aria-hidden className={`flex items-center justify-center gap-3 sm:gap-4 ${className}`}>
      {ENGINES.map((engine, index) => {
        // Mouvement réduit et aucune consigne extérieure : les trois touches
        // restent posées, aucune ne descend d'elle-même.
        const down = (!reduced || driven) && index === pressedIndex;
        return (
          <motion.span
            key={engine.name}
            animate={{
              y: down ? 6 : 0,
              scale: down ? 0.955 : 1,
              filter: down ? SHADOW_DOWN : SHADOW_UP,
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="block h-20 w-20 sm:h-24 sm:w-24"
          >
            <Image
              src={engine.logo}
              alt=""
              width={96}
              height={96}
              className="h-full w-full object-contain"
            />
          </motion.span>
        );
      })}
    </div>
  );
}
