"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { RiRefreshLine } from "@remixicon/react";
import { refreshMapsPlaceAction } from "@/features/dashboard/actions";
import { ROUTES } from "@/constants/routes";

/**
 * Le bouton qui va rechercher la fiche chez Google.
 *
 * Le relevé passe par un scraper et prend une minute ou deux : le bouton le dit
 * plutôt que de tourner en silence. Il n'y a pas de relevé automatique — chaque
 * appel se paie, et c'est au client de décider quand sa fiche a bougé.
 *
 * C'est aussi ce qui borne le compte gratuit : il a droit au premier relevé,
 * celui qui remplit la page, et à lui seul. L'actualisation se répète semaine
 * après semaine — c'est le travail vendu —, alors le bouton mène aux tarifs
 * plutôt que de lancer un run facturé (cf. `canFetchPlace`).
 */
export function SyncPlaceButton({
  hasPlace,
  stale,
  block = false,
  locked = false,
}: {
  hasPlace: boolean;
  /** Relevé daté de plus d'un jour : le bouton se met en avant. */
  stale?: boolean;
  /** Pleine largeur, quand il tient dans la colonne de droite plutôt qu'en tête. */
  block?: boolean;
  /** L'offre n'ouvre pas le relevé suivant : le bouton devient l'appel. */
  locked?: boolean;
}) {
  const router = useRouter();
  const sync = useAction(refreshMapsPlaceAction, { onSuccess: () => router.refresh() });

  const label = sync.isPending
    ? "Relevé en cours…"
    : hasPlace
      ? "Actualiser la fiche"
      : "Relever ma fiche";

  const emphasis = !hasPlace || stale;

  if (locked) {
    return (
      <div className={`flex flex-col gap-1.5 ${block ? "items-stretch" : "items-end"}`}>
        <Link
          href={ROUTES.pricing}
          className={`inline-flex items-center justify-center gap-2 rounded-pill bg-cta py-3 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover ${
            block ? "w-full px-[18px]" : "px-4 py-2"
          }`}
        >
          <RiRefreshLine size={15} />
          Suivre ma fiche
        </Link>
        <p className={`text-xs text-muted ${block ? "text-center" : "text-right"}`}>
          Un relevé par semaine, avec l&apos;abonnement Tout-en-un.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${block ? "items-stretch" : "items-end"}`}>
      <button
        type="button"
        onClick={() => sync.execute({ force: false })}
        disabled={sync.isPending}
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-pill py-3 text-sm font-medium transition-colors duration-200 disabled:opacity-60 ${
          block ? "w-full px-[18px]" : "px-4 py-2"
        } ${
          emphasis
            ? "bg-obsidian text-white hover:bg-ink"
            : "border border-border bg-surface text-text hover:bg-mist"
        }`}
      >
        <RiRefreshLine size={15} className={sync.isPending ? "animate-spin" : ""} />
        {label}
      </button>

      {sync.isPending ? (
        <p className={`text-xs text-muted ${block ? "text-center" : ""}`}>
          Google met environ une minute à répondre.
        </p>
      ) : null}

      {sync.result.serverError ? (
        <p className={`text-xs text-danger ${block ? "" : "max-w-xs text-right"}`}>
          {sync.result.serverError}
        </p>
      ) : null}
    </div>
  );
}
