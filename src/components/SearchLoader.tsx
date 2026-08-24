"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import competitors from "@/lottie/ranking.json";
import keywords from "@/lottie/crawlers.json";
import writing from "@/lottie/recommend.json";
import prospects from "@/lottie/fetch.json";
import audit from "@/lottie/citability.json";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * L'attente d'une recherche, partout la même.
 *
 * Une carte vide sur un dégradé, une animation, et le nom de ce qui est
 * cherché. Ce dernier point n'est pas décoratif : ces appels durent de dix
 * secondes à deux minutes, et une attente muette se lit comme une panne. Dire
 * « nous cherchons vos concurrents » transforme le même délai en travail visible.
 *
 * Aucune barre de progression. Nous ne savons pas combien de pages seront lues
 * ni combien de moteurs répondront : une barre bloquée à 80 % inquiète plus
 * qu'elle ne rassure. Les étapes défilent à la place.
 */

export type SearchKind = "competitors" | "keywords" | "writing" | "prospects" | "audit";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ANIMATIONS: Record<SearchKind, any> = {
  competitors,
  keywords,
  writing,
  prospects,
  audit,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Ce qui se passe, dit dans l'ordre où ça se passe. */
const STEPS: Record<SearchKind, string[]> = {
  competitors: [
    "Lecture de votre activité…",
    "Repérage des enseignes du même créneau…",
    "Vérification de leur existence…",
    "Classement du plus direct au moins direct…",
  ],
  keywords: [
    "Relevé des requêtes de votre niche…",
    "Comparaison avec ce que votre site dit déjà…",
    "Choix des mots à placer…",
  ],
  writing: [
    "Relecture du ton de votre marque…",
    "Mise en place du plan…",
    "Rédaction section par section…",
  ],
  prospects: [
    "Recherche des sites de votre niche…",
    "Tri par autorité…",
    "Recherche des adresses de contact…",
  ],
  audit: [
    "Lecture de votre site page par page…",
    "Interrogation de ChatGPT, Gemini et Claude…",
    "Notation et plan d'action…",
  ],
};

/** Une phrase toutes les huit secondes : le temps de la lire sans la relire. */
const ROTATION_MS = 8000;

export function SearchLoader({
  kind,
  title,
  className = "",
  compact = false,
}: {
  kind: SearchKind;
  /** Remplace la première ligne quand l'écran dit déjà ce qui est cherché. */
  title?: string;
  className?: string;
  /** Version courte : à l'intérieur d'une carte qui a déjà son cadre. */
  compact?: boolean;
}) {
  const steps = STEPS[kind];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((current) => Math.min(current + 1, steps.length - 1)),
      ROTATION_MS,
    );
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative isolate overflow-hidden ${
        compact ? "rounded-2xl" : "rounded-[28px] border border-border"
      } bg-surface ${className}`}
    >
      {/* Le dégradé : deux voiles très pâles posés en biais, qui respirent
          lentement. Assez pour que la carte ne soit pas un rectangle mort,
          assez peu pour que le texte reste le premier élément lu. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-[loader-drift_9s_ease-in-out_infinite] bg-[radial-gradient(120%_120%_at_15%_0%,rgba(255,90,0,0.10),transparent_55%),radial-gradient(110%_110%_at_100%_100%,rgba(17,180,140,0.12),transparent_55%)]"
      />

      <div
        className={`flex flex-col items-center text-center ${
          compact ? "px-5 py-7" : "px-6 py-12 sm:py-16"
        }`}
      >
        <div aria-hidden className={compact ? "w-28" : "w-40 max-w-[50vw]"}>
          <Lottie animationData={ANIMATIONS[kind]} loop autoplay className="h-full w-full" />
        </div>

        <p className={`mt-4 font-semibold ${compact ? "text-sm" : "text-lg"}`}>
          {title ?? steps[0]}
        </p>
        <p className="mt-1.5 max-w-sm text-sm text-muted">{steps[index]}</p>
      </div>
    </div>
  );
}
