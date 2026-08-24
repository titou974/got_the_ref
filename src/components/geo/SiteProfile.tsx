"use client";

import { useTranslations } from "next-intl";
import type { BusinessProfile, CrawlerAccess, DetectedStack } from "@/lib/geo/types";
import { AnimatedCard } from "@/components/dashboard/AnimatedCard";
import { StackMark } from "@/components/StackMark";

/**
 * Ce que l'audit a compris du commerce : sa niche, sa plateforme, l'accès laissé
 * aux robots d'IA.
 *
 * Ces trois blocs ouvrent le rapport d'analyse et ouvrent aussi le tableau de
 * bord. C'est voulu : le client vérifie d'abord qu'on parle bien de son métier
 * avant de lire une seule note.
 */

/** Niche détectée, catégorie large et zone couverte. */
export function ProfileHeader({ profile }: { profile: BusinessProfile }) {
  const t = useTranslations("analysisReport.profile");
  const { niche, generalCategory, location, isPhysical } = profile;

  return (
    <AnimatedCard className="overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{t("eyebrow")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-xl font-bold sm:text-2xl">{niche}</h3>
        {generalCategory && generalCategory.toLowerCase() !== niche.toLowerCase() && (
          <span className="rounded-full border border-fog bg-mist px-2.5 py-0.5 text-xs text-muted">
            {generalCategory}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        {isPhysical ? (
          <span className="inline-flex items-center gap-1.5 text-text">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              className="text-accent"
              aria-hidden
            >
              <path
                d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {location ?? t("physical")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M3 12h18M12 3c2.2 2.4 2.2 15.6 0 18M12 3c-2.2 2.4-2.2 15.6 0 18"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
            {t("online")}
          </span>
        )}
      </div>
    </AnimatedCard>
  );
}

/**
 * Plateforme qui sert le site (WordPress, Shopify, Next.js…). Elle a sa place
 * dans l'architecture : c'est elle qui décide où se posent les correctifs —
 * un llms.txt ne s'ajoute pas de la même façon sur Wix et sur Next.js.
 */
export function StackCard({
  stack,
  className = "lg:col-span-3",
  delay = 0.12,
}: {
  stack: DetectedStack | null;
  className?: string;
  delay?: number;
}) {
  const t = useTranslations("analysisReport.stack");

  return (
    <AnimatedCard delay={delay} className={className}>
      <h4 className="font-semibold">{t("title")}</h4>
      {stack ? (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mist text-obsidian">
            <StackMark id={stack.id} size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-lg font-bold">{stack.name}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={
                  stack.confidence === "sure"
                    ? { background: "rgba(17,180,140,0.18)", color: "#0a8f6e" }
                    : { background: "rgba(148,163,184,0.18)", color: "#52525b" }
                }
              >
                {stack.confidence === "sure" ? t("sure") : t("probable")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{stack.evidence}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="font-semibold text-text">{t("unknownTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("unknownBody")}</p>
        </div>
      )}
      <p className="mt-3 border-t border-fog pt-3 text-sm text-muted">{t("note")}</p>
    </AnimatedCard>
  );
}

/** Robots d'IA, un par pastille : vert s'ils passent, rouge s'ils sont bloqués. */
export function CrawlerGrid({
  crawlers,
  className = "lg:col-span-3",
  delay = 0.15,
}: {
  crawlers: CrawlerAccess[];
  className?: string;
  delay?: number;
}) {
  const t = useTranslations("analysisReport");

  return (
    <AnimatedCard delay={delay} className={className}>
      <h4 className="mb-3 font-semibold">{t("architecture.checks.aiCrawlers")}</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {crawlers.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between rounded-lg border border-fog bg-mist px-3 py-2 text-sm"
          >
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
  );
}
