"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Keyboard } from "@/components/Keyboard";

/**
 * Ce que l'audit est en train de faire, montré plutôt que décrit : la question
 * d'un client se tape sous les yeux du commerçant, dans ChatGPT, puis dans
 * Perplexity, puis dans Gemini, puis dans Claude.
 *
 * C'est la scène de la toute première version de l'écran d'analyse, revenue à
 * sa place : une seule rangée de pastilles de moteurs, une barre de recherche,
 * un petit clavier. Elle avait été remplacée par une suite d'animations Lottie
 * et par trois gros capuchons de marque ; le premier disait « ça charge » sans
 * rien dire de plus, les seconds occupaient la moitié de la carte pour porter
 * la même information qu'un logo de seize pixels. La pastille dit à qui l'on
 * parle, la question dit ce qu'on lui demande, et c'est tout ce que l'écran a
 * à dire pendant une à trois minutes.
 *
 * Claude est la quatrième pastille. Il cite comme les trois autres, le produit
 * le mesure comme les trois autres, et son absence de cette rangée était une
 * omission, pas un choix.
 *
 * Les questions viennent du commerce lui-même : DeepSeek Flash les écrit à
 * partir de la niche, de la ville et du nom relevés au crawl (cf.
 * `niche-questions`), et le repli local prend la main tant qu'elles ne sont pas
 * arrivées. « boulangerie artisanale au Havre » n'est pas une phrase
 * d'ambiance : c'est la requête dont dépend son chiffre d'affaires, et la voir
 * s'écrire pendant qu'on la mesure vaut mieux qu'une barre qui va et vient.
 *
 * Tout est en transform, opacity et couleur, sans mesure de la fenêtre : la
 * boucle reste fluide sur un portable qui, par ailleurs, attend une réponse
 * réseau. Sans mouvement, la question s'affiche entière et les touches restent
 * posées : il n'y a rien à comprendre dans l'appui, seulement dans le texte.
 *
 * Bloc décoratif du point de vue de l'assistance vocale : la barre de
 * progression, au-dessous, annonce déjà l'étape en cours. Faire lire chaque
 * changement de moteur ferait un fond sonore de trois minutes.
 */

const ENGINES = [
  { name: "ChatGPT", logo: "/logoopenai1.png" },
  { name: "Perplexity", logo: "/logoperplexity1.png" },
  { name: "Gemini", logo: "/logogemini1.webp" },
  { name: "Claude", logo: "/claude.svg" },
] as const;

/** Une frappe toutes les 55 ms : le rythme d'une main qui va vite sans courir. */
const TYPE_MS = 55;
/** Le temps de lire la question une fois écrite, avant de passer à la suivante. */
const HOLD_MS = 1800;
/** Sans mouvement, chaque question reste lisible le temps d'être lue en entier. */
const STATIC_MS = 4500;

export function AiKeysAnimation({ prompts }: { prompts: string[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);

  // La liste peut changer en cours de route : DeepSeek répond pendant que le
  // repli local tourne déjà. On repart alors de la première question plutôt que
  // de laisser le curseur au milieu d'une phrase qui n'existe plus. Ajustement
  // au rendu, pas en effet : un effet ferait un rendu de plus avec l'ancien
  // texte tronqué à l'écran.
  const [seen, setSeen] = useState(prompts);
  if (seen !== prompts) {
    setSeen(prompts);
    setIndex(0);
    setTyped(0);
  }

  const question = prompts[index % prompts.length] ?? "";
  // Le moteur interrogé change avec la question : la pastille allumée n'est pas
  // une ronde décorative, c'est celui à qui cette question-là est posée.
  const engine = index % ENGINES.length;

  // Une seule horloge pour les deux régimes : on écrit lettre à lettre, puis on
  // laisse lire, puis on passe à la question suivante. Sans mouvement, l'étape
  // d'écriture est sautée — la question est posée d'un coup.
  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(() => setIndex((n) => n + 1), STATIC_MS);
      return () => clearTimeout(timer);
    }
    if (typed < question.length) {
      const timer = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setIndex((n) => n + 1);
      setTyped(0);
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [reduced, typed, question.length]);

  const shown = reduced ? question : question.slice(0, typed);
  // La touche enfoncée est celle du dernier caractère écrit. L'espace allume la
  // barre, la ponctuation n'allume rien : aucune touche ne lui correspond.
  const lastChar = !reduced && typed > 0 ? question[typed - 1].toUpperCase() : "";

  return (
    <div aria-hidden className="flex w-full flex-col items-center gap-6">
      {/* Les quatre moteurs. Celui qu'on interroge se détache, les autres
          attendent leur tour. */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {ENGINES.map((item, position) => {
          const active = position === engine;
          return (
            <motion.span
              key={item.name}
              animate={{
                opacity: reduced || active ? 1 : 0.42,
                scale: reduced || active ? 1 : 0.94,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className={`inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-medium ${
                active ? "border-obsidian/25 bg-snow" : "border-fog bg-mist"
              }`}
            >
              <Image
                src={item.logo}
                alt=""
                width={18}
                height={18}
                className="h-4 w-4 shrink-0 rounded"
              />
              {item.name}
            </motion.span>
          );
        })}
      </div>

      {/* La barre de recherche : la question s'y écrit, curseur compris. */}
      <div className="flex w-full max-w-md items-center gap-2.5 rounded-pill border border-fog bg-snow px-4 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0 text-ash"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm text-text">
          {shown}
          <span className="ml-0.5 inline-block h-4 w-px animate-[blink_1s_step-end_infinite] bg-obsidian align-middle" />
        </span>
      </div>

      {/* Le petit clavier. La touche du dernier caractère s'enfonce. */}
      <Keyboard
        size="compact"
        pressed={lastChar}
        spacePressed={question[typed - 1] === " " && !reduced}
      />
    </div>
  );
}
