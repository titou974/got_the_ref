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

export const focusInput = [
  "focus:ring-2",
  "focus:ring-blue-200 dark:focus:ring-blue-700/30",
  "focus:border-blue-500 dark:focus:border-blue-700",
];

export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-blue-500 dark:outline-blue-500",
];

export const hasErrorInput = [
  "ring-2",
  "border-red-500 dark:border-red-700",
  "ring-red-200 dark:ring-red-700/30",
];
