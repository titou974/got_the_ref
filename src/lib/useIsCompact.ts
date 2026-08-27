"use client";

import * as React from "react";

/** En deçà du palier `sm` de Tailwind : la largeur d'un téléphone. */
const QUERY = "(max-width: 639px)";

const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

/**
 * Vrai sur un écran de téléphone.
 *
 * Sert aux composants dont la mise en forme passe par des props et non par des
 * classes — un graphique, par exemple, qui ne peut pas cacher son axe des
 * ordonnées en CSS. Le doubler en deux exemplaires masqués à tour de rôle
 * coûterait deux rendus et deux mesures pour un seul dessin visible.
 *
 * Lu par `useSyncExternalStore` plutôt que par un effet : le rendu serveur
 * répond « non » (le grand écran), et le navigateur corrige au premier rendu
 * sans passer par un état intermédiaire.
 */
export function useIsCompact() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
