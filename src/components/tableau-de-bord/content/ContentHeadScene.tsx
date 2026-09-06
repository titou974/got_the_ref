"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RiCheckLine, RiSparkling2Fill } from "@remixicon/react";

/**
 * La scène des trois temps de la modale d'accueil du contenu.
 *
 * Un seul plan, comme pour les articles : la réponse d'une IA en haut, le fil
 * au milieu, la tête de la page d'accueil en bas. Rien ne se remplace d'une
 * étape à l'autre, tout change d'état. C'est le propos de l'écran : ces
 * quelques lignes sont ce que les IA lisent, et ce sont elles qu'on réécrit.
 *
 * Les quatre blocs du bas portent le nom de leur balise : title, meta, h1, p.
 * Ce sont les quatre emplacements que la page compare un à un, dans le même
 * ordre. Le client reconnaît l'écran avant de l'ouvrir.
 *
 * Le fil ne sert qu'au deuxième temps, quand les points remontent de la page
 * vers la réponse : c'est la lecture. Le troisième temps se joue en bas, là où
 * l'agent travaille, quand la prise s'allume et que les lignes passent au noir.
 */

/** Position et hauteur du fil, en pixels, dans le repère de la scène. */
const WIRE_TOP = 62;
const WIRE_HEIGHT = 26;

/** Les quatre emplacements réécrits, avec la largeur de leurs lignes. */
const SLOTS = [
  { tag: "title", lines: ["62%"] },
  { tag: "meta", lines: ["92%"] },
  { tag: "h1", lines: ["54%"] },
  { tag: "p", lines: ["96%", "78%"] },
] as const;

export function ContentHeadScene({ step, domain }: { step: number; domain: string }) {
  const reduced = useReducedMotion();

  /** Les IA lisent la page pendant le deuxième temps, et nulle part ailleurs. */
  const reading = step === 1 && !reduced;
  /** La citation reste acquise une fois la lecture montrée. */
  const cited = step >= 1;
  /** Les textes réécrits se posent au troisième temps. */
  const rewritten = step === 2;

  return (
    <div aria-hidden className="relative h-[216px] overflow-hidden rounded-3xl bg-mist sm:h-[228px]">
      {/* ---------------------- La réponse d'une IA ------------------------ */}
      <div className="absolute inset-x-0 top-3.5 flex justify-center">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: cited ? 1 : 0.55, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
          className="w-[78%] rounded-2xl border border-fog bg-snow px-3 py-2.5 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-start gap-2">
            <RiSparkling2Fill className="mt-px size-3 shrink-0 text-obsidian" />
            <div className="min-w-0 flex-1 space-y-1.5">
              {["88%", "58%"].map((width, index) => (
                <motion.span
                  key={width}
                  className="block h-1.5 origin-left rounded-full bg-pebble"
                  style={{ width }}
                  animate={{ scaleX: cited ? 1 : 0.35 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { delay: cited ? 0.25 + index * 0.12 : 0, duration: 0.4, ease: "easeOut" }
                  }
                />
              ))}
            </div>
          </div>

          {/* La citation : le domaine du client, donné en source de la réponse. */}
          <motion.div
            className="mt-2 flex items-center gap-1.5 border-t border-fog pt-2"
            animate={{ opacity: cited ? 1 : 0 }}
            transition={reduced ? { duration: 0 } : { delay: cited ? 0.5 : 0, duration: 0.3 }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-obsidian" />
            <span className="truncate font-mono text-[9px] leading-none text-steel">{domain}</span>
          </motion.div>
        </motion.div>
      </div>

      {/* ------------------------------ Le fil ----------------------------- */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: WIRE_TOP, height: WIRE_HEIGHT }}
      >
        <motion.span
          className="w-0.5 origin-bottom rounded-full"
          style={{
            height: WIRE_HEIGHT,
            backgroundImage:
              "repeating-linear-gradient(to bottom, var(--color-ash) 0 3px, transparent 3px 7px)",
          }}
          initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={reduced ? { duration: 0 } : { delay: 0.3, duration: 0.35, ease: "easeOut" }}
        />

        {/* La lecture : ce que la page dit remonte vers la réponse. */}
        {reading
          ? [0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="absolute left-1/2 top-0 size-1.5 rounded-full bg-obsidian"
                initial={{ y: WIRE_HEIGHT, opacity: 0 }}
                animate={{ y: 0, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 0.9,
                  delay: index * 0.28,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeOut",
                }}
              />
            ))
          : null}
      </div>

      {/* ------------------- La tête de la page d'accueil ------------------- */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: WIRE_TOP + WIRE_HEIGHT }}
      >
        <div className="w-[78%] rounded-2xl border border-fog bg-snow p-3 shadow-[var(--shadow-md)]">
          <div className="space-y-2.5">
            {SLOTS.map((slot, index) => (
              <div key={slot.tag} className="flex items-start gap-2">
                <motion.span
                  className="flex h-3.5 w-9 shrink-0 items-center justify-center rounded-[5px] font-mono text-[8px] font-bold leading-none"
                  animate={{
                    backgroundColor: rewritten ? "#09090b" : "#f4f4f5",
                    color: rewritten ? "#ffffff" : "#a1a1aa",
                  }}
                  transition={reduced ? { duration: 0 } : { delay: index * 0.09, duration: 0.32 }}
                >
                  {slot.tag}
                </motion.span>

                <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                  {slot.lines.map((width, line) => (
                    <motion.span
                      key={width}
                      className="block h-1.5 rounded-full"
                      style={{ width }}
                      animate={{ backgroundColor: rewritten ? "#3f3f46" : "#d4d4d8" }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { delay: index * 0.09 + line * 0.05, duration: 0.32 }
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* La prise de l'agent, au pied de la page : c'est lui qui pose les
              textes validés dans le code du site. */}
          <div className="mt-3 flex items-center gap-2 border-t border-fog pt-2.5">
            <span className="h-1 w-8 rounded-full bg-fog" />
            <motion.span
              className="ml-auto flex h-4 items-center gap-1 rounded-pill px-2"
              animate={{ backgroundColor: rewritten ? "#09090b" : "#ececee" }}
              transition={reduced ? { duration: 0 } : { duration: 0.35 }}
            >
              <motion.span
                animate={{ opacity: rewritten ? 1 : 0, scale: rewritten ? 1 : 0.5 }}
                transition={
                  reduced ? { duration: 0 } : { delay: rewritten ? 0.3 : 0, duration: 0.25 }
                }
                className="flex text-white"
              >
                <RiCheckLine className="size-2.5" />
              </motion.span>
              <span className={`h-1 w-6 rounded-full ${rewritten ? "bg-white/70" : "bg-pebble"}`} />
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  );
}
