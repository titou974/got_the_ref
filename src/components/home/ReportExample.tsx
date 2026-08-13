"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

type Block = { num: string; title: string; items: string[] };
type Stat = { label: string; value: string };

/**
 * Preuve que le rapport n'est pas un modèle : à gauche, les trois choses que
 * got_the_ref a déduites du site avant d'écrire quoi que ce soit ; à droite, la
 * liste des points de citabilité vérifiés, qui se cochent un à un.
 */
export function ReportExample() {
  const t = useTranslations("reportExample");
  const reduce = useReducedMotion();
  const blocks = t.raw("blocks") as Block[];
  const checks = t.raw("checks") as string[];
  const stats = t.raw("stats") as Stat[];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Ce que l'analyse a déduit du site */}
        <div className="card-cal p-6 sm:p-7">
          <p className="text-xs text-muted">
            {t("tailoredFor")}{" "}
            <span className="font-semibold text-text">{t("domain")}</span>
          </p>

          <ol className="mt-6 space-y-5">
            {blocks.map((block, i) => (
              <li key={block.num}>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-obsidian text-[10px] font-bold text-white">
                    {block.num}
                  </span>
                  <span className="text-sm font-semibold">{block.title}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
                  {block.items.map((item, j) => (
                    <motion.span
                      key={item}
                      initial={{ opacity: 0, y: 6 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.5 }}
                      transition={{
                        delay: reduce ? 0 : 0.08 * (i * 3 + j),
                        duration: 0.3,
                        ease: "easeOut",
                      }}
                      className="rounded-full border border-fog bg-mist px-3 py-1.5 text-xs text-graphite"
                    >
                      {item}
                    </motion.span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Les points de citabilité vérifiés */}
        <div className="card-cal p-6 sm:p-7">
          <h3 className="text-xl font-bold leading-snug">{t("checklistTitle")}</h3>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
            {t("checklistBody")}
          </p>

          <ul className="mt-6 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {checks.map((check, i) => (
              <motion.li
                key={check}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  delay: reduce ? 0 : 0.05 * i,
                  duration: 0.28,
                  ease: "easeOut",
                }}
                className="flex items-center gap-2 text-[13px] text-graphite"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-obsidian text-white">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="m5 12.5 4.5 4.5L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {check}
              </motion.li>
            ))}
          </ul>

          <dl className="mt-7 grid grid-cols-2 gap-3 border-t border-fog pt-5 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-steel">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
