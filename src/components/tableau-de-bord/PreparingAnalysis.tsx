"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { prepareDashboardAction } from "@/features/dashboard/actions";
import { Card } from "./Card";

/**
 * L'analyse lancée à la première ouverture du tableau de bord.
 *
 * Elle part toute seule : le client vient de finir le tunnel d'accueil, lui
 * demander un clic de plus pour obtenir ce qu'il attend n'apporterait rien. Le
 * garde-fou `started` évite qu'un double rendu en déclenche deux.
 *
 * Aucune barre de progression : l'audit dure de une à trois minutes selon la
 * taille du site, et personne ne sait à l'avance où il en est.
 */
export function PreparingAnalysis() {
  const t = useTranslations("dashboard.preparing");
  const router = useRouter();
  const started = useRef(false);

  const { execute, result, isPending } = useAction(prepareDashboardAction, {
    onSuccess: () => router.refresh(),
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    execute({});
  }, [execute]);

  const failed = Boolean(result.serverError) && !isPending;

  return (
    <Card className="text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {failed ? result.serverError : t("body")}
      </p>

      {failed ? (
        <button
          type="button"
          onClick={() => execute({})}
          className="mt-5 cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
        >
          {t("retry")}
        </button>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-pill bg-mist"
        >
          <span className="block h-full w-1/3 animate-[loading_1.4s_ease-in-out_infinite] rounded-pill bg-obsidian" />
        </div>
      )}
    </Card>
  );
}
