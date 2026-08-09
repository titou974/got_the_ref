"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createAnalysisCheckoutAction } from "@/features/billing/actions";
import { ANALYSIS_PRICE } from "@/constants/plans";

/**
 * Bouton de déblocage d'une analyse : ouvre Stripe Checkout pour ce rapport
 * précis. Aucun compte n'est requis — le compte se crée après le paiement.
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
  const { execute, isPending, result } = useAction(createAnalysisCheckoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => execute({ analysisId })}
        disabled={isPending}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t("redirecting") : (label ?? t("cta", { price: ANALYSIS_PRICE }))}
        {!isPending && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      {result.serverError && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {result.serverError}
        </p>
      )}
    </div>
  );
}
