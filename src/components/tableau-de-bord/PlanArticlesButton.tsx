"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { planArticlesAction } from "@/features/dashboard/actions";

/**
 * Ajoute quatre sujets au planning, un par semaine, à la suite du dernier déjà
 * daté. Le rythme hebdomadaire n'est pas paramétrable ici : c'est celui que
 * l'abonnement annonce, et le changer se fait dans le calendrier lui-même.
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
        onClick={() => execute({ count, everyDays: 7 })}
        disabled={isPending}
        className="inline-flex cursor-pointer items-center rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink disabled:opacity-60"
      >
        {isPending ? t("planning") : t("plan", { count })}
      </button>
      {result.serverError ? (
        <span className="max-w-xs text-right text-xs text-danger">{result.serverError}</span>
      ) : null}
    </span>
  );
}
