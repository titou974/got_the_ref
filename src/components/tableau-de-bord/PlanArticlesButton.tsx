"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { planArticlesAction } from "@/features/dashboard/actions";

/**
 * Ajoute quatre sujets au planning, un par semaine, à la suite du dernier déjà
 * daté. Le rythme hebdomadaire n'est pas paramétrable ici : c'est celui que
 * l'abonnement annonce.
 *
 * Le bouton est posé dans l'en-tête du calendrier, à côté du compte de sujets
 * qu'il fait grandir. Il occupait auparavant une carte entière au-dessus, avec
 * une phrase d'explication : trois lignes d'écran pour un geste qu'on comprend
 * en lisant le bouton, et une carte de plus à traverser avant le planning.
 *
 * Le temps que le modèle réponde — trente à quarante secondes —, le bouton dit
 * ce qu'il cherche. Un bouton grisé et muet se lit comme un bouton cassé.
 */
export function PlanArticlesButton({ count = 4 }: { count?: number }) {
  const t = useTranslations("dashboard.articles");
  const router = useRouter();
  const { execute, isPending, result } = useAction(planArticlesAction, {
    onSuccess: () => router.refresh(),
  });

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => execute({ count, everyDays: 7 })}
        className="inline-flex cursor-pointer items-center gap-2 rounded-pill bg-obsidian px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
      >
        {isPending ? (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
        ) : null}
        {isPending ? t("planning") : t("plan", { count })}
      </button>
      {result.serverError ? (
        <span className="max-w-xs text-right text-xs text-danger">{result.serverError}</span>
      ) : null}
    </span>
  );
}
