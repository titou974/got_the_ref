"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GeoAnalysisResult } from "@/lib/geo/types";
import { CATEGORY_META } from "@/lib/geo/types";
import type { AnalysisDiagnostic } from "@/lib/geo/diagnostic";
import { buildSolutionPrompt } from "@/lib/geo/solution-prompts";
import { scoreColor } from "@/lib/score";
import { AnimatedScoreRing } from "./AnimatedScoreRing";
import { AnimatedCard } from "./AnimatedCard";
import { CategoryRadar } from "./CategoryRadar";
import { SolutionBlock } from "./SolutionBlock";
import { SiteScreenshot } from "./SiteScreenshot";
import { TrendingKeywords } from "./TrendingKeywords";
import { ArticleCalendar } from "./ArticleCalendar";
import { DiagnosticGrid } from "@/components/geo/DiagnosticGrid";
import { EngineCard } from "@/components/geo/EngineRankings";
import { OnPageElement, OpeningHoursBlock } from "@/components/geo/OnPageElement";
import { CrawlerGrid, ProfileHeader, StackCard } from "@/components/geo/SiteProfile";
import { Recommendations } from "@/components/geo/Recommendations";
import {
  AnalysisIdProvider,
  LockedBlock,
  LockedPill,
  LockedProvider,
  Obscured,
  SectionHeader,
  UnlockBar,
  Veil,
  type PaywallVariant,
} from "./LockedContent";

type TabKey = "results" | "architecture" | "content" | "presence" | "maps";

/**
 * Verrouille `children` quand `locked` est vrai : le titre et le sous-titre du
 * bloc restent nets, seul le contenu chiffré est flouté.
 */
function Gated({
  locked,
  variant,
  title,
  subtitle,
  children,
}: {
  locked: boolean;
  variant: PaywallVariant;
  /** Titre réel de la section, conservé net une fois verrouillée. */
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <LockedBlock variant={variant} title={title} subtitle={subtitle}>
      {children}
    </LockedBlock>
  );
}

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

export function ReportTabs({
  result,
  diagnostic,
  locked,
  analysisId,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  /** Analyse gratuite : tout sauf l'architecture est verrouillé derrière le paywall. */
  locked: boolean;
  /** Analyse à débloquer si l'utilisateur paie depuis un overlay. */
  analysisId: string;
}) {
  const t = useTranslations("analysisReport");
  // On ouvre toujours sur « Résultats et recommandations », y compris en
  // gratuit : c'est ce que le visiteur vient chercher en sortant de l'analyse.
  // Le premier bloc de l'onglet (profil + diagnostic d'architecture) est libre,
  // seules les mesures plus bas restent floutées.
  const [active, setActive] = useState<TabKey>("results");

  // L'onglet Maps n'a de sens que pour un commerce physique.
  const tabs: TabKey[] = result.profile.isPhysical
    ? ["results", "architecture", "content", "presence", "maps"]
    : ["results", "architecture", "content", "presence"];

  return (
    <AnalysisIdProvider value={analysisId}>
    <LockedProvider value={locked}>
    <section>
      {/* Barre d'onglets */}
      <div className="mb-5 flex flex-wrap gap-2 rounded-3xl border border-fog bg-snow p-1.5">
        {tabs.map((key) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              aria-pressed={isActive}
              className={`relative flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40 ${
                isActive ? "text-white" : "text-muted hover:text-text"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="report-tab-pill"
                  aria-hidden
                  // Pendant le ressort, la pilule survole les onglets voisins :
                  // sans cela elle intercepte leur appui.
                  className="pointer-events-none absolute inset-0 rounded-full bg-obsidian"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative" style={{ color: isActive ? "#ffffff" : undefined }}>
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
          {active === "results" && <ResultsPanel result={result} diagnostic={diagnostic} locked={locked} />}
          {active === "architecture" && <ArchitecturePanel result={result} diagnostic={diagnostic} locked={locked} />}
          {active === "content" && (
            <ContentPanel result={result} diagnostic={diagnostic} locked={locked} />
          )}
          {active === "presence" && (
            <PresencePanel result={result} diagnostic={diagnostic} locked={locked} />
          )}
          {active === "maps" && (
            <MapsPanel result={result} diagnostic={diagnostic} locked={locked} />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
    </LockedProvider>
    </AnalysisIdProvider>
  );
}

/* ------------------------------- Panneaux --------------------------------- */

function ResultsPanel({
  result,
  diagnostic,
  locked,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  locked: boolean;
}) {
  const t = useTranslations("analysisReport");

  return (
    <div className="space-y-4">
      {/* 1. Profil : niche + localisation (en tout premier) */}
      <ProfileHeader profile={result.profile} />

      {/* 2. Diagnostic d'architecture (synthèse) — gratuit, toujours visible en premier */}
      <AnimatedCard delay={0.05} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-3 text-center lg:border-r lg:border-fog">
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

      {/* 3. Classement par moteur IA (API payante). Verrouillé : on garde le titre
             de section et la carte de chaque moteur nets, seule la mesure se floute. */}
      <section>
        <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="text-lg font-bold">{t("results.engineScoresTitle")}</h3>
          {locked && <LockedPill />}
        </div>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          {locked
            ? t("paywallRankingsSubtitle")
            : result.liveQuery
              ? t("results.testedOn", { query: result.liveQuery })
              : t("results.engineScoresSubtitle")}
        </p>
        <div className="space-y-4">
          {result.engines.map((e, i) => (
            <EngineCard key={e.engine} engine={e} delay={i * 0.05} locked={locked} />
          ))}
        </div>
        {locked && <UnlockBar variant="rankings" />}
      </section>

      {/* 5. Recommandations (issues des sections payantes) → verrouillé en gratuit */}
      <Gated
        locked={locked}
        variant="recommendations"
        title={t("results.recommendationsTitle")}
        subtitle={t("paywallRecommendationsSubtitle")}
      >
        <div>
          {!locked && (
            <div className="mb-3 mt-2">
              <h3 className="text-lg font-bold">{t("results.recommendationsTitle")}</h3>
              <p className="text-sm text-muted">{t("results.recommendationsSubtitle")}</p>
            </div>
          )}
          <Recommendations
            recommendations={result.recommendations}
            emptyLabel={t("results.noRecommendations")}
          />
        </div>
      </Gated>

      <SolutionBlock prompt={buildSolutionPrompt("results", result, diagnostic)} locked={locked} />
      {locked && <UnlockBar variant="prompt" />}
    </div>
  );
}

function ArchitecturePanel({
  result,
  diagnostic,
  locked,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  locked: boolean;
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

        <StackCard stack={result.signals.stack ?? null} />

        <CrawlerGrid crawlers={result.signals.crawlers} />
      </div>

      <SolutionBlock
        prompt={buildSolutionPrompt("architecture", result, diagnostic)}
        locked={locked}
      />
      {locked && <UnlockBar variant="prompt" />}
    </div>
  );
}

function ContentPanel({
  result,
  diagnostic,
  locked,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  locked: boolean;
}) {
  const t = useTranslations("analysisReport");
  const contentCats = result.categories.filter((c) =>
    ["contentEEAT", "citability", "brandAuthority"].includes(c.key),
  );

  return (
    <div className="space-y-4">
      {/* Éléments on-page réels (titre, meta, H1, horaires) — signaux du crawl,
          gratuits, jamais floutés. */}
      <AnimatedCard>
        <h3 className="text-lg font-bold">{t("content.onPage.title")}</h3>
        <p className="mt-1 text-sm text-muted">{t("content.onPage.subtitle")}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OnPageElement label={t("content.onPage.elements.title")} check={result.onPageContent.title} />
          <OnPageElement label={t("content.onPage.elements.metaDescription")} check={result.onPageContent.metaDescription} />
          <OnPageElement label={t("content.onPage.elements.h1")} check={result.onPageContent.h1} />
          <OnPageElement label={t("content.onPage.elements.firstSentence")} check={result.onPageContent.firstSentence} />
        </div>
        <OpeningHoursBlock value={result.onPageContent.openingHours} />
      </AnimatedCard>

      {/* Notation E-E-A-T / citabilité : les intitulés disent ce qui est examiné,
          seuls la note et les conclusions restent fermées en gratuit. */}
      <section>
        <SectionHeader title={t("content.title")} subtitle={t("content.subtitle")} locked={locked} />
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left lg:col-span-2">
              <ScoreOrVeil score={diagnostic.content.score} label={t("content.scoreLabel")} locked={locked} />
              <div className="flex-1">
                <h3 className="text-lg font-bold">{t("content.eeatTitle")}</h3>
                <p className="mt-2 text-pretty text-sm text-muted">{t("content.eeatSubtitle")}</p>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.05}>
              <ul className="flex flex-col justify-center gap-3">
                {contentCats.map((c) => (
                  <div key={c.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      {/* Le nom de la catégorie est constant : il reste net. */}
                      <span className="text-muted">{CATEGORY_META[c.key].short}</span>
                      {locked ? (
                        <Veil>
                          <span className="font-semibold" style={{ color: scoreColor(c.score) }}>
                            {c.score}
                          </span>
                        </Veil>
                      ) : (
                        <span className="font-semibold" style={{ color: scoreColor(c.score) }}>
                          {c.score}
                        </span>
                      )}
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-fog">
                      <motion.div
                        className={`h-full rounded-full ${locked ? "blur-[3px]" : ""}`}
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
              <DiagnosticGrid section={diagnostic.content} labelNs="content" veiled={locked} />
            </AnimatedCard>
          </div>

          <SolutionBlock prompt={buildSolutionPrompt("content", result, diagnostic)} locked={locked} />
          {locked && <UnlockBar variant="content" />}
        </div>
      </section>

      {/* Mots-clés tendances de la niche + réécriture du title, de la meta
          description et du H1 (Gemini + recherche Google sur l'audit complet). */}
      {result.trendingKeywords && (
        <TrendingKeywords
          insight={result.trendingKeywords}
          current={{
            title: result.onPageContent.title.text,
            metaDescription: result.onPageContent.metaDescription.text,
            h1: result.onPageContent.h1.text,
          }}
          locked={locked}
        />
      )}
    </div>
  );
}

/** Anneau de score : voilé quand le rapport est verrouillé, net sinon. */
function ScoreOrVeil({
  score,
  label,
  locked,
  size = 140,
  stroke = 12,
}: {
  score: number;
  label: string;
  locked: boolean;
  size?: number;
  stroke?: number;
}) {
  const ring = <AnimatedScoreRing score={score} size={size} stroke={stroke} label={label} />;
  return locked ? <Veil>{ring}</Veil> : ring;
}

function PresencePanel({
  result,
  diagnostic,
  locked,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  locked: boolean;
}) {
  const t = useTranslations("analysisReport.presence");
  const wp = result.webPresence;

  return (
    <div className="space-y-4">
      <SectionHeader title={t("title")} subtitle={t("subtitle")} locked={locked} />

      <AnimatedCard className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <ScoreOrVeil score={wp.score} label={t("scoreLabel")} locked={locked} />
        <div className="flex-1">
          <h3 className="text-lg font-bold">{t("summaryTitle")}</h3>
          {/* Le résumé est une conclusion de l'audit : c'est ce qu'on ferme. */}
          {locked ? (
            <Veil>
              <p className="mt-2 text-pretty text-sm text-muted">{wp.summary || t("subtitle")}</p>
            </Veil>
          ) : (
            <p className="mt-2 text-pretty text-sm text-muted">{wp.summary || t("subtitle")}</p>
          )}
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
          <Maybe veiled={locked}>
            {wp.qualifications.length ? (
              <ul className="space-y-2.5">
                {wp.qualifications.map((q, i) => (
                  <li key={i} className="rounded-lg border border-fog bg-mist p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text">{q.label}</span>
                      {q.source && <span className="shrink-0 text-xs text-steel">{q.source}</span>}
                    </div>
                    {q.detail && <p className="mt-1 text-sm text-muted">{q.detail}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noQualifications")}</p>
            )}
          </Maybe>
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
          <Maybe veiled={locked}>
            {wp.articles.length ? (
              <ul className="space-y-2.5">
                {wp.articles.map((a, i) => (
                  <li key={i} className="rounded-lg border border-fog bg-mist p-3">
                    <p className="text-sm font-medium text-text">{a.title}</p>
                    {a.source && <p className="mt-0.5 text-xs text-steel">{a.source}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noArticles")}</p>
            )}
          </Maybe>
        </AnimatedCard>
      </div>

      {/* Articles : le calendrier de publication automatique pour la niche. */}
      <ArticleCalendar profile={result.profile} createdAt={result.createdAt} locked={locked} />

      {wp.findings.length > 0 && (
        <AnimatedCard delay={0.15}>
          <h4 className="mb-3 font-semibold">{t("findingsTitle")}</h4>
          <Maybe veiled={locked}>
            <ul className="space-y-2">
              {wp.findings.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-obsidian" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Maybe>
        </AnimatedCard>
      )}

      <p className="text-xs text-muted/80">{t("disclaimer")}</p>

      <SolutionBlock prompt={buildSolutionPrompt("presence", result, diagnostic)} locked={locked} />
      {locked && <UnlockBar variant="presence" />}
    </div>
  );
}

/** Voile un bloc de conclusions quand il est verrouillé, le laisse net sinon. */
function Maybe({ veiled, children }: { veiled: boolean; children: React.ReactNode }) {
  return veiled ? <Obscured strength="sm">{children}</Obscured> : <>{children}</>;
}

function MapsPanel({
  result,
  diagnostic,
  locked,
}: {
  result: GeoAnalysisResult;
  diagnostic: AnalysisDiagnostic;
  locked: boolean;
}) {
  const t = useTranslations("analysisReport.maps");
  const coherence = result.mapsCoherence;
  const mapsUrl = result.mapsUrl;

  const solution = (
    <>
      <SolutionBlock prompt={buildSolutionPrompt("maps", result, diagnostic)} locked={locked} />
      {locked && <UnlockBar variant="maps" />}
    </>
  );

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
        {/* Capture Maps assombrie, message « analyse à venir » centré dessus */}
        <SiteScreenshot url={mapsUrl} variant="maps">
          <MapPin />
          <h3 className="text-lg font-bold text-white">{t("pendingTitle")}</h3>
          <p className="mx-auto max-w-md text-sm text-white/90">{t("pendingBody")}</p>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 cursor-pointer text-sm font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
            {t("viewListing")}
          </a>
        </SiteScreenshot>
        {solution}
      </div>
    );
  }

  // Analyse de cohérence disponible
  return (
    <div className="space-y-4">
      <SectionHeader title={t("title")} subtitle={t("subtitle")} locked={locked} />

      {/* Fiche renseignée : capture Maps assombrie, score de cohérence centré dessus.
          Le nom de la fiche et le lien restent nets — ce sont des faits, pas des conclusions. */}
      <SiteScreenshot url={mapsUrl} variant="maps" label={coherence.listingName ?? undefined}>
        <Maybe veiled={locked}>
          <AnimatedScoreRing
            score={coherence.score}
            size={140}
            sizeSm={112}
            stroke={12}
            label={t("scoreLabel")}
            trackColor="rgba(255,255,255,0.18)"
            labelClassName="text-white/80"
          />
        </Maybe>
        <div>
          <h3 className="text-lg font-bold text-white">{coherence.listingName ?? t("title")}</h3>
          <Maybe veiled={locked}>
            <p className="mx-auto mt-2 max-w-xl text-pretty text-sm text-white/90">{coherence.summary}</p>
          </Maybe>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block cursor-pointer text-sm font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
            {t("viewListing")}
          </a>
        </div>
      </SiteScreenshot>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnimatedCard delay={0.05} className="flex flex-col justify-center gap-4 lg:col-span-3 sm:flex-row sm:justify-center sm:gap-16">
          {coherence.rating != null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{t("ratingLabel")}</span>
              {locked ? (
                <Veil>
                  <span className="text-lg font-bold">{coherence.rating.toFixed(1)} / 5</span>
                </Veil>
              ) : (
                <span className="text-lg font-bold">{coherence.rating.toFixed(1)} / 5</span>
              )}
            </div>
          )}
          {coherence.reviewCount != null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{t("reviewsLabel")}</span>
              {locked ? (
                <Veil>
                  <span className="text-lg font-bold">{coherence.reviewCount}</span>
                </Veil>
              ) : (
                <span className="text-lg font-bold">{coherence.reviewCount}</span>
              )}
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
                <li key={i} className="flex items-center justify-between gap-3 border-b border-fog py-2.5 last:border-0">
                  <div className="min-w-0">
                    {/* Le point vérifié est constant ; son verdict, non. */}
                    <p className="truncate text-sm text-text">{m.label}</p>
                    <Maybe veiled={locked}>
                      <p className="truncate text-xs text-muted">{m.detail}</p>
                    </Maybe>
                  </div>
                  <Maybe veiled={locked}>
                    <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: m.consistent ? "#11b48c" : "#e5484d" }} />
                  </Maybe>
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
