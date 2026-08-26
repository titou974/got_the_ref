"use client";

import { useAction } from "next-safe-action/hooks";
import { openBillingPortalAction } from "@/features/billing/actions";

/** L'habillage par défaut : une pilule, comme sur les pages publiques. */
const PILL =
  "cursor-pointer rounded-full border border-graphite px-5 py-2.5 text-sm font-medium text-graphite transition-colors duration-200 hover:bg-mist disabled:opacity-60";

/**
 * `className` permet à la colonne du tableau de bord de le poser en simple
 * lien, à côté de la déconnexion : c'est le même geste, pas la même hiérarchie.
 */
export function BillingPortalButton({
  label,
  className = PILL,
}: {
  label: string;
  className?: string;
}) {
  const { execute, isPending } = useAction(openBillingPortalAction);

  return (
    <button type="button" onClick={() => execute()} disabled={isPending} className={className}>
      {label}
    </button>
  );
}
