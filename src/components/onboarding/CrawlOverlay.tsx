"use client";

import { useEffect, useState } from "react";
import { AiKeycaps } from "@/components/AiKeycaps";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

/**
 * Le voile d'attente pendant la lecture du site.
 *
 * Au-dessus des phrases, les trois touches des moteurs — ChatGPT, Perplexity,
 * Gemini — enfoncées l'une après l'autre, comme sur le loader de l'analyse.
 * L'attente est la même des deux côtés du produit : elle doit se reconnaître.
 * Une animation abstraite ne disait pas à qui on allait poser la question.
 *
 * Le crawl prend de vingt secondes à deux minutes selon la taille du site.
 * Aucune barre de progression : nous ne savons pas combien de pages seront
 * trouvées, et une barre qui stagne à 80 % inquiète plus qu'elle ne rassure.
 * On annonce plutôt ce qui est en cours, étape par étape.
 */
const STEPS = [
  "Ouverture de votre site…",
  "Parcours des liens internes…",
  "Lecture du contenu page par page…",
  "Repérage de la langue et du lieu…",
  "Mise en place de votre fiche…",
];

/** Une phrase toutes les huit secondes : le temps de la lire sans la relire. */
const ROTATION_MS = 8000;

export function CrawlOverlay() {
  const [index, setIndex] = useState(0);
  useBodyScrollLock(true);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((current) => Math.min(current + 1, STEPS.length - 1)),
      ROTATION_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 px-6 backdrop-blur"
    >
      <AiKeycaps />

      <p className="mt-8 text-center text-lg font-semibold">{STEPS[index]}</p>
      <p className="mt-2 max-w-xs text-center text-sm text-muted">
        Comptez une minute environ. Gardez cet onglet ouvert : nous vous emmenons à l&apos;étape
        suivante dès que c&apos;est prêt.
      </p>
    </div>
  );
}
