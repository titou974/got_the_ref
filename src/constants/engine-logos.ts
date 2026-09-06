import type { AiEngine } from "@/lib/geo/types";

/**
 * Le logo de chaque moteur suivi, servi depuis `public/`.
 *
 * La table vit ici, dans un module neutre, et non à côté des cartes de
 * classement : celles-ci sont un composant client, et un objet exporté depuis un
 * module `"use client"` n'arrive au serveur que sous forme de référence — le
 * lire dans un composant serveur lèverait une erreur au lieu de rendre une
 * image. La carte de progression, elle, est rendue sur le serveur.
 */
export const ENGINE_LOGOS: Record<AiEngine, string> = {
  ChatGPT: "/chatgpt.png",
  Gemini: "/gemini.webp",
  Perplexity: "/perplexity.png",
  Claude: "/claude.svg",
};
