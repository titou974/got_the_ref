"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatedCard } from "./AnimatedCard";
import { ROUTES } from "@/constants/routes";

/**
 * Bloc « solution » en bas de chaque onglet : le prompt prêt à coller dans
 * Claude/un agent IA, avec deux actions — copier le prompt, ou partager les
 * résultats à son développeur.
 */
export function SolutionBlock({ prompt }: { prompt: string }) {
  const t = useTranslations("analysisReport.solution");
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible : on ignore silencieusement */
    }
  }

  async function shareDev() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t("shareSubject"), url });
        return;
      } catch {
        /* l'utilisateur a annulé ou l'API a échoué : on retombe sur mailto */
      }
    }
    const subject = encodeURIComponent(t("shareSubject"));
    const body = encodeURIComponent(t("shareBody", { url }));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <AnimatedCard className="mt-4" delay={0.05}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 shrink-0 rounded-lg bg-accent/15 p-2 text-accent"
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 7l4 4-4 4M12 17h7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <h4 className="font-semibold">{t("title")}</h4>
          <p className="mt-0.5 text-sm text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <pre
        className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-text/90"
        aria-label={t("promptAriaLabel")}
      >
        {prompt}
      </pre>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copyPrompt}
          aria-live="polite"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cta px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
          {copied ? t("copied") : t("copyPrompt")}
        </button>
        <button
          type="button"
          onClick={shareDev}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-2.5 text-sm font-semibold text-text transition-colors duration-200 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {t("shareDev")}
        </button>
      </div>

      {/* CTA agence : redirige vers les services depuis chaque prompt-solution */}
      <p className="mt-4 border-t border-white/5 pt-4 text-sm text-muted">
        {t("agencyCtaText")}{" "}
        <Link
          href={ROUTES.services}
          className="cursor-pointer font-semibold text-accent hover:underline"
        >
          {t("agencyCtaLink")}
        </Link>
      </p>
    </AnimatedCard>
  );
}
