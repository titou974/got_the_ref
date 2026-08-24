"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { refreshRankingsAction } from "@/features/dashboard/actions";

/**
 * Relance le relevé des classements auprès des trois moteurs.
 *
 * Le bouton reste à côté du bloc qu'il met à jour : c'est la seule mesure de la
 * page qui dépend d'un appel sortant, et le client doit voir laquelle il
 * redemande. L'attente est annoncée en clair — trois moteurs à interroger, ce
 * n'est pas instantané.
 */
export function RefreshRankingsButton() {
  const t = useTranslations("dashboard.rankings");
  const router = useRouter();
  const { execute, isPending, result } = useAction(refreshRankingsAction, {
    onSuccess: () => router.refresh(),
  });

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => execute({})}
        className="inline-flex cursor-pointer items-center rounded-pill border border-graphite px-4 py-2 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60"
      >
        {isPending ? t("refreshing") : t("refresh")}
      </button>
      {result.serverError ? (
        <span className="text-xs text-danger">{result.serverError}</span>
      ) : null}
    </span>
  );
}
