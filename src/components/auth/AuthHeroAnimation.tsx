"use client";

import dynamic from "next/dynamic";
import animation from "@/lottie/auth-hero.json";

// lottie-react touche à `window` → chargé côté client uniquement.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Le bandeau qui coiffe les pages d'inscription et de connexion : une boucle
 * Lottie, à la place de la carte du monde piquetée qu'on voyait ailleurs.
 *
 * Elle tourne sans fin et sans interaction — c'est un décor, pas un contenu :
 * `aria-hidden` la retire donc de l'arbre d'accessibilité.
 *
 * Le conteneur porte le rapport natif de l'animation (1072 × 574) et `meet`
 * l'inscrit en entier : recadrer en `slice` amputait les personnages du bas.
 */
export function AuthHeroAnimation({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none aspect-[1072/574] w-full select-none ${className}`}
    >
      <Lottie
        animationData={animation}
        loop
        autoplay
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        className="h-full w-full"
      />
    </div>
  );
}
