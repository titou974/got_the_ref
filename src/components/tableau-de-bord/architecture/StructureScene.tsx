"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RiCheckLine, RiSparkling2Fill } from "@remixicon/react";

/**
 * La scène des trois temps de la modale d'accueil de l'architecture.
 *
 * Un seul plan, comme pour les articles et le contenu : le moteur de réponse en
 * haut, le fil au milieu, le squelette du site en bas. Rien ne se remplace d'un
 * temps à l'autre, tout change d'état. C'est le propos de l'écran : les mêmes
 * cinq adresses sont demandées, jugées, puis complétées.
 *
 * Les lignes du bas sont celles de la carte « Squelette du site » : mêmes noms
 * de fichiers, mêmes pastilles monospace, même filet d'indentation sous la page
 * d'accueil, et le tramé rouge réservé aux lignes qui n'existent pas. Le client
 * reconnaît la carte avant de la lire.
 *
 * Le fil porte la lecture. Au premier temps, des points y descendent : c'est le
 * passage qui demande les fichiers. Au troisième, un jeton remonte quand les
 * fichiers manquants sont déposés, et ce que le moteur sait dire du site
 * s'allonge d'autant.
 */

/** Position et hauteur du fil, en pixels, dans le repère de la scène. */
const WIRE_TOP = 46;
const WIRE_HEIGHT = 24;

/** Le vert « Présent » et le rouge « Absent » de la carte du squelette. */
const OK = "#11b48c";
const MISSING = "#dc2626";

/**
 * Les cinq lignes du squelette, dans l'ordre où un moteur les demande. Les deux
 * absences sont celles qu'on rencontre le plus souvent : aucun llms.txt, aucune
 * donnée structurée sur l'accueil.
 */
const ROWS = [
  { key: "llmsTxt", glyph: "MD", name: "llms.txt", depth: 1, missing: true, note: "58%" },
  { key: "robotsTxt", glyph: "TXT", name: "robots.txt", depth: 1, missing: false, note: "44%" },
  { key: "sitemap", glyph: "XML", name: "sitemap.xml", depth: 1, missing: false, note: "38%" },
  { key: "home", glyph: "HTM", name: "/", depth: 1, missing: false, note: "50%" },
  { key: "jsonLd", glyph: "{ }", name: "ld+json", depth: 2, missing: true, note: "46%" },
] as const;

export function StructureScene({ step, domain }: { step: number; domain: string }) {
  const reduced = useReducedMotion();

  /** Le passage demande les fichiers au premier temps, et nulle part ailleurs. */
  const reading = step === 0 && !reduced;
  /** Les verdicts restent acquis une fois posés. */
  const judged = step >= 1;
  /** Les fichiers manquants se déposent au troisième temps. */
  const filled = step === 2;

  return (
    <div aria-hidden className="relative h-[216px] overflow-hidden rounded-3xl bg-mist sm:h-[224px]">
      {/* --------------------- Le moteur de réponse ------------------------ */}
      <div className="absolute inset-x-0 top-3.5 flex justify-center">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { delay: 0.08, duration: 0.4, ease: "easeOut" }}
          className="flex w-[80%] items-center gap-2 rounded-pill border border-fog bg-snow px-3 py-1.5 shadow-[var(--shadow-md)]"
        >
          <RiSparkling2Fill className="size-3 shrink-0 text-obsidian" />

          <span className="truncate font-mono text-[10px] leading-none text-graphite">{domain}</span>

          {/* Ce que le moteur sait dire du site. La ligne s'allonge quand les
              fichiers manquants sont déposés : il a de quoi répondre. */}
          <motion.span
            className="h-1.5 rounded-full bg-ash/70"
            animate={{ width: filled ? "42%" : "18%" }}
            transition={reduced ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
          />

          <motion.span
            className="ml-auto flex size-3.5 shrink-0 items-center justify-center rounded-full bg-obsidian text-white"
            animate={{ opacity: filled ? 1 : 0, scale: filled ? 1 : 0.6 }}
            transition={reduced ? { duration: 0 } : { delay: filled ? 0.6 : 0, duration: 0.3 }}
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
          transition={reduced ? { duration: 0 } : { delay: 0.28, duration: 0.35, ease: "easeOut" }}
        />

        {/* Le passage qui descend chercher les adresses à la racine. */}
        {reading
          ? [0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="absolute left-1/2 top-0 size-1.5 rounded-full bg-obsidian"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: WIRE_HEIGHT, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 0.9,
                  delay: 0.4 + index * 0.26,
                  repeat: Infinity,
                  repeatDelay: 0.6,
                  ease: "easeIn",
                }}
              />
            ))
          : null}

        {/* Les fichiers déposés remontent vers le moteur, qui peut les lire. */}
        {filled && !reduced ? (
          <motion.span
            className="absolute left-1/2 h-3 w-2.5 rounded-[2px] bg-obsidian"
            initial={{ y: WIRE_HEIGHT, opacity: 0 }}
            animate={{ y: -6, opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 0.85,
              delay: 0.35,
              repeat: Infinity,
              repeatDelay: 1.2,
              ease: "easeOut",
            }}
          />
        ) : null}
      </div>

      {/* ------------------------ Le squelette du site --------------------- */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: WIRE_TOP + WIRE_HEIGHT }}
      >
        <div className="w-[80%] rounded-2xl border border-fog bg-snow px-2.5 py-2 shadow-[var(--shadow-md)]">
          {ROWS.map((row, index) => (
            <SkeletonRow
              key={row.key}
              row={row}
              index={index}
              judged={judged}
              filled={filled}
              reduced={Boolean(reduced)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Une ligne du squelette. Elle passe par trois états : demandée, jugée, puis
 * complétée pour celles qui manquaient. Le cadre tramé porte l'absence, la
 * pastille de droite porte le verdict.
 */
function SkeletonRow({
  row,
  index,
  judged,
  filled,
  reduced,
}: {
  row: (typeof ROWS)[number];
  index: number;
  judged: boolean;
  filled: boolean;
  reduced: boolean;
}) {
  /** Une ligne absente le reste tant que le dépôt n'a pas eu lieu. */
  const absent = row.missing && !filled;
  /** Le délai suit l'ordre de lecture : les verdicts tombent de haut en bas. */
  const delay = reduced ? 0 : index * 0.09;

  return (
    <motion.div
      className="flex items-center gap-1.5 rounded-lg px-1 py-[3px]"
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduced ? { duration: 0 } : { delay: 0.35 + index * 0.07, duration: 0.3 }}
    >
      {/* Le filet d'indentation, comme dans la carte : sa longueur dit la
          profondeur, et ld+json se lit sous la page d'accueil. */}
      <span
        className="block h-4 shrink-0 border-l border-fog"
        style={{ width: `${(row.depth - 1) * 10 + 4}px` }}
      />

      <span className="relative flex shrink-0">
        <motion.span
          className="flex h-[15px] w-[22px] items-center justify-center rounded-[5px] border font-mono text-[7px] font-bold leading-none"
          animate={{
            backgroundColor: absent ? "rgba(220,38,38,0.10)" : "#f4f4f5",
            borderColor: absent ? "rgba(220,38,38,0)" : "#ececee",
            color: absent ? MISSING : "#71717a",
          }}
          transition={reduced ? { duration: 0 } : { delay, duration: 0.35 }}
        >
          {row.glyph}
        </motion.span>

        {/* Le cadre tramé se pose par-dessus : `border-style` ne s'anime pas,
            son opacité si. */}
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-[5px] border border-dashed"
          style={{ borderColor: "rgba(220,38,38,0.45)" }}
          initial={false}
          animate={{ opacity: absent ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { delay, duration: 0.35 }}
        />
      </span>

      <motion.span
        className="shrink-0 font-mono text-[9px] leading-none"
        animate={{ color: absent ? "#18181b" : "#52525b" }}
        transition={reduced ? { duration: 0 } : { delay, duration: 0.35 }}
      >
        {row.name}
      </motion.span>

      {/* Ce que l'audit a relevé sur la ligne. Vide tant que le fichier manque :
          le contenu s'écrit au moment du dépôt. */}
      <span className="ml-1 flex h-1 flex-1">
        <motion.span
          className="block h-1 origin-left rounded-full bg-pebble"
          style={{ width: row.note }}
          initial={false}
          animate={{ scaleX: absent ? 0 : 1 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  delay: filled && row.missing ? 0.25 + delay : delay,
                  duration: 0.45,
                  ease: "easeOut",
                }
          }
        />
      </span>

      {/* Le verdict. Gris tant que le passage n'a pas répondu. */}
      <motion.span
        className="size-1.5 shrink-0 rounded-full"
        animate={{
          backgroundColor: !judged ? "#d4d4d8" : absent ? MISSING : OK,
          scale: judged && absent ? [1, 1.35, 1] : 1,
        }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                backgroundColor: { delay, duration: 0.3 },
                scale: { delay, duration: 1.4, repeat: absent ? Infinity : 0, repeatDelay: 0.5 },
              }
        }
      />
    </motion.div>
  );
}
