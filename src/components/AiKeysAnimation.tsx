"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

/**
 * Ce que l'audit est en train de faire, montré plutôt que décrit : quelqu'un
 * tape la question dans ChatGPT, puis dans Perplexity, puis dans Gemini.
 *
 * L'attente dure de une à trois minutes. Une barre qui va et vient n'occupe que
 * l'écran ; voir la requête s'écrire touche par touche dit ce qui se joue — on
 * pose à trois moteurs la question que poseront les clients, et on regarde qui
 * ils citent.
 *
 * Tout est en transform et opacity, sans mesure de la fenêtre : la boucle reste
 * fluide sur un portable qui, par ailleurs, attend une réponse réseau.
 */

const ENGINES = [
  { name: "ChatGPT", logo: "/logoopenai1.png" },
  { name: "Perplexity", logo: "/logoperplexity1.png" },
  { name: "Gemini", logo: "/logogemini1.webp" },
] as const;

/**
 * Ce qui s'écrit quand personne n'a encore dit de quel commerce il s'agit.
 *
 * Les vraies questions sont écrites par DeepSeek Flash à partir de la niche
 * détectée (cf. `lib/geo/niche-questions`) et descendent en props. Elles
 * arrivent après le montage — l'appel part en même temps que l'analyse — et
 * ces trois-là occupent l'écran d'ici là, plutôt qu'un clavier muet.
 */
const PLACEHOLDER_QUERIES = [
  "meilleur restaurant près de moi",
  "qui recommandes-tu dans ma ville",
  "quelle adresse choisir ce soir",
];

/** Trois rangées, disposition française. Assez pour qu'on y reconnaisse un clavier. */
const ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["W", "X", "C", "V", "B", "N"],
];

/** Une frappe toutes les 55 ms : le rythme d'une main qui va vite sans courir. */
const TYPE_MS = 55;
/** Le temps de lire la question une fois écrite, avant de passer au moteur suivant. */
const HOLD_MS = 1600;

export function AiKeysAnimation({
  questions,
  niche,
}: {
  /**
   * Les questions à taper, une par moteur, écrites pour le commerce analysé.
   * Absentes ou incomplètes, les questions d'attente prennent le relais.
   */
  questions?: string[];
  /** La niche détectée, annoncée sous le clavier quand on la connaît. */
  niche?: string | null;
} = {}) {
  const t = useTranslations("aiKeys");
  const [engine, setEngine] = useState(0);
  const [typed, setTyped] = useState(0);

  const current = ENGINES[engine];
  const queries = ENGINES.map(
    (_, index) => questions?.[index]?.trim() || PLACEHOLDER_QUERIES[index],
  );
  const full = queries[engine];

  // Les questions arrivent après le montage : la frappe en cours repart du
  // début sur la nouvelle question, plutôt que de continuer à écrire l'ancienne
  // et d'afficher un mélange des deux.
  //
  // L'ajustement se fait pendant le rendu, pas dans un effet. Remis à zéro dans
  // un effet, l'écran peignait d'abord une frappe à cheval sur les deux
  // questions — l'ancien curseur au milieu du nouveau texte — avant de se
  // corriger à la passe suivante. React réexécute ce rendu-ci avant de peindre
  // quoi que ce soit, et le mélange ne s'affiche jamais.
  const signature = queries.join("|");
  const [renderedSignature, setRenderedSignature] = useState(signature);
  if (renderedSignature !== signature) {
    setRenderedSignature(signature);
    setEngine(0);
    setTyped(0);
  }

  useEffect(() => {
    if (typed < full.length) {
      const timer = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
      return () => clearTimeout(timer);
    }
    // Question écrite : on la laisse à l'écran, puis on change de moteur.
    const timer = setTimeout(() => {
      setEngine((n) => (n + 1) % ENGINES.length);
      setTyped(0);
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [typed, full.length]);

  // La touche enfoncée est celle du dernier caractère écrit. L'espace et la
  // ponctuation n'allument rien : aucune touche de la rangée ne leur correspond.
  const lastChar = typed > 0 ? full[typed - 1].toUpperCase() : "";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Interrogation de ${current.name}`}
      className="relative isolate overflow-hidden rounded-[28px] border border-border bg-surface px-5 py-8 sm:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-[loader-drift_9s_ease-in-out_infinite] bg-[radial-gradient(120%_120%_at_20%_0%,rgba(9,9,11,0.055),transparent_58%),radial-gradient(110%_110%_at_100%_100%,rgba(9,9,11,0.035),transparent_58%)]"
      />

      {/* Les trois moteurs. Celui qu'on interroge se détache, les autres attendent. */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {ENGINES.map((item, index) => {
          const active = index === engine;
          return (
            <motion.span
              key={item.name}
              animate={{ opacity: active ? 1 : 0.42, scale: active ? 1 : 0.94 }}
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
      <div className="mx-auto mt-6 flex max-w-md items-center gap-2.5 rounded-pill border border-fog bg-snow px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-ash">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm text-text">
          {full.slice(0, typed)}
          <span className="ml-0.5 inline-block h-4 w-px animate-[blink_1s_step-end_infinite] bg-obsidian align-middle" />
        </span>
      </div>

      {/* Le clavier. La touche du dernier caractère s'enfonce. */}
      <div aria-hidden className="mt-6 flex flex-col items-center gap-1.5">
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1.5">
            {row.map((key) => {
              const pressed = key === lastChar;
              return (
                <motion.span
                  key={key}
                  animate={{
                    y: pressed ? 2 : 0,
                    scale: pressed ? 0.94 : 1,
                    backgroundColor: pressed ? "#09090b" : "rgba(255,255,255,0)",
                    color: pressed ? "#ffffff" : "#71717a",
                  }}
                  transition={{ duration: 0.09 }}
                  className="flex h-7 w-6 items-center justify-center rounded-md border border-fog text-[10px] font-semibold sm:h-8 sm:w-7 sm:text-[11px]"
                >
                  {key}
                </motion.span>
              );
            })}
          </div>
        ))}
        <motion.span
          animate={{
            y: lastChar === " " || full[typed - 1] === " " ? 2 : 0,
            backgroundColor: full[typed - 1] === " " ? "#09090b" : "rgba(255,255,255,0)",
          }}
          transition={{ duration: 0.09 }}
          className="mt-0.5 h-7 w-32 rounded-md border border-fog sm:h-8 sm:w-40"
        />
      </div>

      {/* La niche, une fois détectée. C'est elle qui explique pourquoi ces
          questions-là s'écrivent et pas d'autres : sans elle, le visiteur voit
          trois requêtes tomber sans savoir d'où elles sortent. */}
      {niche ? (
        <p className="mt-5 text-center text-xs text-muted">
          {t("niche")} <span className="font-medium text-text">{niche}</span>
        </p>
      ) : null}
    </div>
  );
}
