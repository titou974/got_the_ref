"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { RiRefreshLine } from "@remixicon/react";
import { refreshMapsPlaceAction } from "@/features/dashboard/actions";

/**
 * Le bouton qui va rechercher la fiche chez Google.
 *
 * Le relevé passe par un scraper et prend une minute ou deux : le bouton le dit
 * plutôt que de tourner en silence. Il n'y a pas de relevé automatique — chaque
 * appel se paie, et c'est au client de décider quand sa fiche a bougé.
 */
export function SyncPlaceButton({
  hasPlace,
  stale,
}: {
  hasPlace: boolean;
  /** Relevé daté de plus d'un jour : le bouton se met en avant. */
  stale?: boolean;
}) {
  const router = useRouter();
  const sync = useAction(refreshMapsPlaceAction, { onSuccess: () => router.refresh() });

  const label = sync.isPending
    ? "Relevé en cours…"
    : hasPlace
      ? "Actualiser la fiche"
      : "Relever ma fiche";

  const emphasis = !hasPlace || stale;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => sync.execute({ force: false })}
        disabled={sync.isPending}
        className={`inline-flex cursor-pointer items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors duration-200 disabled:opacity-60 ${
          emphasis
            ? "bg-obsidian text-white hover:bg-ink"
            : "border border-border bg-surface text-text hover:bg-mist"
        }`}
      >
        <RiRefreshLine size={15} className={sync.isPending ? "animate-spin" : ""} />
        {label}
      </button>

      {sync.isPending ? (
        <p className="text-xs text-muted">Google met environ une minute à répondre.</p>
      ) : null}

      {sync.result.serverError ? (
        <p className="max-w-xs text-right text-xs text-danger">{sync.result.serverError}</p>
      ) : null}
    </div>
  );
}
