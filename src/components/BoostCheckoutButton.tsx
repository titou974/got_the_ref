"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createBoostCheckoutAction } from "@/features/billing/actions";

/**
 * Le paiement du Coup de Boost : un clic, Stripe, et c'est réglé — une fois.
 * Aucun compte requis avant de payer ; il s'ouvre au retour, à l'adresse
 * utilisée pour le paiement.
 *
 * Pas de cycle de facturation à lire ici, contrairement au bouton d'essai :
 * l'offre n'a qu'un seul rythme, et il est écrit sur la carte.
 */
export function BoostCheckoutButton({
  label,
  analysisId,
  tone = "dark",
  className = "",
}: {
  label: string;
  /** Rapport à l'origine du paiement, s'il y en a un : il est débloqué au retour. */
  analysisId?: string;
  /** `dark` = pilule noire sur carte claire, `light` = pilule blanche sur fond sombre. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const t = useTranslations("pricing");
  const { execute, isPending, result } = useAction(createBoostCheckoutAction, {
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
        className={`block w-full cursor-pointer rounded-full py-3 text-center font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          tone === "dark"
            ? "bg-cta text-white shadow-[var(--shadow-pill)] hover:bg-cta-hover"
            : "bg-white text-obsidian hover:bg-white/90"
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
