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
 */

const ENGINES = [
  { name: "ChatGPT", logo: "/logoopenai1.png" },
  { name: "Perplexity", logo: "/logoperplexity1.png" },
  { name: "Gemini", logo: "/logogemini1.webp" },
] as const;

/** Une frappe toutes les 820 ms : le rythme d'une main qui réfléchit entre deux mots. */
const STRIKE_MS = 820;

const SHADOW_UP = "drop-shadow(0 8px 12px rgba(9, 9, 11, 0.20))";
const SHADOW_DOWN = "drop-shadow(0 3px 5px rgba(9, 9, 11, 0.16))";

export function AiKeycaps({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setPressed((n) => (n + 1) % ENGINES.length), STRIKE_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <div aria-hidden className={`flex items-center justify-center gap-1 ${className}`}>
      {ENGINES.map((engine, index) => {
        // Mouvement réduit : les trois touches restent posées, aucune ne descend.
        const down = !reduced && index === pressed;
        return (
          <motion.span
            key={engine.name}
            animate={{
              y: down ? 5 : 0,
              scale: down ? 0.955 : 1,
              filter: down ? SHADOW_DOWN : SHADOW_UP,
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="block h-14 w-14 sm:h-16 sm:w-16"
          >
            <Image
              src={engine.logo}
              alt=""
              width={64}
              height={64}
              className="h-full w-full object-contain"
            />
          </motion.span>
        );
      })}
    </div>
  );
}
