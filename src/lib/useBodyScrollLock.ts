"use client";

import { useEffect } from "react";

/**
 * Verrou de scroll partagé par tous les calques modaux (tiroir mobile, modale de
 * confirmation, overlay d'analyse).
 *
 * Chaque appelant posait auparavant son propre verrou en mémorisant la valeur
 * courante de `body.style.overflow` puis en la restaurant au démontage. Dès que
 * deux calques se chevauchent — et c'est le cas nominal : la modale « pas de
 * fiche Maps » est encore en animation de sortie quand l'overlay d'analyse
 * monte — le second capture `"hidden"` comme valeur « précédente » et la
 * réapplique en partant. Le `<body>` survit à la navigation client : la page
 * suivante restait alors définitivement non scrollable, tout bouton hors du
 * premier écran devenant inatteignable.
 *
 * Un compteur de verrous règle le problème : seule la pose du premier verrou
 * mémorise l'état d'origine, seule la levée du dernier le restaure.
 */

let lockCount = 0;
let restoreOverflow = "";

function acquire() {
  if (lockCount === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function release() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = restoreOverflow;
    restoreOverflow = "";
  }
}

/** Verrouille le scroll du body tant que `active` est vrai. */
export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active]);
}
