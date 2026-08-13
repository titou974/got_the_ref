"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createTrialCheckoutAction } from "@/features/billing/actions";

/**
 * Le chemin court vers l'essai : un clic, et on est sur Stripe. Pas de compte à
 * créer avant de payer — il s'ouvre au retour, à l'adresse utilisée pour le
 * paiement.
 */
export function TrialCheckoutButton({
  label,
  tone = "light",
  className = "",
}: {
  label: string;
  /** `light` = pilule blanche sur carte sombre, `dark` = pilule noire sur fond clair. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = useTranslations("pricing");
  const { execute, isPending, result } = useAction(createTrialCheckoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => execute()}
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
