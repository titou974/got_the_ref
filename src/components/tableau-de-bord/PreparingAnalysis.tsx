"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { prepareDashboardAction } from "@/features/dashboard/actions";
import { Card } from "./Card";
import { AiKeysAnimation } from "./AiKeysAnimation";

/**
 * L'analyse lancée à la première ouverture du tableau de bord.
 *
 * Elle part toute seule : le client vient de finir le tunnel d'accueil, lui
 * demander un clic de plus pour obtenir ce qu'il attend n'apporterait rien. Le
 * garde-fou `started` évite qu'un double rendu en déclenche deux.
 *
 * Aucune barre de progression : l'audit dure de une à trois minutes selon la
 * taille du site, et personne ne sait à l'avance où il en est. À la place, la
 * question est tapée sous les yeux du client dans ChatGPT, Perplexity puis
 * Gemini : c'est exactement ce qui se joue pendant qu'il attend.
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

  if (failed) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{result.serverError}</p>
        <button
          type="button"
          onClick={() => execute({})}
          className="mt-5 cursor-pointer rounded-pill bg-obsidian px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ink"
        >
          {t("retry")}
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("body")}</p>
      </div>

      <AiKeysAnimation />
    </div>
  );
}
