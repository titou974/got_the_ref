"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

type Stat = { label: string; value: string };

/** Hauteurs relatives de la courbe de démonstration, en pourcentage. */
const BARS = [12, 16, 14, 22, 27, 24, 33, 41, 38, 52, 61, 58, 72, 81, 94];

/**
 * Le rappel que GEO et SEO ne s'opposent pas : la même hygiène de page sert les
 * deux. Les barres montent à l'entrée dans le champ de vision — et la légende
 * dit explicitement qu'il s'agit d'un aperçu de démonstration, pas d'un
 * résultat client.
 */
export function GoogleRankSection() {
  const t = useTranslations("googleRank");
  const reduce = useReducedMotion();
  const stats = t.raw("stats") as Stat[];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <div className="card-cal grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
          <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 max-w-md text-pretty text-muted">{t("subtitle")}</p>
        </div>

        <div className="rounded-[24px] border border-fog bg-mist p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[16px] border border-fog bg-snow px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-steel">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 text-base font-bold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex h-28 items-end gap-1.5 rounded-[16px] border border-fog bg-snow p-3">
            {BARS.map((height, i) => (
              <motion.span
                key={i}
                initial={{ height: "6%" }}
                whileInView={{ height: `${height}%` }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{
                  delay: reduce ? 0 : i * 0.045,
                  duration: reduce ? 0 : 0.5,
                  ease: "easeOut",
                }}
                className="flex-1 rounded-t-[3px] bg-obsidian"
                style={{ opacity: 0.35 + (i / BARS.length) * 0.65 }}
                aria-hidden
              />
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] text-ash">{t("caption")}</p>
        </div>
      </div>
    </section>
  );
}
