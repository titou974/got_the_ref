import { RiCheckLine } from "@remixicon/react";
import type { MapsTask } from "./maps-priorities";

/**
 * Les trois gestes de la semaine, en tête de page.
 *
 * Une échelle numérotée, et la numérotation dit quelque chose : c'est un ordre
 * de passage, pas une décoration. Le premier barreau est plein — c'est celui
 * qu'on fait maintenant — les suivants sont creux. Le commerçant qui n'a que
 * dix minutes sait où elles vont.
 *
 * Chaque barreau mène à la carte qui porte le geste, plus bas dans la page :
 * l'écran ne redit pas le travail, il y conduit.
 */
export function WeekTasks({
  tasks,
  checked,
  total,
}: {
  tasks: MapsTask[];
  /** Cases cochées sur la fiche, et cases que Google propose pour ce commerce. */
  checked: number;
  total: number;
}) {
  return (
    <section className="space-y-4">
      <header>
        {/* Sous le titre de section, pas à côté : « Google Maps » dit où l'on
            est, cette ligne dit ce qu'on y fait. Deux titres de même corps
            l'un sur l'autre se disputeraient l'entrée de la page. */}
        <h2 className="text-[22px] font-bold leading-tight tracking-tight">
          {tasks.length === 0 ? "Votre fiche est à jour" : "Trois gestes cette semaine"}
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
            : "Voici ce qui rapporte le plus, dans l'ordre."}
        </p>
      </header>

      {tasks.length === 0 ? null : (
        <ol className="space-y-3">
          {tasks.map((task, index) => (
            <li key={task.id}>
              <a
                href={`#${task.anchor}`}
                className="group flex items-center gap-4 rounded-3xl border border-border bg-surface px-5 py-4 transition-colors duration-200 hover:border-pebble sm:px-[22px]"
              >
                <span
                  className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[15px] font-bold tabular-nums ${
                    index === 0 ? "bg-obsidian text-white" : "bg-mist text-obsidian"
                  }`}
                >
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{task.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{task.detail}</span>
                </span>

                <span
                  className={`hidden shrink-0 rounded-pill px-[18px] py-2.5 text-sm font-medium transition-colors duration-200 sm:block ${
                    index === 0
                      ? "bg-obsidian text-white group-hover:bg-ink"
                      : "border border-border bg-surface group-hover:bg-mist"
                  }`}
                >
                  {task.cta}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {tasks.length === 0 ? (
        <p className="flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-5 py-4 text-sm text-muted">
          <RiCheckLine size={18} className="shrink-0 text-success" />
          Les avis ont leur réponse, les textes sont écrits et les cases sont cochées.
        </p>
      ) : null}
    </section>
  );
}
