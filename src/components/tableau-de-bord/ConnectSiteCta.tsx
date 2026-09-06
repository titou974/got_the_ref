"use client";

import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { useConnectSite } from "@/components/dashboard/ConnectSiteTrigger";

/**
 * Le bouton qui va chercher la porte manquante, dans le bandeau des articles.
 *
 * Il ouvre la modale de rattachement, celle que porte la barre du bas de la même
 * page : le client y voit ses articles se poser sur son site et y colle ses
 * identifiants sans quitter l'écran. Il menait aux réglages, ce qui lui faisait
 * traverser une page pour retrouver le formulaire qu'on lui montre ici.
 *
 * Le renvoi aux réglages reste, en repli, pour les écrans où la barre n'est pas
 * montée — un compte dont l'analyse n'est pas encore faite, par exemple. Mieux
 * vaut un chemin plus long qu'un bouton qui ne fait rien.
 */
export function ConnectSiteCta({ label }: { label: string }) {
  const trigger = useConnectSite();

  const className =
    "mt-4 inline-flex cursor-pointer items-center rounded-pill bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pill)] transition-colors duration-200 hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian/40";

  if (!trigger) {
    return (
      <Link href={ROUTES.dashboardSettings} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={trigger.requestOpen} className={className}>
      {label}
    </button>
  );
}
