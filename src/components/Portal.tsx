"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Rien à écouter : seul l'écart serveur/client nous intéresse. */
const noopSubscribe = () => () => {};

/**
 * Sort un contenu du flux React pour l'accrocher à `document.body`.
 *
 * Une couche `position: fixed` n'est plein écran que si aucun de ses ancêtres
 * n'établit de bloc conteneur. Or la carte de l'analyse gratuite se soulève au
 * survol (`.card-cal:hover { transform: translateY(-4px) }`) : dès que la souris
 * la traverse, le `transform` recale l'overlay sur la carte, `overflow-hidden`
 * le rogne et il se met à suivre le scroll. Le portail le met hors d'atteinte.
 *
 * Rien n'est rendu côté serveur : `document` n'y existe pas.
 */
export function Portal({ children }: { children: ReactNode }) {
  // `useSyncExternalStore` distingue serveur et client sans setState différé :
  // le premier rendu client vaut déjà `true`, donc pas d'écart d'hydratation.
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!isClient) return null;
  return createPortal(children, document.body);
}
