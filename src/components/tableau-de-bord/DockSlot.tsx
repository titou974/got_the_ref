"use client";

import { usePathname } from "next/navigation";

/**
 * Le bas de l'écran n'appartient qu'à une barre à la fois.
 *
 * La coque monte « résoudre avec les agents IA » sur les six onglets : c'est le
 * geste que le produit vend, et il doit suivre le client partout. Partout sauf
 * dans un article ouvert — là, l'atelier pose sa propre barre, celle qui publie
 * ou valide *cet* article. Deux pilules flottantes au même endroit se
 * recouvriraient, et la seconde parlerait du site entier au moment où le client
 * décide du sort d'un texte.
 *
 * Le tri se fait sur le chemin, côté client : les dispositions Next.js ne
 * connaissent pas la route qu'elles enveloppent, et remonter l'information par
 * un contexte aurait demandé à chaque page de la déclarer.
 */
const ARTICLE_ROUTE = /^\/tableau-de-bord\/articles\/[^/]+$/;

export function DockSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (ARTICLE_ROUTE.test(pathname)) return null;
  return <>{children}</>;
}
