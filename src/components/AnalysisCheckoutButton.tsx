"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createAnalysisCheckoutAction } from "@/features/billing/actions";

/**
 * Déclenche réellement le paiement Stripe pour une analyse précise. Utilisé
 * uniquement sur la page tarifs (seul endroit où le prix est affiché) : les
 * boutons du rapport d'analyse renvoient ici sans jamais ouvrir le paiement
 * directement.
 */
export function AnalysisCheckoutButton({
  analysisId,
  className = "",
}: {
  analysisId: string;
  className?: string;
}) {
  const t = useTranslations("pricing.pro");
  const tu = useTranslations("unlock");
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
        className="block w-full cursor-pointer rounded-full bg-cta py-3 text-center font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? tu("redirecting") : t("ctaUnlock")}
      </button>
      {result.serverError && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {result.serverError}
        </p>
      )}
    </div>
  );
}
