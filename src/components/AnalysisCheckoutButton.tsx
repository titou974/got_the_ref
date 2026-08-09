"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createAnalysisCheckoutAction } from "@/features/billing/actions";
import type { BillingCycle } from "@/constants/plans";

/**
 * Ouvre l'essai Visia pour un rapport précis : le rapport qui a amené le
 * visiteur ici lui est rattaché au moment de la souscription. Vit uniquement sur
 * la page tarifs — c'est le seul endroit où les montants sont annoncés.
 */
export function AnalysisCheckoutButton({
  analysisId,
  cycle,
  label,
  tone = "light",
  className = "",
}: {
  analysisId: string;
  cycle: BillingCycle;
  label: string;
  /** `light` = pilule blanche sur carte sombre, `dark` = pilule noire sur fond clair. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = useTranslations("pricing");
  const { execute, isPending, result } = useAction(createAnalysisCheckoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => execute({ analysisId, cycle })}
        disabled={isPending}
        className={`block w-full cursor-pointer rounded-full py-3 text-center font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          tone === "light"
            ? "bg-white text-obsidian hover:bg-white/90"
            : "bg-cta text-white shadow-[var(--shadow-pill)] hover:bg-cta-hover"
        }`}
      >
        {isPending ? t("redirecting") : label}
      </button>
      {result.serverError && (
        <p className="mt-2 text-center text-sm text-danger" role="alert">
          {result.serverError}
        </p>
      )}
    </div>
  );
}
