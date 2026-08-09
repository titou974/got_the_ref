"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { UnlockAnalysisButton } from "@/components/UnlockAnalysisButton";
import { ROUTES } from "@/constants/routes";
import { ANALYSIS_PRICE } from "@/constants/plans";

/**
 * Sections réservées à l'analyse payée : on rend le vrai contenu derrière, flouté
 * et inerte (un aperçu « juste hors de portée »), avec un panneau central qui dit
 * ce qu'on débloque et ouvre directement le paiement de CETTE analyse.
 *
 * Le `variant` choisit le titre / sous-titre (namespace i18n `analysisReport.paywall`),
 * pour que les points d'appel restent propres.
 */
export type PaywallVariant =
  | "rankings"
  | "recommendations"
  | "prompt"
  | "content"
  | "presence"
  | "maps";

export function PaywallOverlay({
  variant,
  analysisId,
  children,
}: {
  variant: PaywallVariant;
  analysisId: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("analysisReport.paywall");

  return (
    <div className="relative isolate overflow-hidden rounded-3xl">
      {/* Aperçu réel : flouté, désaturé, et inerte (ni souris ni clavier). */}
      <div
        aria-hidden
        // `inert` retire tout le sous-arbre du focus clavier et de l'accessibilité.
        {...({ inert: "" } as Record<string, string>)}
        className="pointer-events-none select-none blur-[7px] saturate-[0.8]"
      >
        {children}
      </div>

      {/* Voile + panneau d'incitation, centré sur la zone verrouillée. */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-snow/55 p-5 backdrop-blur-[2px]">
        <div className="w-full max-w-sm rounded-3xl border border-fog bg-snow/90 p-6 text-center shadow-[var(--shadow-pill)] backdrop-blur">
          <span
            aria-hidden
            className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-obsidian text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
            </svg>
          </span>
          <h4 className="text-base font-bold">{t(`${variant}.title`)}</h4>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{t(`${variant}.subtitle`)}</p>

          <UnlockAnalysisButton analysisId={analysisId} className="mt-4" />

          <p className="mt-2 text-xs text-muted">{t("hint", { price: ANALYSIS_PRICE })}</p>
          <p className="mt-1 text-xs text-muted">
            {t("alreadyPaid")}{" "}
            <Link
              href={ROUTES.signIn}
              className="cursor-pointer font-medium text-text underline decoration-pebble underline-offset-2 hover:decoration-obsidian"
            >
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
