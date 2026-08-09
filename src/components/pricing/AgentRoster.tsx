"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

/**
 * Les agents got_the_ref au travail.
 *
 * C'est l'argument de la page, montré plutôt qu'écrit : là où une agence rend un
 * rapport par mois, ces agents ne s'arrêtent jamais. Chaque ligne avance à son
 * propre rythme sur sa tâche du moment ; l'ensemble ne se synchronise jamais,
 * pour qu'on lise « ça tourne » et non « ça clignote ».
 */

const AGENT_KEYS = ["crawl", "schema", "citability", "engines", "local"] as const;

/** Décalage de départ par agent : le roster ne bat jamais à l'unisson. */
const OFFSETS = [0, 2, 3, 1, 4];

export function AgentRoster() {
  const t = useTranslations("pricing.agents");
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTick((n) => n + 1), 2600);
    return () => clearInterval(id);
  }, [reduced]);

  const tasks = t.raw("tasks") as string[];

  return (
    <div className="rounded-3xl bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span
            className={`absolute inline-flex h-full w-full rounded-full bg-white/70 ${
              reduced ? "" : "animate-ping"
            }`}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          {t("title")}
        </p>
      </div>

      <ul className="space-y-1">
        {AGENT_KEYS.map((key, i) => (
          <li
            key={key}
            className="flex items-baseline justify-between gap-3 border-b border-white/10 py-2 last:border-0"
          >
            <span className="text-sm font-medium text-white">{t(`names.${key}`)}</span>
            <span className="truncate text-right text-xs text-white/55">
              {tasks[(tick + OFFSETS[i]) % tasks.length]}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-white/50">{t("note")}</p>
    </div>
  );
}
