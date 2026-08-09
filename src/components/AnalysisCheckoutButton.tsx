"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createAnalysisCheckoutAction } from "@/features/billing/actions";

/**
 * Ouvre l'abonnement Visia pour un rapport précis : le rapport qui a amené le
 * visiteur ici lui est rattaché au moment du paiement. Vit uniquement sur la
 * page tarifs — c'est le seul endroit où le prix est annoncé.
 */
export function AnalysisCheckoutButton({
  analysisId,
  className = "",
}: {
  analysisId: string;
  className?: string;
}) {
  const t = useTranslations("pricing.plan");
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
        className="block w-full cursor-pointer rounded-full bg-white py-3 text-center font-medium text-obsidian transition-colors duration-200 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? t("ctaRedirecting") : t("ctaUnlock")}
      </button>
      {result.serverError && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {result.serverError}
        </p>
      )}
    </div>
  );
}
