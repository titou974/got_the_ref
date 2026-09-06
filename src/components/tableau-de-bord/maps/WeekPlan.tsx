"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RiArrowDownSLine, RiArrowRightLine, RiCheckLine } from "@remixicon/react";
import type { MapsTask, MapsTaskId } from "./maps-priorities";

/**
 * La liste des chantiers de la fiche, et la correction qui s'ouvre dessous.
 *
 * Un chantier n'est pas un lien vers ailleurs : c'est un tiroir. On clique sur
 * la ligne, elle se déplie, la correction est là — le nom à changer, le texte à
 * copier, les cases à cocher. La page ne bouge pas sous le doigt et rien n'est
 * empilé plus bas « au cas où ». Fermé, un chantier tient en deux lignes ; c'est
 * ce qui permet d'en montrer huit sans que l'écran devienne un sommaire.
 *
 * Un seul ouvert à la fois. La liste dit un ordre de passage : deux tiroirs
 * ouverts en même temps, et l'ordre ne veut plus rien dire.
 *
 * Deux chantiers font exception et gardent leur carte plus bas : les avis et
 * les posts. Ce sont des ateliers où l'on revient plusieurs fois dans la
 * semaine — les enfermer dans un tiroir ferait rouvrir le tiroir dix fois. Leur
 * ligne fait donc défiler jusqu'à la carte au lieu de déplier.
 */
export function WeekPlan({
  tasks,
  checked,
  total,
  panels,
  locked = false,
}: {
  tasks: MapsTask[];
  /** Cases cochées sur la fiche, et cases que Google propose pour ce commerce. */
  checked: number;
  total: number;
  /** La correction de chaque chantier qui s'ouvre sur place, rendue au serveur. */
  panels: Partial<Record<MapsTaskId, React.ReactNode>>;
  /** L'offre n'ouvre pas les corrections : le tiroir montre leur place, pas leur texte. */
  locked?: boolean;
}) {
  const reduced = useReducedMotion();
  const [openId, setOpenId] = useState<MapsTaskId | null>(null);

  function activate(task: MapsTask) {
    if (task.target.kind === "anchor") {
      setOpenId(null);
      document
        .getElementById(task.target.anchor)
        ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      return;
    }
    setOpenId((current) => (current === task.id ? null : task.id));
  }

  /** Le chantier suivant, pour enchaîner sans refermer d'abord. */
  function goNext(index: number) {
    const next = tasks[index + 1];
    if (!next) {
      setOpenId(null);
      return;
    }
    activate(next);
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-[22px] font-bold leading-tight tracking-tight">
          {tasks.length === 0
            ? "Votre fiche est à jour"
            : `${countWord(tasks.length)} à faire sur votre fiche`}
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">
          {total > 0 ? (
            <>
              Votre fiche est complète à{" "}
              <span className="font-semibold tabular-nums text-text">
                {checked} cases sur {total}
              </span>
              .{" "}
            </>
          ) : null}
          {tasks.length === 0
            ? "Rien n'attend de vous. Revenez après votre prochain relevé."
            : locked
              ? "Dans l'ordre de ce que ça rapporte. Ouvrez pour voir où se pose chaque correction."
              : "Dans l'ordre de ce que ça rapporte. Ouvrez, corrigez, passez au suivant."}
        </p>
      </header>

      {tasks.length === 0 ? (
        <p className="flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-5 py-4 text-sm text-muted">
          <RiCheckLine size={18} className="shrink-0 text-success" />
          Les avis ont leur réponse, les textes sont écrits et les cases sont cochées.
        </p>
      ) : (
        <ol className="space-y-3">
          {tasks.map((task, index) => {
            const open = openId === task.id;
            const panel = task.target.kind === "drawer" ? panels[task.id] : null;
            // Un seul chantier porte le noir : celui qu'on regarde. Tant que
            // rien n'est ouvert, c'est le premier — celui par où commencer.
            const accented = open || (openId === null && index === 0);

            return (
              <li
                key={task.id}
                className={`overflow-hidden rounded-3xl border bg-surface transition-colors duration-200 ${
                  open ? "border-obsidian/20 shadow-[var(--shadow-md)]" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => activate(task)}
                  aria-expanded={task.target.kind === "drawer" ? open : undefined}
                  className="group flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left sm:px-[22px]"
                >
                  <span
                    className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[15px] font-bold tabular-nums transition-colors duration-200 ${
                      accented ? "bg-obsidian text-white" : "bg-mist text-obsidian"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{task.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{task.detail}</span>
                  </span>

                  {task.target.kind === "drawer" ? (
                    <span
                      className={`hidden shrink-0 items-center gap-1.5 rounded-pill px-[18px] py-2.5 text-sm font-medium transition-colors duration-200 sm:inline-flex ${
                        open
                          ? "bg-mist text-text"
                          : accented
                            ? "bg-obsidian text-white group-hover:bg-ink"
                            : "border border-border group-hover:bg-mist"
                      }`}
                    >
                      {open ? "Replier" : task.cta}
                      <RiArrowDownSLine
                        size={15}
                        className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      />
                    </span>
                  ) : (
                    <span
                      className={`hidden shrink-0 items-center gap-1.5 rounded-pill px-[18px] py-2.5 text-sm font-medium transition-colors duration-200 sm:inline-flex ${
                        accented
                          ? "bg-obsidian text-white group-hover:bg-ink"
                          : "border border-border group-hover:bg-mist"
                      }`}
                    >
                      {task.cta}
                      <RiArrowRightLine size={15} />
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {open && panel ? (
                    <motion.div
                      key="panel"
                      initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-5 pb-5 pt-5 sm:px-[22px] sm:pb-6">
                        {panel}

                        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                          <button
                            type="button"
                            onClick={() => goNext(index)}
                            className="cursor-pointer rounded-pill bg-obsidian px-[18px] py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
                          >
                            {tasks[index + 1] ? "Chantier suivant" : "J'ai terminé"}
                          </button>
                          <span className="text-[13px] tabular-nums text-muted">
                            Chantier {index + 1} sur {tasks.length}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** « Huit chantiers », « Un chantier » — le compte s'écrit, il ne se chiffre pas. */
function countWord(count: number): string {
  const words = [
    "Aucun chantier",
    "Un chantier",
    "Deux chantiers",
    "Trois chantiers",
    "Quatre chantiers",
    "Cinq chantiers",
    "Six chantiers",
    "Sept chantiers",
    "Huit chantiers",
  ];
  return words[count] ?? `${count} chantiers`;
}
