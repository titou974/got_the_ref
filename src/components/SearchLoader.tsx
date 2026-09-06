"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AiKeycaps } from "@/components/AiKeycaps";
import competitors from "@/lottie/ranking.json";
import keywords from "@/lottie/crawlers.json";
import writing from "@/lottie/recommend.json";
import prospects from "@/lottie/fetch.json";
import audit from "@/lottie/citability.json";
import saving from "@/lottie/score.json";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * L'attente d'une recherche, partout la même.
 *
 * Une carte, l'animation de ce qui est cherché, le nom de l'étape en cours, et
 * les trois touches de moteur qui s'enfoncent en dessous. Ce dernier point
 * n'est pas décoratif : ces appels durent de dix secondes à deux minutes, et
 * une attente muette se lit comme une panne. Voir une touche s'enfoncer dit que
 * quelqu'un est en train de poser la question.
 *
 * La carte est en gris du thème — surface blanche, arête `fog`, un seul voile
 * graphite qui dérive. Le système n'a pas d'accent chromatique dans l'interface :
 * un dégradé coloré ici ne venait d'aucune autre page.
 *
 * Aucune barre de progression. Nous ne savons pas combien de pages seront lues
 * ni combien de moteurs répondront : une barre bloquée à 80 % inquiète plus
 * qu'elle ne rassure. Les étapes défilent à la place.
 */

export type SearchKind =
  | "competitors"
  | "keywords"
  | "writing"
  | "prospects"
  | "audit"
  | "saving";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ANIMATIONS: Record<SearchKind, any> = {
  competitors,
  keywords,
  writing,
  prospects,
  audit,
  saving,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Ce qui se passe, dit dans l'ordre où ça se passe. */
const STEPS: Record<SearchKind, string[]> = {
  competitors: [
    "Lecture de votre activité…",
    "Recherche Google des enseignes de votre créneau…",
    "Vérification de leur existence et de leur site…",
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
    "Interrogation de ChatGPT et de Gemini…",
    "Notation et plan d'action…",
  ],
  // Le titre de l'étape dit déjà ce qui s'enregistre : la ligne du dessous
  // avance, elle ne répète pas.
  saving: ["Mise à jour de votre fiche…", "Préparation de l'étape suivante…"],
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
        compact ? "rounded-2xl" : "rounded-[28px] border border-fog"
      } bg-snow ${className}`}
    >
      {/* Un seul voile graphite, très pâle, qui respire lentement. Assez pour
          que la carte ne soit pas un rectangle mort, assez peu pour que le
          texte reste le premier élément lu. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 animate-[loader-drift_9s_ease-in-out_infinite] bg-[radial-gradient(120%_120%_at_20%_0%,rgba(9,9,11,0.055),transparent_58%),radial-gradient(110%_110%_at_100%_100%,rgba(9,9,11,0.035),transparent_58%)]"
      />

      <div
        className={`flex flex-col items-center text-center ${
          compact ? "px-5 py-7" : "px-6 py-9 sm:py-11"
        }`}
      >
        <div aria-hidden className={compact ? "w-28" : "w-32 max-w-[40vw]"}>
          <Lottie animationData={ANIMATIONS[kind]} loop autoplay className="h-full w-full" />
        </div>

        <p className={`mt-4 font-semibold ${compact ? "text-sm" : "text-lg"}`}>
          {title ?? steps[0]}
        </p>
        <p className="mt-1.5 max-w-sm text-sm text-muted">{steps[index]}</p>

        {/* Les moteurs qu'on interroge, sous la forme où le client les tape. */}
        {!compact && <AiKeycaps className="mt-7" />}
      </div>
    </div>
  );
}
