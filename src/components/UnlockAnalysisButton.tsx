"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/routes";

/**
 * Bouton de déblocage d'une analyse. Aucun prix ni paiement déclenché ici :
 * on renvoie vers la page tarifs, seul endroit où le prix est affiché.
 */
export function UnlockAnalysisButton({
  analysisId,
  className = "",
  label,
}: {
  analysisId: string;
  className?: string;
  label?: string;
}) {
  const t = useTranslations("unlock");

  return (
    <div className={className}>
      <Link
        href={`${ROUTES.pricing}?analyse=${analysisId}`}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover"
      >
        {label ?? t("cta")}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}
