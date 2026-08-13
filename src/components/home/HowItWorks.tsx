"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

type Step = { num: string; title: string; body: string; chips: string[] };

/**
 * Le déroulé du produit en quatre temps. Chaque étape porte ses propres
 * étiquettes, qui se posent une à une à l'entrée dans le champ de vision : on
 * voit l'agent travailler plutôt que de lire qu'il travaille.
 */
export function HowItWorks() {
  const t = useTranslations("howItWorks");
  const reduce = useReducedMotion();
  const steps = t.raw("steps") as Step[];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>
      </div>

      <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.num} className="card-cal flex flex-col p-6 sm:p-7">
            <span className="text-sm font-bold tabular-nums text-ash">{step.num}</span>
            <h3 className="mt-3 text-xl font-bold leading-snug">{step.title}</h3>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">{step.body}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {step.chips.map((chip, j) => (
                <motion.span
                  key={chip}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{
                    delay: reduce ? 0 : 0.1 + j * 0.12,
                    duration: 0.32,
                    ease: "easeOut",
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-fog bg-mist px-3 py-1.5 text-xs font-medium text-graphite"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      i % 2 === 0 ? "bg-obsidian" : "bg-ash"
                    }`}
                    aria-hidden
                  />
                  {chip}
                </motion.span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
