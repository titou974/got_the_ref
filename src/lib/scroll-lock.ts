"use client";

/**
 * Verrou de scroll partagé, à compteur de références.
 *
 * Deux raisons de ne pas écrire `document.body.style.overflow` depuis chaque
 * composant :
 *
 * 1. Les verrous se chevauchent. La modale « pas de fiche Maps » se ferme avec
 *    une animation de sortie pendant que l'overlay d'analyse se monte : celui-ci
 *    lisait alors `overflow: hidden` comme valeur « précédente » et la
 *    réappliquait en se démontant — la page d'analyse arrivait bloquée, et seul
 *    un rechargement la débloquait.
 * 2. `overflow: hidden` sur `body` ne suffit pas à empêcher le pan tactile sur
 *    iOS. Il faut aussi couper `touch-action` et l'`overscroll-behavior`, ce que
 *    la classe `.scroll-locked` (cf. globals.css) applique sur `html` et `body`.
 *
 * Le compteur garantit que le scroll ne revient qu'au dernier relâchement, quel
 * que soit l'ordre de montage/démontage.
 */

const CLASS = "scroll-locked";

let locks = 0;

/**
 * Verrouille le scroll de la page et renvoie la fonction de relâchement.
 * Idempotente : appeler le relâchement deux fois ne décompte qu'une fois.
 */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  locks += 1;
  document.documentElement.classList.add(CLASS);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.documentElement.classList.remove(CLASS);
  };
}
