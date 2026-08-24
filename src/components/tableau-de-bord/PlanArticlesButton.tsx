"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { planArticlesAction } from "@/features/dashboard/actions";
import { SearchLoader } from "@/components/SearchLoader";

/**
 * Ajoute quatre sujets au planning, un par semaine, à la suite du dernier déjà
 * daté. Le rythme hebdomadaire n'est pas paramétrable ici : c'est celui que
 * l'abonnement annonce, et le changer se fait dans le calendrier lui-même.
 *
 * Le temps que le modèle réponde, la barre cède la place à l'attente. Un bouton
 * grisé pendant quarante secondes se lit comme un bouton cassé ; une carte qui
 * annonce ce qui est cherché se lit comme du travail en cours.
 */
export function PlanArticlesButton({ count = 4 }: { count?: number }) {
  const t = useTranslations("dashboard.articles");
  const router = useRouter();
  const { execute, isPending, result } = useAction(planArticlesAction, {
    onSuccess: () => router.refresh(),
  });

  if (isPending) {
    return <SearchLoader kind="writing" compact title={t("planning")} />;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-border bg-surface px-5 py-4">
      <p className="min-w-0 text-sm text-muted">{t("planHint")}</p>
      <span className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => execute({ count, everyDays: 7 })}
          className="inline-flex cursor-pointer items-center rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
        >
          {t("plan", { count })}
        </button>
        {result.serverError ? (
          <span className="max-w-xs text-right text-xs text-danger">{result.serverError}</span>
        ) : null}
      </span>
    </div>
  );
}
