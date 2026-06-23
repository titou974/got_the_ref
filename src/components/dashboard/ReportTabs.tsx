"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import type {
  GeoAnalysisResult,
  EngineScore,
  LocalRanking,
} from "@/lib/geo/types";
import { CATEGORY_META } from "@/lib/geo/types";
import type {
  AnalysisDiagnostic,
  DiagnosticCheck,
  DiagnosticSection,
  DiagnosticStatus,
} from "@/lib/geo/diagnostic";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";
import { scoreColor, visibilityColor, priorityColor } from "@/lib/score";
import { AnimatedScoreRing } from "./AnimatedScoreRing";
import { AnimatedCard } from "./AnimatedCard";
import { CategoryRadar } from "./CategoryRadar";
import { SolutionBlock } from "./SolutionBlock";

type TabKey = "results" | "architecture" | "content" | "presence" | "maps";

const STATUS_COLOR: Record<DiagnosticStatus, string> = {
  ok: "#11b48c",
  warn: "#f59e0b",
  ko: "#e5484d",
  unknown: "#94a3b8",
};

const SCORE_KEYS = new Set(["editorialQuality", "citability", "mapsCoherence"]);

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  results: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  architecture: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  content: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 5h14M5 10h14M5 15h9M5 20h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  presence: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  maps: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

function StatusPill({ status }: { status: DiagnosticStatus }) {
  const t = useTranslations("analysisReport.status");
  const color = STATUS_COLOR[status];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}22`, color }}
    >
      {t(status)}
    </span>
  );
}

function CheckRow({
  check,
  labelNs,
}: {
  check: DiagnosticCheck;
  labelNs: "architecture" | "content";
}) {
  const t = useTranslations("analysisReport");
  const label = t(`${labelNs}.checks.${check.key}`);

  let detail: string | null = null;
  if (check.value != null) {
    if (check.key === "schema") detail = check.value;
    else if (check.key === "wordCount") detail = t("content.units.words", { value: check.value });
    else if (check.key === "mapsReviews") detail = t("content.units.reviews", { value: check.value });
    else if (SCORE_KEYS.has(check.key)) detail = t("content.units.score", { value: check.value });
    else if (check.key === "h1") detail = t("architecture.h1Count", { value: check.value });
    else if (check.key === "aiCrawlers" && check.status !== "ok")
      detail = t("architecture.blockedCrawlers", { value: check.value });
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-text">{label}</p>
        {detail && <p className="truncate text-xs text-muted">{detail}</p>}
      </div>
      <StatusPill status={check.status} />
    </li>
  );
}

function DiagnosticGrid({
  section,
  labelNs,
}: {
  section: DiagnosticSection;
  labelNs: "architecture" | "content";
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {section.checks.map((c) => (
        <CheckRow key={c.key} check={c} labelNs={labelNs} />
      ))}
    </ul>
  );
}

export function ReportTabs({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = useTranslations("analysisReport");
  const [active, setActive] = useState<TabKey>("results");

  // L'onglet Maps n'a de sens que pour un commerce physique.
  const tabs: TabKey[] = result.profile.isPhysical
    ? ["results", "architecture", "content", "presence", "maps"]
    : ["results", "architecture", "content", "presence"];

  return (
    <section>
      {/* Barre d'onglets */}
      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-border bg-surface/50 p-1.5">
        {tabs.map((key) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              aria-pressed={isActive}
              className={`relative flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                isActive ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="report-tab-pill"
                  className="absolute inset-0 rounded-xl bg-accent/15"
                  style={{ border: "1px solid rgba(34,211,238,0.35)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative" style={{ color: isActive ? "var(--color-accent)" : undefined }}>
                {TAB_ICONS[key]}
              </span>
              <span className="relative">{t(`tabs.${key}`)}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {active === "results" && <ResultsPanel result={result} diagnostic={diagnostic} />}
          {active === "architecture" && <ArchitecturePanel result={result} diagnostic={diagnostic} />}
          {active === "content" && <ContentPanel result={result} diagnostic={diagnostic} />}
          {active === "presence" && <PresencePanel result={result} diagnostic={diagnostic} />}
          {active === "maps" && <MapsPanel result={result} diagnostic={diagnostic} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/* ----------------------------- Profil détecté ----------------------------- */

function ProfileHeader({ result }: { result: GeoAnalysisResult }) {
  const t = useTranslations("analysisReport.profile");
  const { niche, generalCategory, location, isPhysical } = result.profile;

  return (
    <AnimatedCard className="overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("eyebrow")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-xl font-bold sm:text-2xl">{niche}</h3>
        {generalCategory && generalCategory.toLowerCase() !== niche.toLowerCase() && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-muted">
            {generalCategory}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        {isPhysical && location ? (
          <span className="inline-flex items-center gap-1.5 text-text">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
              <path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {location}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 12h18M12 3c2.2 2.4 2.2 15.6 0 18M12 3c-2.2 2.4-2.2 15.6 0 18" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {t("online")}
          </span>
        )}
      </div>
    </AnimatedCard>
  );
}

/* ----------------------------- Carte moteur IA ---------------------------- */

function EngineCard({ engine }: { engine: EngineScore }) {
  const t = useTranslations("analysisReport.results");
  const vis = visibilityColor(engine.visibility);
  const ahead = engine.competitorsAhead ?? [];

  return (
    <div className="flex flex-col rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{engine.engine}</span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={
              engine.measured
                ? { background: "rgba(17,180,140,0.18)", color: "#11b48c" }
                : { background: "rgba(148,163,184,0.15)", color: "#94a3b8" }
            }
            title={engine.measured ? t("measuredHint") : t("estimatedHint")}
          >
            {engine.measured ? t("measured") : t("estimated")}
          </span>
        </div>
        <span className="shrink-0 text-lg font-bold" style={{ color: scoreColor(engine.score) }}>
          {engine.score}
        </span>
      </div>
      <span
        className="mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
        style={{ background: `${vis}22`, color: vis }}
      >
        {engine.visibility}
        {engine.estimatedPosition ? ` · #${engine.estimatedPosition}` : ""}
      </span>
      <p className="mt-2 text-xs text-muted">{engine.summary}</p>
      {ahead.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted/80">
            {t("competitorsAheadLabel")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ahead.map((name, i) => (
              <span key={i} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-text/80">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Classement local ----------------------------- */

function RankingCard({ ranking, delay }: { ranking: LocalRanking; delay: number }) {
  const t = useTranslations("analysisReport.results");
  const typeLabel = ranking.type === "niche" ? t("rankNiche") : t("rankGeneral");

  return (
    <AnimatedCard delay={delay}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={
              ranking.type === "niche"
                ? { background: "rgba(34,211,238,0.15)", color: "var(--color-accent)" }
                : { background: "rgba(148,163,184,0.15)", color: "#94a3b8" }
            }
          >
            {typeLabel}
          </span>
          <p className="mt-1.5 text-pretty text-sm font-semibold text-text">{ranking.label}</p>
        </div>
        {ranking.targetRank != null && (
          <span className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent">
            #{ranking.targetRank}
          </span>
        )}
      </div>
      <ol className="space-y-1">
        {ranking.competitors.map((c) => (
          <li
            key={`${c.rank}-${c.name}`}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${
              c.isTarget ? "bg-accent/10 ring-1 ring-inset ring-accent/30" : ""
            }`}
          >
            <span
              className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${
                c.isTarget ? "text-accent" : "text-muted"
              }`}
            >
              {c.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${c.isTarget ? "font-semibold text-text" : "text-text/90"}`}>
                {c.name}
                {c.isTarget && <span className="ml-2 text-xs font-semibold text-accent">{t("you")}</span>}
              </p>
              {c.note && <p className="truncate text-xs text-muted">{c.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </AnimatedCard>
  );
}

function LocalRankings({ result }: { result: GeoAnalysisResult }) {
  const t = useTranslations("analysisReport.results");
  if (!result.localRankings.length) return null;

  return (
    <div>
      <div className="mb-3 mt-2">
        <h3 className="text-lg font-bold">{t("rankingsTitle")}</h3>
        <p className="text-sm text-muted">{t("rankingsSubtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {result.localRankings.map((r, i) => (
          <RankingCard key={r.type} ranking={r} delay={i * 0.05} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted/80">{t("rankingDisclaimer")}</p>
    </div>
  );
}

/* ------------------------------- Panneaux --------------------------------- */

function ResultsPanel({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = useTranslations("analysisReport");

  return (
    <div className="space-y-4">
      {/* 1. Profil : niche + localisation (en tout premier) */}
      <ProfileHeader result={result} />

      {/* 2. Score par moteur IA (avec classement) */}
      <AnimatedCard delay={0.05}>
        <div className="mb-4">
          <h3 className="font-semibold">{t("results.engineScoresTitle")}</h3>
          {result.liveQuery && (
            <p className="mt-0.5 text-xs text-muted">
              {t("results.testedOn", { query: result.liveQuery })}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {result.engines.map((e) => (
            <EngineCard key={e.engine} engine={e} />
          ))}
        </div>
      </AnimatedCard>

      {/* 3. Classements concurrents (commerce physique uniquement) */}
      <LocalRankings result={result} />

      {/* 4. Diagnostic d'architecture (synthèse) */}
      <AnimatedCard delay={0.05} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-3 text-center lg:border-r lg:border-white/8">
          <AnimatedScoreRing score={diagnostic.architecture.score} size={120} stroke={10} label={t("results.scoreLabel")} />
          <div>
            <h3 className="font-semibold">{t("results.diagnosisTitle")}</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{t("results.diagnosisSubtitle")}</p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <DiagnosticGrid section={diagnostic.architecture} labelNs="architecture" />
        </div>
      </AnimatedCard>

      {/* 5. Recommandations */}
      <div>
        <div className="mb-3 mt-2">
          <h3 className="text-lg font-bold">{t("results.recommendationsTitle")}</h3>
          <p className="text-sm text-muted">{t("results.recommendationsSubtitle")}</p>
        </div>
        {result.recommendations.length ? (
          <div className="space-y-3">
            {result.recommendations.map((r, i) => (
              <AnimatedCard key={i} delay={i * 0.03} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span
                  className="inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
                  style={{ background: `${priorityColor(r.priority)}22`, color: priorityColor(r.priority) }}
                >
                  {r.priority}
                </span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold">{r.title}</h4>
                    <span className="shrink-0 text-xs text-muted">{t("results.impact", { value: r.impact })}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{r.description}</p>
                  <span className="mt-2 inline-block text-xs text-accent">{CATEGORY_META[r.category].label}</span>
                </div>
              </AnimatedCard>
            ))}
          </div>
        ) : (
          <AnimatedCard>
            <p className="text-sm text-muted">{t("results.noRecommendations")}</p>
          </AnimatedCard>
        )}
      </div>

      <SolutionBlock prompt={buildSolutionPrompt("results", result, diagnostic)} />
    </div>
  );
}

function ArchitecturePanel({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = useTranslations("analysisReport");
  const radarData = result.categories
    .filter((c) => ["technical", "structuredData", "platform"].includes(c.key))
    .map((c) => ({ label: CATEGORY_META[c.key].short, score: c.score }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:col-span-2">
          <AnimatedScoreRing score={diagnostic.architecture.score} size={140} stroke={12} label={t("architecture.scoreLabel")} />
          <div className="flex-1">
            <h3 className="text-lg font-bold">{t("architecture.title")}</h3>
            <p className="mt-2 text-pretty text-sm text-muted">{t("architecture.subtitle")}</p>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.05}>
          <h4 className="mb-2 font-semibold">{CATEGORY_META.technical.short}</h4>
          <CategoryRadar data={radarData} />
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="lg:col-span-3">
          <DiagnosticGrid section={diagnostic.architecture} labelNs="architecture" />
        </AnimatedCard>

        <AnimatedCard delay={0.15} className="lg:col-span-3">
          <h4 className="mb-3 font-semibold">{t("architecture.checks.aiCrawlers")}</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {result.signals.crawlers.map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm">
                <span className="truncate text-muted">{c.name}</span>
                <span
                  className="ml-2 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: c.allowed ? "#11b48c" : "#e5484d" }}
                  aria-label={c.allowed ? "Autorisé" : "Bloqué"}
                />
              </div>
            ))}
          </div>
        </AnimatedCard>
      </div>

      <SolutionBlock prompt={buildSolutionPrompt("architecture", result, diagnostic)} />
    </div>
  );
}

function ContentPanel({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = useTranslations("analysisReport");
  const contentCats = result.categories.filter((c) =>
    ["contentEEAT", "citability", "brandAuthority"].includes(c.key),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:col-span-2">
          <AnimatedScoreRing score={diagnostic.content.score} size={140} stroke={12} label={t("content.scoreLabel")} />
          <div className="flex-1">
            <h3 className="text-lg font-bold">{t("content.title")}</h3>
            <p className="mt-2 text-pretty text-sm text-muted">{t("content.subtitle")}</p>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.05}>
          <ul className="flex flex-col justify-center gap-3">
            {contentCats.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted">{CATEGORY_META[c.key].short}</span>
                  <span className="font-semibold" style={{ color: scoreColor(c.score) }}>
                    {c.score}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: scoreColor(c.score) }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${c.score}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </ul>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="lg:col-span-3">
          <DiagnosticGrid section={diagnostic.content} labelNs="content" />
        </AnimatedCard>
      </div>

      <SolutionBlock prompt={buildSolutionPrompt("content", result, diagnostic)} />
    </div>
  );
}

function PresencePanel({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = useTranslations("analysisReport.presence");
  const wp = result.webPresence;

  return (
    <div className="space-y-4">
      <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <AnimatedScoreRing score={wp.score} size={140} stroke={12} label={t("scoreLabel")} />
        <div className="flex-1">
          <h3 className="text-lg font-bold">{t("title")}</h3>
          <p className="mt-2 text-pretty text-sm text-muted">{wp.summary || t("subtitle")}</p>
        </div>
      </AnimatedCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Qualifications / labels / distinctions */}
        <AnimatedCard delay={0.05}>
          <h4 className="mb-3 flex items-center gap-2 font-semibold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
              <path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.5-.8L12 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            {t("qualificationsTitle")}
          </h4>
          {wp.qualifications.length ? (
            <ul className="space-y-2.5">
              {wp.qualifications.map((q, i) => (
                <li key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text">{q.label}</span>
                    {q.source && <span className="shrink-0 text-xs text-accent">{q.source}</span>}
                  </div>
                  {q.detail && <p className="mt-1 text-sm text-muted">{q.detail}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noQualifications")}</p>
          )}
        </AnimatedCard>

        {/* Apparitions presse / articles */}
        <AnimatedCard delay={0.1}>
          <h4 className="mb-3 flex items-center gap-2 font-semibold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
              <path d="M5 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 8h7M8 12h7M8 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t("articlesTitle")}
          </h4>
          {wp.articles.length ? (
            <ul className="space-y-2.5">
              {wp.articles.map((a, i) => (
                <li key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <p className="text-sm font-medium text-text">{a.title}</p>
                  {a.source && <p className="mt-0.5 text-xs text-accent">{a.source}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noArticles")}</p>
          )}
        </AnimatedCard>
      </div>

      {wp.findings.length > 0 && (
        <AnimatedCard delay={0.15}>
          <h4 className="mb-3 font-semibold">{t("findingsTitle")}</h4>
          <ul className="space-y-2">
            {wp.findings.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </AnimatedCard>
      )}

      <p className="text-xs text-muted/80">{t("disclaimer")}</p>

      <SolutionBlock prompt={buildSolutionPrompt("presence", result, diagnostic)} />
    </div>
  );
}

function MapsPanel({
  result,
  diagnostic,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
}) {
  const t = useTranslations("analysisReport.maps");
  const coherence = result.mapsCoherence;
  const mapsUrl = result.mapsUrl;

  const solution = <SolutionBlock prompt={buildSolutionPrompt("maps", result, diagnostic)} />;

  // Aucune fiche fournie
  if (!mapsUrl) {
    return (
      <div className="space-y-4">
        <AnimatedCard className="flex flex-col items-center gap-3 py-10 text-center">
          <MapPin />
          <h3 className="text-lg font-bold">{t("noListingTitle")}</h3>
          <p className="max-w-md text-sm text-muted">{t("noListingBody")}</p>
        </AnimatedCard>
        {solution}
      </div>
    );
  }

  // Fiche fournie mais cohérence pas encore analysée
  if (!coherence) {
    return (
      <div className="space-y-4">
        <AnimatedCard className="flex flex-col items-center gap-3 py-10 text-center">
          <MapPin />
          <h3 className="text-lg font-bold">{t("pendingTitle")}</h3>
          <p className="max-w-md text-sm text-muted">{t("pendingBody")}</p>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 cursor-pointer text-sm text-accent hover:underline">
            {t("viewListing")}
          </a>
        </AnimatedCard>
        {solution}
      </div>
    );
  }

  // Analyse de cohérence disponible
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:col-span-2">
          <AnimatedScoreRing score={coherence.score} size={140} stroke={12} label={t("scoreLabel")} />
          <div className="flex-1">
            <h3 className="text-lg font-bold">{coherence.listingName ?? t("title")}</h3>
            <p className="mt-2 text-pretty text-sm text-muted">{coherence.summary}</p>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block cursor-pointer text-sm text-accent hover:underline">
              {t("viewListing")}
            </a>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.05} className="flex flex-col justify-center gap-4">
          {coherence.rating != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t("ratingLabel")}</span>
              <span className="text-lg font-bold">{coherence.rating.toFixed(1)} / 5</span>
            </div>
          )}
          {coherence.reviewCount != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t("reviewsLabel")}</span>
              <span className="text-lg font-bold">{coherence.reviewCount}</span>
            </div>
          )}
          {coherence.rating == null && coherence.reviewCount == null && (
            <p className="text-sm text-muted">{t("noMetrics")}</p>
          )}
        </AnimatedCard>

        {coherence.matches.length > 0 && (
          <AnimatedCard delay={0.1} className="lg:col-span-3">
            <h4 className="mb-3 font-semibold">{t("matchesTitle")}</h4>
            <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {coherence.matches.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text">{m.label}</p>
                    <p className="truncate text-xs text-muted">{m.detail}</p>
                  </div>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.consistent ? "#11b48c" : "#e5484d" }} />
                </li>
              ))}
            </ul>
          </AnimatedCard>
        )}
      </div>
      {solution}
    </div>
  );
}

function MapPin() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-accent">
      <path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
