"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";
import { regenerateOnPageAction } from "@/features/dashboard/actions";
import type { OnPageElementKey } from "@/constants/plans";

/**
 * « Regénérer », en haut à droite de la carte qu'il concerne.
 *
 * Le compteur du jour est affiché à côté du libellé plutôt que caché derrière
 * une info-bulle : trois essais par élément, c'est une ressource, et le client
 * décide de la dépenser en la voyant. À zéro, le bouton reste en place mais
 * inerte — le faire disparaître laisserait croire à une panne.
 *
 * Le plafond réel est appliqué par l'action serveur ; ce compteur n'est
 * qu'un affichage.
 */
export function RegenerateButton({
  element,
  remaining,
  limit,
}: {
  element: OnPageElementKey;
  remaining: number;
  limit: number;
}) {
  const t = useTranslations("dashboard.content");
  const router = useRouter();
  const [left, setLeft] = useState(remaining);

  const { execute, isPending, result } = useAction(regenerateOnPageAction, {
    onSuccess: ({ data }) => {
      if (data) setLeft(data.remaining);
      router.refresh();
    },
  });

  const exhausted = left <= 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => execute({ element })}
        disabled={isPending || exhausted}
        className="cursor-pointer rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? t("regenerating") : t("regenerate")}
      </button>
      <span className="text-[11px] tabular-nums text-ash">
        {exhausted ? t("regenerateExhausted") : t("regenerateLeft", { left, limit })}
      </span>
      {result.serverError ? (
        <span className="max-w-[220px] text-right text-[11px] text-danger">
          {result.serverError}
        </span>
      ) : null}
    </div>
  );
}
