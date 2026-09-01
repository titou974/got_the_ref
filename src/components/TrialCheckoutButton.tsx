"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { createTrialCheckoutAction } from "@/features/billing/actions";
import { useBillingCycle } from "@/components/pricing/BillingCycleContext";

/**
 * Le chemin court vers l'essai : un clic, et on est sur Stripe. Pas de compte à
 * créer avant d'ouvrir l'essai — il s'ouvre au retour, à l'adresse utilisée
 * pour enregistrer la carte.
 *
 * Rien n'est débité au passage : Stripe garde la carte et prélève au troisième
 * jour, si l'essai n'a pas été arrêté avant.
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
  // Le cycle vient des onglets de la carte tarif : c'est lui qui décide du
  // tarif prélevé à la fin de l'essai.
  const cycle = useBillingCycle();
  const { execute, isPending, result } = useAction(createTrialCheckoutAction, {
    onSuccess: ({ data }) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => execute({ cycle })}
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
