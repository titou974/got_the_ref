// Tremor cx [v0.0.0]

import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Concatène des classes Tailwind en laissant la dernière gagner.
 *
 * Les composants Tremor s'en servent partout : leurs classes par défaut doivent
 * pouvoir être écrasées par le `className` passé à l'appel, ce qu'une simple
 * interpolation de chaînes ne sait pas faire.
 */
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

// Le bleu de Tremor n'a pas de place ici : le système n'a pas d'accent
// chromatique, l'emphase se fait au noir. Les deux constantes gardent leur nom
// pour rester interchangeables avec un composant Tremor collé tel quel.
export const focusInput = [
  "focus:ring-2",
  "focus:ring-pebble/60",
  "focus:border-obsidian",
];

export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-obsidian",
];

export const hasErrorInput = [
  "ring-2",
  "border-red-500 dark:border-red-700",
  "ring-red-200 dark:ring-red-700/30",
];
