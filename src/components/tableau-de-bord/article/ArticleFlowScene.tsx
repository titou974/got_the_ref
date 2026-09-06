"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RiCheckLine } from "@remixicon/react";

/**
 * La scène qui accompagne les trois étapes de la modale d'accueil des articles.
 *
 * Ce n'est pas trois illustrations mises bout à bout, mais un seul plan : la
 * barre du navigateur en haut, le fil qui descend, l'atelier d'article en bas.
 * Les trois pièces restent en place d'une étape à l'autre et changent d'état.
 * Le message tient dans cette continuité : c'est le même article qui traverse
 * le rattachement, la relecture et le départ.
 *
 * Les formes sont celles de la page article, à l'échelle du timbre-poste : le
 * rail de sommaire à gauche, la feuille à droite, la pilule de décision au
 * pied. Le client retrouve le même agencement en ouvrant son premier article.
 *
 * Le fil porte le sens du produit. À la première étape il se dessine : c'est le
 * rattachement du site. À la deuxième, des points y descendent : le ton de la
 * marque, lu sur le site, qui alimente la rédaction. À la troisième, la page
 * remonte le même fil et se dépose là d'où le ton était venu.
 */

/** Position et hauteur du fil, en pixels, dans le repère de la scène. */
const WIRE_TOP = 44;
const WIRE_HEIGHT = 32;

/** Les lignes de la feuille miniature, dans leurs largeurs de lecture. */
const SHEET_LINES = ["94%", "76%", "88%", "58%"];

export function ArticleFlowScene({
  step,
  sheetTitle,
}: {
  step: number;
  /** Le titre posé sur la feuille miniature, une fois l'article rédigé. */
  sheetTitle: string;
}) {
  const reduced = useReducedMotion();

  /** Le ton de la marque descend pendant la rédaction, et nulle part ailleurs. */
  const toneFlowing = step === 1 && !reduced;
  /** La page remonte vers le site une fois le départ automatique expliqué. */
  const pageRising = step === 2 && !reduced;

  const written = step >= 1;

  return (
    <div
      aria-hidden
      className="relative h-[200px] overflow-hidden rounded-3xl bg-mist sm:h-[216px]"
    >
      {/* ------------------------- Le site rattaché ------------------------ */}
      <div className="absolute inset-x-0 top-3.5 flex justify-center">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { delay: 0.08, duration: 0.4, ease: "easeOut" }}
          className="flex w-[78%] items-center gap-2 rounded-pill border border-fog bg-snow px-3 py-1.5 shadow-[var(--shadow-md)]"
        >
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-pebble" />
            <span className="size-1.5 rounded-full bg-pebble" />
          </span>

          {/* L'adresse s'allonge à la dernière étape : le domaine seul devient
              le domaine suivi du chemin de l'article publié. */}
          <motion.span
            className="h-1.5 rounded-full bg-ash/70"
            animate={{ width: step === 2 ? "64%" : "34%" }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          />

          <motion.span
            className="ml-auto flex size-3.5 shrink-0 items-center justify-center rounded-full bg-obsidian text-white"
            animate={{ opacity: step === 2 ? 1 : 0, scale: step === 2 ? 1 : 0.6 }}
            transition={reduced ? { duration: 0 } : { delay: step === 2 ? 0.5 : 0, duration: 0.3 }}
          >
            <RiCheckLine className="size-2.5" />
          </motion.span>
        </motion.div>
      </div>

      {/* ---------------------------- Le fil ------------------------------- */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: WIRE_TOP, height: WIRE_HEIGHT }}
      >
        <motion.span
          className="w-0.5 origin-top rounded-full"
          style={{
            height: WIRE_HEIGHT,
            backgroundImage:
              "repeating-linear-gradient(to bottom, var(--color-ash) 0 3px, transparent 3px 7px)",
          }}
          initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={reduced ? { duration: 0 } : { delay: 0.3, duration: 0.35, ease: "easeOut" }}
        />

        {/* Le ton de la marque, lu sur le site et versé dans la rédaction. */}
        {toneFlowing
          ? [0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="absolute left-1/2 top-0 size-1.5 rounded-full bg-obsidian"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: WIRE_HEIGHT, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 0.9,
                  delay: index * 0.28,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeIn",
                }}
              />
            ))
          : null}

        {/* L'article qui remonte se déposer sur le site. */}
        {pageRising ? (
          <motion.span
            className="absolute left-1/2 h-3 w-2.5 rounded-[2px] bg-obsidian"
            initial={{ y: WIRE_HEIGHT, opacity: 0 }}
            animate={{ y: -6, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.85, repeat: Infinity, repeatDelay: 1.1, ease: "easeOut" }}
          />
        ) : null}
      </div>

      {/* ------------------------ L'atelier d'article ---------------------- */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: WIRE_TOP + WIRE_HEIGHT }}
      >
        <motion.div
          className="w-[78%] rounded-2xl border border-fog bg-snow p-2.5 shadow-[var(--shadow-md)]"
          animate={{ opacity: step === 0 ? 0.55 : 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
        >
          <div className="flex gap-2.5">
            {/* Le rail de sommaire. Ses pastilles se remplissent quand les
                sections deviennent citables, comme dans l'atelier. */}
            <div className="w-[30%] shrink-0 space-y-2 border-r border-fog pr-2.5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <motion.span
                    className="size-2 shrink-0 rounded-full border"
                    animate={{
                      backgroundColor: written ? "#09090b" : "rgba(9,9,11,0)",
                      borderColor: written ? "#09090b" : "#d4d4d8",
                    }}
                    transition={
                      reduced ? { duration: 0 } : { delay: 0.15 + index * 0.12, duration: 0.3 }
                    }
                  />
                  <span className="h-1 flex-1 rounded-full bg-fog" />
                </div>
              ))}
            </div>

            {/* La feuille. Le titre est composé en serif, comme l'article publié. */}
            <div className="min-w-0 flex-1">
              <motion.p
                className="article-glyph truncate text-[11px] font-semibold leading-none text-obsidian"
                animate={{ opacity: written ? 1 : 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.35 }}
              >
                {sheetTitle}
              </motion.p>

              <div className="mt-2 space-y-1.5">
                {SHEET_LINES.map((width, index) => (
                  <motion.span
                    key={width}
                    className="block h-1.5 origin-left rounded-full bg-pebble"
                    style={{ width }}
                    animate={{ scaleX: written ? 1 : 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { delay: written ? 0.2 + index * 0.1 : 0, duration: 0.4, ease: "easeOut" }
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {/* La pilule de décision, au pied de l'atelier. */}
          <div className="mt-3 flex items-center gap-2 border-t border-fog pt-2.5">
            <span className="h-1 w-10 rounded-full bg-fog" />
            <motion.span
              className="ml-auto flex h-4 items-center gap-1 rounded-pill px-2"
              animate={{ backgroundColor: written ? "#09090b" : "#ececee" }}
              transition={reduced ? { duration: 0 } : { duration: 0.35 }}
            >
              <motion.span
                animate={{ opacity: step === 2 ? 1 : 0, scale: step === 2 ? 1 : 0.5 }}
                transition={reduced ? { duration: 0 } : { duration: 0.25 }}
                className="flex text-white"
              >
                <RiCheckLine className="size-2.5" />
              </motion.span>
              <span className={`h-1 w-6 rounded-full ${written ? "bg-white/70" : "bg-pebble"}`} />
            </motion.span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
