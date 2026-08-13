"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { GoogleMark } from "./GoogleMark";

type Step = {
  num: string;
  title: string;
  body: string;
  chips: string[];
  mock: Record<string, unknown>;
};

/** Durée d'une étape avant passage automatique à la suivante. */
const STEP_MS = 7000;

/**
 * Le déroulé du produit, en carrousel plutôt qu'en quatre cartes côte à côte :
 * une seule étape à lire à la fois, sa maquette à droite, et une barre de
 * progression qui dit où l'on en est. L'avance est automatique — on peut
 * reprendre la main avec les flèches, et l'automatisme s'arrête alors : la
 * lecture manuelle prime toujours sur la boucle.
 */
export function HowItWorks() {
  const t = useTranslations("howItWorks");
  const reduce = useReducedMotion();
  const steps = t.raw("steps") as Step[];
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || reduce) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % steps.length), STEP_MS);
    return () => clearTimeout(id);
  }, [auto, index, reduce, steps.length]);

  function go(next: number) {
    setAuto(false);
    setIndex((next + steps.length) % steps.length);
  }

  const step = steps[index];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
      <h2 className="mt-3 max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
        {t("title")}
      </h2>
      <p className="mt-3 max-w-xl text-pretty text-muted">{t("subtitle")}</p>

      <div className="card-cal mt-10 grid grid-cols-1 overflow-hidden lg:grid-cols-2">
        {/* Le texte de l'étape */}
        <div className="flex flex-col justify-between p-6 sm:p-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.num}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <span className="text-sm font-bold tabular-nums text-ash">{step.num}</span>
              <h3 className="mt-4 text-balance text-2xl font-bold leading-snug sm:text-3xl">
                {step.title}
              </h3>
              <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted sm:text-base">
                {step.body}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {step.chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-fog bg-snow px-3 py-1.5 text-xs font-medium text-graphite"
                  >
                    <CheckCircle />
                    {chip}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progression et navigation */}
          <div className="mt-10 flex items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-2">
              {steps.map((s, i) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t("goTo", { num: s.num })}
                  aria-current={i === index || undefined}
                  className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-fog"
                >
                  {i === index && (
                    <motion.span
                      key={`${index}-${auto}`}
                      initial={{ width: reduce || !auto ? "100%" : 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: reduce || !auto ? 0 : STEP_MS / 1000, ease: "linear" }}
                      className="block h-full bg-obsidian"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 gap-2">
              <ArrowButton label={t("prev")} onClick={() => go(index - 1)} direction="left" />
              <ArrowButton label={t("next")} onClick={() => go(index + 1)} direction="right" />
            </div>
          </div>
        </div>

        {/* La maquette de l'étape */}
        <div className="relative min-h-[20rem] border-t border-fog bg-mist p-6 sm:p-9 lg:border-l lg:border-t-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.num}
              initial={reduce ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="h-full"
            >
              {index === 0 && <AnalysisMock step={step} />}
              {index === 1 && <RankMock step={step} />}
              {index === 2 && <FixMock step={step} />}
              {index === 3 && <RemeasureMock step={step} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Maquettes -------------------------------- */

type AnalysisMockData = { url: string; pill: string; chips: string[] };

/** 01 — le site passé au crible : un balayage traverse les critères relevés. */
function AnalysisMock({ step }: { step: Step }) {
  const reduce = useReducedMotion();
  const mock = step.mock as unknown as AnalysisMockData;

  return (
    <div className="overflow-hidden rounded-[20px] border border-fog bg-snow shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-1.5 border-b border-fog px-3 py-2" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
      </div>

      <div className="p-4">
        <div className="mx-auto flex w-full max-w-[18rem] items-center gap-2 rounded-full border border-fog bg-snow px-2.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <GoogleMark size={14} />
          <span className="min-w-0 flex-1 truncate text-[12px] text-graphite">{mock.url}</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-obsidian text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 19V5M6 11l6-6 6 6"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <div className="relative mt-5">
          <ul className="flex flex-wrap justify-center gap-2">
            {mock.chips.map((chip) => (
              <li
                key={chip}
                className="rounded-lg border border-fog bg-mist px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-ash"
              >
                {chip}
              </li>
            ))}
          </ul>

          {/* Le balayage : la ligne d'analyse qui descend sur les critères. */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
            initial={{ top: "8%" }}
            animate={reduce ? { top: "50%" } : { top: ["8%", "82%", "8%"] }}
            transition={{ duration: 5.2, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
          >
            <span className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-obsidian/35 to-transparent" />
            <span className="relative rounded-full border border-obsidian bg-snow px-2.5 py-1 text-[10px] font-semibold text-obsidian shadow-[var(--shadow-md)]">
              {mock.pill}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

type RankMockData = {
  label: string;
  you: string;
  engines: { name: string; rank: string; others: string[] }[];
};

/** 02 — les moteurs interrogés, et la place occupée dans chaque réponse. */
function RankMock({ step }: { step: Step }) {
  const mock = step.mock as unknown as RankMockData;

  return (
    <div className="space-y-3">
      {mock.engines.map((engine, e) => (
        <div key={engine.name} className="rounded-[18px] border border-fog bg-snow p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Image
                src={engine.name === "ChatGPT" ? "/chatgpt.png" : "/gemini.webp"}
                alt=""
                aria-hidden
                width={32}
                height={32}
                className="h-4 w-4"
              />
              {engine.name}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-steel">
              {mock.label}
            </span>
          </div>

          <ol className="mt-3 space-y-1">
            {[mock.you, ...engine.others].map((name, i) => {
              const mine = i === 0;
              return (
                <motion.li
                  key={name}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + e * 0.1 + i * 0.12, duration: 0.3, ease: "easeOut" }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${
                    mine ? "bg-mist font-semibold" : "text-muted"
                  }`}
                >
                  <span className="w-3 shrink-0 tabular-nums text-ash">
                    {mine ? engine.rank : i + 1}.
                  </span>
                  <span className="truncate">{name}</span>
                </motion.li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

type FixMockData = {
  applied: string;
  impact: string;
  rows: { title: string; value: string }[];
};

/** 03 — les correctifs classés par impact, appliqués un par un. */
function FixMock({ step }: { step: Step }) {
  const reduce = useReducedMotion();
  const mock = step.mock as unknown as FixMockData;
  const [applied, setApplied] = useState(reduce ? mock.rows.length : 0);

  useEffect(() => {
    if (reduce || applied >= mock.rows.length) return;
    const id = setTimeout(() => setApplied((n) => n + 1), 900);
    return () => clearTimeout(id);
  }, [applied, mock.rows.length, reduce]);

  return (
    <ul className="space-y-2">
      {mock.rows.map((row, i) => (
        <li
          key={row.title}
          className="flex items-center gap-2.5 rounded-[16px] border border-fog bg-snow px-3 py-2.5"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-text">{row.title}</span>
            <span className="text-[10px] text-ash">
              {mock.impact.replace("{value}", row.value)}
            </span>
          </span>

          {i < applied ? (
            <motion.span
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex shrink-0 items-center gap-1 rounded-full bg-obsidian px-2 py-0.5 text-[9px] font-semibold text-white"
            >
              {mock.applied}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="m5 12.5 4.5 4.5L19 7"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.span>
          ) : (
            <span
              className="h-4 w-4 shrink-0 animate-pulse rounded-full border-2 border-fog"
              aria-hidden
            />
          )}
        </li>
      ))}
    </ul>
  );
}

type RemeasureMockData = {
  scoreLabel: string;
  before: string;
  after: string;
  note: string;
  legend: string;
};

/** 04 — le score remesuré : l'anneau se remplit du score d'avant à celui d'après. */
function RemeasureMock({ step }: { step: Step }) {
  const reduce = useReducedMotion();
  const mock = step.mock as unknown as RemeasureMockData;
  const after = Number(mock.after);
  const circumference = 2 * Math.PI * 52;

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[20px] border border-fog bg-snow p-6">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-fog)" strokeWidth="10" />
          <motion.circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-obsidian)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference * (1 - Number(mock.before) / 100) }}
            animate={{ strokeDashoffset: circumference * (1 - after / 100) }}
            transition={{ duration: reduce ? 0 : 1.4, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{mock.after}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-steel">
            {mock.scoreLabel}
          </span>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-mist px-2 py-0.5 tabular-nums line-through">
          {mock.before}
        </span>
        <span aria-hidden>→</span>
        <span className="rounded-full bg-obsidian px-2 py-0.5 font-semibold tabular-nums text-white">
          {mock.after}
        </span>
        {mock.note}
      </p>

      <p className="mt-4 max-w-xs text-center text-[11px] text-ash">{mock.legend}</p>
    </div>
  );
}

/* -------------------------------- Détails --------------------------------- */

function CheckCircle() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="text-obsidian">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m8 12.2 2.6 2.6L16 9.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowButton({
  label,
  onClick,
  direction,
}: {
  label: string;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-fog bg-snow text-graphite transition-colors duration-200 hover:border-pebble hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={direction === "left" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
