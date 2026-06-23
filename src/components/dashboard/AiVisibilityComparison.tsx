"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import type { AiEngine, AiVisibility } from "@/lib/geo/types";

const ENGINE_META: Record<AiEngine, { color: string; logo: string }> = {
  ChatGPT: { color: "#11b48c", logo: "/chatgpt.png" },
  Gemini: { color: "#7fe9cf", logo: "/gemini.webp" },
};

/** Compteur animé (respecte prefers-reduced-motion). */
function useCountUp(target: number, run: boolean, reduced: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    // setState uniquement dans le rAF (jamais en synchrone dans l'effet).
    if (!run || reduced) return;
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduced]);
  return reduced ? target : run ? val : 0;
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

export function AiVisibilityComparison({ data }: { data: AiVisibility }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion() ?? false;
  const total = useCountUp(data.totalEstimatedMonthlyVisits, inView, reduced);

  const max = Math.max(1, ...data.engines.map((e) => e.estimatedMonthlyVisits));

  return (
    <div ref={ref} className="card-cal p-5 sm:p-6">
      {/* En-tête : total estimé + méthodologie */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Vues IA estimées · /mois
            </p>
            <span
              className="cursor-help text-muted/70 transition-colors hover:text-muted"
              title={data.methodologyNote}
              aria-label={data.methodologyNote}
            >
              <InfoIcon />
            </span>
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted">
              Estimation
            </span>
          </div>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums sm:text-4xl">
            {fmt(total)}
          </p>
          {data.topEngine && (
            <p className="mt-1 text-sm text-muted">
              <span className="font-semibold text-text">{data.topEngine}</span> génère le plus de
              vues IA estimées
            </p>
          )}
        </div>
      </div>

      {/* Barres comparatives par moteur */}
      <div className="mt-6 space-y-5">
        {data.engines.map((e, i) => {
          const meta = ENGINE_META[e.engine];
          const ratio = e.estimatedMonthlyVisits / max;
          return (
            <EngineBar
              key={e.engine}
              engine={e.engine}
              color={meta.color}
              logo={meta.logo}
              visits={e.estimatedMonthlyVisits}
              citationRate={e.citationRate}
              shareOfVoice={e.shareOfVoice}
              sampleQueries={e.sampleQueries}
              ratio={ratio}
              index={i}
              inView={inView}
              reduced={reduced}
            />
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted/70">
        {data.methodologyNote}
      </p>
    </div>
  );
}

function EngineBar({
  engine,
  color,
  logo,
  visits,
  citationRate,
  shareOfVoice,
  sampleQueries,
  ratio,
  index,
  inView,
  reduced,
}: {
  engine: AiEngine;
  color: string;
  logo: string;
  visits: number;
  citationRate: number;
  shareOfVoice: number;
  sampleQueries: AiVisibility["engines"][number]["sampleQueries"];
  ratio: number;
  index: number;
  inView: boolean;
  reduced: boolean;
}) {
  const visitsCount = useCountUp(visits, inView, reduced);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image
            src={logo}
            alt={engine}
            width={28}
            height={28}
            className="h-5 w-5 rounded bg-white/90 object-contain p-0.5"
          />
          <span className="text-sm font-medium">{engine}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="hidden sm:inline">
            <span className="font-semibold tabular-nums text-text">{citationRate}%</span> citations
          </span>
          <span>
            <span className="font-semibold tabular-nums text-text">{shareOfVoice}%</span> part de voix
          </span>
          <span className="font-mono font-semibold tabular-nums text-text">
            {fmt(visitsCount)}
          </span>
        </div>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(2, ratio * 100)}%`, background: color, transformOrigin: "left" }}
          initial={reduced ? false : { scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 + index * 0.12 }}
        />
      </div>
      {/* Requêtes témoins : cité / non cité */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sampleQueries.map((q, j) => (
          <span
            key={j}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem]"
            title={q.cited && q.position ? `Cité en position ~${q.position}` : "Non cité"}
            style={{
              borderColor: q.cited ? `${color}66` : "rgba(255,255,255,0.08)",
              color: q.cited ? color : undefined,
            }}
          >
            <span className={q.cited ? "" : "text-muted/60"}>
              {q.cited ? <CheckIcon /> : <CrossIcon />}
            </span>
            <span className={q.cited ? "text-text" : "text-muted/70"}>{q.query}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
